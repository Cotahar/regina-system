export function renderGerenciarCargaPage() {
  return `
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Gerenciar / Faturamento - <span id="ger-codigo"></span></h1>
      <div class="flex gap-2">
        <button type="button" id="btn-imprimir" class="btn-secondary">Imprimir Relatorio</button>
        <button type="button" id="btn-salvar" class="btn-primary">Salvar</button>
      </div>
    </div>

    <div class="card mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label class="mb-1 block text-xs text-slate-400">Motorista</label>
        <input list="lista-motoristas" id="ger-motorista-input" class="input-field">
        <input type="hidden" id="ger-motorista-id">
      </div>
      <div>
        <label class="mb-1 block text-xs text-slate-400">Veiculo</label>
        <input list="lista-veiculos" id="ger-veiculo-input" class="input-field">
        <input type="hidden" id="ger-veiculo-id">
      </div>
      <div>
        <label class="mb-1 block text-xs text-slate-400">Rota manifesto</label>
        <input type="text" id="ger-rota" class="input-field">
      </div>
      <div>
        <label class="mb-1 block text-xs text-slate-400">Vale pedagio (marca)</label>
        <input type="text" id="ger-vp-marca" class="input-field" placeholder="Sem Parar / Move Mais">
      </div>
      <div>
        <label class="mb-1 block text-xs text-slate-400">Vale pedagio (rota)</label>
        <input type="text" id="ger-vp-rota" class="input-field">
      </div>
      <div>
        <label class="mb-1 block text-xs text-slate-400">Vale pedagio (eixos)</label>
        <input type="number" id="ger-vp-eixos" class="input-field">
      </div>
      <div>
        <label class="mb-1 block text-xs text-slate-400">Frete pago (motorista)</label>
        <input type="text" id="ger-frete-pago" class="input-field">
      </div>
      <div>
        <label class="mb-1 block text-xs text-slate-400">Adiantamento (%)</label>
        <input type="number" id="ger-adiant-percentual" class="input-field" value="70">
      </div>
      <div>
        <label class="mb-1 block text-xs text-slate-400">Valor do adiantamento</label>
        <input type="text" id="ger-adiant-valor" class="input-field" readonly>
      </div>
      <div class="sm:col-span-2 lg:col-span-4">
        <label class="mb-1 block text-xs text-slate-400">Observacoes de faturamento</label>
        <textarea id="ger-observacoes" class="input-field" rows="2"></textarea>
      </div>
    </div>

    <div class="card mt-4">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="text-slate-400">
            <tr>
              <th class="pb-2">Cliente</th><th class="pb-2">NF</th><th class="pb-2">Unidade</th>
              <th class="pb-2">Tipo CT-e</th><th class="pb-2">Peso</th><th class="pb-2">Cubado</th>
              <th class="pb-2">R$/Ton</th><th class="pb-2">Frete</th><th class="pb-2">Forma Pgto</th><th class="pb-2">Tipo Pgto</th>
            </tr>
          </thead>
          <tbody id="ger-tabela"></tbody>
        </table>
      </div>
    </div>

    <p id="ger-msg" class="mt-3 hidden text-sm"></p>

    <datalist id="lista-motoristas"></datalist>
    <datalist id="lista-veiculos"></datalist>
  `;
}
