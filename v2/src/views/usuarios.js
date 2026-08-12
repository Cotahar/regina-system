export function renderUsuariosPage() {
  return `
    <h1 class="text-xl font-semibold">Usuarios</h1>

    <div class="card mt-4">
      <h2 class="mb-3 text-sm font-semibold text-slate-700">Cadastrar / editar usuario</h2>
      <form id="form-usuario" class="flex flex-wrap items-end gap-3">
        <input type="hidden" id="usuario-id">
        <div>
          <label class="mb-1 block text-xs text-slate-600">Usuario</label>
          <input type="text" id="usuario-nome" class="input-field" required>
        </div>
        <div>
          <label class="mb-1 block text-xs text-slate-600">Senha</label>
          <input type="password" id="usuario-senha" class="input-field" placeholder="Deixe em branco para nao alterar">
        </div>
        <div>
          <label class="mb-1 block text-xs text-slate-600">Permissao</label>
          <select id="usuario-permissao" class="input-field">
            <option value="usuario">Usuario</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit" class="btn-success">Salvar</button>
        <button type="button" id="btn-cancelar-edicao" class="btn-secondary hidden">Cancelar edicao</button>
      </form>
      <p id="msg-usuario" class="mt-2 hidden text-sm"></p>

      <table class="mt-4 w-full text-left text-sm">
        <thead class="text-slate-600"><tr><th class="pb-2">Usuario</th><th class="pb-2">Permissao</th><th class="pb-2 text-right">Acoes</th></tr></thead>
        <tbody id="tabela-usuarios"></tbody>
      </table>
    </div>

    <div class="card mt-4">
      <h2 class="mb-3 text-sm font-semibold text-slate-700">🏢 Configuracao de Unidades e Regras de Origem</h2>
      <p class="mb-3 text-xs text-slate-500">A unidade Matriz e o padrao. Quando o remetente for de uma UF sem unidade cadastrada, o sistema usa a Matriz com o "Tipo CT-e (outra UF)" configurado abaixo.</p>
      <form id="form-unidade" class="flex flex-wrap items-end gap-3">
        <input type="hidden" id="unidade-id">
        <input type="text" id="unidade-nome" class="input-field" placeholder="Nome" required>
        <input type="text" id="unidade-uf" class="input-field w-20" placeholder="UF" maxlength="2">
        <select id="unidade-tipo-cte" class="input-field"><option value="">Tipo CT-e padrao</option></select>
        <select id="unidade-tipo-cte-outra-uf" class="input-field"><option value="">Tipo CT-e (outra UF)</option></select>
        <label class="flex items-center gap-1 text-sm text-slate-700"><input type="checkbox" id="unidade-matriz"> Matriz</label>
        <button type="submit" class="btn-success">Salvar</button>
      </form>
      <p id="msg-unidade" class="mt-2 hidden text-sm"></p>
      <table class="mt-4 w-full text-left text-sm">
        <thead class="text-slate-600"><tr><th class="pb-2">Nome</th><th class="pb-2">UF</th><th class="pb-2">Matriz</th><th class="pb-2">Tipo CT-e outra UF</th><th class="pb-2 text-right">Acoes</th></tr></thead>
        <tbody id="tabela-unidades"></tbody>
      </table>
    </div>

    <div class="card mt-4">
      <h2 class="mb-3 text-sm font-semibold text-slate-700">🚛 Tipos de CT-e / Documentos</h2>
      <form id="form-tipo-cte" class="flex flex-wrap items-end gap-3">
        <input type="text" id="tipo-cte-descricao" class="input-field" placeholder="Ex: 4 - SC" required>
        <button type="submit" class="btn-primary">Adicionar</button>
      </form>
      <ul id="lista-tipos-cte" class="mt-3 divide-y divide-painel-border text-sm"></ul>
    </div>
  `;
}
