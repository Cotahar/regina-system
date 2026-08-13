import { Router } from 'express';
import multer from 'multer';
import { db } from '../db/connection.js';
import { requireLogin } from '../middleware/auth.js';
import { decodeUploadedText, parseCsv } from '../utils/csv.js';

const upload = multer({ storage: multer.memoryStorage() });
export const clientesRouter = Router();

function textoCliente(c) {
  return `${(c.razao_social || '').toUpperCase()} (${c.cidade || 'N/A'}-${c.estado || 'N/A'})`;
}

function normalizarCnpj(valor) {
  const digitos = (valor || '').replace(/\D/g, '');
  return digitos || null;
}

clientesRouter.get('/api/clientes/detalhes', requireLogin, (req, res) => {
  const clientes = db.prepare(`
    SELECT c.*, COUNT(e.id) as entregas_count
    FROM clientes c
    LEFT JOIN entregas e ON e.cliente_id = c.id
    GROUP BY c.id
    ORDER BY c.razao_social
  `).all();

  res.json(clientes.map((c) => ({
    id: c.id,
    codigo_cliente: c.codigo_cliente,
    razao_social: c.razao_social,
    cnpj: c.cnpj,
    telefone_completo: `(${c.ddd || ''}) ${c.telefone || ''}`.trim(),
    cidade: c.cidade,
    estado: c.estado,
    is_remetente: !!c.is_remetente,
    padrao_forma_pagamento_id: c.padrao_forma_pagamento_id,
    padrao_tipo_pagamento: c.padrao_tipo_pagamento,
    entregas_count: c.entregas_count,
    text: textoCliente(c),
    ddd: c.ddd,
    telefone: c.telefone,
    observacoes: c.observacoes,
    autodescarga: !!c.autodescarga,
    precisa_ajudantes: !!c.precisa_ajudantes,
    descarga_paga_direto: !!c.descarga_paga_direto,
    precisa_agendamento: !!c.precisa_agendamento,
    resolve_com_representante: !!c.resolve_com_representante,
    contato_extra: c.contato_extra
  })));
});

clientesRouter.get('/api/clientes', requireLogin, (req, res) => {
  const clientes = db.prepare('SELECT * FROM clientes ORDER BY razao_social').all();
  res.json(clientes.map((c) => ({
    id: c.id,
    text: textoCliente(c),
    cnpj: c.cnpj,
    cidade: c.cidade,
    estado: c.estado,
    is_remetente: !!c.is_remetente,
    padrao_forma_pagamento_id: c.padrao_forma_pagamento_id,
    padrao_tipo_pagamento: c.padrao_tipo_pagamento,
    autodescarga: !!c.autodescarga,
    precisa_ajudantes: !!c.precisa_ajudantes,
    descarga_paga_direto: !!c.descarga_paga_direto,
    precisa_agendamento: !!c.precisa_agendamento,
    resolve_com_representante: !!c.resolve_com_representante,
    observacoes: c.observacoes
  })));
});

clientesRouter.post('/api/clientes', requireLogin, (req, res) => {
  const data = req.body || {};
  const razaoSocial = (data.razao_social || '').trim().toUpperCase();
  if (!razaoSocial) return res.status(400).json({ error: 'Razao social e obrigatoria' });

  const codigo = (data.codigo_cliente || '').trim() || `C-${Date.now()}`;
  const existente = db.prepare('SELECT id FROM clientes WHERE codigo_cliente = ?').get(codigo);
  if (existente) return res.status(409).json({ error: 'Codigo de cliente ja cadastrado' });

  const info = db.prepare(`
    INSERT INTO clientes (
      codigo_cliente, razao_social, cnpj, ddd, telefone, cidade, estado, observacoes, is_remetente,
      padrao_forma_pagamento_id, padrao_tipo_pagamento,
      autodescarga, precisa_ajudantes, descarga_paga_direto, precisa_agendamento, resolve_com_representante, contato_extra
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    codigo,
    razaoSocial,
    normalizarCnpj(data.cnpj),
    data.ddd || null,
    data.telefone || null,
    (data.cidade || '').toUpperCase() || null,
    (data.estado || '').toUpperCase() || null,
    data.observacoes || null,
    data.is_remetente ? 1 : 0,
    data.padrao_forma_pagamento_id || null,
    data.padrao_tipo_pagamento || null,
    data.autodescarga ? 1 : 0,
    data.precisa_ajudantes ? 1 : 0,
    data.descarga_paga_direto ? 1 : 0,
    data.precisa_agendamento ? 1 : 0,
    data.resolve_com_representante ? 1 : 0,
    data.contato_extra || null
  );

  res.status(201).json({ message: 'Cliente cadastrado com sucesso!', id: Number(info.lastInsertRowid) });
});

clientesRouter.put('/api/clientes/:id', requireLogin, (req, res) => {
  const cliente = db.prepare('SELECT id FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ error: 'Cliente nao encontrado' });

  const data = req.body || {};
  db.prepare(`
    UPDATE clientes SET
      razao_social = ?, cnpj = ?, cidade = ?, estado = ?, ddd = ?, telefone = ?, observacoes = ?,
      is_remetente = ?, padrao_forma_pagamento_id = ?, padrao_tipo_pagamento = ?,
      autodescarga = ?, precisa_ajudantes = ?, descarga_paga_direto = ?, precisa_agendamento = ?,
      resolve_com_representante = ?, contato_extra = ?
    WHERE id = ?
  `).run(
    (data.razao_social || '').toUpperCase(),
    normalizarCnpj(data.cnpj),
    (data.cidade || '').toUpperCase() || null,
    (data.estado || '').toUpperCase() || null,
    data.ddd || null,
    data.telefone || null,
    data.observacoes || null,
    data.is_remetente ? 1 : 0,
    data.padrao_forma_pagamento_id || null,
    data.padrao_tipo_pagamento || null,
    data.autodescarga ? 1 : 0,
    data.precisa_ajudantes ? 1 : 0,
    data.descarga_paga_direto ? 1 : 0,
    data.precisa_agendamento ? 1 : 0,
    data.resolve_com_representante ? 1 : 0,
    data.contato_extra || null,
    req.params.id
  );

  res.json({ message: 'Cliente atualizado com sucesso!' });
});

clientesRouter.post('/api/clientes/import', requireLogin, upload.single('arquivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  const linhas = parseCsv(decodeUploadedText(req.file.buffer)).slice(1); // primeira linha e cabecalho

  const existentes = new Set(db.prepare('SELECT codigo_cliente FROM clientes').all().map((r) => r.codigo_cliente));
  const insert = db.prepare(`
    INSERT INTO clientes (codigo_cliente, razao_social, ddd, telefone, cidade, estado, observacoes, is_remetente)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `);

  let novos = 0;
  let ignorados = 0;

  for (const linha of linhas) {
    const codigo = (linha[0] || '').trim();
    if (!codigo || existentes.has(codigo)) { ignorados++; continue; }

    const razaoSocial = (linha[1] || '').trim().toUpperCase();
    if (!razaoSocial) { ignorados++; continue; }

    const ddd = (linha[2] || '').trim().slice(0, 2);
    const telefone = (linha[3] || '').trim();
    const cidade = (linha[4] || '').trim().toUpperCase();
    const estado = (linha[5] || '').trim().toUpperCase().slice(0, 2);
    const observacoes = (linha[6] || '').trim();

    insert.run(codigo, razaoSocial, ddd || null, telefone || null, cidade || null, estado || null, observacoes || null);
    existentes.add(codigo);
    novos++;
  }

  res.json({ message: `Importacao concluida! ${novos} novos clientes importados, ${ignorados} ignorados (codigo ja existente ou dados incompletos).` });
});
