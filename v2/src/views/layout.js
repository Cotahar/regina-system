import { escapeHtml } from '../utils/html.js';

const navIcon = (paths) => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 shrink-0">${paths}</svg>`;

const NAV_LINKS = [
  { href: '/', label: 'Painel', icone: navIcon('<path d="M3 10.5 10 4l7 6.5"/><path d="M5 9v7h10V9"/>') },
  { href: '/clientes.html', label: 'Clientes', icone: navIcon('<circle cx="7.5" cy="6.5" r="2.5"/><path d="M2.5 16c0-2.8 2.2-5 5-5s5 2.2 5 5"/><circle cx="14.5" cy="7.5" r="2"/><path d="M13 11.2c1.9.4 3.5 2 3.5 4.3"/>') },
  { href: '/montagem.html', label: 'Montagem', icone: navIcon('<path d="M10 2.5 17 6.5 10 10.5 3 6.5z"/><path d="M3 10.5 10 14.5 17 10.5"/><path d="M3 14 10 18l7-4"/>') },
  { href: '/consulta.html', label: 'Consulta', icone: navIcon('<circle cx="8.5" cy="8.5" r="5.5"/><path d="M16.5 16.5 12.5 12.5"/>') },
  { href: '/avarias.html', label: 'Avarias', icone: navIcon('<path d="M10 3 18 17H2z"/><path d="M10 8.3v3.4"/><circle cx="10" cy="13.8" r="0.15" fill="currentColor" stroke="none"/>') }
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
      ? 'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium bg-painel-card text-destaque'
      : 'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-painel-card hover:text-destaque';
    return `<a href="${link.href}" class="${classes}">${link.icone}${escapeHtml(link.label)}</a>`;
  }).join('');

  const adminDropdown = isAdmin
    ? `<div class="relative">
        <button type="button" id="admin-menu-btn" class="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-painel-card hover:text-destaque">${navIcon('<circle cx="10" cy="10" r="2.3"/><path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.3 5.3l1.4 1.4M13.3 13.3l1.4 1.4M5.3 14.7l1.4-1.4M13.3 6.7l1.4-1.4"/>')}Admin &#9662;</button>
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
    <nav class="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="mr-5 text-lg font-bold text-destaque">Regina System</span>
        ${navHtml}
        ${adminDropdown}
      </div>
      <div class="flex items-center gap-3 text-sm text-slate-300">
        <span class="flex items-center gap-1.5 rounded-full bg-painel-bg px-3 py-1.5">${navIcon('<circle cx="10" cy="6.5" r="3"/><path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6"/>')}${escapeHtml(user?.userName || '')}</span>
        <a href="/logout" class="flex items-center gap-1.5 rounded-md bg-painel-border px-3 py-1.5 hover:bg-slate-500">${navIcon('<path d="M8 4H4.5A1.5 1.5 0 0 0 3 5.5v9A1.5 1.5 0 0 0 4.5 16H8"/><path d="M13 13.5 17 10l-4-3.5"/><path d="M7 10h10"/>')}Sair</a>
      </div>
    </nav>
  </header>
  <main class="px-6 py-6">
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
