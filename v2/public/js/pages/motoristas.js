import { apiGet, apiPost, apiPut, apiDelete } from '../shared/api.js';
import { exibirMensagem, abrirModal, fecharModal } from '../shared/ui.js';
import { escapeHtml } from '../shared/escape.js';
import { configurarColarImport } from '../shared/colar-import.js';
import { criarPaginacao } from '../shared/paginacao.js';

let motoristas = [];

const tabela = document.getElementById('tabela-motoristas');
const filtro = document.getElementById('filtro-busca');
const modal = document.getElementById('modal-motorista');
const form = document.getElementById('form-motorista');
const msgModal = document.getElementById('msg-modal');

const paginacao = criarPaginacao({
  container: document.getElementById('paginacao-motoristas'),
  renderizarPagina: renderizarLinhas
});

async function carregar() {
  motoristas = await apiGet('/api/motoristas');
  renderizar(motoristas);
}

function renderizar(lista) {
  paginacao.definirItens(lista);
}

function renderizarLinhas(lista) {
  tabela.innerHTML = lista.map((m) => `
    <tr class="border-t border-painel-border" data-id="${m.id}">
      <td class="py-2">${escapeHtml(m.codigo || '')}</td>
      <td class="py-2">${escapeHtml(m.nome)}</td>
      <td class="py-2 text-right">
        <button class="btn-secondary btn-editar px-2 py-1 text-xs">Editar</button>
        <button class="btn-danger btn-excluir px-2 py-1 text-xs">Excluir</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="3" class="py-4 text-center text-slate-500">Nenhum motorista cadastrado.</td></tr>';

  tabela.querySelectorAll('.btn-editar').forEach((btn) => {
    btn.addEventListener('click', () => abrirEdicao(Number(btn.closest('tr').dataset.id)));
  });
  tabela.querySelectorAll('.btn-excluir').forEach((btn) => {
    btn.addEventListener('click', () => excluir(Number(btn.closest('tr').dataset.id)));
  });
}

function abrirCriacao() {
  form.reset();
  document.getElementById('motorista-id').value = '';
  document.getElementById('modal-titulo').textContent = 'Novo motorista';
  msgModal.classList.add('hidden');
  abrirModal(modal);
}

function abrirEdicao(id) {
  const motorista = motoristas.find((m) => m.id === id);
  if (!motorista) return;
  document.getElementById('motorista-id').value = motorista.id;
  document.getElementById('motorista-codigo').value = motorista.codigo || '';
  document.getElementById('motorista-nome').value = motorista.nome;
  document.getElementById('modal-titulo').textContent = 'Editar motorista';
  msgModal.classList.add('hidden');
  abrirModal(modal);
}

async function excluir(id) {
  const motorista = motoristas.find((m) => m.id === id);
  if (!motorista) return;
  if (!confirm(`Excluir o motorista "${motorista.nome}"?`)) return;
  try {
    await apiDelete(`/api/motoristas/${id}`);
    await carregar();
  } catch (err) {
    alert(err.message);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.getElementById('motorista-id').value;
  const payload = {
    codigo: document.getElementById('motorista-codigo').value.trim(),
    nome: document.getElementById('motorista-nome').value.trim()
  };
  try {
    if (id) await apiPut(`/api/motoristas/${id}`, payload);
    else await apiPost('/api/motoristas', payload);
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
    const data = await apiPost('/api/motoristas/import', formData);
    exibirMensagem(msgImport, data.message, 'sucesso');
    input.value = '';
    await carregar();
  } catch (err) {
    exibirMensagem(msgImport, err.message, 'erro');
  }
});

filtro.addEventListener('input', () => {
  const termo = filtro.value.trim().toLowerCase();
  const filtrados = motoristas.filter((m) =>
    (m.nome || '').toLowerCase().includes(termo) || (m.codigo || '').toLowerCase().includes(termo)
  );
  renderizar(filtrados);
});

configurarColarImport({
  textareaId: 'colar-texto',
  botaoId: 'btn-colar-importar',
  msgId: 'msg-import',
  url: '/api/motoristas/import',
  onSucesso: carregar
});

carregar();
