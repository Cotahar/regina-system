import { notificarMudanca } from '../services/eventos.js';

// Dispara um evento SSE apos qualquer mutacao bem-sucedida (POST/PUT/DELETE/PATCH),
// para os outros navegadores conectados se atualizarem sozinhos.
export function notificarAposMutacao(req, res, next) {
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) return next();
  const jsonOriginal = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 400) notificarMudanca();
    return jsonOriginal(body);
  };
  next();
}
