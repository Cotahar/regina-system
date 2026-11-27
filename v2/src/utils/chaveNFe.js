// Chave de acesso de documento fiscal eletronico (44 digitos):
// cUF(2) AAMM(4) CNPJ(14) modelo(2) serie(3) numero(9) tpEmis(1) cNF(8) DV(1)
// modelo: 55 = NF-e, 65 = NFC-e, 57 = CT-e, 58 = MDF-e.

const UFS = new Set([11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 35, 41, 42, 43, 50, 51, 52, 53]);

function digitoVerificador(base43) {
  let peso = 2;
  let soma = 0;
  for (let i = base43.length - 1; i >= 0; i--) {
    soma += Number(base43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function chaveValida(chave) {
  if (!/^\d{44}$/.test(chave || '')) return false;
  const mes = Number(chave.slice(4, 6));
  if (!UFS.has(Number(chave.slice(0, 2))) || mes < 1 || mes > 12) return false;
  return digitoVerificador(chave.slice(0, 43)) === Number(chave[43]);
}

export const modeloDaChave = (chave) => String(chave || '').slice(20, 22);

// Todas as chaves validas que aparecem num texto (PDF): aceita com ou sem
// espacos/pontos/quebras entre os grupos.
export function chavesNoTexto(texto) {
  const achadas = new Set();
  const blocos = String(texto || '').match(/\d(?:[ \t .\-\r\n]{0,3}\d){43,}/g) || [];
  for (const bloco of blocos) {
    const digitos = bloco.replace(/\D/g, '');
    for (let i = 0; i + 44 <= digitos.length; i++) {
      const candidata = digitos.slice(i, i + 44);
      if (['55', '57', '58', '65'].includes(modeloDaChave(candidata)) && chaveValida(candidata)) achadas.add(candidata);
    }
  }
  return [...achadas];
}

// Decide se o texto de um PDF e a DANFE de uma NF-e. Um DACTE tambem cita as
// chaves das notas que transporta, e uma carta de correcao cita a chave da nota
// que corrige - por isso so a chave nao basta.
export function classificarTextoPdf(texto) {
  const t = String(texto || '');
  if (t.replace(/\s+/g, '').length < 60) return { nota: false, motivo: 'PDF sem texto (imagem ou escaneado)' };

  const chaves = chavesNoTexto(t);
  const chaveNFe = chaves.find((c) => modeloDaChave(c) === '55');

  if (chaves.some((c) => modeloDaChave(c) === '57') || /\bDACTE\b|CONHECIMENTO\s+DE\s+TRANSPORTE\s+ELETR/i.test(t)) {
    return { nota: false, motivo: 'Conhecimento de transporte (CT-e), nao e NF-e' };
  }
  if (chaves.some((c) => modeloDaChave(c) === '58') || /\bDAMDFE\b/i.test(t)) return { nota: false, motivo: 'Manifesto (MDF-e), nao e NF-e' };
  if (/CARTA\s+DE\s+CORRE[CÇ][AÃ]O/i.test(t)) return { nota: false, motivo: 'Carta de correcao, nao e a nota' };
  if (!chaveNFe) return { nota: false, motivo: 'Sem chave de acesso de NF-e' };
  if (!/DANFE|DOCUMENTO\s+AUXILIAR/i.test(t)) return { nota: false, motivo: 'Cita uma NF-e, mas nao e a DANFE' };
  return { nota: true, chave: chaveNFe };
}
