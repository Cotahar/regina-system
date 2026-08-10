import { apiGet, apiPost, apiDelete } from '../shared/api.js';
import { exibirMensagem } from '../shared/ui.js';
import { escapeHtml } from '../shared/escape.js';

const lista = document.getElementById('lista-formas');
let formas = [];

async function carregar() {
  formas = await apiGet('/api/auxiliar/formas-pagamento');
  lista.innerHTML = formas.map((f) => `
    <li class="flex items-center justify-between py-2" data-id="${f.id}">
      <span>${escapeHtml(f.descricao)}</span>
      <button class="btn-danger btn-excluir btn-sm">Excluir</button>
    </li>
  `).join('') || '<li class="py-4 text-center text-slate-500">Nenhuma forma de pagamento cadastrada.</li>';

  lista.querySelectorAll('.btn-excluir').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.closest('li').dataset.id);
      const forma = formas.find((f) => f.id === id);
      if (!forma || !confirm(`Excluir "${forma.descricao}"?`)) return;
      try {
        await apiDelete(`/api/auxiliar/formas-pagamento/${id}`);
        await carregar();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

document.getElementById('form-nova').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('nova-descricao');
  const msgNova = document.getElementById('msg-nova');
  try {
    await apiPost('/api/auxiliar/formas-pagamento', { descricao: input.value.trim() });
    input.value = '';
    await carregar();
  } catch (err) {
    exibirMensagem(msgNova, err.message, 'erro');
  }
});

carregar();
