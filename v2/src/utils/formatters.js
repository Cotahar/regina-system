export function formatarPesoServidor(valor) {
  const n = Number(valor) || 0;
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}

export function formatarMoedaServidor(valor) {
  const n = Number(valor) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarDataServidor(valorIso) {
  if (!valorIso) return '';
  const d = new Date(valorIso);
  if (Number.isNaN(d.getTime())) return valorIso;
  return d.toLocaleDateString('pt-BR');
}
