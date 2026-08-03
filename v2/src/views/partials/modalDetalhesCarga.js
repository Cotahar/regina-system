export function renderModalDetalhesCarga() {
  return `
  <div id="modal-detalhes" class="fixed inset-0 z-30 hidden items-start justify-center overflow-y-auto bg-black/60 py-6">
    <div class="card w-full max-w-4xl">
      <div class="mb-4 flex items-start justify-between">
        <div>
          <h2 class="text-lg font-semibold"><span id="det-codigo"></span> <span id="det-status-badge" class="ml-2 rounded px-2 py-0.5 text-xs"></span></h2>
          <p class="text-sm text-slate-400">Origem: <span id="det-origem"></span></p>
        </div>
        <button type="button" id="btn-fechar-detalhes" class="text-slate-400 hover:text-slate-100">&#10005;</button>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label class="mb-1 block text-xs text-slate-400">Motorista</label>
          <input list="lista-motoristas" id="det-motorista-input" class="input-field" placeholder="Buscar motorista...">
          <input type="hidden" id="det-motorista-id">
        </div>
        <div>
          <label class="mb-1 block text-xs text-slate-400">Veiculo</label>
          <input list="lista-veiculos" id="det-veiculo-input" class="input-field" placeholder="Buscar placa...">
          <input type="hidden" id="det-veiculo-id">
        </div>
        <div>
          <label class="mb-1 block text-xs text-slate-400">Data agendamento</label>
          <input type="date" id="det-data-agendamento" class="input-field">
        </div>
        <div>
          <label class="mb-1 block text-xs text-slate-400">Data carregamento</label>
          <input type="date" id="det-data-carregamento" class="input-field">
        </div>
        <div>
          <label class="mb-1 block text-xs text-slate-400">Previsao de entrega</label>
          <input type="date" id="det-previsao-entrega" class="input-field">
        </div>
        <div>
          <label class="mb-1 block text-xs text-slate-400">Data finalizacao</label>
          <input type="date" id="det-data-finalizacao" class="input-field">
        </div>
        <div>
          <label class="mb-1 block text-xs text-slate-400">Frete pago (R$)</label>
          <input type="text" id="det-frete-pago" class="input-field">
        </div>
        <div class="sm:col-span-2 lg:col-span-1">
          <label class="mb-1 block text-xs text-slate-400">Observacoes</label>
          <input type="text" id="det-observacoes" class="input-field">
        </div>
      </div>

      <div class="mt-3 flex flex-wrap gap-2" id="det-acoes"></div>

      <div class="mt-5">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-slate-300">Entregas</h3>
          <div class="flex gap-2">
            <button type="button" id="btn-lote-remetente" class="btn-secondary hidden px-2 py-1 text-xs">Alterar remetente selecionadas</button>
            <button type="button" id="btn-add-entrega" class="btn-secondary px-2 py-1 text-xs">+ Coleta rapida</button>
          </div>
        </div>

        <form id="form-lote-remetente" class="mb-3 hidden flex-wrap items-center gap-2 rounded-md border border-painel-border p-3">
          <span class="text-xs text-slate-400">Novo remetente para as selecionadas:</span>
          <input list="lista-clientes" id="lote-remetente-input" class="input-field max-w-xs" placeholder="Buscar cliente...">
          <input type="hidden" id="lote-remetente-id">
          <button type="submit" class="btn-primary px-3 py-1.5 text-xs">Aplicar</button>
        </form>

        <form id="form-add-entrega" class="mb-3 hidden grid grid-cols-2 gap-2 rounded-md border border-painel-border p-3 sm:grid-cols-5">
          <input list="lista-clientes" id="add-remetente-input" class="input-field" placeholder="Remetente...">
          <input type="hidden" id="add-remetente-id">
          <input list="lista-clientes" id="add-cliente-input" class="input-field" placeholder="Destinatario...">
          <input type="hidden" id="add-cliente-id">
          <input type="text" id="add-peso" class="input-field" placeholder="Peso bruto (kg)">
          <input type="text" id="add-frete" class="input-field" placeholder="Valor frete (R$)">
          <button type="submit" class="btn-primary">Adicionar</button>
        </form>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="text-slate-400">
              <tr>
                <th class="pb-2"><input type="checkbox" id="chk-todas"></th>
                <th class="pb-2">Ultima</th>
                <th class="pb-2">Remetente</th>
                <th class="pb-2">Destinatario</th>
                <th class="pb-2">Cidade/UF</th>
                <th class="pb-2">NF</th>
                <th class="pb-2">Peso</th>
                <th class="pb-2">Frete</th>
                <th class="pb-2 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody id="det-tabela-entregas"></tbody>
          </table>
        </div>
      </div>

      <p id="det-msg" class="mt-3 hidden text-sm"></p>
    </div>
  </div>

  <div id="modal-editar-entrega" class="fixed inset-0 z-40 hidden items-center justify-center bg-black/70">
    <form id="form-editar-entrega" class="card w-full max-w-md">
      <h3 class="mb-3 text-base font-semibold">Editar entrega</h3>
      <input type="hidden" id="edit-entrega-id">
      <div class="mb-2">
        <label class="mb-1 block text-xs text-slate-400">Remetente</label>
        <input list="lista-clientes" id="edit-remetente-input" class="input-field">
        <input type="hidden" id="edit-remetente-id">
      </div>
      <div class="mb-2 grid grid-cols-2 gap-2">
        <div>
          <label class="mb-1 block text-xs text-slate-400">Cidade (override)</label>
          <input type="text" id="edit-cidade" class="input-field">
        </div>
        <div>
          <label class="mb-1 block text-xs text-slate-400">UF (override)</label>
          <input type="text" id="edit-estado" class="input-field" maxlength="2">
        </div>
      </div>
      <div class="mb-2 grid grid-cols-2 gap-2">
        <div>
          <label class="mb-1 block text-xs text-slate-400">Peso bruto (kg)</label>
          <input type="text" id="edit-peso" class="input-field">
        </div>
        <div>
          <label class="mb-1 block text-xs text-slate-400">Peso cubado (kg)</label>
          <input type="text" id="edit-peso-cubado" class="input-field">
        </div>
      </div>
      <div class="mb-2 grid grid-cols-2 gap-2">
        <div>
          <label class="mb-1 block text-xs text-slate-400">Valor frete (R$)</label>
          <input type="text" id="edit-frete" class="input-field">
        </div>
        <div>
          <label class="mb-1 block text-xs text-slate-400">Nota fiscal</label>
          <input type="text" id="edit-nf" class="input-field">
        </div>
      </div>
      <p id="edit-msg" class="mb-2 hidden text-sm"></p>
      <div class="flex justify-end gap-2">
        <button type="button" id="btn-cancelar-edicao" class="btn-secondary">Cancelar</button>
        <button type="submit" class="btn-primary">Salvar</button>
      </div>
    </form>
  </div>

  <datalist id="lista-motoristas"></datalist>
  <datalist id="lista-veiculos"></datalist>
  <datalist id="lista-clientes"></datalist>
  `;
}
