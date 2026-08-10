export function decodeUploadedText(buffer) {
  const utf8 = buffer.toString('utf-8');
  const temSubstituicao = (utf8.match(/�/g) || []).length;
  if (temSubstituicao > 2) {
    return buffer.toString('latin1');
  }
  return utf8.replace(/^﻿/, '');
}

export function detectarDelimitador(texto) {
  // Considera o texto inteiro (nao so a 1a linha) - um cabecalho sem
  // delimitador (ex: linha fake prefixada antes de dados colados) nao pode
  // enganar a deteccao do formato usado nas linhas de dados reais.
  const tabs = (texto.match(/\t/g) || []).length;
  if (tabs > 0) return '\t'; // colado do Excel/planilha

  const virgulas = (texto.match(/,/g) || []).length;
  const pontoEVirgulas = (texto.match(/;/g) || []).length;
  return pontoEVirgulas > virgulas ? ';' : ',';
}

export function parseCsv(texto) {
  const delimitador = detectarDelimitador(texto);

  const linhas = [];
  let linhaAtual = [];
  let campo = '';
  let dentroDeAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else { dentroDeAspas = false; }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      dentroDeAspas = true;
    } else if (c === delimitador) {
      linhaAtual.push(campo.trim());
      campo = '';
    } else if (c === '\n') {
      linhaAtual.push(campo.trim());
      linhas.push(linhaAtual);
      linhaAtual = [];
      campo = '';
    } else if (c === '\r') {
      // ignora, \n vem em seguida
    } else {
      campo += c;
    }
  }
  if (campo.length > 0 || linhaAtual.length > 0) {
    linhaAtual.push(campo.trim());
    linhas.push(linhaAtual);
  }

  return linhas.filter((linha) => linha.some((celula) => celula !== ''));
}
