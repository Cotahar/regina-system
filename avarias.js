document.addEventListener('DOMContentLoaded', async () => {
    // --- VARIÁVEIS GLOBAIS ---
    let idsAvariaAtual = []; 

    // --- VERIFICAÇÃO DE SESSÃO (CORREÇÃO DO ADMIN) ---
    // Busca quem é o usuário antes de carregar o resto da página
    try {
        const resSession = await fetch('/api/session');
        if (resSession.ok) {
            const sessao = await resSession.json();
            // Salva a permissão para o restante do script usar
            sessionStorage.setItem('user_permission', sessao.user_permission);
            
            // Corrige o Menu Dropdown (Adiciona "Usuários" se for admin)
            if (sessao.user_permission === 'admin') {
                const navAdmin = document.getElementById('nav-admin-dropdown');
                if (navAdmin) {
                    navAdmin.innerHTML = `<a href="/usuarios.html">Usuários</a>`;
                }
            }
        } else {
            // Se não estiver logado, manda pro login
            window.location.href = '/login.html';
            return;
        }
    } catch (e) {
        console.error("Erro ao verificar sessão:", e);
    }

    // --- SELETORES GERAIS ---
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
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');

    // --- CONFIGURAÇÃO GLOBAL SELECT2 ---
    $(document).on('select2:open', () => {
        document.querySelector('.select2-search__field').focus();
    });

    // --- INICIALIZAÇÃO ---
    carregarFiltrosSelects();
    
    const urlParams = new URLSearchParams(window.location.search);
    const cargaIdParam = urlParams.get('carga_id');

    if (cargaIdParam) {
        viewLista.style.display = 'none';
        viewRegistro.style.display = 'block';
        carregarMarcas();
        carregarEntregasDaCargaAgrupadas(cargaIdParam);
        document.getElementById('lbl-codigo-carga').textContent = cargaIdParam;
        adicionarLinhaItem(); 
    } else {
        viewLista.style.display = 'block';
        viewRegistro.style.display = 'none';
        carregarListaAvarias();
    }

    // --- LISTAGEM COM AGRUPAMENTO INTELIGENTE (DATA + FILTRO NF NO GRUPO) ---
    async function carregarListaAvarias() {
        const tbody = tabelaAvarias;
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Carregando...</td></tr>';
        
        const params = new URLSearchParams();
        const status = document.getElementById('filtro-status').value;
        const dtIni = document.getElementById('filtro-data-inicio').value;
        const dtFim = document.getElementById('filtro-data-fim').value;
        const motId = $('#filtro-motorista').val();
        const cliId = $('#filtro-cliente').val();
        const marId = $('#filtro-marca').val();

        if(status) params.append('status', status);
        if(dtIni) params.append('data_inicio', dtIni);
        if(dtFim) params.append('data_fim', dtFim);
        if(motId) params.append('motorista_id', motId);
        if(cliId) params.append('cliente_id', cliId);
        if(marId) params.append('marca_id', marId);

        const filtroNfTexto = document.getElementById('filtro-nf').value.trim().toLowerCase();

        try {
            const res = await fetch(`/api/avarias?${params.toString()}`);
            const listaRaw = await res.json();
            tbody.innerHTML = '';
            
            if(listaRaw.length === 0) { 
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Nenhuma avaria encontrada.</td></tr>'; 
                return; 
            }

            const grupos = {};
            
            listaRaw.forEach(avaria => {
                const key = `${avaria.carga_id}_${avaria.cliente_id}_${avaria.status}_${avaria.data}`;
                
                if (!grupos[key]) {
                    grupos[key] = {
                        ids: [], 
                        dados: avaria, 
                        nfs: [], 
                        todasAvarias: [] 
                    };
                }
                grupos[key].ids.push(avaria.id);
                grupos[key].nfs.push(avaria.nota_fiscal);
                grupos[key].todasAvarias.push(avaria);
            });

            let encontrouAlgum = false;
            // Agora garantimos que o sessionStorage está atualizado
            const isAdmin = sessionStorage.getItem('user_permission') === 'admin'; 

            Object.values(grupos).forEach(grupo => {
                if (filtroNfTexto) {
                    const match = grupo.nfs.some(nf => nf.toLowerCase().includes(filtroNfTexto));
                    if (!match) return; 
                }

                encontrouAlgum = true;
                const a = grupo.dados;
                const qtd = grupo.ids.length;
                
                let nfDisplay = grupo.nfs[0];
                if (qtd > 1) {
                    nfDisplay = `${grupo.nfs[0]} <span style="color:#64748b; font-size:0.9em; font-weight:normal;">[+${qtd-1}]</span>`;
                }

                let corStatus = '#333';
                let btnAcaoStatus = '';
                const idsString = JSON.stringify(grupo.ids);

                if(a.status === 'Pendente') {
                    corStatus = '#ef4444'; 
                    btnAcaoStatus = `<button class="btn-acao" style="background:#f59e0b; font-size:0.9em;" onclick='abrirModalEnvio(${idsString})'>📤 Registrar Envio (${qtd})</button>`;
                } else if(a.status === 'Enviado') {
                    corStatus = '#f59e0b'; 
                    btnAcaoStatus = `<button class="btn-acao-verde" style="font-size:0.9em;" onclick='abrirModalFinalizar(${idsString})'>✅ Finalizar (${qtd})</button>`;
                } else {
                    corStatus = '#22c55e';
                    btnAcaoStatus = '<span style="color:#22c55e; font-weight:bold;">Concluído</span>';
                }

                const domId = grupo.ids[0]; 

                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                tr.onclick = (e) => { if(e.target.tagName !== 'BUTTON') toggleDetalhe(domId); };
                
                tr.innerHTML = `
                    <td>${a.data}</td>
                    <td><b>${nfDisplay}</b></td>
                    <td>${a.motorista}</td>
                    <td>${a.cliente}</td>
                    <td>${a.marca}</td>
                    <td style="color: ${corStatus}; font-weight: bold;">${a.status}</td>
                    <td>
                        <button class="btn-acao" onclick='abrirRelatorioAgrupado(${idsString})' title="Imprimir">🖨️</button>
                        ${isAdmin ? 
                          `<button class="btn-navegacao" style="background-color: #ef4444; color: white; margin-left: 5px;" onclick='excluirAvariaLote(${idsString})' title="Excluir">🗑️</button>` : ''}
                    </td>
                `;
                tbody.appendChild(tr);

                // --- DETALHES DO GRUPO (ACORDEÃO) ---
                const trDet = document.createElement('tr');
                trDet.id = `detalhe-${domId}`;
                trDet.style.display = 'none';
                trDet.style.background = '#f8fafc';
                
                let itensHtml = '';
                grupo.todasAvarias.forEach(av => {
                    if (av.itens && av.itens.length > 0) {
                        av.itens.forEach(i => {
                            let styleNf = "color:#334155; font-weight:600;";
                            if (filtroNfTexto && av.nota_fiscal.toLowerCase().includes(filtroNfTexto)) {
                                styleNf = "color:#dc2626; font-weight:800; background:#fef08a;";
                            }
                            itensHtml += `<li><span style="${styleNf}">NF ${av.nota_fiscal}</span> - ${i.produto}: ${i.quantidade} ${i.unidade}</li>`;
                        });
                    }
                });
                if (!itensHtml) itensHtml = '<li>Sem itens registrados</li>';
                
                const obsDisplay = a.observacoes || 'Sem observações.';

                // BOTÃO DE EXCLUIR NOS DETALHES (ADMIN)
                trDet.innerHTML = `
                    <td colspan="7" style="padding: 20px; border-left: 5px solid ${corStatus}; box-shadow: inset 0 0 10px rgba(0,0,0,0.05);">
                        <div style="display: flex; gap: 40px;">
                            <div style="flex: 1;">
                                <h4 style="margin-top:0; color:#334155;">📦 Detalhes dos Produtos (Agrupado)</h4>
                                <ul style="margin: 5px 0; padding-left: 20px; color: #475569;">${itensHtml}</ul>
                                <p style="margin-top: 15px; font-weight:bold; color:#334155;">📝 Observação Principal:</p>
                                <div style="background:#fff; padding:10px; border:1px solid #e2e8f0; border-radius:4px; font-style: italic; color: #64748b; font-size: 0.9em; white-space: pre-wrap;">${obsDisplay}</div>
                            </div>
                            <div style="flex: 1; border-left: 1px solid #cbd5e1; padding-left: 40px;">
                                <h4 style="margin-top:0; color:#334155;">🔄 Fluxo da Ocorrência</h4>
                                <div style="margin-bottom: 20px;">${btnAcaoStatus}</div>
                                
                                ${a.registro_envio ? `<div style="background:#fff7ed; padding:10px; border-radius:4px; margin-bottom:10px; border:1px solid #ffedd5;"><p style="margin:0; font-size:0.9em; color:#9a3412;"><strong>📤 Registro de Envio:</strong><br>${a.registro_envio}</p></div>` : ''}
                                ${a.retorno_fabrica ? `<div style="background:#f0fdf4; padding:10px; border-radius:4px; margin-bottom:10px; border:1px solid #bbf7d0;"><p style="margin:0; font-size:0.9em; color:#166534;"><strong>📥 Retorno da Fábrica:</strong><br>${a.retorno_fabrica}</p></div>` : ''}
                                ${a.valor_cobranca > 0 ? `<div style="background:#fef2f2; padding:10px; border-radius:4px; border:1px solid #fecaca;"><p style="margin:0; color:#b91c1c; font-weight:bold;">💲 Valor Cobrado: R$ ${a.valor_cobranca.toFixed(2)}</p></div>` : ''}

                                ${isAdmin ? `
                                    <div style="margin-top: 25px; border-top: 1px dashed #cbd5e1; padding-top: 15px;">
                                        <button class="btn-navegacao" style="background-color: #ef4444; color: white; width: 100%; font-size: 0.9em;" 
                                            onclick='excluirAvariaLote(${idsString})'>
                                            🗑️ Excluir Ocorrência (Admin)
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </td>
                `;
                tbody.appendChild(trDet);
            });

            if(!encontrouAlgum) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">Nenhuma avaria encontrada com estes filtros.</td></tr>';
            }

        } catch(e) { console.error(e); }
    }

    window.toggleDetalhe = (id) => {
        const el = document.getElementById(`detalhe-${id}`);
        document.querySelectorAll('tr[id^="detalhe-"]').forEach(tr => {
            if(tr.id !== `detalhe-${id}`) tr.style.display = 'none';
        });
        el.style.display = el.style.display === 'none' ? 'table-row' : 'none';
    };

    // --- FILTROS ---
    async function carregarFiltrosSelects() {
        try {
            const [resMot, resCli, resMar] = await Promise.all([
                fetch('/api/motoristas'), fetch('/api/clientes'), fetch('/api/marcas')
            ]);
            
            const motoristas = await resMot.json();
            const clientes = await resCli.json();
            const marcas = await resMar.json();

            $('#filtro-motorista').select2({
                data: motoristas.map(m => ({id: m.id, text: m.nome})),
                placeholder: 'Motorista', allowClear: true
            }).val(null).trigger('change');

            $('#filtro-cliente').select2({
                data: clientes.map(c => ({id: c.id, text: c.text})), 
                placeholder: 'Cliente', allowClear: true
            }).val(null).trigger('change');

            $('#filtro-marca').select2({
                data: marcas.map(m => ({id: m.id, text: m.nome})),
                placeholder: 'Marca', allowClear: true
            }).val(null).trigger('change');

        } catch(e) { console.error("Erro ao carregar filtros", e); }
    }

    document.getElementById('btn-aplicar-filtros').addEventListener('click', carregarListaAvarias);
    document.getElementById('btn-limpar-filtros').addEventListener('click', () => {
        document.getElementById('filtro-nf').value = '';
        document.getElementById('filtro-data-inicio').value = '';
        document.getElementById('filtro-data-fim').value = '';
        document.getElementById('filtro-status').value = '';
        $('#filtro-motorista').val(null).trigger('change');
        $('#filtro-cliente').val(null).trigger('change');
        $('#filtro-marca').val(null).trigger('change');
        carregarListaAvarias();
    });

    async function carregarEntregasDaCargaAgrupadas(id) {
        try {
            const res = await fetch(`/api/cargas/${id}`);
            if(!res.ok) throw new Error('Erro ao buscar carga');
            const dados = await res.json();
            const tbody = document.getElementById('lista-entregas-carga');
            tbody.innerHTML = '';
            const grupos = {};
            dados.entregas.forEach(e => {
                if(!grupos[e.cliente_id]) {
                    grupos[e.cliente_id] = {
                        cliente_nome: e.razao_social,
                        cidade: `${e.cidade}-${e.estado}`,
                        nfs: [],
                        id_principal: e.id
                    };
                }
                if(e.nota_fiscal) grupos[e.cliente_id].nfs.push(e.nota_fiscal);
            });
            Object.values(grupos).forEach(grupo => {
                const nfsString = grupo.nfs.join(' / ');
                const tr = document.createElement('tr');
                tr.innerHTML = `<td><button class="btn-acao btn-selecionar-entrega" data-id="${grupo.id_principal}" data-nfs="${nfsString}">Selecionar</button></td><td>${nfsString || 'S/N'}</td><td>${grupo.cliente_nome}</td><td>${grupo.cidade}</td>`;
                tbody.appendChild(tr);
            });
            document.querySelectorAll('.btn-selecionar-entrega').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const wrapper = document.getElementById('form-cadastro-wrapper');
                    wrapper.style.opacity = '1';
                    wrapper.style.pointerEvents = 'auto';
                    wrapper.style.display = 'block';
                    document.getElementById('input-entrega-id').value = e.target.dataset.id;
                    document.getElementById('input-nf-manual').value = e.target.dataset.nfs;
                    document.getElementById('input-nf-manual').focus();
                    document.querySelectorAll('tr').forEach(tr => tr.style.background = 'transparent');
                    e.target.closest('tr').style.background = '#dcfce7';
                });
            });
        } catch (e) { alert('Erro ao carregar entregas: ' + e.message); }
    }

    async function carregarMarcas() {
        try {
            const res = await fetch('/api/marcas');
            const marcas = await res.json();
            const dados = marcas.map(m => ({ id: m.id, text: m.nome }));
            selectMarca.select2({ data: dados, placeholder: 'Selecione a Marca' }).val(null).trigger('change');
        } catch (e) { console.error(e); }
    }

    function atualizarBotoesRemover() {
        const botoes = document.querySelectorAll('.btn-remove-item');
        const qtd = botoes.length;
        botoes.forEach(btn => {
            btn.disabled = (qtd === 1);
            btn.title = (qtd === 1) ? "Obrigatório ter ao menos um item" : "Remover item";
        });
    }

    function adicionarLinhaItem() {
        const div = document.createElement('div');
        div.classList.add('item-row');
        div.style.display = 'grid';
        div.style.gridTemplateColumns = '2fr 1fr 1fr 40px';
        div.style.gap = '10px';
        div.style.marginBottom = '10px';
        div.style.alignItems = 'end'; 
        div.innerHTML = `<div><label style="font-size: 0.8em; color: #666;">Produto</label><input type="text" class="input-prod" placeholder="Ex: Porcelanato 60x60" required style="width: 100%; margin:0;"></div><div><label style="font-size: 0.8em; color: #666;">Qtd</label><input type="number" class="input-qtd" placeholder="0.00" step="0.01" required style="width: 100%; margin:0;"></div><div><label style="font-size: 0.8em; color: #666;">Unid.</label><select class="input-un" style="width: 100%; padding: 10px; margin:0;"><option value="cx">Caixas</option><option value="m²">m²</option><option value="pç">Peças</option></select></div><button type="button" class="btn-remove-item" style="height: 42px; margin-bottom: 1px;">X</button>`;
        div.querySelector('.btn-remove-item').addEventListener('click', function() {
            if (document.querySelectorAll('.item-row').length > 1) { div.remove(); atualizarBotoesRemover(); }
        });
        containerItens.appendChild(div);
        atualizarBotoesRemover();
    }
    
    if(btnAddItem) btnAddItem.addEventListener('click', adicionarLinhaItem);

    if(inputFotos) {
        inputFotos.addEventListener('change', () => {
            previewContainer.innerHTML = '';
            Array.from(inputFotos.files).forEach(file => {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.classList.add('thumb-foto');
                previewContainer.appendChild(img);
            });
        });
    }

    // --- NOVA LÓGICA DE UPLOAD (SEQUENCIAL) ---
    // Isso evita o erro 502 enviando um arquivo de cada vez
    if(formAvaria) {
        formAvaria.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formAvaria.querySelector('button[type="submit"]');
            const txtOriginal = btn.textContent;
            btn.textContent = 'Salvando Dados...'; btn.disabled = true;
            msgCadastro.textContent = '';

            try {
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

                // --- UPLOAD SEQUENCIAL DE IMAGENS ---
                if (inputFotos.files.length > 0) {
                    progressContainer.style.display = 'block';
                    const totalArquivos = inputFotos.files.length;

                    for (let i = 0; i < totalArquivos; i++) {
                        const arquivo = inputFotos.files[i];
                        btn.textContent = `Enviando Foto ${i + 1}/${totalArquivos}...`;
                        
                        try {
                            await uploadUnico(jsonDados.avaria_id, arquivo);
                            
                            // Atualiza barra
                            const percent = ((i + 1) / totalArquivos) * 100;
                            progressBar.style.width = percent + '%';
                            progressBar.textContent = Math.round(percent) + '%';
                        } catch (err) {
                            console.error('Falha no arquivo ' + i, err);
                            // Opcional: avisar usuário mas continuar ou parar
                            // alert(`Erro ao enviar imagem ${i+1}. O processo continuará.`);
                        }
                    }
                    progressBar.style.backgroundColor = '#22c55e';
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
    }

    // Função auxiliar para enviar UM arquivo por vez
    function uploadUnico(avariaId, file) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('fotos', file); // Back espera 'fotos'

            const xhr = new XMLHttpRequest();
            xhr.open('POST', `/api/avarias/${avariaId}/upload`, true);

            xhr.onload = function() {
                if (xhr.status === 200) resolve(xhr.response);
                else reject(new Error('Erro no upload'));
            };
            xhr.onerror = function() { reject(new Error('Erro de rede')); };
            xhr.send(formData);
        });
    }

    // --- FUNÇÕES DE LOTE (WORKFLOW) ---
    window.abrirModalEnvio = (idsArray) => {
        idsAvariaAtual = Array.isArray(idsArray) ? idsArray : [idsArray];
        document.getElementById('input-registro-envio').value = '';
        document.getElementById('modal-envio').style.display = 'block';
    };

    const btnConfirmarEnvio = document.getElementById('btn-confirmar-envio');
    if(btnConfirmarEnvio) {
        btnConfirmarEnvio.onclick = async () => {
            const texto = document.getElementById('input-registro-envio').value;
            if(!texto) return alert('Preencha os dados do envio.');
            
            for(let id of idsAvariaAtual) {
                await atualizarStatusAvaria(id, 'registrar_envio', { registro_envio: texto }, false);
            }
            alert('Status atualizado para o grupo!');
            carregarListaAvarias();
            document.getElementById('modal-envio').style.display = 'none';
        };
    }

    window.abrirModalFinalizar = (idsArray) => {
        idsAvariaAtual = Array.isArray(idsArray) ? idsArray : [idsArray];
        document.getElementById('input-retorno-fabrica').value = '';
        document.getElementById('input-valor-cobranca').value = '0.00';
        document.getElementById('modal-finalizar').style.display = 'block';
    };

    const btnConfirmarFinal = document.getElementById('btn-confirmar-finalizacao');
    if(btnConfirmarFinal) {
        btnConfirmarFinal.onclick = async () => {
            const retorno = document.getElementById('input-retorno-fabrica').value;
            const valor = document.getElementById('input-valor-cobranca').value;
            if(!retorno) return alert('Preencha o retorno da fábrica.');

            for(let id of idsAvariaAtual) {
                await atualizarStatusAvaria(id, 'finalizar', { 
                    retorno_fabrica: retorno,
                    valor_cobranca: valor
                }, false);
            }
            alert('Processo finalizado para o grupo!');
            carregarListaAvarias();
            document.getElementById('modal-finalizar').style.display = 'none';
        };
    }

    async function atualizarStatusAvaria(id, acao, dadosExtras, reload=true) {
        try {
            const res = await fetch(`/api/avarias/${id}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ acao: acao, ...dadosExtras })
            });
            if(reload && res.ok) {
                alert('Status atualizado!');
                carregarListaAvarias();
            }
        } catch(e) { console.error(e); }
    }

    function gerarTextoCombinado(listaAvarias) {
        if (!listaAvarias || listaAvarias.length === 0) return '';
        const principal = listaAvarias[0];
        const cliente = principal.cliente;
        const tipoDescarga = principal.tipo_descarga || 'Manual';
        const nfs = [...new Set(listaAvarias.map(a => a.nota_fiscal))].join(', ');
        let descargaTxt = tipoDescarga;
        if (['Empilhadeira', 'Munck', 'Grua'].includes(tipoDescarga)) {
            descargaTxt = `com ${tipoDescarga}`;
        }
        let texto = `Durante a descarga ${descargaTxt}, foram encontradas avarias no meio do pallet referente às NFs ${nfs} do cliente ${cliente}. Seguem em anexo registros feitos pelo motorista e abaixo segue quantidade e produtos:\n`;
        listaAvarias.forEach(av => {
            if (av.itens && av.itens.length > 0) {
                av.itens.forEach(item => {
                    texto += `\n- NF ${av.nota_fiscal} - ${item.produto} - ${item.quantidade} ${item.unidade}`;
                });
            }
        });
        return texto;
    }
    
    window.abrirRelatorioAgrupado = async (idsArray) => {
        try {
            const ids = Array.isArray(idsArray) ? idsArray : [idsArray];
            const res = await fetch('/api/avarias'); 
            const todas = await res.json();
            const avariasDoGrupo = todas.filter(a => ids.includes(a.id));
            if (avariasDoGrupo.length === 0) return alert("Erro: Dados não encontrados.");

            const dadosCombinados = {
                data: avariasDoGrupo[0].data, 
                nota_fiscal: [...new Set(avariasDoGrupo.map(a => a.nota_fiscal))].join(' / '), 
                cliente: avariasDoGrupo[0].cliente,
                marca: avariasDoGrupo[0].marca,
                fotos: avariasDoGrupo.flatMap(a => a.fotos) 
            };

            let textoFinal = '';
            if (avariasDoGrupo.length === 1 && avariasDoGrupo[0].observacoes) {
                textoFinal = avariasDoGrupo[0].observacoes;
            } else {
                textoFinal = gerarTextoCombinado(avariasDoGrupo);
            }

            document.getElementById('texto-relatorio').value = textoFinal;
            
            document.getElementById('btn-imprimir-final').onclick = async () => {
                const btn = document.getElementById('btn-imprimir-final');
                const txtOriginal = btn.textContent;
                btn.textContent = "Salvando...";
                btn.disabled = true;

                const textoEditado = document.getElementById('texto-relatorio').value;
                
                for (const idAvaria of ids) {
                    try {
                        await fetch(`/api/avarias/${idAvaria}`, {
                            method: 'PUT',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ observacoes: textoEditado })
                        });
                    } catch(e) {
                        console.error(`Erro ao salvar texto na avaria ${idAvaria}`, e);
                    }
                }
                
                btn.textContent = txtOriginal;
                btn.disabled = false;

                const radios = document.getElementsByName('tipo_imp');
                let tipoImp = 'completo';
                for(let r of radios) { if(r.checked) tipoImp = r.value; }

                imprimirPagina(textoEditado, dadosCombinados, tipoImp);
            };
            
            document.getElementById('modal-relatorio').style.display = 'block';

        } catch (e) { console.error("Erro ao gerar relatório agrupado:", e); }
    };

    window.abrirRelatorio = (id) => {
        window.abrirRelatorioAgrupado([id]);
    };

    function imprimirPagina(texto, dados, tipo) {
        let htmlFotos = '';
        let htmlTexto = '';

        if (tipo !== 'fotos') {
            htmlTexto = `
                <div class="info-box">
                    <p><strong>Data:</strong> ${dados.data} | <strong>NF:</strong> ${dados.nota_fiscal}</p>
                    <p><strong>Cliente:</strong> ${dados.cliente}</p>
                    <p><strong>Marca:</strong> ${dados.marca}</p>
                </div>
                <h3>Descrição da Ocorrência</h3>
                <div class="texto-desc">${texto.replace(/\n/g, '<br>')}</div>
                <hr style="margin: 30px 0; border-top: 1px solid #ddd;">
            `;
        }

        if (tipo !== 'resumido' && dados.fotos && dados.fotos.length > 0) {
            htmlFotos += '<h3>Registros Fotográficos</h3><div style="display: flex; flex-wrap: wrap; gap: 10px;">';
            dados.fotos.forEach(foto => {
                htmlFotos += `
                    <div style="text-align: center; margin-bottom: 10px;">
                        <img src="https://lh3.googleusercontent.com/d/${foto.id}" 
                             style="max-width: 80%; max-height: 80%; border: 1px solid #ccc; border-radius: 4px;" 
                             alt="Foto Avaria">
                    </div>`;
            });
            htmlFotos += '</div>';
        } else if (tipo !== 'resumido') {
            htmlFotos = '<p style="color: #666; font-style: italic;">Nenhuma foto registrada.</p>';
        }

        const janela = window.open('', '', 'width=900,height=700');
        janela.document.write(`
            <html><head><title>Relatório - NF ${dados.nota_fiscal}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; }
                h1 { color: #b91c1c; border-bottom: 2px solid #b91c1c; padding-bottom: 10px; }
                .info-box { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                .texto-desc { font-size: 1.1em; line-height: 1.6; padding: 20px; border: 1px dashed #ccc; background: #fff; }
            </style>
            </head><body>
                <h1>Relatório de Avaria de Carga</h1>
                ${htmlTexto}
                ${htmlFotos}
                <div style="margin-top: 50px; text-align: center; font-size: 0.8em; color: #999;">
                    <p>Relatório gerado automaticamente pelo Regina System.</p>
                </div>
            </body></html>
        `);
        janela.document.close();
        setTimeout(() => { janela.print(); }, 1000);
    }

    // --- EXCLUSÃO EM LOTE ---
    window.excluirAvariaLote = async (idsArray) => {
        if(!confirm(`ATENÇÃO: Isso excluirá ${idsArray.length} registro(s) e fotos.\nTem certeza?`)) return;
        
        for(let id of idsArray) {
            try {
                await fetch(`/api/avarias/${id}`, { method: 'DELETE' });
            } catch(e) { console.error(e); }
        }
        alert('Registros excluídos.');
        carregarListaAvarias();
    };

    document.querySelectorAll('.fechar-modal').forEach(span => {
        span.onclick = function() { this.parentElement.parentElement.style.display = 'none'; }
    });
    const btnVoltar = document.getElementById('btn-voltar-lista');
    if(btnVoltar) btnVoltar.onclick = () => window.location.href = '/avarias.html';
});