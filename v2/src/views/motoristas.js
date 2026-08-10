export function renderMotoristasPage() {
  return `
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Motoristas</h1>
      <button id="btn-novo" class="btn-primary">+ Novo motorista</button>
    </div>

    <div class="card mt-4">
      <h2 class="mb-3 text-sm font-semibold text-slate-300">Importar planilha (CSV: codigo, nome)</h2>
      <form id="form-import" class="flex flex-wrap items-end gap-3">
        <input type="file" id="arquivo-import" accept=".csv" class="input-field max-w-xs" required>
        <button type="submit" class="btn-secondary">Importar</button>
      </form>
      <p id="msg-import" class="mt-2 hidden text-sm"></p>

      <details class="mt-3">
        <summary class="cursor-pointer text-xs text-slate-400">ou colar linhas copiadas do Excel (codigo [tab] nome)</summary>
        <textarea id="colar-texto" class="input-field mt-2" rows="4" placeholder="M100	Fulano de Tal"></textarea>
        <button type="button" id="btn-colar-importar" class="btn-secondary mt-2">Importar do texto colado</button>
      </details>
    </div>

    <div class="card mt-4">
      <input type="text" id="filtro-busca" placeholder="Buscar por nome ou codigo..." class="input-field mb-3 max-w-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-slate-400">
            <tr><th class="pb-2">Codigo</th><th class="pb-2">Nome</th><th class="pb-2 text-right">Acoes</th></tr>
          </thead>
          <tbody id="tabela-motoristas"></tbody>
        </table>
      </div>
      <div id="paginacao-motoristas" class="mt-3 flex flex-wrap items-center justify-center gap-3"></div>
    </div>

    <div id="modal-motorista" class="fixed inset-0 z-20 hidden items-center justify-center bg-black/60">
      <form id="form-motorista" class="card w-full max-w-sm">
        <h2 class="mb-4 text-lg font-semibold" id="modal-titulo">Novo motorista</h2>
        <input type="hidden" id="motorista-id">
        <div class="mb-3">
          <label class="mb-1 block text-xs text-slate-400">Codigo</label>
          <input type="text" id="motorista-codigo" class="input-field">
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-xs text-slate-400">Nome</label>
          <input type="text" id="motorista-nome" class="input-field" required>
        </div>
        <p id="msg-modal" class="mb-3 hidden text-sm"></p>
        <div class="flex justify-end gap-2">
          <button type="button" id="btn-cancelar" class="btn-secondary">Cancelar</button>
          <button type="submit" class="btn-primary">Salvar</button>
        </div>
      </form>
    </div>
  `;
}
