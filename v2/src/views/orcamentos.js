export function renderOrcamentosPage() {
  return `
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Orçamentos</h1>
      <button type="button" id="btn-novo-orcamento" class="btn-primary btn-sm">+ Novo orçamento</button>
    </div>

    <div class="card mt-4">
      <h2 class="mb-3 text-sm font-semibold text-slate-300">Orçamentos gerados</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="text-slate-400">
            <tr>
              <th class="pb-2">Codigo</th>
              <th class="pb-2">Data</th>
              <th class="pb-2">Destinatario</th>
              <th class="pb-2">Destino</th>
              <th class="pb-2">Valor total</th>
              <th class="pb-2 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody id="tabela-orcamentos"></tbody>
        </table>
      </div>
    </div>

    <div id="secao-form-orcamento" class="card mt-4 hidden">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-slate-300">Novo orçamento</h2>
        <button type="button" id="btn-fechar-form-orcamento" class="btn-secondary btn-sm">Fechar</button>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="rounded-md border border-painel-border p-3">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Destinatario</h3>
          <div class="relative mb-2">
            <label class="label">Cliente cadastrado</label>
            <input id="orc-dest-input" class="input-field" placeholder="Buscar cliente...">
            <input type="hidden" id="orc-dest-id">
          </div>
          <div class="mb-2">
            <label class="label">Nome (exibido na proposta)</label>
            <input type="text" id="orc-dest-nome" class="input-field">
          </div>
          <div class="mb-2">
            <label class="label">CNPJ</label>
            <input type="text" id="orc-dest-cnpj" class="input-field" placeholder="00.000.000/0000-00" maxlength="18">
            <p id="orc-dest-cnpj-aviso" class="mt-1 hidden text-[11px] text-amber-400">Esse cliente ainda nao tem CNPJ cadastrado - informe pra gerar a proposta.</p>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="relative">
              <label class="label">Cidade (cadastro)</label>
              <input id="orc-dest-cidade" class="input-field">
            </div>
            <div>
              <label class="label">UF (cadastro)</label>
              <input type="text" id="orc-dest-estado" class="input-field" maxlength="2">
            </div>
          </div>
        </div>

        <div class="rounded-md border border-painel-border p-3">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Proposta</h3>
          <div class="mb-2">
            <label class="label">Data</label>
            <input type="date" id="orc-data" class="input-field">
          </div>
          <div class="mb-2">
            <label class="label">Produto</label>
            <input type="text" id="orc-produto" class="input-field" placeholder="Ex: pisos ceramicos">
          </div>
          <div class="relative mb-2">
            <label class="label">Destino da carga - Cidade</label>
            <input id="orc-destino-cidade" class="input-field">
          </div>
          <div>
            <label class="label">Destino da carga - UF</label>
            <input type="text" id="orc-destino-estado" class="input-field" maxlength="2">
          </div>
        </div>
      </div>

      <div class="mt-4">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-400">Itens de frete</h3>
          <button type="button" id="btn-add-item-orcamento" class="btn-secondary btn-sm">+ Adicionar item</button>
        </div>
        <div id="lista-itens-orcamento" class="space-y-3"></div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label class="label">Prazo de entrega</label>
          <input type="text" id="orc-prazo" class="input-field" placeholder="Ex: 10 a 25 dias a partir do embarque">
        </div>
        <div>
          <label class="label">Forma de pagamento</label>
          <input type="text" id="orc-pagamento" class="input-field" placeholder="Ex: Boleto 30/45 dias">
        </div>
        <div>
          <label class="label">Descarga inclusa ate (metros)</label>
          <input type="number" id="orc-descarga-metros" class="input-field" value="25">
        </div>
        <div class="flex flex-col justify-end gap-1 pb-1.5 text-sm text-slate-300">
          <label class="flex items-center gap-2"><input type="checkbox" id="orc-mercadoria-segurada" class="h-4 w-4" checked> Mercadoria totalmente segurada</label>
          <label class="flex items-center gap-2"><input type="checkbox" id="orc-frete-ajustavel" class="h-4 w-4" checked> Frete ajustavel (diesel)</label>
        </div>
      </div>

      <div class="mt-3">
        <label class="label">Observacao extra (opcional)</label>
        <textarea id="orc-observacoes" class="input-field" rows="2"></textarea>
      </div>

      <p id="msg-form-orcamento" class="mt-3 hidden text-sm"></p>
      <div class="mt-3 flex justify-end gap-2">
        <button type="button" id="btn-gerar-orcamento" class="btn-success">Gerar orcamento (PDF)</button>
      </div>
    </div>
  `;
}
