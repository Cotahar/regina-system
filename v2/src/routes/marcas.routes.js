import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireLogin, requireAdmin } from '../middleware/auth.js';

export const marcasRouter = Router();

marcasRouter.get('/api/marcas', requireLogin, (req, res) => {
  res.json(db.prepare('SELECT * FROM marcas ORDER BY nome').all());
});

marcasRouter.post('/api/marcas', requireLogin, requireAdmin, (req, res) => {
  const nome = (req.body?.nome || '').trim().toUpperCase();
  if (!nome) return res.status(400).json({ error: 'Nome da marca e obrigatorio.' });
  if (db.prepare('SELECT id FROM marcas WHERE nome = ?').get(nome)) {
    return res.status(400).json({ error: 'Marca ja cadastrada.' });
  }
  const info = db.prepare('INSERT INTO marcas (nome) VALUES (?)').run(nome);
  const marca = db.prepare('SELECT * FROM marcas WHERE id = ?').get(info.lastInsertRowid);
  res.json({ message: 'Marca cadastrada com sucesso!', marca });
});

marcasRouter.put('/api/marcas/:id', requireLogin, requireAdmin, (req, res) => {
  const marca = db.prepare('SELECT * FROM marcas WHERE id = ?').get(req.params.id);
  if (!marca) return res.status(404).json({ error: 'Marca nao encontrada' });
  const novoNome = (req.body?.nome || '').trim().toUpperCase();
  if (!novoNome) return res.status(400).json({ error: 'Nome obrigatorio' });
  db.prepare('UPDATE marcas SET nome = ? WHERE id = ?').run(novoNome, req.params.id);
  res.json({ message: 'Marca atualizada!' });
});

marcasRouter.delete('/api/marcas/:id', requireLogin, requireAdmin, (req, res) => {
  const marca = db.prepare('SELECT * FROM marcas WHERE id = ?').get(req.params.id);
  if (!marca) return res.status(404).json({ error: 'Marca nao encontrada' });
  try {
    db.prepare('DELETE FROM marcas WHERE id = ?').run(req.params.id);
    res.json({ message: 'Marca excluida!' });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir (Pode estar em uso)' });
  }
});
