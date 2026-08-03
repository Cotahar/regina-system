import { apiGet, apiPut } from '../shared/api.js';
import { escapeHtml } from '../shared/escape.js';
import { formatarMoeda, parseDecimal } from '../shared/format.js';
import { exibirMensagem } from '../shared/ui.js';

const cargaId = new URLSearchParams(window.location.search).get('carga_id');
const msg = document.getElementById('ger-msg');

let unidades = [];
let tiposCte = [];
let formasPagamento = [];
let motoristas = [];
let veiculos = [];
let entregas = [];

if (!cargaId) {
  document.body.innerHTML = '<p class="p-6 text-red-400">carga_id nao informado na URL.</p>';
  throw new Error('carga_id ausente');
}

function ligarBuscaComId(inputId, hiddenId, itens) {
  const input = document.getElementById(inputId);
  const hidden = document.getElementById(hiddenId);
  input.addEventListener('input', () => {
    const item = itens.find((i) => i.text === input.value);
    hidden.value = item ? item.id : '';
  });
}

function preencherDatalist(id, itens) {
  document.getElementById(id).innerHTML = itens.map((i) => `<option value="${escapeHtml(i.text)}">`).join('');
}

function unidadeAutomatica(entrega) {
  if (entrega.unidade_id) return entrega.unidade_id;
  if (entrega.cliente_is_remetente && entrega.cliente_uf) {
    const porUf = unidades.find((u) => u.uf === entrega.cliente_uf);
    if (porUf) return porUf.id;
  }
  const matriz = unidades.find((u) => u.is_matriz);
  return matriz ? matriz.id : null;
}

function tipoCteAutomatico(unidadeId) {
  const unidade = unidades.find((u) => u.id === unidadeId);
  return unidade?.tipo_cte_padrao_id || null;
}

function opcoes(lista, valorSelecionado) {
  return `<option value="">-</option>` + lista.map((i) =>
    `<option value="${i.id}" ${i.id === valorSelecionado ? 'selected' : ''}>${escapeHtml(i.text || i.descricao)}</option>`
  ).join('');
}

function linhaTabela(e) {
  const unidadeId = unidadeAutomatica(e);
  const tipoCteId = e.tipo_cte_id || tipoCteAutomatico(unidadeId);
  const formaPagamentoId = e.forma_pagamento_id || e.cliente_forma_padrao_id;
  const tipoPagamento = e.tipo_pagamento || e.cliente_tipo_padrao;

  return `
    <tr class="border-t border-painel-border" data-id="${e.id}">
      <td class="py-1 pr-2">${escapeHtml(e.cliente_nome)}</td>
      <td class="py-1 pr-2"><input type="text" class="input-field campo-nf" value="${escapeHtml(e.nota_fiscal || '')}"></td>
      <td class="py-1 pr-2"><select class="input-field campo-unidade">${opcoes(unidades, unidadeId)}</select></td>
      <td class="py-1 pr-2"><select class="input-field campo-tipo-cte">${opcoes(tiposCte, tipoCteId)}</select></td>
      <td class="py-1 pr-2"><input type="text" class="input-field campo-peso" value="${e.peso_bruto ?? ''}"></td>
      <td class="py-1 pr-2"><input type="text" class="input-field campo-cubado" value="${e.peso_cubado ?? ''}"></td>
      <td class="py-1 pr-2"><input type="text" class="input-field campo-ton" value="${e.valor_tonelada ?? ''}"></td>
      <td class="py-1 pr-2"><input type="text" class="input-field campo-frete" value="${e.valor_frete ?? ''}"></td>
      <td class="py-1 pr-2"><select class="input-field campo-forma">${opcoes(formasPagamento, formaPagamentoId)}</select></td>
      <td class="py-1 pr-2">
        <select class="input-field campo-tipo-pgto">
          <option value="">-</option>
          <option value="Boleto" ${tipoPagamento === 'Boleto' ? 'selected' : ''}>Boleto</option>
          <option value="Transferencia" ${tipoPagamento === 'Transferencia' ? 'selected' : ''}>Transferencia</option>
        </select>
      </td>
    </tr>
  `;
}

function ligarCalculoFreteLinha(tr) {
  const pesoInput = tr.querySelector('.campo-peso');
  const cubadoInput = tr.querySelector('.campo-cubado');
  const tonInput = tr.querySelector('.campo-ton');
  const freteInput = tr.querySelector('.campo-frete');

  const recalcular = () => {
    const peso = parseDecimal(pesoInput.value) || 0;
    const cubado = parseDecimal(cubadoInput.value) || 0;
    const ton = parseDecimal(tonInput.value) || 0;
    const pesoConsiderado = cubado > peso ? cubado : peso;
    if (pesoConsiderado > 0 && ton > 0) {
      freteInput.value = ((pesoConsiderado / 1000) * ton).toFixed(2).replace('.', ',');
    }
  };

  [pesoInput, cubadoInput, tonInput].forEach((input) => input.addEventListener('blur', recalcular));
}

function renderizarTabela() {
  const tbody = document.getElementById('ger-tabela');
  tbody.innerHTML = entregas.map(linhaTabela).join('') ||
    '<tr><td colspan="10" class="py-3 text-center text-slate-500">Nenhuma entrega nesta carga.</td></tr>';
  tbody.querySelectorAll('tr[data-id]').forEach(ligarCalculoFreteLinha);
}

function recalcularAdiantamento() {
  const fretePago = parseDecimal(document.getElementById('ger-frete-pago').value) || 0;
  const percentual = Number(document.getElementById('ger-adiant-percentual').value) || 0;
  document.getElementById('ger-adiant-valor').value = formatarMoeda((fretePago * percentual) / 100);
}

async function carregar() {
  [unidades, tiposCte, formasPagamento, motoristas, veiculos] = await Promise.all([
    apiGet('/api/auxiliar/unidades'),
    apiGet('/api/auxiliar/tipos-cte'),
    apiGet('/api/auxiliar/formas-pagamento'),
    apiGet('/api/motoristas'),
    apiGet('/api/veiculos')
  ]);
  preencherDatalist('lista-motoristas', motoristas);
  preencherDatalist('lista-veiculos', veiculos);
  ligarBuscaComId('ger-motorista-input', 'ger-motorista-id', motoristas);
  ligarBuscaComId('ger-veiculo-input', 'ger-veiculo-id', veiculos);

  const data = await apiGet(`/api/cargas/${cargaId}/gerenciar`);
  const c = data.carga;
  entregas = data.entregas;

  document.getElementById('ger-codigo').textContent = c.codigo_carga;
  document.getElementById('ger-motorista-input').value = c.motorista_nome || '';
  document.getElementById('ger-motorista-id').value = c.motorista_id || '';
  document.getElementById('ger-veiculo-input').value = c.placa_veiculo || '';
  document.getElementById('ger-veiculo-id').value = c.veiculo_id || '';
  document.getElementById('ger-rota').value = c.rota_manifesto || '';
  document.getElementById('ger-vp-marca').value = c.vale_pedagio_marca || '';
  document.getElementById('ger-vp-rota').value = c.vale_pedagio_rota || '';
  document.getElementById('ger-vp-eixos').value = c.vale_pedagio_eixos ?? '';
  document.getElementById('ger-frete-pago').value = c.frete_pago ?? '';
  document.getElementById('ger-adiant-percentual').value = c.adiantamento_percentual ?? 70;
  document.getElementById('ger-observacoes').value = c.observacoes_faturamento || '';
  recalcularAdiantamento();

  renderizarTabela();
}

document.getElementById('ger-frete-pago').addEventListener('blur', recalcularAdiantamento);
document.getElementById('ger-adiant-percentual').addEventListener('input', recalcularAdiantamento);

document.getElementById('btn-salvar').addEventListener('click', async () => {
  const linhas = [...document.querySelectorAll('#ger-tabela tr[data-id]')].map((tr) => ({
    id: Number(tr.dataset.id),
    nota_fiscal: tr.querySelector('.campo-nf').value.trim() || null,
    unidade_id: tr.querySelector('.campo-unidade').value || null,
    tipo_cte_id: tr.querySelector('.campo-tipo-cte').value || null,
    peso_bruto: parseDecimal(tr.querySelector('.campo-peso').value),
    peso_cubado: parseDecimal(tr.querySelector('.campo-cubado').value),
    valor_tonelada: parseDecimal(tr.querySelector('.campo-ton').value),
    valor_frete: parseDecimal(tr.querySelector('.campo-frete').value),
    forma_pagamento_id: tr.querySelector('.campo-forma').value || null,
    tipo_pagamento: tr.querySelector('.campo-tipo-pgto').value || null
  }));

  const fretePago = parseDecimal(document.getElementById('ger-frete-pago').value);
  const percentual = Number(document.getElementById('ger-adiant-percentual').value) || null;
  const adiantamentoValor = fretePago && percentual ? (fretePago * percentual) / 100 : null;

  try {
    await apiPut(`/api/cargas/${cargaId}/gerenciar`, {
      carga: {
        motorista_id: document.getElementById('ger-motorista-id').value || null,
        veiculo_id: document.getElementById('ger-veiculo-id').value || null,
        rota_manifesto: document.getElementById('ger-rota').value.trim(),
        vale_pedagio_marca: document.getElementById('ger-vp-marca').value.trim(),
        vale_pedagio_rota: document.getElementById('ger-vp-rota').value.trim(),
        vale_pedagio_eixos: Number(document.getElementById('ger-vp-eixos').value) || null,
        frete_pago: fretePago,
        adiantamento_percentual: percentual,
        adiantamento_valor: adiantamentoValor,
        observacoes_faturamento: document.getElementById('ger-observacoes').value.trim()
      },
      entregas: linhas
    });
    exibirMensagem(msg, 'Dados salvos com sucesso!', 'sucesso');
  } catch (err) {
    exibirMensagem(msg, err.message, 'erro');
  }
});

document.getElementById('btn-imprimir').addEventListener('click', () => {
  window.open(`/cargas/${cargaId}/relatorio_faturamento`, '_blank');
});

carregar();
