import { Router } from 'express';
import { requireLogin } from '../middleware/auth.js';
import { consultarCnpj, ErroConsultaCnpj } from '../services/cnpj.service.js';

export const cnpjRouter = Router();

// Passa pelo nosso servidor (em vez do navegador chamar a API publica
// direto) pra manter a origem das consultas num lugar so e devolver os dados
// ja no formato do cadastro.
cnpjRouter.get('/api/cnpj/:cnpj', requireLogin, async (req, res) => {
  try {
    res.json(await consultarCnpj(req.params.cnpj.replace(/\D/g, '')));
  } catch (err) {
    if (err instanceof ErroConsultaCnpj) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});
