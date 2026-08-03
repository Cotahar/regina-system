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
  const normalizado = semSimbolos.replace(/\./g, '').replace(',', '.');
  const n = Number(normalizado);
  return Number.isNaN(n) ? null : n;
}
