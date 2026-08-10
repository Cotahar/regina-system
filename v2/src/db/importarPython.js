// Importa (ou re-sincroniza) os dados do sistema Python antigo, gerados por
// ../../../exportar_para_node.py, dentro do banco SQLite deste sistema.
//
// Operacao "espelho": limpa as tabelas de origem-Python antes de inserir, na
// ordem que respeita as chaves estrangeiras, para o resultado final ser
// identico ao Postgres de origem (sem risco de duplicar ou colidir com ids
// de dados de instalacao/seed). Campos exclusivos do sistema novo (cortesia,
// grupo_id, perfil de cliente, etc.) nao sao tocados aqui - so existem nos
// registros criados depois, diretamente no sistema novo.

const TABELAS_PARA_LIMPAR_EM_ORDEM = [
  'avaria_itens', 'avaria_fotos', 'avarias', 'entregas', 'cargas',
  'clientes', 'unidades', 'usuarios', 'marcas', 'motoristas', 'veiculos',
  'tipos_cte', 'formas_pagamento'
];

function importarTabela(db, nome, registros, colunas, mapValores) {
  if (!registros?.length) return 0;
  const placeholders = colunas.map(() => '?').join(',');
  const stmt = db.prepare(`INSERT INTO ${nome} (${colunas.join(',')}) VALUES (${placeholders})`);
  for (const registro of registros) stmt.run(...mapValores(registro));
  return registros.length;
}

export function importarDadosPython(db, dados) {
  const resumo = {};

  db.exec('BEGIN');
  try {
    for (const tabela of TABELAS_PARA_LIMPAR_EM_ORDEM) {
      db.exec(`DELETE FROM ${tabela}`);
    }

    resumo.motoristas = importarTabela(db, 'motoristas', dados.motoristas, ['id', 'codigo', 'nome'],
      (m) => [m.id, m.codigo, m.nome]);
    resumo.veiculos = importarTabela(db, 'veiculos', dados.veiculos, ['id', 'placa'],
      (v) => [v.id, v.placa]);
    resumo.tipos_cte = importarTabela(db, 'tipos_cte', dados.tipos_cte, ['id', 'descricao'],
      (t) => [t.id, t.descricao]);
    resumo.formas_pagamento = importarTabela(db, 'formas_pagamento', dados.formas_pagamento, ['id', 'descricao'],
      (f) => [f.id, f.descricao]);
    resumo.unidades = importarTabela(db, 'unidades', dados.unidades,
      ['id', 'nome', 'uf', 'is_matriz', 'tipo_cte_padrao_id'],
      (u) => [u.id, u.nome, u.uf, u.is_matriz ? 1 : 0, u.tipo_cte_padrao_id]);
    resumo.marcas = importarTabela(db, 'marcas', dados.marcas, ['id', 'nome'],
      (m) => [m.id, m.nome]);
    resumo.usuarios = importarTabela(db, 'usuarios', dados.usuarios, ['id', 'nome_usuario', 'senha_hash', 'permissao'],
      (u) => [u.id, u.nome_usuario, u.senha_hash, u.permissao]);
    resumo.clientes = importarTabela(db, 'clientes', dados.clientes,
      ['id', 'codigo_cliente', 'razao_social', 'ddd', 'telefone', 'cidade', 'estado', 'observacoes', 'is_remetente', 'padrao_forma_pagamento_id', 'padrao_tipo_pagamento'],
      (c) => [c.id, c.codigo_cliente, c.razao_social, c.ddd, c.telefone, c.cidade, c.estado, c.observacoes, c.is_remetente ? 1 : 0, c.padrao_forma_pagamento_id, c.padrao_tipo_pagamento]);
    resumo.cargas = importarTabela(db, 'cargas', dados.cargas,
      ['id', 'codigo_carga', 'origem', 'status', 'motorista_id', 'veiculo_id', 'frete_pago', 'data_agendamento', 'data_carregamento', 'previsao_entrega', 'observacoes', 'data_finalizacao', 'observacoes_faturamento', 'rota_manifesto', 'vale_pedagio_marca', 'vale_pedagio_rota', 'vale_pedagio_eixos', 'adiantamento_percentual', 'adiantamento_valor'],
      (c) => [c.id, c.codigo_carga, c.origem, c.status, c.motorista_id, c.veiculo_id, c.frete_pago, c.data_agendamento, c.data_carregamento, c.previsao_entrega, c.observacoes, c.data_finalizacao, c.observacoes_faturamento, c.rota_manifesto, c.vale_pedagio_marca, c.vale_pedagio_rota, c.vale_pedagio_eixos, c.adiantamento_percentual, c.adiantamento_valor]);
    resumo.entregas = importarTabela(db, 'entregas', dados.entregas,
      ['id', 'carga_id', 'cliente_id', 'remetente_id', 'peso_bruto', 'valor_frete', 'peso_cubado', 'nota_fiscal', 'cidade_entrega', 'estado_entrega', 'is_last_delivery', 'valor_tonelada', 'tipo_pagamento', 'unidade_id', 'tipo_cte_id', 'forma_pagamento_id'],
      (e) => [e.id, e.carga_id, e.cliente_id, e.remetente_id, e.peso_bruto, e.valor_frete, e.peso_cubado, e.nota_fiscal, e.cidade_entrega, e.estado_entrega, e.is_last_delivery, e.valor_tonelada, e.tipo_pagamento, e.unidade_id, e.tipo_cte_id, e.forma_pagamento_id]);
    resumo.avarias = importarTabela(db, 'avarias', dados.avarias,
      ['id', 'nota_fiscal', 'entrega_id', 'marca_id', 'tipo_descarga', 'observacoes', 'status', 'data_criacao', 'registro_envio', 'retorno_fabrica', 'valor_cobranca'],
      (a) => [a.id, a.nota_fiscal, a.entrega_id, a.marca_id, a.tipo_descarga, a.observacoes, a.status, a.data_criacao, a.registro_envio, a.retorno_fabrica, a.valor_cobranca]);
    resumo.avaria_itens = importarTabela(db, 'avaria_itens', dados.avaria_itens,
      ['id', 'avaria_id', 'produto_nome', 'quantidade', 'unidade_medida'],
      (i) => [i.id, i.avaria_id, i.produto_nome, i.quantidade, i.unidade_medida]);

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  resumo.avaria_fotos_drive_nao_importadas = dados.avaria_fotos_drive?.length || 0;
  return resumo;
}
