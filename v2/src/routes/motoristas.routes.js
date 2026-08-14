import { Router } from 'express';
import multer from 'multer';
import { db } from '../db/connection.js';
import { requireLogin, requireAdmin } from '../middleware/auth.js';
import { parseArquivoImportado } from '../utils/csv.js';

const upload = multer({ storage: multer.memoryStorage() });
export const motoristasRouter = Router();

motoristasRouter.get('/api/motoristas', requireLogin, (req, res) => {
  const motoristas = db.prepare('SELECT * FROM motoristas ORDER BY nome').all();
  res.json(motoristas.map((m) => ({ ...m, text: (m.nome || '').toUpperCase() })));
});

motoristasRouter.post('/api/motoristas', requireLogin, requireAdmin, (req, res) => {
  const { codigo, nome } = req.body || {};
  if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome e obrigatorio' });
  try {
    const info = db.prepare('INSERT INTO motoristas (codigo, nome) VALUES (?, ?)')
      .run(codigo?.trim() || null, nome.trim().toUpperCase());
    res.status(201).json({ message: 'Motorista cadastrado!', id: Number(info.lastInsertRowid) });
  } catch {
    res.status(409).json({ error: 'Codigo ja cadastrado' });
  }
});

motoristasRouter.put('/api/motoristas/:id', requireLogin, requireAdmin, (req, res) => {
  const { codigo, nome } = req.body || {};
  if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome e obrigatorio' });
  const existente = db.prepare('SELECT id FROM motoristas WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Motorista nao encontrado' });
  db.prepare('UPDATE motoristas SET codigo = ?, nome = ? WHERE id = ?')
    .run(codigo?.trim() || null, nome.trim().toUpperCase(), req.params.id);
  res.json({ message: 'Motorista atualizado!' });
});

motoristasRouter.delete('/api/motoristas/:id', requireLogin, requireAdmin, (req, res) => {
  const existente = db.prepare('SELECT id FROM motoristas WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Motorista nao encontrado' });
  try {
    db.prepare('DELETE FROM motoristas WHERE id = ?').run(req.params.id);
    res.json({ message: 'Motorista excluido!' });
  } catch {
    res.status(409).json({ error: 'Nao e possivel excluir (motorista em uso em alguma carga)' });
  }
});

motoristasRouter.post('/api/motoristas/import', requireLogin, requireAdmin, upload.single('arquivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  const linhas = parseArquivoImportado(req.file.buffer);

  const existentes = new Set(
    db.prepare('SELECT codigo FROM motoristas WHERE codigo IS NOT NULL').all().map((r) => r.codigo)
  );
  const insert = db.prepare('INSERT INTO motoristas (codigo, nome) VALUES (?, ?)');
  let novos = 0;
  let ignorados = 0;

  for (const linha of linhas) {
    const codigo = (linha[0] || '').trim();
    const nome = (linha[1] || '').trim().toUpperCase();
    if (!nome) continue;
    if (codigo && existentes.has(codigo)) { ignorados++; continue; }
    insert.run(codigo || null, nome);
    if (codigo) existentes.add(codigo);
    novos++;
  }

  res.json({ message: `Importacao concluida! ${novos} novo(s) motorista(s) importado(s), ${ignorados} ignorado(s) (codigo ja existente).` });
});
