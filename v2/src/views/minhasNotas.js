import { escapeHtml } from '../utils/html.js';

export function renderMinhasNotasPage({ remetenteNome }) {
  return `
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 class="text-xl font-semibold">Minhas notas fiscais</h1>
        <p class="text-xs text-slate-400">${escapeHtml(remetenteNome)}</p>
      </div>
      <input type="text" id="mn-busca" class="input-field max-w-xs" placeholder="Buscar por numero, destinatario, cidade...">
    </div>

    <div class="card mt-4">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="text-slate-400">
            <tr>
              <th class="pb-2">NF</th>
              <th class="pb-2">Emissao</th>
              <th class="pb-2">Destinatario</th>
              <th class="pb-2">Cidade/UF</th>
              <th class="pb-2">Peso</th>
              <th class="pb-2 text-right">PDF</th>
            </tr>
          </thead>
          <tbody id="mn-tabela"></tbody>
        </table>
      </div>
      <p id="mn-contagem" class="mt-3 text-xs text-slate-400"></p>
    </div>
  `;
}
