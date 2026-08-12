export function renderLoginPage() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - Regina System</title>
  <link rel="stylesheet" href="/css/output.css">
</head>
<body class="flex min-h-screen items-center justify-center bg-slate-100 px-4">
  <div class="w-full max-w-sm">
    <div class="mb-6 text-center">
      <h1 class="text-2xl font-bold text-brand-black">Regina System</h1>
      <p class="mt-1 text-sm text-slate-500">Gestao de Cargas - B. Nunes</p>
    </div>
    <form id="form-login" class="card space-y-4 border-t-4 border-brand-yellow p-6">
      <div>
        <label class="label" for="nome_usuario">Usuario</label>
        <input class="input-field" type="text" id="nome_usuario" name="nome_usuario" autocomplete="username" required>
      </div>
      <div>
        <label class="label" for="senha">Senha</label>
        <input class="input-field" type="password" id="senha" name="senha" autocomplete="current-password" required>
      </div>
      <p id="erro-login" class="hidden text-sm text-red-600"></p>
      <button type="submit" class="btn-primary w-full">Entrar</button>
    </form>
  </div>
  <script type="module" src="/js/pages/login.js"></script>
</body>
</html>`;
}
