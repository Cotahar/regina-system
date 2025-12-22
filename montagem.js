/*
* montagem.js (CORRIGIDO: V7 - Sem Toggle, Com Agrupamento)
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
    
    const acoesLoteWrapper = document.getElementById('acoes-lote-wrapper');
    const btnAlterarRemetenteLote = document.getElementById('btn-alterar-remetente-lote');
    const contadorLote = document.getElementById('contador-lote');

    const modalLoteRemetente = document.getElementById('modal-editar-lote-remetente');
    const formLoteRemetente = document.getElementById('form-lote-remetente');
    const btnFecharModalLote = document.getElementById('fechar-modal-lote-remetente');
    const selectLoteRemetente = $('#select-lote-remetente');
    const loteQtdMsg = document.getElementById('lote-qtd-msg');
    const mensagemLote = document.getElementById('mensagem-lote');
    
    // --- Novos Seletores ---
    const selectEditRemetente = $('#edit-disp-remetente'); 
    const btnAgruparEntregas = document.getElementById('btn-agrupar-entregas');

    let listaClientesCompleta = [];
    let listaDeRemetentesSelect2 = []; 
    let entregasDisponiveis = [];
    let sessaoUsuario = null;
    let rascunhoCarregadoId = null;
    let sortState = { key: 'id', direction: 'asc' };

    // --- FUNÇÕES DE FORMATAÇÃO ---
    const formatarMoeda = (v) => (v === null || v === undefined) ? 'R$ 0,00' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const formatarPeso = (v) => (v === null || v === undefined || v == 0) ? '0,00 kg' : `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} kg`;
    const parseDecimal = (valor) => { if (typeof valor !== 'string' || !valor) return null; const v = valor.replace('R$ ', '').replace(/\./g, '').replace(',', '.'); const n = parseFloat(v); return isNaN(n) ? null : n; };
    
    const mascaraDecimal = (input) => {
        if (!input) return;
        input.addEventListener('input', (e) => {
            let v = e.target.value;
            v = v.replace(/[^\d,]/g, ''); 
            const parts = v.split(',');
            if (parts.length > 2) { v = parts[0] + ',' + parts.slice(1).join(''); }
            if (parts.length === 2 && parts[1].length > 2) { v = parts[0] + ',' + parts[1].substring(0, 2); }
            parts[0] = new Intl.NumberFormat('pt-BR').format(parseInt(parts[0].replace(/\D/g, ''), 10) || 0);
            e.target.value = parts.length > 1 ? parts.join(',') : parts[0];
        });
        input.addEventListener('blur', (e) => {
            let v = e.target.value;
            if (v === '') return;
            let num = parseDecimal(v); if (num === null) num = 0;
            e.target.value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
        });
    };

    const calcularFretePorTonelada = (pesoBrutoInput, pesoCubadoInput, tonInput, freteInput) => {
        const pesoBruto = parseDecimal(pesoBrutoInput.value) || 0;
        const pesoCubado = parseDecimal(pesoCubadoInput.value) || 0;
        const valorTon = parseDecimal(tonInput.value) || 0;
        const pesoBase = (pesoCubado > 0) ? pesoCubado : pesoBruto;
        if (pesoBase > 0 && valorTon > 0) {
            const freteCalculado = (pesoBase / 1000) * valorTon;
            freteInput.value = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(freteCalculado);
        }
    };

    // --- FUNÇÕES DE CARREGAMENTO ---
    async function carregarClientes() { 
        try {
            const response = await fetch('/api/clientes');
            if (!response.ok) throw new Error('Falha ao buscar clientes');
            const clientesCompletos = await response.json();
            listaClientesCompleta = clientesCompletos;

            listaDeRemetentesSelect2 = clientesCompletos.filter(c => c.is_remetente === true).map(c => ({ id: c.id, text: c.text }));
            const dadosSelect2Destinatarios = clientesCompletos.filter(c => c.is_remetente === false).map(c => ({ id: c.id, text: c.text }));

            selectRemetente.select2({ placeholder: 'Selecione o Remetente*', data: listaDeRemetentesSelect2, dropdownParent: $('#coluna-cadastro') });
            selectDestinatario.select2({ placeholder: 'Selecione o Destinatário*', data: dadosSelect2Destinatarios, dropdownParent: $('#coluna-cadastro') });
            selectEditRemetente.select2({ placeholder: 'Selecione um remetente', data: listaDeRemetentesSelect2, dropdownParent: $('#modal-editar-entrega-disponivel') });
            selectLoteRemetente.select2({ placeholder: 'Selecione o Novo Remetente', data: listaDeRemetentesSelect2, dropdownParent: $('#modal-editar-lote-remetente') });

            const fixFocus = () => setTimeout(() => document.querySelector('.select2-search__field')?.focus(), 50);
            selectLoteRemetente.on('select2:open', fixFocus);
            selectRemetente.on('select2:open', fixFocus);
            selectDestinatario.on('select2:open', fixFocus);
            $(document).on('select2:open', () => document.querySelector('.select2-search__field')?.focus());

            selectDestinatario.on('select2:select', (e) => { const cId = e.params.data.id; const c = listaClientesCompleta.find(cli => cli.id == cId); if (c) { inputCidadeEntrega.value = c.cidade || ''; inputEstadoEntrega.value = c.estado || ''; } });
            selectDestinatario.on('select2:unselect', () => { inputCidadeEntrega.value = ''; inputEstadoEntrega.value = ''; });

        } catch (error) { console.error("Erro ao carregar clientes:", error); }
    }
    
    // --- FUNÇÃO DE RENDERIZAÇÃO CORRIGIDA (SEM ERRO DE VARIÁVEL 'e') ---
    function renderizarTabelaDisponiveis() {
        tabelaDisponiveisCorpo.innerHTML = '';

        const buscaGeral = inputPesquisaDisponiveis.value.toUpperCase();
        const filtroRemetente = inputFiltroRemetente.value.toUpperCase();
        const filtroDestinatario = inputFiltroDestinatario.value.toUpperCase();
        const filtroCidade = inputFiltroCidade.value.toUpperCase();
        const filtroEstado = inputFiltroEstado.value.toUpperCase();

        const f = entregasDisponiveis.filter(e => {
            const rN = (e.remetente_nome || '').toUpperCase();
            const dN = (e.destinatario_nome || '').toUpperCase();
            const nF = (e.nota_fiscal || '').toUpperCase();
            const cE = (e.cidade_entrega || '').toUpperCase();
            const eE = (e.estado_entrega || '').toUpperCase();

            const passaGeral = (buscaGeral === '') || rN.includes(buscaGeral) || dN.includes(buscaGeral) || nF.includes(buscaGeral);
            const passaRemetente = (filtroRemetente === '') || rN.includes(filtroRemetente);
            const passaDestinatario = (filtroDestinatario === '') || dN.includes(filtroDestinatario);
            const passaCidade = (filtroCidade === '') || cE.includes(filtroCidade);
            const passaEstado = (filtroEstado === '') || eE.includes(filtroEstado);

            return passaGeral && passaRemetente && passaDestinatario && passaCidade && passaEstado;
        });

        f.sort((a, b) => {
            let valA = a[sortState.key] || '';
            let valB = b[sortState.key] || '';
            if (typeof valA === 'string') { valA = valA.toUpperCase(); valB = (valB || '').toUpperCase(); }
            return (sortState.direction === 'asc' ? (valA > valB ? 1 : (valA < valB ? -1 : 0)) : (valA > valB ? -1 : (valA < valB ? 1 : 0)));
        });

        if (f.length === 0) {
            tabelaDisponiveisCorpo.innerHTML = '<tr><td colspan="7">Nenhuma entrega disponível encontrada para estes filtros.</td></tr>';
            return;
        }

        f.forEach(e => { 
            const tr = document.createElement('tr');
            tr.dataset.id = e.id;
            if (e.selecionada) { tr.classList.add('highlight-row'); }
            
            // AQUI ESTAVA O ERRO! Agora usamos 'e.id' e adicionamos os metadados
            tr.innerHTML = `
                <td style="text-align: center;">
                    <input type="checkbox" class="select-entrega" data-id="${e.id}" data-cliente-id="${e.cliente_id}" data-remetente-id="${e.remetente_id}" ${e.selecionada ? 'checked' : ''}>
                </td>
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

    async function carregarRascunhos() { 
        try { 
            const r = await fetch('/api/cargas/rascunhos'); 
            if (!r.ok) throw new Error('Falha'); 
            const rascs = await r.json(); 
            listaRascunhosCorpo.innerHTML = ''; 
            if (rascs.length === 0) { listaRascunhosCorpo.innerHTML = '<ul><li>Nenhum rascunho salvo.</li></ul>'; return; } 
            const ul = document.createElement('ul'); 
            rascs.forEach(rc => { 
                const li = document.createElement('li'); 
                li.innerHTML = `<span>${rc.codigo_carga} (${rc.origem}) - ${rc.num_entregas} entrega(s)</span><div><button class="btn-editar btn-carregar-rascunho" data-id="${rc.id}">Carregar</button><button class="btn-acao-verde btn-confirmar-rascunho" data-id="${rc.id}">Confirmar</button><button class="btn-excluir-entrega btn-excluir-rascunho" data-id="${rc.id}">Excluir</button></div>`; 
                ul.appendChild(li); 
            }); 
            listaRascunhosCorpo.appendChild(ul); 
            document.querySelectorAll('.btn-carregar-rascunho').forEach(b => b.addEventListener('click', handleCarregarRascunho)); 
            document.querySelectorAll('.btn-confirmar-rascunho').forEach(b => b.addEventListener('click', handleConfirmarRascunho)); 
            document.querySelectorAll('.btn-excluir-rascunho').forEach(b => b.addEventListener('click', handleExcluirRascunho)); 
        } catch (e) { 
            console.error(e); exibirMensagem(mensagemRascunho, `Erro ao carregar rascunhos: ${e.message}`, 'erro'); 
        } 
    }
    
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

    function exibirMensagem(el, msg, tipo='sucesso') { el.textContent=msg; el.style.color=tipo==='erro'?'#ef4444':(tipo==='aviso'?'#fde047':'#22c55e'); if(tipo!=='aviso'){setTimeout(()=>{if(el.textContent===msg){el.textContent='';}},5000);} }
    
    async function handleAddEntrega(event) { event.preventDefault(); 
        const d={remetente_id:selectRemetente.val(),cliente_id:selectDestinatario.val(),peso_bruto:parseDecimal(inputPesoBruto.value),valor_frete:parseDecimal(inputValorFrete.value),peso_cubado:parseDecimal(inputPesoCubado.value),nota_fiscal:inputNotaFiscal.value.toUpperCase()||null,cidade_entrega:inputCidadeEntrega.value.toUpperCase()||null,estado_entrega:inputEstadoEntrega.value.toUpperCase()||null}; 
        if(!d.remetente_id||!d.cliente_id||d.peso_bruto===null){exibirMensagem(mensagemCadastro,'Remetente, Destinatário e Peso Bruto são obrigatórios.','erro'); return;}
        try {const r=await fetch('/api/entregas/disponiveis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
        const res=await r.json(); if(!r.ok) throw new Error(res.error||'Falha ao adicionar entrega'); exibirMensagem(mensagemCadastro,res.message);
        inputPesoBruto.value = ''; inputValorFrete.value = ''; inputValorTonelada.value = ''; inputPesoCubado.value = ''; inputNotaFiscal.value = '';
        inputPesoBruto.focus();
        await carregarEntregasDisponiveis();
        } catch(e){exibirMensagem(mensagemCadastro,`Erro: ${e.message}`,'erro');} 
    }
    
    function atualizarTotaisMontagem() { 
        const cS=document.querySelectorAll('.select-entrega:checked'); 
        let tE=0,tP=0,tC=0,tF=0; 
        cS.forEach(cb=>{
            const eId=cb.dataset.id; 
            const e=entregasDisponiveis.find(en=>en.id==parseInt(eId)); 
            if(e){
                tE++;
                tP+=e.peso_bruto||0;
                tC += (e.peso_cubado || e.peso_bruto || 0); 
                tF+=e.valor_frete||0; 
                cb.closest('tr').classList.add('highlight-row');
            }
        }); 
        document.querySelectorAll('.select-entrega:not(:checked)').forEach(cb=>{cb.closest('tr').classList.remove('highlight-row');}); 
        spanTotalEntregas.textContent=tE; 
        spanTotalPeso.textContent=formatarPeso(tP); 
        spanTotalCubado.textContent=formatarPeso(tC);
        spanTotalFrete.textContent=formatarMoeda(tF); 
        
        if (inputOrigemPrincipal && inputOrigemPrincipal.value.trim() !== '') { inputOrigemPrincipal.classList.remove('input-error'); }
        btnSalvarRascunho.disabled = !(tE > 0); 
        
        // Exibe o painel de lote se houver seleção (SEM esconder/mostrar a tabela)
        if (acoesLoteWrapper) {
            if (tE > 0) {
                acoesLoteWrapper.style.display = 'flex';
                contadorLote.textContent = tE;
            } else {
                acoesLoteWrapper.style.display = 'none';
            }
        }
    }

    async function handleSalvarRascunho() {
        const oP = inputOrigemPrincipal.value.toUpperCase();
        if (!oP) { 
            exibirMensagem(mensagemMontagem, 'Informe a Origem Principal da Carga.', 'erro'); 
            inputOrigemPrincipal.classList.add('input-error'); 
            inputOrigemPrincipal.focus(); 
            return; 
        }
        
        const ids = Array.from(document.querySelectorAll('.select-entrega:checked')).map(cb => parseInt(cb.dataset.id));
        if (ids.length === 0) { exibirMensagem(mensagemMontagem, 'Selecione pelo menos uma entrega.', 'erro'); return; }
        
        const dados = { origem: oP, entrega_ids: ids }; 
        btnSalvarRascunho.textContent = 'Salvando...'; btnSalvarRascunho.disabled = true;
        
        try {
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
            console.error("Erro ao salvar rascunho:", e); exibirMensagem(mensagemMontagem, `Erro: ${e.message}`, 'erro');
        } finally {
            rascunhoCarregadoId = null; btnSalvarRascunho.textContent = 'Salvar Rascunho'; atualizarTotaisMontagem(); 
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
                rascunhoCarregadoId = null; btnSalvarRascunho.textContent = 'Salvar Rascunho'; inputOrigemPrincipal.value = ''; await carregarEntregasDisponiveis(); 
            }
        } catch(error) { exibirMensagem(mensagemRascunho, `Erro: ${error.message}`, 'erro'); }
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
                rascunhoCarregadoId = null; btnSalvarRascunho.textContent = 'Salvar Rascunho'; inputOrigemPrincipal.value = '';
             }
             await carregarEntregasDisponiveis(); await carregarRascunhos(); 
        } catch(error) { exibirMensagem(mensagemRascunho, `Erro: ${error.message}`, 'erro'); }
    }

    function handleAbrirModalEditarDisp(event) {
        const entregaId = event.target.dataset.id;
        const entrega = entregasDisponiveis.find(e => e.id == entregaId);
        if (!entrega) return;
        formEditarDisp.reset(); mensagemEdicaoDisp.textContent = ''; 
        document.getElementById('edit-disp-entrega-id').value = entrega.id;
        selectEditRemetente.val(entrega.remetente_id).trigger('change'); 
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
    
     async function handleSalvarEdicaoDisp(event) {
        event.preventDefault();
        const entregaId = document.getElementById('edit-disp-entrega-id').value;
        const dados = {
            remetente_id: selectEditRemetente.val(),
            peso_bruto: parseDecimal(document.getElementById('edit-disp-peso-bruto').value),
            valor_frete: parseDecimal(document.getElementById('edit-disp-valor-frete').value),
            peso_cubado: parseDecimal(document.getElementById('edit-disp-peso-cubado').value),
            nota_fiscal: document.getElementById('edit-disp-nota-fiscal').value.toUpperCase() || null,
            cidade_entrega: document.getElementById('edit-disp-cidade').value.toUpperCase() || null,
            estado_entrega: document.getElementById('edit-disp-estado').value.toUpperCase() || null,
        };
        if (dados.peso_bruto === null || !dados.remetente_id) { exibirMensagem(mensagemEdicaoDisp, 'Remetente e Peso Bruto são obrigatórios.', 'erro'); return; }
        try {
            const response = await fetch(`/api/entregas/${entregaId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
            const resultado = await response.json();
            if (!response.ok) throw new Error(resultado.error || 'Falha ao salvar');
            exibirMensagem(mensagemEdicaoDisp, resultado.message); modalEditarDisp.style.display = 'none';
            if (rascunhoCarregadoId) {
                 const btnCarregar = document.querySelector(`.btn-carregar-rascunho[data-id="${rascunhoCarregadoId}"]`);
                 if (btnCarregar) btnCarregar.click();
            } else { await carregarEntregasDisponiveis(); }
        } catch (error) { exibirMensagem(mensagemEdicaoDisp, `Erro: ${error.message}`, 'erro'); }
    }

    async function handleExcluirEntregaDisp(event) { const eId=event.target.dataset.id; if(!confirm('Tem certeza que deseja excluir esta entrega disponível?')) return; try {const r=await fetch(`/api/entregas/disponiveis/${eId}`,{method:'DELETE'}); const res=await r.json(); if(!r.ok) throw new Error(res.error||'Falha ao excluir'); exibirMensagem(mensagemMontagem,res.message); await carregarEntregasDisponiveis();} catch(e){exibirMensagem(mensagemMontagem,`Erro: ${e.message}`,'erro');} }
    
    function inicializarSortersTabela() {
        document.querySelectorAll('#tabela-disponiveis th[data-sort-key]').forEach(header => {
            header.style.userSelect = 'none'; 
            header.addEventListener('click', () => {
                const sortKey = header.dataset.sortKey;
                if (sortState.key === sortKey) { sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc'; } else { sortState.key = sortKey; sortState.direction = 'asc'; }
                document.querySelectorAll('#tabela-disponiveis th[data-sort-key]').forEach(th => { th.textContent = th.textContent.replace(' ▾', '').replace(' ▴', ''); });
                header.textContent += (sortState.direction === 'asc' ? ' ▴' : ' ▾');
                renderizarTabelaDisponiveis();
            });
        });
    }

    // --- FUNÇÕES DO MÓDULO 6 (EDIÇÃO EM LOTE) ---
    function handleAbrirModalLote() {
        const checkboxesSelecionados = document.querySelectorAll('.select-entrega:checked');
        if (checkboxesSelecionados.length === 0) return;
        loteQtdMsg.textContent = checkboxesSelecionados.length;
        selectLoteRemetente.val(null).trigger('change'); 
        mensagemLote.textContent = '';
        modalLoteRemetente.style.display = 'block';
    }

    async function handleSalvarLoteRemetente(event) {
        event.preventDefault();
        const novoRemetenteId = selectLoteRemetente.val();
        if (!novoRemetenteId) { exibirMensagem(mensagemLote, 'Por favor, selecione um remetente.', 'erro'); return; }
        const idsParaEditar = Array.from(document.querySelectorAll('.select-entrega:checked')).map(cb => parseInt(cb.dataset.id));
        const btnSubmit = formLoteRemetente.querySelector('button[type="submit"]');
        const textoOriginal = btnSubmit.textContent;
        btnSubmit.textContent = 'Salvando...'; btnSubmit.disabled = true;
        try {
            const response = await fetch('/api/entregas/bulk-update-remetente', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entrega_ids: idsParaEditar, novo_remetente_id: novoRemetenteId }) });
            const resultado = await response.json();
            if (!response.ok) throw new Error(resultado.error || 'Falha ao atualizar');
            exibirMensagem(mensagemLote, resultado.message);
            setTimeout(async () => {
                modalLoteRemetente.style.display = 'none';
                if (rascunhoCarregadoId) { const btnCarregar = document.querySelector(`.btn-carregar-rascunho[data-id="${rascunhoCarregadoId}"]`); if (btnCarregar) btnCarregar.click(); } else { await carregarEntregasDisponiveis(); }
                btnSubmit.textContent = textoOriginal; btnSubmit.disabled = false;
            }, 1500);
        } catch (error) { exibirMensagem(mensagemLote, `Erro: ${error.message}`, 'erro'); btnSubmit.textContent = textoOriginal; btnSubmit.disabled = false; }
    }

    // --- LÓGICA DE AGRUPAMENTO (MÓDULO 7 - CORRIGIDO) ---
    async function handleAgruparEntregas() {
        const checkboxes = document.querySelectorAll('.select-entrega:checked');
        if (checkboxes.length < 2) { alert('Selecione pelo menos 2 entregas para agrupar.'); return; }
        
        let primeiroCliente = checkboxes[0].dataset.clienteId;
        let clientesDiferentes = false;
        
        checkboxes.forEach(cb => { if (cb.dataset.clienteId !== primeiroCliente) clientesDiferentes = true; });
        
        if (clientesDiferentes) { alert('Erro: Você selecionou entregas de Clientes diferentes.\nSó é possível agrupar entregas para o mesmo destinatário.'); return; }
        
        if(!confirm(`Deseja fundir essas ${checkboxes.length} entregas em uma única linha?\n\nOs valores serão somados e as entregas individuais apagadas.`)) return;
        
        const ids = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));
        const btnOriginal = btnAgruparEntregas.innerHTML;
        btnAgruparEntregas.innerHTML = 'Processando...'; btnAgruparEntregas.disabled = true;
        
        try {
            const response = await fetch('/api/entregas/agrupar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entrega_ids: ids }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Erro ao agrupar');
            alert(result.message);
            if (rascunhoCarregadoId) { const btnCarregar = document.querySelector(`.btn-carregar-rascunho[data-id="${rascunhoCarregadoId}"]`); if (btnCarregar) btnCarregar.click(); } else { await carregarEntregasDisponiveis(); }
        } catch (error) { alert(error.message); } finally { btnAgruparEntregas.innerHTML = btnOriginal; btnAgruparEntregas.disabled = false; }
    }

    // --- LISTENERS GERAIS ---
    if (formAddEntrega) formAddEntrega.addEventListener('submit', handleAddEntrega);
    if (inputPesquisaDisponiveis) inputPesquisaDisponiveis.addEventListener('input', renderizarTabelaDisponiveis);
    if (inputFiltroRemetente) inputFiltroRemetente.addEventListener('input', renderizarTabelaDisponiveis);
    if (inputFiltroDestinatario) inputFiltroDestinatario.addEventListener('input', renderizarTabelaDisponiveis);
    if (inputFiltroCidade) inputFiltroCidade.addEventListener('input', renderizarTabelaDisponiveis);
    if (inputFiltroEstado) inputFiltroEstado.addEventListener('input', renderizarTabelaDisponiveis);
    const vTonListener = () => calcularFretePorTonelada(inputPesoBruto,inputPesoCubado, inputValorTonelada, inputValorFrete);
    if (inputValorTonelada) inputValorTonelada.addEventListener('blur', vTonListener);
    if (inputPesoBruto) inputPesoBruto.addEventListener('blur', vTonListener);
    if (inputPesoCubado) inputPesoCubado.addEventListener('blur', vTonListener);
    if (selectAllCheckbox) selectAllCheckbox.addEventListener('change', (e) => { document.querySelectorAll('.select-entrega').forEach(cb => { cb.checked = e.target.checked; }); atualizarTotaisMontagem(); });
    if (inputOrigemPrincipal) inputOrigemPrincipal.addEventListener('input', atualizarTotaisMontagem);
    if (btnSalvarRascunho) btnSalvarRascunho.addEventListener('click', handleSalvarRascunho);
    if (formEditarDisp) formEditarDisp.addEventListener('submit', handleSalvarEdicaoDisp);
    if (btnFecharModalEditarDisp) btnFecharModalEditarDisp.addEventListener('click', () => modalEditarDisp.style.display = 'none');
    document.addEventListener('keydown', (event) => { if (event.key === "Escape" && modalEditarDisp && modalEditarDisp.style.display === 'block') { modalEditarDisp.style.display = 'none'; } });

    // --- LISTENERS DO MÓDULO 6 e 7 ---
    if (btnAlterarRemetenteLote) btnAlterarRemetenteLote.addEventListener('click', handleAbrirModalLote);
    if (formLoteRemetente) formLoteRemetente.addEventListener('submit', handleSalvarLoteRemetente);
    if (btnFecharModalLote) btnFecharModalLote.addEventListener('click', () => modalLoteRemetente.style.display = 'none');
    
    // Inicializa Listener Agrupar (novo)
    if (btnAgruparEntregas) btnAgruparEntregas.addEventListener('click', handleAgruparEntregas);

    // --- INICIALIZAÇÃO ---
    try {
        mascaraDecimal(inputPesoBruto); mascaraDecimal(inputValorFrete); mascaraDecimal(inputPesoCubado); mascaraDecimal(inputValorTonelada);
        carregarClientes(); 
        carregarEntregasDisponiveis();
        carregarRascunhos();
        inicializarSortersTabela();
        fetch('/api/session').then(res => res.json()).then(data => {
            if(typeof sessaoUsuario !== 'undefined') sessaoUsuario = data; 
            if (data.user_permission === 'admin') {
                const navAdmin = document.getElementById('nav-admin-dropdown'); 
                if(navAdmin) { navAdmin.innerHTML = `<a href="/usuarios.html">Usuários</a>`; }
            }
        }).catch(err => console.error("Erro ao buscar sessão:", err));
    } catch (initError) { console.error("Erro durante a inicialização:", initError); }

});