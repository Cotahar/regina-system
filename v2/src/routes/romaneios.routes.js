import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireLogin } from '../middleware/auth.js';
import { gmailConfigurado } from '../services/gmailImport.service.js';
import { executarCicloRomaneios, liberarErrosParaReprocessar, criarEntregaDaCargaOrigem, inicioDaImportacao } from '../services/romaneioImport.service.js';
import { marcarCargaColetadaManual } from '../services/coleta.service.js';
import { notificarMudanca } from '../services/eventos.js';

export const romaneiosRouter = Router();

// Dia de hoje no horario de Brasilia (AAAA-MM-DD) - o prazo de embarque e uma data.
function hojeBrasilia() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function diasEntre(dataA, dataB) {
  return Math.round((Date.parse(`${dataB}T00:00:00Z`) - Date.parse(`${dataA}T00:00:00Z`)) / 86400000);
}

const SELECT_ROMANEIOS = `
  SELECT co.*, e.id AS entrega_id, e.carga_id, e.ordem_coleta_id, e.data_coleta,
    oc.codigo AS ordem_codigo, c.codigo_carga, c.status AS carga_status,
    (SELECT group_concat(n.numero_nf, ', ') FROM notas_fiscais_email n WHERE n.entrega_id = e.id AND n.status = 'vinculada') AS notas
  FROM cargas_origem co
  LEFT JOIN entregas e ON e.carga_origem_id = co.id
  LEFT JOIN ordens_coleta oc ON oc.id = e.ordem_coleta_id
  LEFT JOIN cargas c ON c.id = e.carga_id
`;

// Onde a carga esta no ciclo, o que precisa de atencao e quantos dias faltam pro
// prazo de embarque da fabrica (so enquanto ainda nao foi coletada/cancelada).
function montarRomaneio(r, hoje) {
  const emAndamento = r.status === 'disponivel';
  let situacao = r.status;
  if (emAndamento) situacao = r.entrega_id ? (r.ordem_coleta_id || r.carga_id ? 'programada' : 'disponivel') : 'sem_entrega';

  const diasRestantes = emAndamento && r.prazo_limite ? diasEntre(hoje, r.prazo_limite) : null;
  const motivos = [];
  if (diasRestantes != null && diasRestantes < 0) motivos.push(`Prazo de embarque vencido ha ${-diasRestantes} dia(s)`);
  else if (diasRestantes != null && diasRestantes <= 2) motivos.push(diasRestantes === 0 ? 'Prazo de embarque vence hoje' : `Prazo de embarque vence em ${diasRestantes} dia(s)`);
  const canceladaEmUso = r.status === 'cancelada' && !!(r.carga_id || r.ordem_coleta_id || r.data_coleta);
  if (canceladaEmUso) motivos.push(r.data_coleta ? 'Cancelada pela fabrica DEPOIS da coleta' : 'Cancelada pela fabrica, mas ja esta numa carga/ordem de coleta');
  if (r.nf_cancelada_numero) motivos.push(`NF ${r.nf_cancelada_numero} cancelada pela fabrica`);
  const coletadaSemOrdem = r.status === 'coletada' && r.entrega_id && !r.ordem_coleta_id;
  if (coletadaSemOrdem) motivos.push('Coletada sem Ordem de Coleta programada');

  return {
    id: r.id,
    numero_carga: r.numero_carga,
    tipo: r.tipo,
    situacao,
    filial_nome: r.filial_nome,
    local_coleta: r.local_coleta,
    destinatario_nome: r.destinatario_nome,
    cidade_entrega: r.cidade_entrega,
    uf_entrega: r.uf_entrega,
    peso_bruto: r.peso_bruto,
    caixas: r.caixas,
    modalidade_frete: r.modalidade_frete,
    tipo_venda: r.tipo_venda,
    vendedor: r.vendedor,
    liberada_em: r.liberada_em,
    cronograma: r.cronograma,
    prazo_limite: r.prazo_limite,
    dias_restantes: diasRestantes,
    coletada_em: r.coletada_em,
    cancelada_em: r.cancelada_em,
    motivo_cancelamento: r.motivo_cancelamento,
    sem_romaneio: !!r.sem_romaneio,
    entrega_id: r.entrega_id,
    ordem_codigo: r.ordem_codigo,
    carga_codigo: r.carga_codigo,
    carga_status: r.carga_status,
    notas: r.notas,
    nf_cancelada_numero: r.nf_cancelada_numero,
    atencao: motivos
  };
}

function filtrar(lista, { situacao, q, atencao }) {
  const termo = (q || '').trim().toLowerCase();
  return lista.filter((r) => {
    if (situacao && r.situacao !== situacao) return false;
    if (atencao === '1' && !r.atencao.length) return false;
    if (termo) {
      const texto = `${r.numero_carga} ${r.destinatario_nome || ''} ${r.cidade_entrega || ''} ${r.uf_entrega || ''} ${r.notas || ''} ${r.filial_nome || ''}`.toLowerCase();
      if (!texto.includes(termo)) return false;
    }
    return true;
  });
}

romaneiosRouter.get('/api/romaneios', requireLogin, (req, res) => {
  const hoje = hojeBrasilia();
  const todas = db.prepare(`${SELECT_ROMANEIOS} ORDER BY co.liberada_em DESC, co.id DESC`).all().map((r) => montarRomaneio(r, hoje));
  const filtradas = filtrar(todas, req.query);
  const limite = Math.min(Number(req.query.limite) || 300, 1000);
  res.json({ total: filtradas.length, romaneios: filtradas.slice(0, limite) });
});

romaneiosRouter.get('/api/romaneios/resumo', requireLogin, (req, res) => {
  const hoje = hojeBrasilia();
  const todas = db.prepare(`${SELECT_ROMANEIOS}`).all().map((r) => montarRomaneio(r, hoje));
  const contagem = { disponivel: 0, programada: 0, sem_entrega: 0, coletada: 0, cancelada: 0 };
  todas.forEach((r) => { contagem[r.situacao] = (contagem[r.situacao] || 0) + 1; });

  // Tempo entre a liberacao e a coleta (dias), das cargas coletadas nos ultimos 90 dias.
  const desde = new Date(Date.now() - 90 * 86400000).toISOString();
  const coletadas = db.prepare("SELECT liberada_em, coletada_em, prazo_embarque_dias FROM cargas_origem WHERE status = 'coletada' AND liberada_em IS NOT NULL AND coletada_em IS NOT NULL AND liberada_em >= ?").all(desde);
  const dias = coletadas.map((c) => (Date.parse(`${c.coletada_em.replace(' ', 'T')}Z`) - Date.parse(c.liberada_em)) / 86400000).filter((d) => d >= 0).sort((a, b) => a - b);
  const comPrazo = coletadas.filter((c) => c.prazo_embarque_dias != null);
  const dentroDoPrazo = comPrazo.filter((c) => (Date.parse(`${c.coletada_em.replace(' ', 'T')}Z`) - Date.parse(c.liberada_em)) / 86400000 <= c.prazo_embarque_dias).length;

  const erros = db.prepare("SELECT id, assunto, recebido_em, erro FROM romaneio_mensagens WHERE tipo = 'erro' ORDER BY id DESC LIMIT 5").all();
  const ultima = db.prepare("SELECT MAX(recebido_em) AS ultima FROM romaneio_mensagens WHERE tipo != 'erro'").get().ultima;

  res.json({
    contagem,
    atencao: todas.filter((r) => r.atencao.length).length,
    prazo_vencido: todas.filter((r) => r.dias_restantes != null && r.dias_restantes < 0).length,
    prazo_vencendo: todas.filter((r) => r.dias_restantes != null && r.dias_restantes >= 0 && r.dias_restantes <= 2).length,
    tempo_ate_coleta: dias.length ? {
      amostra: dias.length,
      media_dias: dias.reduce((a, b) => a + b, 0) / dias.length,
      mediana_dias: dias[Math.floor(dias.length / 2)],
      dentro_do_prazo_pct: comPrazo.length ? Math.round((100 * dentroDoPrazo) / comPrazo.length) : null
    } : null,
    erros,
    ultima_mensagem_em: ultima,
    gmail_configurado: gmailConfigurado(),
    importando_desde: gmailConfigurado() ? inicioDaImportacao() : null
  });
});

romaneiosRouter.get('/api/romaneios/:id', requireLogin, (req, res) => {
  const r = db.prepare(`${SELECT_ROMANEIOS} WHERE co.id = ?`).get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Carga nao encontrada' });
  const json = (texto) => { try { return texto ? JSON.parse(texto) : null; } catch { return null; } };
  const notas = r.entrega_id
    ? db.prepare("SELECT id, numero_nf, data_emissao, peso_bruto, data_recebimento FROM notas_fiscais_email WHERE entrega_id = ? AND status = 'vinculada' ORDER BY id").all(r.entrega_id)
    : [];
  const mensagens = db.prepare("SELECT tipo, assunto, mensagem_numero, recebido_em FROM romaneio_mensagens WHERE (',' || cargas || ',') LIKE ? ORDER BY recebido_em").all(`%,${r.numero_carga},%`);
  res.json({
    ...montarRomaneio(r, hojeBrasilia()),
    endereco_entrega: r.endereco_entrega,
    entrega_na_obra: !!r.entrega_na_obra,
    destinatario_cnpj: r.destinatario_cnpj,
    destinatario_cidade: r.destinatario_cidade,
    destinatario_uf: r.destinatario_uf,
    valor_mercadoria: r.valor_mercadoria,
    transportadora: r.transportadora,
    observacoes_origem: json(r.observacoes_origem) || {},
    itens: json(r.itens) || [],
    nfs_amostra: json(r.nfs_amostra) || [],
    regras: json(r.regras) || {},
    notas_ligadas: notas,
    mensagens
  });
});

// Le a caixa agora, sem esperar o proximo ciclo automatico (so leitura).
romaneiosRouter.post('/api/romaneios/importar', requireLogin, async (req, res) => {
  if (!gmailConfigurado()) return res.status(400).json({ error: 'A importacao por e-mail nao esta configurada neste ambiente.' });
  try {
    const r = await executarCicloRomaneios();
    if (r.emAndamento) return res.json({ message: 'Ja existe uma leitura em andamento - aguarde alguns instantes.', resultado: r });
    res.json({
      message: r.emails
        ? `${r.emails} e-mail(s) lido(s): ${r.novas} carga(s) nova(s), ${r.atualizadas} atualizada(s), ${r.canceladas} cancelamento(s), ${r.nfCanceladas} NF cancelada(s), ${r.erros} erro(s).`
        : 'Nenhum e-mail novo da fabrica.',
      resultado: r
    });
  } catch (err) {
    res.status(502).json({ error: `Nao foi possivel ler a caixa de e-mail: ${err.message}` });
  }
});

romaneiosRouter.post('/api/romaneios/reprocessar-erros', requireLogin, (req, res) => {
  const n = liberarErrosParaReprocessar();
  res.json({ message: n ? `${n} e-mail(s) com erro serao lidos de novo no proximo ciclo (ou clique em "Ler e-mails agora").` : 'Nenhum e-mail com erro.' });
});

romaneiosRouter.post('/api/romaneios/:id/criar-entrega', requireLogin, (req, res) => {
  const co = db.prepare('SELECT * FROM cargas_origem WHERE id = ?').get(req.params.id);
  if (!co) return res.status(404).json({ error: 'Carga nao encontrada' });
  if (co.status === 'cancelada') return res.status(409).json({ error: 'Essa carga foi cancelada pela fabrica.' });
  if (!co.cliente_id) return res.status(409).json({ error: 'Essa carga nao tem destinatario cadastrado (veio so de um cancelamento).' });
  const id = criarEntregaDaCargaOrigem(co.id);
  notificarMudanca('romaneios');
  res.status(201).json({ message: 'Entrega criada em Disponiveis (Montagem).', entrega_id: id });
});

romaneiosRouter.post('/api/romaneios/:id/marcar-coletada', requireLogin, (req, res) => {
  const r = marcarCargaColetadaManual(Number(req.params.id));
  if (r.erro) return res.status(r.status || 400).json({ error: r.erro });
  res.json({ message: 'Carga marcada como coletada.' });
});
