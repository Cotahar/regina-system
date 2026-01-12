document.addEventListener('DOMContentLoaded', async () => {
    // --- ELEMENTOS GERAIS ---
    const tabelaCorpo = document.getElementById('tabela-usuarios-corpo');
    const formNovoUsuario = document.getElementById('form-novo-usuario');
    const mensagemDiv = document.getElementById('mensagem-cadastro');
    const modalEditar = document.getElementById('modal-editar-usuario');
    const formEditar = document.getElementById('form-editar-usuario');

    // --- ELEMENTOS UNIDADES (MOVIMENTADO PARA O TOPO) ---
    const tabelaUnidades = document.getElementById('tabela-unidades');
    const selCte = document.getElementById('uni-cte');
    const btnAddUnidade = document.getElementById('btn-add-unidade');
    const btnCancelUnidade = document.getElementById('btn-cancel-unidade'); // Verifica se existe no HTML
    
    // Inputs do formulário de unidade (agora acessíveis globalmente)
    const inpUniId = document.getElementById('uni-id'); // Pode não existir se você não colocou o hidden
    const inpUniNome = document.getElementById('uni-nome');
    const inpUniUf = document.getElementById('uni-uf');
    const inpUniMatriz = document.getElementById('uni-matriz');

    // --- ELEMENTOS CT-E ---
    const tabelaCtes = document.getElementById('tabela-ctes');
    const btnAddCte = document.getElementById('btn-add-cte');

    // =================================================================
    // GESTÃO DE USUÁRIOS
    // =================================================================
    async function carregarUsuarios() {
        if (!tabelaCorpo) return; // Proteção
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

    if (tabelaCorpo) {
        tabelaCorpo.addEventListener('click', (event) => {
            if (event.target.classList.contains('btn-editar')) {
                const linha = event.target.closest('tr');
                document.getElementById('edit-user-id').value = linha.dataset.id;
                document.getElementById('edit_nome_usuario').value = linha.dataset.nome;
                document.getElementById('edit_permissao').value = linha.dataset.permissao;
                document.getElementById('edit_senha').value = '';
                modalEditar.style.display = 'block';
            }
            if (event.target.classList.contains('btn-excluir-entrega')) {
                const userId = event.target.dataset.id;
                if (confirm('Tem certeza que deseja excluir este usuário?')) {
                    fetch(`/api/usuarios/${userId}`, { method: 'DELETE' })
                        .then(res => res.json())
                        .then(data => { alert(data.message || data.error); carregarUsuarios(); })
                        .catch(err => alert(err.message));
                }
            }
        });
    }

    const btnFecharModal = document.getElementById('fechar-modal-editar');
    if (btnFecharModal) {
        btnFecharModal.addEventListener('click', () => modalEditar.style.display = 'none');
    }
    
    if (formEditar) {
        formEditar.addEventListener('submit', async (event) => {
            event.preventDefault();
            const userId = document.getElementById('edit-user-id').value;
            const dados = {
                nome_usuario: document.getElementById('edit_nome_usuario').value,
                permissao: document.getElementById('edit_permissao').value,
                senha: document.getElementById('edit_senha').value
            };
            if (!dados.senha) delete dados.senha;

            try {
                const res = await fetch(`/api/usuarios/${userId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados)
                });
                const json = await res.json();
                if(res.ok) { alert(json.message); modalEditar.style.display = 'none'; carregarUsuarios(); }
                else throw new Error(json.error);
            } catch (error) { alert(`Erro: ${error.message}`); }
        });
    }

    if (formNovoUsuario) {
        formNovoUsuario.addEventListener('submit', async (event) => {
            event.preventDefault();
            const dados = {
                nome_usuario: document.getElementById('nome_usuario').value,
                senha: document.getElementById('senha').value,
                permissao: document.getElementById('permissao').value
            };
            try {
                const res = await fetch('/api/usuarios', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados)
                });
                const json = await res.json();
                if(res.ok) {
                    mensagemDiv.textContent = json.message;
                    mensagemDiv.style.color = '#2ecc71';
                    formNovoUsuario.reset();
                    carregarUsuarios();
                } else throw new Error(json.error);
            } catch (error) {
                mensagemDiv.textContent = `Erro: ${error.message}`;
                mensagemDiv.style.color = '#e74c3c';
            }
        });
    }

    // =================================================================
    // GESTÃO DE UNIDADES & TIPOS DE CT-E (INTEGRADO)
    // =================================================================
    
    // Função Central para Carregar CT-es
    async function carregarTiposCte() {
        try {
            const res = await fetch('/api/auxiliar/tipos-cte');
            const tipos = await res.json();
            
            // 1. Atualiza Select da Unidade
            if(selCte) {
                const valorAtual = selCte.value;
                selCte.innerHTML = '<option value="">Padrão (Nenhum)</option>';
                tipos.forEach(t => {
                    selCte.innerHTML += `<option value="${t.id}">${t.descricao}</option>`;
                });
                if(valorAtual) selCte.value = valorAtual; 
            }

            // 2. Atualiza Tabela de Gerenciamento
            if(tabelaCtes) {
                tabelaCtes.innerHTML = '';
                tipos.forEach(t => {
                    tabelaCtes.innerHTML += `
                        <tr>
                            <td>${t.descricao}</td>
                            <td><button onclick="deletarCte(${t.id})" class="btn-excluir-entrega" style="background:#ef4444; color:white;">🗑️</button></td>
                        </tr>
                    `;
                });
            }
        } catch(e) { console.error(e); }
    }

    async function carregarUnidades() {
        if (!tabelaUnidades) return;
        try {
            const res = await fetch('/api/auxiliar/unidades');
            const unidades = await res.json();
            
            const mapCte = {};
            if(selCte) Array.from(selCte.options).forEach(opt => mapCte[opt.value] = opt.text);

            tabelaUnidades.innerHTML = '';
            unidades.forEach(u => {
                const nomeCte = u.tipo_cte_padrao_id ? (mapCte[u.tipo_cte_padrao_id] || 'ID '+u.tipo_cte_padrao_id) : '-';
                
                // Escapa aspas simples para não quebrar o HTML inline
                const safeNome = u.nome.replace(/'/g, "\\'");
                
                tabelaUnidades.innerHTML += `
                    <tr>
                        <td>${u.nome}</td>
                        <td>${u.uf || '<span style="color:#94a3b8">Global</span>'}</td>
                        <td>${nomeCte}</td>
                        <td style="text-align:center;">${u.is_matriz ? '⭐ SIM' : ''}</td>
                        <td>
                            <button onclick="editarUnidade(${u.id}, '${safeNome}', '${u.uf || ''}', '${u.tipo_cte_padrao_id || ''}', ${u.is_matriz})" class="btn-editar" style="margin-right:5px;">✏️</button>
                            <button onclick="deletarUnidade(${u.id})" class="btn-excluir-entrega" style="background:#ef4444; color:white;">🗑️</button>
                        </td>
                    </tr>
                `;
            });
        } catch(e) { console.error('Erro unidades:', e); }
    }

    // --- FUNÇÃO DE EDIÇÃO (Agora tem acesso aos inputs globais) ---
    window.editarUnidade = (id, nome, uf, cteId, isMatriz) => {
        // Verifica se os inputs existem (pode ser que o HTML não tenha carregado o hidden id)
        if(inpUniId) inpUniId.value = id; // Só atribui se o elemento existir
        else {
            // Se o campo hidden não existir, cria ele dinamicamente (fallback)
            const inputHidden = document.createElement('input');
            inputHidden.type = 'hidden';
            inputHidden.id = 'uni-id';
            inputHidden.value = id;
            document.body.appendChild(inputHidden);
        }

        if(inpUniNome) inpUniNome.value = nome;
        if(inpUniUf) inpUniUf.value = uf;
        if(selCte) selCte.value = cteId;
        if(inpUniMatriz) inpUniMatriz.checked = isMatriz;

        if (btnAddUnidade) {
            btnAddUnidade.textContent = 'Atualizar';
            btnAddUnidade.classList.remove('btn-acao-verde');
            btnAddUnidade.classList.add('btn-acao'); 
        }
        if (btnCancelUnidade) {
            btnCancelUnidade.style.display = 'inline-block';
        }
        if(inpUniNome) inpUniNome.focus();
    };

    // --- FUNÇÃO CANCELAR EDIÇÃO ---
    if(btnCancelUnidade) {
        btnCancelUnidade.onclick = (e) => {
            if(e) e.preventDefault();
            // Reseta valores
            const hiddenId = document.getElementById('uni-id');
            if(hiddenId) hiddenId.value = '';
            
            if(inpUniNome) inpUniNome.value = '';
            if(inpUniUf) inpUniUf.value = '';
            if(selCte) selCte.value = '';
            if(inpUniMatriz) inpUniMatriz.checked = false;

            if(btnAddUnidade) {
                btnAddUnidade.textContent = 'Salvar Unidade';
                btnAddUnidade.classList.add('btn-acao-verde');
                btnAddUnidade.classList.remove('btn-acao');
            }
            btnCancelUnidade.style.display = 'none';
        };
    }

    // --- SALVAR UNIDADE ---
    if(btnAddUnidade) {
        btnAddUnidade.onclick = async () => {
            // Tenta pegar o ID (pode vir do hidden original ou criado dinamicamente)
            const hiddenId = document.getElementById('uni-id');
            const id = hiddenId ? hiddenId.value : '';

            const payload = {
                nome: inpUniNome.value,
                uf: inpUniUf.value,
                tipo_cte_padrao_id: selCte.value,
                is_matriz: inpUniMatriz.checked
            };

            if(!payload.nome) return alert('Nome da unidade é obrigatório.');

            try {
                let url = '/api/auxiliar/unidades';
                let method = 'POST';

                if(id) {
                    url = `/api/auxiliar/unidades/${id}`;
                    method = 'PUT';
                }

                const res = await fetch(url, {
                    method: method,
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });

                if(res.ok) {
                    alert(id ? 'Unidade atualizada!' : 'Unidade salva!');
                    // Aciona o cancelar para limpar o form e voltar o botão ao normal
                    if(btnCancelUnidade && btnCancelUnidade.style.display !== 'none') {
                        btnCancelUnidade.click();
                    } else {
                        // Limpeza manual se não estava editando
                        inpUniNome.value = '';
                        inpUniUf.value = '';
                        inpUniMatriz.checked = false;
                    }
                    carregarUnidades();
                } else {
                    const err = await res.json();
                    alert('Erro: ' + (err.error || 'Falha ao salvar'));
                }
            } catch(e) { console.error(e); }
        };
    }

    // Salvar CT-e
    if(btnAddCte) {
        btnAddCte.onclick = async () => {
            const desc = document.getElementById('cte-desc').value;
            if(!desc) return alert('Digite a descrição.');
            
            await fetch('/api/auxiliar/tipos-cte', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({descricao: desc})
            });
            document.getElementById('cte-desc').value = '';
            carregarTiposCte(); 
        };
    }

    // Funções Globais de Exclusão
    window.deletarUnidade = async (id) => {
        if(!confirm('Tem certeza? Isso pode afetar cargas antigas.')) return;
        const res = await fetch(`/api/auxiliar/unidades/${id}`, { method: 'DELETE' });
        if(res.ok) carregarUnidades();
        else alert('Erro ao excluir.');
    };

    window.deletarCte = async (id) => {
        if(!confirm('Excluir este tipo?')) return;
        const res = await fetch(`/api/auxiliar/tipos-cte/${id}`, {method: 'DELETE'});
        if(res.ok) carregarTiposCte();
        else alert('Erro ao excluir (pode estar em uso).');
    };

    // INICIALIZAÇÃO
    carregarUsuarios();
    await carregarTiposCte(); 
    carregarUnidades();       
});