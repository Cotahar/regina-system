document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const cargaId = params.get('id');

    if (!cargaId) { alert('ID da carga não fornecido.'); window.close(); return; }

    // --- VARIÁVEIS GLOBAIS ---
    let unidades = [];
    let tiposCte = [];
    let formasPagto = [];
    let motoristas = [];
    let veiculos = [];

    // --- FUNÇÕES AUXILIARES DE FORMATAÇÃO ---
    const formatMoney = (v) => {
        if (v === null || v === undefined || v === '') return '0,00';
        return parseFloat(v).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    };
    
    // Parser que entende "1.500,00" e transforma em float JS (1500.00)
    const parseMoney = (v) => {
        if (!v) return 0;
        if (typeof v === 'number') return v;
        return parseFloat(v.replace(/\./g, '').replace(',', '.'));
    };

    // --- CARREGAMENTO INICIAL ---
    try {
        await carregarCadastrosAuxiliares();
        await carregarDadosCarga();
    } catch (e) {
        console.error(e);
        alert('Erro ao carregar dados. Verifique o console.');
    }

    // --- LISTENERS DOS BOTÕES ---
    document.getElementById('btn-salvar-topo').onclick = salvarTudo;
    document.getElementById('btn-salvar-final').onclick = salvarTudo;
    
    // Cálculo do Adiantamento no Rodapé
    const inpFretePago = document.getElementById('cf-frete-pago');
    const inpPerc = document.getElementById('cf-percentual');
    const inpAdiantamento = document.getElementById('cf-valor-adiantamento');

    function calcularAdiantamento() {
        const frete = parseMoney(inpFretePago.value);
        const perc = parseFloat(inpPerc.value) || 0;
        const adto = frete * (perc / 100);
        inpAdiantamento.value = formatMoney(adto);
    }

    // Aplica lógica de máscara também nos campos do rodapé
    aplicarMascaraExcel(inpFretePago, calcularAdiantamento); 
    aplicarMascaraExcel(inpAdiantamento);
    inpPerc.addEventListener('input', calcularAdiantamento);


    // ============================================================
    // 1. SOLUÇÃO DO FOCO NO SELECT2 (PESQUISA AUTOMÁTICA)
    // ============================================================
    $(document).on('select2:open', () => {
        document.querySelector('.select2-search__field').focus();
    });

    // --- FUNÇÕES DE CARREGAMENTO ---

    async function carregarCadastrosAuxiliares() {
        const [u, t, f, m, v] = await Promise.all([
            fetch('/api/auxiliar/unidades').then(r=>r.json()),
            fetch('/api/auxiliar/tipos-cte').then(r=>r.json()),
            fetch('/api/auxiliar/formas-pagamento').then(r=>r.json()),
            fetch('/api/motoristas').then(r=>r.json()),
            fetch('/api/veiculos').then(r=>r.json())
        ]);
        unidades = u; tiposCte = t; formasPagto = f; motoristas = m; veiculos = v;

        // Popula selects do cabeçalho
        $('#head-motorista').select2({data: motoristas.map(x=>({id:x.id, text:x.nome}))});
        $('#head-veiculo').select2({data: veiculos.map(x=>({id:x.id, text:x.placa}))});
    }

    async function carregarDadosCarga() {
        const res = await fetch(`/api/cargas/${cargaId}/gerenciar`);
        if(!res.ok) throw new Error('Erro API');
        const data = await res.json();
        
        const c = data.carga;
        // Cabeçalho
        document.getElementById('head-origem').value = c.origem;
        document.getElementById('head-destino').value = c.destino_principal || 'DIVERSOS'; 
        document.getElementById('head-obs-faturamento').value = c.observacoes_faturamento || '';
        if(c.motorista_id) $('#head-motorista').val(c.motorista_id).trigger('change');
        if(c.veiculo_id) $('#head-veiculo').val(c.veiculo_id).trigger('change');

        // Rodapé
        document.getElementById('man-rota').value = c.rota_manifesto || '';
        document.getElementById('man-vale-marca').value = c.vale_pedagio_marca || '';
        document.getElementById('man-vale-rota').value = c.vale_pedagio_rota || '';
        document.getElementById('man-eixos').value = c.vale_pedagio_eixos || '';
        
        document.getElementById('cf-frete-pago').value = formatMoney(c.frete_pago);
        document.getElementById('cf-percentual').value = c.adiantamento_percentual || 70;
        document.getElementById('cf-valor-adiantamento').value = formatMoney(c.adiantamento_valor || (c.frete_pago * 0.7));

        renderizarTabela(data.entregas);
    }

    // ============================================================
    // 3. LÓGICA DE AUTOMAÇÃO (UNIDADE E PAGAMENTO)
    // ============================================================
    function renderizarTabela(entregas) {
        const tbody = document.getElementById('tabela-itens-corpo');
        tbody.innerHTML = '';

        entregas.forEach(e => {
            
            // --- INÍCIO DA INTELIGÊNCIA ---
            
            // A. Regra de Unidade (Baseada na UF se for Remetente/Origem)
            // Se o campo já estiver salvo no banco (e.unidade_id), usa ele.
            // Se estiver vazio, tenta adivinhar pelo Estado do Cliente.
            let idUnidade = e.unidade_id;
            let idTipoCte = e.tipo_cte_id;

            // Se ainda não tem unidade definida E temos a UF do cliente vindo do backend
            if (!idUnidade && e.cliente_uf) {
                const uf = e.cliente_uf.toUpperCase();
                
                // Procura na lista de unidades uma que contenha a UF (Ex: "Filial PR")
                const unidadeEncontrada = unidades.find(u => u.nome.toUpperCase().includes(uf));
                if (unidadeEncontrada) idUnidade = unidadeEncontrada.id;

                // Tenta achar o Tipo Cte correspondente (Ex: "11 - PR")
                const cteEncontrado = tiposCte.find(t => t.descricao.toUpperCase().includes(uf));
                if (cteEncontrado) idTipoCte = cteEncontrado.id;
            }

            // B. Regra de Pagamento (Padrão do Cliente)
            let idForma = e.forma_pagamento_id || e.cliente_forma_padrao_id;
            let tipoPagto = e.tipo_pagamento || e.cliente_tipo_padrao;

            // --- FIM DA INTELIGÊNCIA ---

            const tr = document.createElement('tr');
            tr.dataset.id = e.id; 

            tr.innerHTML = `
                <td style="text-align:center;"><input type="checkbox" class="cb-linha"></td>
                <td style="padding: 5px;">${e.cliente_nome}</td>
                <td><select class="inp-unidade">${gerarOptions(unidades, idUnidade)}</select></td>
                <td><select class="inp-tipo-cte">${gerarOptions(tiposCte, idTipoCte)}</select></td>
                <td><input type="text" class="inp-nf" value="${e.nota_fiscal || ''}"></td>
                <td><input type="text" class="inp-peso input-monetario" value="${formatMoney(e.peso_bruto)}"></td>
                <td><input type="text" class="inp-cubado input-monetario" value="${formatMoney(e.peso_cubado)}"></td>
                <td><input type="text" class="inp-vton input-monetario" value="${formatMoney(e.valor_tonelada)}"></td>
                <td><input type="text" class="inp-frete input-monetario" value="${formatMoney(e.valor_frete)}"></td>
                <td><select class="inp-forma">${gerarOptions(formasPagto, idForma)}</select></td>
                <td>
                    <select class="inp-tipo-pagto">
                        <option value="">Selecione...</option>
                        <option value="Boleto" ${tipoPagto === 'Boleto' ? 'selected' : ''}>Boleto</option>
                        <option value="Transferência" ${tipoPagto === 'Transferência' ? 'selected' : ''}>Transferência</option>
                        <option value="Cheque" ${tipoPagto === 'Cheque' ? 'selected' : ''}>Cheque</option>
                    </select>
                </td>
                <td style="text-align:center;">
                    <button class="btn-remover" style="background:none; border:none; cursor:pointer;" title="Remover">❌</button>
                </td>
            `;
            tbody.appendChild(tr);

            // --- CONFIGURAÇÃO DOS INPUTS E EVENTOS ---
            const inpPeso = tr.querySelector('.inp-peso');
            const inpVton = tr.querySelector('.inp-vton');
            const inpFrete = tr.querySelector('.inp-frete');
            const inpCubado = tr.querySelector('.inp-cubado');

            // Função de Recálculo (Peso * Valor Ton)
            const recalculaFrete = () => {
                const peso = parseMoney(inpPeso.value) / 1000; // Converte Kg para Ton
                const vTon = parseMoney(inpVton.value);
                
                if(peso > 0 && vTon > 0) {
                    inpFrete.value = formatMoney(peso * vTon);
                    atualizarTotais();
                }
            };
            
            // Aplica a NOVA máscara Excel em todos os campos monetários
            aplicarMascaraExcel(inpPeso, () => { recalculaFrete(); atualizarTotais(); });
            aplicarMascaraExcel(inpVton, recalculaFrete);
            aplicarMascaraExcel(inpFrete, atualizarTotais);
            aplicarMascaraExcel(inpCubado, atualizarTotais);

            tr.querySelector('.btn-remover').onclick = () => removerEntrega(e.id, tr);
        });
        
        atualizarTotais();
    }

    // ============================================================
    // 2. NOVA MÁSCARA ESTILO EXCEL (Digitação Natural)
    // ============================================================
    function aplicarMascaraExcel(input, callbackChange) {
        if(!input) return;

        // Ao entrar no campo: remove formatação visual, deixa o valor "cru" (ex: 1500,50)
        input.addEventListener('focus', (e) => {
            let valor = e.target.value;
            // Mantém apenas números e vírgula
            valor = valor.replace(/[^\d,]/g, '');
            if (valor === '0,00') valor = '';
            e.target.value = valor;
            e.target.select(); // Seleciona tudo para facilitar apagar
        });

        // Ao digitar: impede letras, permite apenas uma vírgula
        input.addEventListener('input', (e) => {
            let valor = e.target.value;
            valor = valor.replace(/[^0-9,]/g, ''); // Remove lixo
            
            // Garante apenas uma vírgula
            const partes = valor.split(',');
            if (partes.length > 2) {
                valor = partes[0] + ',' + partes.slice(1).join('');
            }
            e.target.value = valor;
        });

        // Ao sair: formata bonito (ex: 1.500,50) e dispara o callback
        input.addEventListener('blur', (e) => {
            let valor = e.target.value;
            if (!valor) {
                e.target.value = '0,00';
            } else {
                // Converte para float para o formatMoney funcionar
                // Troca , por . apenas para conversão
                let numero = parseFloat(valor.replace('.', '').replace(',', '.'));
                if (isNaN(numero)) numero = 0;
                e.target.value = formatMoney(numero);
            }
            if(callbackChange) callbackChange();
        });
    }

    function gerarOptions(lista, selecionadoId) {
        let html = '<option value="">...</option>';
        lista.forEach(i => {
            // Verifica ID como string e int para evitar erros de tipo
            const selected = (i.id == selecionadoId) ? 'selected' : '';
            html += `<option value="${i.id}" ${selected}>${i.text || i.nome || i.descricao}</option>`;
        });
        return html;
    }

    function atualizarTotais() {
        let totalPeso = 0, totalCubado = 0, totalFrete = 0;
        document.querySelectorAll('#tabela-itens-corpo tr').forEach(tr => {
            totalPeso += parseMoney(tr.querySelector('.inp-peso').value);
            totalCubado += parseMoney(tr.querySelector('.inp-cubado').value);
            totalFrete += parseMoney(tr.querySelector('.inp-frete').value);
        });
        document.getElementById('total-peso').innerText = formatMoney(totalPeso);
        document.getElementById('total-cubado').innerText = formatMoney(totalCubado);
        document.getElementById('total-frete').innerText = 'R$ ' + formatMoney(totalFrete);
    }

    // --- SALVAMENTO E REMOÇÃO (Mantidos iguais, apenas chamando parseMoney novo) ---
    async function salvarTudo() {
        const btn = document.getElementById('btn-salvar-final');
        const txtOriginal = btn.innerText;
        btn.innerText = 'Salvando...'; btn.disabled = true;

        const payload = {
            carga: {
                motorista_id: $('#head-motorista').val(),
                veiculo_id: $('#head-veiculo').val(),
                observacoes_faturamento: document.getElementById('head-obs-faturamento').value,
                rota_manifesto: document.getElementById('man-rota').value,
                vale_pedagio_marca: document.getElementById('man-vale-marca').value,
                vale_pedagio_rota: document.getElementById('man-vale-rota').value,
                vale_pedagio_eixos: document.getElementById('man-eixos').value,
                frete_pago: parseMoney(document.getElementById('cf-frete-pago').value),
                adiantamento_percentual: parseFloat(document.getElementById('cf-percentual').value),
                adiantamento_valor: parseMoney(document.getElementById('cf-valor-adiantamento').value)
            },
            entregas: []
        };

        document.querySelectorAll('#tabela-itens-corpo tr').forEach(tr => {
            payload.entregas.push({
                id: tr.dataset.id,
                unidade_id: tr.querySelector('.inp-unidade').value,
                tipo_cte_id: tr.querySelector('.inp-tipo-cte').value,
                nota_fiscal: tr.querySelector('.inp-nf').value,
                peso_bruto: parseMoney(tr.querySelector('.inp-peso').value),
                peso_cubado: parseMoney(tr.querySelector('.inp-cubado').value),
                valor_tonelada: parseMoney(tr.querySelector('.inp-vton').value),
                valor_frete: parseMoney(tr.querySelector('.inp-frete').value),
                forma_pagamento_id: tr.querySelector('.inp-forma').value,
                tipo_pagamento: tr.querySelector('.inp-tipo-pagto').value
            });
        });

        try {
            const res = await fetch(`/api/cargas/${cargaId}/gerenciar`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            if(res.ok) {
                alert('Dados salvos com sucesso!');
            } else {
                alert('Erro ao salvar.');
            }
        } catch(e) { console.error(e); alert('Erro técnico.'); }
        
        btn.innerText = txtOriginal; btn.disabled = false;
    }

    async function removerEntrega(id, trElement) {
        if(!confirm('Tem certeza? Essa entrega será removida da carga.')) return;
        try {
            const res = await fetch(`/api/cargas/${cargaId}/entregas`, {
                method: 'DELETE',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ entrega_id: id })
            });
            if(res.ok) {
                trElement.remove();
                atualizarTotais();
            } else { alert('Erro ao remover.'); }
        } catch(e) { console.error(e); }
    }
    
    // Checkbox Todos
    document.getElementById('cb-todos').addEventListener('change', (e) => {
        document.querySelectorAll('.cb-linha').forEach(cb => cb.checked = e.target.checked);
    });
    
    // Botão Agrupar
    document.getElementById('btn-agrupar').addEventListener('click', async () => {
        const selecionados = [];
        document.querySelectorAll('.cb-linha:checked').forEach(cb => selecionados.push(cb.closest('tr').dataset.id));
        if(selecionados.length < 2) return alert('Selecione pelo menos 2 itens.');
        
        try {
            const res = await fetch('/api/entregas/agrupar', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ entrega_ids: selecionados })
            });
            if(res.ok) { alert('Agrupado!'); window.location.reload(); }
            else { alert('Erro ao agrupar.'); }
        } catch(e) { console.error(e); }
    });
});