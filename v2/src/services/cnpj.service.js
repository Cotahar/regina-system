import { encontrarMunicipio } from './municipios.service.js';

// Dois provedores gratuitos e sem chave que devolvem o mesmo formato de JSON -
// se o primeiro estiver fora do ar ou limitando consultas (acontece, sao
// servicos publicos), cai pro segundo antes de desistir.
const PROVEDORES = ['https://brasilapi.com.br/api/cnpj/v1', 'https://minhareceita.org'];
const TIMEOUT_MS = 8000;

// Erro com o status HTTP que a rota deve devolver - separa "CNPJ ruim" (400),
// "nao existe" (404) e "servico fora do ar" (503), que pedem mensagens
// diferentes pro usuario.
export class ErroConsultaCnpj extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

function calcularDigito(base) {
  const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = base.split('').reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(digitos) {
  if (!/^\d{14}$/.test(digitos) || /^(\d)\1{13}$/.test(digitos)) return false;
  const dv1 = calcularDigito(digitos.slice(0, 12));
  const dv2 = calcularDigito(digitos.slice(0, 12) + dv1);
  return digitos.endsWith(`${dv1}${dv2}`);
}

// "4834661328" -> { ddd: '48', telefone: '3466-1328' }
function separarTelefone(dddTelefone) {
  const digitos = (dddTelefone || '').replace(/\D/g, '');
  if (digitos.length < 10) return { ddd: null, telefone: null };
  const numero = digitos.slice(2);
  const corte = numero.length - 4;
  return { ddd: digitos.slice(0, 2), telefone: `${numero.slice(0, corte)}-${numero.slice(corte)}` };
}

// 404 e resposta definitiva (o CNPJ nao existe); qualquer outra falha
// (timeout, 429, 5xx) lanca um Error comum pra consultarCnpj tentar o proximo.
async function buscarNoProvedor(urlBase, cnpj) {
  const resp = await fetch(`${urlBase}/${cnpj}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (resp.status === 404) throw new ErroConsultaCnpj(404, 'CNPJ nao encontrado na Receita Federal.');
  if (!resp.ok) throw new Error(`${urlBase} respondeu ${resp.status}`);
  return resp.json();
}

// Consulta os dados cadastrais publicos da Receita Federal. Devolve ja no
// formato do nosso cadastro: cidade/UF passam pela lista oficial de
// municipios, igual a importacao de clientes.
export async function consultarCnpj(cnpj) {
  if (!cnpjValido(cnpj)) throw new ErroConsultaCnpj(400, 'CNPJ invalido - confira os digitos.');

  let dados = null;
  for (const urlBase of PROVEDORES) {
    try {
      dados = await buscarNoProvedor(urlBase, cnpj);
      break;
    } catch (err) {
      if (err instanceof ErroConsultaCnpj) throw err;
    }
  }
  if (!dados) throw new ErroConsultaCnpj(503, 'Consulta de CNPJ indisponivel no momento - tente de novo em instantes ou preencha manualmente.');

  const municipio = encontrarMunicipio(dados.municipio, dados.uf);
  const { ddd, telefone } = separarTelefone(dados.ddd_telefone_1);

  return {
    cnpj,
    razao_social: (dados.razao_social || '').toUpperCase(),
    nome_fantasia: (dados.nome_fantasia || '').toUpperCase() || null,
    cidade: municipio ? municipio.cidade.toUpperCase() : (dados.municipio || '').toUpperCase() || null,
    estado: municipio ? municipio.uf : (dados.uf || '').toUpperCase() || null,
    ddd,
    telefone,
    situacao: dados.descricao_situacao_cadastral || null
  };
}
