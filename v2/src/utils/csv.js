export function decodeUploadedText(buffer) {
  const utf8 = buffer.toString('utf-8');
  const temSubstituicao = (utf8.match(/�/g) || []).length;
  if (temSubstituicao > 2) {
    return buffer.toString('latin1');
  }
  return utf8.replace(/^﻿/, '');
}

export function detectarDelimitador(primeiraLinha) {
  const virgulas = (primeiraLinha.match(/,/g) || []).length;
  const pontoEVirgulas = (primeiraLinha.match(/;/g) || []).length;
  return pontoEVirgulas > virgulas ? ';' : ',';
}

export function parseCsv(texto) {
  const primeiraLinha = texto.split(/\r?\n/, 1)[0] || '';
  const delimitador = detectarDelimitador(primeiraLinha);

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
