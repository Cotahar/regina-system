import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireLogin, requireAdmin } from '../middleware/auth.js';
import { hashPassword } from '../services/password.js';

export const usuariosRouter = Router();

usuariosRouter.get('/api/usuarios', requireLogin, requireAdmin, (req, res) => {
  const usuarios = db.prepare('SELECT id, nome_usuario, permissao FROM usuarios ORDER BY id').all();
  res.json(usuarios);
});

usuariosRouter.post('/api/usuarios', requireLogin, requireAdmin, (req, res) => {
  const { nome_usuario: nomeUsuario, senha, permissao } = req.body || {};
  if (!nomeUsuario || !senha || !permissao) {
    return res.status(400).json({ error: 'Todos os campos sao obrigatorios' });
  }
  if (db.prepare('SELECT id FROM usuarios WHERE nome_usuario = ?').get(nomeUsuario)) {
    return res.status(409).json({ error: 'Nome de usuario ja existe' });
  }

  db.prepare('INSERT INTO usuarios (nome_usuario, senha_hash, permissao) VALUES (?, ?, ?)')
    .run(nomeUsuario, hashPassword(senha), permissao);
  res.status(201).json({ message: 'Usuario cadastrado com sucesso!' });
});

usuariosRouter.put('/api/usuarios/:id', requireLogin, requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  if (userId === 1) return res.status(403).json({ error: 'Nao e possivel modificar o usuario admin principal' });

  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(userId);
  if (!usuario) return res.status(404).json({ error: 'Usuario nao encontrado' });

  const { nome_usuario: nomeUsuario, senha, permissao } = req.body || {};
  if (!nomeUsuario || !permissao) {
    return res.status(400).json({ error: 'Nome de usuario e permissao sao obrigatorios' });
  }

  const existente = db.prepare('SELECT id FROM usuarios WHERE nome_usuario = ? AND id != ?').get(nomeUsuario, userId);
  if (existente) return res.status(409).json({ error: 'Nome de usuario ja esta em uso por outro usuario' });

  if (senha) {
    db.prepare('UPDATE usuarios SET nome_usuario = ?, permissao = ?, senha_hash = ? WHERE id = ?')
      .run(nomeUsuario, permissao, hashPassword(senha), userId);
  } else {
    db.prepare('UPDATE usuarios SET nome_usuario = ?, permissao = ? WHERE id = ?').run(nomeUsuario, permissao, userId);
  }

  res.json({ message: 'Usuario atualizado com sucesso!' });
});

usuariosRouter.delete('/api/usuarios/:id', requireLogin, requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  if (userId === 1) return res.status(403).json({ error: 'Nao e possivel modificar o usuario admin principal' });

  const usuario = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(userId);
  if (!usuario) return res.status(404).json({ error: 'Usuario nao encontrado' });

  db.prepare('DELETE FROM usuarios WHERE id = ?').run(userId);
  res.json({ message: 'Usuario excluido com sucesso!' });
});
