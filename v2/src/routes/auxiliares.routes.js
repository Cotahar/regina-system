import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireLogin, requireAdmin } from '../middleware/auth.js';

export const auxiliaresRouter = Router();

function toDictUnidade(u) {
  return {
    id: u.id,
    nome: u.nome,
    text: u.nome,
    uf: u.uf,
    is_matriz: !!u.is_matriz,
    tipo_cte_padrao_id: u.tipo_cte_padrao_id
  };
}

// --- UNIDADES ---
auxiliaresRouter.get('/api/auxiliar/unidades', requireLogin, (req, res) => {
  const unidades = db.prepare('SELECT * FROM unidades ORDER BY nome').all();
  res.json(unidades.map(toDictUnidade));
});

auxiliaresRouter.post('/api/auxiliar/unidades', requireLogin, requireAdmin, (req, res) => {
  const { nome, uf, is_matriz, tipo_cte_padrao_id } = req.body || {};
  if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome e obrigatorio' });
  if (is_matriz) db.prepare('UPDATE unidades SET is_matriz = 0').run();
  db.prepare(
    'INSERT INTO unidades (nome, uf, is_matriz, tipo_cte_padrao_id) VALUES (?, ?, ?, ?)'
  ).run(nome.trim().toUpperCase(), (uf || '').toUpperCase() || null, is_matriz ? 1 : 0, tipo_cte_padrao_id || null);
  res.json({ message: 'Unidade Salva!' });
});

auxiliaresRouter.put('/api/auxiliar/unidades/:id', requireLogin, requireAdmin, (req, res) => {
  const unidade = db.prepare('SELECT * FROM unidades WHERE id = ?').get(req.params.id);
  if (!unidade) return res.status(404).json({ error: 'Nao encontrada' });
  const { nome, uf, is_matriz, tipo_cte_padrao_id } = req.body || {};
  if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome obrigatorio' });
  if (is_matriz) db.prepare('UPDATE unidades SET is_matriz = 0 WHERE id != ?').run(req.params.id);
  db.prepare('UPDATE unidades SET nome = ?, uf = ?, is_matriz = ?, tipo_cte_padrao_id = ? WHERE id = ?')
    .run(nome.trim().toUpperCase(), (uf || '').toUpperCase() || null, is_matriz ? 1 : 0, tipo_cte_padrao_id || null, req.params.id);
  res.json({ message: 'Unidade atualizada!' });
});

auxiliaresRouter.delete('/api/auxiliar/unidades/:id', requireLogin, requireAdmin, (req, res) => {
  const unidade = db.prepare('SELECT * FROM unidades WHERE id = ?').get(req.params.id);
  if (!unidade) return res.status(404).json({ error: 'Nao encontrada' });
  try {
    db.prepare('DELETE FROM unidades WHERE id = ?').run(req.params.id);
    res.json({ message: 'Removido!' });
  } catch {
    res.status(500).json({ error: 'Erro ao remover (pode estar em uso).' });
  }
});

// --- TIPOS DE CT-E ---
auxiliaresRouter.get('/api/auxiliar/tipos-cte', requireLogin, (req, res) => {
  const tipos = db.prepare('SELECT * FROM tipos_cte ORDER BY descricao').all();
  res.json(tipos.map((t) => ({ id: t.id, descricao: t.descricao, text: t.descricao })));
});

auxiliaresRouter.post('/api/auxiliar/tipos-cte', requireLogin, requireAdmin, (req, res) => {
  const descricao = (req.body?.descricao || '').trim().toUpperCase();
  if (!descricao) return res.status(400).json({ error: 'Descricao obrigatoria' });
  if (db.prepare('SELECT id FROM tipos_cte WHERE descricao = ?').get(descricao)) {
    return res.status(400).json({ error: 'Tipo ja cadastrado' });
  }
  const info = db.prepare('INSERT INTO tipos_cte (descricao) VALUES (?)').run(descricao);
  res.json({ message: 'Cadastrado!', id: Number(info.lastInsertRowid) });
});

auxiliaresRouter.delete('/api/auxiliar/tipos-cte/:id', requireLogin, requireAdmin, (req, res) => {
  const item = db.prepare('SELECT id FROM tipos_cte WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Nao encontrado' });
  try {
    db.prepare('DELETE FROM tipos_cte WHERE id = ?').run(req.params.id);
    res.json({ message: 'Excluido!' });
  } catch {
    res.status(500).json({ error: 'Nao e possivel excluir (em uso).' });
  }
});

// --- FORMAS DE PAGAMENTO ---
auxiliaresRouter.get('/api/auxiliar/formas-pagamento', requireLogin, (req, res) => {
  const formas = db.prepare('SELECT * FROM formas_pagamento ORDER BY descricao').all();
  res.json(formas.map((f) => ({ id: f.id, descricao: f.descricao, text: f.descricao })));
});

auxiliaresRouter.post('/api/auxiliar/formas-pagamento', requireLogin, requireAdmin, (req, res) => {
  const descricao = (req.body?.descricao || '').trim().toUpperCase();
  if (!descricao) return res.status(400).json({ error: 'Descricao obrigatoria' });
  if (db.prepare('SELECT id FROM formas_pagamento WHERE descricao = ?').get(descricao)) {
    return res.status(400).json({ error: 'Forma de pagamento ja cadastrada' });
  }
  const info = db.prepare('INSERT INTO formas_pagamento (descricao) VALUES (?)').run(descricao);
  res.json({ message: 'Cadastrado!', id: Number(info.lastInsertRowid) });
});

auxiliaresRouter.delete('/api/auxiliar/formas-pagamento/:id', requireLogin, requireAdmin, (req, res) => {
  const item = db.prepare('SELECT id FROM formas_pagamento WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Nao encontrado' });
  try {
    db.prepare('DELETE FROM formas_pagamento WHERE id = ?').run(req.params.id);
    res.json({ message: 'Excluido!' });
  } catch {
    res.status(500).json({ error: 'Nao e possivel excluir pois ja esta em uso em alguma carga/cliente.' });
  }
});
