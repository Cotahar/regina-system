import { apiGet, apiPost, apiPut, apiDelete } from './api.js';
import { escapeHtml } from './escape.js';
import { formatarMoeda, formatarPeso, formatarData, formatarDataParaInput, parseDecimal } from './format.js';
import { abrirModal, fecharModal, exibirMensagem, ativarAutoResize } from './ui.js';
import { criarCombobox } from './combobox.js';
import { icones } from './icons.js';
import { iconeMenuAcoes, criarMenuAcoes } from './menuAcoes.js';
import { aplicarMascaraDecimal } from './mask.js';
import { criarModalEditarCliente } from './cliente-modal.js';

['det-frete-pago', 'add-peso', 'add-frete', 'edit-peso', 'edit-peso-cubado', 'edit-frete']
  .forEach((id) => aplicarMascaraDecimal(document.getElementById(id)));

const ajustarAlturaObservacoes = ativarAutoResize(document.getElementById('det-observacoes'));

const STATUS_CORES = {
  Pendente: 'bg-slate-500/20 text-slate-300',
  Agendada: 'bg-blue-900/40 text-blue-300',
  'Em Trânsito': 'bg-amber-900/40 text-amber-300',
  Finalizada: 'bg-emerald-900/40 text-emerald-300'
};

export function criarModalDetalhesCarga({ isAdmin, onMudanca }) {
  const modal = document.getElementById('modal-detalhes');
  const msg = document.getElementById('det-msg');
  const tabelaEntregas = document.getElementById('det-tabela-entregas');
  const modalEditar = document.getElementById('modal-editar-entrega');
  const formEditar = document.getElementById('form-editar-entrega');
  const formAdd = document.getElementById('form-add-entrega');
  const formLote = document.getElementById('form-lote-remetente');

  let motoristas = [];
  let veiculos = [];
  let clientes = [];
  let cargaAtual = null;
  let entregasAtuais = [];
  const selecionadas = new Set();
  const gruposExpandidos = new Set();

  // Editar o destinatario direto da carga (sem sair da tela) - depois de
  // salvar, recarrega a carga aberta pra refletir mudancas de perfil na hora.
  const modalCliente = criarModalEditarCliente({
    onSalvo: async () => {
      if (cargaAtual) await abrir(cargaAtual.id);
    }
  });

  async function carregarListasApoio() {
    [motoristas, veiculos, clientes] = await Promise.all([
      apiGet('/api/motoristas'), apiGet('/api/veiculos'), apiGet('/api/clientes')
    ]);
  }

  function combobox(inputId, hiddenId, getItens) {
    criarCombobox({ input: document.getElementById(inputId), hidden: document.getElementById(hiddenId), getItens });
  }
  combobox('det-motorista-input', 'det-motorista-id', () => motoristas);
  combobox('det-veiculo-input', 'det-veiculo-id', () => veiculos);
  combobox('add-remetente-input', 'add-remetente-id', () => clientes);
  combobox('add-cliente-input', 'add-cliente-id', () => clientes);
  combobox('add-local-coleta-input', 'add-local-coleta-id', () => clientes);
  combobox('edit-remetente-input', 'edit-remetente-id', () => clientes);
  combobox('edit-local-coleta-input', 'edit-local-coleta-id', () => clientes);
  combobox('lote-remetente-input', 'lote-remetente-id', () => clientes);

  function mostrarMensagem(texto, tipo = 'erro') {
    exibirMensagem(msg, texto, tipo);
  }

  async function abrir(cargaId) {
    try {
      const data = await apiGet(`/api/cargas/${cargaId}`);
      cargaAtual = data.detalhes_carga;
      entregasAtuais = data.entregas;
      selecionadas.clear();
      gruposExpandidos.clear();
      if (!motoristas.length) await carregarListasApoio();
      renderizarCabecalho();
      renderizarAcoes();
      renderizarTabelaEntregas();
      renderizarColetas();
      aplicarEstadoColetas();
      formAdd.classList.add('hidden');
      formLote.classList.add('hidden');
      msg.classList.add('hidden');
      abrirModal(modal);
      // So agora o modal esta com display:flex de verdade - antes disso o
      // textarea tinha scrollHeight 0 (elemento escondido) e o auto-resize
      // calculava a altura errada.
      ajustarAlturaObservacoes();
    } catch (err) {
      alert(err.message);
    }
  }

  function motoristaTexto(id) {
    return motoristas.find((m) => m.id === id)?.text || '';
  }
  function veiculoTexto(id) {
    return veiculos.find((v) => v.id === id)?.text || '';
  }

  function renderizarCabecalho() {
    const c = cargaAtual;
    document.getElementById('det-codigo').textContent = c.codigo_carga;
    document.getElementById('det-origem').textContent = c.origem;
    const badge = document.getElementById('det-status-badge');
    badge.textContent = c.status;
    badge.className = `ml-2 rounded px-2 py-0.5 text-xs ${STATUS_CORES[c.status] || 'bg-slate-500/20 text-slate-300'}`;
    document.getElementById('det-frota-badge').classList.toggle('hidden', !c.veiculo_frota);

    document.getElementById('det-motorista-input').value = motoristaTexto(c.motorista_id);
    document.getElementById('det-motorista-id').value = c.motorista_id || '';
    document.getElementById('det-veiculo-input').value = veiculoTexto(c.veiculo_id);
    document.getElementById('det-veiculo-id').value = c.veiculo_id || '';
    document.getElementById('det-data-agendamento').value = formatarDataParaInput(c.data_agendamento);
    document.getElementById('det-data-carregamento').value = formatarDataParaInput(c.data_carregamento);
    document.getElementById('det-previsao-entrega').value = formatarDataParaInput(c.previsao_entrega);
    document.getElementById('det-data-finalizacao').value = formatarDataParaInput(c.data_finalizacao);
    document.getElementById('det-frete-pago').value = c.frete_pago ?? '';
    document.getElementById('det-observacoes').value = c.observacoes || '';
    ajustarAlturaObservacoes();

    // So mostra o campo de data quando a carga ja chegou naquele estagio -
    // datas futuras/nao aplicaveis so confundem quem esta olhando.
    const mostrarCarregamento = ['Agendada', 'Em Trânsito', 'Finalizada'].includes(c.status);
    const mostrarFinalizacao = ['Em Trânsito', 'Finalizada'].includes(c.status);
    document.querySelectorAll('[data-estagio="carregamento"]').forEach((el) => el.classList.toggle('hidden', !mostrarCarregamento));
    document.querySelectorAll('[data-estagio="finalizacao"]').forEach((el) => el.classList.toggle('hidden', !mostrarFinalizacao));
  }

  function coletarCamposEditaveis() {
    return {
      motorista_id: document.getElementById('det-motorista-id').value || null,
      veiculo_id: document.getElementById('det-veiculo-id').value || null,
      data_agendamento: document.getElementById('det-data-agendamento').value || null,
      data_carregamento: document.getElementById('det-data-carregamento').value || null,
      previsao_entrega: document.getElementById('det-previsao-entrega').value || null,
      data_finalizacao: document.getElementById('det-data-finalizacao').value || null,
      frete_pago: parseDecimal(document.getElementById('det-frete-pago').value),
      observacoes: document.getElementById('det-observacoes').value || null
    };
  }

  async function atualizarStatus(payload, mensagemSucesso) {
    try {
      await apiPut(`/api/cargas/${cargaAtual.id}/status`, payload);
      mostrarMensagem(mensagemSucesso, 'sucesso');
      await abrir(cargaAtual.id);
      onMudanca?.();
    } catch (err) {
      mostrarMensagem(err.message, 'erro');
    }
  }

  function botao(label, className, onClick, icone) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `${className} gap-1.5`;
    btn.innerHTML = `${icone || ''}<span>${label}</span>`;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function renderizarAcoes() {
    const fluxo = document.getElementById('det-acoes-fluxo');
    const ferramentas = document.getElementById('det-acoes-ferramentas');
    const perigo = document.getElementById('det-acoes-perigo');
    fluxo.innerHTML = '';
    ferramentas.innerHTML = '';
    perigo.innerHTML = '';
    const c = cargaAtual;

    fluxo.appendChild(botao('Salvar Alteracoes', 'btn-success', async () => {
      await atualizarStatus(coletarCamposEditaveis(), 'Alteracoes salvas!');
    }, icones.salvar));

    if (c.status === 'Pendente') {
      fluxo.appendChild(botao('Agendar', 'btn-primary', async () => {
        const campos = coletarCamposEditaveis();
        if (!campos.data_agendamento) {
          return mostrarMensagem('Data de agendamento e obrigatoria.', 'erro');
        }
        await atualizarStatus({
          motorista_id: campos.motorista_id,
          veiculo_id: campos.veiculo_id,
          data_agendamento: campos.data_agendamento,
          status: 'Agendada'
        }, 'Carga agendada!');
      }, icones.calendario));
    }

    if (c.status === 'Agendada') {
      fluxo.appendChild(botao('Iniciar Transito', 'btn-primary', async () => {
        const campos = coletarCamposEditaveis();
        if (!campos.data_carregamento) return mostrarMensagem('Informe a data de carregamento.', 'erro');
        await atualizarStatus({ data_carregamento: campos.data_carregamento, status: 'Em Trânsito' }, 'Carga em transito!');
      }, icones.caminhao));
      fluxo.appendChild(botao('Cancelar Agendamento', 'btn-secondary', async () => {
        await atualizarStatus({ status: 'Pendente' }, 'Agendamento cancelado.');
      }, icones.voltar));
    }

    if (c.status === 'Em Trânsito') {
      fluxo.appendChild(botao('Finalizar', 'btn-primary', async () => {
        const campos = coletarCamposEditaveis();
        if (!campos.data_finalizacao) return mostrarMensagem('Informe a data de finalizacao.', 'erro');
        const senha = prompt('Confirme sua senha para finalizar a carga:');
        if (senha === null) return;
        try {
          await apiPost('/api/verify-password', { password: senha });
        } catch (err) {
          return mostrarMensagem(err.message, 'erro');
        }
        await atualizarStatus({ data_finalizacao: campos.data_finalizacao, status: 'Finalizada' }, 'Carga finalizada!');
      }, icones.check));
      if (isAdmin) {
        fluxo.appendChild(botao('Regredir p/ Agendada', 'btn-secondary', async () => {
          await atualizarStatus({ status: 'Agendada' }, 'Status regredido.');
        }, icones.voltar));
      }
    }

    if (c.status === 'Finalizada' && isAdmin) {
      fluxo.appendChild(botao('Regredir p/ Em Transito', 'btn-secondary', async () => {
        await atualizarStatus({ status: 'Em Trânsito' }, 'Status regredido.');
      }, icones.voltar));
    }

    if (['Pendente', 'Agendada'].includes(c.status)) {
      fluxo.appendChild(botao('Devolver p/ Rascunho', 'btn-secondary', async () => {
        if (!confirm('Devolver esta carga para Rascunho? Motorista e datas serao limpos.')) return;
        try {
          await apiPut(`/api/cargas/${c.id}/devolver-rascunho`, {});
          fecharModal(modal);
          onMudanca?.();
        } catch (err) {
          mostrarMensagem(err.message, 'erro');
        }
      }, icones.voltar));
    }

    ferramentas.appendChild(botao('Imprimir Espelho', 'btn-secondary', () => {
      window.open(`/cargas/${c.id}/espelho_impressao`, '_blank');
    }, icones.impressora));

    ferramentas.appendChild(botao('Gerenciar / Fat.', 'btn-secondary', () => {
      window.open(`/gerenciar-carga.html?carga_id=${c.id}`, '_blank');
    }, icones.cifrao));

    ferramentas.appendChild(botao('Registrar Avaria', 'btn-secondary', () => {
      window.open(`/avarias.html?carga_id=${c.id}`, '_blank');
    }, icones.alerta));

    if (['Agendada', 'Em Trânsito'].includes(c.status) && c.motorista_id && c.veiculo_id) {
      ferramentas.appendChild(botao('Envio de Pagamento', 'btn-secondary', () => {
        window.open(`/pagamento-carga.html?carga_id=${c.id}`, '_blank');
      }, icones.mensagem));
    }

    ferramentas.appendChild(botao('Duplicar Carga', 'btn-secondary', async () => {
      if (!confirm('Duplicar esta carga? Um novo rascunho sera criado com as mesmas entregas (remetente, destinatario, peso, valor), sem motorista, veiculo ou numero de nota.')) return;
      try {
        const resp = await apiPost(`/api/cargas/${c.id}/duplicar`, {});
        mostrarMensagem(resp.message, 'sucesso');
        setTimeout(() => { window.location.href = '/montagem.html'; }, 900);
      } catch (err) {
        mostrarMensagem(err.message, 'erro');
      }
    }, icones.duplicar));

    if (isAdmin) {
      perigo.appendChild(botao('Excluir Carga', 'btn-danger', async () => {
        const acao = confirm(
          'OK = excluir a carga e devolver as entregas para "Disponiveis".\nCancelar = escolher excluir as entregas junto.'
        )
          ? 'return_to_pool'
          : (confirm('Excluir tambem as entregas desta carga? Isso NAO pode ser desfeito.') ? 'delete_entregas' : null);
        if (!acao) return;
        try {
          await apiDelete(`/api/cargas/${c.id}?action=${acao}`);
          fecharModal(modal);
          onMudanca?.();
        } catch (err) {
          mostrarMensagem(err.message, 'erro');
        }
      }, icones.lixeira));
    }
  }

  // Agrupa so para exibicao (mesmo destinatario + mesma cidade/UF) - nao tem
  // relacao com o agrupamento de faturamento (grupo_id). Ajuda a nao repetir
  // N linhas identicas quando uma carga tem varias notas pro mesmo lugar.
  function agruparParaExibicao(entregas) {
    const mapa = new Map();
    const ordem = [];
    for (const e of entregas) {
      const chave = `${e.cliente_id}|${(e.cidade || '').trim().toUpperCase()}|${(e.estado || '').trim().toUpperCase()}`;
      if (!mapa.has(chave)) { mapa.set(chave, []); ordem.push(chave); }
      mapa.get(chave).push(e);
    }
    return ordem.map((chave) => ({ chave, itens: mapa.get(chave) }));
  }

  // Perfil do cliente sempre visivel (nao mais escondido atras de hover) -
  // quem acompanha a carga pelo modal precisa ver de cara se precisa
  // agendar descarga, sem precisar abrir o cadastro do cliente. Agendamento
  // pendente vira um aviso chamativo; depois de preencher a data, vira uma
  // confirmacao tranquila.
  function perfilClienteLinha(e) {
    const badges = [];
    if (e.cliente_precisa_agendamento) {
      badges.push(e.data_agendamento_descarga
        ? `<span class="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">Agendado: ${escapeHtml(formatarData(e.data_agendamento_descarga))}</span>`
        : '<span class="rounded bg-red-900/50 px-1.5 py-0.5 text-[10px] font-bold text-red-300">&#9888; Agendar descarga</span>');
    }
    if (e.cliente_autodescarga) badges.push('<span class="rounded bg-sky-900/40 px-1.5 py-0.5 text-[10px] text-sky-300">Descarga por conta do cliente</span>');
    if (e.cliente_precisa_ajudantes) badges.push('<span class="rounded bg-sky-900/40 px-1.5 py-0.5 text-[10px] text-sky-300">Precisa de ajudantes</span>');
    if (e.cliente_descarga_paga_direto) badges.push('<span class="rounded bg-sky-900/40 px-1.5 py-0.5 text-[10px] text-sky-300">Descarga paga direto</span>');
    if (e.cliente_resolve_com_representante) badges.push('<span class="rounded bg-sky-900/40 px-1.5 py-0.5 text-[10px] text-sky-300">Resolver com representante</span>');
    const obs = e.obs_cliente ? `<div class="mt-0.5 text-[10px] italic text-slate-400">Obs: ${escapeHtml(e.obs_cliente)}</div>` : '';
    const contatoExtra = e.cliente_contato_extra ? `<div class="mt-0.5 text-[10px] text-slate-400">Contato extra: ${escapeHtml(e.cliente_contato_extra)}</div>` : '';
    if (!badges.length && !obs && !contatoExtra) return '';
    return `<div class="mt-1 flex flex-wrap gap-1">${badges.join('')}</div>${obs}${contatoExtra}`;
  }

  // Atalho pra editar o cadastro do cliente sem sair da carga - abre o mesmo
  // modal de edicao por cima, sem navegar pra outra pagina (listener ligado
  // em renderizarTabelaEntregas, depois que o HTML entra no DOM).
  function linkEditarCliente(clienteId) {
    if (!clienteId) return '';
    return ` <button type="button" class="link-editar-cliente inline-flex align-middle text-slate-500 hover:text-brand-yellow" data-cliente-id="${clienteId}" title="Editar cadastro do cliente">${icones.editar}</button>`;
  }

  function formatarContato(ddd, telefone) {
    if (ddd && telefone) return `(${escapeHtml(ddd)}) ${escapeHtml(telefone)}`;
    return telefone ? escapeHtml(telefone) : '<span class="text-slate-500">-</span>';
  }

  // Nome efetivo de onde o motorista vai buscar a carga - o local de coleta
  // (quando um cliente foi vinculado, ou o texto livre legado) sobrepoe o
  // remetente so pra exibicao; o cadastro do remetente original nunca muda.
  function nomeColeta(e) {
    return e.local_coleta_cliente_nome || e.local_coleta || null;
  }

  function badgeColeta(e) {
    const nome = nomeColeta(e);
    return nome ? `<br><span class="rounded bg-sky-900/40 px-1 text-[10px] text-sky-300">coleta: ${escapeHtml(nome)}</span>` : '';
  }

  function linhaEntrega(e, indentada, ultimoDoGrupo) {
    const agrupada = !!e.grupo_id;
    const classeGrupo = agrupada ? 'bg-destaque/5 border-l-2 border-l-destaque' : '';
    const classeIndentada = indentada ? `bg-blue-500/10 border-l-4 border-l-blue-500/40 ${ultimoDoGrupo ? 'border-b-2 border-b-blue-500/30' : ''}` : '';
    const py = indentada ? 'py-2' : 'py-1.5';
    return `
      <tr class="border-t border-painel-border transition-colors ${classeGrupo} ${classeIndentada}" data-id="${e.id}" data-remetente="${e.remetente_id || ''}" data-cliente="${e.cliente_id || ''}" data-cortesia="${e.is_cortesia ? '1' : '0'}" data-grupo="${e.grupo_id || ''}">
        <td class="${py}"><input type="checkbox" class="chk-linha" ${selecionadas.has(e.id) ? 'checked' : ''}></td>
        <td class="${py}">${escapeHtml(e.remetente_nome)}${agrupada ? ' <span class="rounded bg-amber-900/40 px-1 text-[10px] text-amber-300">grupo</span>' : ''}${badgeColeta(e)}</td>
        <td class="${py}">${escapeHtml(e.razao_social)}${linkEditarCliente(e.cliente_id)}${perfilClienteLinha(e)}</td>
        <td class="${py}">${formatarContato(e.ddd, e.telefone)}</td>
        <td class="${py}">${escapeHtml(e.cidade)}-${escapeHtml(e.estado)}</td>
        <td class="${py}">${escapeHtml(e.nota_fiscal || '')}${e.is_cortesia ? ' <span class="rounded bg-emerald-900/40 px-1 text-[10px] text-emerald-300">cortesia</span>' : ''}</td>
        <td class="${py}">${formatarPeso(e.peso_bruto)}</td>
        <td class="${py}">${formatarMoeda(e.valor_frete)}</td>
        <td class="${py} text-right">${iconeMenuAcoes()}</td>
      </tr>
    `;
  }

  function linhaResumoGrupo(chave, itens, expandido) {
    const remetentes = new Set(itens.map((e) => e.remetente_nome));
    const primeiro = itens[0];
    const remetenteTexto = remetentes.size === 1
      ? escapeHtml([...remetentes][0])
      : '<span class="italic text-slate-400">Varios</span>';
    // So mostra o selo de coleta quando todo o grupo concorda no mesmo local
    // (senao o selo do primeiro item passaria a impressao errada de que o
    // grupo inteiro tem esse local de coleta).
    const colecoes = new Set(itens.map(nomeColeta));
    const badgeColetaGrupo = colecoes.size === 1 ? badgeColeta(primeiro) : '';
    const pesoTotal = itens.reduce((acc, e) => acc + (e.peso_bruto || 0), 0);
    const freteTotal = itens.reduce((acc, e) => acc + (e.valor_frete || 0), 0);
    const todosSelecionados = itens.every((e) => selecionadas.has(e.id));
    const corGrupo = expandido
      ? 'bg-blue-500/15 border-l-4 border-l-blue-500'
      : 'bg-blue-500/5 border-l-4 border-l-blue-500/40 hover:bg-blue-500/10';
    return `
      <tr class="border-t border-painel-border transition-colors ${corGrupo}" data-grupo-visual="${escapeHtml(chave)}">
        <td class="py-1.5"><input type="checkbox" class="chk-grupo-visual" data-chave="${escapeHtml(chave)}" ${todosSelecionados ? 'checked' : ''}></td>
        <td class="py-1.5">${remetenteTexto}${badgeColetaGrupo}</td>
        <td class="py-1.5">
          <button type="button" class="btn-expandir-grupo inline-flex items-center gap-1.5 font-semibold text-blue-300 hover:text-blue-200" data-chave="${escapeHtml(chave)}">
            <svg viewBox="0 0 20 20" fill="currentColor" class="h-3 w-3 shrink-0 transition-transform ${expandido ? 'rotate-90' : ''}"><path d="M7 4l7 6-7 6V4z"/></svg>
            ${escapeHtml(primeiro.razao_social)}
          </button>
          <span class="ml-1 rounded-full bg-blue-500/25 px-1.5 py-0.5 text-[10px] font-medium text-blue-200">${itens.length} notas</span>
          ${linkEditarCliente(primeiro.cliente_id)}
          ${perfilClienteLinha(primeiro)}
        </td>
        <td class="py-1.5">${formatarContato(primeiro.ddd, primeiro.telefone)}</td>
        <td class="py-1.5">${escapeHtml(primeiro.cidade)}-${escapeHtml(primeiro.estado)}</td>
        <td class="py-1.5 text-slate-400">-</td>
        <td class="py-1.5 font-semibold text-blue-300">${formatarPeso(pesoTotal)}</td>
        <td class="py-1.5 font-semibold text-blue-300">${formatarMoeda(freteTotal)}</td>
        <td class="py-1.5"></td>
      </tr>
    `;
  }

  function renderizarTotais() {
    const pesoTotal = entregasAtuais.reduce((acc, e) => acc + (e.peso_bruto || 0), 0);
    const freteTotal = entregasAtuais.reduce((acc, e) => acc + (e.valor_frete || 0), 0);
    document.getElementById('det-total-peso').value = formatarPeso(pesoTotal);
    document.getElementById('det-total-frete').value = formatarMoeda(freteTotal);
  }

  // Um local de coleta por linha (mesmo agrupamento usado no Espelho de
  // Carga, so que resumido - so o nome + peso total dele nesta carga). Usa o
  // local de coleta da entrega quando definido, senao cai pro remetente.
  function coletasPorRemetente() {
    const mapa = new Map();
    const ordem = [];
    for (const e of entregasAtuais) {
      const nome = nomeColeta(e) || e.remetente_nome || 'N/A';
      if (!mapa.has(nome)) { mapa.set(nome, 0); ordem.push(nome); }
      mapa.set(nome, mapa.get(nome) + (e.peso_bruto || 0));
    }
    return ordem.map((nome) => ({ nome, peso: mapa.get(nome) }));
  }

  function renderizarColetas() {
    const coletas = coletasPorRemetente();
    document.getElementById('det-coletas-conteudo').innerHTML = coletas.length
      ? `<ul class="space-y-1 text-xs text-slate-300">${coletas.map((c) => `
          <li class="flex items-center justify-between gap-3">
            <span>${escapeHtml(c.nome)}</span>
            <span class="font-semibold text-slate-200">${formatarPeso(c.peso)}</span>
          </li>
        `).join('')}</ul>`
      : '<p class="text-xs text-slate-400">Nenhuma coleta ainda.</p>';
  }

  // Estado aberto/fechado da secao Coletas persiste no navegador (por
  // usuario/maquina) - pedido explicito pra nao ter que reabrir toda vez.
  const CHAVE_COLETAS_ABERTA = 'frottex-coletas-aberta';
  function aplicarEstadoColetas() {
    const aberta = localStorage.getItem(CHAVE_COLETAS_ABERTA) === '1';
    document.getElementById('det-coletas-conteudo').classList.toggle('hidden', !aberta);
    document.getElementById('icone-toggle-coletas').classList.toggle('rotate-90', aberta);
  }
  document.getElementById('btn-toggle-coletas').addEventListener('click', () => {
    const aberta = !document.getElementById('det-coletas-conteudo').classList.contains('hidden');
    localStorage.setItem(CHAVE_COLETAS_ABERTA, aberta ? '0' : '1');
    aplicarEstadoColetas();
  });

  function renderizarTabelaEntregas() {
    renderizarTotais();
    const grupos = agruparParaExibicao(entregasAtuais);

    tabelaEntregas.innerHTML = grupos.map(({ chave, itens }) => {
      if (itens.length === 1) return linhaEntrega(itens[0], false);
      const expandido = gruposExpandidos.has(chave);
      return linhaResumoGrupo(chave, itens, expandido) + (expandido ? itens.map((e, i) => linhaEntrega(e, true, i === itens.length - 1)).join('') : '');
    }).join('') || '<tr><td colspan="9" class="py-3 text-center text-slate-400">Nenhuma entrega nesta carga.</td></tr>';

    tabelaEntregas.querySelectorAll('.link-editar-cliente').forEach((btn) => {
      btn.addEventListener('click', () => modalCliente.abrirEdicao(Number(btn.dataset.clienteId)));
    });

    tabelaEntregas.querySelectorAll('tr[data-id]').forEach((tr) => {
      const id = Number(tr.dataset.id);
      tr.querySelector('.chk-linha').addEventListener('change', (e) => {
        if (e.target.checked) selecionadas.add(id); else selecionadas.delete(id);
        document.getElementById('btn-lote-remetente').classList.toggle('hidden', selecionadas.size < 2);
        document.getElementById('btn-agrupar-entregas').classList.toggle('hidden', selecionadas.size < 2);
        document.getElementById('btn-desagrupar-entregas').classList.toggle('hidden', selecionadas.size < 1);
        document.getElementById('btn-excluir-entregas-selecionadas').classList.toggle('hidden', selecionadas.size < 1);
      });
      criarMenuAcoes(tr.querySelector('.btn-menu-acoes'), [
        { label: 'Editar', onClick: () => abrirEdicaoEntrega(id) },
        {
          label: 'Excluir',
          perigo: true,
          onClick: async () => {
            if (!confirm('Remover esta entrega da carga? Ela volta para "Disponiveis".')) return;
            try {
              await apiDelete(`/api/cargas/${cargaAtual.id}/entregas`, { entrega_id: id });
              await abrir(cargaAtual.id);
              onMudanca?.();
            } catch (err) {
              mostrarMensagem(err.message, 'erro');
            }
          }
        }
      ]);
    });

    tabelaEntregas.querySelectorAll('.btn-expandir-grupo').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chave = btn.dataset.chave;
        if (gruposExpandidos.has(chave)) gruposExpandidos.delete(chave); else gruposExpandidos.add(chave);
        renderizarTabelaEntregas();
      });
    });

    tabelaEntregas.querySelectorAll('.chk-grupo-visual').forEach((chk) => {
      chk.addEventListener('change', (e) => {
        const grupo = grupos.find((g) => g.chave === chk.dataset.chave);
        if (!grupo) return;
        for (const item of grupo.itens) {
          if (e.target.checked) selecionadas.add(item.id); else selecionadas.delete(item.id);
        }
        document.getElementById('btn-lote-remetente').classList.toggle('hidden', selecionadas.size < 2);
        document.getElementById('btn-agrupar-entregas').classList.toggle('hidden', selecionadas.size < 2);
        document.getElementById('btn-desagrupar-entregas').classList.toggle('hidden', selecionadas.size < 1);
        document.getElementById('btn-excluir-entregas-selecionadas').classList.toggle('hidden', selecionadas.size < 1);
        renderizarTabelaEntregas();
      });
    });

    document.getElementById('chk-todas').checked = entregasAtuais.length > 0 && selecionadas.size === entregasAtuais.length;
  }

  function abrirEdicaoEntrega(id) {
    const e = entregasAtuais.find((it) => it.id === id);
    if (!e) return;
    document.getElementById('edit-entrega-id').value = e.id;
    document.getElementById('edit-remetente-input').value = e.remetente_nome === 'N/A' ? '' : e.remetente_nome;
    document.getElementById('edit-remetente-id').value = e.remetente_id || '';
    document.getElementById('edit-cidade').value = e.cidade_entrega_override || '';
    document.getElementById('edit-estado').value = e.estado_entrega_override || '';
    document.getElementById('edit-peso').value = e.peso_bruto ?? '';
    document.getElementById('edit-peso-cubado').value = e.peso_cubado ?? '';
    document.getElementById('edit-frete').value = e.valor_frete ?? '';
    document.getElementById('edit-nf').value = e.nota_fiscal || '';
    document.getElementById('edit-local-coleta-input').value = e.local_coleta_cliente_nome || '';
    document.getElementById('edit-local-coleta-id').value = e.local_coleta_cliente_id || '';
    document.getElementById('edit-cortesia').checked = !!e.is_cortesia;
    document.getElementById('edit-agendamento-wrap').classList.toggle('hidden', !e.cliente_precisa_agendamento);
    document.getElementById('edit-data-agendamento-descarga').value = formatarDataParaInput(e.data_agendamento_descarga);
    document.getElementById('edit-msg').classList.add('hidden');
    abrirModal(modalEditar);
  }

  document.getElementById('btn-fechar-detalhes').addEventListener('click', () => fecharModal(modal));
  document.getElementById('btn-cancelar-edicao').addEventListener('click', () => fecharModal(modalEditar));

  document.getElementById('chk-todas').addEventListener('change', (e) => {
    // Opera direto sobre a lista completa (nao so as linhas visiveis no DOM)
    // porque entregas dentro de um grupo visual recolhido nao tem checkbox
    // proprio na tela ate serem expandidas.
    for (const entrega of entregasAtuais) {
      if (e.target.checked) selecionadas.add(entrega.id); else selecionadas.delete(entrega.id);
    }
    document.getElementById('btn-lote-remetente').classList.toggle('hidden', selecionadas.size < 2);
    document.getElementById('btn-agrupar-entregas').classList.toggle('hidden', selecionadas.size < 2);
    document.getElementById('btn-desagrupar-entregas').classList.toggle('hidden', selecionadas.size < 1);
    document.getElementById('btn-excluir-entregas-selecionadas').classList.toggle('hidden', selecionadas.size < 1);
    renderizarTabelaEntregas();
  });

  document.getElementById('btn-add-entrega').addEventListener('click', () => {
    formAdd.classList.toggle('hidden');
  });

  document.getElementById('btn-lote-remetente').addEventListener('click', () => {
    formLote.classList.toggle('hidden');
    formLote.classList.toggle('flex');
  });

  document.getElementById('btn-agrupar-entregas').addEventListener('click', async () => {
    if (selecionadas.size < 2) return mostrarMensagem('Selecione pelo menos 2 entregas.', 'erro');
    const linhas = entregasAtuais.filter((e) => selecionadas.has(e.id));
    const remetentes = new Set(linhas.map((e) => e.remetente_id));
    const destinatarios = new Set(linhas.map((e) => e.cliente_id));
    if (remetentes.size > 1 || destinatarios.size > 1) {
      return mostrarMensagem('So e possivel agrupar entregas com o mesmo remetente E o mesmo destinatario.', 'erro');
    }
    const cortesias = new Set(linhas.map((e) => !!e.is_cortesia));
    if (cortesias.size > 1) return mostrarMensagem('Nao e possivel agrupar notas Cortesia com notas normais.', 'erro');

    try {
      await apiPost('/api/entregas/agrupar', { entrega_ids: [...selecionadas] });
      selecionadas.clear();
      await abrir(cargaAtual.id);
    } catch (err) {
      mostrarMensagem(err.message, 'erro');
    }
  });

  document.getElementById('btn-desagrupar-entregas').addEventListener('click', async () => {
    const linhas = entregasAtuais.filter((e) => selecionadas.has(e.id));
    const grupos = new Set(linhas.map((e) => e.grupo_id).filter(Boolean));
    if (!grupos.size) return mostrarMensagem('Selecione entregas que estejam agrupadas.', 'erro');
    try {
      for (const grupoId of grupos) {
        await apiPost('/api/entregas/desagrupar', { grupo_id: grupoId });
      }
      selecionadas.clear();
      await abrir(cargaAtual.id);
    } catch (err) {
      mostrarMensagem(err.message, 'erro');
    }
  });

  document.getElementById('btn-excluir-entregas-selecionadas').addEventListener('click', async () => {
    if (!selecionadas.size) return;
    if (!confirm(`Excluir/devolver ${selecionadas.size} entrega(s) selecionada(s)?`)) return;
    try {
      await apiDelete('/api/entregas/em-massa', { entrega_ids: [...selecionadas] });
      selecionadas.clear();
      await abrir(cargaAtual.id);
      onMudanca?.();
    } catch (err) {
      mostrarMensagem(err.message, 'erro');
    }
  });

  formLote.addEventListener('submit', async (event) => {
    event.preventDefault();
    const novoRemetenteId = document.getElementById('lote-remetente-id').value;
    if (!novoRemetenteId) return mostrarMensagem('Selecione um remetente valido na lista.', 'erro');
    try {
      await apiPut('/api/entregas/bulk-update-remetente', {
        entrega_ids: [...selecionadas],
        novo_remetente_id: Number(novoRemetenteId)
      });
      selecionadas.clear();
      formLote.reset();
      formLote.classList.add('hidden');
      await abrir(cargaAtual.id);
    } catch (err) {
      mostrarMensagem(err.message, 'erro');
    }
  });

  formAdd.addEventListener('submit', async (event) => {
    event.preventDefault();
    const remetenteId = document.getElementById('add-remetente-id').value;
    const clienteId = document.getElementById('add-cliente-id').value;
    if (!remetenteId || !clienteId) return mostrarMensagem('Selecione remetente e destinatario validos.', 'erro');

    try {
      await apiPost(`/api/cargas/${cargaAtual.id}/entregas`, {
        remetente_id: Number(remetenteId),
        cliente_id: Number(clienteId),
        local_coleta_cliente_id: document.getElementById('add-local-coleta-id').value || null,
        peso_bruto: parseDecimal(document.getElementById('add-peso').value),
        valor_frete: parseDecimal(document.getElementById('add-frete').value)
      });
      formAdd.reset();
      formAdd.classList.add('hidden');
      await abrir(cargaAtual.id);
      onMudanca?.();
    } catch (err) {
      mostrarMensagem(err.message, 'erro');
    }
  });

  formEditar.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.getElementById('edit-entrega-id').value;
    const editMsg = document.getElementById('edit-msg');
    try {
      await apiPut(`/api/entregas/${id}`, {
        remetente_id: document.getElementById('edit-remetente-id').value || null,
        cidade_entrega: document.getElementById('edit-cidade').value || null,
        estado_entrega: document.getElementById('edit-estado').value || null,
        peso_bruto: parseDecimal(document.getElementById('edit-peso').value),
        peso_cubado: parseDecimal(document.getElementById('edit-peso-cubado').value),
        valor_frete: parseDecimal(document.getElementById('edit-frete').value),
        nota_fiscal: document.getElementById('edit-nf').value || null,
        local_coleta_cliente_id: document.getElementById('edit-local-coleta-id').value || null,
        is_cortesia: document.getElementById('edit-cortesia').checked,
        data_agendamento_descarga: document.getElementById('edit-data-agendamento-descarga').value || null
      });
      fecharModal(modalEditar);
      await abrir(cargaAtual.id);
      onMudanca?.();
    } catch (err) {
      editMsg.textContent = err.message;
      editMsg.classList.remove('hidden');
    }
  });

  return { abrir, carregarListasApoio };
}
