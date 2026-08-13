import { parseDecimal } from './format.js';

// Formata um numero (ou string numerica) no padrao pt-BR de duas casas -
// mesma formatacao usada no blur da mascara, reaproveitada tambem para
// preencher campos editaveis ja formatados na primeira renderizacao (em vez
// de mostrar o numero cru do banco, tipo "419.7").
export function formatarDecimalParaInput(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  const numero = Number(valor);
  return Number.isNaN(numero) ? '' : numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Mascara de input decimal (pt-BR: virgula como separador). Implementacao unica
// que substitui as 3 versoes divergentes que existiam no sistema antigo
// (script.js, consulta.js e gerenciar_carga.js).
export function aplicarMascaraDecimal(input) {
  input.addEventListener('input', () => {
    let valor = input.value.replace(/[^\d,]/g, '');
    const partes = valor.split(',');
    if (partes.length > 2) {
      valor = `${partes[0]},${partes.slice(1).join('')}`;
    }
    input.value = valor;
  });

  input.addEventListener('blur', () => {
    if (!input.value) return;
    const numero = Number(input.value.replace(',', '.'));
    if (!Number.isNaN(numero)) {
      input.value = numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  });
}

// Calculadora unica de frete por tonelada (cubado-aware - a versao mais completa
// que existia so em montagem.js). Recalcula o Valor do Frete a partir do
// Valor/Tonelada, preferindo o peso cubado quando informado.
export function ligarCalculadoraFretePorTonelada({ pesoBrutoInput, pesoCubadoInput, valorTonInput, valorFreteInput }) {
  const recalcular = () => {
    // parseDecimal (nao um replace ingenuo) porque aplicarMascaraDecimal formata
    // o valor com separador de milhar pt-BR (ex: "1.234,56") no blur.
    const pesoBruto = parseDecimal(pesoBrutoInput.value) || 0;
    const pesoCubado = parseDecimal(pesoCubadoInput.value) || 0;
    const valorTon = parseDecimal(valorTonInput.value) || 0;

    const pesoConsiderado = pesoCubado > pesoBruto ? pesoCubado : pesoBruto;
    if (pesoConsiderado > 0 && valorTon > 0) {
      const freteCalculado = (pesoConsiderado / 1000) * valorTon;
      valorFreteInput.value = freteCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  };

  [pesoBrutoInput, pesoCubadoInput, valorTonInput].forEach((input) => {
    input.addEventListener('blur', recalcular);
  });
}
