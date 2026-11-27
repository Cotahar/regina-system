// DANFE no modelo padrao (referencia: DANFE retrato A4 em Times). Medidas em pontos.
import {
  numero, numeroOuVazio, data, hora, documento, cep, chaveEmBlocos, escrever, quebrarLinhas, linha, retangulo, paginarItens
} from './desenho.js';
import { desenharCodigoBarras } from './codigoBarras.js';

const R = 'Times-Roman';
const B = 'Times-Bold';
const I = 'Times-Italic';
const FIM_PAGINA = 830.5;
const PASSO_ITEM = 8.4;

const MODALIDADE_FRETE = { 0: '0-Emitente', 1: '1-Destinatário', 2: '2-Terceiros', 3: '3-Próprio Remet.', 4: '4-Próprio Destin.', 9: '9-Sem Transporte' };
const FORMA_PAGAMENTO = {
  '01': 'Dinheiro', '02': 'Cheque', '03': 'Cartão Crédito', '04': 'Cartão Débito', '05': 'Crédito Loja', 10: 'Vale Alimentação',
  11: 'Vale Refeição', 12: 'Vale Presente', 13: 'Vale Combustível', 14: 'Duplicata', 15: 'Boleto', 16: 'Depósito', 17: 'PIX',
  18: 'Transferência', 19: 'Fidelidade', 90: 'Sem pagamento', 99: 'Outros'
};

// colunas da tabela de produtos: limites verticais
const COL = [5.7, 59.5, 206.9, 240.9, 269.3, 292, 309, 354.3, 388.4, 422.4, 450.7, 484.7, 518.7, 547.1, 569.8, 589.6];
const CABECALHO_ITENS = [
  ['CÓDIGO PRODUTO'], ['DESCRIÇÃO DO PRODUTO / SERVIÇO'], ['NCM/SH'], ['O/CST'], ['CFOP'], ['UN'], ['QUANT'], ['VALOR', 'UNIT'],
  ['VALOR', 'TOTAL'], ['VALOR', 'DESC'], ['B.CÁLC', 'ICMS'], ['VALOR', 'ICMS'], ['VALOR', 'IPI'], ['ALÍQ.', 'ICMS'], ['ALÍQ.', 'IPI']
];

const numeroNota = (n) => String(n).padStart(9, '0').replace(/(\d{3})(?=\d)/g, '$1.');
const serie = (s) => String(s).padStart(3, '0');
const enderecoCurto = (p) => [p.logradouro, p.numero].filter(Boolean).join(', ');

const caixa = (doc, x0, y0, x1, y1) => retangulo(doc, x0, y0, x1, y1, 0.3, 2.3);

function campo(doc, x0, y0, x1, y1, rotulo, valor, { alinhar = 'center', rotuloTam = 6, valorTam = 10 } = {}) {
  caixa(doc, x0, y0, x1, y1);
  escrever(doc, rotulo, x0 + 1.4, y0 + 6, { fonte: R, tamanho: rotuloTam, largura: x1 - x0 - 2.8 });
  escrever(doc, valor, x0 + 1.4, y1 - 1.5, { fonte: B, tamanho: valorTam, largura: x1 - x0 - 2.8, alinhar });
}

const titulo = (doc, texto, y) => escrever(doc, texto, 7.1, y, { fonte: B, tamanho: 7 });

function canhoto(doc, nf) {
  const d = nf.destinatario;
  caixa(doc, 5.7, 5.7, 479.1, 34);
  caixa(doc, 479.1, 5.7, 589.6, 56.7);
  caixa(doc, 5.7, 34, 104.9, 56.7);
  caixa(doc, 104.9, 34, 479.1, 56.7);
  const texto = `RECEBEMOS DE ${nf.emitente.nome} OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA ABAIXO. `
    + `EMISSÃO: ${data(nf.emissao)} VALOR TOTAL: R$ ${numero(nf.totais.vNF)} DESTINATÁRIO: ${d.nome} - ${enderecoCurto(d)} ${d.bairro} ${d.municipio}-${d.uf}`;
  quebrarLinhas(doc, texto, { fonte: R, tamanho: 7, largura: 468 }).slice(0, 3)
    .forEach((t, i) => escrever(doc, t, 7.1, 16.3 + i * 7, { fonte: R, tamanho: 7 }));
  escrever(doc, 'NF-e', 479.1, 19.7, { fonte: B, tamanho: 14, largura: 110.5, alinhar: 'center' });
  escrever(doc, `Nº. ${numeroNota(nf.numero)}`, 479.1, 36.2, { fonte: B, tamanho: 10, largura: 110.5, alinhar: 'center' });
  escrever(doc, `Série ${serie(nf.serie)}`, 479.1, 46.2, { fonte: B, tamanho: 10, largura: 110.5, alinhar: 'center' });
  escrever(doc, 'DATA DE RECEBIMENTO', 7.1, 40, { fonte: R, tamanho: 6 });
  escrever(doc, 'IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', 106.3, 40, { fonte: R, tamanho: 6 });
  doc.save().lineWidth(0.3).dash(5.6, { space: 1.7 }).moveTo(5.7, 59.5).lineTo(589.6, 59.5).stroke().restore();
}

// Emitente, DANFE, codigo de barras, natureza e inscricoes (se repete em toda folha).
// dy desloca o bloco pra cima nas folhas de continuacao, que nao tem canhoto.
function identificacao(doc, nf, folha, folhas, dy) {
  const e = nf.emitente;
  const meio = (t, y, tamanho, fonte = R) => escrever(doc, t, 8, y + dy, { fonte, tamanho, largura: 233.5, alinhar: 'center' });

  caixa(doc, 5.7, 65.2 + dy, 243.8, 155.9 + dy);
  meio('IDENTIFICAÇÃO DO EMITENTE', 71.2, 6, I);
  const nome = quebrarLinhas(doc, e.nome, { fonte: B, tamanho: 12, largura: 232 }).slice(0, 2);
  nome.forEach((t, i) => meio(t, 108.4 - (nome.length - 1 - i) * 12, 12, B));
  meio(enderecoCurto(e), 118.5, 8);
  meio([e.bairro, cep(e.cep)].filter(Boolean).join(' - '), 126.5, 8);
  meio(`${e.municipio} - ${e.uf} Fone/Fax: ${e.fone}`, 134.5, 8);

  caixa(doc, 243.8, 65.2 + dy, 343, 155.9 + dy);
  const col = (t, y, tamanho, fonte = R) => escrever(doc, t, 243.8, y + dy, { fonte, tamanho, largura: 99.2, alinhar: 'center' });
  col('DANFE', 82, 14, B);
  col('Documento Auxiliar da Nota', 90.2, 8);
  col('Fiscal Eletrônica', 98.2, 8);
  escrever(doc, '0 - ENTRADA', 250.9, 112.9 + dy, { fonte: R, tamanho: 8 });
  escrever(doc, '1 - SAÍDA', 250.9, 121.4 + dy, { fonte: R, tamanho: 8 });
  caixa(doc, 320.3, 102 + dy, 334.5, 121.9 + dy);
  escrever(doc, nf.tipo, 320.3, 118 + dy, { fonte: B, tamanho: 12, largura: 14.2, alinhar: 'center' });
  col(`Nº. ${numeroNota(nf.numero)}`, 136.8, 10, B);
  col(`Série ${serie(nf.serie)}`, 145.3, 10, B);
  col(`Folha ${folha}/${folhas}`, 152.8, 8, I);

  caixa(doc, 343, 65.2 + dy, 589.6, 155.9 + dy);
  linha(doc, 343, 110.5 + dy, 589.6, 110.5 + dy, 0.3);
  linha(doc, 343, 133.2 + dy, 589.6, 133.2 + dy, 0.3);
  const dir = (t, y, tamanho, fonte = R, cor) => escrever(doc, t, 344, y + dy, { fonte, tamanho, largura: 244.6, alinhar: 'center', cor });
  if (nf.autorizada) {
    desenharCodigoBarras(doc, nf.chave, 360, 70.9 + dy, 211.8, 34);
  } else {
    dir('SEM VALIDADE FISCAL', 88, 14, B, '#c00');
    dir('XML sem autorização de uso da Sefaz', 101, 8, B, '#c00');
  }
  escrever(doc, 'CHAVE DE ACESSO', 344.4, 116.5 + dy, { fonte: R, tamanho: 6 });
  dir(chaveEmBlocos(nf.chave), 129.9, 8, B);
  dir('Consulta de autenticidade no portal nacional da NF-e', 141.2, 8);
  dir('www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora', 152.6, 8);

  campo(doc, 5.7, 155.9 + dy, 343, 175.7 + dy, 'NATUREZA DA OPERAÇÃO', nf.natureza);
  campo(doc, 343, 155.9 + dy, 589.6, 175.7 + dy, 'PROTOCOLO DE AUTORIZAÇÃO DE USO',
    nf.autorizada ? `${nf.protocolo}  -  ${data(nf.autorizadaEm)} ${hora(nf.autorizadaEm)}` : 'NÃO AUTORIZADA');
  campo(doc, 5.7, 175.7 + dy, 153.1, 195.6 + dy, 'INSCRIÇÃO ESTADUAL', e.ie);
  campo(doc, 153.1, 175.7 + dy, 300.5, 195.6 + dy, 'INSCRIÇÃO MUNICIPAL', e.im);
  campo(doc, 300.5, 175.7 + dy, 447.9, 195.6 + dy, 'INSCRIÇÃO ESTADUAL DO SUBST. TRIBUT.', e.iest);
  campo(doc, 447.9, 175.7 + dy, 589.6, 195.6 + dy, 'CNPJ / CPF', documento(e.documento));
}

function destinatario(doc, nf) {
  const d = nf.destinatario;
  titulo(doc, 'DESTINATÁRIO / REMETENTE', 205.4);
  campo(doc, 5.7, 206.9, 362.8, 226.8, 'NOME / RAZÃO SOCIAL', d.nome, { alinhar: 'left' });
  campo(doc, 362.8, 206.9, 496.1, 226.8, 'CNPJ / CPF', documento(d.documento));
  campo(doc, 496.1, 206.9, 589.6, 226.8, 'DATA DA EMISSÃO', data(nf.emissao));
  campo(doc, 5.7, 226.8, 280.6, 246.6, 'ENDEREÇO', enderecoCurto(d), { alinhar: 'left' });
  campo(doc, 280.6, 226.8, 402.5, 246.6, 'BAIRRO / DISTRITO', d.bairro);
  campo(doc, 402.5, 226.8, 496.1, 246.6, 'CEP', cep(d.cep));
  campo(doc, 496.1, 226.8, 589.6, 246.6, 'DATA DA SAÍDA/ENTRADA', data(nf.saida));
  campo(doc, 5.7, 246.6, 280.6, 266.5, 'MUNICÍPIO', d.municipio, { alinhar: 'left' });
  campo(doc, 280.6, 246.6, 303.3, 266.5, 'UF', d.uf);
  campo(doc, 303.3, 246.6, 399.7, 266.5, 'FONE / FAX', d.fone);
  campo(doc, 399.7, 246.6, 496.1, 266.5, 'INSCRIÇÃO ESTADUAL', d.ie);
  campo(doc, 496.1, 246.6, 589.6, 266.5, 'HORA DA SAÍDA/ENTRADA', hora(nf.saida) || nf.horaSaida);
}

// Duplicatas quando a nota tem; senao a forma de pagamento. Devolve quanto a
// secao cresceu em relacao ao espaco do modelo (as secoes seguintes descem).
function cobranca(doc, nf) {
  if (nf.duplicatas.length) {
    titulo(doc, 'FATURA / DUPLICATA', 276.3);
    const porLinha = 8;
    const largura = 583.9 / porLinha;
    const visiveis = nf.duplicatas.slice(0, porLinha * 3);
    visiveis.forEach((d, i) => {
      const x = 5.7 + (i % porLinha) * largura;
      const y = 277.8 + Math.floor(i / porLinha) * 25;
      caixa(doc, x, y, x + largura - 1.5, y + 24);
      [['Num.', d.numero], ['Venc.', data(d.vencimento)], ['Valor', `R$ ${numero(d.valor)}`]].forEach(([r, v], k) => {
        escrever(doc, r, x + 1.4, y + 7 + k * 7.4, { fonte: R, tamanho: 6 });
        escrever(doc, v, x + 18, y + 7 + k * 7.4, { fonte: B, tamanho: 7, largura: largura - 21, alinhar: 'right' });
      });
    });
    return Math.ceil(visiveis.length / porLinha) * 25 - 17;
  }
  titulo(doc, 'PAGAMENTO', 276.3);
  const caixas = nf.pagamentos.slice(0, 6).map((p) => ({ nome: p.descricao || FORMA_PAGAMENTO[p.forma] || p.forma, valor: p.valor }));
  if (Number(nf.troco) > 0) caixas.push({ nome: 'Troco', valor: nf.troco });
  caixas.forEach((p, i) => {
    const x = 5.7 + i * 82;
    caixa(doc, x, 277.8, x + 79.3, 294.8);
    escrever(doc, 'Forma', x + 1.4, 283.8, { fonte: R, tamanho: 6 });
    escrever(doc, p.nome, x + 22, 284.8, { fonte: B, tamanho: 7, largura: 55.9, alinhar: 'right' });
    escrever(doc, 'Valor', x + 1.4, 293.4, { fonte: R, tamanho: 6 });
    escrever(doc, `R$ ${numero(p.valor)}`, x + 22, 293.4, { fonte: B, tamanho: 7, largura: 55.9, alinhar: 'right' });
  });
  return 0;
}

function impostos(doc, nf, dy) {
  const t = nf.totais;
  const colunas = [5.7, 70.6, 135.4, 200.3, 265.2, 330.1, 395, 459.8, 524.7, 589.6];
  const linhas = [
    [['BASE DE CÁLC. DO ICMS', t.vBC, 5], ['VALOR DO ICMS', t.vICMS], ['BASE DE CÁLC. ICMS S.T.', t.vBCST, 5], ['VALOR DO ICMS SUBST.', t.vST, 5], ['V. IMP. IMPORTAÇÃO', t.vII],
      ['V. ICMS UF REMET.', t.vICMSUFRemet], ['V. FCP UF DEST.', t.vFCPUFDest], ['VALOR DO PIS', t.vPIS], ['V. TOTAL PRODUTOS', t.vProd]],
    [['VALOR DO FRETE', t.vFrete], ['VALOR DO SEGURO', t.vSeg], ['DESCONTO', t.vDesc], ['OUTRAS DESPESAS', t.vOutro], ['VALOR TOTAL IPI', t.vIPI],
      ['V. ICMS UF DEST.', t.vICMSUFDest], ['V. TOT. TRIB.', t.vTotTrib], ['VALOR DA COFINS', t.vCOFINS], ['V. TOTAL DA NOTA', t.vNF]]
  ];
  titulo(doc, 'CÁLCULO DO IMPOSTO', 304.6 + dy);
  linhas.forEach((campos, l) => campos.forEach(([rotulo, valor, tam], i) => {
    const y = 306.1 + l * 19.9 + dy;
    campo(doc, colunas[i], y, colunas[i + 1], y + 19.8, rotulo, numero(valor), { alinhar: 'right', rotuloTam: tam || 6 });
  }));
}

function transportador(doc, nf, dy) {
  const t = nf.transporte;
  const v = t.volumes;
  const soma = (campoVol) => v.reduce((a, x) => a + (Number(x[campoVol]) || 0), 0);
  const juntar = (campoVol) => [...new Set(v.map((x) => x[campoVol]).filter(Boolean))].join(' / ');
  const peso = (n) => (n ? numero(n, 3) : '');
  const c = (x0, y0, x1, y1, rotulo, valor, alinhar) => campo(doc, x0, y0 + dy, x1, y1 + dy, rotulo, valor, { alinhar });

  titulo(doc, 'TRANSPORTADOR / VOLUMES TRANSPORTADOS', 355.7 + dy);
  c(5.7, 357.2, 175, 377, 'NOME / RAZÃO SOCIAL', t.nome, 'left');
  c(175, 357.2, 262.6, 377, 'FRETE', MODALIDADE_FRETE[t.modalidade] || t.modalidade);
  c(262.6, 357.2, 350.2, 377, 'CÓDIGO ANTT', t.antt);
  c(350.2, 357.2, 437.8, 377, 'PLACA DO VEÍCULO', t.placa);
  c(437.8, 357.2, 460.5, 377, 'UF', t.placaUf);
  c(460.5, 357.2, 589.6, 377, 'CNPJ / CPF', documento(t.documento));
  c(5.7, 377, 262.6, 396.8, 'ENDEREÇO', t.endereco, 'left');
  c(262.6, 377, 438.4, 396.8, 'MUNICÍPIO', t.municipio);
  c(438.4, 377, 461, 396.8, 'UF', t.uf);
  c(461, 377, 589.6, 396.8, 'INSCRIÇÃO ESTADUAL', t.ie);
  c(5.7, 396.8, 65.2, 416.7, 'QUANTIDADE', soma('quantidade') ? String(soma('quantidade')) : '');
  c(65.2, 396.8, 164.4, 416.7, 'ESPÉCIE', juntar('especie'));
  c(164.4, 396.8, 263.6, 416.7, 'MARCA', juntar('marca'));
  c(263.6, 396.8, 362.8, 416.7, 'NUMERAÇÃO', juntar('numeracao'));
  c(362.8, 396.8, 479.1, 416.7, 'PESO BRUTO', peso(soma('pesoBruto')));
  c(479.1, 396.8, 589.6, 416.7, 'PESO LÍQUIDO', peso(soma('pesoLiquido')));
}

function tabelaItens(doc, yTitulo, yFim, pedacos) {
  titulo(doc, 'DADOS DOS PRODUTOS / SERVIÇOS', yTitulo);
  const topo = yTitulo + 1.5;
  const corpo = topo + 14.2;
  retangulo(doc, COL[0], topo, COL[COL.length - 1], yFim, 0.3, 2.3);
  linha(doc, COL[0], corpo, COL[COL.length - 1], corpo, 0.3);
  COL.slice(1, -1).forEach((x) => linha(doc, x, topo, x, yFim, 0.3));
  CABECALHO_ITENS.forEach((rotulos, i) => rotulos.forEach((r, k) => escrever(doc, r, COL[i] + 0.5, topo + (rotulos.length === 1 ? 8.7 : 5.7 + k * 6), {
    fonte: R, tamanho: 6, largura: COL[i + 1] - COL[i] - 1, alinhar: 'center'
  })));

  let n = 0;
  pedacos.forEach(({ bloco, inicio, fim }, indice) => {
    const { item, descricao } = bloco;
    if (indice > 0) {
      const y = corpo + n * PASSO_ITEM + 0.6;
      doc.save().lineWidth(0.3).dash(2.8, { space: 1.7 }).moveTo(COL[0], y).lineTo(COL[COL.length - 1], y).stroke().restore();
    }
    for (let k = inicio; k < fim; k++, n++) {
      const y = corpo + 7 + n * PASSO_ITEM;
      const por = (i, texto, alinhar) => escrever(doc, texto, COL[i] + 1.4, y, { fonte: R, tamanho: 7, largura: COL[i + 1] - COL[i] - 2.8, alinhar });
      por(1, descricao[k], 'left');
      if (k !== 0) continue;
      por(0, item.codigo, 'center');
      por(2, item.ncm, 'center');
      por(3, `${item.origem}${item.cst}`, 'center');
      por(4, item.cfop, 'center');
      por(5, item.unidade, 'center');
      por(6, numero(item.quantidade, 4), 'right');
      por(7, numero(item.valorUnitario, 4), 'right');
      por(8, numero(item.valorTotal), 'right');
      por(9, numeroOuVazio(item.desconto), 'right');
      por(10, numero(item.baseIcms), 'right');
      por(11, numero(item.valorIcms), 'right');
      por(12, numeroOuVazio(item.valorIpi), 'right');
      por(13, numero(item.aliquotaIcms), 'right');
      por(14, numeroOuVazio(item.aliquotaIpi), 'right');
    }
  });
}

function dadosAdicionais(doc, topo, linhas, fisco, tamanho) {
  titulo(doc, 'DADOS ADICIONAIS', topo - 1.5);
  caixa(doc, 5.7, topo, 391.2, FIM_PAGINA);
  caixa(doc, 391.2, topo, 589.6, FIM_PAGINA);
  escrever(doc, 'INFORMAÇÕES COMPLEMENTARES', 7.1, topo + 6, { fonte: B, tamanho: 6 });
  escrever(doc, 'RESERVADO AO FISCO', 392.6, topo + 6, { fonte: B, tamanho: 6 });
  linhas.forEach((t, i) => escrever(doc, t, 7.1, topo + 16.5 + i * tamanho, { fonte: R, tamanho }));
  quebrarLinhas(doc, fisco, { fonte: R, tamanho: 7, largura: 194 }).slice(0, 7)
    .forEach((t, i) => escrever(doc, t, 392.6, topo + 15 + i * 7, { fonte: R, tamanho: 7 }));
}

const rodape = (doc) => escrever(doc, 'DANFE gerada pelo sistema a partir do XML da NF-e', 7.1, 838, { fonte: I, tamanho: 6 });

export function desenharPadrao(doc, nf) {
  const blocos = nf.itens.map((item) => {
    const descricao = quebrarLinhas(doc, [item.descricao, item.adicional].filter(Boolean).join(' - '), { fonte: R, tamanho: 7, largura: 144 });
    if (!descricao.length) descricao.push('');
    return { item, descricao, linhas: descricao.length };
  });

  // informacoes complementares: a caixa cresce conforme o texto (reduzindo a fonte antes)
  let tamanho = 8;
  let complementares = quebrarLinhas(doc, nf.complementares, { fonte: R, tamanho, largura: 381 });
  if (complementares.length > 6) {
    tamanho = 7;
    complementares = quebrarLinhas(doc, nf.complementares, { fonte: R, tamanho, largura: 381 });
  }
  const maxLinhas = 24;
  const naPrimeira = complementares.slice(0, maxLinhas);
  const sobra = complementares.slice(maxLinhas);
  const topoAdicionais = Math.min(768.2, FIM_PAGINA - (19 + naPrimeira.length * tamanho));
  const fimItens = topoAdicionais - 22.7;

  const dyCobranca = nf.duplicatas.length ? Math.ceil(Math.min(nf.duplicatas.length, 24) / 8) * 25 - 17 : 0;
  const corpoPrimeira = 426.5 + dyCobranca + 15.7;
  const corpoDemais = 148.4 + 15.7;
  const capacidade = (corpo, fim) => Math.max(1, Math.floor((fim - corpo - 2) / PASSO_ITEM));
  const paginas = paginarItens(blocos, capacidade(corpoPrimeira, fimItens), capacidade(corpoDemais, FIM_PAGINA));
  if (sobra.length && paginas.length === 1) paginas.push([]);
  const folhas = paginas.length;

  paginas.forEach((pedacos, p) => {
    if (p > 0) doc.addPage();
    if (p === 0) {
      canhoto(doc, nf);
      identificacao(doc, nf, 1, folhas, 0);
      destinatario(doc, nf);
      const dy = cobranca(doc, nf);
      impostos(doc, nf, dy);
      transportador(doc, nf, dy);
      tabelaItens(doc, 426.5 + dy, fimItens, pedacos);
      dadosAdicionais(doc, topoAdicionais, naPrimeira, nf.fisco, tamanho);
    } else {
      identificacao(doc, nf, p + 1, folhas, -59.5);
      const ultimaComSobra = sobra.length && p === folhas - 1;
      const fim = ultimaComSobra ? FIM_PAGINA - (35 + sobra.length * tamanho) : FIM_PAGINA;
      tabelaItens(doc, 148.4, fim, pedacos);
      if (ultimaComSobra) dadosAdicionais(doc, fim + 22.7, sobra, '', tamanho);
    }
    rodape(doc);
  });
}
