import { apiGet, apiPost, apiPut, apiDelete } from '../shared/api.js';
import { escapeHtml } from '../shared/escape.js';
import { formatarMoeda, formatarPeso, parseDecimal } from '../shared/format.js';
import { exibirMensagem, abrirModal, fecharModal } from '../shared/ui.js';
import { ouvirMudancas } from '../shared/live.js';
import { criarCombobox } from '../shared/combobox.js';
import { criarComboboxMunicipio } from '../shared/municipio.js';
import { criarFiltroMultiSelect } from '../shared/multiSelect.js';
import { iconeMenuAcoes, criarMenuAcoes } from '../shared/menuAcoes.js';
import { aplicarMascaraDecimal, ligarCalculadoraFretePorTonelada } from '../shared/mask.js';

criarComboboxMunicipio({ inputCidade: document.getElementById('nova-cidade'), inputUf: document.getElementById('nova-estado') });

['nova-peso', 'nova-cubado', 'nova-frete', 'nova-tonelada', 'edit-peso', 'edit-cubado', 'edit-frete', 'edit-tonelada']
  .forEach((id) => aplicarMascaraDecimal(document.getElementById(id)));

ligarCalculadoraFretePorTonelada({
  pesoBrutoInput: document.getElementById('nova-peso'),
  pesoCubadoInput: document.getElementById('nova-cubado'),
  valorTonInput: document.getElementById('nova-tonelada'),
  valorFreteInput: document.getElementById('nova-frete')
});
ligarCalculadoraFretePorTonelada({
  pesoBrutoInput: document.getElementById('edit-peso'),
  pesoCubadoInput: document.getElementById('edit-cubado'),
  valorTonInput: document.getElementById('edit-tonelada'),
  valorFreteInput: document.getElementById('edit-frete')
});

let clientes = [];
let poolDisponiveis = [];
let draftAtual = null; // { id, codigo_carga, origem, entregas: [...] }
let rascunhos = [];
const selecionados = new Set();

const tabela = document.getElementById('tabela-entregas');
const origemInput = document.getElementById('origem-rascunho');
const filtro = document.getElementById('filtro-busca');

function comboboxCliente(prefixo) {
  criarCombobox({
    input: document.getElementById(`${prefixo}-input`),
    hidden: document.getElementById(`${prefixo}-id`),
    getItens: () => clientes
  });
}
['nova-remetente', 'edit-remetente', 'lote-remetente', 'nova-cliente'].forEach(comboboxCliente);

function linhasCombinadas() {
  const doDraft = draftAtual ? draftAtual.entregas : [];
  return [...poolDisponiveis, ...doDraft];
}

// Opcoes dos filtros vem so do pool de disponiveis (nao do rascunho aberto)
// - pedido explicito: nao repetir valores e nao considerar rascunhos.
function valoresUnicos(campo) {
  return [...new Set(poolDisponiveis.map((e) => (e[campo] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

const filtroRemetente = criarFiltroMultiSelect({
  botao: document.getElementById('filtro-remetente'),
  getOpcoes: () => valoresUnicos('remetente_nome'),
  onChange: renderizarTabela
});
const filtroUfOrigem = criarFiltroMultiSelect({
  botao: document.getElementById('filtro-uf-origem'),
  getOpcoes: () => valoresUnicos('remetente_uf'),
  onChange: renderizarTabela
});
const filtroCidadeDestino = criarFiltroMultiSelect({
  botao: document.getElementById('filtro-cidade-destino'),
  getOpcoes: () => valoresUnicos('cidade_entrega'),
  onChange: renderizarTabela
});
const filtroUfDestino = criarFiltroMultiSelect({
  botao: document.getElementById('filtro-uf-destino'),
  getOpcoes: () => valoresUnicos('estado_entrega'),
  onChange: renderizarTabela
});

const gruposExpandidos = new Set();

// Agrupa so para exibicao (mesmo destinatario + mesma cidade/UF) - nao tem
// relacao com o agrupamento de faturamento (grupo_id). Ajuda a nao repetir
// N linhas identicas quando ha varias notas pro mesmo lugar.
function agruparParaExibicao(entregas) {
  const mapa = new Map();
  const ordem = [];
  for (const e of entregas) {
    const chave = `${e.cliente_id}|${(e.cidade_entrega || '').trim().toUpperCase()}|${(e.estado_entrega || '').trim().toUpperCase()}`;
    if (!mapa.has(chave)) { mapa.set(chave, []); ordem.push(chave); }
    mapa.get(chave).push(e);
  }
  return ordem.map((chave) => ({ chave, itens: mapa.get(chave) }));
}

function linhaEntrega(e, indentada) {
  const agrupada = !!e.grupo_id;
  const classeGrupo = agrupada ? 'bg-destaque/5 border-l-2 border-l-destaque' : '';
  const classeIndentada = indentada ? 'bg-blue-500/10 border-l-4 border-l-blue-500/40' : '';
  // Linhas que ja fazem parte do rascunho aberto ganham um tom diferente pra
  // separar visualmente do que ainda esta so disponivel na pool.
  const classeRascunho = e._rascunho ? 'bg-violet-500/10 border-l-4 border-l-violet-500/50' : '';
  return `
    <tr class="border-t border-painel-border transition-colors ${classeGrupo} ${classeIndentada} ${classeRascunho}" data-id="${e.id}" data-remetente="${e.remetente_id || ''}" data-cliente="${e.cliente_id || ''}" data-cortesia="${e.is_cortesia ? '1' : '0'}" data-grupo="${e.grupo_id || ''}">
      <td class="py-1.5"><input type="checkbox" class="chk-linha" ${selecionados.has(e.id) ? 'checked' : ''}></td>
      <td class="py-1.5">${escapeHtml(e.remetente_nome)}${agrupada ? ' <span class="rounded bg-amber-900/40 px-1 text-[10px] text-amber-300">grupo</span>' : ''}${e._rascunho ? ' <span class="rounded bg-violet-900/40 px-1 text-[10px] text-violet-300">rascunho</span>' : ''}</td>
      <td class="py-1.5">${escapeHtml(e.destinatario_nome)}</td>
      <td class="py-1.5">${escapeHtml(e.cidade_entrega || '')}-${escapeHtml(e.estado_entrega || '')}${e.local_coleta ? `<br><span class="text-[10px] text-slate-400">coleta: ${escapeHtml(e.local_coleta)}</span>` : ''}</td>
      <td class="py-1.5">${escapeHtml(e.nota_fiscal || '')}${e.is_cortesia ? ' <span class="rounded bg-emerald-900/40 px-1 text-[10px] text-emerald-300">cortesia</span>' : ''}</td>
      <td class="py-1.5">${formatarPeso(e.peso_bruto)}</td>
      <td class="py-1.5">${formatarPeso(e.peso_cubado)}</td>
      <td class="py-1.5">${formatarMoeda(e.valor_frete)}</td>
      <td class="py-1.5 text-right">${iconeMenuAcoes()}</td>
    </tr>
  `;
}

function linhaResumoGrupo(chave, itens, expandido) {
  const remetentes = new Set(itens.map((e) => e.remetente_nome));
  const remetenteTexto = remetentes.size === 1 ? escapeHtml([...remetentes][0]) : '<span class="italic text-slate-400">Varios</span>';
  const primeiro = itens[0];
  const pesoTotal = itens.reduce((acc, e) => acc + (e.peso_bruto || 0), 0);
  const cubadoTotal = itens.reduce((acc, e) => acc + (e.peso_cubado || 0), 0);
  const freteTotal = itens.reduce((acc, e) => acc + (e.valor_frete || 0), 0);
  const todosSelecionados = itens.every((e) => selecionados.has(e.id));
  const todosRascunho = itens.every((e) => e._rascunho);
  const corGrupo = todosRascunho
    ? 'bg-violet-500/10 border-l-4 border-l-violet-500/50'
    : expandido
      ? 'bg-blue-500/15 border-l-4 border-l-blue-500'
      : 'bg-blue-500/5 border-l-4 border-l-blue-500/40 hover:bg-blue-500/10';
  return `
    <tr class="border-t border-painel-border transition-colors ${corGrupo}" data-grupo-visual="${escapeHtml(chave)}">
      <td class="py-1.5"><input type="checkbox" class="chk-grupo-visual" data-chave="${escapeHtml(chave)}" ${todosSelecionados ? 'checked' : ''}></td>
      <td class="py-1.5">${remetenteTexto}</td>
      <td class="py-1.5">
        <button type="button" class="btn-expandir-grupo inline-flex items-center gap-1.5 font-semibold text-blue-300 hover:text-blue-200" data-chave="${escapeHtml(chave)}">
          <svg viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3 shrink-0 transition-transform ${expandido ? 'rotate-90' : ''}"><path d="M7 4l7 6-7 6V4z"/></svg>
          ${escapeHtml(primeiro.destinatario_nome)}
        </button>
        <span class="ml-1 rounded-full bg-blue-500/25 px-1.5 py-0.5 text-[10px] font-medium text-blue-200">${itens.length} notas</span>
        ${todosRascunho ? '<span class="ml-1 rounded bg-violet-900/40 px-1 text-[10px] text-violet-300">rascunho</span>' : ''}
      </td>
      <td class="py-1.5">${escapeHtml(primeiro.cidade_entrega || '')}-${escapeHtml(primeiro.estado_entrega || '')}</td>
      <td class="py-1.5 text-slate-400">-</td>
      <td class="py-1.5 font-semibold text-blue-300">${formatarPeso(pesoTotal)}</td>
      <td class="py-1.5 font-semibold text-blue-300">${formatarPeso(cubadoTotal)}</td>
      <td class="py-1.5 font-semibold text-blue-300">${formatarMoeda(freteTotal)}</td>
      <td class="py-1.5"></td>
    </tr>
  `;
}

function renderizarTabela() {
  const termo = filtro.value.trim().toLowerCase();
  const linhas = linhasCombinadas().filter((e) => {
    if (termo) {
      const texto = `${e.remetente_nome} ${e.destinatario_nome} ${e.cidade_entrega} ${e.nota_fiscal || ''}`.toLowerCase();
      if (!texto.includes(termo)) return false;
    }
    if (filtroRemetente.selecionados.size && !filtroRemetente.selecionados.has((e.remetente_nome || '').trim())) return false;
    if (filtroUfOrigem.selecionados.size && !filtroUfOrigem.selecionados.has((e.remetente_uf || '').trim())) return false;
    if (filtroCidadeDestino.selecionados.size && !filtroCidadeDestino.selecionados.has((e.cidade_entrega || '').trim())) return false;
    if (filtroUfDestino.selecionados.size && !filtroUfDestino.selecionados.has((e.estado_entrega || '').trim())) return false;
    return true;
  });

  const grupos = agruparParaExibicao(linhas);

  tabela.innerHTML = grupos.map(({ chave, itens }) => {
    if (itens.length === 1) return linhaEntrega(itens[0], false);
    const expandido = gruposExpandidos.has(chave);
    return linhaResumoGrupo(chave, itens, expandido) + (expandido ? itens.map((e) => linhaEntrega(e, true)).join('') : '');
  }).join('') || '<tr><td colspan="9" class="py-3 text-center text-slate-400">Nenhuma entrega disponivel.</td></tr>';

  tabela.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = Number(tr.dataset.id);
    tr.querySelector('.chk-linha').addEventListener('change', (e) => {
      if (e.target.checked) selecionados.add(id); else selecionados.delete(id);
      atualizarTotais();
    });
    const entrega = linhasCombinadas().find((it) => it.id === id);
    const itensMenu = [{ label: 'Editar', onClick: () => abrirEdicao(id) }];
    if (!entrega?.carga_id) itensMenu.push({ label: 'Excluir', perigo: true, onClick: () => excluirDisponivel(id) });
    criarMenuAcoes(tr.querySelector('.btn-menu-acoes'), itensMenu);
  });

  tabela.querySelectorAll('.btn-expandir-grupo').forEach((btn) => {
    btn.addEventListener('click', () => {
      const chave = btn.dataset.chave;
      if (gruposExpandidos.has(chave)) gruposExpandidos.delete(chave); else gruposExpandidos.add(chave);
      renderizarTabela();
    });
  });

  tabela.querySelectorAll('.chk-grupo-visual').forEach((chk) => {
    chk.addEventListener('change', (e) => {
      const grupo = grupos.find((g) => g.chave === chk.dataset.chave);
      if (!grupo) return;
      for (const item of grupo.itens) {
        if (e.target.checked) selecionados.add(item.id); else selecionados.delete(item.id);
      }
      renderizarTabela();
    });
  });

  atualizarTotais();
}

function atualizarTotais() {
  const linhas = linhasCombinadas().filter((e) => selecionados.has(e.id));
  const peso = linhas.reduce((acc, e) => acc + (e.peso_bruto || 0), 0);
  const cubado = linhas.reduce((acc, e) => acc + (e.peso_cubado || 0), 0);
  const frete = linhas.reduce((acc, e) => acc + (e.valor_frete || 0), 0);
  document.getElementById('total-peso').textContent = formatarPeso(peso);
  document.getElementById('total-cubado').textContent = formatarPeso(cubado);
  document.getElementById('total-frete').textContent = formatarMoeda(frete);
}

async function carregarPool() {
  [clientes, poolDisponiveis, rascunhos] = await Promise.all([
    apiGet('/api/clientes'),
    apiGet('/api/entregas/disponiveis'),
    apiGet('/api/cargas/rascunhos')
  ]);
  renderizarRascunhos();
  renderizarTabela();
}

function renderizarRascunhos() {
  const container = document.getElementById('lista-rascunhos');
  container.innerHTML = rascunhos.map((r) => `
    <div class="flex w-64 items-center justify-between gap-2 rounded border border-painel-border bg-painel-bg/40 px-2 py-1.5" data-id="${r.id}">
      <div class="min-w-0">
        <p class="truncate text-xs font-medium">${escapeHtml(r.codigo_carga)}</p>
        <p class="truncate text-[11px] text-slate-400">${escapeHtml(r.origem)} &middot; ${r.num_entregas} nota(s)</p>
      </div>
      <div class="flex shrink-0 gap-1">
        <button type="button" class="btn-secondary btn-abrir btn-sm">Abrir</button>
        <button type="button" class="btn-primary btn-confirmar btn-sm">OK</button>
        <button type="button" class="btn-danger btn-excluir btn-sm">X</button>
      </div>
    </div>
  `).join('') || '<p class="text-xs text-slate-400">Nenhum rascunho salvo.</p>';

  container.querySelectorAll('[data-id]').forEach((div) => {
    const id = Number(div.dataset.id);
    div.querySelector('.btn-abrir').addEventListener('click', () => abrirRascunho(id));
    div.querySelector('.btn-confirmar').addEventListener('click', () => confirmarRascunho(id));
    div.querySelector('.btn-excluir').addEventListener('click', () => excluirRascunho(id));
  });
}

async function abrirRascunho(id) {
  try {
    const data = await apiGet(`/api/cargas/${id}`);
    draftAtual = {
      id: data.detalhes_carga.id,
      codigo_carga: data.detalhes_carga.codigo_carga,
      origem: data.detalhes_carga.origem,
      entregas: data.entregas.map((e) => ({
        id: e.id,
        carga_id: id,
        cliente_id: e.cliente_id,
        remetente_nome: e.remetente_nome,
        destinatario_nome: e.razao_social,
        cidade_entrega: e.cidade,
        estado_entrega: e.estado,
        cidade_entrega_override: e.cidade_entrega_override,
        estado_entrega_override: e.estado_entrega_override,
        nota_fiscal: e.nota_fiscal,
        peso_bruto: e.peso_bruto,
        peso_cubado: e.peso_cubado,
        valor_frete: e.valor_frete,
        valor_tonelada: e.valor_tonelada,
        remetente_id: e.remetente_id,
        remetente_uf: e.remetente_uf,
        is_cortesia: e.is_cortesia,
        grupo_id: e.grupo_id,
        local_coleta: e.local_coleta,
        _rascunho: true
      }))
    };
    origemInput.value = draftAtual.origem;
    selecionados.clear();
    draftAtual.entregas.forEach((e) => selecionados.add(e.id));
    renderizarTabela();
  } catch (err) {
    alert(err.message);
  }
}

async function confirmarRascunho(id) {
  if (!confirm('Confirmar este rascunho e move-lo para Pendentes?')) return;
  try {
    await apiPut(`/api/cargas/${id}/confirmar`, {});
    if (draftAtual?.id === id) novoRascunho();
    await carregarPool();
  } catch (err) {
    alert(err.message);
  }
}

async function excluirRascunho(id) {
  if (!confirm('Excluir este rascunho? As entregas voltam para a lista de disponiveis.')) return;
  try {
    await apiDelete(`/api/cargas/${id}/rascunho`);
    if (draftAtual?.id === id) novoRascunho();
    await carregarPool();
  } catch (err) {
    alert(err.message);
  }
}

function novoRascunho() {
  draftAtual = null;
  origemInput.value = '';
  selecionados.clear();
  renderizarTabela();
}

async function excluirDisponivel(id) {
  if (!confirm('Excluir esta entrega da lista de disponiveis?')) return;
  try {
    await apiDelete(`/api/entregas/disponiveis/${id}`);
    selecionados.delete(id);
    await carregarPool();
  } catch (err) {
    alert(err.message);
  }
}

function abrirEdicao(id) {
  const e = linhasCombinadas().find((it) => it.id === id);
  if (!e) return;
  document.getElementById('edit-id').value = e.id;
  document.getElementById('edit-remetente-input').value = e.remetente_nome === 'N/A' ? '' : e.remetente_nome;
  document.getElementById('edit-remetente-id').value = e.remetente_id || '';
  document.getElementById('edit-cidade').value = e.cidade_entrega_override || e.cidade_entrega || '';
  document.getElementById('edit-estado').value = e.estado_entrega_override || e.estado_entrega || '';
  document.getElementById('edit-peso').value = e.peso_bruto ?? '';
  document.getElementById('edit-cubado').value = e.peso_cubado ?? '';
  document.getElementById('edit-frete').value = e.valor_frete ?? '';
  document.getElementById('edit-tonelada').value = e.valor_tonelada ?? '';
  document.getElementById('edit-nf').value = e.nota_fiscal || '';
  document.getElementById('edit-local-coleta').value = e.local_coleta || '';
  document.getElementById('edit-cortesia').checked = !!e.is_cortesia;
  document.getElementById('edit-msg').classList.add('hidden');
  abrirModal(document.getElementById('modal-editar'));
}

document.getElementById('form-editar').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.getElementById('edit-id').value;
  const editMsg = document.getElementById('edit-msg');
  try {
    await apiPut(`/api/entregas/${id}`, {
      remetente_id: document.getElementById('edit-remetente-id').value || null,
      cidade_entrega: document.getElementById('edit-cidade').value || null,
      estado_entrega: document.getElementById('edit-estado').value || null,
      peso_bruto: parseDecimal(document.getElementById('edit-peso').value),
      peso_cubado: parseDecimal(document.getElementById('edit-cubado').value),
      valor_frete: parseDecimal(document.getElementById('edit-frete').value),
      valor_tonelada: parseDecimal(document.getElementById('edit-tonelada').value),
      nota_fiscal: document.getElementById('edit-nf').value || null,
      local_coleta: document.getElementById('edit-local-coleta').value.trim() || null,
      is_cortesia: document.getElementById('edit-cortesia').checked
    });
    fecharModal(document.getElementById('modal-editar'));
    if (draftAtual) await abrirRascunho(draftAtual.id);
    await carregarPool();
  } catch (err) {
    editMsg.textContent = err.message;
    editMsg.classList.remove('hidden');
  }
});
document.getElementById('btn-cancelar-edicao').addEventListener('click', () => fecharModal(document.getElementById('modal-editar')));

document.getElementById('form-nova-entrega').addEventListener('submit', async (event) => {
  event.preventDefault();
  const msgNova = document.getElementById('msg-nova');
  const clienteId = document.getElementById('nova-cliente-id').value;
  if (!clienteId) return exibirMensagem(msgNova, 'Selecione um destinatario valido na lista.', 'erro');

  try {
    await apiPost('/api/entregas/disponiveis', {
      remetente_id: document.getElementById('nova-remetente-id').value || null,
      cliente_id: Number(clienteId),
      cidade_entrega: document.getElementById('nova-cidade').value.trim() || null,
      estado_entrega: document.getElementById('nova-estado').value.trim() || null,
      peso_bruto: parseDecimal(document.getElementById('nova-peso').value),
      peso_cubado: parseDecimal(document.getElementById('nova-cubado').value),
      valor_frete: parseDecimal(document.getElementById('nova-frete').value),
      valor_tonelada: parseDecimal(document.getElementById('nova-tonelada').value),
      nota_fiscal: document.getElementById('nova-nf').value || null,
      local_coleta: document.getElementById('nova-local-coleta').value.trim() || null,
      is_cortesia: document.getElementById('nova-cortesia').checked
    });
    document.getElementById('form-nova-entrega').reset();
    await carregarPool();
  } catch (err) {
    exibirMensagem(msgNova, err.message, 'erro');
  }
});

document.getElementById('btn-salvar-rascunho').addEventListener('click', async () => {
  const origem = origemInput.value.trim();
  if (!origem) return alert('Informe a origem do rascunho.');
  if (!selecionados.size) return alert('Selecione ao menos uma entrega.');

  try {
    if (draftAtual) {
      await apiPut(`/api/cargas/${draftAtual.id}/montar`, { origem, entrega_ids: [...selecionados] });
    } else {
      const resp = await apiPost('/api/cargas/montar', { origem, entrega_ids: [...selecionados] });
      draftAtual = { id: resp.carga_id, origem, entregas: [] };
    }
    await abrirRascunho(draftAtual.id);
    await carregarPool();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('btn-novo-rascunho').addEventListener('click', novoRascunho);

document.getElementById('chk-todas').addEventListener('change', (e) => {
  // Opera direto sobre a lista completa (nao so as linhas visiveis no DOM)
  // porque entregas dentro de um grupo visual recolhido nao tem checkbox
  // proprio na tela ate serem expandidas.
  for (const entrega of linhasCombinadas()) {
    if (e.target.checked) selecionados.add(entrega.id); else selecionados.delete(entrega.id);
  }
  renderizarTabela();
});

filtro.addEventListener('input', renderizarTabela);

document.getElementById('btn-lote-remetente').addEventListener('click', () => {
  const form = document.getElementById('form-lote-remetente');
  form.classList.toggle('hidden');
  form.classList.toggle('flex');
});

document.getElementById('form-lote-remetente').addEventListener('submit', async (event) => {
  event.preventDefault();
  const novoRemetenteId = document.getElementById('lote-remetente-id').value;
  if (!novoRemetenteId || !selecionados.size) return alert('Selecione entregas e um remetente valido.');
  try {
    await apiPut('/api/entregas/bulk-update-remetente', {
      entrega_ids: [...selecionados],
      novo_remetente_id: Number(novoRemetenteId)
    });
    document.getElementById('form-lote-remetente').reset();
    if (draftAtual) await abrirRascunho(draftAtual.id);
    await carregarPool();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('btn-agrupar').addEventListener('click', async () => {
  if (selecionados.size < 2) return alert('Selecione pelo menos 2 entregas para agrupar.');
  const linhas = linhasCombinadas().filter((e) => selecionados.has(e.id));
  const remetenteIds = new Set(linhas.map((e) => e.remetente_id));
  const clienteIds = new Set(linhas.map((e) => e.cliente_id));
  if (remetenteIds.size > 1 || clienteIds.size > 1) {
    return alert('So e possivel agrupar entregas com o mesmo remetente E o mesmo destinatario.');
  }
  const cortesias = new Set(linhas.map((e) => !!e.is_cortesia));
  if (cortesias.size > 1) return alert('Nao e possivel agrupar notas Cortesia com notas normais.');
  if (!confirm(`Agrupar ${selecionados.size} entregas?`)) return;

  try {
    await apiPost('/api/entregas/agrupar', { entrega_ids: [...selecionados] });
    selecionados.clear();
    if (draftAtual) await abrirRascunho(draftAtual.id);
    await carregarPool();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('btn-desagrupar').addEventListener('click', async () => {
  const linhas = linhasCombinadas().filter((e) => selecionados.has(e.id));
  const grupos = new Set(linhas.map((e) => e.grupo_id).filter(Boolean));
  if (!grupos.size) return alert('Selecione entregas que estejam agrupadas.');
  try {
    for (const grupoId of grupos) {
      await apiPost('/api/entregas/desagrupar', { grupo_id: grupoId });
    }
    selecionados.clear();
    if (draftAtual) await abrirRascunho(draftAtual.id);
    await carregarPool();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('btn-excluir-selecionadas').addEventListener('click', async () => {
  if (!selecionados.size) return alert('Nenhuma entrega selecionada.');
  if (!confirm(`Excluir/devolver ${selecionados.size} entrega(s) selecionada(s)?`)) return;
  try {
    await apiDelete('/api/entregas/em-massa', { entrega_ids: [...selecionados] });
    selecionados.clear();
    if (draftAtual) await abrirRascunho(draftAtual.id);
    await carregarPool();
  } catch (err) {
    alert(err.message);
  }
});

carregarPool();
ouvirMudancas(carregarPool);
