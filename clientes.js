document.addEventListener('DOMContentLoaded', () => {
    const tabelaCorpo = document.getElementById('tabela-clientes-corpo');
    const formImportar = document.getElementById('form-importar');
    const arquivoInput = document.getElementById('arquivo-cliente');
    const mensagemDiv = document.getElementById('mensagem-importacao');
    const modalEditar = document.getElementById('modal-editar-cliente');
    const formEditar = document.getElementById('form-editar-cliente');
    const botaoFecharEditar = document.getElementById('fechar-modal-editar');

    async function carregarClientes() {
        try {
            const response = await fetch('/api/clientes');
            if (!response.ok) throw new Error('Falha ao buscar clientes');
            const clientes = await response.json();
            tabelaCorpo.innerHTML = '';
            if (clientes.length === 0) {
                tabelaCorpo.innerHTML = '<tr><td colspan="6">Nenhum cliente cadastrado.</td></tr>';
            } else {
                clientes.forEach(cliente => {
                    const tr = document.createElement('tr');
                    // Adiciona os dados como atributos para fácil acesso
                    tr.dataset.id = cliente.id;
                    tr.dataset.codigo = cliente.codigo_cliente;
                    tr.dataset.razao = cliente.razao_social;
                    tr.dataset.cidade = cliente.cidade;
                    tr.dataset.estado = cliente.estado;
                    tr.dataset.ddd = cliente.ddd || '';
                    tr.dataset.telefone = cliente.telefone || '';
                    tr.dataset.observacoes = cliente.observacoes || '';
                    
                    tr.innerHTML = `
                        <td>${cliente.codigo_cliente}</td>
                        <td>${cliente.razao_social}</td>
                        <td>${cliente.cidade}</td>
                        <td>${cliente.estado}</td>
                        <td>(${cliente.ddd || ''}) ${cliente.telefone || ''}</td>
                        <td><button class="btn-editar">Editar</button></td>`;
                    tabelaCorpo.appendChild(tr);
                });
            }
        } catch (error) {
            console.error('Erro:', error);
            tabelaCorpo.innerHTML = `<tr><td colspan="6">Erro ao carregar clientes.</td></tr>`;
        }
    }

    formImportar.addEventListener('submit', async (event) => {
        event.preventDefault();
        const arquivo = arquivoInput.files[0];
        if (!arquivo) return;
        const formData = new FormData();
        formData.append('arquivo', arquivo);
        mensagemDiv.textContent = 'Importando...';
        try {
            const response = await fetch('/api/clientes/import', { method: 'POST', body: formData });
            const resultado = await response.json();
            if (!response.ok) throw new Error(resultado.error);
            mensagemDiv.textContent = resultado.message;
            mensagemDiv.style.color = '#2ecc71';
            formImportar.reset();
            carregarClientes();
        } catch (error) {
            mensagemDiv.textContent = `Erro: ${error.message}`;
            mensagemDiv.style.color = '#e74c3c';
        }
    });

    tabelaCorpo.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn-editar')) {
            const linha = event.target.closest('tr');
            document.getElementById('edit-cliente-id').value = linha.dataset.id;
            document.getElementById('edit-razao-social').value = linha.dataset.razao;
            document.getElementById('edit-cidade').value = linha.dataset.cidade;
            document.getElementById('edit-estado').value = linha.dataset.estado;
            document.getElementById('edit-ddd').value = linha.dataset.ddd;
            document.getElementById('edit-telefone').value = linha.dataset.telefone;
            document.getElementById('edit-observacoes').value = linha.dataset.observacoes;
            modalEditar.style.display = 'block';
        }
    });

    botaoFecharEditar.addEventListener('click', () => modalEditar.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target == modalEditar) modalEditar.style.display = 'none';
    });

    formEditar.addEventListener('submit', async (event) => {
        event.preventDefault();
        const clienteId = document.getElementById('edit-cliente-id').value;
        const dadosAtualizados = {
            razao_social: document.getElementById('edit-razao-social').value,
            cidade: document.getElementById('edit-cidade').value,
            estado: document.getElementById('edit-estado').value,
            ddd: document.getElementById('edit-ddd').value,
            telefone: document.getElementById('edit-telefone').value,
            observacoes: document.getElementById('edit-observacoes').value
        };
        try {
            const response = await fetch(`/api/clientes/${clienteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosAtualizados)
            });
            if (!response.ok) throw new Error('Falha ao atualizar o cliente.');
            modalEditar.style.display = 'none';
            carregarClientes();
        } catch (error) {
            console.error("Erro ao salvar alterações:", error);
            alert("Não foi possível salvar as alterações.");
        }
    });

    carregarClientes();
});