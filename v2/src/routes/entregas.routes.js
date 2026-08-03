import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireLogin } from '../middleware/auth.js';

export const entregasRouter = Router();

// --- ENTREGAS DENTRO DE UMA CARGA (MODAL DE DETALHES) ---
entregasRouter.post('/api/cargas/:id/entregas', requireLogin, (req, res) => {
  const carga = db.prepare('SELECT id FROM cargas WHERE id = ?').get(req.params.id);
  if (!carga) return res.status(404).json({ error: 'Carga nao encontrada' });

  const { cliente_id: clienteId, remetente_id: remetenteId, peso_bruto: pesoBruto, valor_frete: valorFrete } = req.body || {};
  if (!remetenteId) return res.status(400).json({ error: 'Remetente nao foi selecionado.' });

  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(clienteId);
  if (!cliente) return res.status(404).json({ error: 'Cliente (Destinatario) nao encontrado.' });

  db.prepare(`
    INSERT INTO entregas (carga_id, cliente_id, remetente_id, peso_bruto, valor_frete, cidade_entrega, estado_entrega)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(carga.id, cliente.id, remetenteId, pesoBruto || null, valorFrete || null, cliente.cidade, cliente.estado);

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
      rem.razao_social as remetente_razao_social,
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
    destinatario_nome: e.cliente_razao_social || 'N/A',
    cidade_entrega: e.cidade_entrega || e.cliente_cidade || '',
    estado_entrega: e.estado_entrega || e.cliente_estado || '',
    cidade_entrega_override: e.cidade_entrega,
    estado_entrega_override: e.estado_entrega,
    peso_bruto: e.peso_bruto,
    valor_frete: e.valor_frete,
    peso_cubado: e.peso_cubado,
    nota_fiscal: e.nota_fiscal,
    selecionada: false
  })));
});

entregasRouter.post('/api/entregas/disponiveis', requireLogin, (req, res) => {
  const data = req.body || {};
  db.prepare(`
    INSERT INTO entregas (carga_id, cliente_id, remetente_id, peso_bruto, valor_frete, peso_cubado, nota_fiscal, cidade_entrega, estado_entrega)
    VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.cliente_id, data.remetente_id || null, data.peso_bruto || null, data.valor_frete || null,
    data.peso_cubado || null, data.nota_fiscal || null, data.cidade_entrega || null, data.estado_entrega || null
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
  const camposSimples = ['remetente_id', 'peso_bruto', 'valor_frete', 'peso_cubado', 'nota_fiscal', 'cidade_entrega', 'estado_entrega'];
  const sets = [];
  const valores = [];
  for (const campo of camposSimples) {
    if (campo in data) {
      sets.push(`${campo} = ?`);
      valores.push(data[campo]);
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

entregasRouter.post('/api/entregas/agrupar', requireLogin, (req, res) => {
  const entregaIds = req.body?.entrega_ids;
  if (!entregaIds || entregaIds.length < 2) {
    return res.status(400).json({ error: 'Selecione pelo menos 2 entregas para agrupar.' });
  }

  const placeholders = entregaIds.map(() => '?').join(',');
  const entregas = db.prepare(`SELECT * FROM entregas WHERE id IN (${placeholders})`).all(...entregaIds);
  if (!entregas.length) return res.status(404).json({ error: 'Entregas nao encontradas.' });

  const principal = entregas[0];
  const listaNfs = [];
  if (principal.nota_fiscal) listaNfs.push(String(principal.nota_fiscal).trim());

  let totalPeso = principal.peso_bruto || 0;
  let totalFrete = principal.valor_frete || 0;
  let totalCubado = principal.peso_cubado || 0;

  for (const e of entregas.slice(1)) {
    totalPeso += e.peso_bruto || 0;
    totalFrete += e.valor_frete || 0;
    totalCubado += e.peso_cubado || 0;
    if (e.nota_fiscal && String(e.nota_fiscal).trim()) listaNfs.push(String(e.nota_fiscal).trim());
    db.prepare('DELETE FROM entregas WHERE id = ?').run(e.id);
  }

  const notaFiscalFinal = listaNfs.join(' / ');
  db.prepare('UPDATE entregas SET peso_bruto = ?, valor_frete = ?, peso_cubado = ?, nota_fiscal = ? WHERE id = ?')
    .run(totalPeso, totalFrete, totalCubado, notaFiscalFinal, principal.id);

  res.json({ message: `Sucesso! ${entregas.length} entregas agrupadas. NFs resultantes: ${notaFiscalFinal}` });
});
