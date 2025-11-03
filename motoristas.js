document.addEventListener('DOMContentLoaded', () => {
    const tabelaCorpo = document.getElementById('tabela-motoristas-corpo');
    const formImportar = document.getElementById('form-importar');
    const arquivoInput = document.getElementById('arquivo-importar');
    const mensagemDiv = document.getElementById('mensagem-importacao');
    const inputPesquisa = document.getElementById('pesquisa-motorista');

    // --- FUNÇÃO PRINCIPAL PARA CARREGAR DADOS ---
    async function carregarMotoristas() {
        try {
            const response = await fetch('/api/motoristas');
            if (!response.ok) throw new Error('Falha ao buscar motoristas');
            const motoristas = await response.json();
            
            tabelaCorpo.innerHTML = '';
            if (motoristas.length === 0) {
                tabelaCorpo.innerHTML = '<tr><td colspan="2">Nenhum motorista cadastrado.</td></tr>';
            } else {
                motoristas.forEach(motorista => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${motorista.codigo || 'N/A'}</td>
                        <td>${motorista.nome}</td>
                        `;
                    tabelaCorpo.appendChild(tr);
                });
            }
        } catch (error) {
            console.error('Erro:', error);
            tabelaCorpo.innerHTML = `<tr><td colspan="2">Erro ao carregar motoristas.</td></tr>`;
        }
    }

    // --- EVENT LISTENERS ---

    // 1. Lógica da Pesquisa
    inputPesquisa.addEventListener('keyup', () => {
        const termo = inputPesquisa.value.toUpperCase();
        const linhas = tabelaCorpo.getElementsByTagName('tr');
        
        for (let i = 0; i < linhas.length; i++) {
            const celulaNome = linhas[i].getElementsByTagName('td')[1];
            const celulaCodigo = linhas[i].getElementsByTagName('td')[0];
            
            if (celulaNome && celulaCodigo) {
                const textoNome = celulaNome.textContent || celulaNome.innerText;
                const textoCodigo = celulaCodigo.textContent || celulaCodigo.innerText;
                
                if (textoNome.toUpperCase().indexOf(termo) > -1 || textoCodigo.toUpperCase().indexOf(termo) > -1) {
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
        mensagemDiv.style.color = '#cbd5e1';
        
        try {
            const response = await fetch('/api/motoristas/import', { method: 'POST', body: formData });
            const resultado = await response.json();
            
            if (!response.ok) throw new Error(resultado.error);
            
            mensagemDiv.textContent = resultado.message;
            mensagemDiv.style.color = '#2ecc71';
            formImportar.reset();
            carregarMotoristas(); // Recarrega a tabela
            
        } catch (error) {
            mensagemDiv.textContent = `Erro: ${error.message}`;
            mensagemDiv.style.color = '#e74c3c';
        }
    });

    // --- CARREGAMENTO INICIAL ---
    carregarMotoristas();
    
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