import { apiGet, apiPost } from '../shared/api.js';
import { exibirMensagem } from '../shared/ui.js';
import { escapeHtml } from '../shared/escape.js';
import { configurarColarImport } from '../shared/colar-import.js';
import { criarPaginacao } from '../shared/paginacao.js';
import { criarModalEditarCliente } from '../shared/cliente-modal.js';

let clientes = [];

const tabela = document.getElementById('tabela-clientes');
const filtro = document.getElementById('filtro-busca');

const paginacao = criarPaginacao({
  container: document.getElementById('paginacao-clientes'),
  renderizarPagina: renderizarLinhas
});

const modalCliente = criarModalEditarCliente({ onSalvo: carregar });

async function carregar() {
  clientes = await apiGet('/api/clientes/detalhes');
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
  paginacao.definirItens(lista);
}

function formatarCnpj(cnpj) {
  const digitos = (cnpj || '').replace(/\D/g, '');
  if (digitos.length !== 14) return cnpj || '';
  return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function renderizarLinhas(lista) {
  tabela.innerHTML = lista.map((c) => `
    <tr class="border-t border-painel-border" data-id="${c.id}">
      <td class="py-2.5">${escapeHtml(c.codigo_cliente)}</td>
      <td class="py-2.5">${escapeHtml(c.razao_social)}</td>
      <td class="py-2.5">${escapeHtml(formatarCnpj(c.cnpj))}</td>
      <td class="py-2.5">${escapeHtml(c.cidade || '')}-${escapeHtml(c.estado || '')}</td>
      <td class="py-2.5">${escapeHtml(c.telefone_completo)}</td>
      <td class="py-2.5">${c.entregas_count}</td>
      <td class="py-2.5">${c.is_remetente ? '<span class="rounded bg-amber-900/40 px-2 py-0.5 text-xs text-amber-300">Sim</span>' : ''}</td>
      <td class="py-2.5">${badgesPerfil(c)}</td>
      <td class="py-2 text-right">
        <button class="btn-secondary btn-editar btn-sm">Editar</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="9" class="py-4 text-center text-slate-400">Nenhum cliente cadastrado.</td></tr>';

  tabela.querySelectorAll('.btn-editar').forEach((btn) => {
    btn.addEventListener('click', () => modalCliente.abrirEdicao(Number(btn.closest('tr').dataset.id)));
  });
}

document.getElementById('btn-novo').addEventListener('click', () => modalCliente.abrirCriacao());

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
