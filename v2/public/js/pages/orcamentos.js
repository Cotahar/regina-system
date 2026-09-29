import { apiGet, apiPost, apiPut, apiDelete } from '../shared/api.js';
import { escapeHtml } from '../shared/escape.js';
import { formatarMoeda, formatarData, formatarCnpj, parseDecimal, getHojeFormatado } from '../shared/format.js';
import { exibirMensagem } from '../shared/ui.js';
import { criarCombobox } from '../shared/combobox.js';
import { criarComboboxMunicipio } from '../shared/municipio.js';
import { aplicarMascaraDecimal } from '../shared/mask.js';
import { ouvirMudancas } from '../shared/live.js';

const tabela = document.getElementById('tabela-orcamentos');
const secaoForm = document.getElementById('secao-form-orcamento');
const listaItens = document.getElementById('lista-itens-orcamento');
const msgForm = document.getElementById('msg-form-orcamento');

let clientes = [];
let clienteDestSelecionado = null;
const remetentesSelecionados = new Map(); // indice do item -> cliente completo

criarComboboxMunicipio({ inputCidade: document.getElementById('orc-dest-cidade'), inputUf: document.getElementById('orc-dest-estado') });
criarComboboxMunicipio({ inputCidade: document.getElementById('orc-destino-cidade'), inputUf: document.getElementById('orc-destino-estado') });

criarCombobox({
  input: document.getElementById('orc-dest-input'),
  hidden: document.getElementById('orc-dest-id'),
  getItens: () => clientes
});

// Ao vincular o destinatario, puxa nome/CNPJ/cidade do cadastro pra dentro
// do formulario - tudo editavel dali pra frente, exceto o CNPJ quando o
// cadastro ja tem um (a "chave principal" trava).
document.getElementById('orc-dest-input').addEventListener('combobox-select', async () => {
  const id = document.getElementById('orc-dest-id').value;
  if (!id) return;
  try {
    clienteDestSelecionado = await apiGet(`/api/clientes/${id}/detalhes`);
    document.getElementById('orc-dest-nome').value = clienteDestSelecionado.razao_social || '';
    document.getElementById('orc-dest-cidade').value = clienteDestSelecionado.cidade || '';
    document.getElementById('orc-dest-estado').value = clienteDestSelecionado.estado || '';
    aplicarEstadoCnpj();
    if (clienteDestSelecionado.padrao_tipo_pagamento) {
      document.getElementById('orc-pagamento').value = clienteDestSelecionado.padrao_tipo_pagamento;
    }
  } catch (err) {
    alert(err.message);
  }
});

function aplicarEstadoCnpj() {
  const input = document.getElementById('orc-dest-cnpj');
  const aviso = document.getElementById('orc-dest-cnpj-aviso');
  const temCnpj = !!clienteDestSelecionado?.cnpj;
  input.value = temCnpj ? formatarCnpj(clienteDestSelecionado.cnpj) : '';
  input.readOnly = temCnpj;
  input.classList.toggle('opacity-60', temCnpj);
  aviso.classList.toggle('hidden', temCnpj);
}

// --- ITENS DE FRETE (repetivel) ---
let itemSeq = 0;

function linhaItemHtml(indice) {
  return `
    <div class="item-orcamento rounded-md border border-painel-border p-3" data-indice="${indice}">
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div class="relative lg:col-span-2">
          <label class="label">Remetente</label>
          <input class="input-field item-remetente-input" placeholder="Buscar cliente...">
          <input type="hidden" class="item-remetente-id">
        </div>
        <div>
          <label class="label">Peso (Kg)</label>
          <input type="text" class="input-field item-peso">
        </div>
        <div>
          <label class="label">Valor/Ton (R$, opcional)</label>
          <input type="text" class="input-field item-valor-ton">
        </div>
        <div>
          <label class="label">Valor total do frete (R$)</label>
          <input type="text" class="input-field item-valor-total">
        </div>
      </div>
      <div class="mt-2 flex items-center justify-between">
        <label class="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" class="h-4 w-4 item-descarga-inclusa" checked> Descarga inclusa
        </label>
        <button type="button" class="btn-danger btn-sm btn-remover-item">Remover item</button>
      </div>
    </div>
  `;
}

function adicionarItem() {
  const indice = itemSeq++;
  const div = document.createElement('div');
  div.innerHTML = linhaItemHtml(indice).trim();
  const linha = div.firstElementChild;
  listaItens.appendChild(linha);

  const inputRemetente = linha.querySelector('.item-remetente-input');
  const hiddenRemetente = linha.querySelector('.item-remetente-id');
  criarCombobox({ input: inputRemetente, hidden: hiddenRemetente, getItens: () => clientes });
  inputRemetente.addEventListener('combobox-select', async () => {
    const id = hiddenRemetente.value;
    if (!id) return;
    try {
      // A lista de /api/clientes so tem "text" (NOME (CIDADE-UF), pro
      // combobox achar o cliente) - busca o detalhe pra pegar o nome limpo,
      // que e o que realmente vai pro PDF (o usuario ainda pode editar
      // depois se quiser um texto diferente).
      const cliente = await apiGet(`/api/clientes/${id}/detalhes`);
      remetentesSelecionados.set(indice, cliente);
      inputRemetente.value = cliente.razao_social;
    } catch (err) {
      alert(err.message);
    }
  });

  const pesoInput = linha.querySelector('.item-peso');
  const valorTonInput = linha.querySelector('.item-valor-ton');
  const valorTotalInput = linha.querySelector('.item-valor-total');
  [pesoInput, valorTonInput, valorTotalInput].forEach((input) => aplicarMascaraDecimal(input));

  // So recalcula o total quando o Valor/Ton foi preenchido - sem ele, o
  // total e digitado direto (proposta "frete fechado", sem preco por tonelada).
  function recalcular() {
    const peso = parseDecimal(pesoInput.value);
    const valorTon = parseDecimal(valorTonInput.value);
    if (peso != null && valorTon != null) {
      valorTotalInput.value = ((peso / 1000) * valorTon).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }
  [pesoInput, valorTonInput].forEach((input) => input.addEventListener('blur', recalcular));

  linha.querySelector('.btn-remover-item').addEventListener('click', () => {
    if (listaItens.children.length <= 1) return alert('O orcamento precisa de ao menos um item de frete.');
    remetentesSelecionados.delete(indice);
    linha.remove();
  });
}

// --- LISTA DE ORCAMENTOS ---
function linhaOrcamento(o) {
  const destino = [o.destino_cidade, o.destino_estado].filter(Boolean).join('/');
  return `
    <tr class="border-t border-painel-border" data-id="${o.id}">
      <td class="py-1.5 px-1.5 font-mono text-[11px]">${escapeHtml(o.codigo)}</td>
      <td class="py-1.5 px-1.5">${formatarData(o.data)}</td>
      <td class="py-1.5 px-1.5">${escapeHtml(o.destinatario_nome)}</td>
      <td class="py-1.5 px-1.5">${escapeHtml(destino || '-')}</td>
      <td class="py-1.5 px-1.5">${formatarMoeda(o.valor_total)}</td>
      <td class="py-1.5 px-1.5 text-right space-x-2">
        <button type="button" class="btn-ver-pdf text-brand-yellow hover:underline">Ver PDF</button>
        <button type="button" class="btn-duplicar-orcamento text-brand-yellow hover:underline">Duplicar</button>
        <button type="button" class="btn-excluir-orcamento text-red-400 hover:underline">Excluir</button>
      </td>
    </tr>
  `;
}

async function carregarOrcamentos() {
  const orcamentos = await apiGet('/api/orcamentos');
  tabela.innerHTML = orcamentos.map(linhaOrcamento).join('') ||
    '<tr><td colspan="6" class="py-4 text-center text-slate-400">Nenhum orcamento gerado ainda.</td></tr>';

  tabela.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = Number(tr.dataset.id);
    tr.querySelector('.btn-ver-pdf').addEventListener('click', () => window.open(`/orcamentos/${id}/pdf`, '_blank'));
    tr.querySelector('.btn-duplicar-orcamento').addEventListener('click', () => duplicarOrcamento(id));
    tr.querySelector('.btn-excluir-orcamento').addEventListener('click', () => excluirOrcamento(id));
  });
}

async function excluirOrcamento(id) {
  if (!confirm('Excluir este orcamento do historico?')) return;
  try {
    await apiDelete(`/api/orcamentos/${id}`);
    await carregarOrcamentos();
  } catch (err) {
    alert(err.message);
  }
}

function limparForm() {
  document.getElementById('orc-dest-input').value = '';
  document.getElementById('orc-dest-id').value = '';
  document.getElementById('orc-dest-nome').value = '';
  document.getElementById('orc-dest-cidade').value = '';
  document.getElementById('orc-dest-estado').value = '';
  document.getElementById('orc-data').value = getHojeFormatado();
  document.getElementById('orc-produto').value = '';
  document.getElementById('orc-destino-cidade').value = '';
  document.getElementById('orc-destino-estado').value = '';
  document.getElementById('orc-prazo').value = '';
  document.getElementById('orc-pagamento').value = '';
  document.getElementById('orc-descarga-metros').value = '25';
  document.getElementById('orc-mercadoria-segurada').checked = true;
  document.getElementById('orc-frete-ajustavel').checked = true;
  document.getElementById('orc-observacoes').value = '';
  clienteDestSelecionado = null;
  aplicarEstadoCnpj();
  remetentesSelecionados.clear();
  listaItens.innerHTML = '';
  msgForm.classList.add('hidden');
}

function abrirForm() {
  secaoForm.classList.remove('hidden');
  secaoForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.getElementById('btn-novo-orcamento').addEventListener('click', () => {
  limparForm();
  adicionarItem();
  abrirForm();
});

document.getElementById('btn-fechar-form-orcamento').addEventListener('click', () => secaoForm.classList.add('hidden'));
document.getElementById('btn-add-item-orcamento').addEventListener('click', adicionarItem);

// Duplicar: usa um orcamento anterior como ponto de partida pra um novo -
// mesmos dados, mas sempre cria um registro NOVO (nunca edita o antigo).
async function duplicarOrcamento(id) {
  try {
    const { orcamento, itens } = await apiGet(`/api/orcamentos/${id}`);
    limparForm();

    document.getElementById('orc-dest-input').value = orcamento.destinatario_nome;
    document.getElementById('orc-dest-id').value = orcamento.destinatario_id;
    clienteDestSelecionado = await apiGet(`/api/clientes/${orcamento.destinatario_id}/detalhes`);
    document.getElementById('orc-dest-nome').value = orcamento.destinatario_nome;
    document.getElementById('orc-dest-cidade').value = clienteDestSelecionado.cidade || '';
    document.getElementById('orc-dest-estado').value = clienteDestSelecionado.estado || '';
    aplicarEstadoCnpj();

    document.getElementById('orc-produto').value = orcamento.produto || '';
    document.getElementById('orc-destino-cidade').value = orcamento.destino_cidade || '';
    document.getElementById('orc-destino-estado').value = orcamento.destino_estado || '';
    document.getElementById('orc-prazo').value = orcamento.prazo_entrega || '';
    document.getElementById('orc-pagamento').value = orcamento.forma_pagamento || '';
    document.getElementById('orc-descarga-metros').value = orcamento.descarga_metros ?? '25';
    document.getElementById('orc-mercadoria-segurada').checked = !!orcamento.mercadoria_segurada;
    document.getElementById('orc-frete-ajustavel').checked = !!orcamento.frete_ajustavel_diesel;
    document.getElementById('orc-observacoes').value = orcamento.observacoes || '';

    for (const item of itens) {
      adicionarItem();
      const linha = listaItens.lastElementChild;
      linha.querySelector('.item-remetente-input').value = item.remetente_nome;
      linha.querySelector('.item-remetente-id').value = item.remetente_id;
      linha.querySelector('.item-peso').value = item.peso_kg.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (item.valor_tonelada) linha.querySelector('.item-valor-ton').value = item.valor_tonelada.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      linha.querySelector('.item-valor-total').value = item.valor_frete_total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      linha.querySelector('.item-descarga-inclusa').checked = !!item.descarga_inclusa;
    }

    abrirForm();
  } catch (err) {
    alert(err.message);
  }
}

// --- GERAR ORCAMENTO ---
async function ofertarAtualizacaoCadastro(sugestoes) {
  if (!Array.isArray(sugestoes) || !sugestoes.length) return;
  for (const s of sugestoes) {
    const linhas = s.campos.map((c) => `- ${c.rotulo}: ${c.valor}`).join('\n');
    const aceitar = confirm(`O cadastro de "${s.cliente_nome}" ficou diferente do que foi usado nessa proposta. Atualizar o cadastro com:\n\n${linhas}`);
    if (!aceitar) continue;
    try {
      const payload = {};
      s.campos.forEach((c) => { payload[c.campo] = c.valor; });
      await apiPut(`/api/clientes/${s.cliente_id}/atualizar-campos`, payload);
    } catch (err) {
      exibirMensagem(msgForm, `Erro ao atualizar cadastro de ${s.cliente_nome}: ${err.message}`, 'erro');
    }
  }
}

document.getElementById('btn-gerar-orcamento').addEventListener('click', async () => {
  const destinatarioId = document.getElementById('orc-dest-id').value;
  if (!destinatarioId) return exibirMensagem(msgForm, 'Selecione o destinatario.', 'erro');

  const linhasItens = [...listaItens.querySelectorAll('.item-orcamento')];
  const itens = linhasItens.map((linha) => {
    const pesoKg = parseDecimal(linha.querySelector('.item-peso').value);
    const valorTon = parseDecimal(linha.querySelector('.item-valor-ton').value);
    // Recalcula aqui tambem (nao so no blur) - se o usuario preencheu peso e
    // valor/ton e clicou direto em Gerar sem sair do campo, o total ainda
    // precisa estar calculado.
    let valorTotal = parseDecimal(linha.querySelector('.item-valor-total').value);
    if (valorTotal == null && pesoKg != null && valorTon != null) valorTotal = (pesoKg / 1000) * valorTon;
    return {
      remetente_id: Number(linha.querySelector('.item-remetente-id').value) || null,
      remetente_nome: linha.querySelector('.item-remetente-input').value.trim(),
      peso_kg: pesoKg,
      valor_tonelada: valorTon,
      valor_frete_total: valorTotal,
      descarga_inclusa: linha.querySelector('.item-descarga-inclusa').checked
    };
  });

  if (itens.some((i) => !i.remetente_id)) return exibirMensagem(msgForm, 'Selecione o remetente de cada item.', 'erro');
  if (itens.some((i) => !i.peso_kg)) return exibirMensagem(msgForm, 'Informe o peso de cada item.', 'erro');
  if (itens.some((i) => !i.valor_frete_total)) return exibirMensagem(msgForm, 'Informe o valor do frete de cada item.', 'erro');

  const cnpjInput = document.getElementById('orc-dest-cnpj');
  const payload = {
    destinatario_id: Number(destinatarioId),
    destinatario_nome: document.getElementById('orc-dest-nome').value.trim(),
    destinatario_cnpj: cnpjInput.readOnly ? null : cnpjInput.value,
    destinatario_cidade: document.getElementById('orc-dest-cidade').value.trim(),
    destinatario_estado: document.getElementById('orc-dest-estado').value.trim(),
    data: document.getElementById('orc-data').value,
    produto: document.getElementById('orc-produto').value.trim(),
    destino_cidade: document.getElementById('orc-destino-cidade').value.trim(),
    destino_estado: document.getElementById('orc-destino-estado').value.trim(),
    prazo_entrega: document.getElementById('orc-prazo').value.trim(),
    forma_pagamento: document.getElementById('orc-pagamento').value.trim(),
    descarga_metros: parseDecimal(document.getElementById('orc-descarga-metros').value),
    mercadoria_segurada: document.getElementById('orc-mercadoria-segurada').checked,
    frete_ajustavel_diesel: document.getElementById('orc-frete-ajustavel').checked,
    observacoes: document.getElementById('orc-observacoes').value.trim(),
    itens
  };

  try {
    const resp = await apiPost('/api/orcamentos', payload);
    secaoForm.classList.add('hidden');
    await carregarOrcamentos();
    window.open(`/orcamentos/${resp.id}/pdf`, '_blank');
    await ofertarAtualizacaoCadastro(resp.sugestoes_atualizacao_cadastro);
  } catch (err) {
    exibirMensagem(msgForm, err.message, 'erro');
  }
});

async function iniciar() {
  clientes = await apiGet('/api/clientes');
  await carregarOrcamentos();
}

iniciar();
ouvirMudancas(carregarOrcamentos);
