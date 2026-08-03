import { renderModalDetalhesCarga } from './partials/modalDetalhesCarga.js';

const COLUNAS = [
  { status: 'Pendente', titulo: 'Pendente' },
  { status: 'Agendada', titulo: 'Agendada' },
  { status: 'Em Trânsito', titulo: 'Em Trânsito' }
];

export function renderDashboardPage() {
  return `
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Painel de Cargas</h1>
      <form id="form-nova-carga" class="flex gap-2">
        <input type="text" id="nova-origem" class="input-field" placeholder="Origem da nova carga" required>
        <button type="submit" class="btn-primary">+ Nova carga</button>
      </form>
    </div>

    <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
      ${COLUNAS.map((col) => `
        <div class="card">
          <h2 class="mb-2 text-sm font-semibold text-slate-300">${col.titulo}</h2>
          <input type="text" class="input-field mb-3 filtro-coluna" data-status="${col.status}" placeholder="Filtrar...">
          <div class="space-y-2" data-coluna="${col.status}"></div>
        </div>
      `).join('')}
    </div>

    ${renderModalDetalhesCarga()}
  `;
}
