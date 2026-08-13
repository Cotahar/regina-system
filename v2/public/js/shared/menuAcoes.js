// Botao de tres pontinhos que abre um mini-menu com as acoes da linha, no
// lugar de varios botoes de texto lado a lado ocupando espaco na tabela.
export function iconeMenuAcoes(dataAttrs = '') {
  return `
    <button type="button" class="btn-menu-acoes inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-painel-border hover:text-slate-100" ${dataAttrs}>
      <svg viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4"><circle cx="10" cy="4" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="10" cy="16" r="1.6"/></svg>
    </button>
  `;
}

// itens: [{ label, onClick, perigo }]
export function criarMenuAcoes(trigger, itens) {
  const wrapper = trigger.parentElement;
  if (getComputedStyle(wrapper).position === 'static') wrapper.classList.add('relative');

  const menu = document.createElement('div');
  menu.className = 'absolute right-0 z-40 mt-1 hidden min-w-[9rem] rounded-md border border-painel-border bg-painel-card py-1 shadow-lg shadow-black/30';
  menu.innerHTML = itens.map((item, i) => `
    <button type="button" data-i="${i}" class="block w-full px-3 py-1.5 text-left text-xs ${item.perigo ? 'text-red-400 hover:bg-red-500/10' : 'text-slate-200 hover:bg-white/5'}">${item.label}</button>
  `).join('');
  trigger.insertAdjacentElement('afterend', menu);

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    document.querySelectorAll('.menu-acoes-aberto').forEach((m) => {
      if (m !== menu) { m.classList.add('hidden'); m.classList.remove('menu-acoes-aberto'); }
    });
    menu.classList.toggle('hidden');
    menu.classList.toggle('menu-acoes-aberto');
  });

  menu.querySelectorAll('button[data-i]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      menu.classList.add('hidden');
      menu.classList.remove('menu-acoes-aberto');
      itens[Number(btn.dataset.i)].onClick();
    });
  });

  document.addEventListener('click', () => {
    menu.classList.add('hidden');
    menu.classList.remove('menu-acoes-aberto');
  });
}
