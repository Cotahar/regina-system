import crypto from 'node:crypto';

const KEYLEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const parts = (stored || '').split('$');
  if (parts.length !== 3) return false;
  const [metodo, salt, hash] = parts;

  if (metodo === 'scrypt') {
    const hashBuffer = Buffer.from(hash, 'hex');
    const derivedBuffer = crypto.scryptSync(password, salt, KEYLEN);
    if (hashBuffer.length !== derivedBuffer.length) return false;
    return crypto.timingSafeEqual(hashBuffer, derivedBuffer);
  }

  // Hashes herdados do sistema Python antigo (Werkzeug), formato
  // "scrypt:N:r:p$salt$hash" ou "pbkdf2:algoritmo:iteracoes$salt$hash" -
  // usuarios migrados continuam logando com a senha real sem precisar redefinir.
  if (metodo.startsWith('scrypt:')) {
    const [, n, r, p] = metodo.split(':');
    const hashBuffer = Buffer.from(hash, 'hex');
    const derivedBuffer = crypto.scryptSync(password, salt, hashBuffer.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 256 * 1024 * 1024
    });
    if (hashBuffer.length !== derivedBuffer.length) return false;
    return crypto.timingSafeEqual(hashBuffer, derivedBuffer);
  }

  if (metodo.startsWith('pbkdf2:')) {
    const [, algoritmo, iteracoes] = metodo.split(':');
    const hashBuffer = Buffer.from(hash, 'hex');
    const derivedBuffer = crypto.pbkdf2Sync(password, salt, Number(iteracoes), hashBuffer.length, algoritmo);
    if (hashBuffer.length !== derivedBuffer.length) return false;
    return crypto.timingSafeEqual(hashBuffer, derivedBuffer);
  }

  return false;
}
