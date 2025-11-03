	document.addEventListener('DOMContentLoaded', () => {
    const tabelaCorpo = document.getElementById('tabela-usuarios-corpo');
    const formNovoUsuario = document.getElementById('form-novo-usuario');
    const mensagemDiv = document.getElementById('mensagem-cadastro');
    const modalEditar = document.getElementById('modal-editar-usuario');
    const formEditar = document.getElementById('form-editar-usuario');

    async function carregarUsuarios() {
        try {
            const response = await fetch('/api/usuarios');
            if (!response.ok) { window.location.href = '/'; return; }
            const usuarios = await response.json();
            tabelaCorpo.innerHTML = '';
            usuarios.forEach(usuario => {
                const tr = document.createElement('tr');
                tr.dataset.id = usuario.id;
                tr.dataset.nome = usuario.nome_usuario;
                tr.dataset.permissao = usuario.permissao;
                tr.innerHTML = `
                    <td>${usuario.nome_usuario}</td>
                    <td>${usuario.permissao}</td>
                    <td>
                        ${usuario.id !== 1 ? `
                        <button class="btn-editar" data-id="${usuario.id}">Editar</button>
                        <button class="btn-excluir-entrega" data-id="${usuario.id}">Excluir</button>
                        ` : 'N/A'}
                    </td>
                `;
                tabelaCorpo.appendChild(tr);
            });
        } catch (error) { console.error('Erro ao carregar usuários:', error); }
    }

    tabelaCorpo.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn-editar')) {
            const linha = event.target.closest('tr');
            document.getElementById('edit-user-id').value = linha.dataset.id;
            document.getElementById('edit_nome_usuario').value = linha.dataset.nome;
            document.getElementById('edit_permissao').value = linha.dataset.permissao;
            document.getElementById('edit_senha').value = '';
            modalEditar.style.display = 'block';
        }
    });

	document.getElementById('fechar-modal-editar').addEventListener('click', () => modalEditar.style.display = 'none');
    document.addEventListener('keydown', (event) => {
        if (event.key === "Escape" && modalEditar.style.display === 'block') {
            modalEditar.style.display = 'none';
        }
    });

    formEditar.addEventListener('submit', async (event) => {
        event.preventDefault();
        const userId = document.getElementById('edit-user-id').value;
        const dados = {
            nome_usuario: document.getElementById('edit_nome_usuario').value,
            permissao: document.getElementById('edit_permissao').value,
            senha: document.getElementById('edit_senha').value
        };
        if (!dados.senha) { delete dados.senha; }

        try {
            const response = await fetch(`/api/usuarios/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            const resultado = await response.json();
            if (!response.ok) throw new Error(resultado.error);
            alert(resultado.message);
            modalEditar.style.display = 'none';
            carregarUsuarios();
        } catch (error) { alert(`Erro ao atualizar: ${error.message}`); }
    });

    formNovoUsuario.addEventListener('submit', async (event) => {
        event.preventDefault();
        const dados = {
            nome_usuario: document.getElementById('nome_usuario').value,
            senha: document.getElementById('senha').value,
            permissao: document.getElementById('permissao').value
        };
        mensagemDiv.textContent = 'Cadastrando...';
        try {
            const response = await fetch('/api/usuarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            const resultado = await response.json();
            if (!response.ok) throw new Error(resultado.error);
            mensagemDiv.textContent = resultado.message;
            mensagemDiv.style.color = '#2ecc71';
            formNovoUsuario.reset();
            carregarUsuarios();
        } catch (error) {
            mensagemDiv.textContent = `Erro: ${error.message}`;
            mensagemDiv.style.color = '#e74c3c';
        }
    });

    tabelaCorpo.addEventListener('click', async (event) => {
        if (event.target.classList.contains('btn-excluir-entrega')) {
            const userId = event.target.dataset.id;
            if (confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) {
                try {
                    const response = await fetch(`/api/usuarios/${userId}`, { method: 'DELETE' });
                    const resultado = await response.json();
                    if (!response.ok) throw new Error(resultado.error);
                    alert(resultado.message);
                    carregarUsuarios();
                } catch (error) { alert(`Erro: ${error.message}`); }
            }
        }
    });

    carregarUsuarios();
});