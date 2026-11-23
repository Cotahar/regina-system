// Leitura dos e-mails da fabrica (Mohawk/Eliane) enviados pro sistema:
//   - "NOTIF TRANSPORTADOR Carga: N - DATA: ..." = romaneio: carga LIBERADA pra
//     a transportadora agendar a coleta (1 a varios clientes, 1 a varias cargas)
//   - "NOTIFICACAO TRANSPORTADOR" = cancelamento de carga (ou so da NF da carga)
// Modulo puro: recebe o HTML do e-mail e devolve dados estruturados, sem
// acessar banco nem Gmail (da pra testar com e-mails salvos). O conteudo do
// e-mail e dado nao confiavel: so texto e interpretado, nunca renderizado.

const ENTIDADES = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'"
};

function decodificarEntidades(texto) {
  return texto.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, corpo) => {
    if (ENTIDADES[m.toLowerCase()]) return ENTIDADES[m.toLowerCase()];
    if (corpo[0] === '#') {
      const codigo = corpo[1].toLowerCase() === 'x' ? parseInt(corpo.slice(2), 16) : parseInt(corpo.slice(1), 10);
      return Number.isFinite(codigo) && codigo > 0 && codigo < 0x110000 ? String.fromCodePoint(codigo) : m;
    }
    return m;
  });
}

// HTML do e-mail -> linhas de texto, mantendo a quebra de linha das tabelas
// (o corpo e um <pre>/tabela de texto corrido).
export function htmlParaLinhas(html) {
  return decodificarEntidades(
    String(html || '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<\/(tr|p|div|h\d|li)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').replace(/\|/g, '').trim())
    .filter(Boolean);
}

const numeroBr = (s) => (s == null ? null : Number(String(s).replace(/\./g, '').replace(',', '.')));
const soDigitos = (s) => (s || '').replace(/\D/g, '') || null;

// "19/11/26" -> "2026-11-19"
export function dataCurtaParaIso(dmy) {
  const m = String(dmy || '').match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  return m ? `20${m[3]}-${m[2]}-${m[1]}` : null;
}

const REGIAO_POR_UF = {
  AC: 'Norte', AP: 'Norte', AM: 'Norte', PA: 'Norte', RO: 'Norte', RR: 'Norte', TO: 'Norte',
  AL: 'Nordeste', BA: 'Nordeste', CE: 'Nordeste', MA: 'Nordeste', PB: 'Nordeste', PE: 'Nordeste', PI: 'Nordeste', RN: 'Nordeste', SE: 'Nordeste',
  DF: 'Centro-Oeste', GO: 'Centro-Oeste', MT: 'Centro-Oeste', MS: 'Centro-Oeste',
  ES: 'Sudeste', MG: 'Sudeste', RJ: 'Sudeste', SP: 'Sudeste',
  PR: 'Sul', RS: 'Sul', SC: 'Sul'
};

export function regiaoDaUf(uf) {
  return REGIAO_POR_UF[(uf || '').toUpperCase()] || null;
}

// Prazo (em dias) que a fabrica da pra agendar o embarque, pela regiao do destino.
export function prazoEmbarqueDias(prazos, uf) {
  const regiao = regiaoDaUf(uf);
  return regiao && prazos?.dias?.[regiao] != null ? prazos.dias[regiao] : null;
}

const REG = {
  mensagem: /^Mensagem n\.\s*(\d+)/,
  cliente: /^(.+?)\s+CODIGO:\s*(\d+)\s*$/,
  enderecoCadastro: /^End\.:\s*(.*?)\s*Cep:\s*(\d+)\s*$/,
  documento: /^CNPJ:\s*([\d./-]+)\s+INSC\.:\s*(\S*)\s+FONE:\s*(\S*)\s*$/,
  transp: /^Transp\s*:\s*(.*)$/,
  redesp: /^Redesp\s*:\s*(.*)$/,
  vendedor: /^Vendedor:\s*(.*)$/,
  emailSolto: /^\S+@\S+$/,
  cabecaCarga: /^FILIAL\s+(CARGA|AMOSTRA)\s+(CRONOGRAMA|DT EMISSAO)\s+VAL TOT\s+PESO BRU\s+CXS$/,
  dadosCarga: /^(.+?)\s+(\d+)\s+(?:(\d{2}\/\d{2}\/\d{2})\s+)?([\d.]+,\d{2})\s+([\d.]+,\d{2})\s+([\d.]+)$/,
  cnpjFilial: /^CNPJ:\s*([\d./-]+)\s*$/,
  nfAmostra: /^NF:\s*(\d+)\s*-+>\s*([\d.,]+)\s+([\d.,]+)\s+([\d.]+)$/,
  cabecaItens: /^QTD PRODUTO FABRICA NF$/,
  item: /^([\d.,]+)\s+(\S+)\s+(.+?)\s+(Amostra\s+\S+|[A-Z]{2}\s+\d+)\s+(\d+|Armazem\s+\d+)$/,
  separadorLongo: /^-{10,}$/,
  linhaDeTracos: /^-+(\s+-+)+$/,
  campo: /^(Modalidade Frete|Tipo de Venda|Local De Coleta|Endereco De Entrega|Periodo|Restricao de veiculo|Dificuldade de entrega|Contato|Fone \(1\)|Fone \(2\)|e-mail|Obs|Endereco De Cobranca)\s*:\s*(.*)$/,
  prazoLinha: /^(?:(.+?)\s+\((\w{2})\)\s+)?(Norte|Nordeste|Centro-Oeste|Sudeste|Sul)\s+(\d+)$/,
  rodape: /^Este e-mail foi encaminhado/,
  avisoCif: /^(\*Frete CIF|No ato do carregamento|a\) |b\) |c\) |No caso de descumprimento|prorrogados)/
};

// "RUA X, 234, ANANINDEUA, CENTRO - PA" -> { cidade: 'ANANINDEUA', bairro: 'CENTRO', uf: 'PA' }
// A cobranca vem com o CEP colado na UF ("- PACEP: 68440000") e, as vezes, com
// um aviso escrito depois do CEP ("**** CARGA CONTEM PECAS ESPECIAIS ***") -
// esse texto sai em "aviso" em vez de se perder.
export function interpretarEndereco(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  const m = t.match(/,\s*([^,]+?)\s*,\s*([^,]*?)\s*-\s*([A-Z]{2})\s*(?:CEP:\s*(\d+)\s*(.*))?$/);
  if (!m) return null;
  const aviso = (m[5] || '').replace(/^[\s*]+|[\s*]+$/g, '').trim();
  return { cidade: m[1].trim(), bairro: m[2].trim(), uf: m[3], cep: m[4] || null, aviso: aviso || null };
}

// "GOVERNADOR HELIO DA MOTA GUEI 385 ANANINDEUA PA" -> UF + as terminacoes
// possiveis do texto (do trecho mais longo ao mais curto) como candidatas a
// nome da cidade - quem chama confere cada uma contra a lista oficial de
// municipios, porque rua e cidade vem juntas, sem separador.
export function candidatosCidadeDoCadastro(enderecoCadastro) {
  const m = String(enderecoCadastro || '').trim().match(/^(.*)\s+([A-Z]{2})$/);
  if (!m) return { uf: null, candidatos: [] };
  const palavras = m[1].split(/\s+/).filter((p) => !/^\d+$/.test(p));
  const candidatos = [];
  for (let n = Math.min(4, palavras.length); n >= 1; n--) candidatos.push(palavras.slice(-n).join(' '));
  return { uf: m[2], candidatos };
}

// Interpreta o romaneio ("NOTIF TRANSPORTADOR"). Um e-mail pode trazer varios
// blocos de cliente (cada um com suas cargas) e, as vezes, o bloco de
// instrucoes repetido a cada cliente.
export function interpretarRomaneio(linhas) {
  const r = { mensagemNumero: null, clientes: [], naoReconhecidas: [], avisoCif: [] };
  let cliente = null;
  let carga = null;
  let campoAtual = null;
  let prazosPendentes = null;
  let regrasPendentes = [];
  let modo = 'inicio';

  for (const l of linhas) {
    let m;
    if ((m = l.match(REG.mensagem))) { r.mensagemNumero = Number(m[1]); modo = 'intro'; prazosPendentes = null; regrasPendentes = []; continue; }
    if (/^Informa..es importantes:?$/i.test(l)) { modo = 'intro'; prazosPendentes = null; regrasPendentes = []; continue; }

    if (modo === 'intro') {
      if (REG.cliente.test(l)) { /* segue para o tratamento de cliente */ }
      else if (REG.separadorLongo.test(l)) { modo = 'fim-bloco'; continue; }
      else {
        if (l === 'Origem Destino Dias' || REG.linhaDeTracos.test(l)) continue;
        if ((m = l.match(REG.prazoLinha))) {
          prazosPendentes ??= { origem: null, dias: {} };
          if (m[2]) prazosPendentes.origem = m[2];
          prazosPendentes.dias[m[3]] = Number(m[4]);
        } else if (l.startsWith('* ')) {
          regrasPendentes.push(l.slice(2));
        } else if (regrasPendentes.length) {
          regrasPendentes[regrasPendentes.length - 1] += ` ${l}`;
        }
        continue;
      }
    }

    if (REG.rodape.test(l)) continue;
    if (REG.avisoCif.test(l)) { r.avisoCif.push(l); continue; }

    if ((m = l.match(REG.cliente)) && !REG.campo.test(l)) {
      cliente = {
        nome: m[1], codigo: m[2], enderecoCadastro: null, cep: null, cnpj: null, ie: null, fone: null,
        transportadora: null, vendedor: null, emailVendedor: null,
        prazos: prazosPendentes, regras: regrasPendentes, cargas: []
      };
      r.clientes.push(cliente);
      carga = null; campoAtual = null; modo = 'cliente';
      continue;
    }

    if (cliente && modo === 'cliente') {
      if ((m = l.match(REG.enderecoCadastro))) { cliente.enderecoCadastro = m[1]; cliente.cep = m[2]; continue; }
      if ((m = l.match(REG.documento))) { cliente.cnpj = soDigitos(m[1]); cliente.ie = m[2] || null; cliente.fone = soDigitos(m[3]); continue; }
      if ((m = l.match(REG.transp))) { cliente.transportadora = m[1].trim(); continue; }
      if ((m = l.match(REG.redesp))) { cliente.redespacho = m[1].trim(); continue; }
      if ((m = l.match(REG.vendedor))) { cliente.vendedor = m[1].trim().replace(/\s*-\s*$/, ''); continue; }
      if (REG.emailSolto.test(l)) { cliente.emailVendedor = l; continue; }
    }

    if (REG.separadorLongo.test(l)) { modo = 'fim-bloco'; campoAtual = null; continue; }
    if (REG.linhaDeTracos.test(l)) continue;

    if (REG.cabecaCarga.test(l)) {
      if (!cliente) { r.naoReconhecidas.push(`[sem cliente] ${l}`); continue; }
      carga = {
        tipoCabecalho: l.match(REG.cabecaCarga)[1], filial: null, numero: null, dataColuna: null,
        valorTotal: null, pesoBruto: null, caixas: null, cnpjFilial: null,
        campos: {}, localColetaLinhas: [], nfsAmostra: [], itens: [], entregaNaObra: false
      };
      cliente.cargas.push(carga);
      modo = 'carga-cab'; campoAtual = null;
      continue;
    }

    if (carga && modo === 'carga-cab') {
      if ((m = l.match(REG.dadosCarga))) {
        Object.assign(carga, {
          filial: m[1], numero: m[2], dataColuna: dataCurtaParaIso(m[3]),
          valorTotal: numeroBr(m[4]), pesoBruto: numeroBr(m[5]), caixas: Number(m[6].replace(/\./g, ''))
        });
        continue;
      }
      if ((m = l.match(REG.cnpjFilial))) { carga.cnpjFilial = soDigitos(m[1]); modo = 'campos'; continue; }
    }

    if (carga && (modo === 'campos' || modo === 'carga-cab')) {
      if ((m = l.match(REG.campo))) {
        campoAtual = m[1];
        carga.campos[campoAtual] = m[2];
        if (campoAtual === 'Local De Coleta') carga.localColetaLinhas = [m[2]];
        modo = 'campos';
        continue;
      }
      if ((m = l.match(REG.nfAmostra))) {
        carga.nfsAmostra.push({ nf: m[1], valor: numeroBr(m[2]), peso: numeroBr(m[3]), caixas: Number(m[4].replace(/\./g, '')) });
        campoAtual = null;
        continue;
      }
      if (REG.cabecaItens.test(l)) { modo = 'itens'; campoAtual = null; continue; }
      if (/^- Entrega na obra -$/.test(l)) { carga.entregaNaObra = true; campoAtual = null; continue; }
      if (campoAtual) { // continuacao de endereco em mais de uma linha
        carga.campos[campoAtual] += ` ${l}`;
        if (campoAtual === 'Local De Coleta') carga.localColetaLinhas.push(l);
        continue;
      }
    }

    if (carga && modo === 'itens' && (m = l.match(REG.item))) {
      carga.itens.push({ quantidade: numeroBr(m[1]), unidade: m[2], produto: m[3], fabrica: m[4], nf: m[5] });
      continue;
    }

    r.naoReconhecidas.push(`[${modo}] ${l}`);
  }
  return r;
}

// Cancelamento: "INFORMAMOS QUE A CARGA ABAIXO FOI CANCELADA." (uma carga por
// e-mail) ou "...A N.F. DESTA CARGA ABAIXO FOI CANCELADA." (so a nota).
export function interpretarCancelamento(linhas) {
  const r = { tipo: null, mensagemNumero: null, dataNotificacao: null, motivo: null, itens: [], naoReconhecidas: [] };
  let aguardandoSegundaLinhaNf = null;

  for (const l of linhas) {
    let m;
    if ((m = l.match(REG.mensagem))) { r.mensagemNumero = Number(m[1]); continue; }
    if (/^INFORMAMOS QUE A N\.?F\.? DESTA CARGA/i.test(l)) { r.tipo = 'cancelamento_nf'; continue; }
    if (/^INFORMAMOS QUE A CARGA ABAIXO FOI CANCELADA/i.test(l)) { r.tipo = 'cancelamento_carga'; continue; }
    if ((m = l.match(/^DATA NOTIFICACAO:\s*(\S+)/))) { r.dataNotificacao = dataCurtaParaIso(m[1]); continue; }
    if ((m = l.match(/^MOTIVO\s*:\s*(.*)$/))) { r.motivo = m[1].trim() || null; continue; }
    if (/^(CARGA DATA CLIENTE|CARGA NF DATA CLIENTE|PESO DESTINO|-{3,}|Este e-mail foi encaminhado)/.test(l) || REG.linhaDeTracos.test(l)) continue;

    if (r.tipo === 'cancelamento_nf') {
      if ((m = l.match(/^(\d+)\s+(\d+)\s+(\d{2}\/\d{2}\/\d{2})\s+(.+)$/))) {
        aguardandoSegundaLinhaNf = { carga: m[1], nf: m[2], dataOriginal: dataCurtaParaIso(m[3]), cliente: m[4], peso: null, destino: null };
        r.itens.push(aguardandoSegundaLinhaNf);
        continue;
      }
      if (aguardandoSegundaLinhaNf && (m = l.match(/^([\d.]+,\d{2})\s+(.+)$/))) {
        aguardandoSegundaLinhaNf.peso = numeroBr(m[1]);
        aguardandoSegundaLinhaNf.destino = m[2];
        aguardandoSegundaLinhaNf = null;
        continue;
      }
    } else if ((m = l.match(/^(\d+)\s+(\d{2}\/\d{2}\/\d{2})\s+(.+?)\s+([\d.]+,\d{2})\s+(.+)$/))) {
      r.itens.push({ carga: m[1], nf: null, dataOriginal: dataCurtaParaIso(m[2]), cliente: m[3], peso: numeroBr(m[4]), destino: m[5] });
      continue;
    }
    r.naoReconhecidas.push(l);
  }
  return r;
}

// Decide o tipo pelo conteudo (o assunto da fabrica e igual pra varios tipos).
export function classificarMensagem(linhas) {
  if (linhas.some((l) => /^INFORMAMOS QUE A N\.?F\.? DESTA CARGA/i.test(l))) return 'cancelamento_nf';
  if (linhas.some((l) => /^INFORMAMOS QUE A CARGA ABAIXO FOI CANCELADA/i.test(l))) return 'cancelamento_carga';
  if (linhas.some((l) => REG.cabecaCarga.test(l))) return 'romaneio';
  return 'desconhecida';
}

// "CASTANHAL PA" -> { cidade: 'CASTANHAL', uf: 'PA' }
export function separarCidadeUf(texto) {
  const m = String(texto || '').trim().match(/^(.*?)\s+([A-Z]{2})$/);
  return m ? { cidade: m[1].trim(), uf: m[2] } : { cidade: String(texto || '').trim() || null, uf: null };
}
