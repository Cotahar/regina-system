import { apiGet, apiPost, apiPut } from '../shared/api.js';
import { exibirMensagem, abrirModal, fecharModal } from '../shared/ui.js';
import { escapeHtml } from '../shared/escape.js';
import { configurarColarImport } from '../shared/colar-import.js';

let clientes = [];
let formasPagamento = [];

const tabela = document.getElementById('tabela-clientes');
const filtro = document.getElementById('filtro-busca');
const modal = document.getElementById('modal-cliente');
const form = document.getElementById('form-cliente');
const msgModal = document.getElementById('msg-modal');
const selectForma = document.getElementById('cliente-forma-pagamento');

async function carregar() {
  [clientes, formasPagamento] = await Promise.all([
    apiGet('/api/clientes/detalhes'),
    apiGet('/api/auxiliar/formas-pagamento')
  ]);

  selectForma.innerHTML = '<option value="">-</option>' +
    formasPagamento.map((f) => `<option value="${f.id}">${escapeHtml(f.descricao)}</option>`).join('');

  renderizar(clientes);
}

const BADGES_PERFIL = [
  ['autodescarga', 'Autodescarga'],
  ['precisa_ajudantes', 'Chapas'],
  ['descarga_paga_direto', 'Pgto direto'],
  ['precisa_agendamento', 'Agendar'],
  ['resolve_com_representante', 'Representante']
];

function badgesPerfil(c) {
  return BADGES_PERFIL
    .filter(([campo]) => c[campo])
    .map(([, rotulo]) => `<span class="mr-1 mb-1 inline-block rounded bg-painel-border px-1.5 py-0.5 text-xs text-slate-200">${rotulo}</span>`)
    .join('');
}

function renderizar(lista) {
  tabela.innerHTML = lista.map((c) => `
    <tr class="border-t border-painel-border" data-id="${c.id}">
      <td class="py-2">${escapeHtml(c.codigo_cliente)}</td>
      <td class="py-2">${escapeHtml(c.razao_social)}</td>
      <td class="py-2">${escapeHtml(c.cidade || '')}-${escapeHtml(c.estado || '')}</td>
      <td class="py-2">${escapeHtml(c.telefone_completo)}</td>
      <td class="py-2">${c.entregas_count}</td>
      <td class="py-2">${c.is_remetente ? '<span class="rounded bg-destaque/20 px-2 py-0.5 text-xs text-destaque">Sim</span>' : ''}</td>
      <td class="py-2">${badgesPerfil(c)}</td>
      <td class="py-2 text-right">
        <button class="btn-secondary btn-editar px-2 py-1 text-xs">Editar</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="8" class="py-4 text-center text-slate-500">Nenhum cliente cadastrado.</td></tr>';

  tabela.querySelectorAll('.btn-editar').forEach((btn) => {
    btn.addEventListener('click', () => abrirEdicao(Number(btn.closest('tr').dataset.id)));
  });
}

function abrirCriacao() {
  form.reset();
  document.getElementById('cliente-id').value = '';
  document.getElementById('modal-titulo').textContent = 'Novo cliente';
  msgModal.classList.add('hidden');
  abrirModal(modal);
}

function abrirEdicao(id) {
  const c = clientes.find((cli) => cli.id === id);
  if (!c) return;
  document.getElementById('cliente-id').value = c.id;
  document.getElementById('cliente-codigo').value = c.codigo_cliente;
  document.getElementById('cliente-codigo').disabled = true;
  document.getElementById('cliente-razao').value = c.razao_social;
  document.getElementById('cliente-cidade').value = c.cidade || '';
  document.getElementById('cliente-estado').value = c.estado || '';
  document.getElementById('cliente-ddd').value = c.ddd || '';
  document.getElementById('cliente-telefone').value = c.telefone || '';
  document.getElementById('cliente-observacoes').value = c.observacoes || '';
  document.getElementById('cliente-remetente').checked = !!c.is_remetente;
  document.getElementById('cliente-contato-extra').value = c.contato_extra || '';
  document.getElementById('cliente-autodescarga').checked = !!c.autodescarga;
  document.getElementById('cliente-ajudantes').checked = !!c.precisa_ajudantes;
  document.getElementById('cliente-descarga-direto').checked = !!c.descarga_paga_direto;
  document.getElementById('cliente-precisa-agendamento').checked = !!c.precisa_agendamento;
  document.getElementById('cliente-representante').checked = !!c.resolve_com_representante;
  selectForma.value = c.padrao_forma_pagamento_id || '';
  document.getElementById('cliente-tipo-pagamento').value = c.padrao_tipo_pagamento || '';
  document.getElementById('modal-titulo').textContent = 'Editar cliente';
  msgModal.classList.add('hidden');
  abrirModal(modal);
}

document.getElementById('btn-novo').addEventListener('click', () => {
  abrirCriacao();
  document.getElementById('cliente-codigo').disabled = false;
});
document.getElementById('btn-cancelar').addEventListener('click', () => fecharModal(modal));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.getElementById('cliente-id').value;
  const payload = {
    codigo_cliente: document.getElementById('cliente-codigo').value.trim(),
    razao_social: document.getElementById('cliente-razao').value.trim(),
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

  try {
    if (id) await apiPut(`/api/clientes/${id}`, payload);
    else await apiPost('/api/clientes', payload);
    fecharModal(modal);
    await carregar();
  } catch (err) {
    msgModal.textContent = err.message;
    msgModal.classList.remove('hidden');
  }
});

document.getElementById('form-import').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('arquivo-import');
  const msgImport = document.getElementById('msg-import');
  if (!input.files[0]) return;

  const formData = new FormData();
  formData.append('arquivo', input.files[0]);

  try {
    const data = await apiPost('/api/clientes/import', formData);
    exibirMensagem(msgImport, data.message, 'sucesso');
    input.value = '';
    await carregar();
  } catch (err) {
    exibirMensagem(msgImport, err.message, 'erro');
  }
});

filtro.addEventListener('input', () => {
  const termo = filtro.value.trim().toLowerCase();
  renderizar(clientes.filter((c) =>
    (c.razao_social || '').toLowerCase().includes(termo) ||
    (c.codigo_cliente || '').toLowerCase().includes(termo) ||
    (c.cidade || '').toLowerCase().includes(termo)
  ));
});

configurarColarImport({
  textareaId: 'colar-texto',
  botaoId: 'btn-colar-importar',
  msgId: 'msg-import',
  url: '/api/clientes/import',
  precisaCabecalho: true,
  onSucesso: carregar
});

carregar();
