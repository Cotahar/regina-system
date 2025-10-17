document.addEventListener('DOMContentLoaded', () => {
    const painelContainer = document.querySelector('.container');
    const modalNovaCarga = document.getElementById('modal-nova-carga');
    const modalDetalhes = document.getElementById('modal-detalhes-carga');
    const modalEditarEntrega = document.getElementById('modal-editar-entrega');
    const detalhesConteudo = document.getElementById('detalhes-conteudo');
    let listaDeClientes = [];
    let cargaAtual = null;
    let sessaoUsuario = null;

    const formatarMoeda = (v) => (v === null || v === undefined) ? 'R$ 0,00' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const formatarPeso = (v) => (v === null || v === undefined || v == 0) ? '0,00 kg' : `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} kg`;
    const formatarData = (d) => d ? new Date(d).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'N/A';
    const formatarDataParaInput = (d) => d ? d.split('T')[0] : '';
    const getHojeFormatado = () => new Date().toISOString().split('T')[0];
    const mascaraDecimal = (input) => {
        if (!input) return;
        input.addEventListener('input', () => {
            input.value = input.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
        });
    };

    const fecharModais = () => {
        modalNovaCarga.style.display = 'none';
        modalDetalhes.style.display = 'none';
        modalEditarEntrega.style.display = 'none';
    };
    document.querySelectorAll('.fechar-modal').forEach(btn => btn.addEventListener('click', fecharModais));
    document.addEventListener('keydown', (event) => { if (event.key === "Escape") fecharModais(); });

    document.getElementById('nova-carga-btn').addEventListener('click', () => modalNovaCarga.style.display = 'block');

    async function carregarDadosIniciais() {
        try {
            const [sessionRes, clientesRes, cargasRes] = await Promise.all([
                fetch('/api/session'),
                fetch('/api/clientes'),
                fetch('/api/cargas')
            ]);
            if (!sessionRes.ok) { window.location.href = '/login.html'; return; }
            sessaoUsuario = await sessionRes.json();
            if (sessaoUsuario.user_permission === 'admin') {
                document.getElementById('nav-admin').innerHTML = `<a href="/usuarios.html" class="btn-navegacao">Gerenciar Usuários</a>`;
            }
            listaDeClientes = await clientesRes.json();
            const cargas = await cargasRes.json();
            document.querySelectorAll('.lista-cargas').forEach(lista => lista.innerHTML = '');
            cargas.forEach(adicionarCartaoNaTela);
        } catch (error) { console.error("Erro ao carregar dados iniciais:", error); }
    }

    function adicionarCartaoNaTela(carga) {
        const cartao = document.createElement('div');
        cartao.className = 'cartao-carga';
        cartao.dataset.id = carga.id;
        let conteudoCartao = `<h3>${carga.codigo_carga}</h3><ul>`;
        if (carga.status === 'Agendada') {
            conteudoCartao += `<li><strong>Agendado para:</strong> ${formatarData(carga.data_agendamento)}</li>`;
        } else if (carga.status === 'Em Trânsito') {
            conteudoCartao += `<li><strong>Motorista:</strong> ${carga.motorista || 'N/A'}</li>`;
        }
        conteudoCartao += `<li><strong>Origem:</strong> ${carga.origem}</li><li><strong>Nº Entregas:</strong> ${carga.num_entregas || 0}</li><li><strong>Peso Total:</strong> ${formatarPeso(carga.peso_total)}</li></ul>`;
        cartao.innerHTML = conteudoCartao;
        const colunaId = carga.status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
        document.getElementById(colunaId)?.appendChild(cartao);
    }

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
        const isFinalizada = detalhes_carga.status === 'Finalizada';
        const podeEditarGeral = !isFinalizada && ['admin', 'operador'].includes(sessaoUsuario.user_permission);
        const podeEditarEntregas = podeEditarGeral && ['Pendente', 'Agendada'].includes(detalhes_carga.status);
        const pesoTotal = entregas.reduce((acc, e) => acc + (e.peso_bruto || 0), 0);
        const freteTotal = entregas.reduce((acc, e) => acc + (e.valor_frete || 0), 0);
        
        let secaoDados, secaoAcoes;

        if (detalhes_carga.status === 'Pendente') {
            secaoDados = `<div class="detalhes-secao"><h4>Dados da Viagem</h4><div class="detalhes-form-grid-4"><div class="campo-form"><label>Origem</label><input type="text" id="detalhe-origem" value="${detalhes_carga.origem || ''}"></div><div class="campo-form"><label>Peso Total</label><p>${formatarPeso(pesoTotal)}</p></div><div class="campo-form"><label>Frete Total</label><p>${formatarMoeda(freteTotal)}</p></div><div class="campo-form"><label>Qtd. Entregas</label><p>${entregas.length}</p></div></div></div>`;
            secaoAcoes = `<div class="detalhes-secao"><h4>Ações de Status</h4><div class="form-acao-agendar"><label for="detalhe-agendamento">Data do Agendamento:</label><input type="date" id="detalhe-agendamento" value="${formatarDataParaInput(detalhes_carga.data_agendamento)}"><button class="btn-acao" data-acao="agendar">Agendar Carga</button><button class="btn-acao-verde" data-acao="salvar">Salvar Alterações</button></div></div>`;
        } else if (detalhes_carga.status === 'Agendada') {
            secaoDados = `<div class="detalhes-secao"><h4>Dados da Viagem</h4><div class="detalhes-form-grid-4"><div class="campo-form"><label>Origem</label><p>${detalhes_carga.origem || ''}</p></div><div class="campo-form"><label>Peso Total</label><p>${formatarPeso(pesoTotal)}</p></div><div class="campo-form"><label>Frete Total</label><p>${formatarMoeda(freteTotal)}</p></div><div class="campo-form"><label>Qtd. Entregas</label><p>${entregas.length}</p></div><div class="campo-form"><label for="detalhe-motorista">Motorista</label><input type="text" id="detalhe-motorista" value="${detalhes_carga.motorista || ''}"></div><div class="campo-form"><label for="detalhe-placa">Placa</label><input type="text" id="detalhe-placa" value="${detalhes_carga.placa || ''}" maxlength="7"></div></div></div>`;
            secaoAcoes = `<div class="detalhes-secao"><h4>Ações de Status</h4><div class="form-acao"><div class="campo-form"><label>Agendamento</label><p>${formatarData(detalhes_carga.data_agendamento)}</p></div><div class="campo-form"><label for="detalhe-carregamento">Carregamento</label><input type="date" id="detalhe-carregamento" value="${formatarDataParaInput(detalhes_carga.data_carregamento || new Date().toISOString())}"></div><div class="campo-form"><label for="detalhe-previsao">Previsão Entrega</label><input type="date" id="detalhe-previsao" value="${formatarDataParaInput(detalhes_carga.previsao_entrega)}"></div></div><div class="acoes-container"><button class="btn-acao" data-acao="iniciar-transito">Iniciar Trânsito</button><button class="btn-acao-secundario" data-acao="cancelar-agendamento">Cancelar Agendamento</button><button class="btn-acao-verde" data-acao="salvar">Salvar Alterações</button></div></div>`;
        } else if (detalhes_carga.status === 'Em Trânsito') {
            secaoDados = `<div class="detalhes-secao"><h4>Dados da Viagem</h4><div class="detalhes-form-grid-4"><div class="campo-form"><label>Origem</label><p>${detalhes_carga.origem || ''}</p></div><div class="campo-form"><label>Peso Total</label><p>${formatarPeso(pesoTotal)}</p></div><div class="campo-form"><label>Frete Total</label><p>${formatarMoeda(freteTotal)}</p></div><div class="campo-form"><label>Qtd. Entregas</label><p>${entregas.length}</p></div><div class="campo-form"><label>Motorista</label><p>${detalhes_carga.motorista || ''}</p></div><div class="campo-form"><label>Placa</label><p>${detalhes_carga.placa || ''}</p></div><div class="campo-form"><label>Carregamento</label><p>${formatarData(detalhes_carga.data_carregamento)}</p></div><div class="campo-form"><label>Previsão Entrega</label><input type="date" id="detalhe-previsao" value="${formatarDataParaInput(detalhes_carga.previsao_entrega)}"></div></div></div>`;
            secaoAcoes = `<div class="detalhes-secao"><h4>Ações de Status</h4><div class="acoes-container"><button class="btn-acao-finalizar" data-acao="finalizar">Finalizar Carga</button><button class="btn-acao-verde" data-acao="salvar">Salvar Alterações</button></div></div>`;
        } else {
            secaoDados = `<div class="detalhes-secao"><h4>Dados da Viagem</h4><div class="detalhes-form-grid-4"><div class="campo-form"><label>Origem</label><p>${detalhes_carga.origem || ''}</p></div><div class="campo-form"><label>Peso Total</label><p>${formatarPeso(pesoTotal)}</p></div><div class="campo-form"><label>Frete Total</label><p>${formatarMoeda(freteTotal)}</p></div><div class="campo-form"><label>Qtd. Entregas</label><p>${entregas.length}</p></div></div></div>`;
            secaoAcoes = '';
        }

        detalhesConteudo.innerHTML = `
            <div id="detalhes-header"><h2>${detalhes_carga.codigo_carga}</h2><span class="status-${statusClass}">${detalhes_carga.status}</span></div>
            <div class="modal-body-grid">
                ${secaoDados}
                <div class="detalhes-secao secao-full-width"><h4>Observações da Viagem</h4><div class="form-acao"><textarea id="obs-carga" rows="4" ${!podeEditarGeral ? 'disabled' : ''}>${detalhes_carga.observacoes || ''}</textarea></div></div>
                ${secaoAcoes}
            </div>
            <div class="detalhes-secao" id="detalhes-entregas">
                <div class="entregas-header"><h3>Entregas (${entregas.length})</h3>${podeEditarEntregas ? '<button id="btn-add-entrega" class="btn-acao">+ Adicionar Entrega</button>' : ''}</div>
                <div id="form-add-entrega-container"></div>
                <div class="tabela-wrapper"><table id="tabela-entregas"><thead><tr><th>Cliente</th><th>Cidade/UF</th><th>Peso</th><th>Telefone</th><th>Observações</th>${podeEditarEntregas ? '<th>Ações</th>': ''}</tr></thead><tbody id="tabela-entregas-corpo"></tbody></table></div>
            </div>`;
        
        const tabelaCorpoEntregas = document.getElementById('tabela-entregas-corpo');
        tabelaCorpoEntregas.innerHTML = entregas.length > 0 ? entregas.map(e => `
            <tr>
                <td>${e.razao_social}</td>
                <td>${e.cidade}-${e.estado}</td>
                <td>${formatarPeso(e.peso_bruto)}</td>
                <td>(${e.ddd||''}) ${e.telefone||''}</td>
                <td title="${e.obs_cliente || ''}">${(e.obs_cliente || 'Nenhuma').substring(0, 20)}</td>
                ${podeEditarEntregas ? `
                <td>
                    <button class="btn-editar btn-editar-entrega" data-id="${e.id}" data-peso="${e.peso_bruto}" data-valor="${e.valor_frete || ''}" data-pesocobrado="${e.peso_cobrado || ''}">Editar</button>
                    <button class="btn-excluir-entrega" data-id="${e.id}">Excluir</button>
                </td>` : ''}
            </tr>
        `).join('') : `<tr><td colspan="${podeEditarEntregas ? 6 : 5}">Nenhuma entrega.</td></tr>`;
        
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
            container.innerHTML = `<form id="form-nova-entrega" class="form-acao"><select id="select-cliente" style="width: 250px;"></select><input type="number" id="entrega-peso-bruto" placeholder="Peso Bruto *" step="0.01" required><input type="number" id="entrega-valor-frete" placeholder="Valor Frete" step="0.01"><input type="number" id="entrega-peso-cobrado" placeholder="Peso Cobrado" step="0.01"><button type="submit">Salvar</button></form>`;
            $('#select-cliente').select2({ placeholder: 'Selecione um cliente', dropdownParent: $('#form-add-entrega-container'), data: listaDeClientes.map(c => ({ id: c.id, text: `${c.razao_social} (${c.cidade})` })) });
            document.getElementById('form-nova-entrega').addEventListener('submit', salvarNovaEntrega);
            
            mascaraDecimal(document.getElementById('entrega-peso-bruto'));
            mascaraDecimal(document.getElementById('entrega-valor-frete'));
            mascaraDecimal(document.getElementById('entrega-peso-cobrado'));
        });
        document.querySelectorAll('.btn-excluir-entrega').forEach(btn => btn.addEventListener('click', (e) => {
            if(confirm('Tem certeza que deseja excluir esta entrega?')) handleExcluirEntrega(e.target.dataset.id);
        }));

        document.querySelectorAll('.btn-editar-entrega').forEach(btn => btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            const peso = e.target.dataset.peso;
            const valor = e.target.dataset.valor;
            const pesoCobrado = e.target.dataset.pesocobrado;

            document.getElementById('edit-entrega-id').value = id;
            document.getElementById('edit-peso-bruto').value = peso;
            document.getElementById('edit-valor-frete').value = valor;
            document.getElementById('edit-peso-cobrado').value = pesoCobrado;
            
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
            await carregarDadosIniciais();
        } else { alert('Erro ao excluir entrega.'); }
    }
    
    async function salvarNovaEntrega(e) {
        e.preventDefault();
        const dados = {
            cliente_id: $('#select-cliente').val(),
            peso_bruto: parseFloat(document.getElementById('entrega-peso-bruto').value),
            valor_frete: parseFloat(document.getElementById('entrega-valor-frete').value) || null,
            peso_cobrado: parseFloat(document.getElementById('entrega-peso-cobrado').value) || null
        };
        if(!dados.cliente_id || isNaN(dados.peso_bruto)) { alert("Cliente e Peso Bruto são obrigatórios."); return; }
        const response = await fetch(`/api/cargas/${cargaAtual.detalhes_carga.id}/entregas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if (response.ok) {
            await abrirModalDetalhes(cargaAtual.detalhes_carga.id);
            await carregarDadosIniciais();
        } else { alert('Erro ao salvar entrega.'); }
    }
    
    document.getElementById('form-editar-entrega').addEventListener('submit', async (e) => {
        e.preventDefault();
        const entregaId = document.getElementById('edit-entrega-id').value;
        const dados = {
            peso_bruto: parseFloat(document.getElementById('edit-peso-bruto').value),
            valor_frete: parseFloat(document.getElementById('edit-valor-frete').value) || null,
            peso_cobrado: parseFloat(document.getElementById('edit-peso-cobrado').value) || null
        };

        if (isNaN(dados.peso_bruto) || dados.peso_bruto <= 0) {
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
            await carregarDadosIniciais();
        } catch (error) {
            alert(`Erro: ${error.message}`);
        }
    });

    mascaraDecimal(document.getElementById('edit-peso-bruto'));
    mascaraDecimal(document.getElementById('edit-valor-frete'));
    mascaraDecimal(document.getElementById('edit-peso-cobrado'));
    
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
            await carregarDadosIniciais();
        } catch (error) {
            alert(`Não foi possível completar a ação: ${error.message}`);
        }
    }

    painelContainer.addEventListener('click', (e) => {
        const cartao = e.target.closest('.cartao-carga');
        if (cartao) abrirModalDetalhes(cartao.dataset.id);
    });
    
    document.getElementById('form-nova-carga').addEventListener('submit', async (e) => {
        e.preventDefault();
        const dados = { origem: document.getElementById('origem').value.toUpperCase() };
        if (!dados.origem) return;
        try {
            const response = await fetch('/api/cargas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            if (!response.ok) throw new Error('Falha ao criar carga');
            const novaCarga = await response.json();
            adicionarCartaoNaTela(novaCarga);
            fecharModais();
            document.getElementById('form-nova-carga').reset();
        } catch (error) { console.error("Erro ao criar carga:", error); }
    });
    
    carregarDadosIniciais();
});