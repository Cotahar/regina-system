import { db } from './connection.js';

// Adiciona colunas novas em bancos ja existentes (deploys anteriores a essas
// mudancas). CREATE TABLE ... IF NOT EXISTS do schema.sql nao altera tabelas
// que ja existem, entao colunas novas em tabelas antigas precisam ser
// aplicadas aqui, uma a uma, ignorando erro de "coluna ja existe".
const colunasNovas = [
  ['unidades', 'tipo_cte_outra_uf_id', 'INTEGER REFERENCES tipos_cte(id) ON DELETE SET NULL'],
  ['clientes', 'autodescarga', 'INTEGER NOT NULL DEFAULT 0'],
  ['clientes', 'precisa_ajudantes', 'INTEGER NOT NULL DEFAULT 0'],
  ['clientes', 'descarga_paga_direto', 'INTEGER NOT NULL DEFAULT 0'],
  ['clientes', 'precisa_agendamento', 'INTEGER NOT NULL DEFAULT 0'],
  ['clientes', 'resolve_com_representante', 'INTEGER NOT NULL DEFAULT 0'],
  ['clientes', 'contato_extra', 'TEXT'],
  ['entregas', 'is_cortesia', 'INTEGER NOT NULL DEFAULT 0'],
  ['entregas', 'grupo_id', 'INTEGER'],
  ['entregas', 'local_coleta', 'TEXT'],
  ['entregas', 'valor_combinado', 'REAL'],
  ['entregas', 'repasse_destinatario', 'TEXT'],
  ['veiculos', 'is_frota', 'INTEGER NOT NULL DEFAULT 0'],
  ['entregas', 'data_agendamento_descarga', 'TEXT'],
  ['veiculos', 'dados_pagamento', 'TEXT'],
  ['cargas', 'saldo_motorista', 'REAL'],
  ['cargas', 'vale_pedagio_valor', 'TEXT'],
  ['clientes', 'cnpj', 'TEXT'],
  ['notas_fiscais_email', 'placa_veiculo', 'TEXT'],
  ['notas_fiscais_email', 'nome_motorista', 'TEXT']
];

// Padroniza data_emissao pra AAAA-MM-DD em linhas gravadas antes dessa
// mudanca (podiam vir com hora/fuso do XML ou "dd/mm/aaaa" do PDF). Idempotente
// - so faz UPDATE quando o valor normalizado e diferente do que ja esta salvo.
function normalizarDatasEmissaoExistentes() {
  const linhas = db.prepare("SELECT id, data_emissao FROM notas_fiscais_email WHERE data_emissao IS NOT NULL").all();
  const update = db.prepare('UPDATE notas_fiscais_email SET data_emissao = ? WHERE id = ?');
  for (const linha of linhas) {
    const iso = linha.data_emissao.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const br = linha.data_emissao.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const normalizado = iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : (br ? `${br[3]}-${br[2]}-${br[1]}` : null);
    if (normalizado && normalizado !== linha.data_emissao) {
      update.run(normalizado, linha.id);
    }
  }
}

export function aplicarPatches() {
  for (const [tabela, coluna, definicao] of colunasNovas) {
    try {
      db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
      console.log(`Patch: coluna ${coluna} adicionada em ${tabela}.`);
    } catch (err) {
      if (!String(err.message).includes('duplicate column name')) throw err;
    }
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_entregas_grupo_id ON entregas(grupo_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_clientes_cnpj ON clientes(cnpj)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_notas_fiscais_email_status ON notas_fiscais_email(status)');
  normalizarDatasEmissaoExistentes();
}
