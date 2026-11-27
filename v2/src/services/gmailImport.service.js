import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';
import { db } from '../db/connection.js';
import { notificarMudanca } from './eventos.js';
import { parseNFeXml, extractFromPdfText } from './nfe.service.js';
import { classificarXml, classificarPdf, notaComChave, PDF_SEM_TEXTO } from './filtroNotas.service.js';
import { registrarColetaPelaNota } from './coleta.service.js';

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

async function baixarAnexo(gmail, messageId, part) {
  const resp = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: part.body.attachmentId
  });
  return Buffer.from(resp.data.data, 'base64url');
}

function gravarAnexo(anexo, prefixoArquivo) {
  const nomeArquivo = `${prefixoArquivo}_${sanitizarNomeArquivo(anexo.part.filename)}`;
  fs.writeFileSync(path.join(uploadsDir, nomeArquivo), anexo.buffer);
  return nomeArquivo;
}

// descarte: motivo de nao ser uma NF-e (a linha fica escondida na lista).
export function inserirNota(gmailIdParaLinha, mensagem, campos, extractionSource, xmlArquivo, pdfArquivo, { descarte = null } = {}) {
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
      cnpj_destinatario, nome_destinatario, cidade_destinatario, estado_destinatario,
      ddd_destinatario, telefone_destinatario, peso_bruto, valor_total, data_emissao,
      placa_veiculo, nome_motorista, remetente_id, cliente_id, xml_arquivo, pdf_arquivo,
      status, precisa_revisao, carga_origem, pedido_origem, motivo_descarte, classificada
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
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
    campos.cidadeDestinatario,
    campos.estadoDestinatario,
    campos.dddDestinatario,
    campos.telefoneDestinatario,
    campos.pesoBruto,
    campos.valorTotal,
    campos.dataEmissao,
    campos.placaVeiculo,
    campos.nomeMotorista,
    remetenteMatch ? remetenteMatch.id : null,
    clienteMatch ? clienteMatch.id : null,
    xmlArquivo,
    pdfArquivo,
    descarte ? 'descartada' : 'pendente',
    extractionSource === 'pdf' && !descarte ? 1 : 0,
    campos.cargaOrigem || null,
    campos.pedidoOrigem || null,
    descarte
  );
}

// A NF-e da fabrica chega quando o caminhao esta carregando: se ela cita uma
// carga liberada por romaneio ("Carga:" nas informacoes complementares), liga a
// nota a entrega, registra a coleta e baixa a Ordem de Coleta se completou.
// So devolve a ligacao (nunca lanca) - a nota ja foi gravada de qualquer jeito.
export function ligarNotaAoRomaneio(gmailIdParaLinha) {
  const nota = db.prepare('SELECT id FROM notas_fiscais_email WHERE gmail_message_id = ?').get(gmailIdParaLinha);
  return nota ? registrarColetaPelaNota(nota.id) : { ligada: false };
}

// So NF-e vira nota na lista. Um e-mail pode trazer varias: cada XML de NF-e e
// uma nota; a DANFE em PDF e anexada a nota de mesma chave de acesso (nunca
// duplica). O que nao for nota (boleto, orcamento, CT-e...) fica gravado como
// 'descartada', com o motivo, escondido da lista e recuperavel pela tela.
export async function processarMensagem(gmail, messageId) {
  const jaExiste = db.prepare('SELECT id FROM notas_fiscais_email WHERE gmail_message_id = ?').get(messageId);
  if (jaExiste) return false;

  const { data: mensagem } = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  const anexos = coletarAnexos(mensagem.payload);
  const partesXml = anexos.filter((a) => a.filename.toLowerCase().endsWith('.xml'));
  const partesPdf = anexos.filter((a) => a.filename.toLowerCase().endsWith('.pdf'));

  if (!partesXml.length && !partesPdf.length) {
    // sem XML/PDF (ex: so imagem, ou email sem anexo relevante) - marca lido e ignora, sem gerar linha
    await marcarComoLido(gmail, messageId);
    return false;
  }

  // baixa e classifica tudo antes de gravar, pra poder parear XML e DANFE
  const xmls = [];
  for (const part of partesXml) {
    const buffer = await baixarAnexo(gmail, messageId, part);
    xmls.push({ part, buffer, ...classificarXml(buffer.toString('utf-8')) });
  }
  const pdfs = [];
  for (const part of partesPdf) {
    const buffer = await baixarAnexo(gmail, messageId, part);
    pdfs.push({ part, buffer, ...(await classificarPdf(buffer)) });
  }

  const notasXml = xmls.filter((x) => x.nota);
  for (const pdf of pdfs.filter((p) => p.nota)) {
    const dona = notasXml.find((x) => x.chave === pdf.chave);
    if (!dona) continue;
    dona.pdf ||= pdf;
    pdf.usado = true;
  }
  // DANFE escaneada (sem texto): so da pra saber de quem e quando ha uma unica nota e um unico PDF
  if (notasXml.length === 1 && pdfs.length === 1 && !pdfs[0].usado && pdfs[0].motivo === PDF_SEM_TEXTO) {
    notasXml[0].pdf = pdfs[0];
    pdfs[0].usado = true;
  }

  let indice = 0;
  let mudou = false;
  // A primeira linha do e-mail usa o proprio messageId (mantendo
  // compatibilidade com o dedup existente); as demais ganham um sufixo.
  function proximoGmailId() {
    indice++;
    return indice === 1 ? messageId : `${messageId}#${indice}`;
  }
  const prefixo = () => `${messageId}_${indice + 1}`;

  function gravar(campos, origem, xml, pdf, opcoes) {
    const base = prefixo();
    const xmlArquivo = xml ? gravarAnexo(xml, base) : null;
    const pdfArquivo = pdf?.part ? gravarAnexo(pdf, base) : (pdf?.nomeArquivo || null);
    const gmailIdDaNota = proximoGmailId();
    inserirNota(gmailIdDaNota, mensagem, campos, origem, xmlArquivo, pdfArquivo, opcoes);
    mudou = true;
    if (!opcoes?.descarte) ligarNotaAoRomaneio(gmailIdDaNota);
  }

  function anexarPdf(nota, pdf) {
    if (nota.pdf_arquivo || !pdf) return;
    db.prepare('UPDATE notas_fiscais_email SET pdf_arquivo = ? WHERE id = ?').run(gravarAnexo(pdf, `${messageId}_n${nota.id}`), nota.id);
    mudou = true;
  }

  for (const xml of xmls) {
    const campos = parseNFeXml(xml.buffer.toString('utf-8'));
    if (!xml.nota) {
      gravar(campos, 'xml', xml, null, { descarte: xml.motivo });
      continue;
    }
    const existente = notaComChave(xml.chave);
    if (existente?.extraction_source === 'xml') {
      // a mesma nota reenviada: no maximo completa com a DANFE
      anexarPdf(existente, xml.pdf);
      continue;
    }
    if (existente && existente.status !== 'pendente') {
      // tinha entrado so pelo PDF e ja foi usada: guarda o XML nela
      db.prepare('UPDATE notas_fiscais_email SET xml_arquivo = ? WHERE id = ?').run(gravarAnexo(xml, `${messageId}_n${existente.id}`), existente.id);
      anexarPdf(existente, xml.pdf);
      mudou = true;
      continue;
    }
    if (existente) {
      // o XML substitui a linha que tinha entrado so pelo PDF
      db.prepare("UPDATE notas_fiscais_email SET status = 'descartada', motivo_descarte = 'Substituida pelo XML da mesma nota' WHERE id = ?").run(existente.id);
    }
    gravar(campos, 'xml', xml, xml.pdf || (existente?.pdf_arquivo ? { nomeArquivo: existente.pdf_arquivo } : null));
  }

  for (const pdf of pdfs) {
    if (pdf.usado) continue;
    if (!pdf.nota) {
      gravar(extractFromPdfText(''), 'pdf', null, pdf, { descarte: pdf.motivo });
      continue;
    }
    const existente = notaComChave(pdf.chave);
    if (existente) {
      anexarPdf(existente, pdf);
      continue;
    }
    gravar({ ...extractFromPdfText(pdf.texto), chaveAcesso: pdf.chave }, 'pdf', null, pdf);
  }

  await marcarComoLido(gmail, messageId);
  return mudou;
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
