import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db } from '../db/connection.js';
import { requireLogin, requireAdmin } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');
const uploadsDir = path.join(uploadsRoot, 'avarias');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const sufixo = crypto.randomBytes(8).toString('hex');
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `avaria_${req.params.id}_${Date.now()}_${sufixo}${ext}`);
    }
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpe?g|png|webp|heic|heif)$/i.test(file.mimetype)) {
      return cb(new Error('Apenas imagens sao permitidas.'));
    }
    cb(null, true);
  }
});

export const avariasRouter = Router();

function toDictAvaria(a, itens, fotos) {
  return {
    id: a.id,
    entrega_id: a.entrega_id,
    nota_fiscal: a.nota_fiscal,
    marca_nome: a.marca_nome || 'N/A',
    tipo_descarga: a.tipo_descarga,
    observacoes: a.observacoes,
    status: a.status,
    registro_envio: a.registro_envio,
    retorno_fabrica: a.retorno_fabrica,
    valor_cobranca: a.valor_cobranca,
    data_criacao: a.data_criacao,
    itens: itens.map((i) => ({ id: i.id, produto: i.produto_nome, quantidade: i.quantidade, unidade: i.unidade_medida })),
    fotos: fotos.map((f) => ({ id: f.id, arquivo: f.arquivo, nome_original: f.nome_original }))
  };
}

avariasRouter.get('/api/avarias', requireLogin, (req, res) => {
  let sql = `
    SELECT a.*, m.nome as marca_nome,
      e.cliente_id, e.carga_id,
      cl.razao_social as cliente_razao_social,
      c.motorista_id,
      mot.nome as motorista_nome
    FROM avarias a
    LEFT JOIN marcas m ON m.id = a.marca_id
    LEFT JOIN entregas e ON e.id = a.entrega_id
    LEFT JOIN clientes cl ON cl.id = e.cliente_id
    LEFT JOIN cargas c ON c.id = e.carga_id
    LEFT JOIN motoristas mot ON mot.id = c.motorista_id
    WHERE 1=1
  `;
  const params = [];
  const q = req.query;
  if (q.status) { sql += ' AND a.status = ?'; params.push(q.status); }
  if (q.nf) { sql += ' AND a.nota_fiscal LIKE ?'; params.push(`%${q.nf}%`); }
  if (q.marca_id) { sql += ' AND a.marca_id = ?'; params.push(q.marca_id); }
  if (q.data_inicio) { sql += ' AND date(a.data_criacao) >= ?'; params.push(q.data_inicio); }
  if (q.data_fim) { sql += ' AND date(a.data_criacao) <= ?'; params.push(q.data_fim); }
  if (q.cliente_id) { sql += ' AND e.cliente_id = ?'; params.push(q.cliente_id); }
  if (q.motorista_id) { sql += ' AND c.motorista_id = ?'; params.push(q.motorista_id); }
  if (q.carga_id) { sql += ' AND e.carga_id = ?'; params.push(q.carga_id); }
  sql += ' ORDER BY a.data_criacao DESC';

  const avarias = db.prepare(sql).all(...params);
  const itensStmt = db.prepare('SELECT * FROM avaria_itens WHERE avaria_id = ?');
  const fotosStmt = db.prepare('SELECT * FROM avaria_fotos WHERE avaria_id = ?');

  res.json(avarias.map((a) => {
    let clienteNome = 'N/A';
    if (a.cliente_razao_social) {
      const raw = a.cliente_razao_social;
      clienteNome = raw.includes('-') ? raw.split('-').slice(1).join('-').trim() : raw;
    }
    return {
      id: a.id,
      data: a.data_criacao ? a.data_criacao.slice(0, 10).split('-').reverse().join('/') : '',
      nota_fiscal: a.nota_fiscal || 'N/A',
      cliente: clienteNome,
      cliente_id: a.cliente_id,
      carga_id: a.carga_id,
      motorista: a.motorista_nome || 'N/A',
      marca: a.marca_nome || 'N/A',
      status: a.status,
      observacoes: a.observacoes || '',
      registro_envio: a.registro_envio || '',
      retorno_fabrica: a.retorno_fabrica || '',
      valor_cobranca: a.valor_cobranca || 0.0,
      itens: itensStmt.all(a.id).map((i) => ({ produto: i.produto_nome, quantidade: i.quantidade, unidade: i.unidade_medida })),
      fotos: fotosStmt.all(a.id).map((f) => ({ id: f.id, arquivo: f.arquivo }))
    };
  }));
});

avariasRouter.post('/api/avarias', requireLogin, (req, res) => {
  const data = req.body || {};
  const { entrega_id: entregaId, marca_id: marcaId, itens, tipo_descarga: tipoDescarga } = data;
  const notaFiscalManual = data.nota_fiscal;

  if (!entregaId || !marcaId || !itens || !itens.length) {
    return res.status(400).json({ error: 'Dados incompletos.' });
  }

  const entrega = db.prepare(`
    SELECT e.*, cl.razao_social as cliente_razao_social FROM entregas e
    LEFT JOIN clientes cl ON cl.id = e.cliente_id WHERE e.id = ?
  `).get(entregaId);
  if (!entrega) return res.status(404).json({ error: 'Entrega nao encontrada.' });

  const info = db.prepare(`
    INSERT INTO avarias (entrega_id, marca_id, tipo_descarga, nota_fiscal, status)
    VALUES (?, ?, ?, ?, 'Pendente')
  `).run(entregaId, marcaId, tipoDescarga || null, notaFiscalManual || null);
  const avariaId = Number(info.lastInsertRowid);

  const insertItem = db.prepare('INSERT INTO avaria_itens (avaria_id, produto_nome, quantidade, unidade_medida) VALUES (?, ?, ?, ?)');
  for (const item of itens) {
    insertItem.run(avariaId, item.produto, item.quantidade, item.unidade);
  }

  let clienteNome = 'CLIENTE';
  if (entrega.cliente_razao_social) {
    const raw = entrega.cliente_razao_social;
    clienteNome = raw.includes('-') ? raw.split('-').slice(1).join('-').trim() : raw;
  }

  let descargaTxt = tipoDescarga;
  if (['Empilhadeira', 'Munck', 'Grua'].includes(tipoDescarga)) descargaTxt = `com ${tipoDescarga}`;

  const nf = notaFiscalManual || '';
  const prefixoNf = (nf.includes('/') || nf.includes(',')) ? 'as NFs' : 'a NF';

  let texto;
  if (itens.length === 1) {
    const it = itens[0];
    texto = `Conforme imagens em anexo, foram encontradas ${it.quantidade} ${it.unidade} avariadas no meio do pallet ref. ao produto ${it.produto}, NFe ${nf}. A quebra foi percebida durante a descarga ${descargaTxt} no cliente ${clienteNome}.`;
  } else {
    texto = `Durante a descarga ${descargaTxt}, foram encontradas avarias no meio do pallet referente ${prefixoNf} ${nf} do cliente ${clienteNome}. Seguem em anexo registros feitos pelo motorista e abaixo segue quantidade e produtos:\n`;
    for (const it of itens) {
      texto += `\n- NF ${nf} - ${it.produto} - ${it.quantidade} ${it.unidade}`;
    }
  }

  db.prepare('UPDATE avarias SET observacoes = ? WHERE id = ?').run(texto, avariaId);
  res.json({ message: 'Registrado!', avaria_id: avariaId });
});

avariasRouter.put('/api/avarias/:id', requireLogin, (req, res) => {
  const avaria = db.prepare('SELECT * FROM avarias WHERE id = ?').get(req.params.id);
  if (!avaria) return res.status(404).json({ error: 'Nao encontrada' });

  const data = req.body || {};
  if ('observacoes' in data) {
    db.prepare('UPDATE avarias SET observacoes = ? WHERE id = ?').run(data.observacoes, req.params.id);
  }

  if (data.acao === 'registrar_envio') {
    if (!data.registro_envio) return res.status(400).json({ error: 'Registro obrigatorio' });
    db.prepare("UPDATE avarias SET status = 'Enviado', registro_envio = ? WHERE id = ?").run(data.registro_envio, req.params.id);
  } else if (data.acao === 'finalizar') {
    if (!data.retorno_fabrica) return res.status(400).json({ error: 'Retorno obrigatorio' });
    db.prepare("UPDATE avarias SET status = 'Finalizada', retorno_fabrica = ?, valor_cobranca = ? WHERE id = ?")
      .run(data.retorno_fabrica, Number(data.valor_cobranca) || 0.0, req.params.id);
  }

  res.json({ message: 'Atualizado!' });
});

avariasRouter.post('/api/avarias/:id/upload', requireLogin, (req, res, next) => {
  upload.array('fotos')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, (req, res) => {
  const avaria = db.prepare('SELECT id FROM avarias WHERE id = ?').get(req.params.id);
  if (!avaria) return res.status(404).json({ error: 'Avaria nao encontrada.' });

  const files = req.files || [];
  const insert = db.prepare('INSERT INTO avaria_fotos (avaria_id, arquivo, nome_original) VALUES (?, ?, ?)');
  for (const file of files) {
    insert.run(req.params.id, file.filename, file.originalname);
  }

  res.json({ message: `${files.length} foto(s) enviada(s) com sucesso!` });
});

avariasRouter.delete('/api/avarias/:id', requireLogin, requireAdmin, (req, res) => {
  const avaria = db.prepare('SELECT id FROM avarias WHERE id = ?').get(req.params.id);
  if (!avaria) return res.status(404).json({ error: 'Avaria nao encontrada' });

  const fotos = db.prepare('SELECT * FROM avaria_fotos WHERE avaria_id = ?').all(req.params.id);
  let removidas = 0;
  for (const foto of fotos) {
    try {
      fs.unlinkSync(path.join(uploadsDir, foto.arquivo));
      removidas++;
    } catch {
      // arquivo ja pode ter sido removido manualmente; segue o fluxo
    }
  }

  db.prepare('DELETE FROM avarias WHERE id = ?').run(req.params.id);
  res.json({ message: `Avaria excluida com sucesso! (${removidas} fotos removidas do disco)` });
});
