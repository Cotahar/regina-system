import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireLogin, requireAdmin } from '../middleware/auth.js';
import { buscarEntregasDaCarga, resumoCarga, toDictCarga, toDictEntrega } from '../services/cargas.service.js';
import { renderEspelhoCarga } from '../views/espelho.js';

export const cargasRouter = Router();

function carregarCargaComJoins(id) {
  return db.prepare(`
    SELECT c.*, m.nome as motorista_nome, v.placa as placa_veiculo
    FROM cargas c
    LEFT JOIN motoristas m ON m.id = c.motorista_id
    LEFT JOIN veiculos v ON v.id = c.veiculo_id
    WHERE c.id = ?
  `).get(id);
}

// --- PAINEL PRINCIPAL ---
cargasRouter.get('/api/cargas', requireLogin, (req, res) => {
  let sql = `
    SELECT c.*, m.nome as motorista_nome, v.placa as placa_veiculo
    FROM cargas c
    LEFT JOIN motoristas m ON m.id = c.motorista_id
    LEFT JOIN veiculos v ON v.id = c.veiculo_id
    WHERE c.status NOT IN ('Rascunho', 'Finalizada')
  `;
  const params = [];
  if (req.query.status) {
    sql += ' AND c.status = ?';
    params.push(req.query.status);
  }
  sql += ' ORDER BY c.id DESC';

  const cargas = db.prepare(sql).all(...params);
  res.json(cargas.map((c) => {
    const entregas = buscarEntregasDaCarga(c.id);
    return {
      ...toDictCarga(c),
      motorista_nome: c.motorista_nome,
      placa_veiculo: c.placa_veiculo,
      entregas: entregas.map(toDictEntrega),
      ...resumoCarga(entregas)
    };
  }));
});

cargasRouter.post('/api/cargas', requireLogin, (req, res) => {
  const origem = (req.body?.origem || '').trim();
  if (!origem) return res.status(400).json({ error: 'Origem e obrigatoria.' });

  const codigo = `CARGA-${Date.now()}`;
  const info = db.prepare("INSERT INTO cargas (codigo_carga, origem, status) VALUES (?, ?, 'Pendente')")
    .run(codigo, origem.toUpperCase());
  const carga = db.prepare('SELECT * FROM cargas WHERE id = ?').get(info.lastInsertRowid);

  res.status(201).json({
    ...toDictCarga(carga),
    motorista_nome: null,
    placa_veiculo: null,
    entregas: [],
    num_entregas: 0,
    destinos: [],
    destino_principal: 'N/A',
    peso_total: 0.0
  });
});

// --- CONSULTA (BUSCA PAGINADA) ---
cargasRouter.get('/api/cargas/consulta', requireLogin, (req, res) => {
  const q = req.query;
  let sql = `
    SELECT DISTINCT c.*, m.nome as motorista_nome, v.placa as placa_veiculo
    FROM cargas c
    LEFT JOIN motoristas m ON m.id = c.motorista_id
    LEFT JOIN veiculos v ON v.id = c.veiculo_id
    LEFT JOIN entregas e ON e.carga_id = c.id
    WHERE c.status != 'Rascunho'
  `;
  const params = [];
  if (q.codigo_carga) { sql += ' AND c.codigo_carga LIKE ?'; params.push(`%${q.codigo_carga}%`); }
  if (q.origem) { sql += ' AND c.origem LIKE ?'; params.push(`%${q.origem}%`); }
  if (q.status) { sql += ' AND c.status = ?'; params.push(q.status); }
  if (q.motorista) { sql += ' AND m.nome LIKE ?'; params.push(`%${q.motorista}%`); }
  if (q.placa) { sql += ' AND v.placa LIKE ?'; params.push(`%${q.placa}%`); }
  if (q.cliente_id) { sql += ' AND e.cliente_id = ?'; params.push(q.cliente_id); }
  if (q.data_carregamento_inicio) { sql += ' AND c.data_carregamento >= ?'; params.push(q.data_carregamento_inicio); }
  if (q.data_carregamento_fim) { sql += ' AND c.data_carregamento <= ?'; params.push(q.data_carregamento_fim); }
  if (q.data_finalizacao_inicio) { sql += ' AND c.data_finalizacao >= ?'; params.push(q.data_finalizacao_inicio); }
  if (q.data_finalizacao_fim) { sql += ' AND c.data_finalizacao <= ?'; params.push(q.data_finalizacao_fim); }
  sql += ' ORDER BY c.id DESC';

  const todas = db.prepare(sql).all(...params);
  const total = todas.length;
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const perPage = 20;
  const pageItems = todas.slice((page - 1) * perPage, page * perPage);

  const cargasData = pageItems.map((c) => {
    const entregas = buscarEntregasDaCarga(c.id);
    const pesoTotalBruto = entregas.reduce((acc, e) => acc + (e.peso_bruto || 0), 0);
    const resumo = resumoCarga(entregas);
    return {
      id: c.id,
      codigo_carga: c.codigo_carga,
      status: c.status,
      origem: c.origem,
      destino_principal: resumo.destinos[0] || 'N/A',
      motorista_nome: c.motorista_nome || 'N/A',
      num_entregas: resumo.num_entregas,
      peso_total_bruto: pesoTotalBruto,
      data_finalizacao: c.data_finalizacao,
      destino: resumo.destinos[0] || 'N/A',
      motorista: c.motorista_nome || 'N/A',
      peso_total: pesoTotalBruto
    };
  });

  res.json({
    cargas: cargasData,
    total_resultados: total,
    pagina_atual: page,
    total_paginas: Math.ceil(total / perPage) || 1
  });
});

cargasRouter.get('/api/cargas/rascunhos', requireLogin, (req, res) => {
  const rascunhos = db.prepare("SELECT * FROM cargas WHERE status = 'Rascunho' ORDER BY id DESC").all();
  res.json(rascunhos.map((r) => ({
    id: r.id,
    codigo_carga: r.codigo_carga,
    origem: r.origem,
    num_entregas: db.prepare('SELECT COUNT(*) as c FROM entregas WHERE carga_id = ?').get(r.id).c
  })));
});

// --- DETALHES ---
cargasRouter.get('/api/cargas/:id', requireLogin, (req, res) => {
  const carga = carregarCargaComJoins(req.params.id);
  if (!carga) return res.status(404).json({ error: 'Carga nao encontrada' });

  const entregas = db.prepare(`
    SELECT e.*,
      cl.razao_social as cliente_razao_social, cl.cidade as cliente_cidade, cl.estado as cliente_estado,
      cl.ddd as cliente_ddd, cl.telefone as cliente_telefone, cl.observacoes as cliente_observacoes,
      rem.razao_social as remetente_razao_social, rem.cidade as remetente_cidade
    FROM entregas e
    LEFT JOIN clientes cl ON cl.id = e.cliente_id
    LEFT JOIN clientes rem ON rem.id = e.remetente_id
    WHERE e.carga_id = ?
    ORDER BY e.id
  `).all(req.params.id);

  const temAvaria = db.prepare(`
    SELECT COUNT(*) as c FROM avarias a JOIN entregas e ON e.id = a.entrega_id WHERE e.carga_id = ?
  `).get(req.params.id).c > 0;

  const detalhesCarga = {
    ...toDictCarga(carga),
    motorista_nome: carga.motorista_nome,
    placa_veiculo: carga.placa_veiculo,
    tem_avaria: temAvaria
  };

  const entregasData = entregas.map((e) => ({
    id: e.id,
    remetente_id: e.remetente_id,
    cliente_id: e.cliente_id,
    remetente_nome: e.remetente_razao_social || 'N/A',
    remetente_cidade: e.remetente_cidade || 'N/A',
    razao_social: e.cliente_razao_social || 'N/A',
    cidade: e.cidade_entrega || e.cliente_cidade || '',
    estado: e.estado_entrega || e.cliente_estado || '',
    ddd: e.cliente_ddd || '',
    telefone: e.cliente_telefone || '',
    obs_cliente: e.cliente_observacoes || '',
    cidade_entrega_override: e.cidade_entrega,
    estado_entrega_override: e.estado_entrega,
    peso_bruto: e.peso_bruto,
    valor_frete: e.valor_frete,
    peso_cubado: e.peso_cubado,
    nota_fiscal: e.nota_fiscal,
    is_last_delivery: e.is_last_delivery
  }));

  res.json({ detalhes_carga: detalhesCarga, entregas: entregasData });
});

// --- ATUALIZAR STATUS / CAMPOS DA VIAGEM ---
cargasRouter.put('/api/cargas/:id/status', requireLogin, (req, res) => {
  const carga = db.prepare('SELECT * FROM cargas WHERE id = ?').get(req.params.id);
  if (!carga) return res.status(404).json({ error: 'Carga nao encontrada' });

  const data = req.body || {};

  if ('status' in data) {
    const novoStatus = data.status;
    const statusAtual = carga.status;
    const regressaoAdminOnly =
      (statusAtual === 'Finalizada' && novoStatus === 'Em Trânsito') ||
      (statusAtual === 'Em Trânsito' && novoStatus === 'Agendada');

    if (regressaoAdminOnly && req.session.permissao !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem regredir o status da carga.' });
    }
  }

  const nullableFields = ['data_agendamento', 'data_carregamento', 'previsao_entrega', 'data_finalizacao', 'motorista_id', 'veiculo_id'];
  const campos = [];
  const valores = [];

  for (const campo of ['status', ...nullableFields, 'observacoes', 'frete_pago']) {
    if (campo in data) {
      let valor = data[campo];
      if (nullableFields.includes(campo)) valor = valor || null;
      campos.push(`${campo} = ?`);
      valores.push(valor);
    }
  }
  if ('origem' in data) {
    campos.push('origem = ?');
    valores.push((data.origem || carga.origem).toUpperCase());
  }

  if (campos.length) {
    valores.push(req.params.id);
    db.prepare(`UPDATE cargas SET ${campos.join(', ')} WHERE id = ?`).run(...valores);
  }

  res.json({ message: 'Status da carga atualizado com sucesso!' });
});

cargasRouter.put('/api/cargas/:id/devolver-rascunho', requireLogin, (req, res) => {
  const carga = db.prepare('SELECT * FROM cargas WHERE id = ?').get(req.params.id);
  if (!carga) return res.status(404).json({ error: 'Carga nao encontrada' });
  if (!['Pendente', 'Agendada'].includes(carga.status)) {
    return res.status(400).json({ error: `Nao e possivel devolver uma carga com status ${carga.status}.` });
  }

  db.prepare(`
    UPDATE cargas SET status = 'Rascunho', codigo_carga = ?, motorista_id = NULL, veiculo_id = NULL,
      data_agendamento = NULL, data_carregamento = NULL, previsao_entrega = NULL
    WHERE id = ?
  `).run(`RASC-${Date.now()}`, req.params.id);

  res.json({ message: 'Carga devolvida para Rascunho. Redirecionando...' });
});

cargasRouter.delete('/api/cargas/:id', requireLogin, requireAdmin, (req, res) => {
  const carga = db.prepare('SELECT * FROM cargas WHERE id = ?').get(req.params.id);
  if (!carga) return res.status(404).json({ error: 'Carga nao encontrada' });

  const action = req.query.action || 'return_to_pool';
  if (action === 'delete_entregas') {
    db.prepare('DELETE FROM entregas WHERE carga_id = ?').run(req.params.id);
  } else {
    db.prepare('UPDATE entregas SET carga_id = NULL, is_last_delivery = 0 WHERE carga_id = ?').run(req.params.id);
  }
  db.prepare('DELETE FROM cargas WHERE id = ?').run(req.params.id);

  res.json({ message: 'Carga excluida com sucesso.' });
});

// --- MONTAGEM (RASCUNHOS) ---
cargasRouter.post('/api/cargas/montar', requireLogin, (req, res) => {
  const { origem, entrega_ids: entregaIds } = req.body || {};
  if (!origem || !entregaIds || !entregaIds.length) {
    return res.status(400).json({ error: 'Origem e IDs de entrega sao obrigatorios' });
  }

  const placeholders = entregaIds.map(() => '?').join(',');
  const disponiveis = db.prepare(
    `SELECT id FROM entregas WHERE id IN (${placeholders}) AND carga_id IS NULL`
  ).all(...entregaIds);

  if (disponiveis.length !== entregaIds.length) {
    return res.status(409).json({ error: 'Uma ou mais entregas selecionadas ja estao em outra carga.' });
  }

  const codigo = `RASC-${Date.now()}`;
  const info = db.prepare("INSERT INTO cargas (codigo_carga, origem, status) VALUES (?, ?, 'Rascunho')")
    .run(codigo, origem.toUpperCase());

  db.prepare(`UPDATE entregas SET carga_id = ? WHERE id IN (${placeholders})`).run(info.lastInsertRowid, ...entregaIds);

  res.status(201).json({ message: `Rascunho ${codigo} salvo com sucesso!`, carga_id: Number(info.lastInsertRowid) });
});

cargasRouter.put('/api/cargas/:id/montar', requireLogin, (req, res) => {
  const carga = db.prepare("SELECT * FROM cargas WHERE id = ? AND status = 'Rascunho'").get(req.params.id);
  if (!carga) return res.status(404).json({ error: 'Rascunho nao encontrado' });

  const frontendIds = new Set((req.body?.entrega_ids || []).map(Number));
  const atuais = db.prepare('SELECT id FROM entregas WHERE carga_id = ?').all(req.params.id).map((r) => r.id);
  const atuaisSet = new Set(atuais);

  const idsParaAdicionar = [...frontendIds].filter((id) => !atuaisSet.has(id));
  if (idsParaAdicionar.length) {
    const placeholders = idsParaAdicionar.map(() => '?').join(',');
    const disponiveis = db.prepare(
      `SELECT id FROM entregas WHERE id IN (${placeholders}) AND carga_id IS NULL`
    ).all(...idsParaAdicionar);
    if (disponiveis.length !== idsParaAdicionar.length) {
      return res.status(409).json({ error: 'Uma ou mais entregas selecionadas ja estao em outra carga. Atualize a lista.' });
    }
    db.prepare(`UPDATE entregas SET carga_id = ? WHERE id IN (${placeholders})`).run(req.params.id, ...idsParaAdicionar);
  }

  const idsParaRemover = atuais.filter((id) => !frontendIds.has(id));
  if (idsParaRemover.length) {
    const placeholders = idsParaRemover.map(() => '?').join(',');
    db.prepare(`UPDATE entregas SET carga_id = NULL WHERE id IN (${placeholders}) AND carga_id = ?`)
      .run(...idsParaRemover, req.params.id);
  }

  if ('origem' in (req.body || {})) {
    db.prepare('UPDATE cargas SET origem = ? WHERE id = ?')
      .run((req.body.origem || carga.origem).toUpperCase(), req.params.id);
  }

  res.json({ message: `Rascunho ${carga.codigo_carga} atualizado com sucesso!`, carga_id: Number(req.params.id) });
});

cargasRouter.delete('/api/cargas/:id/rascunho', requireLogin, (req, res) => {
  const carga = db.prepare("SELECT * FROM cargas WHERE id = ? AND status = 'Rascunho'").get(req.params.id);
  if (!carga) return res.status(404).json({ error: 'Rascunho nao encontrado' });

  db.prepare('UPDATE entregas SET carga_id = NULL WHERE carga_id = ?').run(req.params.id);
  db.prepare('DELETE FROM cargas WHERE id = ?').run(req.params.id);

  res.json({ message: `Rascunho ${carga.codigo_carga} excluido. Entregas voltaram para "Disponiveis".` });
});

// --- ESPELHO DE IMPRESSAO ---
cargasRouter.get('/cargas/:id/espelho_impressao', requireLogin, (req, res) => {
  const carga = carregarCargaComJoins(req.params.id);
  if (!carga) return res.status(404).send('Carga nao encontrada');

  const entregas = db.prepare(`
    SELECT e.*, cl.razao_social as cliente_razao_social, cl.cidade as cliente_cidade, cl.estado as cliente_estado,
      rem.razao_social as remetente_razao_social
    FROM entregas e
    LEFT JOIN clientes cl ON cl.id = e.cliente_id
    LEFT JOIN clientes rem ON rem.id = e.remetente_id
    WHERE e.carga_id = ?
  `).all(req.params.id);

  const entregasAgrupadasMap = new Map();
  const coletasMap = new Map();
  let pesoTotal = 0;

  for (const e of entregas) {
    const peso = e.peso_bruto || 0;
    pesoTotal += peso;
    const clienteNome = e.cliente_razao_social || 'N/A';
    const cidade = e.cidade_entrega || e.cliente_cidade || 'N/A';
    const estado = e.estado_entrega || e.cliente_estado || 'N/A';
    const chave = `${clienteNome}_${cidade}_${estado}`;

    if (!entregasAgrupadasMap.has(chave)) {
      entregasAgrupadasMap.set(chave, { cliente: clienteNome, cidadeUf: `${cidade}-${estado}`, peso: 0 });
    }
    entregasAgrupadasMap.get(chave).peso += peso;

    const remetenteNome = e.remetente_razao_social || 'SEM REMETENTE';
    if (!coletasMap.has(remetenteNome)) coletasMap.set(remetenteNome, { entregas: new Map(), totalPeso: 0 });
    const coleta = coletasMap.get(remetenteNome);
    coleta.totalPeso += peso;
    if (!coleta.entregas.has(chave)) coleta.entregas.set(chave, { cliente: clienteNome, cidadeUf: `${cidade}-${estado}`, peso: 0 });
    coleta.entregas.get(chave).peso += peso;
  }

  const entregasAgrupadas = [...entregasAgrupadasMap.values()].sort((a, b) => a.cliente.localeCompare(b.cliente));
  const coletasPorRemetente = [...coletasMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([nome, dados]) => [nome, { totalPeso: dados.totalPeso, entregas: [...dados.entregas.values()].sort((a, b) => a.cliente.localeCompare(b.cliente)) }]);

  res.type('html').send(renderEspelhoCarga({
    carga: { codigo_carga: carga.codigo_carga, origem: carga.origem, motorista_nome: carga.motorista_nome, placa_veiculo: carga.placa_veiculo },
    entregasAgrupadas,
    coletasPorRemetente,
    pesoTotal
  }));
});

cargasRouter.put('/api/cargas/:id/confirmar', requireLogin, (req, res) => {
  const carga = db.prepare("SELECT * FROM cargas WHERE id = ? AND status = 'Rascunho'").get(req.params.id);
  if (!carga) return res.status(404).json({ error: 'Rascunho nao encontrado' });

  const numEntregas = db.prepare('SELECT COUNT(*) as c FROM entregas WHERE carga_id = ?').get(req.params.id).c;
  if (numEntregas === 0) return res.status(400).json({ error: 'Nao e possivel confirmar um rascunho vazio' });

  const novoCodigo = `CARGA-${Date.now()}`;
  db.prepare("UPDATE cargas SET status = 'Pendente', codigo_carga = ? WHERE id = ?").run(novoCodigo, req.params.id);

  res.json({ message: `Carga ${novoCodigo} confirmada e movida para Pendentes.` });
});
