export async function apiFetch(url, options = {}) {
  const isFormData = options.body instanceof FormData;
  const resp = await fetch(url, {
    ...options,
    headers: isFormData ? options.headers : { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });

  if (resp.status === 401) {
    window.location.href = '/login';
    throw new Error('Sessao expirada');
  }

  const contentType = resp.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await resp.json() : null;

  if (!resp.ok) {
    throw new Error((data && data.error) || `Erro ${resp.status}`);
  }
  return data;
}

export const apiGet = (url) => apiFetch(url);
export const apiPost = (url, body) => apiFetch(url, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) });
export const apiPut = (url, body) => apiFetch(url, { method: 'PUT', body: JSON.stringify(body) });
export const apiDelete = (url, body) => apiFetch(url, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined });
