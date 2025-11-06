// clientes.js (CORRIGIDO PARA BUSCAR DETALHES - VERSÃO FINAL)
document.addEventListener('DOMContentLoaded', () => {
    const tabelaCorpo = document.getElementById('tabela-clientes-corpo');
    const formImportar = document.getElementById('form-importar');
    const arquivoInput = document.getElementById('arquivo-cliente');
    const mensagemDiv = document.getElementById('mensagem-importacao');
    const modalEditar = document.getElementById('modal-editar-cliente');
    const formEditar = document.getElementById('form-editar-cliente');
    const botaoFecharEditar = document.getElementById('fechar-modal-editar');
    const inputPesquisa = document.getElementById('pesquisa-cliente');

    // --- MÁSCARAS E FUNÇÕES UTILITÁRIAS ---
    const mascaraApenasNumeros = (input) => {
        if (!input) return;
        input.addEventListener('input', () => {
            input.value = input.value.replace(/[^0-9]/g, '');
        });
    };

    // --- FUNÇÃO PRINCIPAL PARA CARREGAR DADOS ---
    async function carregarClientes() {
        try {
            // ***** CORREÇÃO APLICADA AQUI *****
            const response = await fetch('/api/clientes/detalhes');
            // **********************************
            if (!response.ok) {
                console.error("Status da resposta:", response.status, response.statusText);
                 try {
                     const errorData = await response.json();
                     throw new Error(`Falha ao buscar clientes: ${errorData.error || response.statusText}`);
                 } catch (jsonError) {
                      throw new Error(`Falha ao buscar clientes: ${response.statusText}`);
                 }
            }
            const clientes = await response.json();
            tabelaCorpo.innerHTML = '';
            if (!Array.isArray(clientes)) {
                 console.error("Resposta da API não é um array:", clientes);
                 throw new Error("Formato de dados inválido recebido do servidor.");
            }

            if (clientes.length === 0) {
                tabelaCorpo.innerHTML = '<tr><td colspan="6">Nenhum cliente cadastrado.</td></tr>';
            } else {
                clientes.forEach(cliente => {
                    const tr = document.createElement('tr');
                    // Garante que os datasets peguem os nomes corretos das colunas do banco
                    tr.dataset.id = cliente.id;
                    tr.dataset.codigo = cliente.codigo_cliente || ''; // Fallback
                    tr.dataset.razao = cliente.razao_social || ''; // Fallback
                    tr.dataset.cidade = cliente.cidade || ''; // Fallback
                    tr.dataset.estado = cliente.estado || ''; // Fallback
                    tr.dataset.ddd = cliente.ddd || '';
                    tr.dataset.telefone = cliente.telefone || '';
                    tr.dataset.observacoes = cliente.observacoes || '';
					tr.dataset.is_remetente = cliente.is_remetente;

                    // ***** CORREÇÃO AQUI: Usa os nomes corretos das colunas *****
                    tr.innerHTML = `
                        <td>${cliente.codigo_cliente || 'N/A'}</td>
                        <td>${cliente.razao_social || 'N/A'}</td>
                        <td>${cliente.cidade || 'N/A'}</td>
                        <td>${cliente.estado || 'N/A'}</td>
                        <td>${cliente.telefone_completo || ''}</td>
                        <td><button class="btn-editar">Editar</button></td>`;
                    // **********************************************************
                    tabelaCorpo.appendChild(tr);
                });
            }
        } catch (error) {
            console.error('Erro ao carregar clientes:', error); // Loga o erro completo
            tabelaCorpo.innerHTML = `<tr><td colspan="6" style="color: #f87171;">Erro ao carregar clientes. Verifique o console (F12). Detalhes: ${error.message}</td></tr>`; // Mostra erro na tabela
        }
    }

    // --- EVENT LISTENERS ---
    // ... (Restante do código igual: Pesquisa, Importação, Abrir Modal, Fechar Modal, Salvar Edição) ...
     // 1. Lógica da Pesquisa de Clientes
    inputPesquisa.addEventListener('keyup', () => {
        const termo = inputPesquisa.value.toUpperCase();
        const linhas = tabelaCorpo.getElementsByTagName('tr');
        for (let i = 0; i < linhas.length; i++) {
            const celulaRazao = linhas[i].getElementsByTagName('td')[1];
            const celulaCodigo = linhas[i].getElementsByTagName('td')[0];
            if (celulaRazao && celulaCodigo) {
                const textoRazao = celulaRazao.textContent || celulaRazao.innerText;
                const textoCodigo = celulaCodigo.textContent || celulaCodigo.innerText;
                if (textoRazao.toUpperCase().indexOf(termo) > -1 || textoCodigo.toUpperCase().indexOf(termo) > -1) {
                    linhas[i].style.display = "";
                } else {
                    linhas[i].style.display = "none";
                }
            }
        }
    });

    // 2. Lógica de Importação de Arquivo
    formImportar.addEventListener('submit', async (event) => {
        event.preventDefault();
        const arquivo = arquivoInput.files[0];
        if (!arquivo) return;
        const formData = new FormData();
        formData.append('arquivo', arquivo);
        mensagemDiv.textContent = 'Importando...';
        mensagemDiv.style.color = '#cbd5e1'; // Cor neutra
        try {
            const response = await fetch('/api/clientes/import', { method: 'POST', body: formData });
            const resultado = await response.json();
            if (!response.ok) throw new Error(resultado.error || `Erro HTTP ${response.status}`);
            mensagemDiv.textContent = resultado.message;
            mensagemDiv.style.color = '#2ecc71'; // Verde sucesso
            formImportar.reset();
            carregarClientes();
        } catch (error) {
            mensagemDiv.textContent = `Erro: ${error.message}`;
            mensagemDiv.style.color = '#e74c3c'; // Vermelho erro
        }
    });

// 3. Lógica para Abrir Modal de Edição (Atualizada)
    tabelaCorpo.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn-editar')) {
            const linha = event.target.closest('tr');
            if (!linha || !linha.dataset || linha.dataset.id === undefined) return;

            document.getElementById('edit-cliente-id').value = linha.dataset.id;
            document.getElementById('edit-razao-social').value = linha.dataset.razao;
            document.getElementById('edit-cidade').value = linha.dataset.cidade;
            document.getElementById('edit-estado').value = linha.dataset.estado;
            document.getElementById('edit-ddd').value = linha.dataset.ddd;
            document.getElementById('edit-telefone').value = linha.dataset.telefone;
            document.getElementById('edit-observacoes').value = linha.dataset.observacoes;
            
            // --- LINHA NOVA ADICIONADA ---
            // Converte a string 'true'/'false' do dataset para booleano
            document.getElementById('edit-is-remetente').checked = (linha.dataset.is_remetente === 'true');
            // --- FIM DA LINHA NOVA ---

            modalEditar.style.display = 'block';
        }
    });
	
    // 4. Lógica para Fechar Modal
    botaoFecharEditar.addEventListener('click', () => modalEditar.style.display = 'none');
    window.addEventListener('click', (event) => { if (event.target == modalEditar) modalEditar.style.display = 'none'; });
    document.addEventListener('keydown', (event) => { if (event.key === "Escape" && modalEditar.style.display === 'block') modalEditar.style.display = 'none'; });


// 5. Lógica para Salvar Edição (Atualizada)
    formEditar.addEventListener('submit', async (event) => {
        event.preventDefault();
        const clienteId = document.getElementById('edit-cliente-id').value;
        const dadosAtualizados = {
            razao_social: document.getElementById('edit-razao-social').value,
            cidade: document.getElementById('edit-cidade').value,
            estado: document.getElementById('edit-estado').value.toUpperCase(),
            ddd: document.getElementById('edit-ddd').value,
            telefone: document.getElementById('edit-telefone').value,
            observacoes: document.getElementById('edit-observacoes').value,
            // --- LINHA NOVA ADICIONADA ---
            is_remetente: document.getElementById('edit-is-remetente').checked
            // --- FIM DA LINHA NOVA ---
        };
        try {
            const response = await fetch(`/api/clientes/${clienteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dadosAtualizados)
            });
            const resultado = await response.json();
            if (!response.ok) throw new Error(resultado.error || 'Falha ao atualizar.');
            alert(resultado.message || "Atualizado com sucesso!");
            modalEditar.style.display = 'none';
            carregarClientes(); // Recarrega a tabela
        } catch (error) { console.error("Erro ao salvar:", error); alert(`Erro: ${error.message}`); }
    });

    // --- APLICAÇÃO DAS MÁSCARAS ---
    mascaraApenasNumeros(document.getElementById('edit-ddd'));
    mascaraApenasNumeros(document.getElementById('edit-telefone'));

    // --- CARREGAMENTO INICIAL ---
    carregarClientes();

     // Carrega info de sessão (para o menu 'nav-admin' se aplicável)
fetch('/api/session').then(res => res.json()).then(data => {
        if(typeof sessaoUsuario !== 'undefined') sessaoUsuario = data; // Atualiza a variável de sessão se ela existir no script
        
        if (data.user_permission === 'admin') {
            // Altera o ID para o novo span dentro do dropdown
            const navAdmin = document.getElementById('nav-admin-dropdown'); // <-- LINHA NOVA
            if(navAdmin) {
                // Adiciona apenas o link, sem a classe de botão
                navAdmin.innerHTML = `<a href="/usuarios.html">Usuários</a>`; // <-- LINHA NOVA
            }
        }
    }).catch(err => console.error("Erro ao buscar sessão:", err));
});