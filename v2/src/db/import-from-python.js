// Importa o JSON gerado por ../../../exportar_para_node.py (rodado no projeto
// Python) para o banco SQLite novo. Rode depois de "npm run db:migrate", em um
// banco vazio (o script aborta se ja houver cargas cadastradas, a menos que
// --force seja passado).
//
// Uso: node src/db/import-from-python.js [caminho-do-json] [--force]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const force = args.includes('--force');
const caminhoArg = args.find((a) => !a.startsWith('--'));

const candidatos = [
  caminhoArg,
  path.join(__dirname, '..', '..', 'export_dados.json'),
  path.join(__dirname, '..', '..', '..', 'export_dados.json')
].filter(Boolean);

const caminho = candidatos.find((p) => fs.existsSync(p));
if (!caminho) {
  console.error('Arquivo export_dados.json nao encontrado. Rode exportar_para_node.py primeiro e copie o arquivo para v2/ ou para a raiz do projeto.');
  process.exit(1);
}

const dados = JSON.parse(fs.readFileSync(caminho, 'utf-8'));

const existentes = db.prepare('SELECT COUNT(*) as c FROM cargas').get().c;
if (existentes > 0 && !force) {
  console.error(`O banco ja possui ${existentes} carga(s). Use --force se quiser importar mesmo assim (pode duplicar dados).`);
  process.exit(1);
}

function importarTabela(nome, registros, colunas, mapValores) {
  if (!registros?.length) return;
  const placeholders = colunas.map(() => '?').join(',');
  const stmt = db.prepare(`INSERT OR REPLACE INTO ${nome} (${colunas.join(',')}) VALUES (${placeholders})`);
  for (const registro of registros) stmt.run(...mapValores(registro));
  console.log(`Importado: ${registros.length} registro(s) em ${nome}`);
}

// Ordem respeita as dependencias de chave estrangeira. Tudo dentro de uma
// transacao: se algo falhar no meio, nada fica gravado pela metade.
db.exec('BEGIN');
try {
  importarTabela('motoristas', dados.motoristas, ['id', 'codigo', 'nome'], (m) => [m.id, m.codigo, m.nome]);
  importarTabela('veiculos', dados.veiculos, ['id', 'placa'], (v) => [v.id, v.placa]);
  importarTabela('tipos_cte', dados.tipos_cte, ['id', 'descricao'], (t) => [t.id, t.descricao]);
  importarTabela('formas_pagamento', dados.formas_pagamento, ['id', 'descricao'], (f) => [f.id, f.descricao]);
  importarTabela('unidades', dados.unidades, ['id', 'nome', 'uf', 'is_matriz', 'tipo_cte_padrao_id'],
    (u) => [u.id, u.nome, u.uf, u.is_matriz ? 1 : 0, u.tipo_cte_padrao_id]);
  importarTabela('marcas', dados.marcas, ['id', 'nome'], (m) => [m.id, m.nome]);
  importarTabela('usuarios', dados.usuarios, ['id', 'nome_usuario', 'senha_hash', 'permissao'],
    (u) => [u.id, u.nome_usuario, u.senha_hash, u.permissao]);
  importarTabela('clientes', dados.clientes,
    ['id', 'codigo_cliente', 'razao_social', 'ddd', 'telefone', 'cidade', 'estado', 'observacoes', 'is_remetente', 'padrao_forma_pagamento_id', 'padrao_tipo_pagamento'],
    (c) => [c.id, c.codigo_cliente, c.razao_social, c.ddd, c.telefone, c.cidade, c.estado, c.observacoes, c.is_remetente ? 1 : 0, c.padrao_forma_pagamento_id, c.padrao_tipo_pagamento]);
  importarTabela('cargas', dados.cargas,
    ['id', 'codigo_carga', 'origem', 'status', 'motorista_id', 'veiculo_id', 'frete_pago', 'data_agendamento', 'data_carregamento', 'previsao_entrega', 'observacoes', 'data_finalizacao', 'observacoes_faturamento', 'rota_manifesto', 'vale_pedagio_marca', 'vale_pedagio_rota', 'vale_pedagio_eixos', 'adiantamento_percentual', 'adiantamento_valor'],
    (c) => [c.id, c.codigo_carga, c.origem, c.status, c.motorista_id, c.veiculo_id, c.frete_pago, c.data_agendamento, c.data_carregamento, c.previsao_entrega, c.observacoes, c.data_finalizacao, c.observacoes_faturamento, c.rota_manifesto, c.vale_pedagio_marca, c.vale_pedagio_rota, c.vale_pedagio_eixos, c.adiantamento_percentual, c.adiantamento_valor]);
  importarTabela('entregas', dados.entregas,
    ['id', 'carga_id', 'cliente_id', 'remetente_id', 'peso_bruto', 'valor_frete', 'peso_cubado', 'nota_fiscal', 'cidade_entrega', 'estado_entrega', 'is_last_delivery', 'valor_tonelada', 'tipo_pagamento', 'unidade_id', 'tipo_cte_id', 'forma_pagamento_id'],
    (e) => [e.id, e.carga_id, e.cliente_id, e.remetente_id, e.peso_bruto, e.valor_frete, e.peso_cubado, e.nota_fiscal, e.cidade_entrega, e.estado_entrega, e.is_last_delivery, e.valor_tonelada, e.tipo_pagamento, e.unidade_id, e.tipo_cte_id, e.forma_pagamento_id]);
  importarTabela('avarias', dados.avarias,
    ['id', 'nota_fiscal', 'entrega_id', 'marca_id', 'tipo_descarga', 'observacoes', 'status', 'data_criacao', 'registro_envio', 'retorno_fabrica', 'valor_cobranca'],
    (a) => [a.id, a.nota_fiscal, a.entrega_id, a.marca_id, a.tipo_descarga, a.observacoes, a.status, a.data_criacao, a.registro_envio, a.retorno_fabrica, a.valor_cobranca]);
  importarTabela('avaria_itens', dados.avaria_itens,
    ['id', 'avaria_id', 'produto_nome', 'quantidade', 'unidade_medida'],
    (i) => [i.id, i.avaria_id, i.produto_nome, i.quantidade, i.unidade_medida]);
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  console.error('Falha na importacao, nada foi gravado:', err.message);
  process.exit(1);
}

if (dados.avaria_fotos_drive?.length) {
  console.log(`\nAviso: ${dados.avaria_fotos_drive.length} foto(s) de avaria existiam no Google Drive do sistema antigo.`);
  console.log('Elas NAO foram importadas (o sistema novo guarda fotos localmente em uploads/avarias/).');
  console.log('Baixe manualmente do Drive as fotos que ainda sejam relevantes, se precisar.');
}

console.log('\nImportacao concluida.');
