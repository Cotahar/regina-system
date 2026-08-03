import { apiGet, apiPost, apiPut, apiDelete } from '../shared/api.js';
import { abrirModal, fecharModal } from '../shared/ui.js';
import { escapeHtml } from '../shared/escape.js';

let marcas = [];
const isAdmin = document.querySelector('[data-admin]')?.dataset.admin === '1';
const tabela = document.getElementById('tabela-marcas');
const modal = document.getElementById('modal-marca');
const form = document.getElementById('form-marca');
const msgModal = document.getElementById('msg-modal');

async function carregar() {
  marcas = await apiGet('/api/marcas');
  renderizar();
}

function renderizar() {
  tabela.innerHTML = marcas.map((m) => `
    <tr class="border-t border-painel-border" data-id="${m.id}">
      <td class="py-2">${escapeHtml(m.nome)}</td>
      ${isAdmin ? `<td class="py-2 text-right">
        <button class="btn-secondary btn-editar px-2 py-1 text-xs">Editar</button>
        <button class="btn-danger btn-excluir px-2 py-1 text-xs">Excluir</button>
      </td>` : ''}
    </tr>
  `).join('') || '<tr><td colspan="2" class="py-4 text-center text-slate-500">Nenhuma marca cadastrada.</td></tr>';

  if (!isAdmin) return;
  tabela.querySelectorAll('.btn-editar').forEach((btn) => {
    btn.addEventListener('click', () => abrirEdicao(Number(btn.closest('tr').dataset.id)));
  });
  tabela.querySelectorAll('.btn-excluir').forEach((btn) => {
    btn.addEventListener('click', () => excluir(Number(btn.closest('tr').dataset.id)));
  });
}

function abrirEdicao(id) {
  const marca = marcas.find((m) => m.id === id);
  if (!marca) return;
  document.getElementById('marca-id').value = marca.id;
  document.getElementById('marca-nome').value = marca.nome;
  document.getElementById('modal-titulo').textContent = 'Editar marca';
  msgModal.classList.add('hidden');
  abrirModal(modal);
}

async function excluir(id) {
  const marca = marcas.find((m) => m.id === id);
  if (!marca || !confirm(`Excluir a marca "${marca.nome}"?`)) return;
  try {
    await apiDelete(`/api/marcas/${id}`);
    await carregar();
  } catch (err) {
    alert(err.message);
  }
}

if (isAdmin) {
  document.getElementById('btn-novo').addEventListener('click', () => {
    form.reset();
    document.getElementById('marca-id').value = '';
    document.getElementById('modal-titulo').textContent = 'Nova marca';
    msgModal.classList.add('hidden');
    abrirModal(modal);
  });

  document.getElementById('btn-cancelar').addEventListener('click', () => fecharModal(modal));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.getElementById('marca-id').value;
    const nome = document.getElementById('marca-nome').value.trim();
    try {
      if (id) await apiPut(`/api/marcas/${id}`, { nome });
      else await apiPost('/api/marcas', { nome });
      fecharModal(modal);
      await carregar();
    } catch (err) {
      msgModal.textContent = err.message;
      msgModal.classList.remove('hidden');
    }
  });
}

carregar();
