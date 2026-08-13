import { Router } from 'express';
import { db } from '../db/connection.js';
import { requireLogin } from '../middleware/auth.js';
import { renderRelatorioFaturamento } from '../views/relatorioFaturamento.js';

export const gerenciarCargaRouter = Router();

gerenciarCargaRouter.get('/api/cargas/:id/gerenciar', requireLogin, (req, res) => {
  const carga = db.prepare(`
    SELECT c.*, m.nome as motorista_nome, v.placa as placa_veiculo
    FROM cargas c
    LEFT JOIN motoristas m ON m.id = c.motorista_id
    LEFT JOIN veiculos v ON v.id = c.veiculo_id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!carga) return res.status(404).json({ error: 'Carga nao encontrada' });

  const entregas = db.prepare(`
    SELECT e.*, cl.razao_social as cliente_razao_social, cl.estado as cliente_estado,
      cl.padrao_forma_pagamento_id as cliente_forma_padrao_id,
      cl.padrao_tipo_pagamento as cliente_tipo_padrao,
      rem.razao_social as remetente_razao_social, rem.estado as remetente_estado,
      rem.padrao_forma_pagamento_id as remetente_forma_padrao_id,
      rem.padrao_tipo_pagamento as remetente_tipo_padrao
    FROM entregas e
    LEFT JOIN clientes cl ON cl.id = e.cliente_id
    LEFT JOIN clientes rem ON rem.id = e.remetente_id
    WHERE e.carga_id = ?
    ORDER BY e.id
  `).all(req.params.id);

  res.json({
    carga: {
      id: carga.id,
      codigo_carga: carga.codigo_carga,
      origem: carga.origem,
      status: carga.status,
      motorista_id: carga.motorista_id,
      veiculo_id: carga.veiculo_id,
      motorista_nome: carga.motorista_nome || '',
      placa_veiculo: carga.placa_veiculo || '',
      frete_pago: carga.frete_pago,
      observacoes_faturamento: carga.observacoes_faturamento,
      rota_manifesto: carga.rota_manifesto,
      vale_pedagio_marca: carga.vale_pedagio_marca,
      vale_pedagio_rota: carga.vale_pedagio_rota,
      vale_pedagio_eixos: carga.vale_pedagio_eixos,
      adiantamento_percentual: carga.adiantamento_percentual ?? 70.0,
      adiantamento_valor: carga.adiantamento_valor
    },
    entregas: entregas.map((e) => ({
      id: e.id,
      remetente_id: e.remetente_id,
      remetente_nome: e.remetente_razao_social || 'N/A',
      cliente_nome: e.cliente_razao_social || 'N/A',
      nota_fiscal: e.nota_fiscal,
      peso_bruto: e.peso_bruto,
      peso_cubado: e.peso_cubado,
      valor_frete: e.valor_frete,
      valor_tonelada: e.valor_tonelada,
      unidade_id: e.unidade_id,
      tipo_cte_id: e.tipo_cte_id,
      forma_pagamento_id: e.forma_pagamento_id,
      tipo_pagamento: e.tipo_pagamento,
      cliente_uf: e.cliente_estado,
      cliente_forma_padrao_id: e.cliente_forma_padrao_id,
      cliente_tipo_padrao: e.cliente_tipo_padrao,
      remetente_uf: e.remetente_estado,
      remetente_forma_padrao_id: e.remetente_forma_padrao_id,
      remetente_tipo_padrao: e.remetente_tipo_padrao,
      is_cortesia: !!e.is_cortesia,
      grupo_id: e.grupo_id,
      local_coleta: e.local_coleta,
      valor_combinado: e.valor_combinado,
      repasse_destinatario: e.repasse_destinatario
    }))
  });
});

gerenciarCargaRouter.put('/api/cargas/:id/gerenciar', requireLogin, (req, res) => {
  const carga = db.prepare('SELECT id FROM cargas WHERE id = ?').get(req.params.id);
  if (!carga) return res.status(404).json({ error: 'Carga nao encontrada' });

  const data = req.body || {};

  if (data.carga) {
    const c = data.carga;
    db.prepare(`
      UPDATE cargas SET
        motorista_id = ?, veiculo_id = ?, observacoes_faturamento = ?, rota_manifesto = ?,
        vale_pedagio_marca = ?, vale_pedagio_rota = ?, vale_pedagio_eixos = ?, frete_pago = ?,
        adiantamento_percentual = ?, adiantamento_valor = ?
      WHERE id = ?
    `).run(
      c.motorista_id || null,
      c.veiculo_id || null,
      c.observacoes_faturamento || null,
      c.rota_manifesto || null,
      c.vale_pedagio_marca || null,
      c.vale_pedagio_rota || null,
      c.vale_pedagio_eixos || null,
      c.frete_pago ?? null,
      c.adiantamento_percentual ?? null,
      c.adiantamento_valor ?? null,
      req.params.id
    );
  }

  if (Array.isArray(data.entregas)) {
    const stmt = db.prepare(`
      UPDATE entregas SET nota_fiscal = ?, peso_bruto = ?, peso_cubado = ?, valor_frete = ?,
        valor_tonelada = ?, unidade_id = ?, tipo_cte_id = ?, forma_pagamento_id = ?, tipo_pagamento = ?,
        is_cortesia = ?, valor_combinado = ?, repasse_destinatario = ?
      WHERE id = ? AND carga_id = ?
    `);
    for (const item of data.entregas) {
      const isCortesia = !!item.is_cortesia;
      stmt.run(
        item.nota_fiscal || null,
        item.peso_bruto ?? null,
        item.peso_cubado ?? null,
        isCortesia ? 0 : (item.valor_frete ?? null),
        item.valor_tonelada ?? null,
        item.unidade_id || null,
        item.tipo_cte_id || null,
        item.forma_pagamento_id || null,
        item.tipo_pagamento || null,
        isCortesia ? 1 : 0,
        item.valor_combinado ?? null,
        item.repasse_destinatario || null,
        item.id,
        req.params.id
      );
    }
  }

  res.json({ message: 'Dados de gerenciamento salvos com sucesso!' });
});

gerenciarCargaRouter.get('/cargas/:id/relatorio_faturamento', requireLogin, (req, res) => {
  const carga = db.prepare(`
    SELECT c.*, m.nome as motorista_nome, v.placa as placa_veiculo, v.is_frota as veiculo_frota
    FROM cargas c
    LEFT JOIN motoristas m ON m.id = c.motorista_id
    LEFT JOIN veiculos v ON v.id = c.veiculo_id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!carga) return res.status(404).send('Carga nao encontrada');

  const entregas = db.prepare(`
    SELECT e.*, cl.razao_social as cliente_razao_social, cl.cidade as cliente_cidade, cl.estado as cliente_estado,
      cl.ddd as cliente_ddd, cl.telefone as cliente_telefone, cl.observacoes as cliente_observacoes,
      u.nome as unidade_nome, tc.descricao as tipo_cte_descricao, fp.descricao as forma_pagamento_descricao
    FROM entregas e
    LEFT JOIN clientes cl ON cl.id = e.cliente_id
    LEFT JOIN unidades u ON u.id = e.unidade_id
    LEFT JOIN tipos_cte tc ON tc.id = e.tipo_cte_id
    LEFT JOIN formas_pagamento fp ON fp.id = e.forma_pagamento_id
    WHERE e.carga_id = ?
    ORDER BY e.id
  `).all(req.params.id);

  let destinoPrincipal = 'DIVERSOS';
  for (const e of entregas) {
    const cidade = e.cidade_entrega || e.cliente_cidade || '';
    const uf = e.estado_entrega || e.cliente_estado || '';
    if (cidade && uf && e.is_last_delivery) destinoPrincipal = `${cidade}-${uf}`;
  }

  res.type('html').send(renderRelatorioFaturamento({ carga, entregas, destinoPrincipal }));
});
