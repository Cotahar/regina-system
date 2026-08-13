import { escapeHtml } from './escape.js';

// Lista oficial de municipios do IBGE (nome + UF), carregada uma unica vez
// e reaproveitada por todos os campos de cidade/UF da pagina.
let cachePromise = null;
function carregarMunicipios() {
  if (!cachePromise) {
    cachePromise = fetch('/data/municipios-br.json')
      .then((r) => r.json())
      .then((lista) => lista.map((linha) => {
        const [cidade, uf] = linha.split('|');
        return { cidade, uf };
      }));
  }
  return cachePromise;
}

// Combobox de cidade que consulta a lista real de municipios do Brasil (nao
// os dados ja cadastrados no sistema) - ao selecionar, preenche a UF junto.
export function criarComboboxMunicipio({ inputCidade, inputUf, maxResultados = 8 }) {
  inputCidade.autocomplete = 'off';
  if (getComputedStyle(inputCidade.parentElement).position === 'static') {
    inputCidade.parentElement.classList.add('relative');
  }

  const dropdown = document.createElement('div');
  dropdown.className = 'absolute left-0 right-0 z-50 mt-1 hidden max-h-56 overflow-y-auto rounded-md border border-painel-border bg-painel-card shadow-lg shadow-black/30';
  inputCidade.insertAdjacentElement('afterend', dropdown);

  let municipios = [];
  let resultados = [];
  let indiceAtivo = -1;

  carregarMunicipios().then((lista) => { municipios = lista; });

  function renderizar() {
    dropdown.innerHTML = resultados.length
      ? resultados.map((m, i) => `
          <div class="combobox-item cursor-pointer px-3 py-2 text-sm ${i === indiceAtivo ? 'bg-brand-yellow/15 text-brand-yellow' : 'text-slate-200 hover:bg-white/5'}" data-index="${i}">${escapeHtml(m.cidade)} <span class="text-slate-400">- ${escapeHtml(m.uf)}</span></div>
        `).join('')
      : '<div class="px-3 py-2 text-sm text-slate-400">Nenhum municipio encontrado</div>';
    dropdown.classList.remove('hidden');
  }

  function fechar() {
    dropdown.classList.add('hidden');
    indiceAtivo = -1;
  }

  function selecionar(m) {
    inputCidade.value = m.cidade;
    inputUf.value = m.uf;
    fechar();
    inputCidade.dispatchEvent(new Event('municipio-select', { bubbles: true }));
  }

  function buscar() {
    const termo = inputCidade.value.trim().toLowerCase();
    if (!termo) { fechar(); return; }
    resultados = municipios.filter((m) => m.cidade.toLowerCase().includes(termo)).slice(0, maxResultados);
    indiceAtivo = -1;
    renderizar();
  }

  inputCidade.addEventListener('input', buscar);
  inputCidade.addEventListener('focus', () => { if (inputCidade.value.trim()) buscar(); });

  inputCidade.addEventListener('keydown', (event) => {
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
    if (event.target !== inputCidade && !dropdown.contains(event.target)) fechar();
  });
}
