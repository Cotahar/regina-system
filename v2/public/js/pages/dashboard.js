import { apiGet, apiPost } from '../shared/api.js';
import { escapeHtml } from '../shared/escape.js';
import { formatarMoeda, formatarPeso, formatarData } from '../shared/format.js';
import { criarModalDetalhesCarga } from '../shared/carga-modal.js';
import { ouvirMudancas } from '../shared/live.js';

const isAdmin = window.__SESSAO__?.permissao === 'admin';
let cargas = [];

const modalDetalhes = criarModalDetalhesCarga({ isAdmin, onMudanca: carregar });

function ordenarColuna(status, lista) {
  if (status === 'Agendada') {
    return [...lista].sort((a, b) => (a.data_agendamento || '9999').localeCompare(b.data_agendamento || '9999'));
  }
  if (status === 'Em Trânsito') {
    return [...lista].sort((a, b) => (a.previsao_entrega || '9999').localeCompare(b.previsao_entrega || '9999'));
  }
  return [...lista].sort((a, b) => b.id - a.id);
}

const BORDA_STATUS = {
  Pendente: 'border-l-slate-400 hover:border-l-slate-600',
  Agendada: 'border-l-blue-400 hover:border-l-blue-600',
  'Em Trânsito': 'border-l-amber-400 hover:border-l-amber-600'
};

// Cada string do array "destinos" (que a API ja calcula) vem como
// "CIDADE-UF" - separa em { cidade, uf } pra poder estilizar cada parte
// diferente (cidade normal, UF como badge) em vez do hifen cru.
function destinosCidadeUf(c) {
  const lista = (c.destinos || []).map((d) => {
    const idx = d.lastIndexOf('-');
    return idx === -1 ? { cidade: d, uf: '' } : { cidade: d.slice(0, idx), uf: d.slice(idx + 1) };
  }).filter((d) => d.cidade || d.uf);
  return lista.length ? lista : [{ cidade: 'N/A', uf: '' }];
}

function renderizarCard(c) {
  const borda = BORDA_STATUS[c.status] || 'border-l-slate-400';
  const destinos = destinosCidadeUf(c).map(({ cidade, uf }) => `
    <span class="inline-flex items-center gap-1">
      <span class="capitalize">${escapeHtml(cidade.toLowerCase())}</span>
      ${uf ? `<span class="rounded bg-painel-bg px-1.5 py-0.5 text-[11px] font-bold text-slate-200">${escapeHtml(uf)}</span>` : ''}
    </span>
  `).join('<span class="text-slate-600">,</span>');
  return `
    <div class="cursor-pointer rounded-md border border-painel-border border-l-4 ${borda} bg-painel-card p-3 text-sm shadow-md shadow-black/20 transition-colors hover:bg-white/[0.03]" data-id="${c.id}" data-busca="${escapeHtml(`${c.codigo_carga} ${c.destino_principal} ${c.motorista_nome || ''} ${c.placa_veiculo || ''}`.toLowerCase())}">
      <div class="flex items-center justify-between">
        <span class="flex items-center gap-1.5">
          <span class="font-semibold text-brand-yellow">${escapeHtml(c.codigo_carga)}</span>
          ${c.veiculo_frota ? '<span class="rounded bg-violet-900/40 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">FROTA</span>' : ''}
        </span>
        <span class="text-xs text-slate-400">${c.num_entregas} entrega(s)</span>
      </div>
      <div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-slate-300">
        <span class="capitalize">${escapeHtml(c.origem.toLowerCase())}</span>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 shrink-0 text-slate-500"><path d="M4 10h12M11 5l5 5-5 5"/></svg>
        <span class="flex flex-wrap items-center gap-1">${destinos}</span>
      </div>
      <p class="mt-1.5 text-xs font-semibold text-slate-200">${escapeHtml(c.motorista_nome || 'Sem motorista')}${c.placa_veiculo ? ' - ' + escapeHtml(c.placa_veiculo) : ''}</p>
      <p class="mt-1 text-xs font-semibold text-slate-200">${formatarPeso(c.peso_total)} &middot; ${formatarMoeda(c.valor_frete_total)}</p>
      ${linhaData(c)}
    </div>
  `;
}

// Cada coluna do painel mostra so a data relevante pro seu estagio - a
// data de agendamento nao importa mais depois que a carga ja esta em
// transito, por exemplo.
function linhaData(c) {
  if (c.status === 'Agendada' && c.data_agendamento) {
    return `<p class="mt-1 text-xs text-slate-400">Agendado: ${formatarData(c.data_agendamento)}</p>`;
  }
  if (c.status === 'Em Trânsito') {
    return `
      ${c.data_carregamento ? `<p class="mt-1 text-xs text-slate-400">Carregado: ${formatarData(c.data_carregamento)}</p>` : ''}
      ${c.previsao_entrega ? `<p class="mt-1 text-xs text-slate-400">Previsao: ${formatarData(c.previsao_entrega)}</p>` : ''}
    `;
  }
  return '';
}

function renderizarColunas() {
  document.querySelectorAll('[data-coluna]').forEach((container) => {
    const status = container.dataset.coluna;
    const itens = ordenarColuna(status, cargas.filter((c) => c.status === status));
    container.innerHTML = itens.map(renderizarCard).join('') ||
      '<p class="py-3 text-center text-xs text-slate-400">Nenhuma carga.</p>';

    const contador = document.querySelector(`[data-contador="${status}"]`);
    if (contador) contador.textContent = itens.length;

    container.querySelectorAll('[data-id]').forEach((card) => {
      card.addEventListener('click', () => modalDetalhes.abrir(Number(card.dataset.id)));
    });
  });
}

async function carregar() {
  cargas = await apiGet('/api/cargas');
  renderizarColunas();
}

document.querySelectorAll('.filtro-coluna').forEach((input) => {
  input.addEventListener('input', () => {
    const status = input.dataset.status;
    const termo = input.value.trim().toLowerCase();
    const container = document.querySelector(`[data-coluna="${status}"]`);
    container.querySelectorAll('[data-id]').forEach((card) => {
      card.classList.toggle('hidden', !card.dataset.busca.includes(termo));
    });
  });
});

document.getElementById('form-nova-carga').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('nova-origem');
  try {
    await apiPost('/api/cargas', { origem: input.value.trim() });
    input.value = '';
    await carregar();
  } catch (err) {
    alert(err.message);
  }
});

carregar();
ouvirMudancas(carregar);
