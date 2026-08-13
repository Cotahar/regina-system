import { apiGet, apiPost, apiPut, apiDelete } from '../shared/api.js';
import { exibirMensagem, abrirModal, fecharModal } from '../shared/ui.js';
import { escapeHtml } from '../shared/escape.js';
import { configurarColarImport } from '../shared/colar-import.js';
import { criarPaginacao } from '../shared/paginacao.js';
import { iconeMenuAcoes, criarMenuAcoes } from '../shared/menuAcoes.js';

let veiculos = [];

const tabela = document.getElementById('tabela-veiculos');
const filtro = document.getElementById('filtro-busca');
const modal = document.getElementById('modal-veiculo');
const form = document.getElementById('form-veiculo');
const msgModal = document.getElementById('msg-modal');

const paginacao = criarPaginacao({
  container: document.getElementById('paginacao-veiculos'),
  renderizarPagina: renderizarLinhas
});

async function carregar() {
  veiculos = await apiGet('/api/veiculos');
  renderizar(veiculos);
}

function renderizar(lista) {
  paginacao.definirItens(lista);
}

function renderizarLinhas(lista) {
  tabela.innerHTML = lista.map((v) => `
    <tr class="border-t border-painel-border" data-id="${v.id}">
      <td class="py-2.5">${escapeHtml(v.placa)}</td>
      <td class="py-2.5">${v.is_frota ? '<span class="rounded bg-emerald-900/40 px-1.5 py-0.5 text-xs font-semibold text-emerald-300">Frota</span>' : '<span class="text-xs text-slate-500">Terceirizado</span>'}</td>
      <td class="py-2.5 text-right">${iconeMenuAcoes()}</td>
    </tr>
  `).join('') || '<tr><td colspan="3" class="py-4 text-center text-slate-400">Nenhum veiculo cadastrado.</td></tr>';

  tabela.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = Number(tr.dataset.id);
    criarMenuAcoes(tr.querySelector('.btn-menu-acoes'), [
      { label: 'Editar', onClick: () => abrirEdicao(id) },
      { label: 'Excluir', onClick: () => excluir(id), perigo: true }
    ]);
  });
}

function abrirCriacao() {
  form.reset();
  document.getElementById('veiculo-id').value = '';
  document.getElementById('modal-titulo').textContent = 'Novo veiculo';
  msgModal.classList.add('hidden');
  abrirModal(modal);
}

function abrirEdicao(id) {
  const veiculo = veiculos.find((v) => v.id === id);
  if (!veiculo) return;
  document.getElementById('veiculo-id').value = veiculo.id;
  document.getElementById('veiculo-placa').value = veiculo.placa;
  document.getElementById('veiculo-frota').checked = !!veiculo.is_frota;
  document.getElementById('modal-titulo').textContent = 'Editar veiculo';
  msgModal.classList.add('hidden');
  abrirModal(modal);
}

async function excluir(id) {
  const veiculo = veiculos.find((v) => v.id === id);
  if (!veiculo) return;
  if (!confirm(`Excluir o veiculo "${veiculo.placa}"?`)) return;
  try {
    await apiDelete(`/api/veiculos/${id}`);
    await carregar();
  } catch (err) {
    alert(err.message);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.getElementById('veiculo-id').value;
  const payload = {
    placa: document.getElementById('veiculo-placa').value.trim(),
    is_frota: document.getElementById('veiculo-frota').checked
  };
  try {
    if (id) await apiPut(`/api/veiculos/${id}`, payload);
    else await apiPost('/api/veiculos', payload);
    fecharModal(modal);
    await carregar();
  } catch (err) {
    msgModal.textContent = err.message;
    msgModal.classList.remove('hidden');
  }
});

document.getElementById('btn-novo').addEventListener('click', abrirCriacao);
document.getElementById('btn-cancelar').addEventListener('click', () => fecharModal(modal));

document.getElementById('form-import').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('arquivo-import');
  const msgImport = document.getElementById('msg-import');
  if (!input.files[0]) return;

  const formData = new FormData();
  formData.append('arquivo', input.files[0]);

  try {
    const data = await apiPost('/api/veiculos/import', formData);
    exibirMensagem(msgImport, data.message, 'sucesso');
    input.value = '';
    await carregar();
  } catch (err) {
    exibirMensagem(msgImport, err.message, 'erro');
  }
});

filtro.addEventListener('input', () => {
  const termo = filtro.value.trim().toLowerCase();
  renderizar(veiculos.filter((v) => (v.placa || '').toLowerCase().includes(termo)));
});

configurarColarImport({
  textareaId: 'colar-texto',
  botaoId: 'btn-colar-importar',
  msgId: 'msg-import',
  url: '/api/veiculos/import',
  onSucesso: carregar
});

carregar();
