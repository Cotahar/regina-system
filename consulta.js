/*
* consulta.js (ATUALIZADO PARA V2 - MÓDULO 4 - CORREÇÃO ESTILO BOTÃO DEVOLVER)
*/
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
	const selectEditRemetente = $('#edit-remetente-carga');
	let listaDeRemetentesSelect2 = [];
    let listaDeMotoristas = [];
    let listaDeVeiculos = [];
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
			// Formata e insere no campo Frete
			freteInput.value = new Intl.NumberFormat('pt-BR', {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			}).format(freteCalculado);
		}
	};
    // --- LÓGICA DE MODAIS ---
	const fecharModais = () => {
        modalDetalhes.style.display = 'none';
        modalEditarEntrega.style.display = 'none';
    };
    document.getElementById('fechar-modal-detalhes').addEventListener('click', fecharModais);
    document.getElementById('fechar-modal-editar-entrega').addEventListener('click', () => modalEditarEntrega.style.display = 'none');

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
        const params = new URLSearchParams({ page });
        const codigo = document.getElementById('filtro-codigo').value;
        const motorista = document.getElementById('filtro-motorista').value;
        const placa = document.getElementById('filtro-placa').value;
        const origem = document.getElementById('filtro-origem').value;
        const status = document.getElementById('filtro-status').value;
        const clienteId = document.getElementById('filtro-cliente').value;
        const dataCarregamentoInicio = document.getElementById('filtro-data-carregamento-inicio').value;
        const dataCarregamentoFim = document.getElementById('filtro-data-carregamento-fim').value;
        const dataFinalizacaoInicio = document.getElementById('filtro-data-finalizacao-inicio').value;
        const dataFinalizacaoFim = document.getElementById('filtro-data-finalizacao-fim').value;

        if (codigo) params.append('codigo_carga', codigo);
        if (motorista) params.append('motorista', motorista);
        if (placa) params.append('placa', placa);
        if (origem) params.append('origem', origem);
        if (status) params.append('status', status);
        if (clienteId) params.append('cliente_id', clienteId);
        
        // --- INÍCIO DA CORREÇÃO DO FILTRO DE DATA ---
        if (dataCarregamentoInicio) {
            params.append('data_carregamento_inicio', dataCarregamentoInicio);
        }
        if (dataCarregamentoFim) {
            params.append('data_carregamento_fim', dataCarregamentoFim);
        }
        if (dataFinalizacaoInicio) {
            params.append('data_finalizacao_inicio', dataFinalizacaoInicio);
        }
        if (dataFinalizacaoFim) {
            params.append('data_finalizacao_fim', dataFinalizacaoFim);
        }
        // --- FIM DA CORREÇÃO DO FILTRO DE DATA ---

        mensagemDiv.textContent = 'Buscando...';
        tabelaCorpo.innerHTML = `<tr><td colspan="8">Buscando...</td></tr>`;
        paginacaoContainer.innerHTML = '';
        
        // ... (o restante da função try/catch continua idêntico) ...
        try {
            const response = await fetch(`/api/cargas/consulta?${params.toString()}`);
            if (!response.ok) throw new Error('Falha na busca.');

            const { cargas, total_paginas, pagina_atual, total_resultados } = await response.json();
            mensagemDiv.textContent = `${total_resultados} resultado(s) encontrado(s).`;

            if (cargas.length === 0) {
                tabelaCorpo.innerHTML = `<tr><td colspan="8">Nenhuma carga encontrada com os filtros informados.</td></tr>`;
                return;
            }

            tabelaCorpo.innerHTML = '';
            cargas.forEach(carga => {
                const tr = document.createElement('tr');
                tr.dataset.id = carga.id;
                tr.style.cursor = 'pointer';
                
                // O backend envia o destino principal neste campo
                const destinoExibir = carga.destino_principal || 'N/A';
                
                tr.innerHTML = `
                    <td>${carga.codigo_carga}</td>
                    <td>${carga.status}</td>
                    <td>${carga.origem}</td>
                    <td>${destinoExibir}</td>
                    <td>${carga.motorista_nome || 'N/A'}</td> 
                    <td>${carga.num_entregas}</td>
                    <td>${formatarPeso(carga.peso_total_bruto)}</td>
                    <td>${formatarData(carga.data_finalizacao)}</td>
                `;
                tabelaCorpo.appendChild(tr);
            });
            renderizarPaginacao(total_paginas, pagina_atual);
        } catch (error) {
            mensagemDiv.textContent = 'Erro ao realizar a busca.';
            console.error('Erro na busca:', error);
            tabelaCorpo.innerHTML = `<tr><td colspan="8">Ocorreu um erro ao buscar os dados.</td></tr>`;
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
    };  reabrirFormularioEntrega = false

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

    // --- FUNÇÃO ATUALIZADA PARA V2 (Bug 3 - Agrupamento) ---
function renderizarModalDetalhes(reabrirFormularioEntrega = false) {
        const { detalhes_carga, entregas } = cargaAtual;
        const statusClass = detalhes_carga.status.toLowerCase().replace(/\s+/g, '-');
        const podeEditarGeral = ['admin', 'operador'].includes(sessaoUsuario.user_permission);
        const podeEditarEntregas = podeEditarGeral && ['Pendente', 'Agendada'].includes(detalhes_carga.status);

		// --- LÓGICA DO BOTÃO DE ALERTA DE AVARIA ---
        let htmlAvariaAlert = '';
        if (detalhes_carga.tem_avaria) {
            htmlAvariaAlert = `
                <a href="/avarias.html?consultar_carga_id=${detalhes_carga.id}" 
				   target="_blank"
                   style="color: #dc2626; font-weight: bold; margin-left: 15px; text-decoration: underline; cursor: pointer; font-size: 1.1em;"
                   title="Clique para ver os detalhes das avarias">
                   ⚠️ Avaria Registrada
                </a>`;
        }
        // -------------------------------------------
		
        // Agrupa entregas por Remetente
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

        // --- LÓGICA DE AGRUPAMENTO (Bug 3) ---
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
        // --- FIM DA LÓGICA DE AGRUPAMENTO ---

        const pesoTotalGeral = entregas.reduce((acc, e) => acc + (e.peso_bruto || 0), 0);
        // --- CÁLCULO (JÁ CORRIGIDO) ---
        const cubadoTotalGeral = entregas.reduce((acc, e) => acc + (e.peso_cubado || e.peso_bruto || 0), 0);
        // --- FIM DO CÁLCULO ---
        const freteTotalGeral = entregas.reduce((acc, e) => acc + (e.valor_frete || 0), 0);
        let secaoDados, secaoAcoes;

        // --- Lógica de renderização por Status (ATUALIZADA) ---
        // (IDÊNTICA AO script.js, pois o modal é o mesmo)
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
            ${(sessaoUsuario.user_permission === 'admin') ? 
                `<button class="btn-acao-secundario" data-acao="regredir-para-agendada">Devolver para Agendada</button>` : ''}
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
            secaoAcoes = ''; // Padrão
				if (sessaoUsuario.user_permission === 'admin') {
					secaoAcoes = `<div class="detalhes-secao"><h4>Ações de Status (Admin)</h4><div class="acoes-container">
						<button class="btn-acao-secundario" data-acao="regredir-para-transito">Devolver para Em Trânsito</button>
					</div></div>`;
				}
        }

        // ***** INÍCIO DA ALTERAÇÃO DOS BOTÕES (IDÊNTICA AO script.js) *****
        let botoesEntregaHtml = '';
        if (podeEditarEntregas) {
            // Botão V2.1 (Devolver para Montagem) - *** CLASSE ALTERADA AQUI ***
            botoesEntregaHtml += `<button id="btn-devolver-rascunho" class="btn-navegacao">Editar Carga na Montagem</button>`;
            // Botão V1 (Coleta Rápida)
            botoesEntregaHtml += `<button id="btn-add-entrega" class="btn-acao">+ Coleta Rápida (V1)</button>`;
        }
        // ***** FIM DA ALTERAÇÃO DOS BOTÕES *****
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
		
        detalhesConteudo.innerHTML = `
            <div id="detalhes-header" style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center;">
                  <h2>${detalhes_carga.codigo_carga}</h2>
                  ${htmlAvariaAlert} </div>
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
                <div class="tabela-wrapper"><table id="tabela-entregas">
                    <thead><tr>
                        ${podeEditarEntregas ? '<th>Destino</th>': ''}
                        <th>Cliente</th><th>Cidade/UF</th><th>Peso Total</th><th>Frete Total</th><th>Telefone</th><th>Observações</th>
                        ${podeEditarGeral ? '<th>Ações</th>': ''}
                    </tr></thead>
                    <tbody id="tabela-entregas-corpo"></tbody>
                </table></div>
            </div>`;

        const tabelaCorpoEntregas = document.getElementById('tabela-entregas-corpo');
        tabelaCorpoEntregas.innerHTML = '';
        
        // --- INÍCIO DA CORREÇÃO DE ORDENAÇÃO (BUG 5) ---
        // 1. Converte o objeto de grupos em um array
        const gruposOrdenados = Object.values(entregasAgrupadas);
        
        // 2. Ordena o array pela razao_social
        gruposOrdenados.sort((a, b) => {
            return (a.razao_social || '').localeCompare(b.razao_social || '');
        });
        
        // 3. Itera sobre o array JÁ ORDENADO
        if (gruposOrdenados.length > 0) {
             gruposOrdenados.forEach((grupo, index) => {
        // --- FIM DA CORREÇÃO DE ORDENAÇÃO (BUG 5) ---
                const isChecked = grupo.sub_entregas.some(se => se.is_last_delivery);
                const radioId = `ultima-entrega-grupo-${grupo.id}`; 
                const trGrupo = document.createElement('tr');
                trGrupo.classList.add('linha-grupo-entrega');
                trGrupo.innerHTML = `
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
                const colspanCount = podeEditarGeral ? (podeEditarEntregas ? 8 : 7) : 6;
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
            const colspanCount = podeEditarGeral ? (podeEditarEntregas ? 8 : 7) : 6;
            tabelaCorpoEntregas.innerHTML = `<tr><td colspan="${colspanCount}">Nenhuma entrega adicionada.</td></tr>`;
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
                if (idEntregaDoGrupo) {
                    await handleMarcarUltimaEntrega(idEntregaDoGrupo);
                } else {
                     alert('Erro: Não foi possível identificar a entrega para este grupo.');
                     event.target.checked = false;
                }
             });
        });

        configurarEventListenersDeAcoesGerais();
        mascaraDecimal(document.getElementById('detalhe-frete-pago'));
        if (reabrirFormularioEntrega) {
            const btnAddEntrega = document.getElementById('btn-add-entrega');
            if (btnAddEntrega) btnAddEntrega.click();
        }
    }
    // Módulo 4: Separação dos Listeners
    function configurarEventListenersDeAcoesGerais() {
        document.querySelector('[data-acao="salvar"]')?.addEventListener('click', handleSalvarAlteracoes);
        document.querySelector('[data-acao="agendar"]')?.addEventListener('click', handleAgendar);
        document.querySelector('[data-acao="iniciar-transito"]')?.addEventListener('click', handleIniciarTransito);
        document.querySelector('[data-acao="cancelar-agendamento"]')?.addEventListener('click', handleCancelarAgendamento);
        document.querySelector('[data-acao="finalizar"]')?.addEventListener('click', handleFinalizarCarga);
        document.querySelector('[data-acao="regredir-para-agendada"]')?.addEventListener('click', handleRegredirParaAgendada);
        document.querySelector('[data-acao="regredir-para-transito"]')?.addEventListener('click', handleRegredirParaTransito);
        // Listener do botão V1 (Coleta Rápida)
        document.getElementById('btn-add-entrega')?.addEventListener('click', abrirFormAddEntregaV1);
        document.getElementById('btn-imprimir-espelho')?.addEventListener('click', handleImprimirEspelho);
        // ***** INÍCIO DO NOVO LISTENER (IDÊNTICO AO script.js) *****
        // Listener do botão V2.1 (Devolver para Montagem)
        document.getElementById('btn-devolver-rascunho')?.addEventListener('click', handleDevolverRascunho);
        // ***** FIM DO NOVO LISTENER *****
    }

    function abrirFormAddEntregaV1(e){
        // Esconde os dois botões de ação de entrega
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

        <input type="text" id="entrega-peso-cobrado-v1" placeholder="Peso Cobrado" inputmode="decimal">
        <button type="submit">Salvar Entrega</button>
        <button type="button" class="btn-navegacao-secundario" id="cancelar-add-entrega-v1">Cancelar</button>
		</form>`;
		
		$('#select-remetente-v1').select2({ 
        placeholder: 'Selecione o Remetente *', 
        dropdownParent: $('#form-add-entrega-container'), 
        data: listaDeRemetentesSelect2 
		});
		$('#select-cliente-v1').select2({ placeholder: 'Selecione um cliente', dropdownParent: $('#form-add-entrega-container'), data: listaDeClientes });
		const pesoV1 = document.getElementById('entrega-peso-bruto-v1');
		const tonV1 = document.getElementById('entrega-valor-tonelada-v1');
		const freteV1 = document.getElementById('entrega-valor-frete-v1');
		const vTonListenerV1 = () => calcularFretePorTonelada(pesoV1, tonV1, freteV1);
		tonV1.addEventListener('blur', vTonListenerV1);
		pesoV1.addEventListener('blur', vTonListenerV1);

		mascaraDecimal(pesoV1);
		mascaraDecimal(freteV1);
		mascaraDecimal(tonV1);
		mascaraDecimal(document.getElementById('entrega-peso-cobrado-v1'));
        document.getElementById('form-nova-entrega').addEventListener('submit', salvarNovaEntregaV1);
        document.getElementById('cancelar-add-entrega-v1').addEventListener('click', () => {
             container.innerHTML = '';
             // Mostra os dois botões novamente
             document.getElementById('btn-add-entrega').style.display = 'inline-flex';
             if (btnDevolver) btnDevolver.style.display = 'inline-flex';
        });
    }

     // --- FUNÇÃO PARA ABRIR MODAL DE EDIÇÃO DE LINHA DE ENTREGA ---
    function abrirModalEdicaoEntrega(e) {
        const entregaId = e.target.dataset.id;
        const entrega = cargaAtual.entregas.find(ent => ent.id == entregaId);
        if (!entrega) { alert('Erro: Entrega não encontrada.'); return; }

        document.getElementById('edit-entrega-id').value = entrega.id;
		selectEditRemetente.val(entrega.remetente_id).trigger('change'); // <-- ADICIONE ESTA LINHA
		document.getElementById('edit-peso-bruto').value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(entrega.peso_bruto || 0);
        document.getElementById('edit-valor-frete').value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(entrega.valor_frete || 0);
        document.getElementById('edit-peso-cobrado').value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(entrega.peso_cubado || 0); // Corrigido para peso_cubado
        document.getElementById('edit-cidade-entrega').value = entrega.cidade_entrega_override || '';
        document.getElementById('edit-estado-entrega').value = entrega.estado_entrega_override || '';
		document.getElementById('edit-nota-fiscal').value = entrega.nota_fiscal || '';
        const isAdmin = sessaoUsuario.user_permission === 'admin';
        document.getElementById('edit-cidade-entrega').disabled = !isAdmin;
        document.getElementById('edit-estado-entrega').disabled = !isAdmin;

        mascaraDecimal(document.getElementById('edit-peso-bruto'));
        mascaraDecimal(document.getElementById('edit-valor-frete'));
        mascaraDecimal(document.getElementById('edit-peso-cobrado'));

        modalEditarEntrega.style.display = 'block';
    }

    // ***** INÍCIO DA NOVA FUNÇÃO (IDÊNTICA AO script.js) *****
    async function handleDevolverRascunho() {
        const cargaId = cargaAtual.detalhes_carga.id;
        if (!confirm(`Tem certeza que deseja devolver a carga ${cargaAtual.detalhes_carga.codigo_carga} para Rascunho?\n\nEla sairá desta tela e aparecerá na Montagem de Carga.`)) return;

        try {
            const response = await fetch(`/api/cargas/${cargaId}/devolver-rascunho`, {
                method: 'PUT'
            });
            const resultado = await response.json();
            if (!response.ok) throw new Error(resultado.error || 'Falha ao devolver para rascunho.');

            alert(resultado.message); // Ex: "Carga devolvida... Redirecionando..."
            fecharModais();
            window.location.href = '/montagem.html'; // Redireciona o usuário

        } catch (error) {
            alert(`Erro: ${error.message}`);
        }
    }
    // ***** FIM DA NOVA FUNÇÃO *****

    async function handleMarcarUltimaEntrega(entregaIdParaMarcar) {
        try {
            const response = await fetch(`/api/entregas/${entregaIdParaMarcar}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_last_delivery: 1 })
            });
            if (!response.ok) throw new Error('Falha ao marcar como destino.');

            const formAberto = !!document.getElementById('form-nova-entrega');
            const cargaId = cargaAtual.detalhes_carga.id;
            await abrirModalDetalhes(cargaId, formAberto);
            // Recarrega a busca na página atual para refletir o destino principal na tabela
             buscarCargas(document.querySelector('.btn-paginacao.active')?.dataset.page || 1);

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
            await abrirModalDetalhes(cargaAtual.detalhes_carga.id, formAberto);
             buscarCargas(document.querySelector('.btn-paginacao.active')?.dataset.page || 1);
        } else { alert('Erro ao excluir entrega.'); }
    }

    async function salvarNovaEntregaV1(e) {
        e.preventDefault();
        const dados = {
			remetente_id: $('#select-remetente-v1').val(),
            cliente_id: $('#select-cliente-v1').val(),
            peso_bruto: parseDecimal(document.getElementById('entrega-peso-bruto-v1').value),
            valor_frete: parseDecimal(document.getElementById('entrega-valor-frete-v1').value),
            peso_cobrado: parseDecimal(document.getElementById('entrega-peso-cobrado-v1').value)
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
				// Se o campo de peso cobrado existir (só em consulta.js)
			const pesoCobradoV1 = document.getElementById('entrega-peso-cobrado-v1');
				if (pesoCobradoV1) pesoCobradoV1.value = '';
				} else {
					const err = await response.json();
					alert(`Erro ao salvar entrega: ${err.error || 'Erro desconhecido.'}`);
				}
    }

		document.getElementById('form-editar-entrega').addEventListener('submit', async (e) => {
        e.preventDefault();
        const entregaId = document.getElementById('edit-entrega-id').value;
        const dados = {
            remetente_id: selectEditRemetente.val(),
            peso_bruto: parseDecimal(document.getElementById('edit-peso-bruto').value),
            valor_frete: parseDecimal(document.getElementById('edit-valor-frete').value),
            peso_cubado: pesoCobradoInput ? parseDecimal(pesoCobradoInput.value) : undefined, // Envia como peso_cubado (se o backend esperar isso, ou ajustamos o backend para ler peso_cobrado e gravar em cubado)
            nota_fiscal: document.getElementById('edit-nota-fiscal').value, // NOVO
            cidade_entrega: document.getElementById('edit-cidade-entrega').value || null,
            estado_entrega: document.getElementById('edit-estado-entrega').value || null
        };
        if (dados.peso_bruto === null || dados.peso_bruto <= 0) {
            alert('Peso bruto é obrigatório e deve ser maior que zero.'); return;
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
            await abrirModalDetalhes(cargaAtual.detalhes_carga.id, formAberto);
             buscarCargas(document.querySelector('.btn-paginacao.active')?.dataset.page || 1);
        } catch (error) { alert(`Erro: ${error.message}`); }
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
            // --- INÍCIO DA CORREÇÃO ---
            let dados = {
                 observacoes: document.getElementById('obs-carga').value,
                 frete_pago: parseDecimal(document.getElementById('detalhe-frete-pago')?.value) || 0,
                 previsao_entrega: document.getElementById('detalhe-previsao')?.value || null
            };
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
        let dados = {
             observacoes: document.getElementById('obs-carga').value,
             frete_pago: parseDecimal(document.getElementById('detalhe-frete-pago')?.value) || 0,
             origem: document.getElementById('detalhe-origem').value,
             data_agendamento: dataAgendamento,
             motorista_id: $('#select-motorista').val() || null,
             veiculo_id: $('#select-veiculo').val() || null
        };
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
        let dados = {
             observacoes: document.getElementById('obs-carga').value,
             frete_pago: parseDecimal(document.getElementById('detalhe-frete-pago')?.value) || 0,
             previsao_entrega: document.getElementById('detalhe-previsao').value || null
        };
        const campoAgendamentoEdit = document.getElementById('detalhe-agendamento-edit');
        if (campoAgendamentoEdit) {
            dados.data_agendamento = campoAgendamentoEdit.value || null;
        }
        
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
            fecharModais();
            const paginaAtual = document.querySelector('.btn-paginacao.active')?.dataset.page || 1;
            buscarCargas(paginaAtual); // Atualiza a tabela da consulta
        } catch (error) {
            alert(`Não foi possível completar a ação: ${error.message}`);
        }
    }

     // --- Inicialização Select2 (Módulo 4) ---
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

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        buscarCargas(1);
    });

    form.addEventListener('reset', () => {
        $('#filtro-cliente').val(null).trigger('change');
        // form.reset(); // Não use form.reset() com select2, ele não limpa
        document.getElementById('form-consulta').reset(); // Limpa inputs nativos
        tabelaCorpo.innerHTML = '<tr><td colspan="8">Utilize os filtros acima para buscar as cargas.</td></tr>';
        paginacaoContainer.innerHTML = '';
        mensagemDiv.textContent = '';
    });

    tabelaCorpo.addEventListener('click', (event) => {
        const linha = event.target.closest('tr');
        if (linha && linha.dataset.id) {
            abrirModalDetalhes(linha.dataset.id, false);
        }
    });

    async function carregarDadosIniciaisConsulta() {
        try {
            const [sessionRes, clientesRes, motoristasRes, veiculosRes] = await Promise.all([
                 fetch('/api/session'),
                 fetch('/api/clientes'),
                 fetch('/api/motoristas'),
                 fetch('/api/veiculos')
            ]);
            if (!sessionRes.ok) { window.location.href = '/login.html'; return; }

            sessaoUsuario = await sessionRes.json();
            
            // Lógica do Menu Dropdown (Módulo 4.1)
            if (sessaoUsuario.user_permission === 'admin') {
                const navAdmin = document.getElementById('nav-admin-dropdown'); // Busca no dropdown
                if(navAdmin) {
                    navAdmin.innerHTML = `<a href="/usuarios.html">Usuários</a>`; // Insere link
                }
            }

            listaDeClientes = await clientesRes.json();
            listaDeMotoristas = await motoristasRes.json();
            listaDeVeiculos = await veiculosRes.json();
            
            // --- CÓDIGO SINCRONIZADO (igual ao script.js) ---
            listaDeRemetentesSelect2 = listaDeClientes
                .filter(c => c.is_remetente === true)
                .map(c => ({ id: c.id, text: c.text }));

            // Inicializa o dropdown escondido do modal de edição
            selectEditRemetente.select2({
                placeholder: 'Selecione um remetente',
                data: listaDeRemetentesSelect2,
                dropdownParent: $('#modal-editar-entrega') // Anexa ao modal
            });

            const filtroClienteSelect = $('#filtro-cliente');
            filtroClienteSelect.select2({
                placeholder: 'Todos os Clientes',
                allowClear: true,
                data: listaDeClientes
            });

        } catch (error) {
            console.error("Erro ao carregar dados iniciais da consulta:", error);
            mensagemDiv.textContent = "Erro ao carregar dados iniciais. Tente recarregar a página.";
        }
    }
	
	function handleImprimirEspelho() {
		if (!cargaAtual || !cargaAtual.detalhes_carga) return;
		const cargaId = cargaAtual.detalhes_carga.id;
		window.open(`/cargas/${cargaId}/espelho_impressao`, '_blank'); // <-- CORRIGIDO
	}
carregarDadosIniciaisConsulta();
    buscarCargas(1);

}); // Fecha o document.addEventListener