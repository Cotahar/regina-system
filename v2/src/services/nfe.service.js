import { XMLParser } from 'fast-xml-parser';
import { PDFParse } from 'pdf-parse';

// parseTagValue:false mantem tudo como string - critico pro CNPJ, que pode ter
// zero a esquerda (a conversao automatica pra numero apagaria esse zero e
// quebraria a comparacao exata com clientes.cnpj). Campos numericos (peso,
// valor) sao convertidos manualmente abaixo via numeroOuNulo().
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false });

const CAMPOS_VAZIOS = {
  numeroNF: null,
  chaveAcesso: null,
  cnpjEmitente: null,
  nomeEmitente: null,
  cnpjDestinatario: null,
  nomeDestinatario: null,
  cidadeDestinatario: null,
  estadoDestinatario: null,
  dddDestinatario: null,
  telefoneDestinatario: null,
  pesoBruto: null,
  valorTotal: null,
  dataEmissao: null,
  placaVeiculo: null,
  nomeMotorista: null
};

function numeroOuNulo(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

// NF-e as vezes traz telefone do destinatario como um unico campo (DDD+numero
// junto, sem formatacao) - separa pra bater com o formato ddd/telefone
// separados do cadastro de cliente. So separa quando da pra ter certeza
// (10+ digitos); caso contrario nao arrisca um DDD errado.
function separarDddTelefone(fone) {
  const digitos = (fone || '').replace(/\D/g, '');
  if (digitos.length < 10) return { ddd: null, telefone: null };
  return { ddd: digitos.slice(0, 2), telefone: digitos.slice(2) };
}

// Guarda sempre como AAAA-MM-DD (sem hora) - dhEmi do XML vem com hora e fuso
// (ex: "2024-06-15T10:30:00-03:00"), DANFE em PDF vem "dd/mm/aaaa", e sem
// padronizar aqui a tela acaba mostrando formatos diferentes por nota.
function normalizarData(valor) {
  if (!valor) return null;
  const iso = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = String(valor).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

// Motorista nao e um campo padrao do schema da NF-e - quando aparece, e texto
// livre nas informacoes complementares (infCpl), que tambem costuma ser
// impressa na DANFE em PDF. Melhor esforco: para antes da proxima label
// conhecida (TEL, PLACA, CPF...) em vez de so parar em numero/pontuacao,
// senao um "MOTORISTA JOAO TEL 4799..." vira nome "JOAO TEL".
const LABELS_SEGUINTES = 'TEL|FONE|CEL|CELULAR|PLACA|CPF|CNPJ|RG|CNH|OBS|OBSERVA|PEDIDO|NF|NOTA|CT-?E';
function extrairMotoristaDeTexto(texto) {
  if (!texto) return null;
  const regex = new RegExp(
    `MOTORISTA[:\\-\\s]+((?:(?!${LABELS_SEGUINTES})[A-ZÀ-ÖØ-Þa-zà-öø-ÿ]+\\s*){1,5})`,
    'i'
  );
  const m = texto.match(regex);
  return m ? m[1].trim() : null;
}

// Placa no formato antigo (ABC1234) ou Mercosul (ABC1D23).
function extrairPlacaDeTexto(texto) {
  if (!texto) return null;
  const m = texto.match(/\b[A-Z]{3}[-\s]?\d[A-Z0-9]\d{2}\b/);
  return m ? m[0].replace(/[-\s]/g, '').toUpperCase() : null;
}

// Extrai os dados da NF-e a partir do XML (schema padrao da Receita). Aceita
// tanto o XML "cru" (<NFe>) quanto o "processado" (<nfeProc><NFe>...) - as
// duas formas circulam na pratica dependendo de quem emitiu. Nunca lanca
// excecao: um anexo malformado vira campos nulos, nao derruba o ciclo de
// importacao inteiro.
export function parseNFeXml(xmlText) {
  let parsed;
  try {
    parsed = xmlParser.parse(xmlText);
  } catch {
    return { ...CAMPOS_VAZIOS };
  }

  const infNFe = parsed?.nfeProc?.NFe?.infNFe ?? parsed?.NFe?.infNFe;
  if (!infNFe) return { ...CAMPOS_VAZIOS };

  const idAttr = infNFe['@_Id'] || '';
  const chaveAcesso = idAttr.replace(/^NFe/i, '').trim() || parsed?.nfeProc?.protNFe?.infProt?.chNFe || null;

  const numeroNFBruto = infNFe?.ide?.nNF;
  const numeroNF = numeroNFBruto !== undefined && numeroNFBruto !== null ? String(numeroNFBruto) : null;

  const dataEmissao = normalizarData(infNFe?.ide?.dhEmi ?? infNFe?.ide?.dEmi);

  const cnpjEmitente = infNFe?.emit?.CNPJ ?? null;
  const nomeEmitente = infNFe?.emit?.xNome ?? null;

  const cnpjDestinatario = infNFe?.dest?.CNPJ ?? infNFe?.dest?.CPF ?? null;
  const nomeDestinatario = infNFe?.dest?.xNome ?? null;

  // Enderesco do destinatario e um campo padrao da NF-e (dest/enderDest) -
  // usado so pra sugerir completar cadastro do cliente depois, na tela de
  // vincular (nunca sobrescreve nada sozinho).
  const enderDest = infNFe?.dest?.enderDest;
  const cidadeDestinatario = enderDest?.xMun || null;
  const estadoDestinatario = enderDest?.UF || null;
  const { ddd: dddDestinatario, telefone: telefoneDestinatario } = separarDddTelefone(enderDest?.fone);

  const valorTotal = numeroOuNulo(infNFe?.total?.ICMSTot?.vNF);

  let pesoBruto = null;
  const vol = infNFe?.transp?.vol;
  if (vol) {
    const volumes = Array.isArray(vol) ? vol : [vol];
    const soma = volumes.reduce((acc, v) => acc + (numeroOuNulo(v?.pesoB) || 0), 0);
    pesoBruto = soma > 0 ? soma : null;
  }

  // Placa: campo estruturado (transp/veicTransp/placa), alta confianca.
  // Motorista: nao existe campo proprio no layout - procura nas informacoes
  // complementares (texto livre que a transportadora as vezes usa pra isso).
  const placaVeiculo = infNFe?.transp?.veicTransp?.placa || null;
  const nomeMotorista = extrairMotoristaDeTexto(infNFe?.infAdic?.infCpl);

  return {
    numeroNF,
    chaveAcesso: chaveAcesso || null,
    cnpjEmitente,
    nomeEmitente,
    cnpjDestinatario,
    nomeDestinatario,
    cidadeDestinatario,
    estadoDestinatario,
    dddDestinatario,
    telefoneDestinatario,
    pesoBruto,
    valorTotal,
    dataEmissao,
    placaVeiculo,
    nomeMotorista
  };
}

export async function extrairTextoPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const resultado = await parser.getText();
    return resultado.text || '';
  } finally {
    await parser.destroy();
  }
}

function decimalPtBr(texto) {
  const n = Number(texto.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Extracao "melhor esforco" a partir do texto do DANFE (PDF) - layout varia
// por emissor, entao isso nunca e tratado como confiavel (quem chama sempre
// marca precisa_revisao=1 pra esse caminho). Nome do emitente/destinatario
// fica de fora aqui de proposito: dificil de isolar por regex com confianca,
// e o CNPJ ja e o suficiente pra sugerir o cliente casado.
export function extractFromPdfText(texto) {
  if (!texto) return { ...CAMPOS_VAZIOS };

  const chave44 = texto.match(/\b\d{44}\b/);
  const chaveBlocos = !chave44 && texto.match(/(?:\d{4}\s+){10}\d{4}/);
  const chaveAcesso = chave44 ? chave44[0] : (chaveBlocos ? chaveBlocos[0].replace(/\s+/g, '') : null);

  const cnpjs = [...texto.matchAll(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g)].map((m) => m[0].replace(/\D/g, ''));

  const valorMatch = texto.match(/VALOR\s+TOTAL\s+DA\s+NOTA[\s\S]{0,40}?([\d.]+,\d{2})/i);
  const pesoMatch = texto.match(/PESO\s+BRUTO[\s\S]{0,40}?([\d.]+,\d{2,3})/i);
  const dataMatch = texto.match(/DATA\s+DA?\s+EMISS[AÃ]O[\s\S]{0,40}?(\d{2}\/\d{2}\/\d{4})/i);
  const numeroMatch = texto.match(/N[ºo°.]?\s*[:.]?\s*(\d{1,3}\.?\d{3}(?:\.\d{3})?)\b/);

  return {
    numeroNF: numeroMatch ? numeroMatch[1].replace(/\./g, '') : null,
    chaveAcesso: chaveAcesso || null,
    cnpjEmitente: cnpjs[0] || null,
    nomeEmitente: null,
    cnpjDestinatario: cnpjs[1] || null,
    nomeDestinatario: null,
    cidadeDestinatario: null,
    estadoDestinatario: null,
    dddDestinatario: null,
    telefoneDestinatario: null,
    pesoBruto: pesoMatch ? decimalPtBr(pesoMatch[1]) : null,
    valorTotal: valorMatch ? decimalPtBr(valorMatch[1]) : null,
    dataEmissao: dataMatch ? normalizarData(dataMatch[1]) : null,
    placaVeiculo: extrairPlacaDeTexto(texto),
    nomeMotorista: extrairMotoristaDeTexto(texto)
  };
}
