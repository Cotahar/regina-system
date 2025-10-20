document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-consulta');
    const tabelaCorpo = document.getElementById('tabela-resultados-corpo');
    const mensagemDiv = document.getElementById('mensagem-busca');
    const paginacaoContainer = document.getElementById('paginacao-container');
    const modalDetalhes = document.getElementById('modal-detalhes-carga');
    const modalEditarEntrega = document.getElementById('modal-editar-entrega');
    const detalhesConteudo = document.getElementById('detalhes-conteudo');
    
    let cargaAtual = null;
    let listaDeClientes = [];
    let sessaoUsuario = null;

    // --- FUNÇÕES DE FORMATAÇÃO ---
    const formatarMoeda = (v) => (v === null || v === undefined) ? 'R$ 0,00' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const formatarPeso = (v) => (v === null || v === undefined || v == 0) ? '0,00 kg' : `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} kg`;
    const formatarData = (d) => d ? new Date(d).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'N/A';
    const formatarDataParaInput = (d) => d ? d.split('T')[0] : '';
    const getHojeFormatado = () => new Date().toISOString().split('T')[0];

    // NOVA FUNÇÃO para converter texto "1.234,56" para número 1234.56
    const parseDecimal = (valor) => {
        if (typeof valor !== 'string' || !valor) return null;
        return parseFloat(valor.replace(/\./g, '').replace(',', '.'));
    };

    // NOVA FUNÇÃO para formatar campos de peso/valor
    const mascaraDecimal = (input) => {
        if (!input) return;
        const formatValue = (value) => {
            value = value.replace(/\D/g, '');
            if (value === '') return '';
            
            // Converte para número, divide por 100 para ter 2 casas decimais
            let num = parseFloat(value) / 100;
            
            // Formata para o padrão brasileiro (ex: 1.234,56)
            return new Intl.NumberFormat('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(num);
        };
        
        input.addEventListener('input', (e) => {
            e.target.value = formatValue(e.target.value);
        });
    };
    
    // --- LÓGICA DE MODAIS ---
	const fecharModais = () => {
        modalDetalhes.style.display = 'none';
        modalEditarEntrega.style.display = 'none';
    };
    document.querySelectorAll('.fechar-modal').forEach(btn => btn.addEventListener('click', fecharModais));
    
    // CORREÇÃO: Lógica do ESC para fechar um modal por vez
    document.addEventListener('keydown', (event) => {
        if (event.key === "Escape") {
            if (modalEditarEntrega.style.display === 'block') {
                modalEditarEntrega.style.display = 'none';
            } else if (modalDetalhes.style.display === 'block') {
                modalDetalhes.style.display = 'none';
            }
        }
    });

    // --- LÓGICA PRINCIPAL ---
    const buscarCargas = async (page = 1) => {
        const params = new URLSearchParams();
        params.append('page', page);
        const codigo = document.getElementById('filtro-codigo').value;
        const motorista = document.getElementById('filtro-motorista').value;
        const origem = document.getElementById('filtro-origem').value;
        const status = document.getElementById('filtro-status').value;
        const dataInicio = document.getElementById('filtro-data-inicio').value;
        const dataFim = document.getElementById('filtro-data-fim').value;
        if (codigo) params.append('codigo_carga', codigo);
        if (motorista) params.append('motorista', motorista);
        if (origem) params.append('origem', origem);
        if (status) params.append('status', status);
        if (dataInicio && dataFim) {
            params.append('data_inicio', dataInicio);
            params.append('data_fim', dataFim);
        }
        mensagemDiv.textContent = 'Buscando...';
        tabelaCorpo.innerHTML = '<tr><td colspan="7">Buscando...</td></tr>';
        paginacaoContainer.innerHTML = '';
        try {
            const response = await fetch(`/api/cargas/consulta?${params.toString()}`);
            if (!response.ok) throw new Error('Falha na busca.');
            const { cargas, total_paginas, pagina_atual, total_resultados } = await response.json();
            
            mensagemDiv.textContent = `${total_resultados} resultado(s) encontrado(s).`;
            if (cargas.length === 0 && pagina_atual === 1) {
                tabelaCorpo.innerHTML = '<tr><td colspan="7">Nenhuma carga encontrada com os filtros informados.</td></tr>';
                return;
            }
            tabelaCorpo.innerHTML = '';
            cargas.forEach(carga => {
                const tr = document.createElement('tr');
                tr.dataset.id = carga.id;
                tr.style.cursor = 'pointer';
                tr.innerHTML = `
                    <td>${carga.codigo_carga}</td>
                    <td>${carga.status}</td>
                    <td>${carga.origem}</td>
                    <td>${carga.motorista || 'N/A'}</td>
                    <td>${carga.num_entregas}</td>
                    <td>${formatarPeso(carga.peso_total)}</td>
                    <td>${formatarData(carga.data_finalizacao)}</td>
                `;
                tabelaCorpo.appendChild(tr);
            });
            renderizarPaginacao(total_paginas, pagina_atual);
        } catch (error) {
            mensagemDiv.textContent = 'Erro ao realizar a busca.';
            console.error('Erro na busca:', error);
            tabelaCorpo.innerHTML = '<tr><td colspan="7">Ocorreu um erro ao buscar os dados.</td></tr>';
        }
    };
    
    const renderizarPaginacao = (totalPaginas, paginaAtual) => {
        if (totalPaginas <= 1) { paginacaoContainer.innerHTML = ''; return; }
        let paginasHtml = '';
        for (let i = 1; i <= totalPaginas; i++) {
            paginasHtml += `<button class="btn-paginacao ${i === paginaAtual ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        paginacaoContainer.innerHTML = paginasHtml;
        document.querySelectorAll('.btn-paginacao').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(e.target.dataset.page);
                buscarCargas(page);
            });
        });
    };

    async function abrirModalDetalhes(id) {
        try {
            const response = await fetch(`/api/cargas/${id}`);
            if (!response.ok) throw new Error('Carga não encontrada');
            cargaAtual = await response.json();
            renderizarModalDetalhes();
            modalDetalhes.style.display = 'block';
        } catch (error) {
            console.error("Erro ao buscar detalhes:", error);
            alert("Não foi possível carregar os detalhes.");
        }
    }
    
    function renderizarModalDetalhes() {
        const { detalhes_carga, entregas } = cargaAtual;
        const statusClass = detalhes_carga.status.toLowerCase().replace(/\s+/g, '-');
        const podeEditarGeral = ['admin', 'operador'].includes(sessaoUsuario.user_permission);
        const podeEditarEntregas = podeEditarGeral && ['Pendente', 'Agendada'].includes(detalhes_carga.status);
        const pesoTotal = entregas.reduce((acc, e) => acc + (e.peso_bruto || 0), 0);
        const freteTotal = entregas.reduce((acc, e) => acc + (e.valor_frete || 0), 0);
        let secaoDados, secaoAcoes;

        if (detalhes_carga.status === 'Pendente') {
            secaoDados = `<div class="detalhes-secao"><h4>Dados da Viagem</h4><div class="detalhes-form-grid-4"><div class="campo-form"><label>Origem</label><input type="text" id="detalhe-origem" value="${detalhes_carga.origem || ''}"></div><div class="campo-form"><label>Peso Total</label><p>${formatarPeso(pesoTotal)}</p></div><div class="campo-form"><label>Frete Total</label><p>${formatarMoeda(freteTotal)}</p></div><div class="campo-form"><label>Qtd. Entregas</label><p>${entregas.length}</p></div></div></div>`;
            secaoAcoes = `<div class="detalhes-secao"><h4>Ações de Status</h4><div class="form-acao-agendar"><label for="detalhe-agendamento">Data do Agendamento:</label><input type="date" id="detalhe-agendamento" value="${formatarDataParaInput(detalhes_carga.data_agendamento)}"><button class="btn-acao" data-acao="agendar">Agendar Carga</button><button class="btn-acao-verde" data-acao="salvar">Salvar Alterações</button></div></div>`;
        } else if (detalhes_carga.status === 'Agendada') {
            secaoDados = `<div class="detalhes-secao"><h4>Dados da Viagem</h4><div class="detalhes-form-grid-4"><div class="campo-form"><label>Origem</label><p>${detalhes_carga.origem || ''}</p></div><div class="campo-form"><label>Peso Total</label><p>${formatarPeso(pesoTotal)}</p></div><div class="campo-form"><label>Frete Total</label><p>${formatarMoeda(freteTotal)}</p></div><div class="campo-form"><label>Qtd. Entregas</label><p>${entregas.length}</p></div><div class="campo-form"><label for="detalhe-motorista">Motorista</label><input type="text" id="detalhe-motorista" value="${detalhes_carga.motorista || ''}"></div><div class="campo-form"><label for="detalhe-placa">Placa</label><input type="text" id="detalhe-placa" value="${detalhes_carga.placa || ''}" maxlength="7"></div></div></div>`;
            secaoAcoes = `<div class="detalhes-secao"><h4>Ações de Status</h4><div class="form-acao"><div class="campo-form"><label>Agendamento</label><p>${formatarData(detalhes_carga.data_agendamento)}</p></div><div class="campo-form"><label for="detalhe-carregamento">Carregamento</label><input type="date" id="detalhe-carregamento" value="${formatarDataParaInput(detalhes_carga.data_carregamento) || getHojeFormatado()}"></div><div class="campo-form"><label for="detalhe-previsao">Previsão Entrega</label><input type="date" id="detalhe-previsao" value="${formatarDataParaInput(detalhes_carga.previsao_entrega)}"></div></div><div class="acoes-container"><button class="btn-acao" data-acao="iniciar-transito">Iniciar Trânsito</button><button class="btn-acao-secundario" data-acao="cancelar-agendamento">Cancelar Agendamento</button><button class="btn-acao-verde" data-acao="salvar">Salvar Alterações</button></div></div>`;
        } else if (detalhes_carga.status === 'Em Trânsito') {
            secaoDados = `<div class="detalhes-secao"><h4>Dados da Viagem</h4><div class="detalhes-form-grid-4"><div class="campo-form"><label>Origem</label><p>${detalhes_carga.origem || ''}</p></div><div class="campo-form"><label>Peso Total</label><p>${formatarPeso(pesoTotal)}</p></div><div class="campo-form"><label>Frete Total</label><p>${formatarMoeda(freteTotal)}</p></div><div class="campo-form"><label>Qtd. Entregas</label><p>${entregas.length}</p></div><div class="campo-form"><label>Motorista</label><p>${detalhes_carga.motorista || ''}</p></div><div class="campo-form"><label>Placa</label><p>${detalhes_carga.placa || ''}</p></div><div class="campo-form"><label>Carregamento</label><p>${formatarData(detalhes_carga.data_carregamento)}</p></div><div class="campo-form"><label>Previsão Entrega</label><input type="date" id="detalhe-previsao" value="${formatarDataParaInput(detalhes_carga.previsao_entrega)}"></div></div></div>`;
            secaoAcoes = `<div class="detalhes-secao"><h4>Ações de Status</h4><div class="acoes-container"><button class="btn-acao-finalizar" data-acao="finalizar">Finalizar Carga</button><button class="btn-acao-verde" data-acao="salvar">Salvar Alterações</button></div></div>`;
        } else { // Finalizada
            secaoDados = `<div class="detalhes-secao"><h4>Dados da Viagem</h4><div class="detalhes-form-grid-4"><div class="campo-form"><label>Origem</label><p>${detalhes_carga.origem || ''}</p></div><div class="campo-form"><label>Peso Total</label><p>${formatarPeso(pesoTotal)}</p></div><div class="campo-form"><label>Frete Total</label><p>${formatarMoeda(freteTotal)}</p></div><div class="campo-form"><label>Qtd. Entregas</label><p>${entregas.length}</p></div></div></div>`;
            secaoAcoes = '';
        }

        detalhesConteudo.innerHTML = `
            <div id="detalhes-header"><h2>${detalhes_carga.codigo_carga}</h2><span class="status-${statusClass}">${detalhes_carga.status}</span></div>
            <div class="modal-body-grid">
                ${secaoDados}
                <div class="detalhes-secao secao-full-width"><h4>Observações da Viagem</h4><div class="form-acao"><textarea id="obs-carga" rows="4" ${!podeEditarGeral ? 'disabled' : ''}>${detalhes_carga.observacoes || ''}</textarea></div></div>
                ${podeEditarGeral ? secaoAcoes : ''}
            </div>
            <div class="detalhes-secao" id="detalhes-entregas">
                <div class="entregas-header"><h3>Entregas (${entregas.length})</h3>${podeEditarEntregas ? '<button id="btn-add-entrega" class="btn-acao">+ Adicionar Entrega</button>' : ''}</div>
                <div id="form-add-entrega-container"></div>
                <div class="tabela-wrapper"><table id="tabela-entregas"><thead><tr><th>Cliente</th><th>Cidade/UF</th><th>Peso</th><th>Frete</th><th>Telefone</th><th>Observações</th>${podeEditarGeral ? '<th>Ações</th>': ''}</tr></thead><tbody id="tabela-entregas-corpo"></tbody></table></div>
            </div>`;
        
        const tabelaCorpoEntregas = document.getElementById('tabela-entregas-corpo');
        tabelaCorpoEntregas.innerHTML = entregas.length > 0 ? entregas.map(e => `
            <tr>
                <td>${e.razao_social}</td>
                <td>${e.cidade}-${e.estado}</td>
                <td>${formatarPeso(e.peso_bruto)}</td>
                <td>${formatarMoeda(e.valor_frete)}</td>
                <td>(${e.ddd||''}) ${e.telefone||''}</td>
                <td title="${e.obs_cliente || ''}">${(e.obs_cliente || 'Nenhuma').substring(0, 20)}</td>
                ${podeEditarGeral ? `
                <td>
                    ${podeEditarEntregas ? `
                    <button class="btn-editar btn-editar-entrega" data-id="${e.id}">Editar</button>
                    <button class="btn-excluir-entrega" data-id="${e.id}">Excluir</button>
                    ` : 'N/A'}
                </td>` : ''}
            </tr>
        `).join('') : `<tr><td colspan="${podeEditarGeral ? 7:6}">Nenhuma entrega.</td></tr>`;
        
        configurarEventListenersDeAcoes();
    }
    
    function configurarEventListenersDeAcoes() {
        document.querySelector('[data-acao="salvar"]')?.addEventListener('click', handleSalvarAlteracoes);
        document.querySelector('[data-acao="agendar"]')?.addEventListener('click', handleAgendar);
        document.querySelector('[data-acao="iniciar-transito"]')?.addEventListener('click', handleIniciarTransito);
        document.querySelector('[data-acao="cancelar-agendamento"]')?.addEventListener('click', handleCancelarAgendamento);
        document.querySelector('[data-acao="finalizar"]')?.addEventListener('click', handleFinalizarCarga);
        document.getElementById('btn-add-entrega')?.addEventListener('click', (e) => {
            e.target.style.display = 'none';
            const container = document.getElementById('form-add-entrega-container');
            container.innerHTML = `<form id="form-nova-entrega" class="form-acao"><select id="select-cliente" style="width: 250px;"></select><input type="text" id="entrega-peso-bruto" placeholder="Peso Bruto *" inputmode="decimal" required><input type="text" id="entrega-valor-frete" placeholder="Valor Frete" inputmode="decimal"><input type="text" id="entrega-peso-cobrado" placeholder="Peso Cobrado" inputmode="decimal"><button type="submit">Salvar</button></form>`;
            $('#select-cliente').select2({ placeholder: 'Selecione um cliente', dropdownParent: $('#form-add-entrega-container'), data: listaDeClientes.map(c => ({ id: c.id, text: `${c.razao_social} (${c.cidade})` })) });
            document.getElementById('form-nova-entrega').addEventListener('submit', salvarNovaEntrega);
            
            // Aplicando máscaras
            mascaraDecimal(document.getElementById('entrega-peso-bruto'));
            mascaraDecimal(document.getElementById('entrega-valor-frete'));
            mascaraDecimal(document.getElementById('entrega-peso-cobrado'));
        });
        document.querySelectorAll('.btn-excluir-entrega').forEach(btn => btn.addEventListener('click', (e) => {
            if(confirm('Tem certeza que deseja excluir esta entrega?')) handleExcluirEntrega(e.target.dataset.id);
        }));
        
        document.querySelectorAll('.btn-editar-entrega').forEach(btn => btn.addEventListener('click', (e) => {
            const entregaId = e.target.dataset.id;
            const entrega = cargaAtual.entregas.find(ent => ent.id == entregaId);
            
            document.getElementById('edit-entrega-id').value = entrega.id;
            document.getElementById('edit-peso-bruto').value = formatarPeso(entrega.peso_bruto).replace(' kg','');
            document.getElementById('edit-valor-frete').value = formatarMoeda(entrega.valor_frete).replace('R$ ','');
            document.getElementById('edit-peso-cobrado').value = formatarPeso(entrega.peso_cobrado).replace(' kg','');
            
            // Aplicando máscaras
            mascaraDecimal(document.getElementById('edit-peso-bruto'));
            mascaraDecimal(document.getElementById('edit-valor-frete'));
            mascaraDecimal(document.getElementById('edit-peso-cobrado'));

            modalEditarEntrega.style.display = 'block';
        }));
    }

    async function handleExcluirEntrega(entregaId) {
        const response = await fetch(`/api/cargas/${cargaAtual.detalhes_carga.id}/entregas`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entrega_id: entregaId })
        });
        if (response.ok) {
            await abrirModalDetalhes(cargaAtual.detalhes_carga.id);
            buscarCargas(document.querySelector('.btn-paginacao.active')?.dataset.page || 1);
        } else { alert('Erro ao excluir entrega.'); }
    }
    
    async function salvarNovaEntrega(e) {
        e.preventDefault();
        const dados = {
            cliente_id: $('#select-cliente').val(),
            peso_bruto: parseDecimal(document.getElementById('entrega-peso-bruto').value),
            valor_frete: parseDecimal(document.getElementById('entrega-valor-frete').value),
            peso_cobrado: parseDecimal(document.getElementById('entrega-peso-cobrado').value)
        };
        if(!dados.cliente_id || !dados.peso_bruto) { alert("Cliente e Peso Bruto são obrigatórios."); return; }
        const response = await fetch(`/api/cargas/${cargaAtual.detalhes_carga.id}/entregas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if (response.ok) {
            await abrirModalDetalhes(cargaAtual.detalhes_carga.id);
            buscarCargas(document.querySelector('.btn-paginacao.active')?.dataset.page || 1);
        } else { alert('Erro ao salvar entrega.'); }
    }
    
    document.getElementById('form-editar-entrega').addEventListener('submit', async (e) => {
        e.preventDefault();
        const entregaId = document.getElementById('edit-entrega-id').value;
        const dados = {
            peso_bruto: parseDecimal(document.getElementById('edit-peso-bruto').value),
            valor_frete: parseDecimal(document.getElementById('edit-valor-frete').value),
            peso_cobrado: parseDecimal(document.getElementById('edit-peso-cobrado').value)
        };

        if (!dados.peso_bruto || dados.peso_bruto <= 0) {
            alert('Peso bruto é obrigatório e deve ser maior que zero.');
            return;
        }

        try {
            const response = await fetch(`/api/entregas/${entregaId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            const resultado = await response.json();
            if (!response.ok) throw new Error(resultado.error || 'Falha ao atualizar entrega.');
            
            fecharModais();
            await abrirModalDetalhes(cargaAtual.detalhes_carga.id);
            buscarCargas(document.querySelector('.btn-paginacao.active')?.dataset.page || 1);
        } catch (error) {
            alert(`Erro: ${error.message}`);
        }
    });

    async function handleFinalizarCarga() {
        const senha = prompt("Para finalizar a carga, insira sua senha de usuário:");
        if (senha === null) return;
        const response = await fetch('/api/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: senha })
        });
        if (response.ok) {
            enviarAtualizacaoStatus({ status: 'Finalizada', data_finalizacao: getHojeFormatado() });
        } else { alert("Senha incorreta!"); }
    }
    
    async function handleCancelarAgendamento() {
        if (!confirm('Tem certeza? A carga voltará para "Pendentes".')) return;
        enviarAtualizacaoStatus({ status: 'Pendente', data_agendamento: null });
    }
    
    function handleAgendar() {
        const dataAgendamento = document.getElementById('detalhe-agendamento').value;
        if (!dataAgendamento) { alert('A data de agendamento é obrigatória.'); return; }
        enviarAtualizacaoStatus({ status: 'Agendada', data_agendamento: dataAgendamento });
    }
    
    function handleIniciarTransito() {
        const motorista = document.getElementById('detalhe-motorista').value;
        const placa = document.getElementById('detalhe-placa').value;
        const dataCarregamento = document.getElementById('detalhe-carregamento').value;
        if (!motorista || !placa || !dataCarregamento) { alert('Motorista, Placa e Data de Carregamento são obrigatórios.'); return; }
        enviarAtualizacaoStatus({ status: 'Em Trânsito', motorista, placa, data_carregamento: dataCarregamento });
    }

    function handleSalvarAlteracoes() {
        const { detalhes_carga } = cargaAtual;
        let dados = { observacoes: document.getElementById('obs-carga').value };
        if(detalhes_carga.status === 'Pendente') {
            dados.origem = document.getElementById('detalhe-origem').value;
            dados.data_agendamento = document.getElementById('detalhe-agendamento').value || null;
        } else if (detalhes_carga.status === 'Agendada') {
            dados.motorista = document.getElementById('detalhe-motorista').value;
            dados.placa = document.getElementById('detalhe-placa').value;
            dados.data_carregamento = document.getElementById('detalhe-carregamento').value || null;
            dados.previsao_entrega = document.getElementById('detalhe-previsao').value || null;
        } else if (detalhes_carga.status === 'Em Trânsito') {
            dados.previsao_entrega = document.getElementById('detalhe-previsao').value || null;
        }
        enviarAtualizacaoStatus(dados);
    }
    
    async function enviarAtualizacaoStatus(dados) {
        try {
            const response = await fetch(`/api/cargas/${cargaAtual.detalhes_carga.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Falha ao atualizar'); }
            fecharModais();
            const paginaAtual = document.querySelector('.btn-paginacao.active')?.dataset.page || 1;
            buscarCargas(paginaAtual);
        } catch (error) {
            alert(`Não foi possível completar a ação: ${error.message}`);
        }
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        buscarCargas(1);
    });

    form.addEventListener('reset', () => {
        form.reset();
        tabelaCorpo.innerHTML = '<tr><td colspan="7">Utilize os filtros acima para buscar as cargas.</td></tr>';
        paginacaoContainer.innerHTML = '';
        mensagemDiv.textContent = '';
    });

    tabelaCorpo.addEventListener('click', (event) => {
        const linha = event.target.closest('tr');
        if (linha && linha.dataset.id) {
            abrirModalDetalhes(linha.dataset.id);
        }
    });
    
    async function carregarDadosIniciais() {
        try {
            const [sessionRes, clientesRes] = await Promise.all([
                fetch('/api/session'),
                fetch('/api/clientes')
            ]);
            if (!sessionRes.ok) { window.location.href = '/login.html'; return; }
            sessaoUsuario = await sessionRes.json();
            listaDeClientes = await clientesRes.json();
            // Inicia sem busca automática
            tabelaCorpo.innerHTML = '<tr><td colspan="7">Utilize os filtros acima para buscar as cargas.</td></tr>';
        } catch (error) {
            console.error("Erro ao carregar dados iniciais da consulta:", error);
        }
    }
    
    carregarDadosIniciais();
});