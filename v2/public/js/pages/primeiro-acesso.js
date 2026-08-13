const params = new URLSearchParams(window.location.search);
const usuarioInput = document.getElementById('pa-usuario');
if (params.get('usuario')) usuarioInput.value = params.get('usuario');

const form = document.getElementById('form-primeiro-acesso');
const erroEl = document.getElementById('erro-primeiro-acesso');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  erroEl.classList.add('hidden');

  const nome_usuario = usuarioInput.value.trim();
  const senha = document.getElementById('pa-senha').value;
  const confirmacao = document.getElementById('pa-confirmacao').value;

  if (senha.length < 6) {
    erroEl.textContent = 'A senha deve ter pelo menos 6 caracteres.';
    erroEl.classList.remove('hidden');
    return;
  }
  if (senha !== confirmacao) {
    erroEl.textContent = 'As senhas nao coincidem.';
    erroEl.classList.remove('hidden');
    return;
  }

  try {
    const resp = await fetch('/api/primeiro-acesso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome_usuario, senha, confirmacao })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Erro ao criar senha');
    window.location.href = '/';
  } catch (err) {
    erroEl.textContent = err.message;
    erroEl.classList.remove('hidden');
  }
});
