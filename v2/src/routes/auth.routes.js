import { Router } from 'express';
import { db } from '../db/connection.js';
import { verifyPassword, hashPassword } from '../services/password.js';
import { requireLogin } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/api/login', (req, res) => {
  const { nome_usuario, senha } = req.body || {};
  if (!nome_usuario || !senha) {
    return res.status(400).json({ error: 'Usuario e senha sao obrigatorios' });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE nome_usuario = ?').get(nome_usuario);
  if (!usuario) {
    return res.status(401).json({ error: 'Usuario ou senha invalidos' });
  }
  if (!usuario.senha_hash) {
    return res.status(401).json({ error: 'Primeiro acesso: crie sua senha para continuar.', primeiro_acesso: true });
  }
  if (!verifyPassword(senha, usuario.senha_hash)) {
    return res.status(401).json({ error: 'Usuario ou senha invalidos' });
  }

  req.createSession({
    userId: usuario.id,
    userName: usuario.nome_usuario,
    permissao: usuario.permissao
  });
  res.json({ message: 'Login bem-sucedido!' });
});

// Primeiro acesso: define a senha de um usuario que foi criado/resetado sem
// uma (senha_hash vazio). So funciona enquanto nao houver senha configurada -
// depois disso, mudar senha e responsabilidade do administrador (tela de
// Usuarios), nao dessa rota publica.
authRouter.post('/api/primeiro-acesso', (req, res) => {
  const { nome_usuario, senha, confirmacao } = req.body || {};
  if (!nome_usuario || !senha || !confirmacao) {
    return res.status(400).json({ error: 'Preencha usuario, senha e confirmacao.' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  }
  if (senha !== confirmacao) {
    return res.status(400).json({ error: 'As senhas nao coincidem.' });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE nome_usuario = ?').get(nome_usuario);
  if (!usuario) {
    return res.status(404).json({ error: 'Usuario nao encontrado.' });
  }
  if (usuario.senha_hash) {
    return res.status(409).json({ error: 'Este usuario ja tem senha configurada. Fale com um administrador se precisar redefinir.' });
  }

  db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hashPassword(senha), usuario.id);

  req.createSession({
    userId: usuario.id,
    userName: usuario.nome_usuario,
    permissao: usuario.permissao
  });
  res.json({ message: 'Senha criada com sucesso!' });
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
