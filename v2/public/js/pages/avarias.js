import { apiGet, apiPost, apiPut, apiDelete } from '../shared/api.js';
import { escapeHtml } from '../shared/escape.js';
import { formatarMoeda } from '../shared/format.js';
import { exibirMensagem, abrirModal, fecharModal } from '../shared/ui.js';

const isAdmin = window.__SESSAO__?.permissao === 'admin';
const params = new URLSearchParams(window.location.search);
const cargaIdRegistro = params.get('carga_id');

let marcas = [];
let clientes = [];
let motoristas = [];
let avarias = [];

const STATUS_CORES = {
  Pendente: 'bg-slate-500/30 text-slate-200',
  Enviado: 'bg-amber-500/30 text-amber-200',
  Finalizada: 'bg-emerald-500/30 text-emerald-200'
};

async function carregarFiltros() {
  [marcas, clientes, motoristas] = await Promise.all([
    apiGet('/api/marcas'), apiGet('/api/clientes'), apiGet('/api/motoristas')
  ]);
  document.getElementById('f-marca').innerHTML = '<option value="">Marca (todas)</option>' +
    marcas.map((m) => `<option value="${m.id}">${escapeHtml(m.nome)}</option>`).join('');
  document.getElementById('lista-clientes-av').innerHTML =
    clientes.map((c) => `<option value="${escapeHtml(c.text)}">`).join('');
  document.getElementById('lista-motoristas-av').innerHTML =
    motoristas.map((m) => `<option value="${escapeHtml(m.text)}">`).join('');
}

function ligarBuscaComId(inputId, hiddenId, itens) {
  document.getElementById(inputId).addEventListener('input', (e) => {
    const item = itens.find((i) => i.text === e.target.value);
    document.getElementById(hiddenId).value = item ? item.id : '';
  });
}

function montarQueryFiltros() {
  const p = new URLSearchParams();
  if (document.getElementById('f-nf').value.trim()) p.set('nf', document.getElementById('f-nf').value.trim());
  if (document.getElementById('f-status').value) p.set('status', document.getElementById('f-status').value);
  if (document.getElementById('f-marca').value) p.set('marca_id', document.getElementById('f-marca').value);
  if (document.getElementById('f-cliente-id').value) p.set('cliente_id', document.getElementById('f-cliente-id').value);
  if (document.getElementById('f-motorista-id').value) p.set('motorista_id', document.getElementById('f-motorista-id').value);
  if (document.getElementById('f-data-inicio').value) p.set('data_inicio', document.getElementById('f-data-inicio').value);
  if (document.getElementById('f-data-fim').value) p.set('data_fim', document.getElementById('f-data-fim').value);
  return p.toString();
}

async function carregarLista() {
  avarias = await apiGet(`/api/avarias?${montarQueryFiltros()}`);
  renderizarLista();
}

function renderizarLista() {
  const container = document.getElementById('lista-avarias');
  container.innerHTML = avarias.map((a) => `
    <div class="card" data-id="${a.id}">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p class="font-semibold">NF ${escapeHtml(a.nota_fiscal)} - ${escapeHtml(a.cliente)}</p>
          <p class="text-xs text-slate-400">${escapeHtml(a.data)} - Motorista: ${escapeHtml(a.motorista)} - Marca: ${escapeHtml(a.marca)}</p>
        </div>
        <span class="rounded px-2 py-0.5 text-xs ${STATUS_CORES[a.status] || 'bg-slate-600'}">${escapeHtml(a.status)}</span>
      </div>
      <ul class="mt-2 list-disc pl-5 text-xs text-slate-300">
        ${a.itens.map((i) => `<li>${escapeHtml(i.produto)} - ${i.quantidade} ${escapeHtml(i.unidade || '')}</li>`).join('')}
      </ul>
      <p class="mt-2 whitespace-pre-line text-xs text-slate-400">${escapeHtml(a.observacoes)}</p>
      ${a.fotos.length ? `<div class="mt-2 flex flex-wrap gap-2">${a.fotos.map((f) => `<a href="/uploads/avarias/${encodeURIComponent(f.arquivo)}" target="_blank"><img src="/uploads/avarias/${encodeURIComponent(f.arquivo)}" class="h-16 w-16 rounded object-cover"></a>`).join('')}</div>` : ''}
      ${a.status === 'Enviado' || a.status === 'Finalizada' ? `<p class="mt-2 text-xs text-slate-400"><strong>Envio:</strong> ${escapeHtml(a.registro_envio)}</p>` : ''}
      ${a.status === 'Finalizada' ? `<p class="mt-1 text-xs text-slate-400"><strong>Retorno:</strong> ${escapeHtml(a.retorno_fabrica)} ${a.valor_cobranca ? `(Cobranca: ${formatarMoeda(a.valor_cobranca)})` : ''}</p>` : ''}
      <div class="mt-3 flex gap-2">
        ${a.status === 'Pendente' ? '<button type="button" class="btn-secondary btn-registrar-envio px-2 py-1 text-xs">Registrar Envio</button>' : ''}
        ${a.status === 'Enviado' ? '<button type="button" class="btn-secondary btn-finalizar px-2 py-1 text-xs">Finalizar</button>' : ''}
        ${isAdmin ? '<button type="button" class="btn-danger btn-excluir px-2 py-1 text-xs">Excluir</button>' : ''}
      </div>
    </div>
  `).join('') || '<p class="text-center text-sm text-slate-500">Nenhuma avaria encontrada.</p>';

  container.querySelectorAll('[data-id]').forEach((card) => {
    const id = Number(card.dataset.id);
    card.querySelector('.btn-registrar-envio')?.addEventListener('click', () => {
      document.getElementById('envio-avaria-id').value = id;
      document.getElementById('form-envio').reset();
      abrirModal(document.getElementById('modal-envio'));
    });
    card.querySelector('.btn-finalizar')?.addEventListener('click', () => {
      document.getElementById('finalizar-avaria-id').value = id;
      document.getElementById('form-finalizar').reset();
      abrirModal(document.getElementById('modal-finalizar'));
    });
    card.querySelector('.btn-excluir')?.addEventListener('click', async () => {
      if (!confirm('Excluir esta avaria e suas fotos? Isso nao pode ser desfeito.')) return;
      try {
        await apiDelete(`/api/avarias/${id}`);
        await carregarLista();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

document.querySelectorAll('.btn-fechar-modal').forEach((btn) => {
  btn.addEventListener('click', () => btn.closest('[id^="modal-"]').classList.add('hidden'));
});

document.getElementById('form-envio')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.getElementById('envio-avaria-id').value;
  try {
    await apiPut(`/api/avarias/${id}`, { acao: 'registrar_envio', registro_envio: document.getElementById('envio-texto').value.trim() });
    fecharModal(document.getElementById('modal-envio'));
    await carregarLista();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('form-finalizar')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.getElementById('finalizar-avaria-id').value;
  try {
    await apiPut(`/api/avarias/${id}`, {
      acao: 'finalizar',
      retorno_fabrica: document.getElementById('finalizar-retorno').value.trim(),
      valor_cobranca: document.getElementById('finalizar-valor').value.replace(',', '.') || 0
    });
    fecharModal(document.getElementById('modal-finalizar'));
    await carregarLista();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('form-filtros')?.addEventListener('submit', (event) => {
  event.preventDefault();
  carregarLista();
});

// --- FLUXO DE REGISTRO (quando ?carga_id= esta presente) ---
function linhaItem() {
  const div = document.createElement('div');
  div.className = 'grid grid-cols-3 gap-2';
  div.innerHTML = `
    <input type="text" class="input-field item-produto" placeholder="Produto" required>
    <input type="text" class="input-field item-quantidade" placeholder="Quantidade" required>
    <input type="text" class="input-field item-unidade" placeholder="Unidade (cx, m2, pc)">
  `;
  return div;
}

async function iniciarRegistro() {
  document.getElementById('view-lista').classList.add('hidden');
  document.getElementById('view-registro').classList.remove('hidden');
  document.getElementById('reg-itens').appendChild(linhaItem());

  const [carga, marcasLista] = await Promise.all([apiGet(`/api/cargas/${cargaIdRegistro}`), apiGet('/api/marcas')]);
  document.getElementById('reg-codigo-carga').textContent = carga.detalhes_carga.codigo_carga;
  document.getElementById('reg-marca').innerHTML = marcasLista.map((m) => `<option value="${m.id}">${escapeHtml(m.nome)}</option>`).join('');
  document.getElementById('reg-entrega').innerHTML = carga.entregas.map((e) =>
    `<option value="${e.id}">NF ${escapeHtml(e.nota_fiscal || 'S/N')} - ${escapeHtml(e.razao_social)}</option>`
  ).join('');
}

document.getElementById('btn-add-item')?.addEventListener('click', () => {
  document.getElementById('reg-itens').appendChild(linhaItem());
});

document.getElementById('btn-voltar-lista')?.addEventListener('click', () => {
  window.location.href = '/avarias.html';
});

document.getElementById('form-registro')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const regMsg = document.getElementById('reg-msg');
  const linhas = [...document.querySelectorAll('#reg-itens > div')];
  const itens = linhas.map((linha) => ({
    produto: linha.querySelector('.item-produto').value.trim(),
    quantidade: Number(linha.querySelector('.item-quantidade').value.replace(',', '.')) || 0,
    unidade: linha.querySelector('.item-unidade').value.trim()
  })).filter((it) => it.produto);

  if (!itens.length) return exibirMensagem(regMsg, 'Adicione ao menos um item.', 'erro');

  const entregaSelect = document.getElementById('reg-entrega');
  const notaFiscal = entregaSelect.selectedOptions[0]?.textContent.replace('NF ', '').split(' - ')[0] || '';

  try {
    const resposta = await apiPost('/api/avarias', {
      entrega_id: Number(entregaSelect.value),
      marca_id: Number(document.getElementById('reg-marca').value),
      tipo_descarga: document.getElementById('reg-tipo-descarga').value,
      nota_fiscal: notaFiscal === 'S/N' ? '' : notaFiscal,
      itens
    });

    const arquivos = [...document.getElementById('reg-fotos').files];
    if (arquivos.length) {
      const barra = document.getElementById('reg-progresso-barra');
      document.getElementById('reg-progresso').classList.remove('hidden');
      for (let i = 0; i < arquivos.length; i++) {
        const formData = new FormData();
        formData.append('fotos', arquivos[i]);
        await apiPost(`/api/avarias/${resposta.avaria_id}/upload`, formData);
        barra.style.width = `${Math.round(((i + 1) / arquivos.length) * 100)}%`;
      }
    }

    exibirMensagem(regMsg, 'Avaria registrada com sucesso!', 'sucesso');
    setTimeout(() => { window.location.href = '/avarias.html'; }, 1200);
  } catch (err) {
    exibirMensagem(regMsg, err.message, 'erro');
  }
});

if (cargaIdRegistro) {
  iniciarRegistro();
} else {
  carregarFiltros().then(() => {
    ligarBuscaComId('f-cliente-input', 'f-cliente-id', clientes);
    ligarBuscaComId('f-motorista-input', 'f-motorista-id', motoristas);
  });
  carregarLista();
}
