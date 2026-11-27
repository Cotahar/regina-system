import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gerarDanfe } from '../danfe/gerarDanfe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Mesma pasta onde a importacao de e-mail grava os anexos das notas.
export const pastaNotas = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads'), 'notas-fiscais');

const caminhoExistente = (arquivo) => {
  if (!arquivo) return null;
  const caminho = path.join(pastaNotas, path.basename(arquivo));
  return fs.existsSync(caminho) ? caminho : null;
};

// Envia o PDF da nota: a DANFE original recebida por e-mail quando existe;
// senao uma DANFE gerada do XML. Devolve false se nao houver nem um nem outro.
export async function enviarPdfDaNota(res, nota) {
  const nomeSeguro = String(nota.numero_nf || nota.id).replace(/[^\w.-]/g, '');
  const cabecalhos = {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="NF-${nomeSeguro}.pdf"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store'
  };

  const original = caminhoExistente(nota.pdf_arquivo);
  if (original) {
    res.sendFile(original, { headers: cabecalhos });
    return true;
  }

  const xml = caminhoExistente(nota.xml_arquivo);
  if (!xml) return false;
  try {
    const gerada = await gerarDanfe(fs.readFileSync(xml, 'utf-8'), { remetenteEmail: nota.remetente_email });
    if (!gerada) return false;
    res.set(cabecalhos).send(gerada.pdf);
    return true;
  } catch (err) {
    console.error(`[notas-fiscais] erro gerando a DANFE da nota ${nota.id}:`, err.message);
    return false;
  }
}
