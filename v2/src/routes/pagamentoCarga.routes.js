import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireLogin } from '../middleware/auth.js';
import { buscarEntregasDaCarga, resumoCarga } from '../services/cargas.service.js';

export const pagamentoCargaRouter = Router();

// Nao ha mais flag de "ultima entrega" pra adivinhar o destino final sozinho -
// devolve todas as cidades de destino distintas entre as entregas da carga,
// pra tela pedir confirmacao quando houver mais de uma.
function calcularDestinosDisponiveis(entregas) {
  const destinos = new Set();
  for (const e of entregas) {
    const cidade = (e.cidade_entrega || e.cliente_cidade || '').toUpperCase().trim();
    const estado = (e.estado_entrega || e.cliente_estado || '').toUpperCase().trim();
    if (!cidade && !estado) continue;
    destinos.add(`${cidade} - ${estado}`);
  }
  return [...destinos].sort();
}

// Mesma ideia, so que pro lado do remetente (origem da carga).
function calcularOrigensDisponiveis(entregas) {
  const origens = new Set();
  for (const e of entregas) {
    const cidade = (e.remetente_cidade || '').toUpperCase().trim();
    const estado = (e.remetente_estado || '').toUpperCase().trim();
    if (!cidade && !estado) continue;
    origens.add(`${cidade} - ${estado}`);
  }
  return [...origens].sort();
}

// Origem/destino sugeridos pra mensagem de pagamento = cidade/UF de quem
// concentra mais peso na carga (remetente pra origem, destinatario pra
// destino) - so um chute inicial, o usuario ainda pode trocar no select.
function agruparPorMaiorVolume(entregas, extrair) {
  const grupos = new Map();
  for (const e of entregas) {
    const { chave, texto } = extrair(e);
    if (!texto) continue;
    const atual = grupos.get(chave) || { texto, peso: 0 };
    atual.peso += e.peso_bruto || 0;
    grupos.set(chave, atual);
  }
  let melhor = null;
  for (const g of grupos.values()) {
    if (!melhor || g.peso > melhor.peso) melhor = g;
  }
  return melhor ? melhor.texto : '';
}

function origemSugerida(entregas) {
  return agruparPorMaiorVolume(entregas, (e) => {
    const cidade = (e.remetente_cidade || '').toUpperCase().trim();
    const estado = (e.remetente_estado || '').toUpperCase().trim();
    if (!cidade && !estado) return { chave: null, texto: null };
    return { chave: `${e.remetente_id}_${cidade}_${estado}`, texto: `${cidade} - ${estado}` };
  });
}

function destinoSugerido(entregas) {
  return agruparPorMaiorVolume(entregas, (e) => {
    const cidade = (e.cidade_entrega || e.cliente_cidade || '').toUpperCase().trim();
    const estado = (e.estado_entrega || e.cliente_estado || '').toUpperCase().trim();
    if (!cidade && !estado) return { chave: null, texto: null };
    return { chave: `${e.cliente_id}_${cidade}_${estado}`, texto: `${cidade} - ${estado}` };
  });
}

// So faz sentido pra veiculo FROTA (regra do usuario) - soma o peso das
// entregas cujo cliente destinatario precisa de ajudante pra descarregar
// (a transportadora paga essa descarga) separado do peso de quem descarrega
// sozinho (autodescarga). A validacao de cadastro ja garante que todo
// cliente tem uma das duas flags marcada.
function calcularDescargaFrota(entregas) {
  let pagaDescarga = 0;
  let clienteDescarrega = 0;
  for (const e of entregas) {
    const peso = e.peso_bruto || 0;
    if (e.cliente_precisa_ajudantes) pagaDescarga += peso;
    else clienteDescarrega += peso;
  }
  return { paga_descarga: pagaDescarga, cliente_descarrega: clienteDescarrega };
}

// Unidade mais frequente entre as entregas da carga (empate resolvido a favor
// da matriz); cai pra matriz se nenhuma entrega tiver unidade definida. E so
// uma sugestao - a tela sempre deixa trocar num select.
function calcularUnidadeSugerida(entregas) {
  const contagem = new Map();
  for (const e of entregas) {
    if (!e.unidade_id) continue;
    contagem.set(e.unidade_id, (contagem.get(e.unidade_id) || 0) + 1);
  }

  if (!contagem.size) {
    const matriz = db.prepare('SELECT id FROM unidades WHERE is_matriz = 1 LIMIT 1').get();
    return matriz ? matriz.id : null;
  }

  const maxContagem = Math.max(...contagem.values());
  const empatados = [...contagem.entries()].filter(([, c]) => c === maxContagem).map(([id]) => id);
  if (empatados.length === 1) return empatados[0];

  const placeholders = empatados.map(() => '?').join(',');
  const matrizEntreEmpatados = db.prepare(`SELECT id FROM unidades WHERE is_matriz = 1 AND id IN (${placeholders})`).get(...empatados);
  return matrizEntreEmpatados ? matrizEntreEmpatados.id : Math.min(...empatados);
}

pagamentoCargaRouter.get('/api/cargas/:id/pagamento', requireLogin, (req, res) => {
  const carga = db.prepare(`
    SELECT c.*, m.nome as motorista_nome, v.placa as placa_veiculo, v.is_frota as veiculo_frota,
      v.dados_pagamento as veiculo_dados_pagamento
    FROM cargas c
    LEFT JOIN motoristas m ON m.id = c.motorista_id
    LEFT JOIN veiculos v ON v.id = c.veiculo_id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!carga) return res.status(404).json({ error: 'Carga nao encontrada' });

  const entregas = buscarEntregasDaCarga(req.params.id);
  const resumo = resumoCarga(entregas);

  res.json({
    carga: {
      id: carga.id,
      codigo_carga: carga.codigo_carga,
      status: carga.status,
      motorista_nome: carga.motorista_nome || '',
      veiculo_placa: carga.placa_veiculo || '',
      veiculo_frota: !!carga.veiculo_frota,
      veiculo_id: carga.veiculo_id,
      origem: carga.origem,
      frete_pago: carga.frete_pago,
      adiantamento_percentual: carga.adiantamento_percentual,
      adiantamento_valor: carga.adiantamento_valor,
      vale_pedagio_valor: carga.vale_pedagio_valor,
      saldo_motorista: carga.saldo_motorista
    },
    resumo: {
      peso_total: resumo.peso_total,
      valor_frete_total: resumo.valor_frete_total
    },
    destinos_disponiveis: calcularDestinosDisponiveis(entregas),
    origens_disponiveis: calcularOrigensDisponiveis(entregas),
    origem_sugerida: origemSugerida(entregas),
    destino_sugerido: destinoSugerido(entregas),
    descarga_frota: carga.veiculo_frota ? calcularDescargaFrota(entregas) : null,
    veiculo_dados_pagamento: carga.veiculo_dados_pagamento || '',
    unidade_sugerida_id: calcularUnidadeSugerida(entregas)
  });
});

pagamentoCargaRouter.put('/api/cargas/:id/pagamento', requireLogin, (req, res) => {
  const carga = db.prepare('SELECT id, veiculo_id FROM cargas WHERE id = ?').get(req.params.id);
  if (!carga) return res.status(404).json({ error: 'Carga nao encontrada' });

  const { saldo_motorista: saldoMotorista, vale_pedagio_valor: valePedagioValor, dados_pagamento: dadosPagamento } = req.body || {};

  db.prepare('UPDATE cargas SET saldo_motorista = ?, vale_pedagio_valor = ? WHERE id = ?')
    .run(saldoMotorista ?? null, valePedagioValor || null, carga.id);

  if (carga.veiculo_id) {
    db.prepare('UPDATE veiculos SET dados_pagamento = ? WHERE id = ?').run(dadosPagamento || null, carga.veiculo_id);
  }

  res.json({ message: 'Dados de pagamento salvos!' });
});
