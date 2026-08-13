import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireLogin } from '../middleware/auth.js';

export const entregasRouter = Router();

// Exclusao em massa: entregas presas a uma carga voltam para "Disponiveis"
// (mesmo comportamento do X individual); entregas ja soltas sao excluidas de vez.
entregasRouter.delete('/api/entregas/em-massa', requireLogin, (req, res) => {
  const entregaIds = req.body?.entrega_ids;
  if (!entregaIds || !Array.isArray(entregaIds) || !entregaIds.length) {
    return res.status(400).json({ error: 'Nenhuma entrega selecionada.' });
  }

  const placeholders = entregaIds.map(() => '?').join(',');
  const entregas = db.prepare(`SELECT id, carga_id FROM entregas WHERE id IN (${placeholders})`).all(...entregaIds);

  const paraDesvincular = entregas.filter((e) => e.carga_id !== null).map((e) => e.id);
  const paraExcluir = entregas.filter((e) => e.carga_id === null).map((e) => e.id);

  if (paraDesvincular.length) {
    const ph = paraDesvincular.map(() => '?').join(',');
    db.prepare(`UPDATE entregas SET carga_id = NULL, is_last_delivery = 0, grupo_id = NULL WHERE id IN (${ph})`).run(...paraDesvincular);
  }
  if (paraExcluir.length) {
    const ph = paraExcluir.map(() => '?').join(',');
    db.prepare(`DELETE FROM entregas WHERE id IN (${ph})`).run(...paraExcluir);
  }

  res.json({
    message: `${paraDesvincular.length} entrega(s) devolvida(s) para disponiveis, ${paraExcluir.length} excluida(s) definitivamente.`
  });
});

// --- ENTREGAS DENTRO DE UMA CARGA (MODAL DE DETALHES) ---
entregasRouter.post('/api/cargas/:id/entregas', requireLogin, (req, res) => {
  const carga = db.prepare('SELECT id FROM cargas WHERE id = ?').get(req.params.id);
  if (!carga) return res.status(404).json({ error: 'Carga nao encontrada' });

  const { cliente_id: clienteId, remetente_id: remetenteId, peso_bruto: pesoBruto, valor_frete: valorFrete, local_coleta: localColeta } = req.body || {};
  if (!remetenteId) return res.status(400).json({ error: 'Remetente nao foi selecionado.' });

  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(clienteId);
  if (!cliente) return res.status(404).json({ error: 'Cliente (Destinatario) nao encontrado.' });

  db.prepare(`
    INSERT INTO entregas (carga_id, cliente_id, remetente_id, peso_bruto, valor_frete, cidade_entrega, estado_entrega, local_coleta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(carga.id, cliente.id, remetenteId, pesoBruto || null, valorFrete || null, cliente.cidade, cliente.estado, localColeta || null);

  res.status(201).json({ message: 'Entrega rapida adicionada com sucesso!' });
});

entregasRouter.delete('/api/cargas/:id/entregas', requireLogin, (req, res) => {
  const carga = db.prepare('SELECT id FROM cargas WHERE id = ?').get(req.params.id);
  if (!carga) return res.status(404).json({ error: 'Carga nao encontrada' });

  const entrega = db.prepare('SELECT * FROM entregas WHERE id = ?').get(req.body?.entrega_id);
  if (!entrega || entrega.carga_id !== carga.id) {
    return res.status(404).json({ error: 'Entrega nao encontrada nesta carga' });
  }

  db.prepare('UPDATE entregas SET carga_id = NULL WHERE id = ?').run(entrega.id);
  res.json({ message: 'Entrega devolvida para "Disponiveis".' });
});

// --- ENTREGAS DISPONIVEIS (POOL DA MONTAGEM) ---
entregasRouter.get('/api/entregas/disponiveis', requireLogin, (req, res) => {
  const entregas = db.prepare(`
    SELECT e.*,
      rem.razao_social as remetente_razao_social, rem.estado as remetente_estado,
      cli.razao_social as cliente_razao_social, cli.cidade as cliente_cidade, cli.estado as cliente_estado
    FROM entregas e
    LEFT JOIN clientes rem ON rem.id = e.remetente_id
    LEFT JOIN clientes cli ON cli.id = e.cliente_id
    WHERE e.carga_id IS NULL
    ORDER BY e.id DESC
  `).all();

  res.json(entregas.map((e) => ({
    id: e.id,
    remetente_id: e.remetente_id,
    cliente_id: e.cliente_id,
    remetente_nome: e.remetente_razao_social || 'N/A',
    remetente_uf: e.remetente_estado || '',
    destinatario_nome: e.cliente_razao_social || 'N/A',
    cidade_entrega: e.cidade_entrega || e.cliente_cidade || '',
    estado_entrega: e.estado_entrega || e.cliente_estado || '',
    cidade_entrega_override: e.cidade_entrega,
    estado_entrega_override: e.estado_entrega,
    peso_bruto: e.peso_bruto,
    valor_frete: e.valor_frete,
    peso_cubado: e.peso_cubado,
    valor_tonelada: e.valor_tonelada,
    nota_fiscal: e.nota_fiscal,
    is_cortesia: !!e.is_cortesia,
    grupo_id: e.grupo_id,
    local_coleta: e.local_coleta,
    selecionada: false
  })));
});

entregasRouter.post('/api/entregas/disponiveis', requireLogin, (req, res) => {
  const data = req.body || {};
  const isCortesia = !!data.is_cortesia;
  db.prepare(`
    INSERT INTO entregas (carga_id, cliente_id, remetente_id, peso_bruto, valor_frete, peso_cubado, valor_tonelada, nota_fiscal, cidade_entrega, estado_entrega, local_coleta, is_cortesia)
    VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.cliente_id, data.remetente_id || null, data.peso_bruto || null, isCortesia ? 0 : (data.valor_frete || null),
    data.peso_cubado || null, data.valor_tonelada || null, data.nota_fiscal || null, data.cidade_entrega || null, data.estado_entrega || null,
    data.local_coleta || null, isCortesia ? 1 : 0
  );
  res.status(201).json({ message: 'Entrega adicionada a lista de disponiveis!' });
});

entregasRouter.delete('/api/entregas/disponiveis/:id', requireLogin, (req, res) => {
  const entrega = db.prepare('SELECT id FROM entregas WHERE id = ? AND carga_id IS NULL').get(req.params.id);
  if (!entrega) return res.status(404).json({ error: 'Entrega disponivel nao encontrada' });
  db.prepare('DELETE FROM entregas WHERE id = ?').run(req.params.id);
  res.json({ message: 'Entrega disponivel excluida com sucesso.' });
});

entregasRouter.put('/api/entregas/bulk-update-remetente', requireLogin, (req, res) => {
  const { entrega_ids: entregaIds, novo_remetente_id: novoRemetenteId } = req.body || {};
  if (!entregaIds || !Array.isArray(entregaIds) || !entregaIds.length) {
    return res.status(400).json({ error: 'Nenhuma entrega selecionada.' });
  }
  if (!novoRemetenteId) return res.status(400).json({ error: 'Novo remetente nao informado.' });

  const novoRemetente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(novoRemetenteId);
  if (!novoRemetente) return res.status(404).json({ error: 'Remetente nao encontrado.' });

  const placeholders = entregaIds.map(() => '?').join(',');
  const info = db.prepare(`UPDATE entregas SET remetente_id = ? WHERE id IN (${placeholders})`)
    .run(novoRemetente.id, ...entregaIds);

  res.json({ message: `${info.changes} entrega(s) atualizada(s) para o remetente ${novoRemetente.razao_social}!` });
});

entregasRouter.put('/api/entregas/:id', requireLogin, (req, res) => {
  const entrega = db.prepare('SELECT * FROM entregas WHERE id = ?').get(req.params.id);
  if (!entrega) return res.status(404).json({ error: 'Entrega nao encontrada' });

  const data = req.body || {};
  const cortesiaForcada = 'is_cortesia' in data && data.is_cortesia;
  const camposSimples = [
    'remetente_id', 'peso_bruto', 'valor_frete', 'peso_cubado', 'nota_fiscal', 'cidade_entrega', 'estado_entrega',
    'local_coleta', 'valor_combinado', 'repasse_destinatario', 'valor_tonelada'
  ];
  const sets = [];
  const valores = [];
  for (const campo of camposSimples) {
    if (campo === 'valor_frete' && cortesiaForcada) continue; // sobrescrito abaixo
    if (campo in data) {
      sets.push(`${campo} = ?`);
      valores.push(data[campo]);
    }
  }

  if ('is_cortesia' in data) {
    sets.push('is_cortesia = ?');
    valores.push(data.is_cortesia ? 1 : 0);
    if (cortesiaForcada) {
      // Nota cortesia nao tem cobranca - o frete e sempre zerado, independente do que foi enviado.
      sets.push('valor_frete = ?');
      valores.push(0);
    }
  }

  if (sets.length) {
    valores.push(req.params.id);
    db.prepare(`UPDATE entregas SET ${sets.join(', ')} WHERE id = ?`).run(...valores);
  }

  if ('is_last_delivery' in data) {
    db.prepare('UPDATE entregas SET is_last_delivery = 0 WHERE carga_id = ?').run(entrega.carga_id);
    db.prepare('UPDATE entregas SET is_last_delivery = 1 WHERE id = ?').run(req.params.id);
  }

  res.json({ message: 'Entrega atualizada com sucesso!' });
});

function validarAgrupamento(entregas) {
  const remetentes = new Set(entregas.map((e) => e.remetente_id));
  const destinatarios = new Set(entregas.map((e) => e.cliente_id));
  if (remetentes.size > 1 || destinatarios.size > 1) {
    return 'So e possivel agrupar entregas com o mesmo remetente E o mesmo destinatario.';
  }
  const cortesias = new Set(entregas.map((e) => !!e.is_cortesia));
  if (cortesias.size > 1) {
    return 'Notas Cortesia nao podem ser agrupadas com notas normais.';
  }
  return null;
}

// Agrupamento e um vinculo (grupo_id compartilhado), nao um merge destrutivo -
// cada entrega continua existindo e editavel, e pode ser desfeito a qualquer momento.
entregasRouter.post('/api/entregas/agrupar', requireLogin, (req, res) => {
  const entregaIds = req.body?.entrega_ids;
  if (!entregaIds || entregaIds.length < 2) {
    return res.status(400).json({ error: 'Selecione pelo menos 2 entregas para agrupar.' });
  }

  const placeholders = entregaIds.map(() => '?').join(',');
  const entregas = db.prepare(`SELECT * FROM entregas WHERE id IN (${placeholders})`).all(...entregaIds);
  if (entregas.length !== entregaIds.length) {
    return res.status(404).json({ error: 'Uma ou mais entregas selecionadas nao foram encontradas.' });
  }

  const erro = validarAgrupamento(entregas);
  if (erro) return res.status(400).json({ error: erro });

  const grupoId = Math.min(...entregas.map((e) => e.id));
  db.prepare(`UPDATE entregas SET grupo_id = ? WHERE id IN (${placeholders})`).run(grupoId, ...entregaIds);

  res.json({ message: `${entregas.length} entregas agrupadas.`, grupo_id: grupoId });
});

entregasRouter.post('/api/entregas/desagrupar', requireLogin, (req, res) => {
  const grupoId = req.body?.grupo_id;
  if (!grupoId) return res.status(400).json({ error: 'Grupo nao informado.' });
  const info = db.prepare('UPDATE entregas SET grupo_id = NULL WHERE grupo_id = ?').run(grupoId);
  if (!info.changes) return res.status(404).json({ error: 'Grupo nao encontrado.' });
  res.json({ message: `${info.changes} entrega(s) desagrupada(s).` });
});
