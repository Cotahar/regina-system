import { db } from '../db/connection.js';
import { notificarMudanca } from './eventos.js';
import { registrarOcorrencia } from './ocorrencias.service.js';

const USUARIO_SISTEMA = 'Sistema (fabrica)';

// ISO (e-mail) -> 'AAAA-MM-DD HH:MM:SS' UTC, mesmo formato do datetime('now') do banco.
function isoParaSql(iso) {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 19).replace('T', ' ') : null;
}

function agoraSql() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function formatarDataHoraBr(sql) {
  const d = new Date(`${String(sql).replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? String(sql) : d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
}

// A entrega passa a mostrar o(s) numero(s) e o peso das NF-e ligadas a ela
// (uma carga pode sair com mais de uma nota). So mexe quando ha nota ligada.
export function recalcularEntregaPelasNotas(entregaId) {
  const notas = db.prepare("SELECT numero_nf, peso_bruto FROM notas_fiscais_email WHERE entrega_id = ? AND status = 'vinculada' ORDER BY id").all(entregaId);
  if (!notas.length) return;
  const numeros = [...new Set(notas.map((n) => n.numero_nf).filter(Boolean))].join(', ') || null;
  const todasComPeso = notas.every((n) => n.peso_bruto > 0);
  const peso = todasComPeso ? notas.reduce((acc, n) => acc + n.peso_bruto, 0) : null;
  db.prepare('UPDATE entregas SET nota_fiscal = COALESCE(?, nota_fiscal), peso_bruto = COALESCE(?, peso_bruto) WHERE id = ?')
    .run(numeros, peso, entregaId);
}

// Baixa a Ordem de Coleta sozinha quando TODAS as entregas dela ja foram
// coletadas (chegou a NF-e de cada uma). So baixa quando da pra definir o local
// de coleta sem escolher por ninguem: todas as entregas com o mesmo remetente
// (a fabrica). Ordem com varias fabricas, ou com entrega que nao veio de
// romaneio, continua pendente pra baixa manual - que segue funcionando igual.
export function baixarOrdemSeCompleta(ordemId) {
  if (!ordemId) return null;
  const ordem = db.prepare('SELECT * FROM ordens_coleta WHERE id = ?').get(ordemId);
  if (!ordem || ordem.status !== 'pendente') return null;

  const entregas = db.prepare('SELECT id, remetente_id, data_coleta FROM entregas WHERE ordem_coleta_id = ?').all(ordemId);
  if (!entregas.length || entregas.some((e) => !e.data_coleta)) return 'parcial';

  const remetentes = new Set(entregas.map((e) => e.remetente_id));
  if (remetentes.size !== 1 || [...remetentes][0] == null) return 'varias_fabricas';
  const localColetaId = [...remetentes][0];
  const ultimaColeta = entregas.map((e) => e.data_coleta).sort().at(-1);

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE entregas SET local_coleta_cliente_id = ? WHERE ordem_coleta_id = ?').run(localColetaId, ordemId);
    db.prepare("UPDATE ordens_coleta SET status = 'coletada', local_coleta_cliente_id = ?, data_baixa = ? WHERE id = ?")
      .run(localColetaId, ultimaColeta, ordemId);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return 'baixada';
}

function acharCargaOrigemDaNota(nota) {
  let co = null;
  if (nota.carga_origem) {
    co = db.prepare('SELECT * FROM cargas_origem WHERE numero_carga = ?').get(String(nota.carga_origem)) || null;
  }
  // Amostras: o romaneio ja traz o numero da NF (a carga so e conhecida por ele).
  if (!co && nota.numero_nf) {
    const numero = String(nota.numero_nf).replace(/^0+/, '');
    co = db.prepare("SELECT * FROM cargas_origem WHERE tipo = 'amostra' AND nfs_amostra LIKE ?").get(`%"nf":"${numero}"%`) || null;
  }
  if (!co) return null;

  // Trava contra coincidencia de numero: "Carga:" pode ter outro sentido em NF de
  // outro emitente. So liga quando quem emitiu a nota e a filial do romaneio.
  if (co.filial_cnpj && nota.cnpj_emitente && co.filial_cnpj !== nota.cnpj_emitente) {
    console.warn(`[romaneios] NF ${nota.numero_nf} cita a carga ${co.numero_carga}, mas foi emitida por ${nota.cnpj_emitente} (filial do romaneio: ${co.filial_cnpj}) - nao ligada automaticamente.`);
    return null;
  }
  return co;
}

// A NF-e chegou = o caminhao esta carregando = a carga foi coletada. Liga a nota
// a carga/entrega, registra a coleta (com a hora do e-mail) e baixa a Ordem de
// Coleta quando completa. Nunca lanca: falha aqui nao pode derrubar a
// importacao das notas.
export function registrarColetaPelaNota(notaId) {
  try {
    const nota = db.prepare('SELECT * FROM notas_fiscais_email WHERE id = ?').get(notaId);
    if (!nota) return { ligada: false };
    const co = acharCargaOrigemDaNota(nota);
    if (!co) return { ligada: false };

    const entrega = db.prepare('SELECT * FROM entregas WHERE carga_origem_id = ?').get(co.id);
    const coletadaEm = isoParaSql(nota.data_recebimento) || agoraSql();
    let primeiraColeta = false;

    db.exec('BEGIN');
    try {
      if (nota.status === 'pendente') {
        db.prepare(`
          UPDATE notas_fiscais_email
          SET status = 'vinculada', entrega_id = ?, remetente_id = COALESCE(remetente_id, ?), cliente_id = COALESCE(cliente_id, ?)
          WHERE id = ?
        `).run(entrega?.id ?? null, co.remetente_id, co.cliente_id, nota.id);
      }
      primeiraColeta = !co.coletada_em;
      db.prepare(`
        UPDATE cargas_origem
        SET coletada_em = COALESCE(coletada_em, ?), status = CASE WHEN status = 'cancelada' THEN status ELSE 'coletada' END,
            atualizado_em = datetime('now')
        WHERE id = ?
      `).run(coletadaEm, co.id);
      if (entrega) {
        recalcularEntregaPelasNotas(entrega.id);
        if (!entrega.data_coleta) db.prepare('UPDATE entregas SET data_coleta = ? WHERE id = ?').run(coletadaEm, entrega.id);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    if (entrega) {
      baixarOrdemSeCompleta(entrega.ordem_coleta_id);
      if (primeiraColeta && entrega.carga_id) {
        registrarOcorrencia(entrega.carga_id, `Coleta registrada: carga ${co.numero_carga} da fabrica carregada em ${formatarDataHoraBr(coletadaEm)} (NF ${nota.numero_nf || '-'}).`, USUARIO_SISTEMA);
      }
    }
    notificarMudanca('romaneios');
    return { ligada: true, cargaOrigemId: co.id, entregaId: entrega?.id ?? null };
  } catch (err) {
    console.error(`[romaneios] erro ao ligar a NF ${notaId} a carga da fabrica:`, err.message);
    return { ligada: false, erro: err.message };
  }
}

// Rede de seguranca: a NF-e dessa carga nao chegou pelo e-mail (ou chegou e
// ninguem viu) mas o caminhao ja carregou - marca a coleta na mao.
export function marcarCargaColetadaManual(cargaOrigemId) {
  const co = db.prepare('SELECT * FROM cargas_origem WHERE id = ?').get(cargaOrigemId);
  if (!co) return { erro: 'Carga nao encontrada.', status: 404 };
  if (co.status === 'cancelada') return { erro: 'Essa carga foi cancelada pela fabrica.', status: 409 };
  if (co.status === 'coletada') return { erro: 'Essa carga ja esta coletada.', status: 409 };

  const agora = agoraSql();
  const entrega = db.prepare('SELECT * FROM entregas WHERE carga_origem_id = ?').get(co.id);
  db.exec('BEGIN');
  try {
    db.prepare("UPDATE cargas_origem SET status = 'coletada', coletada_em = ?, atualizado_em = datetime('now') WHERE id = ?").run(agora, co.id);
    if (entrega && !entrega.data_coleta) db.prepare('UPDATE entregas SET data_coleta = ? WHERE id = ?').run(agora, entrega.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  if (entrega) {
    baixarOrdemSeCompleta(entrega.ordem_coleta_id);
    if (entrega.carga_id) registrarOcorrencia(entrega.carga_id, `Coleta da carga ${co.numero_carga} da fabrica marcada manualmente.`, USUARIO_SISTEMA);
  }
  notificarMudanca('romaneios');
  return { ok: true };
}
