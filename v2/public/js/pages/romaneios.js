import { apiGet, apiPost } from '../shared/api.js';
import { escapeHtml } from '../shared/escape.js';
import { formatarPeso, formatarData } from '../shared/format.js';
import { exibirMensagem, abrirModal, fecharModal } from '../shared/ui.js';
import { iconeMenuAcoes, criarMenuAcoes } from '../shared/menuAcoes.js';
import { ouvirMudancas } from '../shared/live.js';

const tabela = document.getElementById('rom-tabela');
const msg = document.getElementById('rom-msg');
const busca = document.getElementById('rom-busca');
const filtroSituacao = document.getElementById('rom-filtro-situacao');
const filtroAtencao = document.getElementById('rom-filtro-atencao');
const modal = document.getElementById('modal-rom-detalhe');

let romaneios = [];

const SITUACAO = {
  disponivel: { rotulo: 'Disponivel', cor: 'bg-sky-900/40 text-sky-300' },
  programada: { rotulo: 'Programada', cor: 'bg-blue-900/40 text-blue-300' },
  coletada: { rotulo: 'Coletada', cor: 'bg-emerald-900/40 text-emerald-300' },
  cancelada: { rotulo: 'Cancelada', cor: 'bg-red-900/40 text-red-300' },
  sem_entrega: { rotulo: 'Sem entrega', cor: 'bg-amber-900/40 text-amber-300' }
};

const dataHora = (iso) => {
  if (!iso) return '-';
  const d = new Date(String(iso).includes('T') ? iso : `${String(iso).replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

function chipSituacao(r) {
  const s = SITUACAO[r.situacao] || { rotulo: r.situacao, cor: '' };
  const extra = r.situacao === 'coletada' && r.cancelada_em ? ' (cancelada depois)' : '';
  return `<span class="rounded px-1.5 py-0.5 text-[10px] ${s.cor}">${escapeHtml(s.rotulo)}${extra}</span>`;
}

function celulaPrazo(r) {
  if (r.dias_restantes == null) return r.situacao === 'disponivel' || r.situacao === 'programada' ? '<span class="text-slate-500">-</span>' : '';
  const limite = formatarData(r.prazo_limite);
  if (r.dias_restantes < 0) return `<span class="rounded bg-red-900/40 px-1.5 py-0.5 text-red-300">${limite} - vencido ha ${-r.dias_restantes}d</span>`;
  if (r.dias_restantes <= 2) return `<span class="rounded bg-amber-900/40 px-1.5 py-0.5 text-amber-300">${limite} - ${r.dias_restantes === 0 ? 'vence hoje' : `${r.dias_restantes}d`}</span>`;
  return `<span class="text-slate-300">${limite} (${r.dias_restantes}d)</span>`;
}

function linha(r) {
  const destino = [r.cidade_entrega, r.uf_entrega].filter(Boolean).join('/');
  const cif = r.modalidade_frete === 'CIF' ? ' <span class="rounded bg-violet-900/40 px-1 text-[10px] text-violet-300">CIF</span>' : '';
  const amostra = r.tipo === 'amostra' ? ' <span class="rounded bg-slate-700/40 px-1 text-[10px] text-slate-300">amostra</span>' : '';
  const alerta = r.atencao.length ? ` <span title="${escapeHtml(r.atencao.join(' | '))}" class="cursor-help text-red-400">&#9888;</span>` : '';
  const vinculo = r.ordem_codigo ? `<br><span class="text-slate-500">${escapeHtml(r.ordem_codigo)}</span>` : (r.carga_codigo ? `<br><span class="text-slate-500">${escapeHtml(r.carga_codigo)}</span>` : '');
  const nota = r.notas ? `<br><span class="text-slate-500">NF ${escapeHtml(r.notas)}</span>` : '';
  return `
    <tr class="border-t border-painel-border" data-id="${r.id}">
      <td class="py-1.5 px-1.5 font-mono text-[11px]"><button type="button" class="btn-detalhe text-brand-yellow hover:underline">${escapeHtml(r.numero_carga)}</button>${cif}${amostra}${alerta}</td>
      <td class="py-1.5 px-1.5">${escapeHtml(r.destinatario_nome || '-')}</td>
      <td class="py-1.5 px-1.5">${escapeHtml(destino || '-')}</td>
      <td class="py-1.5 px-1.5">${r.peso_bruto ? formatarPeso(r.peso_bruto) : '-'}</td>
      <td class="py-1.5 px-1.5">${escapeHtml((r.local_coleta || '').split(',').pop().trim() || r.filial_nome || '-')}</td>
      <td class="py-1.5 px-1.5">${dataHora(r.liberada_em)}</td>
      <td class="py-1.5 px-1.5">${celulaPrazo(r)}</td>
      <td class="py-1.5 px-1.5">${chipSituacao(r)}${vinculo}${nota}</td>
      <td class="py-1.5 px-1.5 text-right">${iconeMenuAcoes()}</td>
    </tr>
  `;
}

function renderizarTabela() {
  tabela.innerHTML = romaneios.map(linha).join('') ||
    '<tr><td colspan="9" class="py-4 text-center text-slate-400">Nenhum romaneio encontrado.</td></tr>';

  tabela.querySelectorAll('tr[data-id]').forEach((tr) => {
    const id = Number(tr.dataset.id);
    const r = romaneios.find((x) => x.id === id);
    tr.querySelector('.btn-detalhe').addEventListener('click', () => abrirDetalhe(id));
    const itens = [{ label: 'Ver detalhes', onClick: () => abrirDetalhe(id) }];
    if (['disponivel', 'programada'].includes(r.situacao)) itens.push({ label: 'Marcar como coletada', onClick: () => marcarColetada(r) });
    if (r.situacao === 'sem_entrega') itens.push({ label: 'Criar entrega (Montagem)', onClick: () => criarEntrega(r) });
    criarMenuAcoes(tr.querySelector('.btn-menu-acoes'), itens);
  });
}

function renderizarResumo(res) {
  const c = res.contagem;
  const cartoes = [
    { chave: 'disponivel', rotulo: 'Disponiveis', valor: c.disponivel + (c.sem_entrega || 0), cor: 'text-sky-300' },
    { chave: 'programada', rotulo: 'Programadas', valor: c.programada, cor: 'text-blue-300' },
    { chave: 'coletada', rotulo: 'Coletadas', valor: c.coletada, cor: 'text-emerald-300' },
    { chave: 'cancelada', rotulo: 'Canceladas', valor: c.cancelada, cor: 'text-red-300' },
    { chave: 'atencao', rotulo: 'Precisam de atencao', valor: res.atencao, cor: res.atencao ? 'text-red-400' : 'text-slate-400' }
  ];
  document.getElementById('rom-cards').innerHTML = cartoes.map((k) => `
    <button type="button" data-cartao="${k.chave}" class="card text-left transition-colors hover:bg-white/5">
      <p class="text-[11px] uppercase tracking-wide text-slate-400">${k.rotulo}</p>
      <p class="mt-1 text-2xl font-semibold ${k.cor}">${k.valor}</p>
      ${k.chave === 'disponivel' && (res.prazo_vencido || res.prazo_vencendo) ? `<p class="mt-0.5 text-[11px] text-amber-300">${res.prazo_vencido} vencido(s), ${res.prazo_vencendo} vencendo</p>` : ''}
    </button>
  `).join('');
  document.querySelectorAll('[data-cartao]').forEach((btn) => btn.addEventListener('click', () => {
    const k = btn.dataset.cartao;
    filtroAtencao.checked = k === 'atencao';
    filtroSituacao.value = k === 'atencao' ? '' : k;
    carregar();
  }));

  const t = res.tempo_ate_coleta;
  const tempo = document.getElementById('rom-tempo');
  tempo.classList.toggle('hidden', !t);
  if (t) {
    tempo.textContent = `Tempo da liberacao ate a coleta (ultimos 90 dias, ${t.amostra} carga(s)): media ${t.media_dias.toFixed(1)} dias, mediana ${t.mediana_dias.toFixed(1)}${t.dentro_do_prazo_pct != null ? `; ${t.dentro_do_prazo_pct}% coletadas dentro do prazo de embarque` : ''}.`;
  }

  const ultimaTexto = res.ultima_mensagem_em ? `Ultimo e-mail da fabrica: ${dataHora(res.ultima_mensagem_em)}` : (res.gmail_configurado ? 'Nenhum e-mail lido ainda' : 'Leitura de e-mail nao configurada neste ambiente');
  document.getElementById('rom-ultima').textContent = res.importando_desde ? `${ultimaTexto} · lendo e-mails recebidos desde ${dataHora(res.importando_desde)}` : ultimaTexto;
  document.getElementById('btn-rom-importar').classList.toggle('hidden', !res.gmail_configurado);

  const erros = document.getElementById('rom-erros');
  erros.classList.toggle('hidden', !res.erros.length);
  document.getElementById('rom-erros-lista').innerHTML = res.erros.map((e) => `<li>${dataHora(e.recebido_em)} - ${escapeHtml(e.erro || 'erro desconhecido')}</li>`).join('');
}

async function carregar() {
  const params = new URLSearchParams();
  if (busca.value.trim()) params.set('q', busca.value.trim());
  if (filtroSituacao.value) params.set('situacao', filtroSituacao.value);
  if (filtroAtencao.checked) params.set('atencao', '1');
  const [lista, resumo] = await Promise.all([apiGet(`/api/romaneios?${params}`), apiGet('/api/romaneios/resumo')]);
  romaneios = lista.romaneios;
  document.getElementById('rom-contagem').textContent = lista.total > romaneios.length ? `${romaneios.length} de ${lista.total}` : `${lista.total} carga(s)`;
  renderizarResumo(resumo);
  renderizarTabela();
}

async function marcarColetada(r) {
  if (!confirm(`Marcar a carga ${r.numero_carga} como coletada?\n\nUse quando o caminhao ja carregou mas a NF-e nao chegou pelo e-mail.`)) return;
  try {
    const resp = await apiPost(`/api/romaneios/${r.id}/marcar-coletada`, {});
    exibirMensagem(msg, resp.message, 'sucesso');
    await carregar();
  } catch (err) {
    exibirMensagem(msg, err.message, 'erro');
  }
}

async function criarEntrega(r) {
  try {
    const resp = await apiPost(`/api/romaneios/${r.id}/criar-entrega`, {});
    exibirMensagem(msg, resp.message, 'sucesso');
    await carregar();
  } catch (err) {
    exibirMensagem(msg, err.message, 'erro');
  }
}

// --- DETALHE ---
const ROTULOS_OBS = {
  periodo: 'Periodo', restricao_veiculo: 'Restricao de veiculo', dificuldade_entrega: 'Dificuldade de entrega', contato: 'Contato',
  fone1: 'Fone 1', fone2: 'Fone 2', email: 'E-mail', obs: 'Obs', aviso_endereco: 'Aviso no endereco', redespacho: 'Redespacho'
};

const par = (rotulo, valor) => (valor || valor === 0
  ? `<div><span class="text-slate-500">${rotulo}:</span> <span class="text-slate-200">${escapeHtml(String(valor))}</span></div>` : '');

async function abrirDetalhe(id) {
  const d = await apiGet(`/api/romaneios/${id}`);
  document.getElementById('rom-det-titulo').innerHTML = `Carga ${escapeHtml(d.numero_carga)} ${chipSituacao(d)}${d.modalidade_frete === 'CIF' ? ' <span class="rounded bg-violet-900/40 px-1.5 py-0.5 text-[10px] text-violet-300">CIF</span>' : ''}`;
  document.getElementById('rom-det-sub').textContent = `${d.destinatario_nome || ''} - ${[d.cidade_entrega, d.uf_entrega].filter(Boolean).join('/')}`;
  document.getElementById('rom-det-alertas').innerHTML = d.atencao.map((a) => `<p class="rounded border border-red-500/40 bg-red-900/20 px-2 py-1 text-xs text-red-300">&#9888; ${escapeHtml(a)}</p>`).join('');

  const obs = Object.entries(d.observacoes_origem).filter(([k]) => ROTULOS_OBS[k]).map(([k, v]) => par(ROTULOS_OBS[k], v)).join('');
  const regras = (d.regras.regras || []).map((r) => `<li>${escapeHtml(r)}</li>`).join('');
  const avisoCif = (d.regras.aviso_cif || []).map((l) => `<li>${escapeHtml(l)}</li>`).join('');
  const itens = d.itens.map((i) => `<tr><td class="py-0.5 pr-3">${escapeHtml(String(i.quantidade).replace('.', ','))} ${escapeHtml(i.unidade)}</td><td class="pr-3">${escapeHtml(i.produto)}</td><td class="text-slate-500">${escapeHtml(i.fabrica)} / NF ${escapeHtml(i.nf)}</td></tr>`).join('');
  const prazos = d.regras.prazos?.dias ? Object.entries(d.regras.prazos.dias).map(([reg, dias]) => `${reg}: ${dias}d`).join(' &middot; ') : '';

  document.getElementById('rom-det-corpo').innerHTML = `
    <section class="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
      ${par('Origem', d.filial_nome)}${par('Local de coleta', d.local_coleta)}${par('Tipo de venda', d.tipo_venda)}${par('Vendedor', d.vendedor)}
      ${par('Peso bruto', d.peso_bruto ? formatarPeso(d.peso_bruto) : null)}${par('Caixas', d.caixas)}
      ${par('Valor da mercadoria', d.valor_mercadoria != null ? d.valor_mercadoria.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null)}
      ${par('Cronograma', d.cronograma ? formatarData(d.cronograma) : null)}
      ${par('Liberada em', dataHora(d.liberada_em))}${par('Prazo de embarque', d.prazo_limite ? `${formatarData(d.prazo_limite)} (${d.dias_restantes != null ? `${d.dias_restantes}d` : 'encerrado'})` : null)}
      ${par('Coletada em', d.coletada_em ? dataHora(d.coletada_em) : null)}
      ${par('Cancelada em', d.cancelada_em ? `${dataHora(d.cancelada_em)}${d.motivo_cancelamento ? ` - motivo: ${d.motivo_cancelamento}` : ''}` : null)}
    </section>
    <section>
      <p class="mb-1 font-semibold text-slate-300">Destinatario</p>
      <div class="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
        ${par('Cliente', d.destinatario_nome)}${par('CNPJ', d.destinatario_cnpj)}
        ${par('Endereco de entrega', d.endereco_entrega)}${par('Entrega na obra', d.entrega_na_obra ? 'sim' : null)}
      </div>
    </section>
    ${obs ? `<section><p class="mb-1 font-semibold text-slate-300">Informacoes da fabrica</p><div class="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">${obs}</div></section>` : ''}
    ${d.itens.length ? `<section><p class="mb-1 font-semibold text-slate-300">Produtos</p><table class="w-full"><tbody>${itens}</tbody></table></section>` : ''}
    <section>
      <p class="mb-1 font-semibold text-slate-300">No sistema</p>
      <div class="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
        ${par('Entrega (Montagem)', d.entrega_id ? `#${d.entrega_id}` : 'nenhuma')}${par('Ordem de Coleta', d.ordem_codigo)}${par('Carga', d.carga_codigo ? `${d.carga_codigo} (${d.carga_status})` : null)}
        ${par('NF-e ligadas', d.notas_ligadas.map((n) => n.numero_nf).join(', '))}${par('NF das amostras', d.nfs_amostra.map((n) => n.nf).join(', '))}${par('NF cancelada', d.nf_cancelada_numero)}
      </div>
    </section>
    ${regras || prazos ? `<section><p class="mb-1 font-semibold text-slate-300">Regras da fabrica</p>${prazos ? `<p class="mb-1 text-slate-400">Prazo para agendar o embarque: ${prazos}</p>` : ''}<ul class="list-disc space-y-0.5 pl-5 text-slate-300">${regras}</ul>${avisoCif ? `<p class="mt-2 text-violet-300">Carga CIF:</p><ul class="list-disc space-y-0.5 pl-5 text-slate-300">${avisoCif}</ul>` : ''}</section>` : ''}
    ${d.mensagens.length ? `<section><p class="mb-1 font-semibold text-slate-300">E-mails da fabrica sobre esta carga</p><ul class="space-y-0.5 text-slate-400">${d.mensagens.map((m) => `<li>${dataHora(m.recebido_em)} - ${escapeHtml(m.tipo === 'romaneio' ? 'romaneio' : m.tipo === 'cancelamento_carga' ? 'cancelamento da carga' : 'cancelamento da NF')} ${m.mensagem_numero ? `(msg ${m.mensagem_numero})` : ''}</li>`).join('')}</ul></section>` : ''}
  `;
  abrirModal(modal);
}

document.getElementById('btn-rom-det-fechar').addEventListener('click', () => fecharModal(modal));
modal.addEventListener('click', (e) => { if (e.target === modal) fecharModal(modal); });

document.getElementById('btn-rom-importar').addEventListener('click', async (e) => {
  const botao = e.currentTarget;
  botao.disabled = true;
  botao.textContent = 'Lendo...';
  try {
    const resp = await apiPost('/api/romaneios/importar', {});
    exibirMensagem(msg, resp.message, 'sucesso');
    await carregar();
  } catch (err) {
    exibirMensagem(msg, err.message, 'erro');
  } finally {
    botao.disabled = false;
    botao.textContent = 'Ler e-mails agora';
  }
});

document.getElementById('btn-rom-reprocessar').addEventListener('click', async () => {
  try {
    const resp = await apiPost('/api/romaneios/reprocessar-erros', {});
    exibirMensagem(msg, resp.message, 'sucesso');
    await carregar();
  } catch (err) {
    exibirMensagem(msg, err.message, 'erro');
  }
});

let debounce;
busca.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(carregar, 250); });
filtroSituacao.addEventListener('change', carregar);
filtroAtencao.addEventListener('change', carregar);

ouvirMudancas(carregar);
carregar();
