// So NF-e (modelo 55) aparece na lista de notas. O que nao for fica como
// 'descartada' (escondida, com o motivo) e pode ser restaurada pela tela.
import fs from 'node:fs';
import { db } from '../db/connection.js';
import { lerNFe } from '../danfe/lerNFe.js';
import { classificarTextoPdf } from '../utils/chaveNFe.js';
import { extrairTextoPdf } from './nfe.service.js';
import { pastaNotas } from './notaPdf.service.js';
import { notificarMudanca } from './eventos.js';
import path from 'node:path';

export const PDF_SEM_TEXTO = 'PDF sem texto (imagem ou escaneado)';

export function classificarXml(texto) {
  const t = String(texto || '');
  const nao = (motivo) => ({ nota: false, motivo });
  if (/<(\w+:)?procEventoNFe[\s>]|<(\w+:)?envEvento[\s>]/.test(t)) return nao('Evento de NF-e (cancelamento ou carta de correcao), nao e a nota');
  if (/<(\w+:)?(cteProc|CTe|procEventoCTe|cteOSProc)[\s>]/.test(t)) return nao('Conhecimento de transporte (CT-e), nao e NF-e');
  if (/<(\w+:)?(mdfeProc|MDFe|procEventoMDFe)[\s>]/.test(t)) return nao('Manifesto (MDF-e), nao e NF-e');
  const nf = lerNFe(t);
  if (!nf) return nao('XML que nao e uma NF-e');
  if (nf.modelo === '65') return nao('Cupom fiscal (NFC-e), nao e NF-e de carga');
  if (nf.modelo !== '55' || !/^\d{44}$/.test(nf.chave)) return nao('XML que nao e uma NF-e');
  return { nota: true, chave: nf.chave };
}

export async function classificarPdf(buffer) {
  let texto = '';
  try {
    texto = await extrairTextoPdf(buffer);
  } catch {
    return { nota: false, motivo: 'PDF que nao abre (corrompido ou com senha)' };
  }
  return { ...classificarTextoPdf(texto), texto };
}

// Nota ja registrada com a mesma chave de acesso (ignora as descartadas).
export function notaComChave(chave, excetoId = 0) {
  if (!chave) return null;
  return db.prepare("SELECT * FROM notas_fiscais_email WHERE chave_acesso = ? AND status != 'descartada' AND id != ? ORDER BY (extraction_source = 'xml') DESC, id LIMIT 1")
    .get(chave, excetoId) || null;
}

const descartar = (id, motivo) => db.prepare("UPDATE notas_fiscais_email SET status = 'descartada', motivo_descarte = ? WHERE id = ?").run(motivo, id);
const marcarClassificada = (id) => db.prepare('UPDATE notas_fiscais_email SET classificada = 1 WHERE id = ?').run(id);

// Aplica a mesma regra uma unica vez no que ja estava na lista antes do filtro:
// so notas pendentes e sem vinculo (o que a equipe ja usou nao e mexido).
export async function reclassificarPendentes() {
  const linhas = db.prepare(`
    SELECT id, extraction_source, xml_arquivo, pdf_arquivo FROM notas_fiscais_email
    WHERE classificada = 0 AND status = 'pendente' AND entrega_id IS NULL
    ORDER BY (extraction_source = 'pdf'), id
  `).all();
  const resumo = { analisadas: 0, descartadas: 0 };

  for (const linha of linhas) {
    const arquivo = linha.extraction_source === 'xml' ? linha.xml_arquivo : linha.pdf_arquivo;
    const caminho = arquivo ? path.join(pastaNotas, path.basename(arquivo)) : null;
    // sem o arquivo nao da pra julgar: deixa como esta
    if (!caminho || !fs.existsSync(caminho)) continue;
    try {
      const resultado = linha.extraction_source === 'xml'
        ? classificarXml(fs.readFileSync(caminho, 'utf-8'))
        : await classificarPdf(fs.readFileSync(caminho));
      resumo.analisadas++;
      if (!resultado.nota) {
        descartar(linha.id, resultado.motivo);
        resumo.descartadas++;
      } else if (linha.extraction_source === 'pdf') {
        const existente = notaComChave(resultado.chave, linha.id);
        // entre dois PDFs da mesma nota, fica o primeiro
        if (existente && (existente.extraction_source === 'xml' || existente.id < linha.id)) {
          if (!existente.pdf_arquivo) db.prepare('UPDATE notas_fiscais_email SET pdf_arquivo = ? WHERE id = ?').run(linha.pdf_arquivo, existente.id);
          descartar(linha.id, 'Repetida: DANFE de uma nota ja recebida');
          resumo.descartadas++;
        } else {
          db.prepare('UPDATE notas_fiscais_email SET chave_acesso = ? WHERE id = ?').run(resultado.chave, linha.id);
        }
      }
      marcarClassificada(linha.id);
    } catch (err) {
      console.error(`[notas-fiscais] nao foi possivel classificar a nota ${linha.id}:`, err.message);
    }
  }

  if (resumo.descartadas) notificarMudanca('notas_fiscais');
  return resumo;
}
