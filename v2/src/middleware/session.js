import crypto from 'node:crypto';

const SESSION_COOKIE = 'regina_sid';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

// Store em memoria: simples e suficiente para o tamanho desta equipe.
// Reiniciar o servidor derruba as sessoes ativas (todo mundo precisa logar de novo).
const store = new Map();

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

setInterval(() => {
  const now = Date.now();
  for (const [sid, entry] of store) {
    if (entry.expiresAt <= now) store.delete(sid);
  }
}, 30 * 60 * 1000).unref();

export function sessionMiddleware(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies[SESSION_COOKIE];
  const entry = sid ? store.get(sid) : null;

  if (entry && entry.expiresAt > Date.now()) {
    req.session = entry.data;
    req.sessionId = sid;
  } else {
    if (sid) store.delete(sid);
    req.session = null;
    req.sessionId = null;
  }

  req.createSession = (data) => {
    const newSid = crypto.randomBytes(32).toString('hex');
    store.set(newSid, { data, expiresAt: Date.now() + SESSION_TTL_MS });
    res.cookie(SESSION_COOKIE, newSid, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_TTL_MS
    });
    req.session = data;
    req.sessionId = newSid;
  };

  req.destroySession = () => {
    if (req.sessionId) store.delete(req.sessionId);
    res.clearCookie(SESSION_COOKIE);
    req.session = null;
  };

  next();
}
