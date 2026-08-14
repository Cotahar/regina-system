import { apiGet, apiPut, apiPost } from '../shared/api.js';
import { exibirMensagem, abrirModal, fecharModal } from '../shared/ui.js';
import { escapeHtml } from '../shared/escape.js';
import { criarCombobox } from '../shared/combobox.js';
import { formatarPeso, formatarMoeda, formatarData } from '../shared/format.js';
import { ouvirMudancas } from '../shared/live.js';

const msg = document.getElementById('nf-msg');
const tabela = document.getElementById('nf-tabela');
const acoesMassa = document.getElementById('nf-acoes-massa');

let notas = [];
let cargas = [];
const selecionadas = new Set();

const STATUS_LABEL = {
  pendente: 'Pendente',
  vinculada: 'Vinculada',
  entrega_criada: 'Entrega Criada',
  ignorada: 'Ignorada'
};
const STATUS_COR = {
  pendente: 'bg-amber-900/40 text-amber-300',
  vinculada: 'bg-blue-900/40 text-blue-300',
  entrega_criada: 'bg-emerald-900/40 text-emerald-300',
  ignorada: 'bg-slate-700/40 text-slate-400'
};

function formatarCnpj(cnpj) {
  if (!cnpj || cnpj.length !== 14) return cnpj || '-';
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function celulaParte(nomeCadastro, cnpj, nomeXml) {
  const nome = nomeCadastro || nomeXml || 'N/A';
  const casado = !!nomeCadastro;
  const badge = casado
    ? '<span class="ml-1 rounded bg-emerald-900/40 px-1 text-[10px] text-emerald-300">casado</span>'
    : '<span class="ml-1 rounded bg-slate-700/40 px-1 text-[10px] text-slate-400">sem cliente</span>';
  return `${escapeHtml(nome)}${badge}<br><span class="text-slate-500">${escapeHtml(formatarCnpj(cnpj))}</span>`;
}

function linhaTabela(n) {
  return `
    <tr class="border-t border-painel-border" data-id="${n.id}">
      <td class="py-1.5 px-1.5"><input type="checkbox" class="nf-chk-linha" ${selecionadas.has(n.id) ? 'checked' : ''}></td>
      <td class="py-1.5 px-1.5">${escapeHtml(n.numero_nf || '-')}</td>
      <td class="py-1.5 px-1.5">${celulaParte(n.remetente_nome_cadastro, n.cnpj_emitente, n.nome_emitente)}</td>
      <td class="py-1.5 px-1.5">${celulaParte(n.cliente_nome_cadastro, n.cnpj_destinatario, n.nome_destinatario)}</td>
      <td class="py-1.5 px-1.5">${n.peso_bruto ? formatarPeso(n.peso_bruto) : '-'}</td>
      <td class="py-1.5 px-1.5">${n.valor_total ? formatarMoeda(n.valor_total) : '-'}</td>
      <td class="py-1.5 px-1.5">${n.data_emissao ? formatarData(n.data_emissao) : '-'}</td>
      <td class="py-1.5 px-1.5">${escapeHtml(n.placa_veiculo || '-')}</td>
      <td class="py-1.5 px-1.5">${escapeHtml(n.nome_motorista || '-')}</td>
      <td class="py-1.5 px-1.5">
        <span class="rounded bg-painel-border px-1.5 py-0.5 text-[10px] uppercase text-slate-300">${escapeHtml(n.extraction_source)}</span>
        ${n.precisa_revisao ? '<span class="ml-1 rounded bg-red-900/40 px-1.5 py-0.5 text-[10px] text-red-300">conferir</span>' : ''}
      </td>
      <td class="py-1.5 px-1.5"><span class="rounded px-1.5 py-0.5 text-[10px] ${STATUS_COR[n.status] || ''}">${STATUS_LABEL[n.status] || n.status}</span></td>
      <td class="py-1.5 px-1.5 text-right">
        ${n.xml_url ? `<a href="${n.xml_url}" target="_blank" class="text-brand-yellow hover:underline">XML</a>` : ''}
        ${n.xml_url && n.pdf_url ? ' · ' : ''}
        ${n.pdf_url ? `<a href="${n.pdf_url}" target="_blank" class="text-brand-yellow hover:underline">PDF</a>` : ''}
      </td>
    </tr>
  `;
}

function renderizarTabela() {
  tabela.innerHTML = notas.map(linhaTabela).join('') ||
    '<tr><td colspan="12" class="py-4 text-center text-slate-400">Nenhuma nota encontrada.</td></tr>';

  tabela.querySelectorAll('.nf-chk-linha').forEach((chk) => {
    const id = Number(chk.closest('tr').dataset.id);
    chk.addEventListener('change', (e) => {
      if (e.target.checked) selecionadas.add(id); else selecionadas.delete(id);
      atualizarAcoesMassa();
    });
  });

  atualizarAcoesMassa();
}

function atualizarAcoesMassa() {
  acoesMassa.classList.toggle('hidden', selecionadas.size === 0);
  acoesMassa.classList.toggle('flex', selecionadas.size > 0);
}

async function carregar() {
  const params = new URLSearchParams();
  const status = document.getElementById('nf-filtro-status').value;
  const origem = document.getElementById('nf-filtro-origem').value;
  const q = document.getElementById('nf-busca').value.trim();
  if (status) params.set('status', status);
  if (origem) params.set('origem', origem);
  if (q) params.set('q', q);

  notas = await apiGet(`/api/notas-fiscais?${params.toString()}`);
  const idsValidos = new Set(notas.map((n) => n.id));
  [...selecionadas].forEach((id) => { if (!idsValidos.has(id)) selecionadas.delete(id); });
  renderizarTabela();
}

document.getElementById('nf-busca').addEventListener('input', carregar);
document.getElementById('nf-filtro-status').addEventListener('change', carregar);
document.getElementById('nf-filtro-origem').addEventListener('change', carregar);

document.getElementById('nf-chk-todas').addEventListener('change', (e) => {
  notas.forEach((n) => { if (e.target.checked) selecionadas.add(n.id); else selecionadas.delete(n.id); });
  renderizarTabela();
});

document.getElementById('btn-nf-ignorar').addEventListener('click', async () => {
  if (!confirm(`Marcar ${selecionadas.size} nota(s) como ignorada(s)?`)) return;
  try {
    await apiPut('/api/notas-fiscais/ignorar', { nota_fiscal_email_ids: [...selecionadas] });
    selecionadas.clear();
    await carregar();
    exibirMensagem(msg, 'Notas ignoradas.', 'sucesso');
  } catch (err) {
    exibirMensagem(msg, err.message, 'erro');
  }
});

// --- VINCULAR A UMA CARGA ---
const modalVincular = document.getElementById('modal-nf-vincular');
const passo1 = document.getElementById('nf-vincular-passo-1');
const passo2 = document.getElementById('nf-vincular-passo-2');
const msgVincular = document.getElementById('nf-vincular-msg');

// Texto de busca inclui motorista e placa (nao so codigo/origem) - o
// combobox filtra por substring nesse mesmo texto, entao digitar o nome do
// motorista ou a placa tambem encontra a carga.
const comboCarga = criarCombobox({
  input: document.getElementById('nf-vincular-carga-input'),
  hidden: document.getElementById('nf-vincular-carga-id'),
  getItens: () => cargas.map((c) => ({
    id: c.id,
    text: c.status === 'Rascunho'
      ? `${c.codigo_carga} - ${c.origem} - [Rascunho]`
      : `${c.codigo_carga} - ${c.origem} - ${c.motorista_nome || 'Sem motorista'} - ${c.placa_veiculo || 'Sem veiculo'}`
  }))
});

document.getElementById('btn-nf-vincular').addEventListener('click', async () => {
  const [todasAsCargas, rascunhos] = await Promise.all([
    apiGet('/api/cargas'),
    apiGet('/api/cargas/rascunhos')
  ]);
  const ativas = todasAsCargas.filter((c) => ['Pendente', 'Agendada'].includes(c.status));
  cargas = [...ativas, ...rascunhos.map((r) => ({ ...r, status: 'Rascunho' }))];
  passo1.classList.remove('hidden');
  passo2.classList.add('hidden');
  document.getElementById('nf-vincular-carga-input').value = '';
  document.getElementById('nf-vincular-carga-id').value = '';
  abrirModal(modalVincular);
});

document.getElementById('btn-nf-vincular-cancelar').addEventListener('click', () => fecharModal(modalVincular));

document.getElementById('btn-nf-vincular-continuar').addEventListener('click', async () => {
  const cargaId = document.getElementById('nf-vincular-carga-id').value;
  if (!cargaId) return exibirMensagem(msgVincular, 'Selecione uma carga.', 'erro');

  const { entregas } = await apiGet(`/api/cargas/${cargaId}/gerenciar`);
  const notasSelecionadas = notas.filter((n) => selecionadas.has(n.id));

  const opcoesEntregas = '<option value="">Selecione a linha...</option>' + entregas.map((e) =>
    `<option value="${e.id}">${escapeHtml(e.remetente_nome)} -> ${escapeHtml(e.cliente_nome)} (NF atual: ${escapeHtml(e.nota_fiscal || '-')}, ${formatarPeso(e.peso_bruto || 0)})</option>`
  ).join('');

  document.getElementById('nf-vincular-linhas').innerHTML = notasSelecionadas.map((n) => `
    <div class="rounded border border-painel-border p-2">
      <p class="mb-1 text-xs text-slate-300">NF ${escapeHtml(n.numero_nf || '-')} - ${escapeHtml(n.cliente_nome_cadastro || n.nome_destinatario || 'Cliente nao identificado')} - ${n.peso_bruto ? formatarPeso(n.peso_bruto) : 'sem peso'}</p>
      <select class="input-field nf-select-entrega" data-nota-id="${n.id}">${opcoesEntregas}</select>
    </div>
  `).join('');

  // Impede escolher a mesma linha pra duas notas diferentes - desabilita nos
  // outros selects a opcao que ja foi escolhida em algum deles.
  const todosSelects = [...document.querySelectorAll('.nf-select-entrega')];
  function atualizarOpcoesDisponiveis() {
    const escolhidos = new Set(todosSelects.map((s) => s.value).filter(Boolean));
    todosSelects.forEach((select) => {
      [...select.options].forEach((opt) => {
        if (!opt.value) return;
        opt.disabled = escolhidos.has(opt.value) && opt.value !== select.value;
      });
    });
  }
  todosSelects.forEach((select) => select.addEventListener('change', atualizarOpcoesDisponiveis));
  atualizarOpcoesDisponiveis();

  passo1.classList.add('hidden');
  passo2.classList.remove('hidden');
});

document.getElementById('btn-nf-vincular-voltar').addEventListener('click', () => {
  passo2.classList.add('hidden');
  passo1.classList.remove('hidden');
});

document.getElementById('btn-nf-vincular-salvar').addEventListener('click', async () => {
  const selects = [...document.querySelectorAll('.nf-select-entrega')];
  const atribuicoes = selects
    .map((s) => ({ nota_fiscal_email_id: Number(s.dataset.notaId), entrega_id: Number(s.value) }))
    .filter((a) => a.entrega_id);

  if (!atribuicoes.length) return exibirMensagem(msgVincular, 'Escolha a linha de pelo menos uma nota.', 'erro');

  try {
    await apiPut('/api/notas-fiscais/vincular', {
      atribuicoes,
      sobrescrever_peso_valor: document.getElementById('nf-vincular-sobrescrever').checked
    });
    fecharModal(modalVincular);
    selecionadas.clear();
    await carregar();
    exibirMensagem(msg, 'Notas vinculadas com sucesso!', 'sucesso');
  } catch (err) {
    exibirMensagem(msgVincular, err.message, 'erro');
  }
});

// --- CRIAR ENTREGA(S) DISPONIVEL(IS) ---
const modalDisponivel = document.getElementById('modal-nf-disponivel');
const msgDisponivel = document.getElementById('nf-disponivel-msg');
let clientesCache = [];

document.getElementById('btn-nf-criar-disponivel').addEventListener('click', async () => {
  clientesCache = await apiGet('/api/clientes');
  const notasSelecionadas = notas.filter((n) => selecionadas.has(n.id));

  document.getElementById('nf-disponivel-linhas').innerHTML = notasSelecionadas.map((n) => {
    if (n.cliente_id) {
      return `
        <div class="rounded border border-painel-border p-2 text-xs text-slate-300">
          NF ${escapeHtml(n.numero_nf || '-')} - destinatario: ${escapeHtml(n.cliente_nome_cadastro)}
          <input type="hidden" class="nf-disp-cliente" data-nota-id="${n.id}" value="${n.cliente_id}">
        </div>
      `;
    }
    return `
      <div class="rounded border border-amber-500/30 bg-amber-900/10 p-2">
        <p class="mb-1 text-xs text-amber-300">NF ${escapeHtml(n.numero_nf || '-')} - sem destinatario reconhecido, escolha o cliente:</p>
        <div class="relative">
          <input class="input-field nf-disp-cliente-input" placeholder="Buscar cliente...">
          <input type="hidden" class="nf-disp-cliente" data-nota-id="${n.id}">
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('#nf-disponivel-linhas .nf-disp-cliente-input').forEach((input) => {
    const hidden = input.parentElement.querySelector('.nf-disp-cliente');
    criarCombobox({ input, hidden, getItens: () => clientesCache });
  });

  abrirModal(modalDisponivel);
});

document.getElementById('btn-nf-disponivel-cancelar').addEventListener('click', () => fecharModal(modalDisponivel));

document.getElementById('btn-nf-disponivel-salvar').addEventListener('click', async () => {
  const itens = [...document.querySelectorAll('.nf-disp-cliente')].map((el) => ({
    nota_fiscal_email_id: Number(el.dataset.notaId),
    cliente_id_override: el.value ? Number(el.value) : null
  }));

  try {
    const resp = await apiPost('/api/notas-fiscais/criar-disponivel', { itens });
    fecharModal(modalDisponivel);
    selecionadas.clear();
    await carregar();
    exibirMensagem(msg, resp.message, 'sucesso');
  } catch (err) {
    exibirMensagem(msgDisponivel, err.message, 'erro');
  }
});

ouvirMudancas(carregar);
carregar();
