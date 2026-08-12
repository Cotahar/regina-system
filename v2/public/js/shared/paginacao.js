// Pagina a RENDERIZACAO de listas grandes ja carregadas em memoria (a busca/
// filtro continua instantanea sobre a lista inteira - so a exibicao e
// dividida em paginas, pra nao jogar milhares de linhas no DOM de uma vez).
export function criarPaginacao({ container, porPagina = 50, renderizarPagina }) {
  let itens = [];
  let paginaAtual = 1;

  function totalPaginas() {
    return Math.max(1, Math.ceil(itens.length / porPagina));
  }

  function renderizar() {
    const total = totalPaginas();
    if (paginaAtual > total) paginaAtual = total;
    const inicio = (paginaAtual - 1) * porPagina;
    renderizarPagina(itens.slice(inicio, inicio + porPagina));

    if (itens.length <= porPagina) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <button type="button" class="btn-secondary btn-sm" id="pg-anterior" ${paginaAtual === 1 ? 'disabled' : ''}>&larr; Anterior</button>
      <span class="text-xs text-slate-600">Pagina ${paginaAtual} de ${total} (${itens.length} registros)</span>
      <button type="button" class="btn-secondary btn-sm" id="pg-proxima" ${paginaAtual === total ? 'disabled' : ''}>Proxima &rarr;</button>
    `;
    container.querySelector('#pg-anterior')?.addEventListener('click', () => { paginaAtual--; renderizar(); });
    container.querySelector('#pg-proxima')?.addEventListener('click', () => { paginaAtual++; renderizar(); });
  }

  return {
    definirItens(novaLista) {
      itens = novaLista;
      paginaAtual = 1;
      renderizar();
    }
  };
}
