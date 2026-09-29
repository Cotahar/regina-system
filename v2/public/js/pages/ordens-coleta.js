import { apiGet, apiPost, apiPut, apiDelete } from '../shared/api.js';
import { escapeHtml } from '../shared/escape.js';
import { formatarPeso } from '../shared/format.js';
import { exibirMensagem, abrirModal, fecharModal } from '../shared/ui.js';
import { criarCombobox } from '../shared/combobox.js';
import { ouvirMudancas } from '../shared/live.js';

const tabelaOrdens = document.getElementById('tabela-ordens');
const secaoForm = document.getElementById('secao-form-ordem');
const tabelaEntregas = document.getElementById('tabela-entregas-ordem');
const filtro = document.getElementById('filtro-entregas-ordem');
const msgForm = document.getElementById('msg-form-ordem');

const STATUS_LABEL = { pendente: 'Pendente', coletada: 'Coletada' };
const STATUS_COR = { pendente: 'bg-amber-900/40 text-amber-300', coletada: 'bg-emerald-900/40 text-emerald-300' };

let ordens = [];
let motoristas = [];
let veiculos = [];
let clientes = [];
let entregasElegiveis = [];
let ordemEditandoId = null; // null = criando nova
const selecionadas = new Set();

criarCombobox({
  input: document.getElementById('ordem-motorista-input'),
  hidden: document.getElementById('ordem-motorista-id'),
  getItens: () => motoristas
});
criarCombobox({
  input: document.getElementById('ordem-veiculo-input'),
  hidden: document.getElementById('ordem-veiculo-id'),
  getItens: () => veiculos
});
criarCombobox({
  input: document.getElementById('baixar-cliente-input'),
  hidden: document.getElementById('baixar-cliente-id'),
  getItens: () => clientes
});

function linhaOrdem(o) {
  const podeEditar = o.status === 'pendente';
  return `
    <tr class="border-t border-painel-border" data-id="${o.id}">
      <td class="py-1.5 px-1.5 font-mono text-[11px]">${escapeHtml(o.codigo)}</td>
      <td class="py-1.5 px-1.5"><span class="rounded px-1.5 py-0.5 text-[10px] ${STATUS_COR[o.status] || ''}">${STATUS_LABEL[o.status] || o.status}</span></td>
      <td class="py-1.5 px-1.5">${escapeHtml(o.motorista_nome || 'N/A')}${o.placa_veiculo ? ' - ' + escapeHtml(o.placa_veiculo) : ''}</td>
      <td class="py-1.5 px-1.5">${o.num_entregas}</td>
      <td class="py-1.5 px-1.5">${formatarPeso(o.peso_total)}</td>
      <td class="py-1.5 px-1.5">${o.local_coleta_cliente_nome ? escapeHtml(o.local_coleta_cliente_nome) : '-'}</td>
      <td class="py-1.5 px-1.5 text-right space-x-2">
        ${podeEditar ? `<button type="button" class="btn-abrir-ordem text-brand-yellow hover:underline">Abrir</button>` : ''}
        <button type="button" class="btn-imprimir-ordem text-brand-yellow hover:underline">Relatorio</button>
        ${podeEditar ? `<button type="button" class="btn-baixar-ordem text-emerald-400 hover:underline">Baixar</button>` : ''}
        ${podeEditar ? `<button type="button" class="btn-excluir-ordem text-red-400 hover:underline">Excluir</button>` : ''}
      </td>
    </tr>
  `;
}

function renderizarTabelaOrdens() {
  tabelaOrdens.innerHTML = ordens.map(linhaOrdem).join('') ||
    '<tr><td colspan="7" class="py-4 text-center text-slate-400">Nenhuma ordem de coleta ainda.</td></tr>';

  tabelaOrdens.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = Number(tr.dataset.id);
    tr.querySelector('.btn-abrir-ordem')?.addEventListener('click', () => abrirEdicaoOrdem(id));
    tr.querySelector('.btn-imprimir-ordem')?.addEventListener('click', () => window.open(`/ordens-coleta/${id}/relatorio`, '_blank'));
    tr.querySelector('.btn-baixar-ordem')?.addEventListener('click', () => abrirModalBaixar(id));
    tr.querySelector('.btn-excluir-ordem')?.addEventListener('click', () => excluirOrdem(id));
  });
}

async function carregarOrdens() {
  ordens = await apiGet('/api/ordens-coleta');
  renderizarTabelaOrdens();
}

function linhasEntregasFiltradas() {
  const termo = filtro.value.trim().toLowerCase();
  if (!termo) return entregasElegiveis;
  return entregasElegiveis.filter((e) => {
    const texto = `${e.remetente_nome} ${e.destinatario_nome} ${e.cidade_entrega} ${e.nota_fiscal || ''} ${e.origem_texto}`.toLowerCase();
    return texto.includes(termo);
  });
}

function renderizarTabelaEntregas() {
  const linhas = linhasEntregasFiltradas();
  tabelaEntregas.innerHTML = linhas.map((e) => `
    <tr class="border-t border-painel-border" data-id="${e.id}">
      <td class="py-1.5"><input type="checkbox" class="chk-entrega-ordem" ${selecionadas.has(e.id) ? 'checked' : ''}></td>
      <td class="py-1.5">${escapeHtml(e.remetente_nome)}</td>
      <td class="py-1.5">${escapeHtml(e.destinatario_nome)}</td>
      <td class="py-1.5">${escapeHtml(e.cidade_entrega || '')}-${escapeHtml(e.estado_entrega || '')}</td>
      <td class="py-1.5">${escapeHtml(e.nota_fiscal || '')}</td>
      <td class="py-1.5">${formatarPeso(e.peso_bruto)}</td>
      <td class="py-1.5"><span class="rounded bg-painel-border px-1.5 py-0.5 text-[10px] text-slate-300">${escapeHtml(e.origem_texto)}</span></td>
    </tr>
  `).join('') || '<tr><td colspan="7" class="py-3 text-center text-slate-400">Nenhuma entrega elegivel para coleta.</td></tr>';

  tabelaEntregas.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = Number(tr.dataset.id);
    tr.querySelector('.chk-entrega-ordem').addEventListener('change', (e) => {
      if (e.target.checked) selecionadas.add(id); else selecionadas.delete(id);
    });
  });
}

async function carregarEntregasElegiveis() {
  const qs = ordemEditandoId ? `?ordem_id=${ordemEditandoId}` : '';
  entregasElegiveis = await apiGet(`/api/ordens-coleta/entregas-elegiveis${qs}`);
  renderizarTabelaEntregas();
}

function limparFormOrdem() {
  document.getElementById('ordem-motorista-input').value = '';
  document.getElementById('ordem-motorista-id').value = '';
  document.getElementById('ordem-veiculo-input').value = '';
  document.getElementById('ordem-veiculo-id').value = '';
  document.getElementById('ordem-observacoes').value = '';
  filtro.value = '';
  selecionadas.clear();
  msgForm.classList.add('hidden');
}

async function abrirNovaOrdem() {
  ordemEditandoId = null;
  limparFormOrdem();
  document.getElementById('form-ordem-titulo').textContent = 'Nova ordem de coleta';
  await carregarEntregasElegiveis();
  secaoForm.classList.remove('hidden');
  secaoForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function abrirEdicaoOrdem(id) {
  try {
    const data = await apiGet(`/api/ordens-coleta/${id}`);
    ordemEditandoId = id;
    limparFormOrdem();
    document.getElementById('form-ordem-titulo').textContent = `Editando ordem ${data.ordem.codigo}`;
    document.getElementById('ordem-observacoes').value = data.ordem.observacoes || '';
    if (data.ordem.motorista_id) {
      document.getElementById('ordem-motorista-input').value = data.ordem.motorista_nome;
      document.getElementById('ordem-motorista-id').value = data.ordem.motorista_id;
    }
    if (data.ordem.veiculo_id) {
      document.getElementById('ordem-veiculo-input').value = data.ordem.placa_veiculo;
      document.getElementById('ordem-veiculo-id').value = data.ordem.veiculo_id;
    }

    await carregarEntregasElegiveis();
    data.entregas.forEach((e) => selecionadas.add(e.id));
    renderizarTabelaEntregas();

    secaoForm.classList.remove('hidden');
    secaoForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById('btn-fechar-form-ordem').addEventListener('click', () => {
  secaoForm.classList.add('hidden');
  ordemEditandoId = null;
});

document.getElementById('btn-nova-ordem').addEventListener('click', abrirNovaOrdem);
filtro.addEventListener('input', renderizarTabelaEntregas);

document.getElementById('chk-todas-ordem').addEventListener('change', (e) => {
  for (const linha of linhasEntregasFiltradas()) {
    if (e.target.checked) selecionadas.add(linha.id); else selecionadas.delete(linha.id);
  }
  renderizarTabelaEntregas();
});

document.getElementById('btn-salvar-ordem').addEventListener('click', async () => {
  if (!selecionadas.size) return exibirMensagem(msgForm, 'Selecione ao menos uma entrega.', 'erro');

  const payload = {
    motorista_id: document.getElementById('ordem-motorista-id').value || null,
    veiculo_id: document.getElementById('ordem-veiculo-id').value || null,
    observacoes: document.getElementById('ordem-observacoes').value.trim() || null,
    entrega_ids: [...selecionadas]
  };

  try {
    if (ordemEditandoId) {
      await apiPut(`/api/ordens-coleta/${ordemEditandoId}`, payload);
    } else {
      await apiPost('/api/ordens-coleta', payload);
    }
    secaoForm.classList.add('hidden');
    ordemEditandoId = null;
    await carregarOrdens();
  } catch (err) {
    exibirMensagem(msgForm, err.message, 'erro');
  }
});

async function excluirOrdem(id) {
  if (!confirm('Excluir esta ordem de coleta? As entregas voltam a ficar disponiveis pra outras ordens/cargas.')) return;
  try {
    await apiDelete(`/api/ordens-coleta/${id}`);
    await carregarOrdens();
  } catch (err) {
    alert(err.message);
  }
}

// --- BAIXAR COLETA ---
const modalBaixar = document.getElementById('modal-baixar-coleta');
const msgBaixar = document.getElementById('msg-baixar-coleta');
let ordemBaixandoId = null;

async function abrirModalBaixar(id) {
  ordemBaixandoId = id;
  document.getElementById('baixar-cliente-input').value = '';
  document.getElementById('baixar-cliente-id').value = '';
  msgBaixar.classList.add('hidden');
  abrirModal(modalBaixar);
}

document.getElementById('btn-baixar-cancelar').addEventListener('click', () => fecharModal(modalBaixar));

document.getElementById('btn-baixar-confirmar').addEventListener('click', async () => {
  const clienteId = document.getElementById('baixar-cliente-id').value;
  if (!clienteId) return exibirMensagem(msgBaixar, 'Selecione o cliente onde a coleta foi realizada.', 'erro');
  if (!confirm('Confirmar a baixa? O local de coleta definido aqui vai valer pra todas as entregas dessa ordem.')) return;

  try {
    await apiPut(`/api/ordens-coleta/${ordemBaixandoId}/baixar`, { local_coleta_cliente_id: Number(clienteId) });
    fecharModal(modalBaixar);
    await carregarOrdens();
  } catch (err) {
    exibirMensagem(msgBaixar, err.message, 'erro');
  }
});

async function carregarAuxiliares() {
  [motoristas, veiculos, clientes] = await Promise.all([
    apiGet('/api/motoristas'),
    apiGet('/api/veiculos'),
    apiGet('/api/clientes')
  ]);
}

async function iniciar() {
  await carregarAuxiliares();
  await carregarOrdens();
}

iniciar();
ouvirMudancas(carregarOrdens);
