import { apiGet, apiPost, apiPut, apiDelete } from '../shared/api.js';
import { exibirMensagem, abrirModal, fecharModal } from '../shared/ui.js';
import { escapeHtml } from '../shared/escape.js';
import { configurarColarImport } from '../shared/colar-import.js';

let veiculos = [];

const tabela = document.getElementById('tabela-veiculos');
const filtro = document.getElementById('filtro-busca');
const modal = document.getElementById('modal-veiculo');
const form = document.getElementById('form-veiculo');
const msgModal = document.getElementById('msg-modal');

async function carregar() {
  veiculos = await apiGet('/api/veiculos');
  renderizar(veiculos);
}

function renderizar(lista) {
  tabela.innerHTML = lista.map((v) => `
    <tr class="border-t border-painel-border" data-id="${v.id}">
      <td class="py-2">${escapeHtml(v.placa)}</td>
      <td class="py-2 text-right">
        <button class="btn-secondary btn-editar px-2 py-1 text-xs">Editar</button>
        <button class="btn-danger btn-excluir px-2 py-1 text-xs">Excluir</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="2" class="py-4 text-center text-slate-500">Nenhum veiculo cadastrado.</td></tr>';

  tabela.querySelectorAll('.btn-editar').forEach((btn) => {
    btn.addEventListener('click', () => abrirEdicao(Number(btn.closest('tr').dataset.id)));
  });
  tabela.querySelectorAll('.btn-excluir').forEach((btn) => {
    btn.addEventListener('click', () => excluir(Number(btn.closest('tr').dataset.id)));
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
  const payload = { placa: document.getElementById('veiculo-placa').value.trim() };
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
