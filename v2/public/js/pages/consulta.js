import { apiGet } from '../shared/api.js';
import { escapeHtml } from '../shared/escape.js';
import { formatarMoeda, formatarPeso, formatarData } from '../shared/format.js';
import { criarModalDetalhesCarga } from '../shared/carga-modal.js';
import { ouvirMudancas } from '../shared/live.js';
import { criarCombobox } from '../shared/combobox.js';

const isAdmin = window.__SESSAO__?.permissao === 'admin';
const modalDetalhes = criarModalDetalhesCarga({ isAdmin, onMudanca: () => buscar(paginaAtualGlobal) });

let clientes = [];
let paginaAtualGlobal = 1;

async function carregarClientesFiltro() {
  clientes = await apiGet('/api/clientes');
}

criarCombobox({ input: document.getElementById('f-cliente-input'), hidden: document.getElementById('f-cliente-id'), getItens: () => clientes });

function montarQueryString(pagina) {
  const params = new URLSearchParams();
  const mapa = {
    'f-codigo': 'codigo_carga',
    'f-origem': 'origem',
    'f-status': 'status',
    'f-motorista': 'motorista',
    'f-placa': 'placa',
    'f-carreg-inicio': 'data_carregamento_inicio',
    'f-carreg-fim': 'data_carregamento_fim',
    'f-final-inicio': 'data_finalizacao_inicio',
    'f-final-fim': 'data_finalizacao_fim'
  };
  for (const [id, campo] of Object.entries(mapa)) {
    const valor = document.getElementById(id).value.trim();
    if (valor) params.set(campo, valor);
  }
  const clienteId = document.getElementById('f-cliente-id').value;
  if (clienteId) params.set('cliente_id', clienteId);
  params.set('page', pagina);
  return params.toString();
}

async function buscar(pagina = 1) {
  paginaAtualGlobal = pagina;
  const data = await apiGet(`/api/cargas/consulta?${montarQueryString(pagina)}`);
  renderizarResultados(data.cargas);
  renderizarPaginacao(data.pagina_atual, data.total_paginas, data.total_resultados);
}

function renderizarResultados(lista) {
  const tbody = document.getElementById('tabela-resultados');
  tbody.innerHTML = lista.map((c) => `
    <tr class="cursor-pointer border-t border-painel-border hover:bg-painel-card" data-id="${c.id}">
      <td class="py-2 font-medium text-destaque">${escapeHtml(c.codigo_carga)}</td>
      <td class="py-2">${escapeHtml(c.status)}</td>
      <td class="py-2">${escapeHtml(c.origem)}</td>
      <td class="py-2">${escapeHtml(c.destino)}</td>
      <td class="py-2">${escapeHtml(c.motorista)}</td>
      <td class="py-2">${c.num_entregas}</td>
      <td class="py-2">${formatarPeso(c.peso_total)}</td>
      <td class="py-2">${c.data_finalizacao ? formatarData(c.data_finalizacao) : '-'}</td>
    </tr>
  `).join('') || '<tr><td colspan="8" class="py-4 text-center text-slate-500">Nenhuma carga encontrada.</td></tr>';

  tbody.querySelectorAll('tr[data-id]').forEach((tr) => {
    tr.addEventListener('click', () => modalDetalhes.abrir(Number(tr.dataset.id)));
  });
}

function renderizarPaginacao(paginaAtual, totalPaginas, totalResultados) {
  const container = document.getElementById('paginacao');
  if (totalPaginas <= 1) {
    container.innerHTML = `<span class="text-xs text-slate-500">${totalResultados} resultado(s)</span>`;
    return;
  }
  container.innerHTML = `
    <button type="button" id="btn-anterior" class="btn-secondary px-2 py-1 text-xs" ${paginaAtual <= 1 ? 'disabled' : ''}>&larr; Anterior</button>
    <span class="text-xs text-slate-400">Pagina ${paginaAtual} de ${totalPaginas} (${totalResultados} resultado(s))</span>
    <button type="button" id="btn-proxima" class="btn-secondary px-2 py-1 text-xs" ${paginaAtual >= totalPaginas ? 'disabled' : ''}>Proxima &rarr;</button>
  `;
  document.getElementById('btn-anterior')?.addEventListener('click', () => buscar(paginaAtual - 1));
  document.getElementById('btn-proxima')?.addEventListener('click', () => buscar(paginaAtual + 1));
}

document.getElementById('form-filtros').addEventListener('submit', (event) => {
  event.preventDefault();
  buscar(1);
});

document.getElementById('btn-limpar').addEventListener('click', () => {
  document.getElementById('form-filtros').reset();
  document.getElementById('f-cliente-id').value = '';
  buscar(1);
});

carregarClientesFiltro();
buscar(1);
ouvirMudancas(() => buscar(paginaAtualGlobal));
