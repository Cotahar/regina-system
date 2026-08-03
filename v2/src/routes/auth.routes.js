import { Router } from 'express';
import { db } from '../db/connection.js';
import { verifyPassword } from '../services/password.js';
import { requireLogin } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/api/login', (req, res) => {
  const { nome_usuario, senha } = req.body || {};
  if (!nome_usuario || !senha) {
    return res.status(400).json({ error: 'Usuario e senha sao obrigatorios' });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE nome_usuario = ?').get(nome_usuario);
  if (!usuario || !verifyPassword(senha, usuario.senha_hash)) {
    return res.status(401).json({ error: 'Usuario ou senha invalidos' });
  }

  req.createSession({
    userId: usuario.id,
    userName: usuario.nome_usuario,
    permissao: usuario.permissao
  });
  res.json({ message: 'Login bem-sucedido!' });
});

authRouter.get('/logout', (req, res) => {
  req.destroySession();
  res.redirect('/login');
});

authRouter.get('/api/session', requireLogin, (req, res) => {
  res.json({
    user_name: req.session.userName,
    user_permission: req.session.permissao
  });
});

authRouter.post('/api/verify-password', requireLogin, (req, res) => {
  const { password } = req.body || {};
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.session.userId);
  if (!usuario) return res.status(401).json({ error: 'Usuario nao encontrado' });
  if (!verifyPassword(password || '', usuario.senha_hash)) {
    return res.status(401).json({ error: 'Senha incorreta' });
  }
  res.json({ message: 'Senha correta!' });
});
