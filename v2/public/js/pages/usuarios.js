import { apiGet, apiPost, apiPut, apiDelete } from '../shared/api.js';
import { escapeHtml } from '../shared/escape.js';
import { exibirMensagem } from '../shared/ui.js';

let usuarios = [];
let unidades = [];
let tiposCte = [];

// --- USUARIOS ---
async function carregarUsuarios() {
  usuarios = await apiGet('/api/usuarios');
  const tbody = document.getElementById('tabela-usuarios');
  tbody.innerHTML = usuarios.map((u) => `
    <tr class="border-t border-painel-border" data-id="${u.id}">
      <td class="py-2">${escapeHtml(u.nome_usuario)}</td>
      <td class="py-2">${escapeHtml(u.permissao)}</td>
      <td class="py-2 text-right">
        ${u.id !== 1 ? `
          <button class="btn-secondary btn-editar px-2 py-1 text-xs">Editar</button>
          <button class="btn-danger btn-excluir px-2 py-1 text-xs">Excluir</button>
        ` : '<span class="text-xs text-slate-500">admin principal</span>'}
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-editar').forEach((btn) => {
    btn.addEventListener('click', () => {
      const u = usuarios.find((it) => it.id === Number(btn.closest('tr').dataset.id));
      document.getElementById('usuario-id').value = u.id;
      document.getElementById('usuario-nome').value = u.nome_usuario;
      document.getElementById('usuario-senha').value = '';
      document.getElementById('usuario-permissao').value = u.permissao;
      document.getElementById('btn-cancelar-edicao').classList.remove('hidden');
    });
  });
  tbody.querySelectorAll('.btn-excluir').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.closest('tr').dataset.id);
      const u = usuarios.find((it) => it.id === id);
      if (!confirm(`Excluir o usuario "${u.nome_usuario}"?`)) return;
      try {
        await apiDelete(`/api/usuarios/${id}`);
        await carregarUsuarios();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

document.getElementById('btn-cancelar-edicao').addEventListener('click', () => {
  document.getElementById('form-usuario').reset();
  document.getElementById('usuario-id').value = '';
  document.getElementById('btn-cancelar-edicao').classList.add('hidden');
});

document.getElementById('form-usuario').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.getElementById('usuario-id').value;
  const msg = document.getElementById('msg-usuario');
  const payload = {
    nome_usuario: document.getElementById('usuario-nome').value.trim(),
    senha: document.getElementById('usuario-senha').value,
    permissao: document.getElementById('usuario-permissao').value
  };
  try {
    if (id) await apiPut(`/api/usuarios/${id}`, payload);
    else await apiPost('/api/usuarios', payload);
    document.getElementById('form-usuario').reset();
    document.getElementById('usuario-id').value = '';
    document.getElementById('btn-cancelar-edicao').classList.add('hidden');
    exibirMensagem(msg, 'Salvo com sucesso!', 'sucesso');
    await carregarUsuarios();
  } catch (err) {
    exibirMensagem(msg, err.message, 'erro');
  }
});

// --- UNIDADES ---
async function carregarUnidades() {
  [unidades, tiposCte] = await Promise.all([apiGet('/api/auxiliar/unidades'), apiGet('/api/auxiliar/tipos-cte')]);

  const selectTipoCte = document.getElementById('unidade-tipo-cte');
  selectTipoCte.innerHTML = '<option value="">Tipo CT-e padrao</option>' +
    tiposCte.map((t) => `<option value="${t.id}">${escapeHtml(t.descricao)}</option>`).join('');

  const tbody = document.getElementById('tabela-unidades');
  tbody.innerHTML = unidades.map((u) => `
    <tr class="border-t border-painel-border" data-id="${u.id}">
      <td class="py-2">${escapeHtml(u.nome)}</td>
      <td class="py-2">${escapeHtml(u.uf || '')}</td>
      <td class="py-2">${u.is_matriz ? 'Sim' : ''}</td>
      <td class="py-2 text-right">
        <button class="btn-secondary btn-editar px-2 py-1 text-xs">Editar</button>
        <button class="btn-danger btn-excluir px-2 py-1 text-xs">Excluir</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-editar').forEach((btn) => {
    btn.addEventListener('click', () => {
      const u = unidades.find((it) => it.id === Number(btn.closest('tr').dataset.id));
      document.getElementById('unidade-id').value = u.id;
      document.getElementById('unidade-nome').value = u.nome;
      document.getElementById('unidade-uf').value = u.uf || '';
      document.getElementById('unidade-tipo-cte').value = u.tipo_cte_padrao_id || '';
      document.getElementById('unidade-matriz').checked = u.is_matriz;
    });
  });
  tbody.querySelectorAll('.btn-excluir').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.closest('tr').dataset.id);
      if (!confirm('Excluir esta unidade?')) return;
      try {
        await apiDelete(`/api/auxiliar/unidades/${id}`);
        await carregarUnidades();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

document.getElementById('form-unidade').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.getElementById('unidade-id').value;
  const msg = document.getElementById('msg-unidade');
  const payload = {
    nome: document.getElementById('unidade-nome').value.trim(),
    uf: document.getElementById('unidade-uf').value.trim(),
    tipo_cte_padrao_id: document.getElementById('unidade-tipo-cte').value || null,
    is_matriz: document.getElementById('unidade-matriz').checked
  };
  try {
    if (id) await apiPut(`/api/auxiliar/unidades/${id}`, payload);
    else await apiPost('/api/auxiliar/unidades', payload);
    document.getElementById('form-unidade').reset();
    document.getElementById('unidade-id').value = '';
    await carregarUnidades();
  } catch (err) {
    exibirMensagem(msg, err.message, 'erro');
  }
});

// --- TIPOS DE CT-E ---
async function carregarTiposCte() {
  tiposCte = await apiGet('/api/auxiliar/tipos-cte');
  const lista = document.getElementById('lista-tipos-cte');
  lista.innerHTML = tiposCte.map((t) => `
    <li class="flex items-center justify-between py-2" data-id="${t.id}">
      <span>${escapeHtml(t.descricao)}</span>
      <button class="btn-danger btn-excluir px-2 py-1 text-xs">Excluir</button>
    </li>
  `).join('') || '<li class="py-3 text-center text-slate-500">Nenhum tipo cadastrado.</li>';

  lista.querySelectorAll('.btn-excluir').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.closest('li').dataset.id);
      if (!confirm('Excluir este tipo de CT-e?')) return;
      try {
        await apiDelete(`/api/auxiliar/tipos-cte/${id}`);
        await carregarTiposCte();
        await carregarUnidades();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

document.getElementById('form-tipo-cte').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('tipo-cte-descricao');
  try {
    await apiPost('/api/auxiliar/tipos-cte', { descricao: input.value.trim() });
    input.value = '';
    await carregarTiposCte();
    await carregarUnidades();
  } catch (err) {
    alert(err.message);
  }
});

carregarUsuarios();
carregarUnidades();
carregarTiposCte();
