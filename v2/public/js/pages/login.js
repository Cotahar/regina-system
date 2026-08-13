const form = document.getElementById('form-login');
const erroEl = document.getElementById('erro-login');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  erroEl.classList.add('hidden');

  const nome_usuario = document.getElementById('nome_usuario').value.trim();
  const senha = document.getElementById('senha').value;

  try {
    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome_usuario, senha })
    });
    const data = await resp.json();
    if (!resp.ok) {
      if (data.primeiro_acesso) {
        window.location.href = `/primeiro-acesso?usuario=${encodeURIComponent(nome_usuario)}`;
        return;
      }
      throw new Error(data.error || 'Erro ao entrar');
    }
    window.location.href = '/';
  } catch (err) {
    erroEl.textContent = err.message;
    erroEl.classList.remove('hidden');
  }
});
