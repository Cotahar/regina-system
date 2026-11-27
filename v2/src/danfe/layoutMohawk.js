// DANFE no modelo da Mohawk (Courier), igual ao PDF que a propria fabrica emite.
// Medidas em pontos, tiradas do documento de referencia.
import { numero, data, documento, cep, telefone, chaveEmBlocos, escrever as escreverTexto, quebrarLinhas, linha, retangulo, paginarItens } from './desenho.js';
import { desenharCodigoBarras } from './codigoBarras.js';
import { LOGO_ELIANE } from './logoEliane.js';

const C = 'Courier';
const B = 'Courier-Bold';
const PASSO_ITEM = 8;
const VERMELHO = '#d00000';
// Os corpos abaixo sao os nominais; o documento da fabrica usa 95% deles (6 -> 5,7pt; 8 -> 7,6pt).
const ESCALA = 0.95;
const escrever = (doc, texto, x, y, opcoes) => escreverTexto(doc, texto, x, y, { ...opcoes, tamanho: opcoes.tamanho * ESCALA });

// Codigo de filial que a Mohawk imprime no canhoto (nao vem no XML; so os
// conferidos em DANFE da propria fabrica).
const FILIAL = { '13786785000111': '13/01', '02357659000125': '42/01' };

const numeroNota = (n) => Number(n).toLocaleString('pt-BR');
const enderecoMohawk = (p) => [p.logradouro, '', p.numero].join(',');
const caixa = (doc, x0, y0, x1, y1) => retangulo(doc, x0, y0, x1, y1, 1);

const rotulo = (doc, texto, x, y, tamanho = 6) => escrever(doc, texto, x, y, { fonte: B, tamanho });
const titulo = (doc, texto, y) => escrever(doc, texto, 19, y, { fonte: B, tamanho: 7 });
const valor = (doc, texto, x, y, largura, tamanho = 8) => escrever(doc, texto, x, y, { fonte: C, tamanho, largura });

// Caixa com rotulo em cima e valor embaixo (posicoes relativas ao topo da caixa).
function campo(doc, x0, y0, x1, y1, nome, conteudo, { recuo = 2.8 } = {}) {
  caixa(doc, x0, y0, x1, y1);
  escrever(doc, nome, x0 + recuo, y0 + 6, { fonte: B, tamanho: 6, largura: x1 - x0 - recuo - 0.8 });
  valor(doc, conteudo, x0 + recuo, y1 - 3, x1 - x0 - recuo - 1.5);
}

function canhoto(doc, nf) {
  caixa(doc, 19, 18, 475, 59);
  caixa(doc, 479.8, 18, 571.9, 59);
  linha(doc, 19, 32, 475, 32, 1);
  [90.3, 283.1, 387.6].forEach((x) => linha(doc, x, 32, x, 59, 1));
  escrever(doc, `RECEBEMOS DA ${nf.emitente.nome} OS PRODUTOS E/OU SERVICOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO`, 20.9, 24, { fonte: B, tamanho: 5, largura: 452 });
  escrever(doc, 'Atesto que se houver qualquer divergencia (quantidade, estado de conservacao, especificacoes, etc..), estarao anotadas no verso deste canhoto.', 20.9, 30, { fonte: B, tamanho: 5, largura: 452 });
  rotulo(doc, 'DATA DE RECEBIMENTO', 20.9, 41);
  rotulo(doc, 'IDENTIFICACAO (Nome Completo)', 93.1, 41);
  rotulo(doc, 'Assinatura', 285, 41);
  rotulo(doc, 'RG ou CPF', 389.5, 41);
  const filial = FILIAL[nf.emitente.documento];
  escrever(doc, filial ? `NF-e Fil: ${filial}` : 'NF-e', 484.5, 29, { fonte: B, tamanho: 9, largura: 86 });
  escrever(doc, `No: ${numeroNota(nf.numero)}`, 499.9, 43, { fonte: B, tamanho: 9, largura: 71 });
  escrever(doc, `SERIE: ${nf.serie}`, 484.5, 54, { fonte: B, tamanho: 9, largura: 86 });
  escrever(doc, '-'.repeat(115), 33.2, 67, { fonte: B, tamanho: 8, largura: 538 });
}

// Marca no topo: o logo quando a nota e Eliane; nas demais marcas, o nome dela.
function marca(doc, nf) {
  const nomeMarca = nf.transporte.volumes.map((v) => v.marca).find(Boolean) || '';
  if (/ELIANE/i.test(nomeMarca) || !nomeMarca) {
    doc.save().translate(58, 80);
    doc.path(LOGO_ELIANE.caminho).fill(LOGO_ELIANE.cor, LOGO_ELIANE.regra);
    doc.restore();
  } else {
    escrever(doc, nomeMarca, 22, 103, { fonte: 'Helvetica-Bold', tamanho: 22, largura: 175, alinhar: 'center', cor: LOGO_ELIANE.cor });
  }
}

function identificacao(doc, nf, folha, folhas) {
  const e = nf.emitente;
  caixa(doc, 19, 70, 199.5, 192);
  caixa(doc, 199.5, 70, 294.5, 192);
  marca(doc, nf);
  const linhasEmitente = [
    e.nome, enderecoMohawk(e), [e.bairro, e.municipio].filter(Boolean).join(', '), `${e.uf} - ${cep(e.cep)}`,
    `Fone: ${telefone(e.fone)}`, `Fax: ${telefone(e.fone)}`
  ];
  linhasEmitente.forEach((t, i) => escrever(doc, t, 21.8, 132 + i * 10, { fonte: B, tamanho: 7, largura: 175 }));

  escrever(doc, 'DANFE', 199.5, 92, { fonte: B, tamanho: 12, largura: 95, alinhar: 'center' });
  [['DOCUMENTO AUXILIAR', 107], ['DA NOTA FISCAL', 117], ['ELETRONICA', 127]].forEach(([t, y]) => escrever(doc, t, 199.5, y, { fonte: C, tamanho: 8, largura: 95, alinhar: 'center' }));
  escrever(doc, '0 - ENTRADA', 204.2, 142, { fonte: C, tamanho: 8 });
  escrever(doc, '1 - SAIDA', 204.2, 154, { fonte: C, tamanho: 8 });
  caixa(doc, 258.4, 139, 272.7, 154);
  escrever(doc, nf.tipo, 262.2, 150, { fonte: B, tamanho: 8 });
  escrever(doc, 'No.', 204.2, 167, { fonte: B, tamanho: 7 });
  escrever(doc, ':', 224.2, 167, { fonte: B, tamanho: 7 });
  escrever(doc, numeroNota(nf.numero), 232.2, 167, { fonte: B, tamanho: 7 });
  escrever(doc, 'SERIE:', 204.2, 177, { fonte: B, tamanho: 7 });
  escrever(doc, nf.serie, 232.2, 177, { fonte: B, tamanho: 7 });
  escrever(doc, 'FOLHA:', 204.2, 187, { fonte: B, tamanho: 7 });
  escrever(doc, `${String(folha).padStart(2, '0')}/${String(folhas).padStart(2, '0')}`, 232.2, 187, { fonte: B, tamanho: 7 });

  caixa(doc, 296.4, 70, 571, 232);
  [132, 157, 210].forEach((y) => linha(doc, 296.4, y, 571, y, 1));
  if (nf.autorizada) {
    desenharCodigoBarras(doc, nf.chave, 327.6, 78.8, 217.9, 43.2);
  } else {
    escrever(doc, '- DANFE SEM VALIDADE FISCAL -', 300, 105, { fonte: B, tamanho: 13, largura: 267, alinhar: 'center', cor: VERMELHO });
  }
  rotulo(doc, 'CHAVE DE ACESSO DA NFE', 299.2, 140);
  escrever(doc, chaveEmBlocos(nf.chave), 318.2, 152, { fonte: B, tamanho: 8, largura: 249 });
  if (nf.autorizada) {
    escrever(doc, 'Consulta autenticidade no portal nacional da NF-e', 296.4, 182, { fonte: B, tamanho: 8, largura: 274.6, alinhar: 'center' });
    escrever(doc, 'www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora', 296.4, 192, { fonte: B, tamanho: 7, largura: 274.6, alinhar: 'center' });
  } else {
    escrever(doc, 'XML sem autorizacao de uso da Sefaz', 296.4, 187, { fonte: B, tamanho: 8, largura: 274.6, alinhar: 'center', cor: VERMELHO });
  }
  rotulo(doc, 'Protocolo de Autorizacao de Uso', 299.2, 218);
  if (nf.autorizada) {
    const m = String(nf.autorizadaEm).match(/^\d{2}(\d{2})-(\d{2})-(\d{2})T(.*)$/);
    const quando = m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : nf.autorizadaEm;
    escrever(doc, `${nf.protocolo} ${quando}`, 296.4, 227, { fonte: B, tamanho: 8, largura: 274.6, alinhar: 'center' });
  }

  caixa(doc, 19, 194, 294.5, 212);
  rotulo(doc, 'NATUREZA DA OPERACAO', 23.7, 200);
  valor(doc, nf.natureza, 23.7, 210, 268);
  campo(doc, 19, 214, 109.3, 232, 'INSCRICAO ESTADUAL', e.ie, { recuo: 4.7 });
  campo(doc, 111.2, 214, 201.4, 232, 'INSC.ESTADUAL SUB.TRIBUT.', e.iest);
  campo(doc, 203.3, 214, 294.5, 232, 'CNPJ', documento(e.documento), { recuo: 5.7 });
}

function destinatario(doc, nf) {
  const d = nf.destinatario;
  titulo(doc, 'DESTINATARIO / REMETENTE', 242);
  campo(doc, 19, 244, 361, 262, 'NOME / RAZAO SOCIAL', d.nome, { recuo: 4.7 });
  campo(doc, 362.9, 244, 462.7, 262, 'CNPJ / CPF', documento(d.documento));
  campo(doc, 464.6, 244, 571, 262, 'DATA DE EMISSAO', data(nf.emissao));
  campo(doc, 19, 264, 266, 282, 'ENDERECO', enderecoMohawk(d), { recuo: 4.7 });
  campo(doc, 268.9, 264, 365.8, 282, 'BAIRRO / DESTRITO', d.bairro, { recuo: 1.8 });
  campo(doc, 367.7, 264, 462.7, 282, 'CEP', cep(d.cep));
  campo(doc, 464.6, 264, 571, 282, 'DATA ENTRADA/SAIDA', data(nf.saida));
  campo(doc, 19, 284, 209, 302, 'MUNICIPIO', d.municipio, { recuo: 4.7 });
  campo(doc, 210.9, 284, 305.9, 302, 'FONE / FAX', telefone(d.fone));
  campo(doc, 307.8, 284, 365.8, 302, 'UF', d.uf);
  campo(doc, 367.7, 284, 462.7, 302, 'INSCRICAO ESTADUAL', d.ie);
  campo(doc, 464.6, 284, 571, 302, 'HORA ENTRADA/SAIDA', nf.horaSaida || (nf.saida.split('T')[1] || '').slice(0, 8));
}

function faturas(doc, nf) {
  titulo(doc, 'FATURA / DUPLICATA', 310);
  caixa(doc, 19, 312, 570, 334);
  [150.1, 287.9, 427.5].forEach((x) => linha(doc, x, 312, x, 334, 1));
  const colunas = [[21.8, 59.8, 148.7], [153.9, 191.9, 286.4], [291.6, 329.7, 425.9], [431.3, 469.3, 568.9]];
  colunas.forEach(([a, b, c]) => {
    escrever(doc, 'Numero', a, 317, { fonte: B, tamanho: 5 });
    escrever(doc, 'Vencimento', b, 317, { fonte: B, tamanho: 5 });
    escrever(doc, 'Valor', c - 30, 317, { fonte: B, tamanho: 5, largura: 30, alinhar: 'right' });
  });
  // ate 8 em duas linhas (como a fabrica); mais que isso, em tres linhas menores
  const porColuna = nf.duplicatas.length > 8 ? 3 : 2;
  const [passo, tamanho, inicio] = porColuna === 2 ? [7, 6, 325] : [4.8, 4.5, 322.5];
  nf.duplicatas.slice(0, porColuna * 4).forEach((d, i) => {
    const [a, b, c] = colunas[Math.floor(i / porColuna)];
    const y = inicio + (i % porColuna) * passo;
    escrever(doc, d.numero, a, y, { fonte: C, tamanho });
    escrever(doc, data(d.vencimento), b, y, { fonte: C, tamanho });
    escrever(doc, numero(d.valor), c - 50, y, { fonte: C, tamanho, largura: 50, alinhar: 'right' });
  });
}

function impostosETransporte(doc, nf) {
  const t = nf.totais;
  titulo(doc, 'CALCULO DO IMPOSTO', 342);
  campo(doc, 19, 344, 125.4, 362, 'BASE DE CALCULO DO ICMS', numero(t.vBC), { recuo: 4.7 });
  campo(doc, 127.3, 344, 233.7, 362, 'VALOR DO ICMS', numero(t.vICMS), { recuo: 0.9 });
  campo(doc, 235.6, 344, 342, 362, 'BASE DE CALCULO ICMS ST', numero(t.vBCST), { recuo: 1.9 });
  campo(doc, 343.9, 344, 450.3, 362, 'VALOR DO ICMS ST', numero(t.vST));
  campo(doc, 452.2, 344, 570, 362, 'VALOR TOTAL DOS PRODUTOS', numero(t.vProd), { recuo: 1.9 });
  campo(doc, 19, 364, 109.3, 382, 'VALOR DO FRETE', numero(t.vFrete), { recuo: 4.7 });
  campo(doc, 111.2, 364, 200.5, 382, 'VALOR DO SEGURO', numero(t.vSeg), { recuo: 1.8 });
  campo(doc, 202.4, 364, 291.7, 382, 'DESCONTO', numero(t.vDesc), { recuo: 1.8 });
  campo(doc, 293.6, 364, 383.8, 382, 'OUT. DESPESAS ACESS.', numero(t.vOutro));
  campo(doc, 385.7, 364, 475, 382, 'VALOR TOTAL DO IPI', numero(t.vIPI));
  campo(doc, 476.9, 364, 570, 382, 'VALOR TOTAL DA NOTA', numero(t.vNF));

  const tr = nf.transporte;
  const vol = tr.volumes;
  const soma = (k) => vol.reduce((a, v) => a + (Number(v[k]) || 0), 0);
  const juntar = (k) => [...new Set(vol.map((v) => v[k]).filter(Boolean))].join(' / ');

  titulo(doc, 'TRANSPORTADOR / VOLUMES TRANSPORTADOS', 390);
  caixa(doc, 19, 393, 209, 416);
  rotulo(doc, 'NOME / RAZAO SOCIAL', 23.7, 400);
  valor(doc, tr.nome, 23.7, 406, 183, 7);
  caixa(doc, 210.9, 393, 267.9, 436);
  rotulo(doc, 'FRETE POR CONTA', 213.7, 400);
  ['0 - EMITENTE', '1 - DESTINATARIO', '2 - TERCEIROS', '9 - SEM FRETE'].forEach((s, i) => escrever(doc, s, 213.7, 410 + i * 7, { fonte: C, tamanho: 5 }));
  caixa(doc, 256.5, 402, 266, 410);
  escrever(doc, tr.modalidade, 256.5, 409, { fonte: B, tamanho: 8, largura: 9.5, alinhar: 'center' });
  campo(doc, 269.8, 393, 326.8, 416, 'CODIGO ANTT', tr.antt);
  campo(doc, 328.7, 393, 414.2, 416, 'PLACA VEICULO', tr.placa);
  campo(doc, 416.1, 393, 454.1, 416, 'UF', tr.placaUf || tr.uf, { recuo: 1.9 });
  campo(doc, 456, 393, 570, 416, 'CNPJ/CPF', documento(tr.documento));
  campo(doc, 19, 418, 209, 436, 'ENDERECO', tr.endereco, { recuo: 4.7 });
  campo(doc, 269.8, 418, 414.2, 436, 'MUNICIPIO', tr.municipio);
  campo(doc, 416.1, 418, 454.1, 436, 'UF', tr.uf, { recuo: 1.9 });
  campo(doc, 456, 418, 570, 436, 'INSCRICAO ESTADUAL', tr.ie, { recuo: 1.9 });
  campo(doc, 19, 438, 109.3, 456, 'QUANTIDADE', soma('quantidade') ? String(soma('quantidade')) : '', { recuo: 4.7 });
  campo(doc, 111.2, 438, 200.5, 456, 'ESPECIE', juntar('especie'));
  campo(doc, 202.4, 438, 291.7, 456, 'MARCA', juntar('marca'), { recuo: 3.7 });
  campo(doc, 293.6, 438, 383.8, 456, 'NUMERO', juntar('numeracao'));
  campo(doc, 385.7, 438, 475, 456, 'PESO BRUTO', soma('pesoBruto') ? numero(soma('pesoBruto')) : '');
  campo(doc, 476.9, 438, 570, 456, 'PESO LIQUIDO', soma('pesoLiquido') ? numero(soma('pesoLiquido')) : '');
}

const COL = [19, 47.5, 199.5, 229.9, 244.2, 263.2, 274.6, 317.3, 360.1, 402.8, 445.6, 483.6, 521.6, 546.3, 570];

function tabelaItens(doc, yTitulo, yFim, pedacos) {
  titulo(doc, 'DADOS DOS PRODUTOS / SERVICOS', yTitulo);
  const topo = yTitulo + 2;
  const corpo = topo + 12;
  caixa(doc, COL[0], topo, COL[COL.length - 1], yFim);
  linha(doc, COL[0], corpo, COL[COL.length - 1], corpo, 1);
  COL.slice(1, -1).forEach((x) => linha(doc, x, topo, x, yFim, 1));
  escrever(doc, 'COD.PROD', 19.9, topo + 8, { fonte: B, tamanho: 6, largura: 27 });
  [['DESCRICAO DOS PRODUTOS / SERVICOS', 50.3], ['NCM', 211.9], ['CST', 231.8], ['CFOP', 247], ['UM', 265.1]].forEach(([t, x]) => rotulo(doc, t, x, topo + 8));
  // titulos das colunas numericas, centrados na coluna
  ['QUANTIDADE', 'VL.UNITARIO', 'VALOR TOTAL', 'B.CALC.ICMS', 'VALOR ICMS', 'VALOR IPI', '%ICMS', '%IPI']
    .forEach((t, i) => escrever(doc, t, COL[i + 6] + 1, topo + 8, { fonte: B, tamanho: 6, largura: COL[i + 7] - COL[i + 6] - 2, alinhar: 'center' }));

  let n = 0;
  for (const { bloco, inicio, fim } of pedacos) {
    const { item, descricao } = bloco;
    for (let k = inicio; k < fim; k++, n++) {
      const y = corpo + 8 + n * PASSO_ITEM;
      const esq = (t, x, largura, tamanho = 6) => escrever(doc, t, x, y, { fonte: C, tamanho, largura });
      const dir = (i, t) => escrever(doc, t, COL[i] + 1, y, { fonte: C, tamanho: 6, largura: COL[i + 1] - COL[i] - 3.6, alinhar: 'right' });
      if (k === 0) esq(item.codigo, 21.8, 27);
      esq(descricao[k], 50.3, 148);
      // como a fabrica imprime: os numeros saem na ultima linha da descricao
      if (k !== descricao.length - 1) continue;
      esq(item.ncm, 201.4, 29);
      esq(`${item.origem} ${item.cst}`, 231.8, 14, 5);
      esq(item.cfop, 247, 16);
      esq(item.unidade, 265, 10);
      dir(6, numero(item.quantidade));
      dir(7, numero(item.valorUnitario));
      dir(8, numero(item.valorTotal));
      dir(9, numero(item.baseIcms));
      dir(10, numero(item.valorIcms));
      dir(11, numero(item.valorIpi));
      dir(12, numero(item.aliquotaIcms));
      dir(13, numero(item.aliquotaIpi));
    }
  }
}

function issqn(doc, nf) {
  titulo(doc, 'CALCULO DO ISSQN', 659);
  const caixas = [[19, 152, 'INSCRICAO MUNICIPAL', nf.emitente.im, 19.9], [153.9, 286.9, 'VALOR TOTAL DOS SERVICOS', numero(nf.issqn.servicos), 155.8],
    [288.8, 429.4, 'BASE DE CALCULO DO ISSQN', numero(nf.issqn.base), 290.7], [431.3, 570, 'VALOR DO ISSQN', numero(nf.issqn.valor), 434.1]];
  caixas.forEach(([x0, x1, nome, v, tx]) => {
    caixa(doc, x0, 661, x1, 679);
    rotulo(doc, nome, tx, 668);
    valor(doc, v, tx + 1.8, 677, x1 - tx - 4);
  });
}

function dadosAdicionais(doc, linhas, fisco) {
  titulo(doc, 'DADOS ADICIONAIS', 692);
  caixa(doc, 19, 695, 400.9, 827);
  caixa(doc, 403.8, 695, 570, 827);
  rotulo(doc, 'INFORMACOES COMPLEMENTARES', 20.9, 702);
  rotulo(doc, 'RESERVADO AO FISCO', 406.6, 702);
  linhas.forEach((t, i) => escrever(doc, t, 20.6, 710 + i * 6, { fonte: C, tamanho: 6 }));
  quebrarLinhas(doc, fisco, { fonte: C, tamanho: 6 * ESCALA, largura: 162 }).slice(0, 19)
    .forEach((t, i) => escrever(doc, t, 406.6, 710 + i * 6, { fonte: C, tamanho: 6 }));
}

export function desenharMohawk(doc, nf) {
  const blocos = nf.itens.map((item) => {
    const descricao = quebrarLinhas(doc, [item.descricao, item.adicional].filter(Boolean).join(' '), { fonte: C, tamanho: 6 * ESCALA, largura: 144.5 });
    if (!descricao.length) descricao.push('');
    return { item, descricao, linhas: descricao.length };
  });
  // a fabrica abre uma linha nova a cada "#" das informacoes complementares
  const complementares = nf.complementares.split(/(?=#)/)
    .flatMap((trecho) => quebrarLinhas(doc, trecho, { fonte: C, tamanho: 6 * ESCALA, largura: 378, manterEspacos: true }));
  const MAX_INFO = 19;
  const sobra = complementares.slice(MAX_INFO);

  const capacidade = (topo, fim) => Math.floor((fim - (topo + 14) - 4) / PASSO_ITEM);
  const paginas = paginarItens(blocos, capacidade(464 + 2, 650), capacidade(244, 827));
  if (sobra.length && paginas.length === 1) paginas.push([]);
  const folhas = paginas.length;

  paginas.forEach((pedacos, p) => {
    if (p > 0) doc.addPage();
    identificacao(doc, nf, p + 1, folhas);
    if (p === 0) {
      canhoto(doc, nf);
      destinatario(doc, nf);
      faturas(doc, nf);
      impostosETransporte(doc, nf);
      tabelaItens(doc, 464, 650, pedacos);
      issqn(doc, nf);
      dadosAdicionais(doc, complementares.slice(0, MAX_INFO), nf.fisco);
    } else {
      const ultimaComSobra = sobra.length && p === folhas - 1;
      const fim = ultimaComSobra ? 827 - (sobra.length * 6 + 24) : 827;
      tabelaItens(doc, 242, fim, pedacos);
      if (ultimaComSobra) {
        titulo(doc, 'DADOS ADICIONAIS (CONTINUACAO)', fim + 10);
        caixa(doc, 19, fim + 13, 570, 827);
        sobra.forEach((t, i) => escrever(doc, t, 21.8, fim + 22 + i * 6, { fonte: C, tamanho: 6 }));
      }
    }
  });
}
