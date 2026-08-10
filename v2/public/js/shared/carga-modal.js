import { apiGet, apiPost, apiPut, apiDelete } from './api.js';
import { escapeHtml } from './escape.js';
import { formatarMoeda, formatarPeso, formatarDataParaInput, parseDecimal } from './format.js';
import { abrirModal, fecharModal, exibirMensagem } from './ui.js';

const STATUS_CORES = {
  Pendente: 'bg-slate-500/30 text-slate-200',
  Agendada: 'bg-blue-500/30 text-blue-200',
  'Em Trânsito': 'bg-amber-500/30 text-amber-200',
  Finalizada: 'bg-emerald-500/30 text-emerald-200'
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

  function preencherDatalist(id, itens) {
    document.getElementById(id).innerHTML = itens.map((i) => `<option data-id="${i.id}" value="${escapeHtml(i.text)}">`).join('');
  }

  function ligarBuscaComId(inputId, hiddenId, getItens) {
    const input = document.getElementById(inputId);
    const hidden = document.getElementById(hiddenId);
    input.addEventListener('input', () => {
      const item = getItens().find((i) => i.text === input.value);
      hidden.value = item ? item.id : '';
    });
  }

  async function carregarListasApoio() {
    [motoristas, veiculos, clientes] = await Promise.all([
      apiGet('/api/motoristas'), apiGet('/api/veiculos'), apiGet('/api/clientes')
    ]);
    preencherDatalist('lista-motoristas', motoristas);
    preencherDatalist('lista-veiculos', veiculos);
    preencherDatalist('lista-clientes', clientes);
  }

  ligarBuscaComId('det-motorista-input', 'det-motorista-id', () => motoristas);
  ligarBuscaComId('det-veiculo-input', 'det-veiculo-id', () => veiculos);
  ligarBuscaComId('add-remetente-input', 'add-remetente-id', () => clientes);
  ligarBuscaComId('add-cliente-input', 'add-cliente-id', () => clientes);
  ligarBuscaComId('edit-remetente-input', 'edit-remetente-id', () => clientes);
  ligarBuscaComId('lote-remetente-input', 'lote-remetente-id', () => clientes);

  function mostrarMensagem(texto, tipo = 'erro') {
    exibirMensagem(msg, texto, tipo);
  }

  async function abrir(cargaId) {
    try {
      const data = await apiGet(`/api/cargas/${cargaId}`);
      cargaAtual = data.detalhes_carga;
      entregasAtuais = data.entregas;
      selecionadas.clear();
      if (!motoristas.length) await carregarListasApoio();
      renderizarCabecalho();
      renderizarAcoes();
      renderizarTabelaEntregas();
      formAdd.classList.add('hidden');
      formLote.classList.add('hidden');
      msg.classList.add('hidden');
      abrirModal(modal);
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
    badge.className = `ml-2 rounded px-2 py-0.5 text-xs ${STATUS_CORES[c.status] || 'bg-slate-600 text-slate-200'}`;

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

  function botao(label, className, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function renderizarAcoes() {
    const container = document.getElementById('det-acoes');
    container.innerHTML = '';
    const c = cargaAtual;

    container.appendChild(botao('Salvar Alteracoes', 'btn-secondary', async () => {
      await atualizarStatus(coletarCamposEditaveis(), 'Alteracoes salvas!');
    }));

    if (c.status === 'Pendente') {
      container.appendChild(botao('Agendar', 'btn-primary', async () => {
        const campos = coletarCamposEditaveis();
        if (!campos.motorista_id || !campos.veiculo_id || !campos.data_agendamento) {
          return mostrarMensagem('Motorista, veiculo e data de agendamento sao obrigatorios.', 'erro');
        }
        await atualizarStatus({
          motorista_id: campos.motorista_id,
          veiculo_id: campos.veiculo_id,
          data_agendamento: campos.data_agendamento,
          status: 'Agendada'
        }, 'Carga agendada!');
      }));
    }

    if (c.status === 'Agendada') {
      container.appendChild(botao('Iniciar Transito', 'btn-primary', async () => {
        const campos = coletarCamposEditaveis();
        if (!campos.data_carregamento) return mostrarMensagem('Informe a data de carregamento.', 'erro');
        await atualizarStatus({ data_carregamento: campos.data_carregamento, status: 'Em Trânsito' }, 'Carga em transito!');
      }));
      container.appendChild(botao('Cancelar Agendamento', 'btn-secondary', async () => {
        await atualizarStatus({ status: 'Pendente' }, 'Agendamento cancelado.');
      }));
    }

    if (c.status === 'Em Trânsito') {
      container.appendChild(botao('Finalizar', 'btn-primary', async () => {
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
      }));
      if (isAdmin) {
        container.appendChild(botao('Regredir p/ Agendada', 'btn-secondary', async () => {
          await atualizarStatus({ status: 'Agendada' }, 'Status regredido.');
        }));
      }
    }

    if (c.status === 'Finalizada' && isAdmin) {
      container.appendChild(botao('Regredir p/ Em Transito', 'btn-secondary', async () => {
        await atualizarStatus({ status: 'Em Trânsito' }, 'Status regredido.');
      }));
    }

    if (['Pendente', 'Agendada'].includes(c.status)) {
      container.appendChild(botao('Devolver p/ Rascunho', 'btn-secondary', async () => {
        if (!confirm('Devolver esta carga para Rascunho? Motorista e datas serao limpos.')) return;
        try {
          await apiPut(`/api/cargas/${c.id}/devolver-rascunho`, {});
          fecharModal(modal);
          onMudanca?.();
        } catch (err) {
          mostrarMensagem(err.message, 'erro');
        }
      }));
    }

    container.appendChild(botao('Imprimir Espelho', 'btn-secondary', () => {
      window.open(`/cargas/${c.id}/espelho_impressao`, '_blank');
    }));

    container.appendChild(botao('Gerenciar / Fat.', 'btn-secondary', () => {
      window.open(`/gerenciar-carga.html?carga_id=${c.id}`, '_blank');
    }));

    container.appendChild(botao('Registrar Avaria', 'btn-secondary', () => {
      window.open(`/avarias.html?carga_id=${c.id}`, '_blank');
    }));

    if (isAdmin) {
      container.appendChild(botao('Excluir Carga', 'btn-danger', async () => {
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
      }));
    }
  }

  function renderizarTabelaEntregas() {
    tabelaEntregas.innerHTML = entregasAtuais.map((e) => `
      <tr class="border-t border-painel-border" data-id="${e.id}">
        <td class="py-1"><input type="checkbox" class="chk-linha" ${selecionadas.has(e.id) ? 'checked' : ''}></td>
        <td class="py-1 text-center"><input type="radio" name="ultima-entrega" class="radio-ultima" ${e.is_last_delivery ? 'checked' : ''}></td>
        <td class="py-1">${escapeHtml(e.remetente_nome)}</td>
        <td class="py-1">${escapeHtml(e.razao_social)}</td>
        <td class="py-1">${escapeHtml(e.cidade)}-${escapeHtml(e.estado)}</td>
        <td class="py-1">${escapeHtml(e.nota_fiscal || '')}</td>
        <td class="py-1">${formatarPeso(e.peso_bruto)}</td>
        <td class="py-1">${formatarMoeda(e.valor_frete)}</td>
        <td class="py-1 text-right">
          <button type="button" class="btn-secondary btn-editar-entrega px-2 py-0.5">Editar</button>
          <button type="button" class="btn-danger btn-excluir-entrega px-2 py-0.5">X</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="9" class="py-3 text-center text-slate-500">Nenhuma entrega nesta carga.</td></tr>';

    tabelaEntregas.querySelectorAll('tr[data-id]').forEach((tr) => {
      const id = Number(tr.dataset.id);
      tr.querySelector('.chk-linha').addEventListener('change', (e) => {
        if (e.target.checked) selecionadas.add(id); else selecionadas.delete(id);
        document.getElementById('btn-lote-remetente').classList.toggle('hidden', selecionadas.size < 2);
      });
      tr.querySelector('.radio-ultima').addEventListener('change', async () => {
        try {
          await apiPut(`/api/entregas/${id}`, { is_last_delivery: 1 });
          await abrir(cargaAtual.id);
        } catch (err) {
          mostrarMensagem(err.message, 'erro');
        }
      });
      tr.querySelector('.btn-editar-entrega').addEventListener('click', () => abrirEdicaoEntrega(id));
      tr.querySelector('.btn-excluir-entrega').addEventListener('click', async () => {
        if (!confirm('Remover esta entrega da carga? Ela volta para "Disponiveis".')) return;
        try {
          await apiDelete(`/api/cargas/${cargaAtual.id}/entregas`, { entrega_id: id });
          await abrir(cargaAtual.id);
          onMudanca?.();
        } catch (err) {
          mostrarMensagem(err.message, 'erro');
        }
      });
    });

    document.getElementById('chk-todas').checked = false;
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
    document.getElementById('edit-msg').classList.add('hidden');
    abrirModal(modalEditar);
  }

  document.getElementById('btn-fechar-detalhes').addEventListener('click', () => fecharModal(modal));
  document.getElementById('btn-cancelar-edicao').addEventListener('click', () => fecharModal(modalEditar));

  document.getElementById('chk-todas').addEventListener('change', (e) => {
    tabelaEntregas.querySelectorAll('.chk-linha').forEach((chk) => {
      chk.checked = e.target.checked;
      chk.dispatchEvent(new Event('change'));
    });
  });

  document.getElementById('btn-add-entrega').addEventListener('click', () => {
    formAdd.classList.toggle('hidden');
  });

  document.getElementById('btn-lote-remetente').addEventListener('click', () => {
    formLote.classList.toggle('hidden');
    formLote.classList.toggle('flex');
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
        nota_fiscal: document.getElementById('edit-nf').value || null
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
