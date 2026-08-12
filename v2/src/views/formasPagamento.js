export function renderFormasPagamentoPage() {
  return `
    <h1 class="text-xl font-semibold">Formas de Pagamento</h1>

    <div class="card mt-4">
      <form id="form-nova" class="flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[200px]">
          <label class="mb-1 block text-xs text-slate-600">Descricao</label>
          <input type="text" id="nova-descricao" class="input-field" placeholder="Ex: 30 DIAS" required>
        </div>
        <button type="submit" class="btn-primary">Adicionar</button>
      </form>
      <p id="msg-nova" class="mt-2 hidden text-sm"></p>
    </div>

    <div class="card mt-4">
      <ul id="lista-formas" class="divide-y divide-painel-border text-sm"></ul>
    </div>
  `;
}
