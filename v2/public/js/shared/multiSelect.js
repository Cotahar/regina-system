import { escapeHtml } from './escape.js';

// Botao de filtro que abre um dropdown com checkboxes - as opcoes vem de
// getOpcoes() (chamado toda vez que o dropdown abre, pra refletir a lista
// atual). onChange recebe o Set de valores selecionados a cada mudanca.
export function criarFiltroMultiSelect({ botao, getOpcoes, onChange }) {
  const selecionados = new Set();
  const rotuloBase = botao.textContent;
  let dropdown = null;

  if (getComputedStyle(botao.parentElement).position === 'static') {
    botao.parentElement.classList.add('relative');
  }

  function aoClicarFora(event) {
    if (dropdown && !dropdown.contains(event.target) && event.target !== botao) fechar();
  }

  function fechar() {
    dropdown?.remove();
    dropdown = null;
    document.removeEventListener('mousedown', aoClicarFora);
  }

  function atualizarRotulo() {
    botao.textContent = selecionados.size ? `${rotuloBase} (${selecionados.size})` : rotuloBase;
    botao.classList.toggle('border-brand-yellow', selecionados.size > 0);
    botao.classList.toggle('text-brand-yellow', selecionados.size > 0);
  }

  function abrir() {
    if (dropdown) { fechar(); return; }
    const opcoes = getOpcoes();
    dropdown = document.createElement('div');
    dropdown.className = 'absolute left-0 z-50 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border border-painel-border bg-painel-card p-1.5 shadow-lg shadow-black/30';
    dropdown.innerHTML = opcoes.length
      ? opcoes.map((op) => `
          <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-200 hover:bg-white/5">
            <input type="checkbox" class="h-3.5 w-3.5 shrink-0" value="${escapeHtml(op)}" ${selecionados.has(op) ? 'checked' : ''}>
            <span class="truncate">${escapeHtml(op)}</span>
          </label>
        `).join('')
      : '<p class="px-2 py-1.5 text-sm text-slate-400">Nenhuma opcao disponivel</p>';
    botao.insertAdjacentElement('afterend', dropdown);

    dropdown.querySelectorAll('input[type=checkbox]').forEach((chk) => {
      chk.addEventListener('change', () => {
        if (chk.checked) selecionados.add(chk.value); else selecionados.delete(chk.value);
        atualizarRotulo();
        onChange(selecionados);
      });
    });

    setTimeout(() => document.addEventListener('mousedown', aoClicarFora), 0);
  }

  botao.addEventListener('click', abrir);

  return {
    limpar() { selecionados.clear(); atualizarRotulo(); onChange(selecionados); },
    selecionados
  };
}
