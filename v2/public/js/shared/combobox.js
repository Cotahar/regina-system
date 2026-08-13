import { escapeHtml } from './escape.js';

// Substitui o padrao antigo de <datalist> nativo (que ficava lento e sem
// destaque visual com milhares de opcoes - ex: 5959 clientes). Mostra so os
// resultados que batem com o texto digitado, num dropdown customizado.
export function criarCombobox({ input, hidden, getItens, maxResultados = 8 }) {
  input.autocomplete = 'off';
  if (getComputedStyle(input.parentElement).position === 'static') {
    input.parentElement.classList.add('relative');
  }

  const dropdown = document.createElement('div');
  dropdown.className = 'absolute left-0 right-0 z-50 mt-1 hidden max-h-56 overflow-y-auto rounded-md border border-painel-border bg-painel-card shadow-lg shadow-black/30';
  input.insertAdjacentElement('afterend', dropdown);

  let resultados = [];
  let indiceAtivo = -1;

  function renderizar() {
    dropdown.innerHTML = resultados.length
      ? resultados.map((item, i) => `
          <div class="combobox-item cursor-pointer px-3 py-2 text-sm ${i === indiceAtivo ? 'bg-brand-yellow/15 text-brand-yellow' : 'text-slate-200 hover:bg-white/5'}" data-index="${i}">${escapeHtml(item.text)}</div>
        `).join('')
      : '<div class="px-3 py-2 text-sm text-slate-400">Nenhum resultado</div>';
    dropdown.classList.remove('hidden');
  }

  function fechar() {
    dropdown.classList.add('hidden');
    indiceAtivo = -1;
  }

  function selecionar(item) {
    input.value = item.text;
    hidden.value = item.id;
    fechar();
    input.dispatchEvent(new Event('combobox-select', { bubbles: true }));
  }

  function buscar() {
    const termo = input.value.trim().toLowerCase();
    hidden.value = '';
    if (!termo) { fechar(); return; }
    resultados = getItens().filter((i) => i.text.toLowerCase().includes(termo)).slice(0, maxResultados);
    indiceAtivo = -1;
    renderizar();
  }

  input.addEventListener('input', buscar);
  input.addEventListener('focus', () => { if (input.value.trim()) buscar(); });

  input.addEventListener('keydown', (event) => {
    if (dropdown.classList.contains('hidden')) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      indiceAtivo = Math.min(indiceAtivo + 1, resultados.length - 1);
      renderizar();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      indiceAtivo = Math.max(indiceAtivo - 1, 0);
      renderizar();
    } else if (event.key === 'Enter' && indiceAtivo >= 0) {
      event.preventDefault();
      selecionar(resultados[indiceAtivo]);
    } else if (event.key === 'Escape') {
      fechar();
    }
  });

  dropdown.addEventListener('mousedown', (event) => {
    const el = event.target.closest('[data-index]');
    if (!el) return;
    event.preventDefault();
    selecionar(resultados[Number(el.dataset.index)]);
  });

  document.addEventListener('click', (event) => {
    if (event.target !== input && !dropdown.contains(event.target)) fechar();
  });

  return {
    limpar() { input.value = ''; hidden.value = ''; fechar(); }
  };
}
