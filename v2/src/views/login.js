export function renderLoginPage() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - Regina System</title>
  <link rel="stylesheet" href="/css/output.css">
</head>
<body class="flex min-h-screen items-center justify-center bg-painel-bg text-slate-100">
  <div class="card w-full max-w-sm">
    <h1 class="mb-6 text-center text-2xl font-bold text-destaque">Regina System</h1>
    <form id="form-login" class="space-y-4">
      <div>
        <label class="mb-1 block text-sm text-slate-300" for="nome_usuario">Usuario</label>
        <input class="input-field" type="text" id="nome_usuario" name="nome_usuario" autocomplete="username" required>
      </div>
      <div>
        <label class="mb-1 block text-sm text-slate-300" for="senha">Senha</label>
        <input class="input-field" type="password" id="senha" name="senha" autocomplete="current-password" required>
      </div>
      <p id="erro-login" class="hidden text-sm text-red-400"></p>
      <button type="submit" class="btn-primary w-full">Entrar</button>
    </form>
  </div>
  <script type="module" src="/js/pages/login.js"></script>
</body>
</html>`;
}
