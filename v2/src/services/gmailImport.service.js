import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';
import { db } from '../db/connection.js';
import { notificarMudanca } from './eventos.js';
import { parseNFeXml, extrairTextoPdf, extractFromPdfText } from './nfe.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');
const uploadsDir = path.join(uploadsRoot, 'notas-fiscais');
fs.mkdirSync(uploadsDir, { recursive: true });

const SCOPE_GMAIL = 'https://www.googleapis.com/auth/gmail.modify';

export function gmailConfigurado() {
  return !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN);
}

export function criarClienteOAuth() {
  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) return null;
  const client = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
  if (process.env.GMAIL_REFRESH_TOKEN) {
    client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  }
  return client;
}

function coletarAnexos(part, acc = []) {
  if (!part) return acc;
  if (part.filename && part.body?.attachmentId) acc.push(part);
  if (Array.isArray(part.parts)) {
    for (const sub of part.parts) coletarAnexos(sub, acc);
  }
  return acc;
}

function cabecalho(headers, nome) {
  return headers?.find((h) => h.name.toLowerCase() === nome.toLowerCase())?.value || null;
}

function normalizarCnpj(valor) {
  if (!valor) return null;
  const digitos = String(valor).replace(/\D/g, '');
  return digitos.length ? digitos : null;
}

function sanitizarNomeArquivo(nome) {
  return (nome || 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function salvarAnexo(gmail, messageId, part, prefixoArquivo) {
  const resp = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: part.body.attachmentId
  });
  const buffer = Buffer.from(resp.data.data, 'base64url');
  const nomeArquivo = `${prefixoArquivo}_${sanitizarNomeArquivo(part.filename)}`;
  fs.writeFileSync(path.join(uploadsDir, nomeArquivo), buffer);
  return { buffer, nomeArquivo };
}

async function processarMensagem(gmail, messageId) {
  const jaExiste = db.prepare('SELECT id FROM notas_fiscais_email WHERE gmail_message_id = ?').get(messageId);
  if (jaExiste) return false;

  const { data: mensagem } = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  const anexos = coletarAnexos(mensagem.payload);
  const anexoXml = anexos.find((a) => a.filename.toLowerCase().endsWith('.xml'));
  const anexoPdf = anexos.find((a) => a.filename.toLowerCase().endsWith('.pdf'));

  if (!anexoXml && !anexoPdf) {
    // sem XML/PDF (ex: so imagem, ou email sem anexo relevante) - marca lido e ignora, sem gerar linha
    await marcarComoLido(gmail, messageId);
    return false;
  }

  let campos;
  let extractionSource;
  let xmlArquivo = null;
  let pdfArquivo = null;

  if (anexoXml) {
    const { buffer, nomeArquivo } = await salvarAnexo(gmail, messageId, anexoXml, messageId);
    xmlArquivo = nomeArquivo;
    campos = parseNFeXml(buffer.toString('utf-8'));
    extractionSource = 'xml';
    if (anexoPdf) {
      const salvo = await salvarAnexo(gmail, messageId, anexoPdf, messageId);
      pdfArquivo = salvo.nomeArquivo;
    }
  } else {
    const { buffer, nomeArquivo } = await salvarAnexo(gmail, messageId, anexoPdf, messageId);
    pdfArquivo = nomeArquivo;
    const texto = await extrairTextoPdf(buffer);
    campos = extractFromPdfText(texto);
    extractionSource = 'pdf';
  }

  const cnpjEmitente = normalizarCnpj(campos.cnpjEmitente);
  const cnpjDestinatario = normalizarCnpj(campos.cnpjDestinatario);

  const remetenteMatch = cnpjEmitente
    ? db.prepare('SELECT id FROM clientes WHERE cnpj = ?').get(cnpjEmitente)
    : null;
  const clienteMatch = cnpjDestinatario
    ? db.prepare('SELECT id FROM clientes WHERE cnpj = ?').get(cnpjDestinatario)
    : null;

  db.prepare(`
    INSERT INTO notas_fiscais_email (
      gmail_message_id, gmail_thread_id, remetente_email, assunto, data_recebimento,
      extraction_source, numero_nf, chave_acesso, cnpj_emitente, nome_emitente,
      cnpj_destinatario, nome_destinatario, peso_bruto, valor_total, data_emissao,
      remetente_id, cliente_id, xml_arquivo, pdf_arquivo, status, precisa_revisao
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?)
  `).run(
    messageId,
    mensagem.threadId || null,
    cabecalho(mensagem.payload.headers, 'From'),
    cabecalho(mensagem.payload.headers, 'Subject'),
    mensagem.internalDate ? new Date(Number(mensagem.internalDate)).toISOString() : null,
    extractionSource,
    campos.numeroNF,
    campos.chaveAcesso,
    cnpjEmitente,
    campos.nomeEmitente,
    cnpjDestinatario,
    campos.nomeDestinatario,
    campos.pesoBruto,
    campos.valorTotal,
    campos.dataEmissao,
    remetenteMatch ? remetenteMatch.id : null,
    clienteMatch ? clienteMatch.id : null,
    xmlArquivo,
    pdfArquivo,
    extractionSource === 'pdf' ? 1 : 0
  );

  await marcarComoLido(gmail, messageId);
  return true;
}

async function marcarComoLido(gmail, messageId) {
  await gmail.users.messages.modify({ userId: 'me', id: messageId, requestBody: { removeLabelIds: ['UNREAD'] } });
}

export async function executarCicloImportacao() {
  if (!gmailConfigurado()) return;
  const auth = criarClienteOAuth();
  const gmail = google.gmail({ version: 'v1', auth });

  const query = process.env.GMAIL_SEARCH_QUERY || 'is:unread has:attachment';
  const { data } = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 50 });
  const mensagens = data.messages || [];

  let alguma = false;
  for (const { id } of mensagens) {
    try {
      const inserida = await processarMensagem(gmail, id);
      if (inserida) alguma = true;
    } catch (err) {
      console.error(`[notas-fiscais] erro processando mensagem ${id}:`, err.message);
      // nao marca como lida - tenta de novo no proximo ciclo
    }
  }

  if (alguma) notificarMudanca('notas_fiscais');
}

export function iniciarPollingGmail() {
  if (!gmailConfigurado()) {
    console.log('[notas-fiscais] GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN nao configurados - importacao automatica desativada.');
    return;
  }

  const intervalo = Number(process.env.GMAIL_POLL_INTERVAL_MS) || 180000;
  console.log(`[notas-fiscais] importacao automatica ativa (a cada ${Math.round(intervalo / 1000)}s).`);

  executarCicloImportacao().catch((err) => console.error('[notas-fiscais] erro no ciclo inicial:', err.message));
  setInterval(() => {
    executarCicloImportacao().catch((err) => console.error('[notas-fiscais] erro no ciclo de importacao:', err.message));
  }, intervalo).unref();
}
