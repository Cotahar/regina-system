import * as XLSX from 'xlsx';

// Assinatura binaria (magic bytes) dos formatos de planilha - checada no
// conteudo, nao na extensao do arquivo. Um <input accept=".csv"> so sugere
// o filtro do seletor de arquivos do navegador, nao impede o usuario de
// escolher "todos os arquivos" ou renomear a extensao pra passar pelo
// filtro - sem essa checagem, um .xls/.xlsx acaba sendo lido como texto CSV
// (decodeUploadedText + parseCsv), o binario vira uma sopa de bytes que por
// acaso batem com virgula/ponto-e-virgula/quebra de linha, e isso gera uma
// enxurrada de linhas "validas" com lixo no lugar de nome/placa.
const ASSINATURA_XLS = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // .xls (CDFV2/OLE)
const ASSINATURA_XLSX = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // .xlsx/.xlsm (zip/OOXML)

function pareceArquivoDeExcel(buffer) {
  if (buffer.length < 8) return false;
  return buffer.subarray(0, 8).equals(ASSINATURA_XLS) || buffer.subarray(0, 4).equals(ASSINATURA_XLSX);
}

function parseXlsx(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const planilha = workbook.Sheets[workbook.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json(planilha, { header: 1, defval: '' });
  return linhas
    .map((linha) => linha.map((celula) => String(celula ?? '').trim()))
    .filter((linha) => linha.some((celula) => celula !== ''));
}

// Ponto de entrada unico pra importacao de planilha: detecta pelo conteudo
// se e um Excel binario (.xls antigo ou .xlsx/.xlsm) e usa o parser certo;
// caso contrario trata como CSV/texto colado, como sempre foi. Retorna
// sempre o mesmo formato (array de linhas, cada linha um array de celulas
// em texto ja aparadas) - quem chama nao precisa saber qual dos dois rolou.
export function parseArquivoImportado(buffer) {
  if (pareceArquivoDeExcel(buffer)) return parseXlsx(buffer);
  return parseCsv(decodeUploadedText(buffer));
}

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
