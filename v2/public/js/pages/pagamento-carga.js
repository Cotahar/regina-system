import { apiGet, apiPut } from '../shared/api.js';
import { exibirMensagem } from '../shared/ui.js';
import { escapeHtml } from '../shared/escape.js';
import { parseDecimal } from '../shared/format.js';
import { aplicarMascaraDecimal, formatarDecimalParaInput } from '../shared/mask.js';

const cargaId = new URLSearchParams(window.location.search).get('carga_id');
const msg = document.getElementById('pag-msg');

if (!cargaId) {
  document.body.innerHTML = '<p class="p-6 text-red-400">carga_id nao informado na URL.</p>';
  throw new Error('carga_id ausente');
}

let dados = null;

aplicarMascaraDecimal(document.getElementById('pag-saldo'));
aplicarMascaraDecimal(document.getElementById('pag-vale-pedagio'));

function opcoesUnidade(lista, valorSelecionado) {
  return '<option value="">-</option>' + lista.map((u) =>
    `<option value="${u.id}" ${u.id === valorSelecionado ? 'selected' : ''}>${escapeHtml(u.nome)}</option>`
  ).join('');
}

function nomeUnidadeSelecionada() {
  const select = document.getElementById('pag-unidade');
  const opcao = select.options[select.selectedIndex];
  return opcao ? opcao.text : '';
}

// So aparece no final da mensagem de FROTA, e so com o peso quando a carga
// mistura os dois tipos de descarga - se for tudo de um tipo so, mostra so o
// rotulo (regra do usuario: nao faz sentido mostrar peso igual ao total).
function linhasDescargaFrota() {
  const d = dados.descarga_frota;
  if (!d) return [];
  const temPaga = d.paga_descarga > 0;
  const temCliente = d.cliente_descarrega > 0;
  if (temPaga && temCliente) {
    return ['', `Paga Descarga: ${formatarDecimalParaInput(d.paga_descarga)} Kg`, `Cliente Descarrega: ${formatarDecimalParaInput(d.cliente_descarrega)} Kg`];
  }
  if (temPaga) return ['', 'Paga Descarga'];
  if (temCliente) return ['', 'Cliente Descarrega'];
  return [];
}

// Monta o texto exato da mensagem de WhatsApp - linha em branco = string
// vazia no array. Os dois modelos (frota/terceiro) tem espacamento e negrito
// (*texto*) diferentes, reproduzidos ao pe da letra dos exemplos combinados.
function montarMensagem() {
  const unidade = nomeUnidadeSelecionada();
  const motorista = dados.carga.motorista_nome;
  const origem = document.getElementById('pag-origem').value;
  const destino = document.getElementById('pag-destino').value;

  if (dados.carga.veiculo_frota) {
    return [
      `UN. ${unidade}`,
      '',
      'FROTA',
      '',
      `Motorista: ${motorista}`,
      `Origem: ${origem}`,
      `Destino: ${destino}`,
      `Frete empresa: ${formatarDecimalParaInput(dados.resumo.valor_frete_total)}`,
      `Peso: ${formatarDecimalParaInput(dados.resumo.peso_total)}`,
      `Frete motorista: ${formatarDecimalParaInput(dados.carga.frete_pago)}`,
      ...linhasDescargaFrota()
    ].join('\n');
  }

  const saldo = document.getElementById('pag-saldo').value;
  const valePedagio = document.getElementById('pag-vale-pedagio').value;
  const dadosPagamento = document.getElementById('pag-dados-pagamento').value;

  return [
    `UN. ${unidade}`,
    '',
    '*ADIANTAMENTO*',
    '',
    `Origem: ${origem}`,
    `Destino: ${destino}`,
    '',
    `Motorista: ${motorista}`,
    '',
    `Nosso Frete: R$ ${formatarDecimalParaInput(dados.resumo.valor_frete_total)}`,
    '',
    `Frete Motorista: ${formatarDecimalParaInput(dados.carga.frete_pago)}`,
    `*Adiantamento: ${formatarDecimalParaInput(dados.carga.adiantamento_valor)}*`,
    `Saldo: ${saldo}`,
    '',
    `Vale Pedágio: ${valePedagio}`,
    '',
    'Dados: ',
    dadosPagamento
  ].join('\n');
}

function atualizarPreview() {
  document.getElementById('pag-preview').value = montarMensagem();
}

async function carregar() {
  const [dadosResp, unidades] = await Promise.all([
    apiGet(`/api/cargas/${cargaId}/pagamento`),
    apiGet('/api/auxiliar/unidades')
  ]);
  dados = dadosResp;

  document.getElementById('pag-codigo').textContent = dados.carga.codigo_carga;
  document.getElementById('pag-motorista').value = dados.carga.motorista_nome;
  document.getElementById('pag-tipo').value = dados.carga.veiculo_frota ? 'Frota' : 'Terceiro';
  document.getElementById('pag-unidade').innerHTML = opcoesUnidade(unidades, dados.unidade_sugerida_id);

  // Origem/destino = cidade/UF de quem tem mais peso na carga (remetente e
  // destinatario respectivamente) - vale pros dois tipos de veiculo. O select
  // ja vem com a sugestao marcada, mas continua editavel pra corrigir dado
  // de cadastro ruim ou empate.
  function preencherSelectCidade(select, opcoes, sugestao) {
    select.innerHTML = '<option value="">Selecione...</option>' +
      opcoes.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
    if (sugestao) {
      if (!opcoes.includes(sugestao)) select.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(sugestao)}">${escapeHtml(sugestao)}</option>`);
      select.value = sugestao;
    } else if (opcoes.length === 1) {
      select.value = opcoes[0];
    }
  }
  preencherSelectCidade(document.getElementById('pag-origem'), dados.origens_disponiveis || [], dados.origem_sugerida);
  preencherSelectCidade(document.getElementById('pag-destino'), dados.destinos_disponiveis || [], dados.destino_sugerido);

  if (dados.carga.veiculo_frota) {
    document.getElementById('pag-secao-frota').classList.remove('hidden');
    document.getElementById('pag-secao-terceiro').classList.add('hidden');
    document.getElementById('btn-pag-salvar').classList.add('hidden');

    document.getElementById('pag-frete-empresa').value = `R$ ${formatarDecimalParaInput(dados.resumo.valor_frete_total)}`;
    document.getElementById('pag-peso').value = formatarDecimalParaInput(dados.resumo.peso_total);
    document.getElementById('pag-frete-motorista-frota').value = formatarDecimalParaInput(dados.carga.frete_pago);
  } else {
    document.getElementById('pag-secao-terceiro').classList.remove('hidden');
    document.getElementById('pag-secao-frota').classList.add('hidden');

    document.getElementById('pag-nosso-frete').value = `R$ ${formatarDecimalParaInput(dados.resumo.valor_frete_total)}`;
    document.getElementById('pag-frete-motorista').value = formatarDecimalParaInput(dados.carga.frete_pago);
    document.getElementById('pag-adiantamento').value = formatarDecimalParaInput(dados.carga.adiantamento_valor);

    const saldoSugerido = dados.carga.saldo_motorista ?? ((dados.carga.frete_pago || 0) - (dados.carga.adiantamento_valor || 0));
    document.getElementById('pag-saldo').value = formatarDecimalParaInput(saldoSugerido);
    // Vale pedagio aqui e um campo proprio da tela de pagamento (nao o campo
    // "rota" do Gerenciar Faturamento, que e outra coisa) - sempre digitado
    // pelo usuario, sem sugestao automatica.
    document.getElementById('pag-vale-pedagio').value = dados.carga.vale_pedagio_valor || '';
    document.getElementById('pag-dados-pagamento').value = dados.veiculo_dados_pagamento || '';
  }

  atualizarPreview();
}

document.getElementById('pag-unidade').addEventListener('change', atualizarPreview);
document.getElementById('pag-origem').addEventListener('change', atualizarPreview);
document.getElementById('pag-destino').addEventListener('change', atualizarPreview);
['pag-saldo', 'pag-vale-pedagio', 'pag-dados-pagamento'].forEach((id) => {
  const campo = document.getElementById(id);
  campo.addEventListener('input', atualizarPreview);
  campo.addEventListener('blur', atualizarPreview);
});

document.getElementById('btn-pag-salvar').addEventListener('click', async () => {
  try {
    await apiPut(`/api/cargas/${cargaId}/pagamento`, {
      saldo_motorista: parseDecimal(document.getElementById('pag-saldo').value),
      vale_pedagio_valor: document.getElementById('pag-vale-pedagio').value.trim() || null,
      dados_pagamento: document.getElementById('pag-dados-pagamento').value.trim() || null
    });
    exibirMensagem(msg, 'Dados salvos!', 'sucesso');
  } catch (err) {
    exibirMensagem(msg, err.message, 'erro');
  }
});

document.getElementById('btn-pag-copiar').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(document.getElementById('pag-preview').value);
    exibirMensagem(msg, 'Mensagem copiada!', 'sucesso');
  } catch {
    exibirMensagem(msg, 'Nao foi possivel copiar automaticamente. Selecione o texto da mensagem manualmente.', 'erro');
  }
});

// Sem numero de telefone cadastrado (motorista/veiculo nao tem esse campo),
// entao abre o seletor de conversa do proprio WhatsApp com o texto pronto.
document.getElementById('btn-pag-whatsapp').addEventListener('click', () => {
  const texto = document.getElementById('pag-preview').value;
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
});

document.getElementById('btn-pag-fechar').addEventListener('click', () => {
  window.close();
});

carregar();
