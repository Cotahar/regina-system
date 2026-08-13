export function renderMontagemPage() {
  return `
    <h1 class="text-xl font-semibold">Montagem de Cargas</h1>

    <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div class="space-y-4 lg:col-span-1">
        <div class="card">
          <h2 class="mb-3 text-sm font-semibold text-slate-300">Nova entrega disponivel</h2>
          <form id="form-nova-entrega" class="space-y-2">
            <div class="relative"><input id="nova-remetente-input" class="input-field" placeholder="Remetente..."></div>
            <input type="hidden" id="nova-remetente-id">
            <div class="relative"><input id="nova-cliente-input" class="input-field" placeholder="Destinatario..."></div>
            <input type="hidden" id="nova-cliente-id">
            <input type="text" id="nova-local-coleta" class="input-field" placeholder="Local de coleta (se diferente do remetente)">
            <div class="grid grid-cols-2 gap-2">
              <input type="text" id="nova-cidade" class="input-field" placeholder="Cidade de entrega (opcional)">
              <input type="text" id="nova-estado" class="input-field" placeholder="UF" maxlength="2">
            </div>
            <div class="grid grid-cols-2 gap-2">
              <input type="text" id="nova-peso" class="input-field" placeholder="Peso bruto (kg)">
              <input type="text" id="nova-cubado" class="input-field" placeholder="Peso cubado (kg)">
            </div>
            <div class="grid grid-cols-2 gap-2">
              <input type="text" id="nova-frete" class="input-field" placeholder="Valor frete (R$)">
              <input type="text" id="nova-tonelada" class="input-field" placeholder="Valor/tonelada (R$)">
            </div>
            <input type="text" id="nova-nf" class="input-field" placeholder="Nota fiscal">
            <label class="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" id="nova-cortesia" class="h-4 w-4"> Cortesia (sem cobranca)
            </label>
            <button type="submit" class="btn-primary w-full">Adicionar a lista</button>
          </form>
          <p id="msg-nova" class="mt-2 hidden text-sm"></p>
        </div>

        <div class="card">
          <h2 class="mb-3 text-sm font-semibold text-slate-300">Rascunhos salvos</h2>
          <div id="lista-rascunhos" class="space-y-2 text-sm"></div>
        </div>
      </div>

      <div class="lg:col-span-2">
        <div class="card">
          <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div class="flex-1 min-w-[200px]">
              <label class="mb-1 block text-xs text-slate-400">Origem do rascunho</label>
              <input type="text" id="origem-rascunho" class="input-field" placeholder="Ex: CRICIUMA SC">
            </div>
            <div class="flex gap-2">
              <button type="button" id="btn-novo-rascunho" class="btn-secondary">Novo rascunho</button>
              <button type="button" id="btn-salvar-rascunho" class="btn-success">Salvar Rascunho</button>
            </div>
          </div>

          <div class="mb-3">
            <input type="text" id="filtro-busca" class="input-field mb-2 max-w-xs" placeholder="Buscar na lista...">
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-painel-border bg-painel-bg/40 p-2">
              <div class="flex flex-wrap gap-2">
                <button type="button" id="btn-agrupar" class="btn-secondary btn-sm">Agrupar selecionadas</button>
                <button type="button" id="btn-desagrupar" class="btn-secondary btn-sm">Desagrupar selecionadas</button>
                <button type="button" id="btn-lote-remetente" class="btn-secondary btn-sm">Alterar remetente selecionadas</button>
              </div>
              <div class="h-6 w-px bg-painel-border max-sm:hidden"></div>
              <button type="button" id="btn-excluir-selecionadas" class="btn-danger btn-sm ml-auto">Excluir selecionadas</button>
            </div>
          </div>

          <form id="form-lote-remetente" class="mb-3 hidden flex-wrap items-center gap-2 rounded-md border border-painel-border p-3">
            <div class="relative w-full max-w-xs"><input id="lote-remetente-input" class="input-field" placeholder="Novo remetente..."></div>
            <input type="hidden" id="lote-remetente-id">
            <button type="submit" class="btn-success btn-sm">Aplicar</button>
          </form>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="text-slate-400">
                <tr>
                  <th class="pb-2"><input type="checkbox" id="chk-todas"></th>
                  <th class="pb-2">Remetente</th>
                  <th class="pb-2">Destinatario</th>
                  <th class="pb-2">Cidade/UF</th>
                  <th class="pb-2">NF</th>
                  <th class="pb-2">Peso</th>
                  <th class="pb-2">Cubado</th>
                  <th class="pb-2">Frete</th>
                  <th class="pb-2 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody id="tabela-entregas"></tbody>
              <tfoot class="border-t border-painel-border font-semibold text-slate-300">
                <tr>
                  <td colspan="5" class="pt-2">Totais (selecionadas):</td>
                  <td class="pt-2" id="total-peso">0,00 kg</td>
                  <td class="pt-2" id="total-cubado">0,00 kg</td>
                  <td class="pt-2" id="total-frete">R$ 0,00</td>
                  <td class="pt-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div id="modal-editar" class="fixed inset-0 z-20 hidden items-center justify-center bg-slate-900/50">
      <form id="form-editar" class="card w-full max-w-lg">
        <h3 class="mb-3 text-base font-semibold">Editar entrega</h3>
        <input type="hidden" id="edit-id">
        <div class="relative mb-2">
          <label class="mb-1 block text-xs text-slate-400">Remetente</label>
          <input id="edit-remetente-input" class="input-field">
          <input type="hidden" id="edit-remetente-id">
        </div>
        <div class="mb-2 grid grid-cols-2 gap-2">
          <div><label class="mb-1 block text-xs text-slate-400">Cidade</label><input type="text" id="edit-cidade" class="input-field"></div>
          <div><label class="mb-1 block text-xs text-slate-400">UF</label><input type="text" id="edit-estado" class="input-field" maxlength="2"></div>
        </div>
        <div class="mb-2 grid grid-cols-2 gap-2">
          <div><label class="mb-1 block text-xs text-slate-400">Peso bruto</label><input type="text" id="edit-peso" class="input-field"></div>
          <div><label class="mb-1 block text-xs text-slate-400">Peso cubado</label><input type="text" id="edit-cubado" class="input-field"></div>
        </div>
        <div class="mb-2 grid grid-cols-2 gap-2">
          <div><label class="mb-1 block text-xs text-slate-400">Valor frete</label><input type="text" id="edit-frete" class="input-field"></div>
          <div><label class="mb-1 block text-xs text-slate-400">Valor/tonelada</label><input type="text" id="edit-tonelada" class="input-field"></div>
        </div>
        <div class="mb-2">
          <label class="mb-1 block text-xs text-slate-400">Nota fiscal</label>
          <input type="text" id="edit-nf" class="input-field">
        </div>
        <div class="mb-2">
          <label class="mb-1 block text-xs text-slate-400">Local de coleta (se diferente do remetente)</label>
          <input type="text" id="edit-local-coleta" class="input-field">
        </div>
        <label class="mb-2 flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" id="edit-cortesia" class="h-4 w-4"> Cortesia (sem cobranca)
        </label>
        <p id="edit-msg" class="mb-2 hidden text-sm"></p>
        <div class="flex justify-end gap-2">
          <button type="button" id="btn-cancelar-edicao" class="btn-secondary">Cancelar</button>
          <button type="submit" class="btn-success">Salvar</button>
        </div>
      </form>
    </div>
  `;
}
