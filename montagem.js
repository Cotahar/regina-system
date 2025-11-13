/*
* montagem.js (MÓDULO 4.2 - Edição de Remetente)
*/
document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores de Elementos ---
    const formAddEntrega = document.getElementById('form-add-entrega-disponivel');
    const selectRemetente = $('#select-remetente');
    const selectDestinatario = $('#select-destinatario');
    const inputPesoBruto = document.getElementById('entrega-peso-bruto');
    const inputValorFrete = document.getElementById('entrega-valor-frete');
	const inputValorTonelada = document.getElementById('entrega-valor-tonelada');
    const inputPesoCubado = document.getElementById('entrega-peso-cubado');
    const inputNotaFiscal = document.getElementById('entrega-nota-fiscal');
    const inputCidadeEntrega = document.getElementById('entrega-cidade');
    const inputEstadoEntrega = document.getElementById('entrega-estado');
    const mensagemCadastro = document.getElementById('mensagem-cadastro');

    const tabelaDisponiveisCorpo = document.getElementById('tabela-disponiveis-corpo');
    const inputPesquisaDisponiveis = document.getElementById('pesquisa-disponiveis');
	const inputFiltroRemetente = document.getElementById('filtro-remetente');
	const inputFiltroDestinatario = document.getElementById('filtro-destinatario');
	const inputFiltroCidade = document.getElementById('filtro-cidade');
	const inputFiltroEstado = document.getElementById('filtro-estado');
    const selectAllCheckbox = document.getElementById('select-all-disponiveis');

    const spanTotalEntregas = document.getElementById('total-entregas-selecionadas');
    const spanTotalPeso = document.getElementById('total-peso-selecionado');
    const spanTotalCubado = document.getElementById('total-cubado-selecionado');
    const spanTotalFrete = document.getElementById('total-frete-selecionado');
    const inputOrigemPrincipal = document.getElementById('input-origem-principal');
    const btnSalvarRascunho = document.getElementById('btn-salvar-rascunho');
    const mensagemMontagem = document.getElementById('mensagem-montagem');

    const listaRascunhosCorpo = document.getElementById('lista-rascunhos-corpo');
    const mensagemRascunho = document.getElementById('mensagem-rascunho');

    const modalEditarDisp = document.getElementById('modal-editar-entrega-disponivel');
    const formEditarDisp = document.getElementById('form-editar-entrega-disponivel');
    const btnFecharModalEditarDisp = document.getElementById('fechar-modal-editar-disponivel');
    const mensagemEdicaoDisp = document.getElementById('mensagem-edicao-disp');
    
    // ***** INÍCIO DAS ALTERAÇÕES *****
    const selectEditRemetente = $('#edit-disp-remetente'); // Novo seletor

    let listaClientesCompleta = [];
    let listaDeRemetentesSelect2 = []; // Lista global para os remetentes
    // ***** FIM DAS ALTERAÇÕES *****

    let entregasDisponiveis = [];
    let sessaoUsuario = null;
    let rascunhoCarregadoId = null;
	let sortState = {
        key: 'id', // Ordenação padrão por ID
        direction: 'asc'
    };

    // --- FUNÇÕES DE FORMATAÇÃO ---
    const formatarMoeda = (v) => (v === null || v === undefined) ? 'R$ 0,00' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const formatarPeso = (v) => (v === null || v === undefined || v == 0) ? '0,00 kg' : `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} kg`;
    const parseDecimal = (valor) => { if (typeof valor !== 'string' || !valor) return null; const v = valor.replace('R$ ', '').replace(/\./g, '').replace(',', '.'); const n = parseFloat(v); return isNaN(n) ? null : n; };
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
	const calcularFretePorTonelada = (pesoBrutoInput, pesoCubadoInput, tonInput, freteInput) => {
    const pesoBruto = parseDecimal(pesoBrutoInput.value) || 0;
    const pesoCubado = parseDecimal(pesoCubadoInput.value) || 0;
    const valorTon = parseDecimal(tonInput.value) || 0;

    // --- LÓGICA ATUALIZADA ---
    // Usa Peso Cubado se for > 0, senão usa Peso Bruto
    const pesoBase = (pesoCubado > 0) ? pesoCubado : pesoBruto;
    // --- FIM DA ATUALIZAÇÃO ---

    if (pesoBase > 0 && valorTon > 0) {
        const freteCalculado = (pesoBase / 1000) * valorTon;
        // Formata e insere no campo Frete
        freteInput.value = new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(freteCalculado);
    }
	};
    // --- FUNÇÕES DE CARREGAMENTO ---
    
    // ***** FUNÇÃO ALTERADA *****
    async function carregarClientes() { 
        try {
            const response = await fetch('/api/clientes');
            if (!response.ok) throw new Error('Falha ao buscar clientes');
            const clientesCompletos = await response.json();
            listaClientesCompleta = clientesCompletos;

            // Filtra e armazena globalmente a lista de remetentes
            listaDeRemetentesSelect2 = clientesCompletos
                .filter(c => c.is_remetente === true)
                .map(c => ({ id: c.id, text: c.text }));
            
            const dadosSelect2Destinatarios = clientesCompletos
                .filter(c => c.is_remetente === false)
                .map(c => ({ id: c.id, text: c.text }));

            selectRemetente.select2({ placeholder: 'Selecione o Remetente*', data: listaDeRemetentesSelect2, dropdownParent: $('#coluna-cadastro') });
            selectDestinatario.select2({ placeholder: 'Selecione o Destinatário*', data: dadosSelect2Destinatarios, dropdownParent: $('#coluna-cadastro') });
            
            // Inicializa o dropdown do modal (agora que temos a lista)
            selectEditRemetente.select2({ 
                placeholder: 'Selecione um remetente', 
                data: listaDeRemetentesSelect2, 
                dropdownParent: $('#modal-editar-entrega-disponivel') 
            });

            selectDestinatario.on('select2:select', (e) => { const cId = e.params.data.id; const c = listaClientesCompleta.find(cli => cli.id == cId); if (c) { inputCidadeEntrega.value = c.cidade || ''; inputEstadoEntrega.value = c.estado || ''; } });
            selectDestinatario.on('select2:unselect', () => { inputCidadeEntrega.value = ''; inputEstadoEntrega.value = ''; });
        } catch (error) { console.error("Erro ao carregar clientes:", error); }
    }
    // ***** FIM DAS ALTERAÇÕES *****
    
// --- FUNÇÃO DE RENDERIZAÇÃO (AGORA COM MULTI-FILTRO) ---
function renderizarTabelaDisponiveis() {
    tabelaDisponiveisCorpo.innerHTML = '';

    // 1. Pega o valor de todos os filtros
    const buscaGeral = inputPesquisaDisponiveis.value.toUpperCase();
    const filtroRemetente = inputFiltroRemetente.value.toUpperCase();
    const filtroDestinatario = inputFiltroDestinatario.value.toUpperCase();
    const filtroCidade = inputFiltroCidade.value.toUpperCase();
    const filtroEstado = inputFiltroEstado.value.toUpperCase();

    // 2. Filtra a lista principal
    const f = entregasDisponiveis.filter(e => {
        // Define os campos de busca (protegendo contra nulos)
        const rN = (e.remetente_nome || '').toUpperCase();
        const dN = (e.destinatario_nome || '').toUpperCase();
        const nF = (e.nota_fiscal || '').toUpperCase();
        const cE = (e.cidade_entrega || '').toUpperCase();
        const eE = (e.estado_entrega || '').toUpperCase();

        // 3. Verifica se a entrega passa em TODOS os filtros

        // O Filtro Geral procura em 3 campos
        const passaGeral = (buscaGeral === '') || rN.includes(buscaGeral) || dN.includes(buscaGeral) || nF.includes(buscaGeral);

        // Os filtros específicos
        const passaRemetente = (filtroRemetente === '') || rN.includes(filtroRemetente);
        const passaDestinatario = (filtroDestinatario === '') || dN.includes(filtroDestinatario);
        const passaCidade = (filtroCidade === '') || cE.includes(filtroCidade);
        const passaEstado = (filtroEstado === '') || eE.includes(filtroEstado);

        return passaGeral && passaRemetente && passaDestinatario && passaCidade && passaEstado;
    });
	f.sort((a, b) => {
        let valA = a[sortState.key] || '';
        let valB = b[sortState.key] || '';
        
        // Trata strings
        if (typeof valA === 'string') {
            valA = valA.toUpperCase();
            valB = (valB || '').toUpperCase();
        }
        
        let comparison = 0;
        if (valA > valB) {
            comparison = 1;
        } else if (valA < valB) {
            comparison = -1;
        }
        
        return (sortState.direction === 'asc' ? comparison : -comparison);
    });

    if (f.length === 0) {
        tabelaDisponiveisCorpo.innerHTML = '<tr><td colspan="7">Nenhuma entrega disponível encontrada para estes filtros.</td></tr>';
        return;
    }

    f.forEach(e => {
        const tr = document.createElement('tr');
        tr.dataset.id = e.id;
        if (e.selecionada) { tr.classList.add('highlight-row'); }
        tr.innerHTML = `
            <td><input type="checkbox" class="select-entrega" data-id="${e.id}" ${e.selecionada ? 'checked' : ''}></td>
            <td>${e.remetente_nome || 'N/A'}</td>
            <td>${e.destinatario_nome || 'N/A'}</td>
            <td>${e.cidade_entrega || 'N/A'}-${e.estado_entrega || 'N/A'}</td>
            <td>${formatarPeso(e.peso_bruto)}</td>
            <td>${e.nota_fiscal || 'N/A'}</td>
            <td>
                <button class="btn-editar btn-editar-disponivel" data-id="${e.id}">Editar</button>
                <button class="btn-excluir-entrega btn-excluir-disponivel" data-id="${e.id}">Excluir</button>
            </td>`;
        tabelaDisponiveisCorpo.appendChild(tr);
    });

    // 4. Re-anexa os listeners para os novos botões/checkboxes
    document.querySelectorAll('.select-entrega').forEach(cb => cb.addEventListener('change', atualizarTotaisMontagem));
    document.querySelectorAll('.btn-editar-disponivel').forEach(b => b.addEventListener('click', handleAbrirModalEditarDisp));
    document.querySelectorAll('.btn-excluir-disponivel').forEach(b => b.addEventListener('click', handleExcluirEntregaDisp));
}    
	async function carregarEntregasDisponiveis() { 
        try { 
            const r = await fetch('/api/entregas/disponiveis'); 
            if (!r.ok) throw new Error('Falha'); 
            entregasDisponiveis = await r.json(); 
            renderizarTabelaDisponiveis(); 
            atualizarTotaisMontagem(); 
        } catch (e) { 
            console.error(e); 
            tabelaDisponiveisCorpo.innerHTML = `<tr><td colspan="7">Erro ao carregar.</td></tr>`; 
        } 
    }
    async function carregarRascunhos() { try { const r = await fetch('/api/cargas/rascunhos'); if (!r.ok) throw new Error('Falha'); const rascs = await r.json(); listaRascunhosCorpo.innerHTML = ''; if (rascs.length === 0) { listaRascunhosCorpo.innerHTML = '<ul><li>Nenhum rascunho salvo.</li></ul>'; return; } const ul = document.createElement('ul'); rascs.forEach(rc => { const li = document.createElement('li'); li.innerHTML = `<span>${rc.codigo_carga} (${rc.origem}) - ${rc.num_entregas} entrega(s)</span><div><button class="btn-editar btn-carregar-rascunho" data-id="${rc.id}">Carregar</button><button class="btn-acao-verde btn-confirmar-rascunho" data-id="${rc.id}">Confirmar</button><button class="btn-excluir-entrega btn-excluir-rascunho" data-id="${rc.id}">Excluir</button></div>`; ul.appendChild(li); }); listaRascunhosCorpo.appendChild(ul); document.querySelectorAll('.btn-carregar-rascunho').forEach(b => b.addEventListener('click', handleCarregarRascunho)); document.querySelectorAll('.btn-confirmar-rascunho').forEach(b => b.addEventListener('click', handleConfirmarRascunho)); document.querySelectorAll('.btn-excluir-rascunho').forEach(b => b.addEventListener('click', handleExcluirRascunho)); } catch (e) { console.error(e); exibirMensagem(mensagemRascunho, `Erro ao carregar rascunhos: ${e.message}`, 'erro'); } }
    
    async function handleCarregarRascunho(event) {
         const cargaId = event.target.dataset.id;
         exibirMensagem(mensagemRascunho, `Carregando rascunho ${cargaId}...`, 'aviso');
        try {
            const rascunhoRes = await fetch(`/api/cargas/${cargaId}`);
            if (!rascunhoRes.ok) throw new Error('Falha ao carregar detalhes');
            const rascunhoDetalhes = await rascunhoRes.json();
            const entregasDoRascunho = (rascunhoDetalhes.entregas || []).map(e => ({
                id: e.id, remetente_id: e.remetente_id, cliente_id: e.cliente_id, remetente_nome: e.remetente_nome,
                destinatario_nome: e.razao_social, cidade_entrega: e.cidade, estado_entrega: e.estado,
                cidade_entrega_override: e.cidade_entrega_override, estado_entrega_override: e.estado_entrega_override,
                peso_bruto: e.peso_bruto, valor_frete: e.valor_frete, peso_cubado: e.peso_cubado,
                nota_fiscal: e.nota_fiscal, selecionada: true 
            }));
            const disponiveisRes = await fetch('/api/entregas/disponiveis');
            if (!disponiveisRes.ok) throw new Error('Falha ao carregar disponíveis');
            const entregasDisponiveisAtuais = await disponiveisRes.json();
            const idsEntregasRascunho = new Set(entregasDoRascunho.map(e => e.id));
            const entregasDisponiveisFiltradas = entregasDisponiveisAtuais.filter(e => !idsEntregasRascunho.has(e.id));
            entregasDisponiveis = [...entregasDoRascunho, ...entregasDisponiveisFiltradas];
            inputOrigemPrincipal.value = rascunhoDetalhes.detalhes_carga.origem || '';
            rascunhoCarregadoId = cargaId;
            btnSalvarRascunho.textContent = 'Atualizar Rascunho'; 
            renderizarTabelaDisponiveis();
            atualizarTotaisMontagem();
            exibirMensagem(mensagemRascunho, `Rascunho ${rascunhoDetalhes.detalhes_carga.codigo_carga} carregado.`);
            inputOrigemPrincipal.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (error) {
             console.error("Erro ao carregar rascunho:", error);
             exibirMensagem(mensagemRascunho, `Erro ao carregar rascunho: ${error.message}`, 'erro');
             rascunhoCarregadoId = null;
             btnSalvarRascunho.textContent = 'Salvar Rascunho';
        }
    }



    // --- FUNÇÕES DE AÇÃO / MANIPULAÇÃO ---
    function exibirMensagem(el, msg, tipo='sucesso') { el.textContent=msg; el.style.color=tipo==='erro'?'#ef4444':(tipo==='aviso'?'#fde047':'#22c55e'); if(tipo!=='aviso'){setTimeout(()=>{if(el.textContent===msg){el.textContent='';}},5000);} }
    async function handleAddEntrega(event) { event.preventDefault(); const d={remetente_id:selectRemetente.val(),cliente_id:selectDestinatario.val(),peso_bruto:parseDecimal(inputPesoBruto.value),valor_frete:parseDecimal(inputValorFrete.value),peso_cubado:parseDecimal(inputPesoCubado.value),nota_fiscal:inputNotaFiscal.value.toUpperCase()||null,cidade_entrega:inputCidadeEntrega.value.toUpperCase()||null,estado_entrega:inputEstadoEntrega.value.toUpperCase()||null}; if(!d.remetente_id||!d.cliente_id||d.peso_bruto===null){exibirMensagem(mensagemCadastro,'Remetente, Destinatário e Peso Bruto são obrigatórios.','erro'); return;} try {const r=await fetch('/api/entregas/disponiveis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}); const res=await r.json(); if(!r.ok) throw new Error(res.error||'Falha ao adicionar entrega'); exibirMensagem(mensagemCadastro,res.message); formAddEntrega.reset(); selectRemetente.val(null).trigger('change'); selectDestinatario.val(null).trigger('change'); await carregarEntregasDisponiveis();} catch(e){exibirMensagem(mensagemCadastro,`Erro: ${e.message}`,'erro');} }
function atualizarTotaisMontagem() { 
        const cS=document.querySelectorAll('.select-entrega:checked'); 
        let tE=0,tP=0,tC=0,tF=0; 
        cS.forEach(cb=>{
            const eId=cb.dataset.id; 
            const e=entregasDisponiveis.find(en=>en.id==parseInt(eId)); 
            if(e){
                tE++;
                tP+=e.peso_bruto||0;
                
                // --- CORREÇÃO AQUI ---
                tC += (e.peso_cubado || e.peso_bruto || 0); 
                // --- FIM DA CORREÇÃO ---
                
                tF+=e.valor_frete||0; 
                cb.closest('tr').classList.add('highlight-row');
            } else {
                console.warn(`Não foi possível encontrar a entrega com ID ${eId} na lista 'entregasDisponiveis'.`);
            }
        }); 
        document.querySelectorAll('.select-entrega:not(:checked)').forEach(cb=>{cb.closest('tr').classList.remove('highlight-row');}); 
        spanTotalEntregas.textContent=tE; 
        spanTotalPeso.textContent=formatarPeso(tP); 
        spanTotalCubado.textContent=formatarPeso(tC); // Agora usará o cálculo corrigido
        spanTotalFrete.textContent=formatarMoeda(tF); 
        
        // --- INÍCIO DA CORREÇÃO DE FOCO ---
        // 1. Remove a classe de erro assim que o usuário digita algo
        if (inputOrigemPrincipal && inputOrigemPrincipal.value.trim() !== '') {
            inputOrigemPrincipal.classList.remove('input-error');
        }
        
        // 2. O botão agora só depende de ter entregas selecionadas
        btnSalvarRascunho.disabled = !(tE > 0); 
        // --- FIM DA CORREÇÃO DE FOCO ---
    }
async function handleSalvarRascunho() {
        const oP = inputOrigemPrincipal.value.toUpperCase();
        
        // --- INÍCIO DA CORREÇÃO DE FOCO ---
        if (!oP) { 
            exibirMensagem(mensagemMontagem, 'Informe a Origem Principal da Carga.', 'erro'); 
            inputOrigemPrincipal.classList.add('input-error'); // Adiciona borda vermelha
            inputOrigemPrincipal.focus(); // Foca no campo para o usuário
            return; // Para a execução
        }
        // --- FIM DA CORREÇÃO DE FOCO ---
        
        const ids = Array.from(document.querySelectorAll('.select-entrega:checked')).map(cb => parseInt(cb.dataset.id));
        
        // Esta verificação agora é secundária, mas boa de manter
        if (ids.length === 0) { 
            exibirMensagem(mensagemMontagem, 'Selecione pelo menos uma entrega.', 'erro'); 
            return; 
        }
        
        const dados = { origem: oP, entrega_ids: ids }; 
        btnSalvarRascunho.textContent = 'Salvando...';
        btnSalvarRascunho.disabled = true;
        
        try {
            // ... (O restante da função continua igual) ...
            if (rascunhoCarregadoId) {
                exibirMensagem(mensagemMontagem, 'Atualizando... Liberando entregas do rascunho anterior.', 'aviso');
                const deleteRes = await fetch(`/api/cargas/${rascunhoCarregadoId}/rascunho`, { method: 'DELETE' });
                if (!deleteRes.ok) { const err = await deleteRes.json(); throw new Error(`Falha ao limpar rascunho anterior: ${err.error || 'Erro desconhecido'}`); }
            }
            exibirMensagem(mensagemMontagem, 'Criando novo rascunho com a seleção atual...', 'aviso');
            const r = await fetch('/api/cargas/montar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) }); 
            const res = await r.json();
            if (!r.ok) { throw new Error(res.error || `Erro HTTP ${r.status}`); }
            exibirMensagem(mensagemMontagem, res.message);
            inputOrigemPrincipal.value = '';
            selectAllCheckbox.checked = false;
            await carregarEntregasDisponiveis(); 
            await carregarRascunhos();
        } catch (e) {
            console.error("Erro ao salvar rascunho:", e);
            exibirMensagem(mensagemMontagem, `Erro: ${e.message}`, 'erro');
        } finally {
            rascunhoCarregadoId = null;
            btnSalvarRascunho.textContent = 'Salvar Rascunho';
            atualizarTotaisMontagem(); 
        }
    }    
    async function handleConfirmarRascunho(event) {
        const cargaId = event.target.dataset.id;
        if (!confirm(`Tem certeza que deseja confirmar o rascunho ${cargaId}? Ele será movido para Pendentes.`)) return;
        exibirMensagem(mensagemRascunho, `Confirmando rascunho ${cargaId}...`, 'aviso');
        try {
            const response = await fetch(`/api/cargas/${cargaId}/confirmar`, { method: 'PUT' });
            const resultado = await response.json();
            if (!response.ok) throw new Error(resultado.error || 'Falha ao confirmar');
            exibirMensagem(mensagemRascunho, resultado.message);
            await carregarRascunhos();
            if (rascunhoCarregadoId == cargaId) {
                rascunhoCarregadoId = null;
                btnSalvarRascunho.textContent = 'Salvar Rascunho';
                inputOrigemPrincipal.value = '';
                await carregarEntregasDisponiveis(); 
            }
        } catch(error) {
             exibirMensagem(mensagemRascunho, `Erro: ${error.message}`, 'erro');
        }
    }

    async function handleExcluirRascunho(event) {
        const cargaId = event.target.dataset.id;
        if (!confirm(`Tem certeza que deseja excluir o rascunho ${cargaId}? Suas entregas voltarão para disponíveis.`)) return;
        exibirMensagem(mensagemRascunho, `Excluindo rascunho ${cargaId}...`, 'aviso');
        try {
            const response = await fetch(`/api/cargas/${cargaId}/rascunho`, { method: 'DELETE' });
             const resultado = await response.json();
             if (!response.ok) throw new Error(resultado.error || 'Falha ao excluir');
             exibirMensagem(mensagemRascunho, resultado.message);
             if (rascunhoCarregadoId == cargaId) {
                rascunhoCarregadoId = null;
                btnSalvarRascunho.textContent = 'Salvar Rascunho';
                inputOrigemPrincipal.value = '';
             }
             await carregarEntregasDisponiveis();
             await carregarRascunhos(); 
        } catch(error) {
              exibirMensagem(mensagemRascunho, `Erro: ${error.message}`, 'erro');
        }
    }

    // ***** FUNÇÃO ALTERADA *****
    function handleAbrirModalEditarDisp(event) {
        const entregaId = event.target.dataset.id;
        const entrega = entregasDisponiveis.find(e => e.id == entregaId);
        if (!entrega) return;

        formEditarDisp.reset(); 
        mensagemEdicaoDisp.textContent = ''; 

        document.getElementById('edit-disp-entrega-id').value = entrega.id;
        
        // Remove o <p> e inicializa o <select>
        selectEditRemetente.val(entrega.remetente_id).trigger('change'); // Pré-seleciona o remetente
        
        document.getElementById('edit-disp-destinatario-nome').textContent = entrega.destinatario_nome || 'N/A';
		document.getElementById('edit-disp-peso-bruto').value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(entrega.peso_bruto || 0);
        document.getElementById('edit-disp-valor-frete').value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(entrega.valor_frete || 0);
        document.getElementById('edit-disp-peso-cubado').value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(entrega.peso_cubado || 0);
        document.getElementById('edit-disp-nota-fiscal').value = entrega.nota_fiscal || '';
        document.getElementById('edit-disp-cidade').value = entrega.cidade_entrega_override || ''; 
        document.getElementById('edit-disp-estado').value = entrega.estado_entrega_override || ''; 

        mascaraDecimal(document.getElementById('edit-disp-peso-bruto'));
        mascaraDecimal(document.getElementById('edit-disp-valor-frete'));
        mascaraDecimal(document.getElementById('edit-disp-peso-cubado'));

        modalEditarDisp.style.display = 'block';
    }
    
    // ***** FUNÇÃO ALTERADA *****
     async function handleSalvarEdicaoDisp(event) {
        event.preventDefault();
        const entregaId = document.getElementById('edit-disp-entrega-id').value;
        const dados = {
            // Adiciona o remetente_id ao salvar
            remetente_id: selectEditRemetente.val(),
            peso_bruto: parseDecimal(document.getElementById('edit-disp-peso-bruto').value),
            valor_frete: parseDecimal(document.getElementById('edit-disp-valor-frete').value),
            peso_cubado: parseDecimal(document.getElementById('edit-disp-peso-cubado').value),
            nota_fiscal: document.getElementById('edit-disp-nota-fiscal').value.toUpperCase() || null,
            cidade_entrega: document.getElementById('edit-disp-cidade').value.toUpperCase() || null,
            estado_entrega: document.getElementById('edit-disp-estado').value.toUpperCase() || null,
        };

        if (dados.peso_bruto === null || !dados.remetente_id) {
            exibirMensagem(mensagemEdicaoDisp, 'Remetente e Peso Bruto são obrigatórios.', 'erro');
            return;
        }

        try {
            const response = await fetch(`/api/entregas/${entregaId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            const resultado = await response.json();
            if (!response.ok) throw new Error(resultado.error || 'Falha ao salvar');

            exibirMensagem(mensagemEdicaoDisp, resultado.message);
            modalEditarDisp.style.display = 'none';
            
            // Se um rascunho estiver carregado, recarrega ele para refletir a mudança
            if (rascunhoCarregadoId) {
                 // Simula um clique no botão de carregar daquele rascunho
                 const btnCarregar = document.querySelector(`.btn-carregar-rascunho[data-id="${rascunhoCarregadoId}"]`);
                 if (btnCarregar) btnCarregar.click();
            } else {
                 await carregarEntregasDisponiveis(); // Apenas recarrega a lista
            }

        } catch (error) {
             exibirMensagem(mensagemEdicaoDisp, `Erro: ${error.message}`, 'erro');
        }
    }

    async function handleExcluirEntregaDisp(event) { const eId=event.target.dataset.id; if(!confirm('Tem certeza que deseja excluir esta entrega disponível?')) return; try {const r=await fetch(`/api/entregas/disponiveis/${eId}`,{method:'DELETE'}); const res=await r.json(); if(!r.ok) throw new Error(res.error||'Falha ao excluir'); exibirMensagem(mensagemMontagem,res.message); await carregarEntregasDisponiveis();} catch(e){exibirMensagem(mensagemMontagem,`Erro: ${e.message}`,'erro');} }
	function inicializarSortersTabela() {
        document.querySelectorAll('#tabela-disponiveis th[data-sort-key]').forEach(header => {
            header.style.userSelect = 'none'; // Impede seleção de texto ao clicar
            header.addEventListener('click', () => {
                const sortKey = header.dataset.sortKey;
                
                // 1. Define a nova direção
                if (sortState.key === sortKey) {
                    // Se já está clicado, inverte a direção
                    sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    // Se é uma nova coluna, reseta para 'asc'
                    sortState.key = sortKey;
                    sortState.direction = 'asc';
                }
                
                // 2. Atualiza o visual dos cabeçalhos (remove setas antigas)
                document.querySelectorAll('#tabela-disponiveis th[data-sort-key]').forEach(th => {
                    th.textContent = th.textContent.replace(' ▾', '').replace(' ▴', '');
                });
                
                // 3. Adiciona a seta nova
                header.textContent += (sortState.direction === 'asc' ? ' ▴' : ' ▾');

                // 4. Re-renderiza a tabela com a nova ordem
                renderizarTabelaDisponiveis();
            });
        });
    }
    // --- LISTENERS GERAIS ---
    if (formAddEntrega) formAddEntrega.addEventListener('submit', handleAddEntrega);
    if (inputPesquisaDisponiveis) inputPesquisaDisponiveis.addEventListener('input', renderizarTabelaDisponiveis);
	if (inputFiltroRemetente) inputFiltroRemetente.addEventListener('input', renderizarTabelaDisponiveis);
	if (inputFiltroDestinatario) inputFiltroDestinatario.addEventListener('input', renderizarTabelaDisponiveis);
	if (inputFiltroCidade) inputFiltroCidade.addEventListener('input', renderizarTabelaDisponiveis);
	if (inputFiltroEstado) inputFiltroEstado.addEventListener('input', renderizarTabelaDisponiveis);
	const vTonListener = () => calcularFretePorTonelada(inputPesoBruto, inputValorTonelada, inputValorFrete);
	if (inputValorTonelada) inputValorTonelada.addEventListener('blur', vTonListener);
	if (inputPesoBruto) inputPesoBruto.addEventListener('blur', vTonListener);
	if (inputPesoCubado) inputPesoCubado.addEventListener('blur', vTonListener);
    if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', (e) => { document.querySelectorAll('.select-entrega').forEach(cb => { cb.checked = e.target.checked; }); atualizarTotaisMontagem(); });
    if (inputOrigemPrincipal) inputOrigemPrincipal.addEventListener('input', atualizarTotaisMontagem);
    if (btnSalvarRascunho) btnSalvarRascunho.addEventListener('click', handleSalvarRascunho); else console.error("Elemento btn-salvar-rascunho não encontrado");
    if (formEditarDisp) formEditarDisp.addEventListener('submit', handleSalvarEdicaoDisp);
    if (btnFecharModalEditarDisp) btnFecharModalEditarDisp.addEventListener('click', () => modalEditarDisp.style.display = 'none');
    document.addEventListener('keydown', (event) => { if (event.key === "Escape" && modalEditarDisp && modalEditarDisp.style.display === 'block') { modalEditarDisp.style.display = 'none'; } });

    // --- INICIALIZAÇÃO ---
    try {
        mascaraDecimal(inputPesoBruto); mascaraDecimal(inputValorFrete); mascaraDecimal(inputPesoCubado);
        mascaraDecimal(inputValorTonelada);
		carregarClientes(); // <-- Esta função agora também inicializa o select do modal
        carregarEntregasDisponiveis();
        carregarRascunhos();
		inicializarSortersTabela();
      fetch('/api/session').then(res => res.json()).then(data => {
        if(typeof sessaoUsuario !== 'undefined') sessaoUsuario = data; 
        
        if (data.user_permission === 'admin') {
            const navAdmin = document.getElementById('nav-admin-dropdown'); 
            if(navAdmin) {
                navAdmin.innerHTML = `<a href="/usuarios.html">Usuários</a>`; 
            }
        }
    }).catch(err => console.error("Erro ao buscar sessão:", err));
    } catch (initError) {
        console.error("Erro durante a inicialização:", initError);
    }
});