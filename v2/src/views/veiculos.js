export function renderVeiculosPage() {
  return `
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Veiculos</h1>
      <button id="btn-novo" class="btn-primary">+ Novo veiculo</button>
    </div>

    <div class="card mt-4">
      <h2 class="mb-3 text-sm font-semibold text-slate-300">Importar planilha (CSV: placa)</h2>
      <form id="form-import" class="flex flex-wrap items-end gap-3">
        <input type="file" id="arquivo-import" accept=".csv" class="input-field max-w-xs" required>
        <button type="submit" class="btn-secondary">Importar</button>
      </form>
      <p id="msg-import" class="mt-2 hidden text-sm"></p>

      <details class="mt-3">
        <summary class="cursor-pointer text-xs text-slate-400">ou colar linhas copiadas do Excel (placa)</summary>
        <textarea id="colar-texto" class="input-field mt-2" rows="4" placeholder="ABC1234"></textarea>
        <button type="button" id="btn-colar-importar" class="btn-secondary mt-2">Importar do texto colado</button>
      </details>
    </div>

    <div class="card mt-4">
      <input type="text" id="filtro-busca" placeholder="Buscar por placa..." class="input-field mb-3 max-w-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-slate-400">
            <tr><th class="pb-2">Placa</th><th class="pb-2 text-right">Acoes</th></tr>
          </thead>
          <tbody id="tabela-veiculos"></tbody>
        </table>
      </div>
      <div id="paginacao-veiculos" class="mt-3 flex flex-wrap items-center justify-center gap-3"></div>
    </div>

    <div id="modal-veiculo" class="fixed inset-0 z-20 hidden items-center justify-center bg-slate-900/50">
      <form id="form-veiculo" class="card w-full max-w-md">
        <h2 class="mb-4 text-lg font-semibold" id="modal-titulo">Novo veiculo</h2>
        <input type="hidden" id="veiculo-id">
        <div class="mb-4">
          <label class="label">Placa</label>
          <input type="text" id="veiculo-placa" class="input-field" required>
        </div>
        <p id="msg-modal" class="mb-3 hidden text-sm"></p>
        <div class="flex justify-end gap-2">
          <button type="button" id="btn-cancelar" class="btn-secondary">Cancelar</button>
          <button type="submit" class="btn-success">Salvar</button>
        </div>
      </form>
    </div>
  `;
}
