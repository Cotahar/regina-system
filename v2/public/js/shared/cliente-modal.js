import { apiGet, apiPost, apiPut } from './api.js';
import { abrirModal, fecharModal } from './ui.js';
import { escapeHtml } from './escape.js';

// Modal de criar/editar cliente, compartilhado entre a pagina de Clientes e o
// modal de detalhes de carga - permite editar o cadastro do destinatario sem
// sair da carga (so precisa do id do cliente, nao de uma lista pre-carregada).
export function criarModalEditarCliente({ onSalvo } = {}) {
  const modal = document.getElementById('modal-cliente');
  const form = document.getElementById('form-cliente');
  const msgModal = document.getElementById('msg-modal');
  const selectForma = document.getElementById('cliente-forma-pagamento');

  let formasPagamento = null;

  async function garantirFormasPagamento() {
    if (formasPagamento) return;
    formasPagamento = await apiGet('/api/auxiliar/formas-pagamento');
    selectForma.innerHTML = '<option value="">-</option>' +
      formasPagamento.map((f) => `<option value="${f.id}">${escapeHtml(f.descricao)}</option>`).join('');
  }

  function preencherFormulario(c) {
    document.getElementById('cliente-id').value = c?.id || '';
    document.getElementById('cliente-codigo').value = c?.codigo_cliente || '';
    document.getElementById('cliente-codigo').disabled = !!c;
    document.getElementById('cliente-razao').value = c?.razao_social || '';
    document.getElementById('cliente-cnpj').value = c?.cnpj || '';
    document.getElementById('cliente-cidade').value = c?.cidade || '';
    document.getElementById('cliente-estado').value = c?.estado || '';
    document.getElementById('cliente-ddd').value = c?.ddd || '';
    document.getElementById('cliente-telefone').value = c?.telefone || '';
    document.getElementById('cliente-observacoes').value = c?.observacoes || '';
    document.getElementById('cliente-remetente').checked = !!c?.is_remetente;
    document.getElementById('cliente-contato-extra').value = c?.contato_extra || '';
    document.getElementById('cliente-autodescarga').checked = !!c?.autodescarga;
    document.getElementById('cliente-ajudantes').checked = !!c?.precisa_ajudantes;
    document.getElementById('cliente-descarga-direto').checked = !!c?.descarga_paga_direto;
    document.getElementById('cliente-precisa-agendamento').checked = !!c?.precisa_agendamento;
    document.getElementById('cliente-representante').checked = !!c?.resolve_com_representante;
    selectForma.value = c?.padrao_forma_pagamento_id || '';
    document.getElementById('cliente-tipo-pagamento').value = c?.padrao_tipo_pagamento || '';
    document.getElementById('modal-titulo').textContent = c ? 'Editar cliente' : 'Novo cliente';
    msgModal.classList.add('hidden');
  }

  async function abrirCriacao() {
    try {
      await garantirFormasPagamento();
      form.reset();
      preencherFormulario(null);
      abrirModal(modal);
    } catch (err) {
      alert(err.message);
    }
  }

  async function abrirEdicao(id) {
    try {
      await garantirFormasPagamento();
      const c = await apiGet(`/api/clientes/${id}/detalhes`);
      preencherFormulario(c);
      abrirModal(modal);
    } catch (err) {
      alert(err.message);
    }
  }

  document.getElementById('btn-cancelar').addEventListener('click', () => fecharModal(modal));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = document.getElementById('cliente-id').value;
    const payload = {
      codigo_cliente: document.getElementById('cliente-codigo').value.trim(),
      razao_social: document.getElementById('cliente-razao').value.trim(),
      cnpj: document.getElementById('cliente-cnpj').value.trim(),
      cidade: document.getElementById('cliente-cidade').value.trim(),
      estado: document.getElementById('cliente-estado').value.trim(),
      ddd: document.getElementById('cliente-ddd').value.trim(),
      telefone: document.getElementById('cliente-telefone').value.trim(),
      observacoes: document.getElementById('cliente-observacoes').value.trim(),
      is_remetente: document.getElementById('cliente-remetente').checked,
      padrao_forma_pagamento_id: selectForma.value || null,
      padrao_tipo_pagamento: document.getElementById('cliente-tipo-pagamento').value || null,
      contato_extra: document.getElementById('cliente-contato-extra').value.trim(),
      autodescarga: document.getElementById('cliente-autodescarga').checked,
      precisa_ajudantes: document.getElementById('cliente-ajudantes').checked,
      descarga_paga_direto: document.getElementById('cliente-descarga-direto').checked,
      precisa_agendamento: document.getElementById('cliente-precisa-agendamento').checked,
      resolve_com_representante: document.getElementById('cliente-representante').checked
    };

    if (!payload.autodescarga && !payload.precisa_ajudantes) {
      msgModal.textContent = 'Marque "Faz autodescarga" ou "Precisa de ajudantes (chapas)" - a entrega sempre precisa de uma forma de descarga definida.';
      msgModal.classList.remove('hidden');
      return;
    }

    try {
      if (id) await apiPut(`/api/clientes/${id}`, payload);
      else await apiPost('/api/clientes', payload);
      fecharModal(modal);
      await onSalvo?.();
    } catch (err) {
      msgModal.textContent = err.message;
      msgModal.classList.remove('hidden');
    }
  });

  return { abrirCriacao, abrirEdicao };
}
