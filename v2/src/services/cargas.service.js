import { db } from '../db/connection.js';

export function buscarEntregasDaCarga(cargaId) {
  return db.prepare(`
    SELECT e.*, cl.cidade as cliente_cidade, cl.estado as cliente_estado, cl.razao_social as cliente_razao_social
    FROM entregas e
    LEFT JOIN clientes cl ON cl.id = e.cliente_id
    WHERE e.carga_id = ?
    ORDER BY e.id
  `).all(cargaId);
}

export function resumoCarga(entregas) {
  let pesoTotal = 0;
  let freteTotal = 0;
  const destinosSet = new Set();
  const destinosUnicos = new Set();
  let destinoPrincipal = null;

  for (const e of entregas) {
    if (e.peso_bruto) pesoTotal += e.peso_bruto;
    if (e.valor_frete) freteTotal += e.valor_frete;

    const cidade = (e.cidade_entrega || e.cliente_cidade || '').toUpperCase();
    const estado = (e.estado_entrega || e.cliente_estado || '').toUpperCase();
    const chave = `${e.cliente_id}_${cidade}_${estado}`;
    destinosUnicos.add(chave);

    let destinoFormatado = null;
    if (cidade || estado) {
      destinoFormatado = `${cidade}-${estado}`;
      destinosSet.add(destinoFormatado);
    }
    if (e.is_last_delivery === 1 && destinoFormatado) destinoPrincipal = destinoFormatado;
  }

  const destinos = [...destinosSet].sort();
  return {
    peso_total: pesoTotal,
    valor_frete_total: freteTotal,
    destinos,
    destino_principal: destinoPrincipal || destinos[0] || 'N/A',
    num_entregas: destinosUnicos.size
  };
}

export function toDictCarga(c) {
  return {
    id: c.id,
    codigo_carga: c.codigo_carga,
    origem: c.origem,
    status: c.status,
    motorista_id: c.motorista_id,
    veiculo_id: c.veiculo_id,
    frete_pago: c.frete_pago,
    data_agendamento: c.data_agendamento,
    data_carregamento: c.data_carregamento,
    previsao_entrega: c.previsao_entrega,
    observacoes: c.observacoes,
    data_finalizacao: c.data_finalizacao
  };
}

export function toDictEntrega(e) {
  return {
    id: e.id,
    carga_id: e.carga_id,
    cliente_id: e.cliente_id,
    remetente_id: e.remetente_id,
    peso_bruto: e.peso_bruto,
    valor_frete: e.valor_frete,
    peso_cubado: e.peso_cubado,
    nota_fiscal: e.nota_fiscal,
    cidade_entrega: e.cidade_entrega,
    estado_entrega: e.estado_entrega,
    is_last_delivery: e.is_last_delivery
  };
}
