// Ferramentas comuns aos dois modelos de DANFE: formatacao e desenho em pontos.

export function numero(valor, casas = 2) {
  const n = Number(valor);
  return (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export const numeroOuVazio = (valor, casas = 2) => (valor === '' || valor === undefined || valor === null ? '' : numero(valor, casas));

// "2026-09-18T07:27:00-03:00" -> "18/09/2026" (sem converter fuso: e a data escrita na nota)
export function data(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export const hora = (iso) => (String(iso || '').match(/T(\d{2}:\d{2}:\d{2})/) || [])[1] || '';

export function documento(valor) {
  const d = String(valor || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return String(valor || '');
}

export const cep = (valor) => String(valor || '').replace(/^(\d{5})(\d{3})$/, '$1-$2');

export function telefone(valor) {
  const d = String(valor || '').replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return d;
}

export const chaveEmBlocos = (chave) => String(chave || '').replace(/(\d{4})(?=\d)/g, '$1 ');

// As fontes padrao do PDF so tem os caracteres do Windows-1252.
export function limpar(texto) {
  return String(texto ?? '')
    .replace(/[−‐‑‒]/g, '-')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^ -~ -ÿ–—‘’“”•…€]/g, '?');
}

// Escreve uma linha com a base em y. alinhar: 'left' | 'center' | 'right' em relacao a [x, x+largura].
// Se nao couber na largura, reduz a fonte (ate 70%) e por fim corta com "...".
export function escrever(doc, texto, x, y, { fonte, tamanho, largura, alinhar = 'left', cor = '#000' } = {}) {
  let t = limpar(texto);
  if (!t) return;
  doc.font(fonte).fillColor(cor);
  let corpo = tamanho;
  doc.fontSize(corpo);
  if (largura) {
    const cabe = () => doc.widthOfString(t) <= largura + 0.5;
    if (!cabe()) { corpo = Math.max(tamanho * 0.7, (tamanho * largura) / doc.widthOfString(t)); doc.fontSize(corpo); }
    while (!cabe() && t.length > 3) t = `${t.slice(0, -4)}...`;
  }
  const w = doc.widthOfString(t);
  let px = x;
  if (largura && alinhar === 'center') px = x + (largura - w) / 2;
  if (largura && alinhar === 'right') px = x + largura - w;
  doc.text(t, px, y, { lineBreak: false, baseline: 'alphabetic' });
}

// Quebra um texto em linhas que cabem na largura (corta palavra maior que a linha).
// manterEspacos preserva espacos repetidos (a Mohawk alinha valores com eles).
export function quebrarLinhas(doc, texto, { fonte, tamanho, largura, manterEspacos = false }) {
  doc.font(fonte).fontSize(tamanho);
  const linhas = [];
  let atual = '';
  const palavras = limpar(texto).trim().split(' ');
  for (const palavra of manterEspacos ? palavras : palavras.filter(Boolean)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (doc.widthOfString(tentativa) <= largura) { atual = tentativa; continue; }
    if (atual.trim()) linhas.push(atual.trimEnd());
    atual = palavra;
    while (doc.widthOfString(atual) > largura && atual.length > 1) {
      let corte = atual.length - 1;
      while (corte > 1 && doc.widthOfString(atual.slice(0, corte)) > largura) corte--;
      linhas.push(atual.slice(0, corte));
      atual = atual.slice(corte);
    }
  }
  if (atual.trim()) linhas.push(atual.trimEnd());
  return linhas;
}

export function linha(doc, x1, y1, x2, y2, espessura) {
  doc.save().lineWidth(espessura).strokeColor('#000').moveTo(x1, y1).lineTo(x2, y2).stroke().restore();
}

export function retangulo(doc, x0, y0, x1, y1, espessura, raio = 0) {
  doc.save().lineWidth(espessura).strokeColor('#000');
  if (raio) doc.roundedRect(x0, y0, x1 - x0, y1 - y0, raio); else doc.rect(x0, y0, x1 - x0, y1 - y0);
  doc.stroke().restore();
}

// Reparte as linhas de cada item em paginas: um item so e partido entre paginas
// se sozinho nao couber em uma pagina inteira.
export function paginarItens(blocos, capacidadePrimeira, capacidadeDemais) {
  const paginas = [[]];
  let usado = 0;
  const capacidade = () => (paginas.length === 1 ? capacidadePrimeira : capacidadeDemais);
  const nova = () => { paginas.push([]); usado = 0; };
  for (const bloco of blocos) {
    if (bloco.linhas <= capacidadeDemais && usado + bloco.linhas > capacidade()) nova();
    let inicio = 0;
    while (inicio < bloco.linhas) {
      if (usado >= capacidade()) nova();
      const cabem = Math.min(bloco.linhas - inicio, capacidade() - usado);
      paginas[paginas.length - 1].push({ bloco, inicio, fim: inicio + cabem });
      usado += cabem;
      inicio += cabem;
    }
  }
  return paginas;
}
