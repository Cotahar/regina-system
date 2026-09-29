export function renderOrdensColetaPage() {
  return `
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Ordens de Coleta</h1>
      <button type="button" id="btn-nova-ordem" class="btn-primary btn-sm">+ Nova ordem de coleta</button>
    </div>

    <div class="card mt-4">
      <h2 class="mb-3 text-sm font-semibold text-slate-300">Ordens de coleta</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="text-slate-400">
            <tr>
              <th class="pb-2">Codigo</th>
              <th class="pb-2">Status</th>
              <th class="pb-2">Motorista / Veiculo</th>
              <th class="pb-2">Entregas</th>
              <th class="pb-2">Peso</th>
              <th class="pb-2">Local de coleta (baixa)</th>
              <th class="pb-2 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody id="tabela-ordens"></tbody>
        </table>
      </div>
    </div>

    <div id="secao-form-ordem" class="card mt-4 hidden">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-slate-300" id="form-ordem-titulo">Nova ordem de coleta</h2>
        <button type="button" id="btn-fechar-form-ordem" class="btn-secondary btn-sm">Fechar</button>
      </div>

      <div class="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="relative">
          <label class="label">Motorista (opcional)</label>
          <input id="ordem-motorista-input" class="input-field" placeholder="Buscar motorista...">
          <input type="hidden" id="ordem-motorista-id">
        </div>
        <div class="relative">
          <label class="label">Veiculo (opcional)</label>
          <input id="ordem-veiculo-input" class="input-field" placeholder="Buscar veiculo...">
          <input type="hidden" id="ordem-veiculo-id">
        </div>
        <div>
          <label class="label">Observacoes</label>
          <input type="text" id="ordem-observacoes" class="input-field">
        </div>
      </div>

      <div class="mb-2">
        <input type="text" id="filtro-entregas-ordem" class="input-field max-w-xs" placeholder="Buscar entregas...">
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="text-slate-400">
            <tr>
              <th class="pb-2"><input type="checkbox" id="chk-todas-ordem"></th>
              <th class="pb-2">Remetente</th>
              <th class="pb-2">Destinatario</th>
              <th class="pb-2">Cidade/UF</th>
              <th class="pb-2">NF</th>
              <th class="pb-2">Peso</th>
              <th class="pb-2">Origem</th>
            </tr>
          </thead>
          <tbody id="tabela-entregas-ordem"></tbody>
        </table>
      </div>

      <p id="msg-form-ordem" class="mt-3 hidden text-sm"></p>
      <div class="mt-3 flex justify-end gap-2">
        <button type="button" id="btn-salvar-ordem" class="btn-success">Salvar ordem de coleta</button>
      </div>
    </div>

    <div id="modal-baixar-coleta" class="fixed inset-0 z-20 hidden items-center justify-center bg-slate-900/50">
      <div class="card w-full max-w-md">
        <h3 class="mb-3 text-base font-semibold">Baixar coleta</h3>
        <p class="mb-3 text-xs text-slate-400">Informe o cliente cadastrado onde a coleta foi realizada. Esse local passa a valer pra todas as entregas dessa ordem.</p>
        <label class="label">Local de coleta</label>
        <div class="relative">
          <input id="baixar-cliente-input" class="input-field" placeholder="Buscar cliente...">
          <input type="hidden" id="baixar-cliente-id">
        </div>
        <p id="msg-baixar-coleta" class="mt-2 hidden text-sm"></p>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" id="btn-baixar-cancelar" class="btn-secondary">Cancelar</button>
          <button type="button" id="btn-baixar-confirmar" class="btn-success">Confirmar baixa</button>
        </div>
      </div>
    </div>
  `;
}
