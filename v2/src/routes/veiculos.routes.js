import { Router } from 'express';
import multer from 'multer';
import { db } from '../db/connection.js';
import { requireLogin, requireAdmin } from '../middleware/auth.js';
import { decodeUploadedText, parseCsv } from '../utils/csv.js';

const upload = multer({ storage: multer.memoryStorage() });
export const veiculosRouter = Router();

veiculosRouter.get('/api/veiculos', requireLogin, (req, res) => {
  const veiculos = db.prepare('SELECT * FROM veiculos ORDER BY placa').all();
  res.json(veiculos.map((v) => ({ ...v, is_frota: !!v.is_frota, text: (v.placa || '').toUpperCase() })));
});

veiculosRouter.post('/api/veiculos', requireLogin, requireAdmin, (req, res) => {
  const { placa, is_frota: isFrota, dados_pagamento: dadosPagamento } = req.body || {};
  const placaLimpa = (placa || '').trim().toUpperCase().replace(/-/g, '');
  if (!placaLimpa) return res.status(400).json({ error: 'Placa e obrigatoria' });
  try {
    const info = db.prepare('INSERT INTO veiculos (placa, is_frota, dados_pagamento) VALUES (?, ?, ?)')
      .run(placaLimpa, isFrota ? 1 : 0, dadosPagamento || null);
    res.status(201).json({ message: 'Veiculo cadastrado!', id: Number(info.lastInsertRowid) });
  } catch {
    res.status(409).json({ error: 'Placa ja cadastrada' });
  }
});

veiculosRouter.put('/api/veiculos/:id', requireLogin, requireAdmin, (req, res) => {
  const { placa, is_frota: isFrota, dados_pagamento: dadosPagamento } = req.body || {};
  const placaLimpa = (placa || '').trim().toUpperCase().replace(/-/g, '');
  if (!placaLimpa) return res.status(400).json({ error: 'Placa e obrigatoria' });
  const existente = db.prepare('SELECT id FROM veiculos WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Veiculo nao encontrado' });
  try {
    db.prepare('UPDATE veiculos SET placa = ?, is_frota = ?, dados_pagamento = ? WHERE id = ?')
      .run(placaLimpa, isFrota ? 1 : 0, dadosPagamento || null, req.params.id);
    res.json({ message: 'Veiculo atualizado!' });
  } catch {
    res.status(409).json({ error: 'Placa ja cadastrada em outro veiculo' });
  }
});

veiculosRouter.delete('/api/veiculos/:id', requireLogin, requireAdmin, (req, res) => {
  const existente = db.prepare('SELECT id FROM veiculos WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ error: 'Veiculo nao encontrado' });
  try {
    db.prepare('DELETE FROM veiculos WHERE id = ?').run(req.params.id);
    res.json({ message: 'Veiculo excluido!' });
  } catch {
    res.status(409).json({ error: 'Nao e possivel excluir (veiculo em uso em alguma carga)' });
  }
});

veiculosRouter.post('/api/veiculos/import', requireLogin, requireAdmin, upload.single('arquivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  const linhas = parseCsv(decodeUploadedText(req.file.buffer));

  const existentes = new Set(db.prepare('SELECT placa FROM veiculos').all().map((r) => r.placa));
  const insert = db.prepare('INSERT INTO veiculos (placa) VALUES (?)');
  let novos = 0;
  let ignorados = 0;

  for (const linha of linhas) {
    const placa = (linha[0] || '').trim().toUpperCase().replace(/-/g, '');
    if (!placa || existentes.has(placa)) { ignorados++; continue; }
    insert.run(placa);
    existentes.add(placa);
    novos++;
  }

  res.json({ message: `Importacao concluida! ${novos} novo(s) veiculo(s) importado(s), ${ignorados} ignorado(s) (placa ja existente).` });
});
