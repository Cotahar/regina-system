document.addEventListener('DOMContentLoaded', () => {
    // Seletores
    const viewLista = document.getElementById('view-lista-avarias');
    const viewRegistro = document.getElementById('view-registro-avaria');
    const tabelaAvarias = document.getElementById('corpo-tabela-avarias');
    const selectMarca = $('#select-marca');
    const containerItens = document.getElementById('container-itens');
    const btnAddItem = document.getElementById('btn-add-item');
    const formAvaria = document.getElementById('form-nova-avaria');
    const msgCadastro = document.getElementById('msg-cadastro');
    const inputFotos = document.getElementById('input-fotos');
    const previewContainer = document.getElementById('preview-container');
    
    // URL Params (Para saber se é cadastro de carga)
    const urlParams = new URLSearchParams(window.location.search);
    const cargaId = urlParams.get('carga_id');

    // --- INICIALIZAÇÃO ---
    carregarMarcas();
    
    if (cargaId) {
        // MODO REGISTRO
        viewLista.style.display = 'none';
        viewRegistro.style.display = 'block';
        document.getElementById('lbl-codigo-carga').textContent = cargaId; // Apenas visual
        carregarEntregasDaCarga(cargaId);
        adicionarLinhaItem(); // Começa com 1 item
    } else {
        // MODO LISTA
        viewLista.style.display = 'block';
        viewRegistro.style.display = 'none';
        carregarListaAvarias();
    }

    // --- FUNÇÕES MODO REGISTRO ---
    
    async function carregarMarcas() {
        try {
            const res = await fetch('/api/marcas');
            const marcas = await res.json();
            const dados = marcas.map(m => ({ id: m.id, text: m.nome }));
            selectMarca.select2({ data: dados, placeholder: 'Selecione a Marca' });
        } catch (e) { console.error('Erro ao carregar marcas', e); }
    }

    async function carregarEntregasDaCarga(id) {
        try {
            const res = await fetch(`/api/cargas/${id}`);
            if(!res.ok) throw new Error('Erro ao buscar carga');
            const dados = await res.json();
            
            const tbody = document.getElementById('lista-entregas-carga');
            tbody.innerHTML = '';
            
            dados.entregas.forEach(e => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><button class="btn-acao btn-selecionar-entrega" data-id="${e.id}" data-nf="${e.nota_fiscal || ''}">Selecionar</button></td>
                    <td>${e.nota_fiscal || 'S/N'}</td>
                    <td>${e.razao_social}</td>
                    <td>${e.cidade}-${e.estado}</td>
                `;
                tbody.appendChild(tr);
            });

            // Listener seleção
            document.querySelectorAll('.btn-selecionar-entrega').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    // Libera o formulário
                    const wrapper = document.getElementById('form-cadastro-wrapper');
                    wrapper.style.opacity = '1';
                    wrapper.style.pointerEvents = 'auto';
                    wrapper.style.display = 'block';
                    
                    document.getElementById('input-entrega-id').value = e.target.dataset.id;
                    // Foca no campo de NF Manual para obrigar preenchimento
                    document.getElementById('input-nf-manual').focus();
                    
                    // Destaque visual na linha
                    document.querySelectorAll('tr').forEach(tr => tr.style.background = 'transparent');
                    e.target.closest('tr').style.background = '#dcfce7';
                });
            });

        } catch (e) { alert('Erro ao carregar entregas: ' + e.message); }
    }

    // Gerenciador de Itens Dinâmicos
    function adicionarLinhaItem() {
        const div = document.createElement('div');
        div.classList.add('item-row');
        div.innerHTML = `
            <input type="text" class="input-prod" placeholder="Produto (Ex: Porcelanato 60x60)" required>
            <input type="number" class="input-qtd" placeholder="Qtd" step="0.01" required>
            <select class="input-un" style="padding: 10px;">
                <option value="cx">Caixas</option>
                <option value="m²">m²</option>
                <option value="pç">Peças</option>
            </select>
            <button type="button" class="btn-remove-item" onclick="this.parentElement.remove()">X</button>
        `;
        containerItens.appendChild(div);
    }
    btnAddItem.addEventListener('click', adicionarLinhaItem);

    // Preview de Fotos
    inputFotos.addEventListener('change', () => {
        previewContainer.innerHTML = '';
        Array.from(inputFotos.files).forEach(file => {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.classList.add('thumb-foto');
            previewContainer.appendChild(img);
        });
    });

    // --- SALVAR AVARIA ---
    formAvaria.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = formAvaria.querySelector('button[type="submit"]');
        const txtOriginal = btn.textContent;
        btn.textContent = 'Salvando dados...'; btn.disabled = true;

        try {
            // 1. Coleta Dados
            const itens = [];
            document.querySelectorAll('.item-row').forEach(row => {
                itens.push({
                    produto: row.querySelector('.input-prod').value,
                    quantidade: row.querySelector('.input-qtd').value,
                    unidade: row.querySelector('.input-un').value
                });
            });

            const payload = {
                entrega_id: document.getElementById('input-entrega-id').value,
                nota_fiscal: document.getElementById('input-nf-manual').value, // NF Manual
                marca_id: selectMarca.val(),
                tipo_descarga: document.getElementById('select-descarga').value,
                itens: itens
            };

            // 2. Envia Dados Texto
            const resDados = await fetch('/api/avarias', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            const jsonDados = await resDados.json();
            if(!resDados.ok) throw new Error(jsonDados.error);

            // 3. Envia Fotos (se houver)
            if (inputFotos.files.length > 0) {
                btn.textContent = 'Enviando fotos para o Drive... (Isso pode demorar)';
                const formData = new FormData();
                Array.from(inputFotos.files).forEach(f => formData.append('fotos', f));
                
                const resFotos = await fetch(`/api/avarias/${jsonDados.avaria_id}/upload`, {
                    method: 'POST',
                    body: formData
                });
                if(!resFotos.ok) throw new Error('Erro ao enviar fotos');
            }

            msgCadastro.textContent = 'Sucesso! Avaria registrada.';
            msgCadastro.style.color = 'green';
            setTimeout(() => { window.location.href = '/avarias.html'; }, 2000); // Vai para lista

        } catch (erro) {
            msgCadastro.textContent = 'Erro: ' + erro.message;
            msgCadastro.style.color = 'red';
            btn.textContent = txtOriginal; btn.disabled = false;
        }
    });

    // --- MODO LISTA ---
    async function carregarListaAvarias() {
        const tbody = tabelaAvarias;
        tbody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
        
        try {
            const res = await fetch('/api/avarias');
            const lista = await res.json();
            tbody.innerHTML = '';
            
            if(lista.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7">Nenhuma avaria registrada.</td></tr>';
                return;
            }

            lista.forEach(a => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${a.data}</td>
                    <td><b>${a.nota_fiscal}</b></td>
                    <td>${a.cliente}</td>
                    <td>${a.marca}</td>
                    <td>${a.resumo_produto}</td>
                    <td><span class="status-pendente">${a.status}</span></td>
                    <td>
                        <button class="btn-acao" onclick="abrirRelatorio(${a.id})">🖨️ Relatório</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch(e) { console.error(e); }
    }

    // --- RELATÓRIO E IMPRESSÃO (O Pulo do Gato) ---
    window.abrirRelatorio = async (id) => {
        // Busca os dados completos da avaria para preencher o modal
        // Por simplicidade, vamos buscar a lista de novo filtrada ou criar endpoint GET /avarias/id
        // Vamos usar o endpoint de lista e filtrar no JS por enquanto (rápido)
        const res = await fetch('/api/avarias'); // Ideal seria /api/avarias/id
        const lista = await res.json();
        const avaria = lista.find(a => a.id == id);
        
        // Texto Padrão (recriado aqui ou vindo do backend se salvarmos em 'observacoes')
        // Vamos supor que queremos editar o texto que foi salvo
        // Precisaríamos buscar o campo 'observacoes' que salvamos no backend.
        // O endpoint de lista atual retorna resumo. Vamos melhorar o endpoint no futuro.
        // Para agora, vou recriar o texto padrão aqui para demo:
        
        const texto = `Foram encontradas avarias no produto ${avaria.resumo_produto}, referente a NF ${avaria.nota_fiscal}, durante descarga no cliente ${avaria.cliente}.`;
        
        document.getElementById('texto-relatorio').value = texto;
        
        // Configura o botão de imprimir para abrir a janela final
        document.getElementById('btn-imprimir-final').onclick = () => {
            const textoFinal = document.getElementById('texto-relatorio').value;
            imprimirPagina(textoFinal, avaria); // Passar fotos aqui se tivermos link
        };
        
        document.getElementById('modal-relatorio').style.display = 'block';
    };

    function imprimirPagina(texto, dados) {
        const janela = window.open('', '', 'width=900,height=700');
        janela.document.write(`
            <html>
            <head><title>Relatório de Avaria - ${dados.nota_fiscal}</title>
            <style>body { font-family: Arial; padding: 40px; } img { max-width: 300px; margin: 10px; }</style>
            </head>
            <body>
                <h1>Relatório de Avaria</h1>
                <p><strong>Data:</strong> ${dados.data}</p>
                <hr>
                <h3>Descrição da Ocorrência</h3>
                <p style="font-size: 1.2em; padding: 20px; background: #eee;">${texto}</p>
                <hr>
                <h3>Registros Fotográficos</h3>
                <p><i>(Fotos do Google Drive aparecerão aqui se o link for público)</i></p>
                </body>
            </html>
        `);
        janela.document.close();
        janela.print();
    }

    // Modal listeners
    document.getElementById('fechar-relatorio').onclick = () => document.getElementById('modal-relatorio').style.display = 'none';
    document.getElementById('btn-voltar-lista').onclick = () => window.location.href = '/avarias.html';
});