import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireLogin, requireAdmin } from '../middleware/auth.js';
import { hashPassword } from '../services/password.js';
import { PERMISSAO_REPRESENTANTE } from '../middleware/representante.js';

export const usuariosRouter = Router();

const PERMISSOES_VALIDAS = ['usuario', 'admin', PERMISSAO_REPRESENTANTE];

// Valida perfil + remetente. Um perfil fora da lista nao pode passar: o
// bloqueio do representante depende do valor exato, entao um texto errado
// viraria um usuario comum (acesso total) sem ninguem perceber. Representante
// exige um remetente (cliente) existente; os demais perfis nao guardam remetente.
function validarPerfil(permissao, remetenteId) {
  if (!PERMISSOES_VALIDAS.includes(permissao)) return { erro: 'Permissao invalida.' };
  if (permissao !== PERMISSAO_REPRESENTANTE) return { remetenteId: null };
  if (!remetenteId) return { erro: 'Escolha o remetente do representante.' };
  if (!db.prepare('SELECT id FROM clientes WHERE id = ?').get(remetenteId)) {
    return { erro: 'Remetente nao encontrado no cadastro de clientes.' };
  }
  return { remetenteId: Number(remetenteId) };
}

usuariosRouter.get('/api/usuarios', requireLogin, requireAdmin, (req, res) => {
  const usuarios = db.prepare(`
    SELECT u.id, u.nome_usuario, u.permissao, u.remetente_id, c.razao_social as remetente_nome,
      (u.senha_hash IS NOT NULL AND u.senha_hash != '') as senha_configurada
    FROM usuarios u
    LEFT JOIN clientes c ON c.id = u.remetente_id
    ORDER BY u.id
  `).all();
  res.json(usuarios.map((u) => ({ ...u, senha_configurada: !!u.senha_configurada })));
});

usuariosRouter.post('/api/usuarios', requireLogin, requireAdmin, (req, res) => {
  const { nome_usuario: nomeUsuario, senha, permissao, remetente_id: remetenteIdInformado } = req.body || {};
  if (!nomeUsuario || !senha || !permissao) {
    return res.status(400).json({ error: 'Todos os campos sao obrigatorios' });
  }
  const perfil = validarPerfil(permissao, remetenteIdInformado);
  if (perfil.erro) return res.status(400).json({ error: perfil.erro });
  if (db.prepare('SELECT id FROM usuarios WHERE nome_usuario = ?').get(nomeUsuario)) {
    return res.status(409).json({ error: 'Nome de usuario ja existe' });
  }

  db.prepare('INSERT INTO usuarios (nome_usuario, senha_hash, permissao, remetente_id) VALUES (?, ?, ?, ?)')
    .run(nomeUsuario, hashPassword(senha), permissao, perfil.remetenteId);
  res.status(201).json({ message: 'Usuario cadastrado com sucesso!' });
});

usuariosRouter.put('/api/usuarios/:id', requireLogin, requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  if (userId === 1) return res.status(403).json({ error: 'Nao e possivel modificar o usuario admin principal' });

  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(userId);
  if (!usuario) return res.status(404).json({ error: 'Usuario nao encontrado' });

  const { nome_usuario: nomeUsuario, senha, permissao, remetente_id: remetenteIdInformado } = req.body || {};
  if (!nomeUsuario || !permissao) {
    return res.status(400).json({ error: 'Nome de usuario e permissao sao obrigatorios' });
  }
  const perfil = validarPerfil(permissao, remetenteIdInformado);
  if (perfil.erro) return res.status(400).json({ error: perfil.erro });

  const existente = db.prepare('SELECT id FROM usuarios WHERE nome_usuario = ? AND id != ?').get(nomeUsuario, userId);
  if (existente) return res.status(409).json({ error: 'Nome de usuario ja esta em uso por outro usuario' });

  if (senha) {
    db.prepare('UPDATE usuarios SET nome_usuario = ?, permissao = ?, remetente_id = ?, senha_hash = ? WHERE id = ?')
      .run(nomeUsuario, permissao, perfil.remetenteId, hashPassword(senha), userId);
  } else {
    db.prepare('UPDATE usuarios SET nome_usuario = ?, permissao = ?, remetente_id = ? WHERE id = ?')
      .run(nomeUsuario, permissao, perfil.remetenteId, userId);
  }

  res.json({ message: 'Usuario atualizado com sucesso!' });
});

usuariosRouter.post('/api/usuarios/:id/resetar-senha', requireLogin, requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  const usuario = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(userId);
  if (!usuario) return res.status(404).json({ error: 'Usuario nao encontrado' });

  db.prepare("UPDATE usuarios SET senha_hash = '' WHERE id = ?").run(userId);
  res.json({ message: 'Senha removida - o usuario precisara criar uma nova no proximo acesso.' });
});

usuariosRouter.delete('/api/usuarios/:id', requireLogin, requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  if (userId === 1) return res.status(403).json({ error: 'Nao e possivel modificar o usuario admin principal' });

  const usuario = db.prepare('SELECT id FROM usuarios WHERE id = ?').get(userId);
  if (!usuario) return res.status(404).json({ error: 'Usuario nao encontrado' });

  db.prepare('DELETE FROM usuarios WHERE id = ?').run(userId);
  res.json({ message: 'Usuario excluido com sucesso!' });
});
