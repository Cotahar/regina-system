// Gera a DANFE em PDF a partir do XML da NF-e. Mohawk sai no modelo da propria
// fabrica; os demais emitentes no modelo padrao.
import PDFDocument from 'pdfkit';
import { lerNFe } from './lerNFe.js';
import { desenharPadrao } from './layoutPadrao.js';
import { desenharMohawk } from './layoutMohawk.js';

const REMETENTE_MOHAWK = 'oper@mohawkbr.com';

// Pelo emitente que esta no XML (os e-mails chegam encaminhados, entao o
// remetente do e-mail sozinho nao identifica a fabrica) ou pelo remetente.
export function ehMohawk(nf, remetenteEmail) {
  return /^MOHAWK\b/i.test(nf.emitente.nome) || String(remetenteEmail || '').toLowerCase().includes(REMETENTE_MOHAWK);
}

// Devolve { pdf: Buffer, nf } ou null quando o XML nao e uma NF-e (modelo 55).
export function gerarDanfe(xmlTexto, { remetenteEmail } = {}) {
  const nf = lerNFe(xmlTexto);
  if (!nf || nf.modelo !== '55' || !/^\d{44}$/.test(nf.chave)) return Promise.resolve(null);

  const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `DANFE NF-e ${nf.numero} - ${nf.emitente.nome}` } });
  const partes = [];
  const pronto = new Promise((resolver, rejeitar) => {
    doc.on('data', (parte) => partes.push(parte));
    doc.on('end', () => resolver({ pdf: Buffer.concat(partes), nf }));
    doc.on('error', rejeitar);
  });
  (ehMohawk(nf, remetenteEmail) ? desenharMohawk : desenharPadrao)(doc, nf);
  doc.end();
  return pronto;
}
