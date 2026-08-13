import { apiGet, apiPut, apiPost, apiDelete } from '../shared/api.js';
import { escapeHtml } from '../shared/escape.js';
import { formatarMoeda, formatarPeso, parseDecimal } from '../shared/format.js';
import { exibirMensagem } from '../shared/ui.js';
import { criarCombobox } from '../shared/combobox.js';
import { aplicarMascaraDecimal, formatarDecimalParaInput } from '../shared/mask.js';
import { iconeMenuAcoes, criarMenuAcoes } from '../shared/menuAcoes.js';

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

  return `
    <tr class="border-t border-painel-border" data-id="${e.id}" data-remetente="${e.remetente_id || ''}" data-cliente="${e.cliente_id || ''}" data-cortesia="${e.is_cortesia ? '1' : '0'}">
      <td class="py-1.5 px-1.5"><input type="checkbox" class="chk-linha" ${selecionadas.has(e.id) ? 'checked' : ''}></td>
      <td class="py-1 px-1.5 max-w-[11rem] whitespace-normal break-words">${escapeHtml(e.remetente_nome)}</td>
      <td class="py-1 px-1.5 max-w-[11rem] whitespace-normal break-words">${escapeHtml(e.cliente_nome)}</td>
      <td class="py-1 px-1"><input type="text" class="input-cell campo-nf" value="${escapeHtml(e.nota_fiscal || '')}"></td>
      <td class="py-1 px-1"><select class="input-cell input-cell-select campo-unidade">${opcoes(unidades, unidadeId)}</select></td>
      <td class="py-1 px-1"><select class="input-cell input-cell-select campo-tipo-cte">${opcoes(tiposCte, tipoCteId)}</select></td>
      <td class="py-1 px-1"><input type="text" class="input-cell campo-peso text-right" value="${formatarDecimalParaInput(e.peso_bruto)}"></td>
      <td class="py-1 px-1"><input type="text" class="input-cell campo-cubado text-right" value="${formatarDecimalParaInput(e.peso_cubado)}"></td>
      <td class="py-1 px-1"><input type="text" class="input-cell campo-ton text-right" value="${formatarDecimalParaInput(e.valor_tonelada)}"></td>
      <td class="py-1 px-1"><input type="text" class="input-cell campo-frete text-right" value="${formatarDecimalParaInput(e.valor_frete)}" ${e.is_cortesia ? 'readonly' : ''}></td>
      <td class="py-1 px-1"><select class="input-cell input-cell-select campo-forma">${opcoes(formasPagamento, formaId)}</select></td>
      <td class="py-1 px-1">
        <select class="input-cell input-cell-select campo-tipo-pgto">
          <option value="">-</option>
          <option value="Boleto" ${tipo === 'Boleto' ? 'selected' : ''}>Boleto</option>
          <option value="Transferencia" ${tipo === 'Transferencia' ? 'selected' : ''}>Transferencia</option>
        </select>
      </td>
      <td class="py-1 px-1.5 text-center"><input type="checkbox" class="campo-cortesia" ${e.is_cortesia ? 'checked' : ''}></td>
      <td class="py-1 px-1.5 text-right">${iconeMenuAcoes()}</td>
    </tr>
  `;
}

// Linha "mesclada": representa varias entregas (mesmo grupo_id) numa unica <tr>
// para emissao de um unico CT-e. NF/peso/cubado/frete ficam somente leitura
// (somados/concatenados) - quem quiser editar esses valores precisa desagrupar.
function linhaGrupo(membros) {
  const primeiro = membros[0];
  const { unidadeId, tipoCteId } = primeiro.unidade_id || primeiro.tipo_cte_id
    ? { unidadeId: primeiro.unidade_id, tipoCteId: primeiro.tipo_cte_id }
    : autoUnidadeTipoCte(primeiro);
  const { formaId, tipo } = primeiro.forma_pagamento_id || primeiro.tipo_pagamento
    ? { formaId: primeiro.forma_pagamento_id, tipo: primeiro.tipo_pagamento }
    : autoFormaPagamento(primeiro);

  const nfJunta = membros.map((m) => m.nota_fiscal).filter(Boolean).join(' / ');
  const pesoTotal = membros.reduce((acc, m) => acc + (m.peso_bruto || 0), 0);
  const cubadoTotal = membros.reduce((acc, m) => acc + (m.peso_cubado || 0), 0);
  const freteTotal = membros.reduce((acc, m) => acc + (m.valor_frete || 0), 0);
  const isCortesia = !!primeiro.is_cortesia;
  const idsCsv = membros.map((m) => m.id).join(',');
  const marcada = membros.every((m) => selecionadas.has(m.id));

  return `
    <tr class="border-t border-painel-border bg-destaque/5 border-l-2 border-l-destaque" data-ids="${idsCsv}" data-grupo="${primeiro.grupo_id}" data-remetente="${primeiro.remetente_id || ''}" data-cliente="${primeiro.cliente_id || ''}" data-cortesia="${isCortesia ? '1' : '0'}">
      <td class="py-1.5 px-1.5"><input type="checkbox" class="chk-linha" ${marcada ? 'checked' : ''}></td>
      <td class="py-1 px-1.5 max-w-[11rem] whitespace-normal break-words">${escapeHtml(primeiro.remetente_nome)} <span class="rounded bg-amber-900/40 px-1 text-[10px] text-amber-300">${membros.length} notas</span></td>
      <td class="py-1 px-1.5 max-w-[11rem] whitespace-normal break-words">${escapeHtml(primeiro.cliente_nome)}</td>
      <td class="py-1 px-1"><input type="text" class="input-cell campo-nf font-semibold text-amber-300" value="${escapeHtml(nfJunta)}" readonly title="Notas do grupo - desagrupe para editar individualmente"></td>
      <td class="py-1 px-1"><select class="input-cell input-cell-select campo-unidade">${opcoes(unidades, unidadeId)}</select></td>
      <td class="py-1 px-1"><select class="input-cell input-cell-select campo-tipo-cte">${opcoes(tiposCte, tipoCteId)}</select></td>
      <td class="py-1 px-1"><input type="text" class="input-cell campo-peso text-right font-semibold text-amber-300" value="${formatarDecimalParaInput(pesoTotal)}" readonly></td>
      <td class="py-1 px-1"><input type="text" class="input-cell campo-cubado text-right font-semibold text-amber-300" value="${formatarDecimalParaInput(cubadoTotal)}" readonly></td>
      <td class="py-1 px-1 text-right text-slate-500">-</td>
      <td class="py-1 px-1"><input type="text" class="input-cell campo-frete text-right font-semibold text-amber-300" value="${isCortesia ? '' : formatarDecimalParaInput(freteTotal)}" placeholder="${isCortesia ? 'Cortesia' : ''}" readonly></td>
      <td class="py-1 px-1"><select class="input-cell input-cell-select campo-forma">${opcoes(formasPagamento, formaId)}</select></td>
      <td class="py-1 px-1">
        <select class="input-cell input-cell-select campo-tipo-pgto">
          <option value="">-</option>
          <option value="Boleto" ${tipo === 'Boleto' ? 'selected' : ''}>Boleto</option>
          <option value="Transferencia" ${tipo === 'Transferencia' ? 'selected' : ''}>Transferencia</option>
        </select>
      </td>
      <td class="py-1 px-1.5 text-center"><input type="checkbox" class="campo-cortesia" ${isCortesia ? 'checked' : ''} disabled title="Desagrupe para alterar cortesia"></td>
      <td class="py-1 px-1.5 text-right">${iconeMenuAcoes()}</td>
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

  const gruposMap = new Map();
  entregas.forEach((e) => {
    if (!e.grupo_id) return;
    if (!gruposMap.has(e.grupo_id)) gruposMap.set(e.grupo_id, []);
    gruposMap.get(e.grupo_id).push(e);
  });

  const jaRenderizado = new Set();
  const linhasHtml = [];
  entregas.forEach((e) => {
    if (jaRenderizado.has(e.id)) return;
    const membros = e.grupo_id ? gruposMap.get(e.grupo_id) : null;
    if (membros && membros.length > 1) {
      linhasHtml.push(linhaGrupo(membros));
      membros.forEach((m) => jaRenderizado.add(m.id));
    } else {
      linhasHtml.push(linhaTabela(e));
      jaRenderizado.add(e.id);
    }
  });

  tbody.innerHTML = linhasHtml.join('') ||
    '<tr><td colspan="14" class="py-3 text-center text-slate-400">Nenhuma entrega nesta carga.</td></tr>';

  tbody.querySelectorAll('tr[data-id]').forEach((tr) => {
    ligarCalculoFreteLinha(tr);
    const id = Number(tr.dataset.id);
    tr.querySelector('.chk-linha').addEventListener('change', (e) => {
      if (e.target.checked) selecionadas.add(id); else selecionadas.delete(id);
      atualizarTotaisSelecionados();
    });
    criarMenuAcoes(tr.querySelector('.btn-menu-acoes'), [
      { label: 'Repasse', onClick: () => abrirRepasse(id) }
    ]);
  });

  tbody.querySelectorAll('tr[data-ids]').forEach((tr) => {
    const ids = tr.dataset.ids.split(',').map(Number);
    tr.querySelector('.chk-linha').addEventListener('change', (e) => {
      ids.forEach((id) => {
        if (e.target.checked) selecionadas.add(id); else selecionadas.delete(id);
      });
      atualizarTotaisSelecionados();
    });
    criarMenuAcoes(tr.querySelector('.btn-menu-acoes'), [
      { label: 'Desagrupar', onClick: () => desagruparGrupo(Number(tr.dataset.grupo)) }
    ]);
  });

  atualizarTotaisGerais();
  atualizarTotaisSelecionados();
}

function somarCampo(lista, seletor) {
  return lista.reduce((acc, tr) => acc + (parseDecimal(tr.querySelector(seletor).value) || 0), 0);
}

function todasAsLinhas() {
  return [...document.querySelectorAll('#ger-tabela tr[data-id], #ger-tabela tr[data-ids]')];
}

function atualizarTotaisGerais() {
  const linhas = todasAsLinhas();
  document.getElementById('total-geral-peso').textContent = formatarPeso(somarCampo(linhas, '.campo-peso'));
  document.getElementById('total-geral-cubado').textContent = formatarPeso(somarCampo(linhas, '.campo-cubado'));
  document.getElementById('total-geral-frete').textContent = formatarMoeda(somarCampo(linhas, '.campo-frete'));
}

function atualizarTotaisSelecionados() {
  const linhas = todasAsLinhas().filter((tr) => tr.querySelector('.chk-linha').checked);
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
document.getElementById('form-repasse').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = Number(document.getElementById('repasse-entrega-id').value);
  const entrega = entregas.find((it) => it.id === id);
  if (entrega) {
    entrega.valor_combinado = parseDecimal(document.getElementById('repasse-valor-combinado').value);
    entrega.repasse_destinatario = document.getElementById('repasse-destinatario').value.trim() || null;
  }
  document.getElementById('modal-repasse').classList.add('hidden');
  document.getElementById('modal-repasse').classList.remove('flex');
  try {
    await salvarTudo();
    await carregar();
    exibirMensagem(msg, 'Repasse salvo com sucesso!', 'sucesso');
  } catch (err) {
    exibirMensagem(msg, err.message, 'erro');
  }
});

// --- AGRUPAR / DESAGRUPAR / EXCLUIR EM MASSA ---
// Toda acao (agrupar, desagrupar, excluir, aplicar em massa, repasse) salva
// primeiro as edicoes pendentes e recarrega em seguida - nao existe mais um
// estado "aplicado mas nao salvo" esperando um clique manual em Salvar.
document.getElementById('btn-agrupar').addEventListener('click', async () => {
  if (selecionadas.size < 2) return alert('Selecione pelo menos 2 entregas para agrupar.');
  try {
    await salvarTudo();
    await apiPost('/api/entregas/agrupar', { entrega_ids: [...selecionadas] });
    selecionadas.clear();
    await carregar();
    exibirMensagem(msg, 'Entregas agrupadas com sucesso!', 'sucesso');
  } catch (err) {
    exibirMensagem(msg, err.message, 'erro');
  }
});

async function desagruparGrupo(grupoId) {
  try {
    await salvarTudo();
    await apiPost('/api/entregas/desagrupar', { grupo_id: grupoId });
    selecionadas.clear();
    await carregar();
    exibirMensagem(msg, 'Grupo desfeito.', 'sucesso');
  } catch (err) {
    exibirMensagem(msg, err.message, 'erro');
  }
}

document.getElementById('btn-desagrupar').addEventListener('click', async () => {
  const grupos = new Set(entregas.filter((e) => selecionadas.has(e.id) && e.grupo_id).map((e) => e.grupo_id));
  if (!grupos.size) return alert('Selecione entregas que estejam agrupadas.');
  try {
    await salvarTudo();
    for (const grupoId of grupos) {
      await apiPost('/api/entregas/desagrupar', { grupo_id: grupoId });
    }
    selecionadas.clear();
    await carregar();
    exibirMensagem(msg, 'Grupo(s) desfeito(s).', 'sucesso');
  } catch (err) {
    exibirMensagem(msg, err.message, 'erro');
  }
});

document.getElementById('btn-excluir-selecionadas').addEventListener('click', async () => {
  if (!selecionadas.size) return alert('Nenhuma entrega selecionada.');
  if (!confirm(`Excluir/devolver ${selecionadas.size} entrega(s) selecionada(s)?`)) return;
  try {
    await apiDelete('/api/entregas/em-massa', { entrega_ids: [...selecionadas] });
    selecionadas.clear();
    await carregar();
    exibirMensagem(msg, 'Entregas removidas com sucesso!', 'sucesso');
  } catch (err) {
    exibirMensagem(msg, err.message, 'erro');
  }
});

document.getElementById('btn-aplicar-massa').addEventListener('click', async () => {
  if (!selecionadas.size) return alert('Nenhuma entrega selecionada.');
  const unidadeVal = document.getElementById('bulk-unidade').value;
  const tipoCteVal = document.getElementById('bulk-tipo-cte').value;
  const formaVal = document.getElementById('bulk-forma-pgto').value;
  const tipoPgtoVal = document.getElementById('bulk-tipo-pgto').value;

  todasAsLinhas().forEach((tr) => {
    if (!tr.querySelector('.chk-linha').checked) return;
    if (unidadeVal) tr.querySelector('.campo-unidade').value = unidadeVal;
    if (tipoCteVal) tr.querySelector('.campo-tipo-cte').value = tipoCteVal;
    if (formaVal) tr.querySelector('.campo-forma').value = formaVal;
    if (tipoPgtoVal) tr.querySelector('.campo-tipo-pgto').value = tipoPgtoVal;
  });

  try {
    await salvarTudo();
    await carregar();
    exibirMensagem(msg, 'Valores aplicados e salvos com sucesso!', 'sucesso');
  } catch (err) {
    exibirMensagem(msg, err.message, 'erro');
  }
});

// --- SALVAR ---
// salvarTudo() le tanto linhas individuais (tr[data-id]) quanto linhas de
// grupo mescladas (tr[data-ids]). Para uma linha de grupo, NF/peso/cubado/ton/
// frete/cortesia de cada membro sao mantidos como estao (nao sao editaveis na
// linha mesclada) - so unidade/tipo CT-e/forma/tipo de pagamento, escolhidos
// na linha mesclada, sao propagados para todos os membros do grupo.
async function salvarTudo() {
  const linhas = [];

  document.querySelectorAll('#ger-tabela tr[data-id]').forEach((tr) => {
    const id = Number(tr.dataset.id);
    const entregaOriginal = entregas.find((e) => e.id === id) || {};
    linhas.push({
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
    });
  });

  document.querySelectorAll('#ger-tabela tr[data-ids]').forEach((tr) => {
    const ids = tr.dataset.ids.split(',').map(Number);
    const unidadeVal = tr.querySelector('.campo-unidade').value || null;
    const tipoCteVal = tr.querySelector('.campo-tipo-cte').value || null;
    const formaVal = tr.querySelector('.campo-forma').value || null;
    const tipoPgtoVal = tr.querySelector('.campo-tipo-pgto').value || null;

    ids.forEach((id) => {
      const original = entregas.find((e) => e.id === id) || {};
      linhas.push({
        id,
        nota_fiscal: original.nota_fiscal ?? null,
        unidade_id: unidadeVal,
        tipo_cte_id: tipoCteVal,
        peso_bruto: original.peso_bruto ?? null,
        peso_cubado: original.peso_cubado ?? null,
        valor_tonelada: original.valor_tonelada ?? null,
        valor_frete: original.valor_frete ?? null,
        forma_pagamento_id: formaVal,
        tipo_pagamento: tipoPgtoVal,
        is_cortesia: !!original.is_cortesia,
        valor_combinado: original.valor_combinado ?? null,
        repasse_destinatario: original.repasse_destinatario ?? null
      });
    });
  });

  const fretePago = parseDecimal(document.getElementById('ger-frete-pago').value);
  const percentual = Number(document.getElementById('ger-adiant-percentual').value) || null;
  const adiantamentoValor = fretePago && percentual ? (fretePago * percentual) / 100 : null;
  const eixosValor = document.getElementById('ger-vp-eixos').value.trim();

  await apiPut(`/api/cargas/${cargaId}/gerenciar`, {
    carga: {
      motorista_id: document.getElementById('ger-motorista-id').value || null,
      veiculo_id: document.getElementById('ger-veiculo-id').value || null,
      rota_manifesto: document.getElementById('ger-rota').value.trim() || null,
      vale_pedagio_marca: document.getElementById('ger-vp-marca').value.trim() || null,
      vale_pedagio_rota: document.getElementById('ger-vp-rota').value.trim() || null,
      vale_pedagio_eixos: eixosValor ? Number(eixosValor) : null,
      frete_pago: fretePago,
      adiantamento_percentual: percentual,
      adiantamento_valor: adiantamentoValor,
      observacoes_faturamento: document.getElementById('ger-observacoes').value.trim() || null
    },
    entregas: linhas
  });
}

async function salvarEExibirMensagem() {
  try {
    await salvarTudo();
    exibirMensagem(msg, 'Dados salvos com sucesso!', 'sucesso');
    await carregar();
  } catch (err) {
    exibirMensagem(msg, err.message, 'erro');
  }
}

document.getElementById('btn-salvar').addEventListener('click', salvarEExibirMensagem);
document.getElementById('btn-salvar-rapido').addEventListener('click', salvarEExibirMensagem);

document.getElementById('btn-imprimir').addEventListener('click', () => {
  window.open(`/cargas/${cargaId}/relatorio_faturamento`, '_blank');
});

carregar();
