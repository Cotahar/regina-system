import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireLogin } from '../middleware/auth.js';
import { registrarOcorrencia } from '../services/ocorrencias.service.js';

export const ocorrenciasRouter = Router();

ocorrenciasRouter.get('/api/cargas/:id/ocorrencias', requireLogin, (req, res) => {
  const ocorrencias = db.prepare('SELECT * FROM ocorrencias_carga WHERE carga_id = ? ORDER BY id DESC').all(req.params.id);
  res.json(ocorrencias);
});

ocorrenciasRouter.post('/api/cargas/:id/ocorrencias', requireLogin, (req, res) => {
  const carga = db.prepare('SELECT id FROM cargas WHERE id = ?').get(req.params.id);
  if (!carga) return res.status(404).json({ error: 'Carga nao encontrada' });

  const texto = (req.body?.texto || '').trim();
  if (!texto) return res.status(400).json({ error: 'Escreva algo pra registrar.' });

  registrarOcorrencia(req.params.id, texto, req.session.userName, 'manual');
  res.status(201).json({ message: 'Ocorrencia registrada!' });
});
