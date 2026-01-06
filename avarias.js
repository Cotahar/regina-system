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
    
    // Elementos de Progresso
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    
    const urlParams = new URLSearchParams(window.location.search);
    const cargaId = urlParams.get('carga_id');

    // --- INICIALIZAÇÃO ---
    carregarMarcas();
    
    if (cargaId) {
        viewLista.style.display = 'none';
        viewRegistro.style.display = 'block';
        document.getElementById('lbl-codigo-carga').textContent = cargaId;
        carregarEntregasDaCarga(cargaId);
        adicionarLinhaItem(); 
    } else {
        viewLista.style.display = 'block';
        viewRegistro.style.display = 'none';
        carregarListaAvarias();
    }

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

            document.querySelectorAll('.btn-selecionar-entrega').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const wrapper = document.getElementById('form-cadastro-wrapper');
                    wrapper.style.opacity = '1';
                    wrapper.style.pointerEvents = 'auto';
                    wrapper.style.display = 'block';
                    document.getElementById('input-entrega-id').value = e.target.dataset.id;
                    document.getElementById('input-nf-manual').focus();
                    
                    document.querySelectorAll('tr').forEach(tr => tr.style.background = 'transparent');
                    e.target.closest('tr').style.background = '#dcfce7';
                });
            });

        } catch (e) { alert('Erro ao carregar entregas: ' + e.message); }
    }

    // --- GERENCIADOR DE ITENS (ATUALIZADO) ---
    function atualizarBotoesRemover() {
        const botoes = document.querySelectorAll('.btn-remove-item');
        const qtd = botoes.length;
        botoes.forEach(btn => {
            // Desabilita se for o único item
            btn.disabled = (qtd === 1);
            btn.title = (qtd === 1) ? "É obrigatório ter ao menos um item" : "Remover item";
        });
    }

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
            <button type="button" class="btn-remove-item">X</button>
        `;
        
        // Listener para remover com verificação
        div.querySelector('.btn-remove-item').addEventListener('click', function() {
            if (document.querySelectorAll('.item-row').length > 1) {
                div.remove();
                atualizarBotoesRemover();
            }
        });

        containerItens.appendChild(div);
        atualizarBotoesRemover();
    }
    btnAddItem.addEventListener('click', adicionarLinhaItem);

    // Preview
    inputFotos.addEventListener('change', () => {
        previewContainer.innerHTML = '';
        Array.from(inputFotos.files).forEach(file => {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.classList.add('thumb-foto');
            previewContainer.appendChild(img);
        });
    });

    // --- SALVAR (COM BARRA DE PROGRESSO) ---
    formAvaria.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = formAvaria.querySelector('button[type="submit"]');
        const txtOriginal = btn.textContent;
        btn.textContent = 'Salvando dados...'; btn.disabled = true;
        msgCadastro.textContent = '';

        try {
            // 1. Coleta Dados e Salva Texto
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
                nota_fiscal: document.getElementById('input-nf-manual').value,
                marca_id: selectMarca.val(),
                tipo_descarga: document.getElementById('select-descarga').value,
                itens: itens
            };

            const resDados = await fetch('/api/avarias', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            const jsonDados = await resDados.json();
            if(!resDados.ok) throw new Error(jsonDados.error);

            // 2. Upload de Fotos com Progresso (XHR)
            if (inputFotos.files.length > 0) {
                btn.textContent = 'Enviando Fotos...';
                progressContainer.style.display = 'block';
                
                await uploadComProgresso(jsonDados.avaria_id, inputFotos.files);
            }

            msgCadastro.textContent = 'Sucesso! Avaria registrada.';
            msgCadastro.style.color = 'green';
            setTimeout(() => { window.location.href = '/avarias.html'; }, 1500);

        } catch (erro) {
            msgCadastro.textContent = 'Erro: ' + erro.message;
            msgCadastro.style.color = 'red';
            btn.textContent = txtOriginal; btn.disabled = false;
            progressContainer.style.display = 'none';
        }
    });

    // Função de Upload Manual (XHR)
    function uploadComProgresso(avariaId, fileList) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            Array.from(fileList).forEach(f => formData.append('fotos', f));

            const xhr = new XMLHttpRequest();
            xhr.open('POST', `/api/avarias/${avariaId}/upload`, true);

            // Evento de Progresso
            xhr.upload.onprogress = function(e) {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    progressBar.style.width = percentComplete + '%';
                    progressBar.textContent = Math.round(percentComplete) + '%';
                }
            };

            xhr.onload = function() {
                if (xhr.status === 200) {
                    progressBar.style.backgroundColor = '#22c55e'; // Verde sucesso
                    resolve(xhr.response);
                } else {
                    reject(new Error('Falha no upload das imagens'));
                }
            };

            xhr.onerror = function() {
                reject(new Error('Erro de rede no upload'));
            };

            xhr.send(formData);
        });
    }

    async function carregarListaAvarias() {
        const tbody = tabelaAvarias;
        tbody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
        try {
            const res = await fetch('/api/avarias');
            const lista = await res.json();
            tbody.innerHTML = '';
            if(lista.length === 0) { tbody.innerHTML = '<tr><td colspan="7">Nenhuma avaria registrada.</td></tr>'; return; }
            lista.forEach(a => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>${a.data}</td><td><b>${a.nota_fiscal}</b></td><td>${a.cliente}</td><td>${a.marca}</td><td>${a.resumo_produto}</td><td><span class="status-pendente">${a.status}</span></td><td><button class="btn-acao" onclick="abrirRelatorio(${a.id})">🖨️ Relatório</button></td>`;
                tbody.appendChild(tr);
            });
        } catch(e) { console.error(e); }
    }

    window.abrirRelatorio = async (id) => {
        const res = await fetch('/api/avarias'); 
        const lista = await res.json();
        const avaria = lista.find(a => a.id == id);
        
        // Aqui você pode montar o texto como quiser
        const texto = `Foram encontradas avarias no produto ${avaria.resumo_produto}, referente a NF ${avaria.nota_fiscal}, durante descarga no cliente ${avaria.cliente}.`;
        document.getElementById('texto-relatorio').value = texto;
        
        document.getElementById('btn-imprimir-final').onclick = () => {
            const textoFinal = document.getElementById('texto-relatorio').value;
            imprimirPagina(textoFinal, avaria);
        };
        document.getElementById('modal-relatorio').style.display = 'block';
    };

function imprimirPagina(texto, dados) {
        // Monta o HTML das fotos
        let htmlFotos = '';
        
        if (dados.fotos && dados.fotos.length > 0) {
            htmlFotos += '<div style="display: flex; flex-wrap: wrap; gap: 10px;">';
            dados.fotos.forEach(foto => {
                // Usa o link de exportação do Google para exibir a imagem direta
                htmlFotos += `
                    <div style="text-align: center; margin-bottom: 10px;">
                        <img src="https://lh3.googleusercontent.com/d/${foto.id}" 
							style="max-width: 800px; max-height: 1128px; border: 1px solid #ccc; border-radius: 4px;"
							alt="Foto Avaria"
							referrerpolicy="no-referrer"
							crossorigin="anonymous">
                    </div>`;
            });
            htmlFotos += '</div>';
        } else {
            htmlFotos = '<p style="color: #666; font-style: italic;">Nenhuma foto registrada para esta ocorrência.</p>';
        }

        const janela = window.open('', '', 'width=900,height=700');
        janela.document.write(`
            <html>
            <head>
                <title>Relatório de Avaria - NF ${dados.nota_fiscal}</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; }
                    h1 { color: #b91c1c; border-bottom: 2px solid #b91c1c; padding-bottom: 10px; }
                    .info-box { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                    .texto-desc { font-size: 1.1em; line-height: 1.6; padding: 20px; border: 1px dashed #ccc; background: #fff; }
                </style>
            </head>
            <body>
                <h1>Relatório de Avaria de Carga</h1>
                
                <div class="info-box">
                    <p><strong>Data da Ocorrência:</strong> ${dados.data}</p>
                    <p><strong>Nota Fiscal:</strong> ${dados.nota_fiscal}</p>
                    <p><strong>Cliente:</strong> ${dados.cliente}</p>
                    <p><strong>Marca:</strong> ${dados.marca}</p>
                </div>

                <h3>Descrição da Ocorrência</h3>
                <div class="texto-desc">
                    ${texto.replace(/\n/g, '<br>')}
                </div>
                
                <hr style="margin: 30px 0; border: 0; border-top: 1px solid #ddd;">
                
                <h3>Registros Fotográficos</h3>
                ${htmlFotos}
                
                <div style="margin-top: 50px; text-align: center; font-size: 0.8em; color: #999;">
                    <p>Relatório gerado automaticamente pelo Regina System.</p>
                </div>
            </body>
            </html>
        `);
        janela.document.close();
        
        // Aguarda as imagens carregarem um pouco antes de abrir a janela de impressão
        setTimeout(() => {
            janela.print();
        }, 1000);
    }
	
    document.getElementById('fechar-relatorio').onclick = () => document.getElementById('modal-relatorio').style.display = 'none';
    document.getElementById('btn-voltar-lista').onclick = () => window.location.href = '/avarias.html';
});