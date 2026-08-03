export function renderClientesPage() {
  return `
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Clientes</h1>
      <button id="btn-novo" class="btn-primary">+ Novo cliente</button>
    </div>

    <div class="card mt-4">
      <h2 class="mb-3 text-sm font-semibold text-slate-300">Importar planilha (CSV: codigo, razao social, ddd, telefone, cidade, estado, observacoes)</h2>
      <form id="form-import" class="flex flex-wrap items-end gap-3">
        <input type="file" id="arquivo-import" accept=".csv" class="input-field max-w-xs" required>
        <button type="submit" class="btn-secondary">Importar</button>
      </form>
      <p id="msg-import" class="mt-2 hidden text-sm"></p>
    </div>

    <div class="card mt-4">
      <input type="text" id="filtro-busca" placeholder="Buscar por codigo, nome ou cidade..." class="input-field mb-3 max-w-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-slate-400">
            <tr>
              <th class="pb-2">Codigo</th>
              <th class="pb-2">Razao Social</th>
              <th class="pb-2">Cidade/UF</th>
              <th class="pb-2">Telefone</th>
              <th class="pb-2">Entregas</th>
              <th class="pb-2">Remetente</th>
              <th class="pb-2 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody id="tabela-clientes"></tbody>
        </table>
      </div>
    </div>

    <div id="modal-cliente" class="fixed inset-0 z-20 hidden items-center justify-center overflow-y-auto bg-black/60 py-8">
      <form id="form-cliente" class="card w-full max-w-lg">
        <h2 class="mb-4 text-lg font-semibold" id="modal-titulo">Novo cliente</h2>
        <input type="hidden" id="cliente-id">

        <div class="mb-3">
          <label class="mb-1 block text-xs text-slate-400">Codigo do cliente</label>
          <input type="text" id="cliente-codigo" class="input-field" placeholder="Deixe em branco para gerar automaticamente">
        </div>

        <div class="mb-3">
          <label class="mb-1 block text-xs text-slate-400">Razao social</label>
          <input type="text" id="cliente-razao" class="input-field" required>
        </div>

        <div class="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs text-slate-400">Cidade</label>
            <input type="text" id="cliente-cidade" class="input-field">
          </div>
          <div>
            <label class="mb-1 block text-xs text-slate-400">Estado (UF)</label>
            <input type="text" id="cliente-estado" class="input-field" maxlength="2">
          </div>
        </div>

        <div class="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs text-slate-400">DDD</label>
            <input type="text" id="cliente-ddd" class="input-field" maxlength="2">
          </div>
          <div>
            <label class="mb-1 block text-xs text-slate-400">Telefone</label>
            <input type="text" id="cliente-telefone" class="input-field">
          </div>
        </div>

        <div class="mb-3">
          <label class="mb-1 block text-xs text-slate-400">Observacoes</label>
          <textarea id="cliente-observacoes" class="input-field" rows="2"></textarea>
        </div>

        <label class="mb-3 flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" id="cliente-remetente" class="h-4 w-4">
          Este cliente tambem pode ser remetente (origem de coleta)
        </label>

        <div class="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs text-slate-400">Forma de pagamento padrao</label>
            <select id="cliente-forma-pagamento" class="input-field">
              <option value="">-</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-slate-400">Tipo de pagamento padrao</label>
            <select id="cliente-tipo-pagamento" class="input-field">
              <option value="">-</option>
              <option value="Boleto">Boleto</option>
              <option value="Transferencia">Transferencia</option>
            </select>
          </div>
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
