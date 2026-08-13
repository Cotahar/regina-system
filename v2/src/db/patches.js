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
  ['entregas', 'data_agendamento_descarga', 'TEXT']
];

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
}
