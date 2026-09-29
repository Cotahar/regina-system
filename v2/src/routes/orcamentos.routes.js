import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireLogin } from '../middleware/auth.js';
import { renderOrcamentoPdf } from '../views/orcamentoPdf.js';

export const orcamentosRouter = Router();

function normalizarCnpj(valor) {
  const digitos = (valor || '').replace(/\D/g, '');
  return digitos || null;
}

function toDictOrcamentoResumo(o) {
  return {
    id: o.id,
    codigo: o.codigo,
    data: o.data,
    destinatario_nome: o.destinatario_nome,
    destino_cidade: o.destino_cidade,
    destino_estado: o.destino_estado,
    valor_total: o.valor_total || 0,
    criado_em: o.criado_em
  };
}

orcamentosRouter.get('/api/orcamentos', requireLogin, (req, res) => {
  const orcamentos = db.prepare(`
    SELECT o.*, COALESCE(SUM(i.valor_frete_total), 0) as valor_total
    FROM orcamentos o
    LEFT JOIN orcamento_itens i ON i.orcamento_id = o.id
    GROUP BY o.id
    ORDER BY o.id DESC
  `).all();
  res.json(orcamentos.map(toDictOrcamentoResumo));
});

function carregarOrcamentoDetalhe(id) {
  const orcamento = db.prepare('SELECT * FROM orcamentos WHERE id = ?').get(id);
  if (!orcamento) return null;
  const itens = db.prepare('SELECT * FROM orcamento_itens WHERE orcamento_id = ? ORDER BY ordem, id').all(id);
  return { orcamento, itens };
}

orcamentosRouter.get('/api/orcamentos/:id', requireLogin, (req, res) => {
  const detalhe = carregarOrcamentoDetalhe(req.params.id);
  if (!detalhe) return res.status(404).json({ error: 'Orcamento nao encontrado' });
  res.json(detalhe);
});

// Remetente e destinatario sempre vem do cadastro (a tela so deixa
// selecionar clientes existentes) - por isso aqui so validamos que os ids
// informados realmente existem, sem checagem de CNPJ duplicado (nao tem
// como duplicar selecionando de uma lista unica).
orcamentosRouter.post('/api/orcamentos', requireLogin, (req, res) => {
  const data = req.body || {};
  const destinatarioId = Number(data.destinatario_id);
  const itens = Array.isArray(data.itens) ? data.itens : [];

  if (!destinatarioId) return res.status(400).json({ error: 'Selecione o destinatario.' });
  if (!itens.length) return res.status(400).json({ error: 'Adicione ao menos um item de frete.' });

  const destinatario = db.prepare('SELECT * FROM clientes WHERE id = ?').get(destinatarioId);
  if (!destinatario) return res.status(404).json({ error: 'Destinatario nao encontrado.' });

  // CNPJ e a chave principal - trava no que ja esta no cadastro; so aceita o
  // que veio no formulario quando o cadastro ainda nao tem CNPJ nenhum.
  const cnpjFinal = destinatario.cnpj || normalizarCnpj(data.destinatario_cnpj);
  if (!cnpjFinal) {
    return res.status(400).json({ error: 'Informe o CNPJ do destinatario para gerar o orcamento.' });
  }

  for (const item of itens) {
    if (!item.remetente_id) return res.status(400).json({ error: 'Selecione o remetente de cada item.' });
    if (!item.peso_kg) return res.status(400).json({ error: 'Informe o peso de cada item.' });
    if (!item.valor_frete_total) return res.status(400).json({ error: 'Informe o valor do frete de cada item.' });
  }

  const remetentes = new Map();
  for (const item of itens) {
    if (remetentes.has(item.remetente_id)) continue;
    const remetente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(item.remetente_id);
    if (!remetente) return res.status(404).json({ error: `Remetente ${item.remetente_id} nao encontrado.` });
    remetentes.set(item.remetente_id, remetente);
  }

  const codigo = `ORC-${Date.now()}`;

  db.exec('BEGIN');
  let orcamentoId;
  try {
    const info = db.prepare(`
      INSERT INTO orcamentos (
        codigo, data, destinatario_id, destinatario_nome, destinatario_cnpj,
        destino_cidade, destino_estado, produto, prazo_entrega, forma_pagamento,
        descarga_metros, mercadoria_segurada, frete_ajustavel_diesel, observacoes, usuario_nome
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      codigo,
      data.data || new Date().toISOString().slice(0, 10),
      destinatarioId,
      (data.destinatario_nome || destinatario.razao_social || '').toUpperCase(),
      cnpjFinal,
      (data.destino_cidade || '').toUpperCase() || null,
      (data.destino_estado || '').toUpperCase() || null,
      data.produto || null,
      data.prazo_entrega || null,
      data.forma_pagamento || null,
      data.descarga_metros || null,
      data.mercadoria_segurada === false ? 0 : 1,
      data.frete_ajustavel_diesel === false ? 0 : 1,
      data.observacoes || null,
      req.session.userName
    );
    orcamentoId = info.lastInsertRowid;

    const inserirItem = db.prepare(`
      INSERT INTO orcamento_itens (orcamento_id, ordem, remetente_id, remetente_nome, peso_kg, valor_tonelada, valor_frete_total, descarga_inclusa)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    itens.forEach((item, indice) => {
      const remetente = remetentes.get(item.remetente_id);
      inserirItem.run(
        orcamentoId,
        indice,
        item.remetente_id,
        (item.remetente_nome || remetente.razao_social || '').toUpperCase(),
        item.peso_kg,
        item.valor_tonelada || null,
        item.valor_frete_total,
        item.descarga_inclusa === false ? 0 : 1
      );
    });

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(400).json({ error: err.message });
  }

  // Depois de salvo, compara o que foi digitado nesse orcamento com o que
  // esta hoje no cadastro de cada cliente envolvido (destinatario + cada
  // remetente distinto) - so sugere quando realmente mudou algo, pra tela
  // perguntar se quer levar a correcao pro cadastro.
  const sugestoes = [];
  function compararESugerir(clienteId, nomeUsado, cidadeUsada, estadoUsada, cnpjUsado) {
    const cliente = clienteId === destinatarioId ? destinatario : remetentes.get(clienteId);
    const campos = [];
    if (nomeUsado && nomeUsado.toUpperCase() !== (cliente.razao_social || '')) {
      campos.push({ campo: 'razao_social', rotulo: 'Nome', valor: nomeUsado.toUpperCase() });
    }
    if (cidadeUsada && cidadeUsada.toUpperCase() !== (cliente.cidade || '')) {
      campos.push({ campo: 'cidade', rotulo: 'Cidade', valor: cidadeUsada.toUpperCase() });
    }
    if (estadoUsada && estadoUsada.toUpperCase() !== (cliente.estado || '')) {
      campos.push({ campo: 'estado', rotulo: 'UF', valor: estadoUsada.toUpperCase() });
    }
    if (cnpjUsado && cnpjUsado !== cliente.cnpj) {
      campos.push({ campo: 'cnpj', rotulo: 'CNPJ', valor: cnpjUsado });
    }
    if (campos.length) sugestoes.push({ cliente_id: clienteId, cliente_nome: cliente.razao_social, campos });
  }

  compararESugerir(destinatarioId, data.destinatario_nome, data.destinatario_cidade, data.destinatario_estado, cnpjFinal);
  for (const item of itens) {
    compararESugerir(item.remetente_id, item.remetente_nome, item.remetente_cidade, item.remetente_estado, null);
  }

  res.status(201).json({ message: `Orcamento ${codigo} gerado!`, id: Number(orcamentoId), sugestoes_atualizacao_cadastro: sugestoes });
});

orcamentosRouter.delete('/api/orcamentos/:id', requireLogin, (req, res) => {
  const orcamento = db.prepare('SELECT id FROM orcamentos WHERE id = ?').get(req.params.id);
  if (!orcamento) return res.status(404).json({ error: 'Orcamento nao encontrado' });
  db.prepare('DELETE FROM orcamentos WHERE id = ?').run(req.params.id);
  res.json({ message: 'Orcamento excluido.' });
});

orcamentosRouter.get('/orcamentos/:id/pdf', requireLogin, (req, res) => {
  const detalhe = carregarOrcamentoDetalhe(req.params.id);
  if (!detalhe) return res.status(404).send('Orcamento nao encontrado');
  res.type('html').send(renderOrcamentoPdf(detalhe));
});
