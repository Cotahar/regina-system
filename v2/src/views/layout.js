import { escapeHtml } from '../utils/html.js';

const navIcon = (paths) => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 shrink-0">${paths}</svg>`;

const NAV_LINKS = [
  { href: '/', label: 'Painel', icone: navIcon('<path d="M3 10.5 10 4l7 6.5"/><path d="M5 9v7h10V9"/>') },
  { href: '/clientes.html', label: 'Clientes', icone: navIcon('<circle cx="7.5" cy="6.5" r="2.5"/><path d="M2.5 16c0-2.8 2.2-5 5-5s5 2.2 5 5"/><circle cx="14.5" cy="7.5" r="2"/><path d="M13 11.2c1.9.4 3.5 2 3.5 4.3"/>') },
  { href: '/montagem.html', label: 'Montagem', icone: navIcon('<path d="M10 2.5 17 6.5 10 10.5 3 6.5z"/><path d="M3 10.5 10 14.5 17 10.5"/><path d="M3 14 10 18l7-4"/>') },
  { href: '/notas-fiscais.html', label: 'Notas Fiscais', icone: navIcon('<path d="M5 2.5h7l3 3v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z"/><path d="M12 2.5v3h3"/><path d="M6.5 10h7M6.5 12.5h7M6.5 15h4"/>') },
  { href: '/consulta.html', label: 'Consulta', icone: navIcon('<circle cx="8.5" cy="8.5" r="5.5"/><path d="M16.5 16.5 12.5 12.5"/>') },
  { href: '/avarias.html', label: 'Avarias', icone: navIcon('<path d="M10 3 18 17H2z"/><path d="M10 8.3v3.4"/><circle cx="10" cy="13.8" r="0.15" fill="currentColor" stroke="none"/>') }
];

const ADMIN_LINKS = [
  { href: '/motoristas.html', label: 'Motoristas' },
  { href: '/veiculos.html', label: 'Veiculos' },
  { href: '/marcas.html', label: 'Marcas' },
  { href: '/formas-pagamento.html', label: 'Formas de Pagamento' },
  { href: '/usuarios.html', label: 'Usuarios' }
];

export function renderLayout({ title, bodyHtml, user, activeHref = '', extraHead = '', extraScripts = '' }) {
  const isAdmin = user?.permissao === 'admin';
  const adminAberto = ADMIN_LINKS.some((l) => l.href === activeHref);

  const linkClasses = (href) => href === activeHref
    ? 'menu-link flex items-center gap-2 rounded-lg border-l-4 border-brand-yellow bg-gray-800 px-3 py-2 text-sm font-semibold text-brand-yellow'
    : 'menu-link flex items-center gap-2 rounded-lg border-l-4 border-transparent px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white';

  const navHtml = NAV_LINKS.map((l) => `<a href="${l.href}" class="${linkClasses(l.href)}">${l.icone}${escapeHtml(l.label)}</a>`).join('');

  const adminHtml = isAdmin ? `
    <div class="mt-2">
      <button type="button" id="admin-grupo-toggle" class="flex w-full items-center justify-between rounded-lg px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide ${adminAberto ? 'text-brand-yellow' : 'text-gray-400 hover:text-gray-300'}">
        <span>Administracao</span>
        <svg id="admin-grupo-chevron" class="h-3 w-3 shrink-0 transition-transform duration-150 ${adminAberto ? 'rotate-90' : ''}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4l7 6-7 6V4z"/></svg>
      </button>
      <div id="admin-grupo-body" class="space-y-0.5 ${adminAberto ? '' : 'hidden'}">
        ${ADMIN_LINKS.map((l) => `<a href="${l.href}" class="${linkClasses(l.href)}">${escapeHtml(l.label)}</a>`).join('')}
      </div>
    </div>
  ` : '';

  const iniciais = (user?.userName || '?').charAt(0).toUpperCase();

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Frottex - B. Nunes</title>
  <link rel="stylesheet" href="/css/output.css">
  ${extraHead}
</head>
<body>
  <div class="flex min-h-screen">
    <aside id="sidebar" class="fixed inset-y-0 left-0 z-30 w-64 -translate-x-full transform overflow-y-auto border-r border-gray-800 bg-brand-black p-3 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0">
      <div class="mb-4 flex flex-col gap-0 px-3 py-2">
        <span class="text-lg font-bold leading-tight text-brand-yellow">Frottex</span>
        <span class="text-xs leading-tight text-gray-400">B. Nunes &middot; Gestao de Cargas</span>
      </div>
      <nav>${navHtml}${adminHtml}</nav>
    </aside>
    <div id="sidebar-overlay" class="fixed inset-0 z-20 hidden bg-slate-900/40 lg:hidden"></div>
    <div class="flex min-h-screen min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-10 flex items-center justify-between border-b border-painel-border bg-painel-card px-4 py-3 shadow-lg shadow-black/20">
        <button type="button" id="btn-abrir-menu" class="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
        <div class="ml-auto flex items-center gap-3">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-black text-sm font-bold text-brand-yellow">${escapeHtml(iniciais)}</span>
          <div class="hidden text-right sm:block">
            <p class="text-sm font-medium text-slate-100">${escapeHtml(user?.userName || '')}</p>
            <p class="text-xs text-slate-400">${escapeHtml(user?.permissao || '')}</p>
          </div>
          <a href="/logout" class="btn-secondary btn-sm">Sair</a>
        </div>
      </header>
      <main class="flex-1 px-6 py-6">
        ${bodyHtml}
      </main>
    </div>
  </div>
  <script>
    window.__SESSAO__ = { userName: ${JSON.stringify(user?.userName || null)}, permissao: ${JSON.stringify(user?.permissao || null)} };

    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    document.getElementById('btn-abrir-menu')?.addEventListener('click', () => {
      sidebar.classList.remove('-translate-x-full');
      overlay.classList.remove('hidden');
    });
    overlay?.addEventListener('click', () => {
      sidebar.classList.add('-translate-x-full');
      overlay.classList.add('hidden');
    });

    const adminToggle = document.getElementById('admin-grupo-toggle');
    if (adminToggle) {
      adminToggle.addEventListener('click', () => {
        document.getElementById('admin-grupo-body').classList.toggle('hidden');
        document.getElementById('admin-grupo-chevron').classList.toggle('rotate-90');
      });
    }
  </script>
  ${extraScripts}
</body>
</html>`;
}
