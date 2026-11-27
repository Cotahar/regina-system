// Code 128 (subconjunto C), o codigo de barras da chave de acesso na DANFE.
// Cada simbolo sao larguras alternadas barra/espaco, em modulos.
const PADROES = (
  '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 ' +
  '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 ' +
  '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 ' +
  '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
  '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 ' +
  '114131 311141 411131 211412 211214 211232 2331112'
).split(' ');

const INICIO_C = 105;
const FIM = 106;

// Devolve as barras (posicao e largura em modulos) e a largura total.
export function barrasCode128C(digitos) {
  if (!/^(\d\d)+$/.test(digitos || '')) throw new Error('Code128C exige uma quantidade par de digitos.');
  const valores = digitos.match(/\d\d/g).map(Number);
  const verificador = valores.reduce((soma, v, i) => soma + v * (i + 1), INICIO_C) % 103;
  const barras = [];
  let posicao = 0;
  for (const simbolo of [INICIO_C, ...valores, verificador, FIM]) {
    [...PADROES[simbolo]].forEach((largura, i) => {
      if (i % 2 === 0) barras.push({ x: posicao, largura: Number(largura) });
      posicao += Number(largura);
    });
  }
  return { barras, largura: posicao };
}

export function desenharCodigoBarras(doc, digitos, x, y, largura, altura) {
  const { barras, largura: modulos } = barrasCode128C(digitos);
  const modulo = largura / modulos;
  doc.save().fillColor('#000');
  for (const b of barras) doc.rect(x + b.x * modulo, y, b.largura * modulo, altura).fill();
  doc.restore();
}
