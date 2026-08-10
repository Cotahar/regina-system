export function formatarMoeda(valor) {
  const n = Number(valor) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarPeso(valor) {
  const n = Number(valor) || 0;
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}

export function formatarData(valorIso) {
  if (!valorIso) return '';
  const d = new Date(`${valorIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return valorIso;
  return d.toLocaleDateString('pt-BR');
}

export function formatarDataParaInput(valorIso) {
  if (!valorIso) return '';
  return valorIso.slice(0, 10);
}

export function getHojeFormatado() {
  return new Date().toISOString().slice(0, 10);
}

export function parseDecimal(valorTexto) {
  if (valorTexto === null || valorTexto === undefined || valorTexto === '') return null;
  const semSimbolos = String(valorTexto).replace(/[^\d,.-]/g, '').trim();
  if (!semSimbolos) return null;

  let normalizado;
  if (semSimbolos.includes(',')) {
    // Formato pt-BR digitado pelo usuario: ponto = milhar, virgula = decimal.
    normalizado = semSimbolos.replace(/\./g, '').replace(',', '.');
  } else {
    const ultimoPonto = semSimbolos.lastIndexOf('.');
    const casasAposPonto = ultimoPonto === -1 ? 0 : semSimbolos.length - ultimoPonto - 1;
    // Sem virgula: se o ultimo ponto tem 1-2 casas depois, e um numero puro do JS
    // (ex: "1500.5" vindo de value = numero). Senao, e separador de milhar (ex: "1.500").
    normalizado = ultimoPonto !== -1 && casasAposPonto <= 2 ? semSimbolos : semSimbolos.replace(/\./g, '');
  }

  const n = Number(normalizado);
  return Number.isNaN(n) ? null : n;
}
