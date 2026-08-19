import { renderModalDetalhesCarga } from './partials/modalDetalhesCarga.js';
import { renderModalEditarCliente } from './partials/modalEditarCliente.js';

const COLUNAS = [
  { status: 'Pendente', titulo: 'Pendente', ponto: 'bg-slate-400', borda: 'border-t-slate-400' },
  { status: 'Agendada', titulo: 'Agendada', ponto: 'bg-blue-400', borda: 'border-t-blue-400' },
  { status: 'Em Trânsito', titulo: 'Em Trânsito', ponto: 'bg-amber-400', borda: 'border-t-amber-400' }
];

export function renderDashboardPage() {
  return `
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Painel de Cargas</h1>
      <form id="form-nova-carga" class="flex gap-2">
        <input type="text" id="nova-origem" class="input-field input-field-sm w-48" placeholder="Origem da nova carga" required>
        <button type="submit" class="btn-primary btn-sm">+ Nova carga</button>
      </form>
    </div>

    <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
      ${COLUNAS.map((col) => `
        <div class="card border-t-4 ${col.borda}">
          <h2 class="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300">
            <span class="h-2 w-2 rounded-full ${col.ponto}"></span>${col.titulo}
            <span class="ml-auto rounded-full bg-painel-bg px-2 py-0.5 text-xs font-normal text-slate-400" data-contador="${col.status}">0</span>
          </h2>
          <input type="text" class="input-field mb-3 filtro-coluna" data-status="${col.status}" placeholder="Filtrar...">
          <div class="space-y-2" data-coluna="${col.status}"></div>
        </div>
      `).join('')}
    </div>

    ${renderModalDetalhesCarga()}
    ${renderModalEditarCliente()}
  `;
}
