function wantsJson(req) {
  return req.path.startsWith('/api/') || req.xhr || (req.headers.accept || '').includes('application/json');
}

export function requireLogin(req, res, next) {
  if (!req.session) {
    if (wantsJson(req)) {
      return res.status(401).json({ error: 'Sessao expirada, faca login novamente.' });
    }
    return res.redirect('/login');
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (req.session?.permissao !== 'admin') {
    if (wantsJson(req)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    return res.redirect('/');
  }
  next();
}
