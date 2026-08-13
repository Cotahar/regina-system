export function renderNotasFiscaisPage() {
  return `
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Notas Fiscais</h1>
    </div>

    <div class="card mt-4">
      <div class="mb-3 flex flex-wrap items-end gap-2">
        <input type="text" id="nf-busca" class="input-field max-w-xs" placeholder="Buscar por numero, CNPJ, nome...">
        <select id="nf-filtro-status" class="input-field w-44">
          <option value="">Status (todos)</option>
          <option value="pendente">Pendente</option>
          <option value="vinculada">Vinculada</option>
          <option value="entrega_criada">Entrega Criada</option>
          <option value="ignorada">Ignorada</option>
        </select>
        <select id="nf-filtro-origem" class="input-field w-40">
          <option value="">Origem (todas)</option>
          <option value="xml">XML</option>
          <option value="pdf">PDF</option>
        </select>
      </div>

      <div id="nf-acoes-massa" class="mb-3 hidden flex-wrap gap-2">
        <button type="button" id="btn-nf-vincular" class="btn-primary btn-sm">Vincular a uma carga</button>
        <button type="button" id="btn-nf-criar-disponivel" class="btn-success btn-sm">Criar entrega(s) disponivel(is)</button>
        <button type="button" id="btn-nf-ignorar" class="btn-danger btn-sm">Ignorar</button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="text-slate-400">
            <tr>
              <th class="pb-2"><input type="checkbox" id="nf-chk-todas"></th>
              <th class="pb-2">NF</th>
              <th class="pb-2">Emitente (remetente)</th>
              <th class="pb-2">Destinatario (cliente)</th>
              <th class="pb-2">Peso</th>
              <th class="pb-2">Valor NF</th>
              <th class="pb-2">Emissao</th>
              <th class="pb-2">Placa</th>
              <th class="pb-2">Motorista</th>
              <th class="pb-2">Origem</th>
              <th class="pb-2">Status</th>
              <th class="pb-2 text-right">Arquivos</th>
            </tr>
          </thead>
          <tbody id="nf-tabela"></tbody>
        </table>
      </div>
    </div>

    <p id="nf-msg" class="mt-3 hidden text-sm"></p>

    <div id="modal-nf-vincular" class="fixed inset-0 z-20 hidden items-start justify-center overflow-y-auto bg-slate-900/50 py-8">
      <div class="card w-full max-w-2xl">
        <h3 class="mb-3 text-base font-semibold">Vincular notas a uma carga</h3>

        <div id="nf-vincular-passo-1">
          <label class="label">Carga</label>
          <div class="relative">
            <input id="nf-vincular-carga-input" class="input-field" placeholder="Buscar carga (codigo ou origem)...">
            <input type="hidden" id="nf-vincular-carga-id">
          </div>
          <div class="mt-4 flex justify-end gap-2">
            <button type="button" id="btn-nf-vincular-cancelar" class="btn-secondary">Cancelar</button>
            <button type="button" id="btn-nf-vincular-continuar" class="btn-primary">Continuar</button>
          </div>
        </div>

        <div id="nf-vincular-passo-2" class="hidden">
          <p class="mb-2 text-xs text-slate-400">Escolha em qual linha (entrega) da carga cada nota entra:</p>
          <div id="nf-vincular-linhas" class="space-y-2"></div>
          <label class="mt-3 flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" id="nf-vincular-sobrescrever" class="h-4 w-4" checked>
            Sobrescrever o peso bruto da linha com o peso da NF
          </label>
          <p id="nf-vincular-msg" class="mt-2 hidden text-sm"></p>
          <div class="mt-4 flex justify-end gap-2">
            <button type="button" id="btn-nf-vincular-voltar" class="btn-secondary">Voltar</button>
            <button type="button" id="btn-nf-vincular-salvar" class="btn-success">Vincular</button>
          </div>
        </div>
      </div>
    </div>

    <div id="modal-nf-disponivel" class="fixed inset-0 z-20 hidden items-start justify-center overflow-y-auto bg-slate-900/50 py-8">
      <div class="card w-full max-w-2xl">
        <h3 class="mb-3 text-base font-semibold">Criar entrega(s) disponivel(is)</h3>
        <p class="mb-2 text-xs text-slate-400">Notas sem destinatario reconhecido precisam de um cliente escolhido manualmente:</p>
        <div id="nf-disponivel-linhas" class="space-y-2"></div>
        <p id="nf-disponivel-msg" class="mt-2 hidden text-sm"></p>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" id="btn-nf-disponivel-cancelar" class="btn-secondary">Cancelar</button>
          <button type="button" id="btn-nf-disponivel-salvar" class="btn-success">Criar</button>
        </div>
      </div>
    </div>
  `;
}
