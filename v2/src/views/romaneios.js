export function renderRomaneiosPage() {
  return `
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 class="text-xl font-semibold">Romaneios da fabrica</h1>
        <p class="text-xs text-slate-400">Cargas liberadas pela fabrica para agendar a coleta. A NF-e chega quando o caminhao carrega (= coletada).</p>
      </div>
      <div class="flex items-center gap-3">
        <span id="rom-ultima" class="text-xs text-slate-400"></span>
        <button type="button" id="btn-rom-importar" class="btn-secondary btn-sm">Ler e-mails agora</button>
      </div>
    </div>

    <div id="rom-cards" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5"></div>
    <p id="rom-tempo" class="mt-3 hidden text-xs text-slate-400"></p>

    <div id="rom-erros" class="card mt-3 hidden border-red-500/40">
      <p class="text-sm font-semibold text-red-300">E-mails da fabrica que nao puderam ser lidos</p>
      <ul id="rom-erros-lista" class="mt-1 space-y-0.5 text-xs text-slate-300"></ul>
      <button type="button" id="btn-rom-reprocessar" class="btn-secondary btn-sm mt-2">Tentar de novo</button>
    </div>

    <div class="card mt-3">
      <div class="mb-3 flex flex-wrap items-end gap-2">
        <input type="text" id="rom-busca" class="input-field max-w-xs" placeholder="Buscar por carga, cliente, cidade, NF...">
        <select id="rom-filtro-situacao" class="input-field w-48">
          <option value="">Situacao (todas)</option>
          <option value="disponivel">Disponivel</option>
          <option value="programada">Programada</option>
          <option value="coletada">Coletada</option>
          <option value="cancelada">Cancelada</option>
          <option value="sem_entrega">Sem entrega</option>
        </select>
        <label class="flex items-center gap-2 pb-2 text-sm text-slate-300">
          <input type="checkbox" id="rom-filtro-atencao" class="h-4 w-4"> So com atencao
        </label>
        <span id="rom-contagem" class="pb-2 text-xs text-slate-400"></span>
      </div>
      <p id="rom-msg" class="mb-2 hidden text-sm"></p>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="text-slate-400">
            <tr>
              <th class="pb-2">Carga</th>
              <th class="pb-2">Cliente</th>
              <th class="pb-2">Destino</th>
              <th class="pb-2">Peso</th>
              <th class="pb-2">Origem</th>
              <th class="pb-2">Liberada</th>
              <th class="pb-2">Prazo de embarque</th>
              <th class="pb-2">Situacao</th>
              <th class="pb-2 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody id="rom-tabela"></tbody>
        </table>
      </div>
    </div>

    <div id="modal-rom-detalhe" class="fixed inset-0 z-20 hidden items-start justify-center overflow-y-auto bg-slate-900/50 py-8">
      <div class="card w-full max-w-3xl">
        <div class="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold" id="rom-det-titulo"></h3>
            <p class="text-xs text-slate-400" id="rom-det-sub"></p>
          </div>
          <button type="button" id="btn-rom-det-fechar" class="btn-secondary btn-sm">Fechar</button>
        </div>
        <div id="rom-det-alertas" class="mb-3 space-y-1"></div>
        <div id="rom-det-corpo" class="space-y-4 text-xs"></div>
      </div>
    </div>
  `;
}
