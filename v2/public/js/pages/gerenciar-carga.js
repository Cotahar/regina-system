import { apiGet, apiPut, apiPost, apiDelete } from '../shared/api.js';
import { escapeHtml } from '../shared/escape.js';
import { formatarMoeda, formatarPeso, parseDecimal } from '../shared/format.js';
import { exibirMensagem } from '../shared/ui.js';
import { criarCombobox } from '../shared/combobox.js';
import { aplicarMascaraDecimal, formatarDecimalParaInput } from '../shared/mask.js';

const cargaId = new URLSearchParams(window.location.search).get('carga_id');
const msg = document.getElementById('ger-msg');

let unidades = [];
let tiposCte = [];
let formasPagamento = [];
let motoristas = [];
let veiculos = [];
let entregas = [];
const selecionadas = new Set();

if (!cargaId) {
  document.body.innerHTML = '<p class="p-6 text-red-400">carga_id nao informado na URL.</p>';
  throw new Error('carga_id ausente');
}

criarCombobox({ input: document.getElementById('ger-motorista-input'), hidden: document.getElementById('ger-motorista-id'), getItens: () => motoristas });
criarCombobox({ input: document.getElementById('ger-veiculo-input'), hidden: document.getElementById('ger-veiculo-id'), getItens: () => veiculos });

aplicarMascaraDecimal(document.getElementById('ger-frete-pago'));
aplicarMascaraDecimal(document.getElementById('repasse-valor-combinado'));

// --- PREENCHIMENTO AUTOMATICO (baseado no REMETENTE + cadastro de Unidades) ---
function autoUnidadeTipoCte(entrega) {
  const remetenteUf = (entrega.remetente_uf || '').toUpperCase().trim();
  const porUf = remetenteUf ? unidades.find((u) => (u.uf || '').toUpperCase().trim() === remetenteUf) : null;
  if (porUf) return { unidadeId: porUf.id, tipoCteId: porUf.tipo_cte_padrao_id || null };

  const matriz = unidades.find((u) => u.is_matriz);
  if (matriz) return { unidadeId: matriz.id, tipoCteId: matriz.tipo_cte_outra_uf_id || matriz.tipo_cte_padrao_id || null };

  return { unidadeId: null, tipoCteId: null };
}

function autoFormaPagamento(entrega) {
  if (entrega.remetente_forma_padrao_id) {
    return { formaId: entrega.remetente_forma_padrao_id, tipo: entrega.remetente_tipo_padrao || null };
  }
  return { formaId: entrega.cliente_forma_padrao_id || null, tipo: entrega.cliente_tipo_padrao || null };
}

function opcoes(lista, valorSelecionado) {
  return '<option value="">-</option>' + lista.map((i) =>
    `<option value="${i.id}" ${i.id === valorSelecionado ? 'selected' : ''}>${escapeHtml(i.text || i.descricao)}</option>`
  ).join('');
}

function linhaTabela(e) {
  const { unidadeId, tipoCteId } = e.unidade_id || e.tipo_cte_id ? { unidadeId: e.unidade_id, tipoCteId: e.tipo_cte_id } : autoUnidadeTipoCte(e);
  const { formaId, tipo } = e.forma_pagamento_id || e.tipo_pagamento ? { formaId: e.forma_pagamento_id, tipo: e.tipo_pagamento } : autoFormaPagamento(e);

  const agrupada = !!e.grupo_id;
  const classeGrupo = agrupada ? 'bg-destaque/5 border-l-2 border-l-destaque' : '';

  return `
    <tr class="border-t border-painel-border ${classeGrupo}" data-id="${e.id}" data-remetente="${e.remetente_id || ''}" data-cliente="${e.cliente_id || ''}" data-cortesia="${e.is_cortesia ? '1' : '0'}" data-grupo="${e.grupo_id || ''}">
      <td class="py-1.5 px-1.5"><input type="checkbox" class="chk-linha" ${selecionadas.has(e.id) ? 'checked' : ''}></td>
      <td class="py-1 px-1.5 max-w-[11rem] whitespace-normal break-words">${escapeHtml(e.remetente_nome)}${agrupada ? ' <span class="rounded bg-amber-900/40 px-1 text-[10px] text-amber-300">grupo</span>' : ''}</td>
      <td class="py-1 px-1.5 max-w-[11rem] whitespace-normal break-words">${escapeHtml(e.cliente_nome)}</td>
      <td class="py-1 px-1"><input type="text" class="input-cell campo-nf" value="${escapeHtml(e.nota_fiscal || '')}"></td>
      <td class="py-1 px-1"><select class="input-cell campo-unidade">${opcoes(unidades, unidadeId)}</select></td>
      <td class="py-1 px-1"><select class="input-cell campo-tipo-cte">${opcoes(tiposCte, tipoCteId)}</select></td>
      <td class="py-1 px-1"><input type="text" class="input-cell campo-peso text-right" value="${formatarDecimalParaInput(e.peso_bruto)}"></td>
      <td class="py-1 px-1"><input type="text" class="input-cell campo-cubado text-right" value="${formatarDecimalParaInput(e.peso_cubado)}"></td>
      <td class="py-1 px-1"><input type="text" class="input-cell campo-ton text-right" value="${formatarDecimalParaInput(e.valor_tonelada)}"></td>
      <td class="py-1 px-1"><input type="text" class="input-cell campo-frete text-right" value="${formatarDecimalParaInput(e.valor_frete)}" ${e.is_cortesia ? 'readonly' : ''}></td>
      <td class="py-1 px-1"><select class="input-cell campo-forma">${opcoes(formasPagamento, formaId)}</select></td>
      <td class="py-1 px-1">
        <select class="input-cell campo-tipo-pgto">
          <option value="">-</option>
          <option value="Boleto" ${tipo === 'Boleto' ? 'selected' : ''}>Boleto</option>
          <option value="Transferencia" ${tipo === 'Transferencia' ? 'selected' : ''}>Transferencia</option>
        </select>
      </td>
      <td class="py-1 px-1.5 text-center"><input type="checkbox" class="campo-cortesia" ${e.is_cortesia ? 'checked' : ''}></td>
      <td class="py-1 px-1.5 text-right"><button type="button" class="btn-secondary btn-repasse btn-sm">Repasse</button></td>
    </tr>
  `;
}

function ligarCalculoFreteLinha(tr) {
  const pesoInput = tr.querySelector('.campo-peso');
  const cubadoInput = tr.querySelector('.campo-cubado');
  const tonInput = tr.querySelector('.campo-ton');
  const freteInput = tr.querySelector('.campo-frete');
  const cortesiaChk = tr.querySelector('.campo-cortesia');

  [pesoInput, cubadoInput, tonInput, freteInput].forEach(aplicarMascaraDecimal);

  const recalcular = () => {
    if (cortesiaChk.checked) return;
    const peso = parseDecimal(pesoInput.value) || 0;
    const cubado = parseDecimal(cubadoInput.value) || 0;
    const ton = parseDecimal(tonInput.value) || 0;
    const pesoConsiderado = cubado > peso ? cubado : peso;
    if (pesoConsiderado > 0 && ton > 0) {
      freteInput.value = formatarDecimalParaInput((pesoConsiderado / 1000) * ton);
    }
  };

  [pesoInput, cubadoInput, tonInput].forEach((input) => input.addEventListener('blur', recalcular));

  cortesiaChk.addEventListener('change', () => {
    freteInput.readOnly = cortesiaChk.checked;
    if (cortesiaChk.checked) freteInput.value = formatarDecimalParaInput(0);
  });
}

function renderizarTabela() {
  const tbody = document.getElementById('ger-tabela');
  tbody.innerHTML = entregas.map(linhaTabela).join('') ||
    '<tr><td colspan="14" class="py-3 text-center text-slate-400">Nenhuma entrega nesta carga.</td></tr>';

  tbody.querySelectorAll('tr[data-id]').forEach((tr) => {
    ligarCalculoFreteLinha(tr);
    const id = Number(tr.dataset.id);
    tr.querySelector('.chk-linha').addEventListener('change', (e) => {
      if (e.target.checked) selecionadas.add(id); else selecionadas.delete(id);
      atualizarTotaisSelecionados();
    });
    tr.querySelector('.btn-repasse').addEventListener('click', () => abrirRepasse(id));
  });

  atualizarTotaisGerais();
  atualizarTotaisSelecionados();
}

function somarCampo(lista, seletor) {
  return lista.reduce((acc, tr) => acc + (parseDecimal(tr.querySelector(seletor).value) || 0), 0);
}

function atualizarTotaisGerais() {
  const linhas = [...document.querySelectorAll('#ger-tabela tr[data-id]')];
  document.getElementById('total-geral-peso').textContent = formatarPeso(somarCampo(linhas, '.campo-peso'));
  document.getElementById('total-geral-cubado').textContent = formatarPeso(somarCampo(linhas, '.campo-cubado'));
  document.getElementById('total-geral-frete').textContent = formatarMoeda(somarCampo(linhas, '.campo-frete'));
}

function atualizarTotaisSelecionados() {
  const linhas = [...document.querySelectorAll('#ger-tabela tr[data-id]')].filter((tr) => selecionadas.has(Number(tr.dataset.id)));
  document.getElementById('total-sel-peso').textContent = formatarPeso(somarCampo(linhas, '.campo-peso'));
  document.getElementById('total-sel-cubado').textContent = formatarPeso(somarCampo(linhas, '.campo-cubado'));
  document.getElementById('total-sel-frete').textContent = formatarMoeda(somarCampo(linhas, '.campo-frete'));
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

  const selectsMassa = [
    ['bulk-unidade', unidades, 'Unidade (massa)'],
    ['bulk-tipo-cte', tiposCte, 'Tipo CT-e (massa)'],
    ['bulk-forma-pgto', formasPagamento, 'Forma Pgto (massa)']
  ];
  selectsMassa.forEach(([id, lista, rotulo]) => {
    document.getElementById(id).innerHTML = `<option value="">${rotulo}</option>` +
      lista.map((i) => `<option value="${i.id}">${escapeHtml(i.text || i.descricao)}</option>`).join('');
  });

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

document.getElementById('ger-chk-todas').addEventListener('change', (e) => {
  document.querySelectorAll('#ger-tabela .chk-linha').forEach((chk) => {
    chk.checked = e.target.checked;
    chk.dispatchEvent(new Event('change'));
  });
});

// --- REPASSE ---
function abrirRepasse(id) {
  const e = entregas.find((it) => it.id === id);
  if (!e) return;
  document.getElementById('repasse-entrega-id').value = id;
  document.getElementById('repasse-valor-combinado').value = e.valor_combinado ?? '';
  document.getElementById('repasse-destinatario').value = e.repasse_destinatario || '';
  document.getElementById('modal-repasse').classList.remove('hidden');
  document.getElementById('modal-repasse').classList.add('flex');
}
document.getElementById('btn-cancelar-repasse').addEventListener('click', () => {
  document.getElementById('modal-repasse').classList.add('hidden');
  document.getElementById('modal-repasse').classList.remove('flex');
});
document.getElementById('form-repasse').addEventListener('submit', (event) => {
  event.preventDefault();
  const id = Number(document.getElementById('repasse-entrega-id').value);
  const entrega = entregas.find((it) => it.id === id);
  if (entrega) {
    entrega.valor_combinado = parseDecimal(document.getElementById('repasse-valor-combinado').value);
    entrega.repasse_destinatario = document.getElementById('repasse-destinatario').value.trim() || null;
  }
  document.getElementById('modal-repasse').classList.add('hidden');
  document.getElementById('modal-repasse').classList.remove('flex');
  exibirMensagem(msg, 'Repasse definido. Clique em Salvar para gravar.', 'sucesso');
});

// --- AGRUPAR / DESAGRUPAR / EXCLUIR EM MASSA ---
document.getElementById('btn-agrupar').addEventListener('click', async () => {
  if (selecionadas.size < 2) return alert('Selecione pelo menos 2 entregas para agrupar.');
  try {
    await apiPost('/api/entregas/agrupar', { entrega_ids: [...selecionadas] });
    selecionadas.clear();
    await carregar();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('btn-desagrupar').addEventListener('click', async () => {
  const linhas = [...document.querySelectorAll('#ger-tabela tr[data-id]')].filter((tr) => selecionadas.has(Number(tr.dataset.id)));
  const grupos = new Set(linhas.map((tr) => tr.dataset.grupo).filter(Boolean));
  if (!grupos.size) return alert('Selecione entregas que estejam agrupadas.');
  try {
    for (const grupoId of grupos) {
      await apiPost('/api/entregas/desagrupar', { grupo_id: Number(grupoId) });
    }
    selecionadas.clear();
    await carregar();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('btn-excluir-selecionadas').addEventListener('click', async () => {
  if (!selecionadas.size) return alert('Nenhuma entrega selecionada.');
  if (!confirm(`Excluir/devolver ${selecionadas.size} entrega(s) selecionada(s)?`)) return;
  try {
    await apiDelete('/api/entregas/em-massa', { entrega_ids: [...selecionadas] });
    selecionadas.clear();
    await carregar();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('btn-aplicar-massa').addEventListener('click', () => {
  if (!selecionadas.size) return alert('Nenhuma entrega selecionada.');
  const unidadeVal = document.getElementById('bulk-unidade').value;
  const tipoCteVal = document.getElementById('bulk-tipo-cte').value;
  const formaVal = document.getElementById('bulk-forma-pgto').value;
  const tipoPgtoVal = document.getElementById('bulk-tipo-pgto').value;

  document.querySelectorAll('#ger-tabela tr[data-id]').forEach((tr) => {
    if (!selecionadas.has(Number(tr.dataset.id))) return;
    if (unidadeVal) tr.querySelector('.campo-unidade').value = unidadeVal;
    if (tipoCteVal) tr.querySelector('.campo-tipo-cte').value = tipoCteVal;
    if (formaVal) tr.querySelector('.campo-forma').value = formaVal;
    if (tipoPgtoVal) tr.querySelector('.campo-tipo-pgto').value = tipoPgtoVal;
  });

  exibirMensagem(msg, 'Valores aplicados as linhas selecionadas. Clique em Salvar para gravar.', 'sucesso');
});

// --- SALVAR ---
document.getElementById('btn-salvar').addEventListener('click', async () => {
  const linhas = [...document.querySelectorAll('#ger-tabela tr[data-id]')].map((tr) => {
    const id = Number(tr.dataset.id);
    const entregaOriginal = entregas.find((e) => e.id === id) || {};
    return {
      id,
      nota_fiscal: tr.querySelector('.campo-nf').value.trim() || null,
      unidade_id: tr.querySelector('.campo-unidade').value || null,
      tipo_cte_id: tr.querySelector('.campo-tipo-cte').value || null,
      peso_bruto: parseDecimal(tr.querySelector('.campo-peso').value),
      peso_cubado: parseDecimal(tr.querySelector('.campo-cubado').value),
      valor_tonelada: parseDecimal(tr.querySelector('.campo-ton').value),
      valor_frete: parseDecimal(tr.querySelector('.campo-frete').value),
      forma_pagamento_id: tr.querySelector('.campo-forma').value || null,
      tipo_pagamento: tr.querySelector('.campo-tipo-pgto').value || null,
      is_cortesia: tr.querySelector('.campo-cortesia').checked,
      valor_combinado: entregaOriginal.valor_combinado ?? null,
      repasse_destinatario: entregaOriginal.repasse_destinatario ?? null
    };
  });

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
    await carregar();
  } catch (err) {
    exibirMensagem(msg, err.message, 'erro');
  }
});

document.getElementById('btn-imprimir').addEventListener('click', () => {
  window.open(`/cargas/${cargaId}/relatorio_faturamento`, '_blank');
});

carregar();
