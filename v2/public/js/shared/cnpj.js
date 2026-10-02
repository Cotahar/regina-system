import { apiGet } from './api.js';

const COR_AVISO = { info: 'text-slate-400', ok: 'text-emerald-400', alerta: 'text-amber-400', erro: 'text-red-400' };

const soDigitos = (valor) => (valor || '').replace(/\D/g, '');

// Compara sem acento/caixa/pontuacao pra "Orleans" = "ORLEANS" e
// "(48) 3466-1328" = "34661328" nao virarem falsas divergencias.
const comparavel = (valor) => (valor || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

function mostrarAviso(aviso, texto, tipo) {
  aviso.textContent = texto;
  aviso.classList.remove('hidden', ...Object.values(COR_AVISO));
  aviso.classList.add(COR_AVISO[tipo]);
}

// Campo vazio recebe o dado da Receita direto (nao tem o que perder). Campo
// ja preenchido e diferente so e trocado se o usuario confirmar - o cadastro
// pode ter um nome "de uso" (ex: o da unidade) que a razao social oficial nao
// tem, e isso nunca pode ser sobrescrito sem a pessoa ver.
function aplicarDadosReceita(campos) {
  const divergentes = [];
  for (const campo of campos) {
    if (!campo.valor) continue;
    const atual = campo.input.value.trim();
    if (!atual) campo.input.value = campo.valor;
    else if (comparavel(atual) !== comparavel(campo.valor)) divergentes.push(campo);
  }
  if (!divergentes.length) return;

  const linhas = divergentes.map((c) => `- ${c.rotulo}: "${c.input.value.trim()}" -> "${c.valor}"`).join('\n');
  if (confirm(`Esses campos ja estao preenchidos e diferem da Receita Federal:\n\n${linhas}\n\nSubstituir pelos dados da Receita?`)) {
    divergentes.forEach((c) => { c.input.value = c.valor; });
  }
}

// Liga a busca de dados cadastrais por CNPJ num campo: dispara sozinha quando
// os 14 digitos sao completados (digitando ou colando) e tambem pelo botao.
// camposDaReceita(dados) diz quais campos da tela recebem quais dados;
// validar() (opcional) devolve uma mensagem quando a tela ainda nao esta
// pronta pra receber a busca (ex: falta escolher o cliente).
export function ativarBuscaCnpj({ input, botao, aviso, camposDaReceita, validar }) {
  let ultimoConsultado = null;

  async function consultar() {
    const bloqueio = validar?.();
    if (bloqueio) return mostrarAviso(aviso, bloqueio, 'alerta');
    const cnpj = soDigitos(input.value);
    if (cnpj.length !== 14) return mostrarAviso(aviso, 'Digite os 14 digitos do CNPJ para buscar.', 'alerta');

    ultimoConsultado = cnpj;
    botao.disabled = true;
    mostrarAviso(aviso, 'Consultando a Receita Federal...', 'info');
    try {
      const dados = await apiGet(`/api/cnpj/${cnpj}`);
      if (soDigitos(input.value) !== cnpj) return; // o CNPJ mudou enquanto consultava
      aplicarDadosReceita(camposDaReceita(dados));
      const nome = dados.nome_fantasia ? `${dados.razao_social} (${dados.nome_fantasia})` : dados.razao_social;
      if (dados.situacao && dados.situacao !== 'ATIVA') {
        mostrarAviso(aviso, `Atencao: ${nome} esta com situacao cadastral ${dados.situacao} na Receita.`, 'alerta');
      } else {
        mostrarAviso(aviso, `Encontrado na Receita: ${nome}.`, 'ok');
      }
    } catch (err) {
      ultimoConsultado = null; // permite tentar de novo
      if (soDigitos(input.value) === cnpj) mostrarAviso(aviso, err.message, 'erro');
    } finally {
      botao.disabled = false;
    }
  }

  function resetar() {
    ultimoConsultado = null;
    aviso.classList.add('hidden');
  }

  botao.addEventListener('click', consultar);
  input.addEventListener('input', () => {
    const cnpj = soDigitos(input.value);
    if (cnpj.length !== 14) return resetar();
    if (cnpj !== ultimoConsultado) consultar();
  });

  return { resetar };
}
