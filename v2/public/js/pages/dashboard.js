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

function renderizarCard(c) {
  return `
    <div class="cursor-pointer rounded-md border border-painel-border bg-painel-bg p-3 text-sm hover:border-destaque" data-id="${c.id}" data-busca="${escapeHtml(`${c.codigo_carga} ${c.destino_principal} ${c.motorista_nome || ''} ${c.placa_veiculo || ''}`.toLowerCase())}">
      <div class="flex items-center justify-between">
        <span class="font-semibold text-destaque">${escapeHtml(c.codigo_carga)}</span>
        <span class="text-xs text-slate-400">${c.num_entregas} entrega(s)</span>
      </div>
      <p class="mt-1 text-slate-300">${escapeHtml(c.origem)} &rarr; ${escapeHtml(c.destino_principal)}</p>
      <p class="mt-1 text-xs text-slate-400">${escapeHtml(c.motorista_nome || 'Sem motorista')} ${c.placa_veiculo ? '- ' + escapeHtml(c.placa_veiculo) : ''}</p>
      <p class="mt-1 text-xs text-slate-400">${formatarPeso(c.peso_total)} - ${formatarMoeda(c.valor_frete_total)}</p>
      ${linhaData(c)}
    </div>
  `;
}

// Cada coluna do painel mostra so a data relevante pro seu estagio - a
// data de agendamento nao importa mais depois que a carga ja esta em
// transito, por exemplo.
function linhaData(c) {
  if (c.status === 'Agendada' && c.data_agendamento) {
    return `<p class="mt-1 text-xs text-slate-500">Agendado: ${formatarData(c.data_agendamento)}</p>`;
  }
  if (c.status === 'Em Trânsito') {
    return `
      ${c.data_carregamento ? `<p class="mt-1 text-xs text-slate-500">Carregado: ${formatarData(c.data_carregamento)}</p>` : ''}
      ${c.previsao_entrega ? `<p class="mt-1 text-xs text-slate-500">Previsao: ${formatarData(c.previsao_entrega)}</p>` : ''}
    `;
  }
  return '';
}

function renderizarColunas() {
  document.querySelectorAll('[data-coluna]').forEach((container) => {
    const status = container.dataset.coluna;
    const itens = ordenarColuna(status, cargas.filter((c) => c.status === status));
    container.innerHTML = itens.map(renderizarCard).join('') ||
      '<p class="py-3 text-center text-xs text-slate-500">Nenhuma carga.</p>';

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
