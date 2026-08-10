// Rota temporaria, admin-only, para sincronizar os dados reais do sistema
// Python antigo (regina-system) neste banco. Uso unico (sincronizacao inicial
// de producao) - remover apos a migracao ser confirmada, ja que reexecutar
// apaga os dados atuais deste sistema e substitui pelos do JSON enviado.

import { Router } from 'express';
import { db } from '../db/connection.js';
import { importarDadosPython } from '../db/importarPython.js';
import { requireLogin, requireAdmin } from '../middleware/auth.js';

export const adminImportRouter = Router();

adminImportRouter.post(
  '/api/admin/importar-python',
  requireLogin,
  requireAdmin,
  (req, res) => {
    try {
      const resumo = importarDadosPython(db, req.body);
      res.json({ message: 'Importacao concluida.', resumo });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);
