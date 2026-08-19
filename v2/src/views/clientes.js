import { renderModalEditarCliente } from './partials/modalEditarCliente.js';

export function renderClientesPage() {
  return `
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Clientes</h1>
      <button id="btn-novo" class="btn-primary">+ Novo cliente</button>
    </div>

    <div class="card mt-4">
      <h2 class="mb-3 text-sm font-semibold text-slate-300">Importar planilha (CSV: codigo, razao social, ddd, telefone, cidade, estado, observacoes)</h2>
      <form id="form-import" class="flex flex-wrap items-end gap-3">
        <input type="file" id="arquivo-import" accept=".csv" class="input-field max-w-xs" required>
        <button type="submit" class="btn-secondary">Importar</button>
      </form>
      <p id="msg-import" class="mt-2 hidden text-sm"></p>

      <details class="mt-3">
        <summary class="cursor-pointer text-xs text-slate-400">ou colar linhas copiadas do Excel (mesma ordem de colunas, sem cabecalho)</summary>
        <textarea id="colar-texto" class="input-field mt-2" rows="4" placeholder="CLI001	Ceramica Sul Ltda	48	999998888	Criciuma	SC	Observacao"></textarea>
        <button type="button" id="btn-colar-importar" class="btn-secondary mt-2">Importar do texto colado</button>
      </details>
    </div>

    <div class="card mt-4">
      <input type="text" id="filtro-busca" placeholder="Buscar por codigo, nome ou cidade..." class="input-field mb-3 max-w-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-slate-400">
            <tr>
              <th class="pb-2">Codigo</th>
              <th class="pb-2">Razao Social</th>
              <th class="pb-2">CNPJ</th>
              <th class="pb-2">Cidade/UF</th>
              <th class="pb-2">Telefone</th>
              <th class="pb-2">Entregas</th>
              <th class="pb-2">Remetente</th>
              <th class="pb-2">Perfil</th>
              <th class="pb-2 text-right">Acoes</th>
            </tr>
          </thead>
          <tbody id="tabela-clientes"></tbody>
        </table>
      </div>
      <div id="paginacao-clientes" class="mt-3 flex flex-wrap items-center justify-center gap-3"></div>
    </div>

    ${renderModalEditarCliente()}
  `;
}
