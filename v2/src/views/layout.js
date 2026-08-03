import { escapeHtml } from '../utils/html.js';

const NAV_LINKS = [
  { href: '/', label: 'Painel' },
  { href: '/clientes.html', label: 'Clientes' },
  { href: '/montagem.html', label: 'Montagem' },
  { href: '/consulta.html', label: 'Consulta' },
  { href: '/avarias.html', label: 'Avarias' }
];

const ADMIN_DROPDOWN_LINKS = [
  { href: '/motoristas.html', label: 'Motoristas' },
  { href: '/veiculos.html', label: 'Veiculos' },
  { href: '/marcas.html', label: 'Marcas' },
  { href: '/formas-pagamento.html', label: 'Formas de Pagamento' },
  { href: '/usuarios.html', label: 'Usuarios' }
];

export function renderLayout({ title, bodyHtml, user, activeHref = '', extraHead = '', extraScripts = '' }) {
  const isAdmin = user?.permissao === 'admin';

  const navHtml = NAV_LINKS.map((link) => {
    const active = link.href === activeHref;
    const classes = active
      ? 'rounded-md px-3 py-2 text-sm font-medium bg-painel-card text-destaque'
      : 'rounded-md px-3 py-2 text-sm font-medium text-slate-200 hover:bg-painel-card hover:text-destaque';
    return `<a href="${link.href}" class="${classes}">${escapeHtml(link.label)}</a>`;
  }).join('');

  const adminDropdown = isAdmin
    ? `<div class="relative">
        <button type="button" id="admin-menu-btn" class="rounded-md px-3 py-2 text-sm font-medium text-slate-200 hover:bg-painel-card hover:text-destaque">Admin &#9662;</button>
        <div id="admin-menu" class="absolute right-0 z-10 mt-1 hidden w-52 rounded-md border border-painel-border bg-painel-card py-1 shadow-lg">
          ${ADMIN_DROPDOWN_LINKS.map((l) => `<a href="${l.href}" class="block px-4 py-2 text-sm text-slate-200 hover:bg-painel-bg hover:text-destaque">${escapeHtml(l.label)}</a>`).join('')}
        </div>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Regina System</title>
  <link rel="stylesheet" href="/css/output.css">
  ${extraHead}
</head>
<body class="min-h-screen bg-painel-bg text-slate-100">
  <header class="border-b border-painel-border bg-painel-card/50">
    <nav class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div class="flex flex-wrap items-center gap-1">
        <span class="mr-4 text-lg font-bold text-destaque">Regina System</span>
        ${navHtml}
        ${adminDropdown}
      </div>
      <div class="flex items-center gap-3 text-sm text-slate-300">
        <span>${escapeHtml(user?.userName || '')}</span>
        <a href="/logout" class="rounded-md bg-painel-border px-3 py-1.5 hover:bg-slate-500">Sair</a>
      </div>
    </nav>
  </header>
  <main class="mx-auto max-w-7xl px-4 py-6">
    ${bodyHtml}
  </main>
  <script>
    window.__SESSAO__ = { userName: ${JSON.stringify(user?.userName || null)}, permissao: ${JSON.stringify(user?.permissao || null)} };
    const adminBtn = document.getElementById('admin-menu-btn');
    const adminMenu = document.getElementById('admin-menu');
    if (adminBtn) {
      adminBtn.addEventListener('click', () => adminMenu.classList.toggle('hidden'));
      document.addEventListener('click', (e) => {
        if (!adminBtn.contains(e.target) && !adminMenu.contains(e.target)) adminMenu.classList.add('hidden');
      });
    }
  </script>
  ${extraScripts}
</body>
</html>`;
}
