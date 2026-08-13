export function renderMontagemPage() {
  return `
    <h1 class="text-xl font-semibold">Montagem de Cargas</h1>

    <div class="card mt-4">
      <h2 class="mb-3 text-sm font-semibold text-slate-300">Nova entrega disponivel</h2>
      <form id="form-nova-entrega" class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        <div class="relative">
          <label class="label">Remetente</label>
          <input id="nova-remetente-input" class="input-field" placeholder="Remetente...">
          <input type="hidden" id="nova-remetente-id">
        </div>
        <div class="relative">
          <label class="label">Destinatario</label>
          <input id="nova-cliente-input" class="input-field" placeholder="Destinatario...">
          <input type="hidden" id="nova-cliente-id">
        </div>
        <div>
          <label class="label">Peso bruto (kg)</label>
          <input type="text" id="nova-peso" class="input-field">
        </div>
        <div>
          <label class="label">Peso cubado (kg)</label>
          <input type="text" id="nova-cubado" class="input-field">
        </div>
        <div>
          <label class="label">Valor/tonelada (R$)</label>
          <input type="text" id="nova-tonelada" class="input-field">
        </div>
        <div>
          <label class="label">Valor total (R$)</label>
          <input type="text" id="nova-frete" class="input-field">
        </div>
        <div>
          <label class="label">Nota fiscal</label>
          <input type="text" id="nova-nf" class="input-field">
        </div>
        <div class="relative">
          <label class="label">Cidade de entrega</label>
          <input type="text" id="nova-cidade" class="input-field" placeholder="Digite a cidade...">
        </div>
        <div>
          <label class="label">UF</label>
          <input type="text" id="nova-estado" class="input-field" maxlength="2">
        </div>
        <div>
          <label class="label">Local de coleta</label>
          <input type="text" id="nova-local-coleta" class="input-field" placeholder="Se diferente do remetente">
        </div>
      </form>
      <div class="mt-3 flex items-center justify-between gap-2">
        <label class="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" id="nova-cortesia" class="h-4 w-4"> Cortesia (sem cobranca)
        </label>
        <button type="submit" form="form-nova-entrega" class="btn-primary btn-sm">Adicionar a lista</button>
      </div>
      <p id="msg-nova" class="mt-2 hidden text-sm"></p>
    </div>

    <div class="card mt-4">
      <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div class="flex-1 min-w-[200px]">
          <label class="label">Origem do rascunho</label>
          <input type="text" id="origem-rascunho" class="input-field" placeholder="Ex: CRICIUMA SC">
        </div>
        <div class="flex gap-2">
          <button type="button" id="btn-novo-rascunho" class="btn-secondary btn-sm">Novo rascunho</button>
          <button type="button" id="btn-salvar-rascunho" class="btn-success btn-sm">Salvar Rascunho</button>
        </div>
      </div>
      <div id="lista-rascunhos" class="mb-3 flex flex-wrap gap-2"></div>

      <div class="mb-2">
        <input type="text" id="filtro-busca" class="input-field max-w-xs" placeholder="Buscar na lista...">
      </div>

      <div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-painel-border bg-painel-bg/40 p-2">
        <div class="flex flex-wrap gap-2">
          <button type="button" id="filtro-remetente" class="btn-secondary btn-sm">Remetente</button>
          <button type="button" id="filtro-uf-origem" class="btn-secondary btn-sm">UF origem</button>
          <button type="button" id="filtro-cidade-destino" class="btn-secondary btn-sm">Cidade destino</button>
          <button type="button" id="filtro-uf-destino" class="btn-secondary btn-sm">UF destino</button>
        </div>
        <div class="h-6 w-px bg-painel-border max-sm:hidden"></div>
        <div class="flex flex-wrap gap-2">
          <button type="button" id="btn-agrupar" class="btn-secondary btn-sm">Agrupar selecionadas</button>
          <button type="button" id="btn-desagrupar" class="btn-secondary btn-sm">Desagrupar selecionadas</button>
          <button type="button" id="btn-lote-remetente" class="btn-secondary btn-sm">Alterar remetente selecionadas</button>
        </div>
        <button type="button" id="btn-excluir-selecionadas" class="btn-danger btn-sm ml-auto">Excluir selecionadas</button>
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

    <div id="modal-editar" class="fixed inset-0 z-20 hidden items-center justify-center bg-slate-900/50">
      <form id="form-editar" class="card w-full max-w-lg">
        <h3 class="mb-3 text-base font-semibold">Editar entrega</h3>
        <input type="hidden" id="edit-id">
        <div class="relative mb-2">
          <label class="label">Remetente</label>
          <input id="edit-remetente-input" class="input-field">
          <input type="hidden" id="edit-remetente-id">
        </div>
        <div class="mb-2 grid grid-cols-2 gap-2">
          <div><label class="label">Cidade</label><input type="text" id="edit-cidade" class="input-field"></div>
          <div><label class="label">UF</label><input type="text" id="edit-estado" class="input-field" maxlength="2"></div>
        </div>
        <div class="mb-2 grid grid-cols-2 gap-2">
          <div><label class="label">Peso bruto</label><input type="text" id="edit-peso" class="input-field"></div>
          <div><label class="label">Peso cubado</label><input type="text" id="edit-cubado" class="input-field"></div>
        </div>
        <div class="mb-2 grid grid-cols-2 gap-2">
          <div><label class="label">Valor frete</label><input type="text" id="edit-frete" class="input-field"></div>
          <div><label class="label">Valor/tonelada</label><input type="text" id="edit-tonelada" class="input-field"></div>
        </div>
        <div class="mb-2">
          <label class="label">Nota fiscal</label>
          <input type="text" id="edit-nf" class="input-field">
        </div>
        <div class="mb-2">
          <label class="label">Local de coleta (se diferente do remetente)</label>
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
