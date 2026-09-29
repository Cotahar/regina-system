import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireLogin } from '../middleware/auth.js';
import { renderOrdemColetaRelatorio } from '../views/ordemColetaRelatorio.js';

export const ordensColetaRouter = Router();

const STATUS_ELEGIVEIS_CARGA = ['Rascunho', 'Pendente', 'Agendada'];

// So pode entrar numa ordem de coleta uma entrega cuja carga (se tiver
// alguma) ainda nao foi coletada/finalizada, e que nao esteja presa em
// OUTRA ordem de coleta pendente (senao o motorista veria a mesma entrega
// em duas rotas diferentes). Passar ordemIdAtual permite reafirmar
// entregas que ja sao dessa mesma ordem (edicao).
function validarEntregasElegiveis(entregaIds, ordemIdAtual) {
  const placeholders = entregaIds.map(() => '?').join(',');
  const linhas = db.prepare(`
    SELECT e.id, e.ordem_coleta_id, c.status as carga_status
    FROM entregas e
    LEFT JOIN cargas c ON c.id = e.carga_id
    WHERE e.id IN (${placeholders})
  `).all(...entregaIds);

  if (linhas.length !== entregaIds.length) return 'Uma ou mais entregas selecionadas nao foram encontradas.';

  for (const l of linhas) {
    if (l.carga_status && !STATUS_ELEGIVEIS_CARGA.includes(l.carga_status)) {
      return `Uma das entregas esta numa carga que ja nao aceita coleta (status ${l.carga_status}).`;
    }
    if (l.ordem_coleta_id && l.ordem_coleta_id !== ordemIdAtual) {
      return 'Uma das entregas selecionadas ja esta em outra ordem de coleta.';
    }
  }
  return null;
}

function toDictOrdemResumo(o) {
  return {
    id: o.id,
    codigo: o.codigo,
    status: o.status,
    motorista_id: o.motorista_id,
    veiculo_id: o.veiculo_id,
    motorista_nome: o.motorista_nome || '',
    placa_veiculo: o.placa_veiculo || '',
    observacoes: o.observacoes,
    local_coleta_cliente_nome: o.local_coleta_cliente_nome || '',
    data_baixa: o.data_baixa,
    criado_em: o.criado_em,
    num_entregas: o.num_entregas,
    peso_total: o.peso_total
  };
}

ordensColetaRouter.get('/api/ordens-coleta', requireLogin, (req, res) => {
  const ordens = db.prepare(`
    SELECT oc.*, m.nome as motorista_nome, v.placa as placa_veiculo, lc.razao_social as local_coleta_cliente_nome,
      COUNT(e.id) as num_entregas, COALESCE(SUM(e.peso_bruto), 0) as peso_total
    FROM ordens_coleta oc
    LEFT JOIN motoristas m ON m.id = oc.motorista_id
    LEFT JOIN veiculos v ON v.id = oc.veiculo_id
    LEFT JOIN clientes lc ON lc.id = oc.local_coleta_cliente_id
    LEFT JOIN entregas e ON e.ordem_coleta_id = oc.id
    GROUP BY oc.id
    ORDER BY (oc.status = 'pendente') DESC, oc.id DESC
  `).all();
  res.json(ordens.map(toDictOrdemResumo));
});

// Pool de entregas que podem entrar numa ordem de coleta: soltas na
// Montagem OU dentro de uma carga que ainda nao foi coletada/finalizada,
// e que nao estejam presas em outra ordem de coleta pendente. Passar
// ?ordem_id= inclui tambem as que ja pertencem aquela ordem (pra edicao).
ordensColetaRouter.get('/api/ordens-coleta/entregas-elegiveis', requireLogin, (req, res) => {
  const ordemId = req.query.ordem_id ? Number(req.query.ordem_id) : null;

  const entregas = db.prepare(`
    SELECT e.*,
      rem.razao_social as remetente_razao_social, rem.cidade as remetente_cidade, rem.estado as remetente_estado,
      cli.razao_social as cliente_razao_social, cli.cidade as cliente_cidade, cli.estado as cliente_estado,
      c.codigo_carga as carga_codigo, c.status as carga_status
    FROM entregas e
    LEFT JOIN clientes rem ON rem.id = e.remetente_id
    LEFT JOIN clientes cli ON cli.id = e.cliente_id
    LEFT JOIN cargas c ON c.id = e.carga_id
    WHERE (e.carga_id IS NULL OR c.status IN ('Rascunho', 'Pendente', 'Agendada'))
      AND (e.ordem_coleta_id IS NULL OR e.ordem_coleta_id = ?)
    ORDER BY e.id DESC
  `).all(ordemId);

  res.json(entregas.map((e) => ({
    id: e.id,
    ordem_coleta_id: e.ordem_coleta_id,
    remetente_id: e.remetente_id,
    remetente_nome: e.remetente_razao_social || 'N/A',
    remetente_uf: e.remetente_estado || '',
    cliente_id: e.cliente_id,
    destinatario_nome: e.cliente_razao_social || 'N/A',
    cidade_entrega: e.cidade_entrega || e.cliente_cidade || '',
    estado_entrega: e.estado_entrega || e.cliente_estado || '',
    nota_fiscal: e.nota_fiscal,
    peso_bruto: e.peso_bruto,
    carga_codigo: e.carga_codigo,
    carga_status: e.carga_status,
    origem_texto: e.carga_codigo ? `${e.carga_codigo} (${e.carga_status})` : 'Disponivel (Montagem)'
  })));
});

function carregarOrdemDetalhe(id) {
  const ordem = db.prepare(`
    SELECT oc.*, m.nome as motorista_nome, v.placa as placa_veiculo, lc.razao_social as local_coleta_cliente_nome
    FROM ordens_coleta oc
    LEFT JOIN motoristas m ON m.id = oc.motorista_id
    LEFT JOIN veiculos v ON v.id = oc.veiculo_id
    LEFT JOIN clientes lc ON lc.id = oc.local_coleta_cliente_id
    WHERE oc.id = ?
  `).get(id);
  if (!ordem) return null;

  const entregas = db.prepare(`
    SELECT e.*,
      rem.razao_social as remetente_razao_social, rem.cidade as remetente_cidade, rem.estado as remetente_estado,
      cli.razao_social as cliente_razao_social, cli.cidade as cliente_cidade, cli.estado as cliente_estado,
      c.codigo_carga as carga_codigo, c.status as carga_status
    FROM entregas e
    LEFT JOIN clientes rem ON rem.id = e.remetente_id
    LEFT JOIN clientes cli ON cli.id = e.cliente_id
    LEFT JOIN cargas c ON c.id = e.carga_id
    WHERE e.ordem_coleta_id = ?
    ORDER BY rem.razao_social, e.id
  `).all(id);

  return { ordem, entregas };
}

ordensColetaRouter.get('/api/ordens-coleta/:id', requireLogin, (req, res) => {
  const detalhe = carregarOrdemDetalhe(req.params.id);
  if (!detalhe) return res.status(404).json({ error: 'Ordem de coleta nao encontrada' });

  res.json({
    ordem: toDictOrdemResumo({ ...detalhe.ordem, num_entregas: detalhe.entregas.length, peso_total: detalhe.entregas.reduce((a, e) => a + (e.peso_bruto || 0), 0) }),
    entregas: detalhe.entregas.map((e) => ({
      id: e.id,
      remetente_nome: e.remetente_razao_social || 'N/A',
      remetente_uf: e.remetente_estado || '',
      destinatario_nome: e.cliente_razao_social || 'N/A',
      cidade_entrega: e.cidade_entrega || e.cliente_cidade || '',
      estado_entrega: e.estado_entrega || e.cliente_estado || '',
      nota_fiscal: e.nota_fiscal,
      peso_bruto: e.peso_bruto,
      carga_codigo: e.carga_codigo,
      carga_status: e.carga_status,
      origem_texto: e.carga_codigo ? `${e.carga_codigo} (${e.carga_status})` : 'Disponivel (Montagem)'
    }))
  });
});

ordensColetaRouter.post('/api/ordens-coleta', requireLogin, (req, res) => {
  const { motorista_id: motoristaId, veiculo_id: veiculoId, observacoes, entrega_ids: entregaIds } = req.body || {};
  if (!Array.isArray(entregaIds) || !entregaIds.length) {
    return res.status(400).json({ error: 'Selecione ao menos uma entrega.' });
  }

  const erro = validarEntregasElegiveis(entregaIds, null);
  if (erro) return res.status(409).json({ error: erro });

  const codigo = `COLETA-${Date.now()}`;
  const info = db.prepare(`
    INSERT INTO ordens_coleta (codigo, status, motorista_id, veiculo_id, observacoes)
    VALUES (?, 'pendente', ?, ?, ?)
  `).run(codigo, motoristaId || null, veiculoId || null, (observacoes || '').trim() || null);

  const placeholders = entregaIds.map(() => '?').join(',');
  db.prepare(`UPDATE entregas SET ordem_coleta_id = ? WHERE id IN (${placeholders})`).run(info.lastInsertRowid, ...entregaIds);

  res.status(201).json({ message: `Ordem de coleta ${codigo} criada!`, id: Number(info.lastInsertRowid) });
});

ordensColetaRouter.put('/api/ordens-coleta/:id', requireLogin, (req, res) => {
  const ordem = db.prepare('SELECT * FROM ordens_coleta WHERE id = ?').get(req.params.id);
  if (!ordem) return res.status(404).json({ error: 'Ordem de coleta nao encontrada' });
  if (ordem.status !== 'pendente') return res.status(400).json({ error: 'Essa ordem de coleta ja foi baixada e nao pode mais ser editada.' });

  const { motorista_id: motoristaId, veiculo_id: veiculoId, observacoes, entrega_ids: entregaIds } = req.body || {};
  const ordemId = Number(req.params.id);

  if (Array.isArray(entregaIds)) {
    if (entregaIds.length) {
      const erro = validarEntregasElegiveis(entregaIds, ordemId);
      if (erro) return res.status(409).json({ error: erro });
    }

    const atuais = db.prepare('SELECT id FROM entregas WHERE ordem_coleta_id = ?').all(ordemId).map((r) => r.id);
    const novosSet = new Set(entregaIds.map(Number));
    const idsParaRemover = atuais.filter((id) => !novosSet.has(id));
    const idsParaAdicionar = entregaIds.filter((id) => !atuais.includes(Number(id)));

    if (idsParaRemover.length) {
      const ph = idsParaRemover.map(() => '?').join(',');
      db.prepare(`UPDATE entregas SET ordem_coleta_id = NULL WHERE id IN (${ph})`).run(...idsParaRemover);
    }
    if (idsParaAdicionar.length) {
      const ph = idsParaAdicionar.map(() => '?').join(',');
      db.prepare(`UPDATE entregas SET ordem_coleta_id = ? WHERE id IN (${ph})`).run(ordemId, ...idsParaAdicionar);
    }
  }

  db.prepare('UPDATE ordens_coleta SET motorista_id = ?, veiculo_id = ?, observacoes = ? WHERE id = ?')
    .run(motoristaId || null, veiculoId || null, (observacoes || '').trim() || null, ordemId);

  res.json({ message: `Ordem de coleta ${ordem.codigo} atualizada!` });
});

// Baixa = a coleta aconteceu de verdade. O local de coleta informado aqui
// vale pra TODAS as entregas da ordem de uma vez (decisao do usuario - nao
// e por fabrica/remetente individual). O remetente original de cada
// entrega nunca muda, so o local de coleta usado pra exibicao (Coletas do
// modal de carga e Espelho) - o Gerenciar Faturamento continua mostrando o
// remetente de cadastro.
ordensColetaRouter.put('/api/ordens-coleta/:id/baixar', requireLogin, (req, res) => {
  const ordem = db.prepare('SELECT * FROM ordens_coleta WHERE id = ?').get(req.params.id);
  if (!ordem) return res.status(404).json({ error: 'Ordem de coleta nao encontrada' });
  if (ordem.status !== 'pendente') return res.status(400).json({ error: 'Essa ordem de coleta ja foi baixada.' });

  const { local_coleta_cliente_id: localColetaClienteId } = req.body || {};
  if (!localColetaClienteId) return res.status(400).json({ error: 'Informe o cliente onde a coleta foi realizada.' });

  const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(localColetaClienteId);
  if (!cliente) return res.status(404).json({ error: 'Cliente informado nao encontrado.' });

  const numEntregas = db.prepare('SELECT COUNT(*) as c FROM entregas WHERE ordem_coleta_id = ?').get(req.params.id).c;
  if (!numEntregas) return res.status(400).json({ error: 'Essa ordem de coleta nao tem entregas.' });

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE entregas SET local_coleta_cliente_id = ? WHERE ordem_coleta_id = ?').run(cliente.id, req.params.id);
    db.prepare("UPDATE ordens_coleta SET status = 'coletada', local_coleta_cliente_id = ?, data_baixa = datetime('now') WHERE id = ?")
      .run(cliente.id, req.params.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(400).json({ error: err.message });
  }

  res.json({ message: `Coleta ${ordem.codigo} baixada! ${numEntregas} entrega(s) atualizada(s).` });
});

ordensColetaRouter.delete('/api/ordens-coleta/:id', requireLogin, (req, res) => {
  const ordem = db.prepare('SELECT * FROM ordens_coleta WHERE id = ?').get(req.params.id);
  if (!ordem) return res.status(404).json({ error: 'Ordem de coleta nao encontrada' });
  if (ordem.status !== 'pendente') return res.status(400).json({ error: 'Essa ordem de coleta ja foi baixada e nao pode mais ser excluida.' });

  db.prepare('UPDATE entregas SET ordem_coleta_id = NULL WHERE ordem_coleta_id = ?').run(req.params.id);
  db.prepare('DELETE FROM ordens_coleta WHERE id = ?').run(req.params.id);

  res.json({ message: `Ordem de coleta ${ordem.codigo} excluida. Entregas voltaram a ficar disponiveis.` });
});

ordensColetaRouter.get('/ordens-coleta/:id/relatorio', requireLogin, (req, res) => {
  const detalhe = carregarOrdemDetalhe(req.params.id);
  if (!detalhe) return res.status(404).send('Ordem de coleta nao encontrada');
  res.type('html').send(renderOrdemColetaRelatorio(detalhe));
});
