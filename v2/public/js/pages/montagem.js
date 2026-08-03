import { apiGet, apiPost, apiPut, apiDelete } from '../shared/api.js';
import { escapeHtml } from '../shared/escape.js';
import { formatarMoeda, formatarPeso, parseDecimal } from '../shared/format.js';
import { exibirMensagem, abrirModal, fecharModal } from '../shared/ui.js';

let clientes = [];
let poolDisponiveis = [];
let draftAtual = null; // { id, codigo_carga, origem, entregas: [...] }
let rascunhos = [];
const selecionados = new Set();

const tabela = document.getElementById('tabela-entregas');
const origemInput = document.getElementById('origem-rascunho');
const filtro = document.getElementById('filtro-busca');

function preencherDatalistClientes() {
  document.getElementById('lista-clientes').innerHTML =
    clientes.map((c) => `<option data-id="${c.id}" value="${escapeHtml(c.text)}">`).join('');
}

function ligarBuscaComId(inputId, hiddenId) {
  const input = document.getElementById(inputId);
  const hidden = document.getElementById(hiddenId);
  input.addEventListener('input', () => {
    const item = clientes.find((c) => c.text === input.value);
    hidden.value = item ? item.id : '';
  });
}
['nova', 'edit', 'lote'].forEach((prefixo) => ligarBuscaComId(`${prefixo}-remetente-input`, `${prefixo}-remetente-id`));
ligarBuscaComId('nova-cliente-input', 'nova-cliente-id');

function linhasCombinadas() {
  const doDraft = draftAtual ? draftAtual.entregas : [];
  return [...poolDisponiveis, ...doDraft];
}

function renderizarTabela() {
  const termo = filtro.value.trim().toLowerCase();
  const linhas = linhasCombinadas().filter((e) => {
    if (!termo) return true;
    const texto = `${e.remetente_nome} ${e.destinatario_nome} ${e.cidade_entrega} ${e.nota_fiscal || ''}`.toLowerCase();
    return texto.includes(termo);
  });

  tabela.innerHTML = linhas.map((e) => `
    <tr class="border-t border-painel-border" data-id="${e.id}">
      <td class="py-1"><input type="checkbox" class="chk-linha" ${selecionados.has(e.id) ? 'checked' : ''}></td>
      <td class="py-1">${escapeHtml(e.remetente_nome)}</td>
      <td class="py-1">${escapeHtml(e.destinatario_nome)}</td>
      <td class="py-1">${escapeHtml(e.cidade_entrega || '')}-${escapeHtml(e.estado_entrega || '')}</td>
      <td class="py-1">${escapeHtml(e.nota_fiscal || '')}</td>
      <td class="py-1">${formatarPeso(e.peso_bruto)}</td>
      <td class="py-1">${formatarPeso(e.peso_cubado)}</td>
      <td class="py-1">${formatarMoeda(e.valor_frete)}</td>
      <td class="py-1 text-right">
        <button type="button" class="btn-secondary btn-editar px-2 py-0.5">Editar</button>
        ${e.carga_id ? '' : '<button type="button" class="btn-danger btn-excluir px-2 py-0.5">X</button>'}
      </td>
    </tr>
  `).join('') || '<tr><td colspan="9" class="py-3 text-center text-slate-500">Nenhuma entrega disponivel.</td></tr>';

  tabela.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = Number(tr.dataset.id);
    tr.querySelector('.chk-linha').addEventListener('change', (e) => {
      if (e.target.checked) selecionados.add(id); else selecionados.delete(id);
      atualizarTotais();
    });
    tr.querySelector('.btn-editar').addEventListener('click', () => abrirEdicao(id));
    tr.querySelector('.btn-excluir')?.addEventListener('click', () => excluirDisponivel(id));
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
  preencherDatalistClientes();
  renderizarRascunhos();
  renderizarTabela();
}

function renderizarRascunhos() {
  const container = document.getElementById('lista-rascunhos');
  container.innerHTML = rascunhos.map((r) => `
    <div class="flex items-center justify-between rounded border border-painel-border p-2" data-id="${r.id}">
      <div>
        <p class="font-medium">${escapeHtml(r.codigo_carga)}</p>
        <p class="text-xs text-slate-400">${escapeHtml(r.origem)} - ${r.num_entregas} entrega(s)</p>
      </div>
      <div class="flex gap-1">
        <button type="button" class="btn-secondary btn-abrir px-2 py-1 text-xs">Abrir</button>
        <button type="button" class="btn-primary btn-confirmar px-2 py-1 text-xs">Confirmar</button>
        <button type="button" class="btn-danger btn-excluir px-2 py-1 text-xs">X</button>
      </div>
    </div>
  `).join('') || '<p class="text-xs text-slate-500">Nenhum rascunho salvo.</p>';

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
        remetente_id: e.remetente_id
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
  document.getElementById('edit-nf').value = e.nota_fiscal || '';
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
      nota_fiscal: document.getElementById('edit-nf').value || null
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
      peso_bruto: parseDecimal(document.getElementById('nova-peso').value),
      peso_cubado: parseDecimal(document.getElementById('nova-cubado').value),
      valor_frete: parseDecimal(document.getElementById('nova-frete').value),
      nota_fiscal: document.getElementById('nova-nf').value || null
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
  tabela.querySelectorAll('.chk-linha').forEach((chk) => {
    chk.checked = e.target.checked;
    chk.dispatchEvent(new Event('change'));
  });
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
  const clienteIds = new Set(linhas.map((e) => e.cliente_id ?? e.destinatario_nome));
  if (clienteIds.size > 1) return alert('So e possivel agrupar entregas do mesmo destinatario.');
  if (!confirm(`Agrupar ${selecionados.size} entregas em uma so (somando pesos e fretes)?`)) return;

  try {
    await apiPost('/api/entregas/agrupar', { entrega_ids: [...selecionados] });
    selecionados.clear();
    if (draftAtual) await abrirRascunho(draftAtual.id);
    await carregarPool();
  } catch (err) {
    alert(err.message);
  }
});

carregarPool();
