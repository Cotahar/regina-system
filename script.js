/*
* script.js (ATUALIZADO PARA V2 - MÓDULO 4.2 - Edição de Remetente)
*/
document.addEventListener('DOMContentLoaded', () => {
    const painelContainer = document.querySelector('.container');
    const modalNovaCarga = document.getElementById('modal-nova-carga');
    const modalDetalhes = document.getElementById('modal-detalhes-carga');
    const modalEditarEntrega = document.getElementById('modal-editar-entrega');
    const detalhesConteudo = document.getElementById('detalhes-conteudo');

    // ***** INÍCIO DAS ALTERAÇÕES *****
    const selectEditRemetente = $('#edit-remetente-carga'); // Novo seletor
	
	// --- SELETORES DO MÓDULO 6 (LOTE DETALHES) ---
    const modalLoteDet = document.getElementById('modal-lote-detalhes');
    const formLoteDet = document.getElementById('form-lote-detalhes');
    const selectRemetenteLoteDet = $('#select-remetente-lote-detalhes');
    const spanQtdLoteDet = document.getElementById('qtd-lote-detalhes');
    const msgLoteDet = document.getElementById('msg-lote-detalhes');
    const btnFecharLoteDet = document.getElementById('fechar-modal-lote-detalhes');
	let selecaoDetalhesAtiva = false;
	
    let listaDeClientes = []; // Todos os clientes
    let listaDeMotoristas = [];
    let listaDeVeiculos = [];
    let listaDeRemetentesSelect2 = []; // Apenas clientes marcados como remetente
    // ***** FIM DAS ALTERAÇÕES *****

    let cargaAtual = null;
    let sessaoUsuario = null;

    // --- FUNÇÕES DE FORMATAÇÃO ---
    const formatarMoeda = (v) => (v === null || v === undefined) ? 'R$ 0,00' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const formatarPeso = (v) => (v === null || v === undefined || v == 0) ? '0,00 kg' : `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} kg`;
    const formatarData = (d) => d ? new Date(d).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'N/A';
    const formatarDataParaInput = (d) => d ? d.split('T')[0] : '';
    const getHojeFormatado = () => new Date().toISOString().split('T')[0];

    const parseDecimal = (valor) => {
        if (typeof valor !== 'string' || !valor) return null;
        const valorLimpo = valor.replace('R$ ', '').replace(/\./g, '').replace(',', '.');
        const numero = parseFloat(valorLimpo);
        return isNaN(numero) ? null : numero;
    };

const mascaraDecimal = (input) => {
        if (!input) return;

        // Evento 1: Ao digitar (input)
        input.addEventListener('input', (e) => {
            let v = e.target.value;
            // Permite apenas dígitos e UMA vírgula
            v = v.replace(/[^\d,]/g, ''); 
            const parts = v.split(',');
            if (parts.length > 2) {
                v = parts[0] + ',' + parts.slice(1).join('');
            }
            // Limita o decimal a 2 casas
            if (parts.length === 2 && parts[1].length > 2) {
                v = parts[0] + ',' + parts[1].substring(0, 2);
            }
            // Adiciona pontos de milhar na parte inteira
            parts[0] = new Intl.NumberFormat('pt-BR').format(parseInt(parts[0].replace(/\D/g, ''), 10) || 0);
            
            e.target.value = parts.length > 1 ? parts.join(',') : parts[0];
        });

        // Evento 2: Ao sair (blur) - Formata para ,00 (como você sugeriu)
        input.addEventListener('blur', (e) => {
            let v = e.target.value;
            if (v === '') return;
            
            // Usa a função parseDecimal que já existe
            let num = parseDecimal(v); // (Ex: "23.000,3" -> 23000.3)
            if (num === null) num = 0;
            
            // Formata (ex: 23000.3 -> "23.000,30" / 23000 -> "23.000,00")
            e.target.value = new Intl.NumberFormat('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(num);
        });
    };
	const calcularFretePorTonelada = (pesoInput, tonInput, freteInput) => {
    const pesoBruto = parseDecimal(pesoInput.value) || 0;
    const valorTon = parseDecimal(tonInput.value) || 0;

		if (pesoBruto > 0 && valorTon > 0) {
			const freteCalculado = (pesoBruto / 1000) * valorTon;
			freteInput.value = new Intl.NumberFormat('pt-BR', {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			}).format(freteCalculado);
		}
	};
    // --- LÓGICA DE MODAIS ---
    const fecharModais = () => {
        modalNovaCarga.style.display = 'none';
        modalDetalhes.style.display = 'none';
        modalEditarEntrega.style.display = 'none';
    };

    document.getElementById('fechar-modal-nova-carga')?.addEventListener('click', () => modalNovaCarga.style.display = 'none');
    document.getElementById('fechar-modal-detalhes')?.addEventListener('click', () => modalDetalhes.style.display = 'none');
    document.getElementById('fechar-modal-editar-entrega')?.addEventListener('click', () => modalEditarEntrega.style.display = 'none');

    document.addEventListener('keydown', (event) => {
        if (event.key === "Escape") {
            if (modalEditarEntrega.style.display === 'block') {
                modalEditarEntrega.style.display = 'none';
            } else if (modalDetalhes.style.display === 'block') {
                modalDetalhes.style.display = 'none';
            } else if (modalNovaCarga.style.display === 'block') {
                modalNovaCarga.style.display = 'none';
            }
        }
    });

    document.getElementById('nova-carga-btn').addEventListener('click', () => modalNovaCarga.style.display = 'block');

    // --- LÓGICA PRINCIPAL ---
    
// ***** FUNÇÃO ALTERADA (PARA ORDENAÇÃO) *****
    async function carregarDadosIniciais() {
        try {
            const [sessionRes, clientesRes, motoristasRes, veiculosRes, cargasRes] = await Promise.all([
                fetch('/api/session'),
                fetch('/api/clientes'), // API já envia 'is_remetente'
                fetch('/api/motoristas'),
                fetch('/api/veiculos'),
                fetch('/api/cargas')
            ]);
            if (!sessionRes.ok) { window.location.href = '/login.html'; return; }
            sessaoUsuario = await sessionRes.json();
            
            // Lógica do Menu Dropdown (CORRIGIDO)
            if (sessaoUsuario.user_permission === 'admin') {
                const navAdmin = document.getElementById('nav-admin-dropdown'); // Busca no dropdown
                if(navAdmin) {
                    navAdmin.innerHTML = `<a href="/usuarios.html">Usuários</a>`; // Insere link
                }
            }
            
            listaDeClientes = await clientesRes.json(); // Lista completa para V1
            listaDeMotoristas = await motoristasRes.json();
            listaDeVeiculos = await veiculosRes.json();

            // Filtra e armazena a lista de remetentes para os modais de edição
            listaDeRemetentesSelect2 = listaDeClientes
                .filter(c => c.is_remetente === true)
                .map(c => ({ id: c.id, text: c.text }));

            // Inicializa o dropdown escondido do modal de edição (V2.1)
            selectEditRemetente.select2({
                placeholder: 'Selecione um remetente',
                data: listaDeRemetentesSelect2,
                dropdownParent: $('#modal-editar-entrega') // Anexa ao modal correto
            });
            selectRemetenteLoteDet.select2({
                placeholder: 'Selecione o Novo Remetente',
                data: listaDeRemetentesSelect2,
                dropdownParent: $('#modal-lote-detalhes')
            });
            const cargas = await cargasRes.json();
            document.querySelectorAll('.lista-cargas').forEach(lista => lista.innerHTML = '');
            
            // --- INÍCIO DA LÓGICA DE ORDENAÇÃO ---
            
            // 1. Separa as cargas por status
            const pendentes = cargas.filter(c => c.status === 'Pendente');
            const agendadas = cargas.filter(c => c.status === 'Agendada');
            const emTransito = cargas.filter(c => c.status === 'Em Trânsito');

            // 2. Ordena as listas
            
            // Pendentes: Pela ID (mais nova primeiro)
            pendentes.sort((a, b) => b.id - a.id);

            // Agendadas: Pela data de agendamento (mais próxima primeiro)
            agendadas.sort((a, b) => {
                // Joga datas nulas para o fim da lista
                const dataA = a.data_agendamento ? new Date(a.data_agendamento) : new Date('9999-12-31');
                const dataB = b.data_agendamento ? new Date(b.data_agendamento) : new Date('9999-12-31');
                return dataA - dataB;
            });

            // Em Trânsito: Pela previsão de entrega (mais próxima primeiro)
            emTransito.sort((a, b) => {
                // Joga datas nulas para o fim da lista
                const dataA = a.previsao_entrega ? new Date(a.previsao_entrega) : new Date('9999-12-31');
                const dataB = b.previsao_entrega ? new Date(b.previsao_entrega) : new Date('9999-12-31');
                return dataA - dataB;
            });

            // 3. Renderiza as cargas já ordenadas
            pendentes.forEach(adicionarCartaoNaTela);
            agendadas.forEach(adicionarCartaoNaTela);
            emTransito.forEach(adicionarCartaoNaTela);
            
            // --- FIM DA LÓGICA DE ORDENAÇÃO ---
            $(document).on('select2:open', () => {
				document.querySelector('.select2-search__field').focus();
			});
			
        } catch (error) { console.error("Erro ao carregar dados iniciais:", error); }
    }
    // ***** FIM DA ALTERAÇÃO *****

    function adicionarCartaoNaTela(carga) {
        const cartao = document.createElement('div');
        cartao.className = 'cartao-carga';
        cartao.dataset.id = carga.id;

        let dataExtraHtml = '';
        if (carga.status === 'Agendada' && carga.data_agendamento) {
            dataExtraHtml = `<span class="cartao-data">Ag: ${formatarData(carga.data_agendamento)}</span>`;
        } else if (carga.status === 'Em Trânsito' && carga.previsao_entrega) {
            dataExtraHtml = `<span class="cartao-data">Prev: ${formatarData(carga.previsao_entrega)}</span>`;
        }

        const cabecalhoCartao = `<div class="cartao-header"><h3>${carga.codigo_carga}</h3>${dataExtraHtml}</div>`;

        let listaInfo = '<ul>';
        listaInfo += `<li><strong>Origem:</strong> ${carga.origem}</li>`;

		if (carga.destino_principal) {
        // A API já envia o destino formatado (ex: "CIDADE-UF")
        listaInfo += `<li><strong>Destino:</strong> ${carga.destino_principal}</li>`;
		}
		if (carga.status === 'Agendada' || carga.status === 'Em Trânsito') {
            if (carga.motorista_nome) { 
        listaInfo += `<li><strong>Motorista:</strong> ${carga.motorista_nome} (${carga.placa_veiculo || 'N/A'})</li>`;
			}
        }
        listaInfo += `<li><strong>Nº Entregas:</strong> ${carga.num_entregas || 0}</li>`;
        listaInfo += `<li><strong>Peso Total:</strong> ${formatarPeso(carga.peso_total)}</li>`;
		
		if (sessaoUsuario && sessaoUsuario.user_permission === 'admin') {
            listaInfo += `<li><strong>Frete Total:</strong> ${formatarMoeda(carga.valor_frete_total)}</li>`;
        }
		
        listaInfo += '</ul>';

        cartao.innerHTML = cabecalhoCartao + listaInfo;

        const colunaId = carga.status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
        const coluna = document.getElementById(colunaId);
        if (coluna) {
            coluna.appendChild(cartao);
        } else {
            console.error(`Coluna com ID '${colunaId}' não encontrada para o status '${carga.status}'`);
        }
    }

    async function abrirModalDetalhes(id, reabrirFormularioEntrega = false) {
		selecaoDetalhesAtiva = false;
        try {
            const response = await fetch(`/api/cargas/${id}`);
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Carga não encontrada');
            }
            cargaAtual = await response.json();
            renderizarModalDetalhes(reabrirFormularioEntrega);
            modalDetalhes.style.display = 'block';
            inicializarSelect2MotoristaVeiculo();
        } catch (error) {
            console.error("Erro ao buscar detalhes:", error);
            // Agora o alerta vai te dizer QUAL é o erro (ex: Erro 500, JSON inválido, etc)
            alert(`Não foi possível carregar os detalhes: ${error.message}`);
        }
    }

function renderizarModalDetalhes(reabrirFormularioEntrega = false) {
        const { detalhes_carga, entregas } = cargaAtual;
        const statusClass = detalhes_carga.status.toLowerCase().replace(/\s+/g, '-');
        const podeEditarGeral = ['admin', 'operador'].includes(sessaoUsuario.user_permission);
        const podeEditarEntregas = podeEditarGeral && ['Pendente', 'Agendada'].includes(detalhes_carga.status);

        // Agrupa coletas para resumo
        const coletasPorRemetente = entregas.reduce((acc, e) => {
            const remetenteKey = e.remetente_nome || 'Desconhecido';
            if (!acc[remetenteKey]) {
                acc[remetenteKey] = { nome: remetenteKey, cidade: e.remetente_cidade, peso: 0 };
            }
            acc[remetenteKey].peso += (e.peso_bruto || 0);
            return acc;
        }, {});
        const resumoColetasHtml = Object.values(coletasPorRemetente).map(coleta =>
            `<li>${coleta.nome} (${coleta.cidade}): ${formatarPeso(coleta.peso)}</li>`
        ).join('');

        // Agrupa entregas por Cliente/Destino
        const entregasAgrupadas = entregas.reduce((acc, e) => {
             const clienteKey = `${e.cliente_id}_${(e.cidade || 'N/A').toUpperCase()}_${(e.estado || 'N/A').toUpperCase()}`;
             if (!acc[clienteKey]) {
                 acc[clienteKey] = {
                     id: e.id, 
                     razao_social: e.razao_social,
                     cidade: e.cidade,
                     estado: e.estado,
                     ddd: e.ddd,
                     telefone: e.telefone,
                     obs_cliente: e.obs_cliente,
                     peso_total: 0,
                     frete_total: 0,
                     sub_entregas: []
                 };
             }
             acc[clienteKey].peso_total += (e.peso_bruto || 0);
             acc[clienteKey].frete_total += (e.valor_frete || 0);
             acc[clienteKey].sub_entregas.push(e);
             return acc;
         }, {});

        const pesoTotalGeral = entregas.reduce((acc, e) => acc + (e.peso_bruto || 0), 0);
        const cubadoTotalGeral = entregas.reduce((acc, e) => acc + (e.peso_cubado || e.peso_bruto || 0), 0);
        const freteTotalGeral = entregas.reduce((acc, e) => acc + (e.valor_frete || 0), 0);
        let secaoDados, secaoAcoes;

        // --- GERAÇÃO DOS DADOS DA VIAGEM ---
		if (detalhes_carga.status === 'Pendente') {
            secaoDados = `<div class="detalhes-secao"><h4>Dados da Viagem</h4><div class="detalhes-form-grid-4">
            <div class="campo-form"><label>Origem</label><input type="text" id="detalhe-origem" value="${detalhes_carga.origem || ''}"></div>
            <div class="campo-form"><label>Peso Total</label><p>${formatarPeso(pesoTotalGeral)}</p></div>
            <div class="campo-form"><label>Peso Cubado</label><p>${formatarPeso(cubadoTotalGeral)}</p></div>
            <div class="campo-form"><label>Frete Total</label><p>${formatarMoeda(freteTotalGeral)}</p></div>
            <div class="campo-form"><label>Frete Pago</label><input type="text" id="detalhe-frete-pago" value="${formatarMoeda(detalhes_carga.frete_pago).replace('R$ ','')}" inputmode="decimal"></div>
            <div class="campo-form"><label>Qtd. Entregas</label><p>${Object.keys(entregasAgrupadas).length}</p></div>
            <div class="campo-form"><label for="select-motorista">Motorista</label><select id="select-motorista" style="width: 100%;"></select></div>
            <div class="campo-form"><label for="select-veiculo">Veículo</label><select id="select-veiculo" style="width: 100%;"></select></div>
			</div></div>`;
            secaoAcoes = `<div class="detalhes-secao"><h4>Ações de Status</h4><div class="form-acao-agendar">
                <label for="detalhe-agendamento">Data do Agendamento:</label>
                <input type="date" id="detalhe-agendamento" value="${formatarDataParaInput(detalhes_carga.data_agendamento)}">
                <button class="btn-acao" data-acao="agendar">Agendar Carga</button>
                <button class="btn-acao-verde" data-acao="salvar">Salvar Alterações</button>
                ${(sessaoUsuario.user_permission === 'admin') ? `<button class="btn-excluir-entrega" data-acao="excluir-carga" style="margin-left: auto;">Excluir Carga</button>` : ''}
				</div></div>`;
        } else if (detalhes_carga.status === 'Agendada') {
            secaoDados = `<div class="detalhes-secao"><h4>Dados da Viagem</h4><div class="detalhes-form-grid-4">
                <div class="campo-form"><label>Origem</label><p>${detalhes_carga.origem || ''}</p></div>
                <div class="campo-form"><label>Peso Total</label><p>${formatarPeso(pesoTotalGeral)}</p></div>
                <div class="campo-form"><label>Peso Cubado</label><p>${formatarPeso(cubadoTotalGeral)}</p></div> <div class="campo-form"><label>Frete Total</label><p>${formatarMoeda(freteTotalGeral)}</p></div>
                <div class="campo-form"><label>Frete Pago</label><input type="text" id="detalhe-frete-pago" value="${formatarMoeda(detalhes_carga.frete_pago).replace('R$ ','')}" inputmode="decimal"></div>
                <div class="campo-form"><label>Qtd. Entregas</label><p>${Object.keys(entregasAgrupadas).length}</p></div> <div class="campo-form"><label for="select-motorista">Motorista</label><select id="select-motorista" style="width: 100%;"></select></div>
                <div class="campo-form"><label for="select-veiculo">Veículo</label><select id="select-veiculo" style="width: 100%;"></select></div>
            </div></div>`;
            secaoAcoes = `<div class="detalhes-secao"><h4>Ações de Status</h4><div class="form-acao">`;
            if (sessaoUsuario.user_permission === 'admin') {
                secaoAcoes += `<div class="campo-form"><label for="detalhe-agendamento-edit">Agendamento</label><input type="date" id="detalhe-agendamento-edit" value="${formatarDataParaInput(detalhes_carga.data_agendamento)}"></div>`;
            } else {
                secaoAcoes += `<div class="campo-form"><label>Agendamento</label><p>${formatarData(detalhes_carga.data_agendamento)}</p></div>`;
            }
            secaoAcoes += `
                <div class="campo-form"><label for="detalhe-carregamento">Carregamento</label><input type="date" id="detalhe-carregamento" value="${formatarDataParaInput(detalhes_carga.data_carregamento) || getHojeFormatado()}"></div>
                <div class="campo-form"><label for="detalhe-previsao">Previsão Entrega</label><input type="date" id="detalhe-previsao" value="${formatarDataParaInput(detalhes_carga.previsao_entrega)}"></div>
            </div>
            <div class="acoes-container">
                <button class="btn-acao" data-acao="iniciar-transito">Iniciar Trânsito</button>
				<button class="btn-acao-secundario" data-acao="cancelar-agendamento">Cancelar Agendamento</button>
                <button class="btn-acao-verde" data-acao="salvar">Salvar Alterações</button>
				${(sessaoUsuario.user_permission === 'admin') ? `<button class="btn-excluir-entrega" data-acao="excluir-carga" style="margin-left: auto;">Excluir Carga</button>` : ''}
            </div></div>`;
        } else if (detalhes_carga.status === 'Em Trânsito') {
            secaoDados = `<div class="detalhes-secao"><h4>Dados da Viagem</h4><div class="detalhes-form-grid-4">
                <div class="campo-form"><label>Origem</label><p>${detalhes_carga.origem || ''}</p></div>
                <div class="campo-form"><label>Peso Total</label><p>${formatarPeso(pesoTotalGeral)}</p></div>
                <div class="campo-form"><label>Peso Cubado</label><p>${formatarPeso(cubadoTotalGeral)}</p></div>
                <div class="campo-form"><label>Frete Total</label><p>${formatarMoeda(freteTotalGeral)}</p></div>
                 <div class="campo-form"><label>Frete Pago</label><input type="text" id="detalhe-frete-pago" value="${formatarMoeda(detalhes_carga.frete_pago).replace('R$ ','')}" inputmode="decimal"></div>
                <div class="campo-form"><label>Qtd. Entregas</label><p>${Object.keys(entregasAgrupadas).length}</p></div>
                <div class="campo-form"><label>Motorista</label><p>${detalhes_carga.motorista_nome || 'N/A'}</p></div>
                <div class="campo-form"><label>Placa</label><p>${detalhes_carga.placa_veiculo || 'N/A'}</p></div>
                <div class="campo-form"><label>Carregamento</label><p>${formatarData(detalhes_carga.data_carregamento)}</p></div>
                <div class="campo-form"><label>Previsão Entrega</label><input type="date" id="detalhe-previsao" value="${formatarDataParaInput(detalhes_carga.previsao_entrega)}"></div>
            </div></div>`;
            secaoAcoes = `<div class="detalhes-secao"><h4>Ações de Status</h4><div class="acoes-container">
            <button class="btn-acao-finalizar" data-acao="finalizar">Finalizar Carga</button>
            ${(sessaoUsuario.user_permission === 'admin') ? `<button class="btn-acao-secundario" data-acao="regredir-para-agendada">Devolver para Agendada</button>` : ''}
            <button class="btn-acao-verde" data-acao="salvar">Salvar Alterações</button>
        </div></div>`;
        } else { // Finalizada
            secaoDados = `<div class="detalhes-secao"><h4>Dados da Viagem</h4><div class="detalhes-form-grid-4">
                <div class="campo-form"><label>Origem</label><p>${detalhes_carga.origem || ''}</p></div>
                <div class="campo-form"><label>Peso Total</label><p>${formatarPeso(pesoTotalGeral)}</p></div>
                <div class="campo-form"><label>Peso Cubado</label><p>${formatarPeso(cubadoTotalGeral)}</p></div> <div class="campo-form"><label>Frete Total</label><p>${formatarMoeda(freteTotalGeral)}</p></div>
                <div class="campo-form"><label>Frete Pago</label><p>${formatarMoeda(detalhes_carga.frete_pago)}</p></div>
                <div class="campo-form"><label>Qtd. Entregas</label><p>${Object.keys(entregasAgrupadas).length}</p></div> <div class="campo-form"><label>Motorista</label><p>${detalhes_carga.motorista_nome || 'N/A'}</p></div>
                <div class="campo-form"><label>Placa</label><p>${detalhes_carga.veiculo_placa || 'N/A'}</p></div>
                <div class="campo-form"><label>Carregamento</label><p>${formatarData(detalhes_carga.data_carregamento)}</p></div>
                 <div class="campo-form"><label>Finalização</label><p>${formatarData(detalhes_carga.data_finalizacao)}</p></div>
            </div></div>`;
				if (sessaoUsuario.user_permission === 'admin') {
					secaoAcoes = `<div class="detalhes-secao"><h4>Ações de Status (Admin)</h4><div class="acoes-container">
						<button class="btn-acao-secundario" data-acao="regredir-para-transito">Devolver para Em Trânsito</button>
					</div></div>`;
				}
        }

        let botoesEntregaHtml = '';
        
        // Bloco para status Pendente/Agendada (Edição)
        if (podeEditarEntregas) {
            botoesEntregaHtml += `<button id="btn-devolver-rascunho" class="btn-navegacao">Editar Carga na Montagem</button>`;
            botoesEntregaHtml += `<button id="btn-add-entrega" class="btn-acao">+ Coleta Rápida (V1)</button>`;
            botoesEntregaHtml += `<button id="btn-toggle-selecao-detalhes" class="btn-navegacao" style="background-color: #64748b; color: white; margin-left: 25px; border-left: 1px solid #94a3b8; padding-left: 15px;">✅ Seleção / Lote</button>`;
        }

        // --- CORREÇÃO: BOTÃO DE AVARIA (AGORA FORA DO BLOCO ACIMA) ---
        // Este bloco deve ficar SOLTO aqui embaixo para funcionar em qualquer status
        const statusAtual = (detalhes_carga.status || '').trim();
        
        // Verifica se é "Em Trânsito" ou "Finalizada"
        if (
            statusAtual.includes('Trânsito') || 
            statusAtual.includes('Transito') || 
            statusAtual === 'Finalizada'
        ) {
            botoesEntregaHtml += `
                <button class="btn-navegacao" 
                    style="background-color: #ef4444; color: white; margin-left: 15px;" 
                    onclick="window.location.href='/avarias.html?carga_id=${detalhes_carga.id}'">
                    ⚠️ Registrar Avaria
                </button>`;
        }
        
        // HTML da barra de ação em lote
        const acoesLoteHtml = podeEditarEntregas ? `
        <div id="acoes-lote-wrapper-detalhes" style="display: none; background-color: #fff7ed; padding: 10px; margin-bottom: 10px; border: 1px solid #fdba74; border-radius: 6px; align-items: center; gap: 10px;">
            <span style="color: #c2410c; font-weight: bold; font-size: 0.9em;">Ações em Lote:</span>
            <button id="btn-alterar-remetente-lote-detalhes" type="button" style="background-color: #f97316; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600;">
                ✏️ Alterar Remetente (<span id="contador-lote-detalhes">0</span>)
            </button>
        </div>` : '';

        // Estilo das colunas (Esconde ou mostra baseado na variável)
        const displaySel = selecaoDetalhesAtiva ? 'table-cell' : 'none';

        detalhesConteudo.innerHTML = `
			<div id="detalhes-header">
              <h2>${detalhes_carga.codigo_carga}</h2>
              <div class="form-acao">
                  <button id="btn-imprimir-espelho" class="btn-navegacao">🖨️ Imprimir Espelho</button>
                  <span class="status-${statusClass}">${detalhes_carga.status}</span>
              </div>
			</div>           
			<div class="modal-body-grid">
                ${secaoDados}
                <details class="detalhes-secao secao-expansivel" open> <summary><h4>Resumo de Coletas (${Object.keys(coletasPorRemetente).length})</h4></summary>
                    <ul class="lista-resumo">${resumoColetasHtml || '<li>Nenhuma coleta encontrada.</li>'}</ul>
                </details>
                <div class="detalhes-secao secao-full-width"><h4>Observações da Viagem</h4><div class="form-acao"><textarea id="obs-carga" rows="4" ${!podeEditarGeral ? 'disabled' : ''}>${detalhes_carga.observacoes || ''}</textarea></div></div>
                ${podeEditarGeral ? secaoAcoes : ''}
            </div>
            <div class="detalhes-secao" id="detalhes-entregas">
                <div class="entregas-header">
                    <h3>Entregas (${Object.keys(entregasAgrupadas).length} Destinos / ${entregas.length} Coletas)</h3>
                    <div class="form-acao">
                        ${botoesEntregaHtml}
                    </div>
                </div>
                <div id="form-add-entrega-container"></div>
                ${acoesLoteHtml}
                <div class="tabela-wrapper"><table id="tabela-entregas">
                    <thead><tr>
                        ${podeEditarEntregas ? `<th class="col-selecao-detalhes" style="display: ${displaySel}; width: 30px; text-align: center;"><input type="checkbox" id="cb-all-detalhes" title="Selecionar Todos"></th>` : ''}
                        ${podeEditarEntregas ? '<th>Destino</th>': ''}
                        <th>Cliente</th><th>Cidade/UF</th><th>Peso Total</th><th>Frete Total</th><th>Telefone</th><th>Observações</th>
                        ${podeEditarGeral ? '<th>Ações</th>': ''}
                    </tr></thead>
                    <tbody id="tabela-entregas-corpo"></tbody>
                </table></div>
            </div>`;

        const tabelaCorpoEntregas = document.getElementById('tabela-entregas-corpo');
        tabelaCorpoEntregas.innerHTML = '';
        
        const gruposOrdenados = Object.values(entregasAgrupadas);
        gruposOrdenados.sort((a, b) => (a.razao_social || '').localeCompare(b.razao_social || ''));
        
        if (gruposOrdenados.length > 0) {
             gruposOrdenados.forEach((grupo) => {
                const isChecked = grupo.sub_entregas.some(se => se.is_last_delivery);
                const radioId = `ultima-entrega-grupo-${grupo.id}`; 
                const idsDoGrupo = grupo.sub_entregas.map(e => e.id).join(',');

                const trGrupo = document.createElement('tr');
                trGrupo.classList.add('linha-grupo-entrega');
                trGrupo.innerHTML = `
                    ${podeEditarEntregas ? `<td class="col-selecao-detalhes" style="display: ${displaySel}; text-align: center;"><input type="checkbox" class="cb-lote-detalhes" data-ids="${idsDoGrupo}"></td>` : ''}
                    ${podeEditarEntregas ? `<td class="col-destino"><input type="radio" name="ultima-entrega-grupo" id="${radioId}" class="radio-ultima-entrega-grupo" data-grupo-id="${grupo.id}" ${isChecked ? 'checked' : ''}></td>` : ''}
                    <td>${grupo.razao_social}</td>
                    <td>${grupo.cidade}-${grupo.estado}</td>
                    <td>${formatarPeso(grupo.peso_total)}</td>
                    <td>${formatarMoeda(grupo.frete_total)}</td>
                    <td>(${grupo.ddd || ''}) ${grupo.telefone || ''}</td>
                    <td title="${grupo.obs_cliente || ''}">${(grupo.obs_cliente || 'Nenhuma').substring(0, 20)}</td>
                    ${podeEditarGeral ? `<td><button class="btn-detalhes-entrega" data-target="detalhes-${grupo.id}">+ Detalhes (${grupo.sub_entregas.length})</button></td>` : ''}
                `;
                tabelaCorpoEntregas.appendChild(trGrupo);

                const trDetalhes = document.createElement('tr');
                trDetalhes.classList.add('linha-detalhes-entrega');
                trDetalhes.id = `detalhes-${grupo.id}`;
                trDetalhes.style.display = 'none';
                
                let colspanCount = podeEditarGeral ? 7 : 6;
                if (podeEditarEntregas) colspanCount += 2; // +1 Checkbox, +1 Radio

                let detalhesHtml = `<td colspan="${colspanCount}"><div class="detalhes-subtabela"><h4>Coletas para ${grupo.razao_social} (${grupo.cidade}/${grupo.estado}):</h4><ul>`;
                grupo.sub_entregas.forEach(sub => {
                    detalhesHtml += `<li>
                        <span>Origem: ${sub.remetente_nome} (${sub.remetente_cidade})</span> |
                        <span>Peso: ${formatarPeso(sub.peso_bruto)}</span> |
                        <span>Frete: ${formatarMoeda(sub.valor_frete)}</span> |
                        <span>Nota: ${sub.nota_fiscal || 'N/A'}</span>
                        ${podeEditarEntregas ? ` | <button class="btn-editar btn-editar-entrega" data-id="${sub.id}">Editar Linha</button> <button class="btn-excluir-entrega" data-id="${sub.id}">Excluir Linha</button>` : ''}
                    </li>`;
                });
                detalhesHtml += `</ul></div></td>`;
                trDetalhes.innerHTML = detalhesHtml;
                tabelaCorpoEntregas.appendChild(trDetalhes);
            });
        } else {
            let colspanCount = podeEditarGeral ? 7 : 6;
            if (podeEditarEntregas) colspanCount += 2;
            tabelaCorpoEntregas.innerHTML = `<tr><td colspan="${colspanCount}">Nenhuma entrega adicionada.</td></tr>`;
        }

        // --- LISTENERS ---
        // Novo Listener para o botão de toggle
        const btnToggle = document.getElementById('btn-toggle-selecao-detalhes');
        if (btnToggle) {
            btnToggle.addEventListener('click', () => {
                selecaoDetalhesAtiva = !selecaoDetalhesAtiva;
                const display = selecaoDetalhesAtiva ? 'table-cell' : 'none';
                document.querySelectorAll('.col-selecao-detalhes').forEach(el => el.style.display = display);
                
                // Limpa seleções se esconder
                if (!selecaoDetalhesAtiva) {
                    document.querySelectorAll('.cb-lote-detalhes').forEach(cb => cb.checked = false);
                    if(document.getElementById('cb-all-detalhes')) document.getElementById('cb-all-detalhes').checked = false;
                    const wrapper = document.getElementById('acoes-lote-wrapper-detalhes');
                    if(wrapper) wrapper.style.display = 'none';
                }
            });
        }

        document.querySelectorAll('.btn-detalhes-entrega').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.dataset.target;
                const detalhesRow = document.getElementById(targetId);
                if (detalhesRow) {
                    detalhesRow.style.display = detalhesRow.style.display === 'none' ? 'table-row' : 'none';
                     e.target.textContent = detalhesRow.style.display === 'none' ? `+ Detalhes (${detalhesRow.querySelectorAll('li').length})` : `- Detalhes (${detalhesRow.querySelectorAll('li').length})`;
                }
            });
        });

        document.querySelectorAll('.btn-editar-entrega').forEach(btn => btn.addEventListener('click', abrirModalEdicaoEntrega));
        document.querySelectorAll('.btn-excluir-entrega').forEach(btn => btn.addEventListener('click', (e) => { if(confirm('Tem certeza? Esta linha será devolvida para "Disponíveis".')) handleExcluirEntrega(e.target.dataset.id); }));

        document.querySelectorAll('.radio-ultima-entrega-grupo').forEach(radio => {
             radio.addEventListener('change', async (event) => {
                const idEntregaDoGrupo = event.target.dataset.grupoId; 
                if (idEntregaDoGrupo) await handleMarcarUltimaEntrega(idEntregaDoGrupo);
             });
        });

        configurarEventListenersDeAcoesGerais();
        mascaraDecimal(document.getElementById('detalhe-frete-pago'));
        
        if (podeEditarEntregas) configurarLoteDetalhes();

        if (reabrirFormularioEntrega) {
            const btnAddEntrega = document.getElementById('btn-add-entrega');
            if (btnAddEntrega) btnAddEntrega.click();
        }
    }
	
    function configurarEventListenersDeAcoesGerais() {
        document.querySelector('[data-acao="salvar"]')?.addEventListener('click', handleSalvarAlteracoes);
        document.querySelector('[data-acao="agendar"]')?.addEventListener('click', handleAgendar);
        document.querySelector('[data-acao="iniciar-transito"]')?.addEventListener('click', handleIniciarTransito);
        document.querySelector('[data-acao="cancelar-agendamento"]')?.addEventListener('click', handleCancelarAgendamento);
        document.querySelector('[data-acao="finalizar"]')?.addEventListener('click', handleFinalizarCarga);
        document.querySelector('[data-acao="regredir-para-agendada"]')?.addEventListener('click', handleRegredirParaAgendada);
        document.querySelector('[data-acao="regredir-para-transito"]')?.addEventListener('click', handleRegredirParaTransito);
        document.getElementById('btn-add-entrega')?.addEventListener('click', abrirFormAddEntregaV1);
        document.getElementById('btn-imprimir-espelho')?.addEventListener('click', handleImprimirEspelho);
        // ***** NOVO LISTENER (V2.1) *****
        document.getElementById('btn-devolver-rascunho')?.addEventListener('click', handleDevolverRascunho);
		document.querySelector('[data-acao="excluir-carga"]')?.addEventListener('click', handleExcluirCarga);
    }

    function abrirFormAddEntregaV1(e){
        document.getElementById('btn-add-entrega').style.display = 'none';
        const btnDevolver = document.getElementById('btn-devolver-rascunho');
        if (btnDevolver) btnDevolver.style.display = 'none';

        const container = document.getElementById('form-add-entrega-container');
        container.innerHTML = `<form id="form-nova-entrega" class="form-acao">
        <select id="select-remetente-v1" style="width: 250px;"></select>

        <select id="select-cliente-v1" style="width: 250px;"></select>
        <input type="text" id="entrega-peso-bruto-v1" placeholder="Peso Bruto *" inputmode="decimal" required>

        <div class="grid-col-2" style="gap: 5px; flex-grow: 1;">
            <div><input type="text" id="entrega-valor-tonelada-v1" placeholder="Valor/Ton" inputmode="decimal" style="margin-bottom: 0; width: 100%;"></div>
            <div><input type="text" id="entrega-valor-frete-v1" placeholder="Valor Frete" inputmode="decimal" style="margin-bottom: 0; width: 100%;"></div>
        </div>

        <button type="submit">Salvar Entrega</button>
        <button type="button" class="btn-navegacao-secundario" id="cancelar-add-entrega-v1">Cancelar</button>
		</form>`;
        
        // Filtra clientes que NÃO são remetentes para o V1
        const listaDestinatarios = listaDeClientes.filter(c => c.is_remetente === false);
        
		$('#select-remetente-v1').select2({ 
			placeholder: 'Selecione o Remetente *', 
			dropdownParent: $('#form-add-entrega-container'), 
			data: listaDeRemetentesSelect2 
		});

		$('#select-cliente-v1').select2({ placeholder: 'Selecione o Destinatário *', dropdownParent: $('#form-add-entrega-container'), data: listaDestinatarios });
		const pesoV1 = document.getElementById('entrega-peso-bruto-v1');
		const tonV1 = document.getElementById('entrega-valor-tonelada-v1');
		const freteV1 = document.getElementById('entrega-valor-frete-v1');

		const vTonListenerV1 = () => calcularFretePorTonelada(pesoV1, tonV1, freteV1);
		tonV1.addEventListener('blur', vTonListenerV1);
		pesoV1.addEventListener('blur', vTonListenerV1);

		mascaraDecimal(pesoV1);
		mascaraDecimal(freteV1);
		mascaraDecimal(tonV1);
        document.getElementById('form-nova-entrega').addEventListener('submit', salvarNovaEntregaV1);
        document.getElementById('cancelar-add-entrega-v1').addEventListener('click', () => {
             container.innerHTML = '';
             document.getElementById('btn-add-entrega').style.display = 'inline-flex';
             if (btnDevolver) btnDevolver.style.display = 'inline-flex';
        });
    }

    // ***** FUNÇÃO ALTERADA *****
    function abrirModalEdicaoEntrega(e) {
        const entregaId = e.target.dataset.id;
        const entrega = cargaAtual.entregas.find(ent => ent.id == entregaId);

        if (!entrega) { alert('Erro: Entrega não encontrada.'); return; }

        document.getElementById('edit-entrega-id').value = entrega.id;
		document.getElementById('edit-nota-fiscal').value = entrega.nota_fiscal || '';
        
        // Popula o novo dropdown de remetente
        selectEditRemetente.val(entrega.remetente_id).trigger('change');
        
        document.getElementById('edit-peso-bruto').value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(entrega.peso_bruto || 0);
        document.getElementById('edit-valor-frete').value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(entrega.valor_frete || 0);
        const pesoCobradoInput = document.getElementById('edit-peso-cobrado');
        if (pesoCobradoInput) pesoCobradoInput.value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(entrega.peso_cubado || 0); // Corrigido para peso_cubado
		const editPeso = document.getElementById('edit-peso-bruto');
		const editTon = document.getElementById('edit-valor-tonelada');
		const editFrete = document.getElementById('edit-valor-frete');
		const editCubado = document.getElementById('edit-peso-cobrado'); // (Verifique o ID correto no seu HTML)

		// Recalcula frete ao mudar ton ou peso
		const calcListener = () => calcularFretePorTonelada(editPeso, editCubado, editTon, editFrete);
		editTon.addEventListener('blur', calcListener);
		editPeso.addEventListener('blur', calcListener);
    
    mascaraDecimal(editTon);

        document.getElementById('edit-cidade-entrega').value = entrega.cidade_entrega_override || '';
        document.getElementById('edit-estado-entrega').value = entrega.estado_entrega_override || '';

        const isAdmin = sessaoUsuario.user_permission === 'admin';
        document.getElementById('edit-cidade-entrega').disabled = !isAdmin;
        document.getElementById('edit-estado-entrega').disabled = !isAdmin;
        // Operadores podem mudar o remetente
        selectEditRemetente.prop('disabled', !isAdmin && sessaoUsuario.user_permission !== 'operador');


        mascaraDecimal(document.getElementById('edit-peso-bruto'));
        mascaraDecimal(document.getElementById('edit-valor-frete'));
        if (pesoCobradoInput) mascaraDecimal(pesoCobradoInput);

        modalEditarEntrega.style.display = 'block';
    }
    // ***** FIM DA ALTERAÇÃO *****


    // --- FUNÇÕES DE AÇÕES (Handles) ---

    async function handleDevolverRascunho() {
        const cargaId = cargaAtual.detalhes_carga.id;
        if (!confirm(`Tem certeza que deseja devolver a carga ${cargaAtual.detalhes_carga.codigo_carga} para Rascunho?\n\nEla sairá desta tela e aparecerá na Montagem de Carga.`)) return;
        try {
            const response = await fetch(`/api/cargas/${cargaId}/devolver-rascunho`, { method: 'PUT' });
            const resultado = await response.json();
            if (!response.ok) throw new Error(resultado.error || 'Falha ao devolver para rascunho.');
            alert(resultado.message);
            fecharModais();
            window.location.href = '/montagem.html'; // Redireciona o usuário
        } catch (error) { alert(`Erro: ${error.message}`); }
    }

    async function handleMarcarUltimaEntrega(entregaIdParaMarcar) {
        try {
            const response = await fetch(`/api/entregas/${entregaIdParaMarcar}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_last_delivery: 1 })
            });
            if (!response.ok) throw new Error('Falha ao marcar como destino.');
            const formAberto = !!document.getElementById('form-nova-entrega');
            await carregarDadosIniciais(); 
            const cargaId = cargaAtual.detalhes_carga.id;
            await abrirModalDetalhes(cargaId, formAberto); 
        } catch (error) {
            alert(`Erro: ${error.message}`);
            renderizarModalDetalhes(!!document.getElementById('form-nova-entrega'));
        }
    }

    async function handleExcluirEntrega(entregaId) {
        const response = await fetch(`/api/cargas/${cargaAtual.detalhes_carga.id}/entregas`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entrega_id: entregaId })
        });
        if (response.ok) {
            const formAberto = !!document.getElementById('form-nova-entrega');
            await carregarDadosIniciais();
            await abrirModalDetalhes(cargaAtual.detalhes_carga.id, formAberto);
        } else { alert('Erro ao excluir entrega.'); }
    }

    async function salvarNovaEntregaV1(e) {
        e.preventDefault();
        const dados = {
			remetente_id: $('#select-remetente-v1').val(),
            cliente_id: $('#select-cliente-v1').val(),
            peso_bruto: parseDecimal(document.getElementById('entrega-peso-bruto-v1').value),
            valor_frete: parseDecimal(document.getElementById('entrega-valor-frete-v1').value),
        };
		if(!dados.remetente_id || !dados.cliente_id || dados.peso_bruto === null) { alert("Remetente, Destinatário e Peso Bruto são obrigatórios."); return; }
        const response = await fetch(`/api/cargas/${cargaAtual.detalhes_carga.id}/entregas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        if (response.ok) {
            document.getElementById('entrega-peso-bruto-v1').value = '';
			document.getElementById('entrega-valor-tonelada-v1').value = '';
			document.getElementById('entrega-valor-frete-v1').value = '';
            await abrirModalDetalhes(cargaAtual.detalhes_carga.id, true);
        } else {
             const err = await response.json();
             alert(`Erro ao salvar entrega: ${err.error || 'Erro desconhecido.'}`);
        }
    }

    // ***** FUNÇÃO ALTERADA *****
    document.getElementById('form-editar-entrega').addEventListener('submit', async (e) => {
        e.preventDefault();
        const entregaId = document.getElementById('edit-entrega-id').value;
        const pesoCobradoInput = document.getElementById('edit-peso-cobrado');
        
        const dados = {
            remetente_id: selectEditRemetente.val(),
            peso_bruto: parseDecimal(document.getElementById('edit-peso-bruto').value),
            valor_frete: parseDecimal(document.getElementById('edit-valor-frete').value),
            peso_cubado: pesoCobradoInput ? parseDecimal(pesoCobradoInput.value) : undefined, // Envia como peso_cubado (se o backend esperar isso, ou ajustamos o backend para ler peso_cobrado e gravar em cubado)
            nota_fiscal: document.getElementById('edit-nota-fiscal').value, // NOVO
            cidade_entrega: document.getElementById('edit-cidade-entrega').value || null,
            estado_entrega: document.getElementById('edit-estado-entrega').value || null
        };
        if (dados.peso_bruto === null || dados.peso_bruto <= 0 || !dados.remetente_id) {
            alert('Remetente e Peso Bruto são obrigatórios.'); return;
        }
        if (sessaoUsuario.user_permission !== 'admin') {
            delete dados.cidade_entrega;
            delete dados.estado_entrega;
        }

        try {
            const response = await fetch(`/api/entregas/${entregaId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            const resultado = await response.json();
            if (!response.ok) throw new Error(resultado.error || 'Falha ao atualizar entrega.');

            const formAberto = !!document.getElementById('form-nova-entrega');
            fecharModais();
            await carregarDadosIniciais();
            await abrirModalDetalhes(cargaAtual.detalhes_carga.id, formAberto);

        } catch (error) { alert(`Erro: ${error.message}`); }
    });
    // ***** FIM DA ALTERAÇÃO *****

	async function handleFinalizarCarga() {
        const senha = prompt("Para finalizar a carga, insira sua senha de usuário:");
        if (senha === null) return;
        const response = await fetch('/api/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: senha })
        });
        if (response.ok) {
            // --- INÍCIO DA CORREÇÃO ---
            // Captura todos os dados da tela antes de finalizar
            let dados = {
                 observacoes: document.getElementById('obs-carga').value,
                 frete_pago: parseDecimal(document.getElementById('detalhe-frete-pago')?.value) || 0,
                 previsao_entrega: document.getElementById('detalhe-previsao')?.value || null // Adiciona o '?' para o caso de não existir
            };
            
            // Adiciona os dados da finalização
            dados.status = 'Finalizada';
            dados.data_finalizacao = getHojeFormatado();
            
            enviarAtualizacaoStatus(dados);
            // --- FIM DA CORREÇÃO ---
        } else { alert("Senha incorreta!"); }
    }
	
    async function handleCancelarAgendamento() {
        if (!confirm('Tem certeza? A carga voltará para "Pendentes".')) return;
        enviarAtualizacaoStatus({ status: 'Pendente', data_agendamento: null });
    }
	async function handleRegredirParaAgendada() {
        if (!confirm('ADMIN: Tem certeza que deseja devolver esta carga para "Agendada"?')) return;
        enviarAtualizacaoStatus({ status: 'Agendada' });
    }

    async function handleRegredirParaTransito() {
        if (!confirm('ADMIN: Tem certeza que deseja reabrir esta carga para "Em Trânsito"?')) return;
        enviarAtualizacaoStatus({ status: 'Em Trânsito', data_finalizacao: null }); // Limpa a data de finalização
    }

function handleAgendar() {
        const dataAgendamento = document.getElementById('detalhe-agendamento').value;
        if (!dataAgendamento) { alert('A data de agendamento é obrigatória.'); return; }
        
        // --- INÍCIO DA CORREÇÃO ---
        // Captura todos os outros dados da tela (como em salvar)
        let dados = {
             observacoes: document.getElementById('obs-carga').value,
             frete_pago: parseDecimal(document.getElementById('detalhe-frete-pago')?.value) || 0,
             origem: document.getElementById('detalhe-origem').value,
             data_agendamento: dataAgendamento, // Adiciona a data específica
             // Adiciona motorista/veiculo se já tiver sido preenchido
             motorista_id: $('#select-motorista').val() || null,
             veiculo_id: $('#select-veiculo').val() || null
        };
        
        // Adiciona o status do agendamento
        dados.status = 'Agendada';
        
        enviarAtualizacaoStatus(dados);
        // --- FIM DA CORREÇÃO ---
    }

    function handleIniciarTransito() {
        const motoristaId = $('#select-motorista').val();
        const veiculoId = $('#select-veiculo').val();
        const dataCarregamento = document.getElementById('detalhe-carregamento').value;
        if (!motoristaId || !veiculoId || !dataCarregamento) { alert('Motorista, Veículo e Data de Carregamento são obrigatórios.'); return; }

        // --- INÍCIO DA CORREÇÃO ---
        // Captura todos os outros dados da tela (como em salvar)
        let dados = {
             observacoes: document.getElementById('obs-carga').value,
             frete_pago: parseDecimal(document.getElementById('detalhe-frete-pago')?.value) || 0,
             previsao_entrega: document.getElementById('detalhe-previsao').value || null
        };
        // Adiciona dados de agendamento (caso o admin tenha editado)
        const campoAgendamentoEdit = document.getElementById('detalhe-agendamento-edit');
        if (campoAgendamentoEdit) {
            dados.data_agendamento = campoAgendamentoEdit.value || null;
        }
        
        // Adiciona os dados do trânsito
        dados.status = 'Em Trânsito';
        dados.motorista_id = motoristaId;
        dados.veiculo_id = veiculoId;
        dados.data_carregamento = dataCarregamento;
        
        enviarAtualizacaoStatus(dados);
        // --- FIM DA CORREÇÃO ---
    }
	
    function handleSalvarAlteracoes() {
        const { detalhes_carga } = cargaAtual;
        let dados = {
             observacoes: document.getElementById('obs-carga').value,
             frete_pago: parseDecimal(document.getElementById('detalhe-frete-pago')?.value) || 0,
        };

        if(detalhes_carga.status === 'Pendente') {
        dados.origem = document.getElementById('detalhe-origem').value;
        dados.data_agendamento = document.getElementById('detalhe-agendamento').value || null;
        // --- LINHAS NOVAS ABAIXO ---
        dados.motorista_id = $('#select-motorista').val() || null;
        dados.veiculo_id = $('#select-veiculo').val() || null;
        // --- FIM DA ADIÇÃO ---
		} else if (detalhes_carga.status === 'Agendada') {
            dados.motorista_id = $('#select-motorista').val() || null;
            dados.veiculo_id = $('#select-veiculo').val() || null;
            dados.data_carregamento = document.getElementById('detalhe-carregamento').value || null;
            dados.previsao_entrega = document.getElementById('detalhe-previsao').value || null;
            const campoAgendamentoEdit = document.getElementById('detalhe-agendamento-edit');
            if (campoAgendamentoEdit) {
                dados.data_agendamento = campoAgendamentoEdit.value || null;
            }
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
            alert('Alterações salvas com sucesso!'); // Confirmação
            await carregarDadosIniciais(); // Atualiza o fundo
            await abrirModalDetalhes(cargaAtual.detalhes_carga.id, false);
        } catch (error) {
            alert(`Não foi possível completar a ação: ${error.message}`);
        }
    }

    function inicializarSelect2MotoristaVeiculo() {
         if (['Pendente', 'Agendada'].includes(cargaAtual?.detalhes_carga?.status)) {
            $('#select-motorista').select2({
                placeholder: 'Selecione um motorista',
                allowClear: true,
                dropdownParent: $('#modal-detalhes-carga'),
                data: listaDeMotoristas
            }).val(cargaAtual.detalhes_carga.motorista_id).trigger('change');

            $('#select-veiculo').select2({
                placeholder: 'Selecione um veículo',
                allowClear: true,
                dropdownParent: $('#modal-detalhes-carga'),
                data: listaDeVeiculos
            }).val(cargaAtual.detalhes_carga.veiculo_id).trigger('change');
         }
    }
// --- FILTROS ESPECÍFICOS POR COLUNA ---
    const filtrosColuna = document.querySelectorAll('.filtro-coluna');

    filtrosColuna.forEach(input => {
        input.addEventListener('input', (e) => {
            const termo = e.target.value.toLowerCase();
            const targetId = e.target.dataset.target; // Pega o id ("pendente", "agendada", etc)
            
            // Busca o container correto baseado no input que foi digitado
            const container = document.getElementById(targetId);
            if (!container) return;

            // Filtra APENAS os cards dentro desse container
            const cards = container.querySelectorAll('.cartao-carga');

            cards.forEach(card => {
                const textoCard = card.innerText.toLowerCase();
                if (textoCard.includes(termo)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });    // --- Listener Principal ---
    painelContainer.addEventListener('click', (e) => {
        const cartao = e.target.closest('.cartao-carga');
        if (cartao) abrirModalDetalhes(cartao.dataset.id, false);
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
			adicionarCartaoNaTela(novaCarga); // Ou criarCartaoHTML se estiver usando a otimização
			fecharModais();
			document.getElementById('form-nova-carga').reset();
        } catch (error) { console.error("Erro ao criar carga:", error); }
    });
	function handleImprimirEspelho() {
		if (!cargaAtual || !cargaAtual.detalhes_carga) return;
		const cargaId = cargaAtual.detalhes_carga.id;
		// Abre o PDF em uma nova aba (o navegador vai tratar o download)
		window.open(`/cargas/${cargaId}/espelho_impressao`, '_blank'); // <-- CORRIGIDO
	}
async function handleExcluirCarga() {
        if (!confirm('ATENÇÃO ADMIN: Você está prestes a excluir esta carga PERMANENTEMENTE.\n\nClique OK para continuar.')) return;
        
        let acaoEntregas = prompt("O que deseja fazer com as entregas vinculadas?\n\nDigite 1 para DEVOLVER para a montagem (recomendado).\nDigite 2 para APAGAR permanentemente as entregas.\n\n(Qualquer outra tecla cancela)");
        
        let actionParam = '';
        if (acaoEntregas === '1') actionParam = 'return_to_pool';
        else if (acaoEntregas === '2') {
            if(!confirm("Tem certeza absoluta? As entregas serão apagadas do banco de dados.")) return;
            actionParam = 'delete_entregas';
        } else {
            return; 
        }

        try {
            const response = await fetch(`/api/cargas/${cargaAtual.detalhes_carga.id}?action=${actionParam}`, { method: 'DELETE' });
            if (response.ok) {
                alert('Carga excluída com sucesso.');
                fecharModais();
                carregarDadosIniciais();
            } else {
                alert('Erro ao excluir carga.');
            }
        } catch (error) { console.error(error); }
    }
	
	// --- FUNÇÕES DE LOTE (DETALHES) ---
    function configurarLoteDetalhes() {
        const cbAll = document.getElementById('cb-all-detalhes');
        const checkboxes = document.querySelectorAll('.cb-lote-detalhes');
        const btnLote = document.getElementById('btn-alterar-remetente-lote-detalhes');

        function atualizarUI() {
            // Conta quantas ENTREGAS (não grupos) estão selecionadas
            let totalEntregas = 0;
            document.querySelectorAll('.cb-lote-detalhes:checked').forEach(cb => {
                const ids = cb.dataset.ids.split(',');
                totalEntregas += ids.length;
            });

            const wrapper = document.getElementById('acoes-lote-wrapper-detalhes');
            const contador = document.getElementById('contador-lote-detalhes');
            
            if (wrapper && contador) {
                if (totalEntregas > 0) {
                    wrapper.style.display = 'flex';
                    contador.textContent = totalEntregas;
                } else {
                    wrapper.style.display = 'none';
                }
            }
        }

        if (cbAll) {
            cbAll.addEventListener('change', (e) => {
                checkboxes.forEach(cb => cb.checked = e.target.checked);
                atualizarUI();
            });
        }

        checkboxes.forEach(cb => {
            cb.addEventListener('change', atualizarUI);
        });

        if (btnLote) {
            btnLote.addEventListener('click', handleAbrirModalLoteDetalhes);
        }
    }

    function handleAbrirModalLoteDetalhes() {
        let totalEntregas = 0;
        document.querySelectorAll('.cb-lote-detalhes:checked').forEach(cb => {
            totalEntregas += cb.dataset.ids.split(',').length;
        });

        if (totalEntregas === 0) return;

        spanQtdLoteDet.textContent = totalEntregas;
        selectRemetenteLoteDet.val(null).trigger('change');
        msgLoteDet.textContent = '';
        modalLoteDet.style.display = 'block';
    }

    // Listener do Formulário de Lote
    if (formLoteDet) {
        formLoteDet.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const novoRemetente = selectRemetenteLoteDet.val();
            if (!novoRemetente) return;

            // Coleta todos os IDs selecionados
            let todosIds = [];
            document.querySelectorAll('.cb-lote-detalhes:checked').forEach(cb => {
                if (cb.dataset.ids) {
                    const ids = cb.dataset.ids.split(',').map(Number);
                    todosIds = todosIds.concat(ids);
                }
            });

            if (todosIds.length === 0) return;

            const btn = formLoteDet.querySelector('button');
            const txtOriginal = btn.textContent;
            btn.textContent = 'Salvando...';
            btn.disabled = true;

            try {
                const res = await fetch('/api/entregas/bulk-update-remetente', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ entrega_ids: todosIds, novo_remetente_id: novoRemetente })
                });
                
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);

                msgLoteDet.textContent = 'Sucesso! Atualizando...';
                msgLoteDet.style.color = 'green';
                
                setTimeout(async () => {
                    modalLoteDet.style.display = 'none';
                    btn.textContent = txtOriginal;
                    btn.disabled = false;
                    
                    // Recarrega os detalhes da carga atual
                    if (cargaAtual && cargaAtual.detalhes_carga) {
                        await abrirModalDetalhes(cargaAtual.detalhes_carga.id, false);
                    }
                }, 1000);

            } catch (err) {
                msgLoteDet.textContent = 'Erro: ' + err.message;
                msgLoteDet.style.color = 'red';
                btn.textContent = txtOriginal;
                btn.disabled = false;
            }
        });
    }

    if (btnFecharLoteDet) btnFecharLoteDet.addEventListener('click', () => modalLoteDet.style.display = 'none');

    // Inicialização correta (dentro do Listener)
    carregarDadosIniciais();

}); // Fim do document.addEventListener