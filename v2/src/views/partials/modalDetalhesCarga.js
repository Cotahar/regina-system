export function renderModalDetalhesCarga() {
  return `
  <div id="modal-detalhes" class="fixed inset-0 z-30 hidden items-start justify-center overflow-y-auto bg-slate-900/50 py-6">
    <div class="card w-full max-w-6xl">
      <div class="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold"><span id="det-codigo"></span> <span id="det-status-badge" class="ml-2 rounded px-2 py-0.5 text-xs"></span></h2>
          <p class="text-sm text-slate-400">Origem: <span id="det-origem"></span></p>
        </div>
        <button type="button" id="btn-fechar-detalhes" class="text-slate-400 hover:text-slate-100">&#10005;</button>
      </div>

      <div class="rounded-lg border border-painel-border bg-painel-bg/40 p-4">
        <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Dados da carga</h3>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="relative">
            <label class="label">Motorista</label>
            <input id="det-motorista-input" class="input-field" placeholder="Buscar motorista...">
            <input type="hidden" id="det-motorista-id">
          </div>
          <div class="relative">
            <label class="label">Veiculo</label>
            <input id="det-veiculo-input" class="input-field" placeholder="Buscar placa...">
            <input type="hidden" id="det-veiculo-id">
          </div>
          <div>
            <label class="label">Data agendamento</label>
            <input type="date" id="det-data-agendamento" class="input-field">
          </div>
          <div>
            <label class="label">Frete pago (R$)</label>
            <input type="text" id="det-frete-pago" class="input-field">
          </div>
          <div data-estagio="carregamento">
            <label class="label">Data carregamento</label>
            <input type="date" id="det-data-carregamento" class="input-field">
          </div>
          <div data-estagio="carregamento">
            <label class="label">Previsao de entrega</label>
            <input type="date" id="det-previsao-entrega" class="input-field">
          </div>
          <div data-estagio="finalizacao">
            <label class="label">Data finalizacao</label>
            <input type="date" id="det-data-finalizacao" class="input-field">
          </div>
          <div>
            <label class="label">Peso total</label>
            <input type="text" id="det-total-peso" class="input-field" readonly>
          </div>
          <div>
            <label class="label">Valor total</label>
            <input type="text" id="det-total-frete" class="input-field" readonly>
          </div>
        </div>

        <div class="mt-3">
          <label class="mb-1 block text-xs font-semibold text-slate-300">Observacoes</label>
          <textarea id="det-observacoes" class="input-field" rows="3" placeholder="Informacoes sobre a carga, combinados, avisos..."></textarea>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-painel-border bg-painel-bg/40 p-3">
        <div class="flex flex-wrap gap-2" id="det-acoes-fluxo"></div>
        <div class="h-6 w-px bg-painel-border max-sm:hidden"></div>
        <div class="flex flex-wrap gap-2" id="det-acoes-ferramentas"></div>
        <div class="ml-auto flex flex-wrap gap-2" id="det-acoes-perigo"></div>
      </div>

      <div class="mt-5">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Entregas</h3>
          <div class="flex flex-wrap gap-2">
            <button type="button" id="btn-agrupar-entregas" class="btn-secondary hidden btn-sm">Agrupar selecionadas</button>
            <button type="button" id="btn-desagrupar-entregas" class="btn-secondary hidden btn-sm">Desagrupar selecionadas</button>
            <button type="button" id="btn-excluir-entregas-selecionadas" class="btn-danger hidden btn-sm">Excluir selecionadas</button>
            <button type="button" id="btn-lote-remetente" class="btn-secondary hidden btn-sm">Alterar remetente selecionadas</button>
            <button type="button" id="btn-add-entrega" class="btn-secondary btn-sm">+ Coleta rapida</button>
          </div>
        </div>

        <form id="form-lote-remetente" class="mb-3 hidden flex-wrap items-center gap-2 rounded-md border border-painel-border p-3">
          <span class="text-xs text-slate-400">Novo remetente para as selecionadas:</span>
          <div class="relative max-w-xs flex-1"><input id="lote-remetente-input" class="input-field" placeholder="Buscar cliente..."></div>
          <input type="hidden" id="lote-remetente-id">
          <button type="submit" class="btn-success btn-sm">Aplicar</button>
        </form>

        <form id="form-add-entrega" class="mb-3 hidden grid grid-cols-2 gap-2 rounded-md border border-painel-border p-3 sm:grid-cols-6">
          <div class="relative"><input id="add-remetente-input" class="input-field" placeholder="Remetente..."></div>
          <input type="hidden" id="add-remetente-id">
          <div class="relative"><input id="add-cliente-input" class="input-field" placeholder="Destinatario..."></div>
          <input type="hidden" id="add-cliente-id">
          <input type="text" id="add-local-coleta" class="input-field" placeholder="Local de coleta (opcional)">
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

  <div id="modal-editar-entrega" class="fixed inset-0 z-40 hidden items-center justify-center bg-slate-900/50">
    <form id="form-editar-entrega" class="card w-full max-w-lg">
      <h3 class="mb-3 text-base font-semibold">Editar entrega</h3>
      <input type="hidden" id="edit-entrega-id">
      <div class="relative mb-2">
        <label class="label">Remetente</label>
        <input id="edit-remetente-input" class="input-field">
        <input type="hidden" id="edit-remetente-id">
      </div>
      <div class="mb-2 grid grid-cols-2 gap-2">
        <div>
          <label class="label">Cidade (override)</label>
          <input type="text" id="edit-cidade" class="input-field">
        </div>
        <div>
          <label class="label">UF (override)</label>
          <input type="text" id="edit-estado" class="input-field" maxlength="2">
        </div>
      </div>
      <div class="mb-2 grid grid-cols-2 gap-2">
        <div>
          <label class="label">Peso bruto (kg)</label>
          <input type="text" id="edit-peso" class="input-field">
        </div>
        <div>
          <label class="label">Peso cubado (kg)</label>
          <input type="text" id="edit-peso-cubado" class="input-field">
        </div>
      </div>
      <div class="mb-2 grid grid-cols-2 gap-2">
        <div>
          <label class="label">Valor frete (R$)</label>
          <input type="text" id="edit-frete" class="input-field">
        </div>
        <div>
          <label class="label">Nota fiscal</label>
          <input type="text" id="edit-nf" class="input-field">
        </div>
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
