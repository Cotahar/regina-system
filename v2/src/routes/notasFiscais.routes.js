import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireLogin } from '../middleware/auth.js';

export const notasFiscaisRouter = Router();

notasFiscaisRouter.get('/api/notas-fiscais', requireLogin, (req, res) => {
  const { status, origem, q } = req.query;
  let sql = `
    SELECT n.*, rem.razao_social as remetente_nome_cadastro, cli.razao_social as cliente_nome_cadastro
    FROM notas_fiscais_email n
    LEFT JOIN clientes rem ON rem.id = n.remetente_id
    LEFT JOIN clientes cli ON cli.id = n.cliente_id
    WHERE 1=1
  `;
  const params = [];
  if (status) {
    sql += ' AND n.status = ?';
    params.push(status);
  }
  if (origem) {
    sql += ' AND n.extraction_source = ?';
    params.push(origem);
  }
  if (q) {
    sql += ' AND (n.numero_nf LIKE ? OR n.cnpj_emitente LIKE ? OR n.cnpj_destinatario LIKE ? OR n.nome_emitente LIKE ? OR n.nome_destinatario LIKE ?)';
    const termo = `%${q}%`;
    params.push(termo, termo, termo, termo, termo);
  }
  sql += ' ORDER BY n.criado_em DESC';

  const notas = db.prepare(sql).all(...params);
  res.json(notas.map((n) => ({
    ...n,
    precisa_revisao: !!n.precisa_revisao,
    xml_url: n.xml_arquivo ? `/uploads/notas-fiscais/${n.xml_arquivo}` : null,
    pdf_url: n.pdf_arquivo ? `/uploads/notas-fiscais/${n.pdf_arquivo}` : null
  })));
});

// So preenche Nota Fiscal + Peso Bruto na entrega - o valor da NF-e (vNF) e o
// valor da mercadoria, nao o frete cobrado pelo transporte, entao nunca
// sobrescreve valor_frete (isso continua manual, como sempre foi).
notasFiscaisRouter.put('/api/notas-fiscais/vincular', requireLogin, (req, res) => {
  const { atribuicoes, sobrescrever_peso_valor: sobrescreverPeso } = req.body || {};
  if (!Array.isArray(atribuicoes) || !atribuicoes.length) {
    return res.status(400).json({ error: 'Nenhuma atribuicao informada.' });
  }

  const entregaIds = atribuicoes.map((a) => a.entrega_id);
  if (new Set(entregaIds).size !== entregaIds.length) {
    return res.status(400).json({ error: 'Duas notas nao podem ser vinculadas a mesma linha. Escolha uma linha diferente pra cada uma.' });
  }

  db.exec('BEGIN');
  try {
    for (const { nota_fiscal_email_id: notaId, entrega_id: entregaId } of atribuicoes) {
      const nota = db.prepare('SELECT * FROM notas_fiscais_email WHERE id = ?').get(notaId);
      const entrega = db.prepare('SELECT id FROM entregas WHERE id = ?').get(entregaId);
      if (!nota || !entrega) throw new Error(`Nota ou entrega nao encontrada (nota ${notaId}, entrega ${entregaId}).`);

      if (sobrescreverPeso && nota.peso_bruto !== null) {
        db.prepare('UPDATE entregas SET nota_fiscal = ?, peso_bruto = ? WHERE id = ?')
          .run(nota.numero_nf, nota.peso_bruto, entregaId);
      } else {
        db.prepare('UPDATE entregas SET nota_fiscal = ? WHERE id = ?').run(nota.numero_nf, entregaId);
      }

      db.prepare("UPDATE notas_fiscais_email SET status = 'vinculada', entrega_id = ? WHERE id = ?").run(entregaId, notaId);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(400).json({ error: err.message });
  }

  res.json({ message: `${atribuicoes.length} nota(s) vinculada(s).` });
});

notasFiscaisRouter.post('/api/notas-fiscais/criar-disponivel', requireLogin, (req, res) => {
  const { itens } = req.body || {};
  if (!Array.isArray(itens) || !itens.length) {
    return res.status(400).json({ error: 'Nenhum item informado.' });
  }

  let criadas = 0;
  const ignoradas = [];

  db.exec('BEGIN');
  try {
    for (const { nota_fiscal_email_id: notaId, cliente_id_override: clienteIdOverride } of itens) {
      const nota = db.prepare('SELECT * FROM notas_fiscais_email WHERE id = ?').get(notaId);
      if (!nota) {
        ignoradas.push({ id: notaId, motivo: 'Nota nao encontrada.' });
        continue;
      }

      const clienteId = clienteIdOverride || nota.cliente_id;
      if (!clienteId) {
        ignoradas.push({ id: notaId, motivo: 'Sem destinatario (cliente) definido.' });
        continue;
      }

      const info = db.prepare(`
        INSERT INTO entregas (carga_id, cliente_id, remetente_id, peso_bruto, valor_frete, nota_fiscal)
        VALUES (NULL, ?, ?, ?, NULL, ?)
      `).run(clienteId, nota.remetente_id || null, nota.peso_bruto || null, nota.numero_nf || null);

      db.prepare("UPDATE notas_fiscais_email SET status = 'entrega_criada', entrega_id = ? WHERE id = ?")
        .run(info.lastInsertRowid, notaId);
      criadas++;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(400).json({ error: err.message });
  }

  res.json({ message: `${criadas} entrega(s) disponivel(is) criada(s), ${ignoradas.length} ignorada(s).`, criadas, ignoradas });
});

notasFiscaisRouter.put('/api/notas-fiscais/ignorar', requireLogin, (req, res) => {
  const { nota_fiscal_email_ids: ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'Nenhuma nota selecionada.' });
  }
  const placeholders = ids.map(() => '?').join(',');
  const info = db.prepare(`UPDATE notas_fiscais_email SET status = 'ignorada' WHERE id IN (${placeholders})`).run(...ids);
  res.json({ message: `${info.changes} nota(s) marcada(s) como ignorada(s).` });
});
