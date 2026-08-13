import { Router } from 'express';
import { requireLogin, requireAdmin } from '../middleware/auth.js';
import { renderLoginPage } from '../views/login.js';
import { renderPrimeiroAcessoPage } from '../views/primeiroAcesso.js';
import { renderLayout } from '../views/layout.js';
import { renderMotoristasPage } from '../views/motoristas.js';
import { renderVeiculosPage } from '../views/veiculos.js';
import { renderMarcasPage } from '../views/marcas.js';
import { renderFormasPagamentoPage } from '../views/formasPagamento.js';
import { renderClientesPage } from '../views/clientes.js';
import { renderDashboardPage } from '../views/dashboard.js';
import { renderMontagemPage } from '../views/montagem.js';
import { renderConsultaPage } from '../views/consulta.js';
import { renderGerenciarCargaPage } from '../views/gerenciarCarga.js';
import { renderPagamentoCargaPage } from '../views/pagamentoCarga.js';
import { renderAvariasPage } from '../views/avarias.js';
import { renderUsuariosPage } from '../views/usuarios.js';
import { renderNotasFiscaisPage } from '../views/notasFiscais.js';

export const pagesRouter = Router();

pagesRouter.get('/login', (req, res) => {
  if (req.session) return res.redirect('/');
  res.type('html').send(renderLoginPage());
});

pagesRouter.get('/primeiro-acesso', (req, res) => {
  if (req.session) return res.redirect('/');
  res.type('html').send(renderPrimeiroAcessoPage());
});

pagesRouter.get('/', requireLogin, (req, res) => {
  res.type('html').send(renderLayout({
    title: 'Painel',
    activeHref: '/',
    user: req.session,
    bodyHtml: renderDashboardPage(),
    extraScripts: '<script type="module" src="/js/pages/dashboard.js"></script>'
  }));
});

pagesRouter.get('/motoristas.html', requireLogin, requireAdmin, (req, res) => {
  res.type('html').send(renderLayout({
    title: 'Motoristas',
    user: req.session,
    bodyHtml: renderMotoristasPage(),
    extraScripts: '<script type="module" src="/js/pages/motoristas.js"></script>'
  }));
});

pagesRouter.get('/veiculos.html', requireLogin, requireAdmin, (req, res) => {
  res.type('html').send(renderLayout({
    title: 'Veiculos',
    user: req.session,
    bodyHtml: renderVeiculosPage(),
    extraScripts: '<script type="module" src="/js/pages/veiculos.js"></script>'
  }));
});

pagesRouter.get('/marcas.html', requireLogin, (req, res) => {
  const isAdmin = req.session.permissao === 'admin';
  res.type('html').send(renderLayout({
    title: 'Marcas',
    user: req.session,
    bodyHtml: renderMarcasPage({ isAdmin }),
    extraScripts: '<script type="module" src="/js/pages/marcas.js"></script>'
  }));
});

pagesRouter.get('/formas-pagamento.html', requireLogin, requireAdmin, (req, res) => {
  res.type('html').send(renderLayout({
    title: 'Formas de Pagamento',
    user: req.session,
    bodyHtml: renderFormasPagamentoPage(),
    extraScripts: '<script type="module" src="/js/pages/formas-pagamento.js"></script>'
  }));
});

pagesRouter.get('/clientes.html', requireLogin, (req, res) => {
  res.type('html').send(renderLayout({
    title: 'Clientes',
    activeHref: '/clientes.html',
    user: req.session,
    bodyHtml: renderClientesPage(),
    extraScripts: '<script type="module" src="/js/pages/clientes.js"></script>'
  }));
});

pagesRouter.get('/montagem.html', requireLogin, (req, res) => {
  res.type('html').send(renderLayout({
    title: 'Montagem',
    activeHref: '/montagem.html',
    user: req.session,
    bodyHtml: renderMontagemPage(),
    extraScripts: '<script type="module" src="/js/pages/montagem.js"></script>'
  }));
});

pagesRouter.get('/consulta.html', requireLogin, (req, res) => {
  res.type('html').send(renderLayout({
    title: 'Consulta',
    activeHref: '/consulta.html',
    user: req.session,
    bodyHtml: renderConsultaPage(),
    extraScripts: '<script type="module" src="/js/pages/consulta.js"></script>'
  }));
});

pagesRouter.get('/notas-fiscais.html', requireLogin, (req, res) => {
  res.type('html').send(renderLayout({
    title: 'Notas Fiscais',
    activeHref: '/notas-fiscais.html',
    user: req.session,
    bodyHtml: renderNotasFiscaisPage(),
    extraScripts: '<script type="module" src="/js/pages/notas-fiscais.js"></script>'
  }));
});

pagesRouter.get('/usuarios.html', requireLogin, requireAdmin, (req, res) => {
  res.type('html').send(renderLayout({
    title: 'Usuarios',
    user: req.session,
    bodyHtml: renderUsuariosPage(),
    extraScripts: '<script type="module" src="/js/pages/usuarios.js"></script>'
  }));
});

pagesRouter.get('/avarias.html', requireLogin, (req, res) => {
  res.type('html').send(renderLayout({
    title: 'Avarias',
    activeHref: '/avarias.html',
    user: req.session,
    bodyHtml: renderAvariasPage(),
    extraScripts: '<script type="module" src="/js/pages/avarias.js"></script>'
  }));
});

pagesRouter.get('/gerenciar-carga.html', requireLogin, (req, res) => {
  res.type('html').send(renderLayout({
    title: 'Gerenciar Carga',
    user: req.session,
    bodyHtml: renderGerenciarCargaPage(),
    extraScripts: '<script type="module" src="/js/pages/gerenciar-carga.js"></script>'
  }));
});

pagesRouter.get('/pagamento-carga.html', requireLogin, (req, res) => {
  res.type('html').send(renderLayout({
    title: 'Envio de Pagamento',
    user: req.session,
    bodyHtml: renderPagamentoCargaPage(),
    extraScripts: '<script type="module" src="/js/pages/pagamento-carga.js"></script>'
  }));
});
