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
