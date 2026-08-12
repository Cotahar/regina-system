export function renderMarcasPage({ isAdmin }) {
  return `
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Marcas</h1>
      ${isAdmin ? '<button id="btn-novo" class="btn-primary">+ Nova marca</button>' : ''}
    </div>

    <div class="card mt-4" data-admin="${isAdmin ? '1' : '0'}">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-slate-600">
            <tr><th class="pb-2">Nome</th>${isAdmin ? '<th class="pb-2 text-right">Acoes</th>' : ''}</tr>
          </thead>
          <tbody id="tabela-marcas"></tbody>
        </table>
      </div>
    </div>

    ${isAdmin ? `
    <div id="modal-marca" class="fixed inset-0 z-20 hidden items-center justify-center bg-slate-900/50">
      <form id="form-marca" class="card w-full max-w-md">
        <h2 class="mb-4 text-lg font-semibold" id="modal-titulo">Nova marca</h2>
        <input type="hidden" id="marca-id">
        <div class="mb-4">
          <label class="mb-1 block text-xs text-slate-600">Nome</label>
          <input type="text" id="marca-nome" class="input-field" required>
        </div>
        <p id="msg-modal" class="mb-3 hidden text-sm"></p>
        <div class="flex justify-end gap-2">
          <button type="button" id="btn-cancelar" class="btn-secondary">Cancelar</button>
          <button type="submit" class="btn-success">Salvar</button>
        </div>
      </form>
    </div>` : ''}
  `;
}
