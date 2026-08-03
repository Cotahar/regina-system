import { renderModalDetalhesCarga } from './partials/modalDetalhesCarga.js';

export function renderConsultaPage() {
  return `
    <h1 class="text-xl font-semibold">Consulta de Cargas</h1>

    <form id="form-filtros" class="card mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <input type="text" id="f-codigo" class="input-field" placeholder="Codigo da carga">
      <input type="text" id="f-origem" class="input-field" placeholder="Origem">
      <select id="f-status" class="input-field">
        <option value="">Status (todos)</option>
        <option value="Pendente">Pendente</option>
        <option value="Agendada">Agendada</option>
        <option value="Em Trânsito">Em Trânsito</option>
        <option value="Finalizada">Finalizada</option>
      </select>
      <input type="text" id="f-motorista" class="input-field" placeholder="Motorista">
      <input type="text" id="f-placa" class="input-field" placeholder="Placa">
      <input list="lista-clientes-filtro" id="f-cliente-input" class="input-field" placeholder="Cliente...">
      <input type="hidden" id="f-cliente-id">
      <div>
        <label class="mb-1 block text-xs text-slate-400">Carregamento de</label>
        <input type="date" id="f-carreg-inicio" class="input-field">
      </div>
      <div>
        <label class="mb-1 block text-xs text-slate-400">Carregamento ate</label>
        <input type="date" id="f-carreg-fim" class="input-field">
      </div>
      <div>
        <label class="mb-1 block text-xs text-slate-400">Finalizacao de</label>
        <input type="date" id="f-final-inicio" class="input-field">
      </div>
      <div>
        <label class="mb-1 block text-xs text-slate-400">Finalizacao ate</label>
        <input type="date" id="f-final-fim" class="input-field">
      </div>
      <div class="flex items-end gap-2 sm:col-span-3 lg:col-span-4">
        <button type="submit" class="btn-primary">Buscar</button>
        <button type="button" id="btn-limpar" class="btn-secondary">Limpar</button>
      </div>
    </form>
    <datalist id="lista-clientes-filtro"></datalist>

    <div class="card mt-4">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-slate-400">
            <tr>
              <th class="pb-2">Codigo</th><th class="pb-2">Status</th><th class="pb-2">Origem</th>
              <th class="pb-2">Destino</th><th class="pb-2">Motorista</th><th class="pb-2">Entregas</th>
              <th class="pb-2">Peso</th><th class="pb-2">Finalizacao</th>
            </tr>
          </thead>
          <tbody id="tabela-resultados"></tbody>
        </table>
      </div>
      <div id="paginacao" class="mt-3 flex items-center justify-center gap-2 text-sm"></div>
    </div>

    ${renderModalDetalhesCarga()}
  `;
}
