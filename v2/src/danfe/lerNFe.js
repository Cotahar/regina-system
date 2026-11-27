// Le o XML de uma NF-e e devolve so o que a DANFE mostra, ja em estrutura simples.
import { XMLParser } from 'fast-xml-parser';

// parseTagValue:false mantem tudo como texto (CNPJ/IE com zero a esquerda).
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false, removeNSPrefix: true });

const lista = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const txt = (v) => (v === undefined || v === null ? '' : String(v));
// Alguns emitentes escapam o texto duas vezes (ex.: "==&amp;gt;").
const semEntidades = (s) => txt(s).replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function endereco(e = {}) {
  return {
    logradouro: semEntidades(e.xLgr), numero: txt(e.nro), complemento: semEntidades(e.xCpl), bairro: semEntidades(e.xBairro),
    municipio: semEntidades(e.xMun), uf: txt(e.UF), cep: txt(e.CEP), fone: txt(e.fone)
  };
}

function pessoa(p = {}, tagEndereco) {
  return {
    nome: semEntidades(p.xNome), documento: txt(p.CNPJ ?? p.CPF ?? p.idEstrangeiro), ie: txt(p.IE), iest: txt(p.IEST), im: txt(p.IM),
    ...endereco(p[tagEndereco])
  };
}

// O grupo do ICMS muda de nome conforme a tributacao (ICMS00, ICMS60, ICMSSN102...).
const primeiroGrupo = (obj) => (obj ? Object.values(obj).find((v) => v && typeof v === 'object') || {} : {});

function item(det) {
  const p = det.prod || {};
  const icms = primeiroGrupo(det.imposto?.ICMS);
  const ipi = det.imposto?.IPI?.IPITrib || {};
  return {
    codigo: txt(p.cProd),
    descricao: semEntidades(p.xProd),
    adicional: semEntidades(det.infAdProd),
    ncm: txt(p.NCM),
    origem: txt(icms.orig),
    cst: txt(icms.CST ?? icms.CSOSN),
    cfop: txt(p.CFOP),
    unidade: txt(p.uCom),
    quantidade: txt(p.qCom),
    valorUnitario: txt(p.vUnCom),
    valorTotal: txt(p.vProd),
    desconto: txt(p.vDesc),
    baseIcms: txt(icms.vBC),
    valorIcms: txt(icms.vICMS),
    aliquotaIcms: txt(icms.pICMS),
    valorIpi: txt(ipi.vIPI),
    aliquotaIpi: txt(ipi.pIPI)
  };
}

// Devolve null quando o XML nao e uma NF-e.
export function lerNFe(xmlTexto) {
  let arvore;
  try {
    arvore = parser.parse(String(xmlTexto || '').replace(/^﻿/, ''));
  } catch {
    return null;
  }
  const inf = arvore?.nfeProc?.NFe?.infNFe ?? arvore?.NFe?.infNFe;
  if (!inf) return null;

  const ide = inf.ide || {};
  const protocolo = arvore?.nfeProc?.protNFe?.infProt || {};
  const total = inf.total?.ICMSTot || {};
  const issqn = inf.total?.ISSQNtot || {};
  const transp = inf.transp || {};
  const autorizada = ['100', '150'].includes(txt(protocolo.cStat)) && txt(ide.tpAmb || '1') === '1';

  return {
    chave: txt(inf['@_Id']).replace(/^NFe/i, ''),
    modelo: txt(ide.mod),
    numero: txt(ide.nNF),
    serie: txt(ide.serie),
    tipo: txt(ide.tpNF),
    natureza: semEntidades(ide.natOp),
    emissao: txt(ide.dhEmi ?? ide.dEmi),
    saida: txt(ide.dhSaiEnt ?? ide.dSaiEnt),
    horaSaida: txt(ide.hSaiEnt),
    autorizada,
    protocolo: autorizada ? txt(protocolo.nProt) : '',
    autorizadaEm: autorizada ? txt(protocolo.dhRecbto) : '',
    emitente: pessoa(inf.emit, 'enderEmit'),
    destinatario: pessoa(inf.dest, 'enderDest'),
    itens: lista(inf.det).map(item),
    totais: total,
    issqn: { servicos: txt(issqn.vServ), base: txt(issqn.vBC), valor: txt(issqn.vISS) },
    duplicatas: lista(inf.cobr?.dup).map((d) => ({ numero: txt(d.nDup), vencimento: txt(d.dVenc), valor: txt(d.vDup) })),
    pagamentos: lista(inf.pag?.detPag).map((d) => ({ forma: txt(d.tPag), descricao: semEntidades(d.xPag), valor: txt(d.vPag) })),
    troco: txt(lista(inf.pag)[0]?.vTroco),
    transporte: {
      modalidade: txt(transp.modFrete),
      nome: semEntidades(transp.transporta?.xNome),
      documento: txt(transp.transporta?.CNPJ ?? transp.transporta?.CPF),
      ie: txt(transp.transporta?.IE),
      endereco: semEntidades(transp.transporta?.xEnder),
      municipio: semEntidades(transp.transporta?.xMun),
      uf: txt(transp.transporta?.UF),
      antt: txt(transp.veicTransp?.RNTC),
      placa: txt(transp.veicTransp?.placa),
      placaUf: txt(transp.veicTransp?.UF),
      volumes: lista(transp.vol).map((v) => ({ quantidade: txt(v.qVol), especie: txt(v.esp), marca: txt(v.marca), numeracao: txt(v.nVol), pesoLiquido: txt(v.pesoL), pesoBruto: txt(v.pesoB) }))
    },
    complementares: semEntidades(inf.infAdic?.infCpl),
    fisco: semEntidades(inf.infAdic?.infAdFisco)
  };
}
