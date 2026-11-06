import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireLogin } from '../middleware/auth.js';
import { requireRepresentante } from '../middleware/representante.js';
import { renderLayout } from '../views/layout.js';
import { renderMinhasNotasPage } from '../views/minhasNotas.js';
import { renderNotaFiscalPdf } from '../views/notaFiscalPdf.js';

export const representanteRouter = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Mesma pasta onde a importacao de e-mail grava os anexos das notas.
const pastaNotas = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads'), 'notas-fiscais');

// Uma nota e "do remetente" quando casou com o cadastro dele na importacao
// (remetente_id) OU quando o CNPJ do emitente e o mesmo do cadastro (pega
// notas que chegaram antes do CNPJ ser cadastrado). Notas marcadas como
// ignoradas pela equipe ficam de fora. Todo acesso do representante a uma
// nota passa por este filtro - lista e PDF.
const FILTRO_NOTAS_DO_REMETENTE = "(n.remetente_id = ? OR (? IS NOT NULL AND n.cnpj_emitente = ?)) AND n.status != 'ignorada'";
const paramsFiltro = (remetente) => [remetente.id, remetente.cnpj, remetente.cnpj];

representanteRouter.get('/minhas-notas.html', requireLogin, requireRepresentante, (req, res) => {
  res.type('html').send(renderLayout({
    title: 'Minhas notas fiscais',
    user: req.session,
    bodyHtml: renderMinhasNotasPage({ remetenteNome: req.remetente.nome }),
    extraScripts: '<script type="module" src="/js/pages/minhas-notas.js"></script>'
  }));
});

// Colunas escolhidas a dedo (nada de SELECT *): o representante so recebe
// dados da propria nota - nunca status, carga, motorista, placa ou valores.
representanteRouter.get('/api/representante/notas', requireLogin, requireRepresentante, (req, res) => {
  const notas = db.prepare(`
    SELECT n.id, n.numero_nf, n.data_emissao, n.nome_destinatario, n.cidade_destinatario, n.estado_destinatario, n.peso_bruto
    FROM notas_fiscais_email n
    WHERE ${FILTRO_NOTAS_DO_REMETENTE}
    ORDER BY n.data_emissao DESC, n.id DESC
    LIMIT 2000
  `).all(...paramsFiltro(req.remetente));

  res.set('Cache-Control', 'private, no-store');
  res.json({ remetente_nome: req.remetente.nome, notas });
});

// PDF original (DANFE recebido por e-mail) quando existe; senao o resumo
// gerado a partir do XML. Nota de outro remetente responde 404, igual a uma
// nota que nao existe (nao revela se o numero existe).
representanteRouter.get('/representante/notas/:id/pdf', requireLogin, requireRepresentante, (req, res) => {
  const nota = db.prepare(`SELECT n.* FROM notas_fiscais_email n WHERE n.id = ? AND ${FILTRO_NOTAS_DO_REMETENTE}`)
    .get(req.params.id, ...paramsFiltro(req.remetente));
  if (!nota) return res.status(404).send('Nota fiscal nao encontrada');

  res.set('Cache-Control', 'private, no-store');

  const arquivoPdf = nota.pdf_arquivo ? path.join(pastaNotas, path.basename(nota.pdf_arquivo)) : null;
  if (arquivoPdf && fs.existsSync(arquivoPdf)) {
    const nomeSeguro = String(nota.numero_nf || nota.id).replace(/[^\w.-]/g, '');
    return res.sendFile(arquivoPdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="NF-${nomeSeguro}.pdf"`,
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }

  res.type('html').send(renderNotaFiscalPdf({ nota, ocultarTransporte: true }));
});
