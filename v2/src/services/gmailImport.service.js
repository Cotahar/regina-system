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

function inserirNota(gmailIdParaLinha, mensagem, campos, extractionSource, xmlArquivo, pdfArquivo) {
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
      placa_veiculo, nome_motorista, remetente_id, cliente_id, xml_arquivo, pdf_arquivo,
      status, precisa_revisao
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?)
  `).run(
    gmailIdParaLinha,
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
    campos.placaVeiculo,
    campos.nomeMotorista,
    remetenteMatch ? remetenteMatch.id : null,
    clienteMatch ? clienteMatch.id : null,
    xmlArquivo,
    pdfArquivo,
    extractionSource === 'pdf' ? 1 : 0
  );
}

// Um e-mail pode trazer mais de uma NF-e junto (comum quando a fabrica manda
// varias notas no mesmo lote) - cada XML vira sua propria nota, pra nao
// perder as extras. So pareia um PDF (DANFE) de bonus na mesma linha do XML
// quando a correspondencia e inequivoca (exatamente 1 de cada no e-mail);
// fora desse caso cada PDF tambem vira sua propria nota (fallback), em vez
// de ser descartado silenciosamente.
async function processarMensagem(gmail, messageId) {
  const jaExiste = db.prepare('SELECT id FROM notas_fiscais_email WHERE gmail_message_id = ?').get(messageId);
  if (jaExiste) return false;

  const { data: mensagem } = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  const anexos = coletarAnexos(mensagem.payload);
  const anexosXml = anexos.filter((a) => a.filename.toLowerCase().endsWith('.xml'));
  const anexosPdf = anexos.filter((a) => a.filename.toLowerCase().endsWith('.pdf'));

  if (!anexosXml.length && !anexosPdf.length) {
    // sem XML/PDF (ex: so imagem, ou email sem anexo relevante) - marca lido e ignora, sem gerar linha
    await marcarComoLido(gmail, messageId);
    return false;
  }

  const parPerfeito = anexosXml.length === 1 && anexosPdf.length === 1;
  let indice = 0;
  // A primeira nota extraida do e-mail usa o proprio messageId (mantendo
  // compatibilidade com o dedup existente); as demais ganham um sufixo -
  // messageId sozinho so pode bater com uma linha, entao o dedup no topo
  // continua funcionando (se a primeira ja foi gravada, o email inteiro ja
  // foi processado).
  function proximoGmailId() {
    indice++;
    return indice === 1 ? messageId : `${messageId}#${indice}`;
  }

  for (const anexoXml of anexosXml) {
    const prefixo = `${messageId}_${indice + 1}`;
    const { buffer, nomeArquivo } = await salvarAnexo(gmail, messageId, anexoXml, prefixo);
    let pdfArquivo = null;
    if (parPerfeito) {
      pdfArquivo = (await salvarAnexo(gmail, messageId, anexosPdf[0], prefixo)).nomeArquivo;
    }
    const campos = parseNFeXml(buffer.toString('utf-8'));
    inserirNota(proximoGmailId(), mensagem, campos, 'xml', nomeArquivo, pdfArquivo);
  }

  if (!parPerfeito) {
    for (const anexoPdf of anexosPdf) {
      const prefixo = `${messageId}_${indice + 1}`;
      const { buffer, nomeArquivo } = await salvarAnexo(gmail, messageId, anexoPdf, prefixo);
      const texto = await extrairTextoPdf(buffer);
      const campos = extractFromPdfText(texto);
      inserirNota(proximoGmailId(), mensagem, campos, 'pdf', null, nomeArquivo);
    }
  }

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
