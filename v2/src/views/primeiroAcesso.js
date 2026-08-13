export function renderPrimeiroAcessoPage() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Primeiro Acesso - Frottex - B. Nunes</title>
  <link rel="stylesheet" href="/css/output.css">
</head>
<body class="flex min-h-screen items-center justify-center bg-painel-bg px-4">
  <div class="w-full max-w-sm">
    <div class="mb-6 text-center">
      <h1 class="text-2xl font-bold text-slate-100">Frottex</h1>
      <p class="mt-1 text-sm text-slate-400">B. Nunes &middot; Gestao de Cargas</p>
    </div>
    <form id="form-primeiro-acesso" class="card space-y-4 border-t-4 border-brand-yellow p-6">
      <div>
        <p class="text-sm font-semibold text-slate-200">Primeiro acesso</p>
        <p class="mt-0.5 text-xs text-slate-400">Crie sua senha para comecar a usar o sistema.</p>
      </div>
      <div>
        <label class="label" for="pa-usuario">Usuario</label>
        <input class="input-field" type="text" id="pa-usuario" name="nome_usuario" autocomplete="username" required>
      </div>
      <div>
        <label class="label" for="pa-senha">Nova senha</label>
        <input class="input-field" type="password" id="pa-senha" name="senha" autocomplete="new-password" minlength="6" required>
      </div>
      <div>
        <label class="label" for="pa-confirmacao">Confirmar senha</label>
        <input class="input-field" type="password" id="pa-confirmacao" name="confirmacao" autocomplete="new-password" minlength="6" required>
      </div>
      <p class="text-xs text-slate-500">Minimo de 6 caracteres.</p>
      <p id="erro-primeiro-acesso" class="hidden text-sm text-red-400"></p>
      <button type="submit" class="btn-primary w-full">Criar senha e entrar</button>
      <p class="text-center text-xs"><a href="/login" class="text-slate-400 hover:text-brand-yellow">Voltar para o login</a></p>
    </form>
  </div>
  <script type="module" src="/js/pages/primeiro-acesso.js"></script>
</body>
</html>`;
}
