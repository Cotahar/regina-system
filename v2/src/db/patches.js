import { db } from './connection.js';
import { encontrarMunicipio } from '../services/municipios.service.js';

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
  ['notas_fiscais_email', 'nome_motorista', 'TEXT'],
  ['notas_fiscais_email', 'cidade_destinatario', 'TEXT'],
  ['notas_fiscais_email', 'estado_destinatario', 'TEXT'],
  ['notas_fiscais_email', 'ddd_destinatario', 'TEXT'],
  ['notas_fiscais_email', 'telefone_destinatario', 'TEXT'],
  ['entregas', 'local_coleta_cliente_id', 'INTEGER REFERENCES clientes(id) ON DELETE SET NULL'],
  ['entregas', 'ordem_coleta_id', 'INTEGER REFERENCES ordens_coleta(id) ON DELETE SET NULL']
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

// Regra do usuario: toda entrega precisa de uma forma de descarga definida -
// ou o cliente descarrega sozinho (autodescarga) ou a gente leva ajudante
// (precisa_ajudantes). Cadastros antigos podiam ter os dois desmarcados;
// corrige de uma vez so. Idempotente - so afeta quem ainda esta com os dois
// desmarcados.
function corrigirClientesSemFormaDeDescarga() {
  const info = db.prepare('UPDATE clientes SET precisa_ajudantes = 1 WHERE autodescarga = 0 AND precisa_ajudantes = 0').run();
  if (info.changes) console.log(`Patch: ${info.changes} cliente(s) sem forma de descarga definida - marcado "precisa de ajudantes".`);
}

// Limpeza pontual: antes da importacao de planilha aceitar Excel de verdade
// (o parser de CSV lia o binario do .xls como texto), um upload de .xls
// gerava motoristas com nome vazio/ilegivel. Idempotente - so tem efeito
// enquanto sobrar alguma linha assim.
function removerMotoristasSemNome() {
  const info = db.prepare("DELETE FROM motoristas WHERE TRIM(nome) = ''").run();
  if (info.changes) console.log(`Patch: ${info.changes} motorista(s) sem nome removido(s).`);
}

// Cadastros antigos podem ter cidade digitada sem acento ou com grafia
// antiga (ex: "MOJI MIRIM" -> hoje e "MOGI MIRIM") - corrige pra forma
// oficial so quando reconhece com confianca (mesmo nome, so faltando
// acento/caixa, ou a UF desempata nomes repetidos em estados diferentes).
// Nunca mexe em cidade que nao reconhece (ex: alguns cadastros tem "NaN"
// no lugar de cidade, resto de um bug de importacao antigo - isso fica pra
// revisao manual, nao da pra adivinhar a cidade certa). Idempotente - na
// segunda vez ja nao sobra nada pra corrigir, porque o valor ja fica na
// forma oficial.
function padronizarCidadesExistentes(tabela, colunaCidade, colunaEstado) {
  const linhas = db.prepare(`SELECT id, ${colunaCidade} as cidade, ${colunaEstado} as estado FROM ${tabela} WHERE ${colunaCidade} IS NOT NULL AND ${colunaCidade} != ''`).all();
  const update = db.prepare(`UPDATE ${tabela} SET ${colunaCidade} = ?, ${colunaEstado} = ? WHERE id = ?`);

  // Uma transacao so pro lote inteiro - sem isso cada UPDATE seria um commit
  // separado, e essa tabela pode ter milhares de linhas (roda em todo boot).
  let corrigidos = 0;
  db.exec('BEGIN');
  try {
    for (const linha of linhas) {
      const municipio = encontrarMunicipio(linha.cidade, linha.estado);
      if (!municipio) continue;
      const cidadeCorrigida = municipio.cidade.toUpperCase();
      if (cidadeCorrigida === linha.cidade && municipio.uf === linha.estado) continue;
      update.run(cidadeCorrigida, municipio.uf, linha.id);
      corrigidos++;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  if (corrigidos) console.log(`Patch: ${corrigidos} registro(s) de ${tabela} com cidade/UF padronizada pra forma oficial.`);
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
  removerMotoristasSemNome();
  corrigirClientesSemFormaDeDescarga();
  padronizarCidadesExistentes('clientes', 'cidade', 'estado');
  padronizarCidadesExistentes('entregas', 'cidade_entrega', 'estado_entrega');
}
