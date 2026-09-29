-- Schema do Frottex - B. Nunes (v2) - SQLite via node:sqlite

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_usuario TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  permissao TEXT NOT NULL DEFAULT 'usuario'
);

CREATE TABLE IF NOT EXISTS motoristas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE,
  nome TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS veiculos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  placa TEXT NOT NULL UNIQUE,
  is_frota INTEGER NOT NULL DEFAULT 0,
  dados_pagamento TEXT
);

CREATE TABLE IF NOT EXISTS tipos_cte (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS formas_pagamento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS unidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  uf TEXT,
  is_matriz INTEGER NOT NULL DEFAULT 0,
  tipo_cte_padrao_id INTEGER REFERENCES tipos_cte(id) ON DELETE SET NULL,
  tipo_cte_outra_uf_id INTEGER REFERENCES tipos_cte(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_cliente TEXT NOT NULL UNIQUE,
  razao_social TEXT NOT NULL,
  ddd TEXT,
  telefone TEXT,
  cidade TEXT,
  estado TEXT,
  observacoes TEXT,
  is_remetente INTEGER NOT NULL DEFAULT 0,
  padrao_forma_pagamento_id INTEGER REFERENCES formas_pagamento(id) ON DELETE SET NULL,
  padrao_tipo_pagamento TEXT,
  autodescarga INTEGER NOT NULL DEFAULT 0,
  precisa_ajudantes INTEGER NOT NULL DEFAULT 0,
  descarga_paga_direto INTEGER NOT NULL DEFAULT 0,
  precisa_agendamento INTEGER NOT NULL DEFAULT 0,
  resolve_com_representante INTEGER NOT NULL DEFAULT 0,
  contato_extra TEXT,
  cnpj TEXT
);

CREATE TABLE IF NOT EXISTS marcas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS cargas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_carga TEXT NOT NULL UNIQUE,
  origem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente',
  motorista_id INTEGER REFERENCES motoristas(id) ON DELETE SET NULL,
  veiculo_id INTEGER REFERENCES veiculos(id) ON DELETE SET NULL,
  frete_pago REAL,
  data_agendamento TEXT,
  data_carregamento TEXT,
  previsao_entrega TEXT,
  observacoes TEXT,
  data_finalizacao TEXT,
  observacoes_faturamento TEXT,
  rota_manifesto TEXT,
  vale_pedagio_marca TEXT,
  vale_pedagio_rota TEXT,
  vale_pedagio_eixos INTEGER,
  adiantamento_percentual REAL DEFAULT 70.0,
  adiantamento_valor REAL,
  saldo_motorista REAL,
  vale_pedagio_valor TEXT
);

-- Ordem de coleta: junta entregas de fontes diferentes (cargas em rascunho,
-- pendentes, agendadas, ou ainda soltas na Montagem) numa mesma rota de
-- coleta pro motorista visitar varias fabricas. Fica "pendente" (editavel)
-- ate a coleta acontecer de fato; "baixar" define o local de coleta real
-- (um cliente cadastrado) que passa a valer pra todas as entregas da ordem.
CREATE TABLE IF NOT EXISTS ordens_coleta (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pendente',
  motorista_id INTEGER REFERENCES motoristas(id) ON DELETE SET NULL,
  veiculo_id INTEGER REFERENCES veiculos(id) ON DELETE SET NULL,
  local_coleta_cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  observacoes TEXT,
  data_baixa TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS entregas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  carga_id INTEGER REFERENCES cargas(id) ON DELETE SET NULL,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  remetente_id INTEGER REFERENCES clientes(id),
  peso_bruto REAL,
  valor_frete REAL,
  peso_cubado REAL,
  nota_fiscal TEXT,
  cidade_entrega TEXT,
  estado_entrega TEXT,
  is_last_delivery INTEGER NOT NULL DEFAULT 0,
  valor_tonelada REAL,
  tipo_pagamento TEXT,
  unidade_id INTEGER REFERENCES unidades(id) ON DELETE SET NULL,
  tipo_cte_id INTEGER REFERENCES tipos_cte(id) ON DELETE SET NULL,
  forma_pagamento_id INTEGER REFERENCES formas_pagamento(id) ON DELETE SET NULL,
  is_cortesia INTEGER NOT NULL DEFAULT 0,
  grupo_id INTEGER,
  local_coleta TEXT,
  local_coleta_cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  valor_combinado REAL,
  repasse_destinatario TEXT,
  data_agendamento_descarga TEXT,
  ordem_coleta_id INTEGER REFERENCES ordens_coleta(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS avarias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nota_fiscal TEXT,
  entrega_id INTEGER NOT NULL REFERENCES entregas(id),
  marca_id INTEGER NOT NULL REFERENCES marcas(id),
  tipo_descarga TEXT,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'Pendente',
  data_criacao TEXT NOT NULL DEFAULT (datetime('now')),
  registro_envio TEXT,
  retorno_fabrica TEXT,
  valor_cobranca REAL
);

CREATE TABLE IF NOT EXISTS avaria_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  avaria_id INTEGER NOT NULL REFERENCES avarias(id) ON DELETE CASCADE,
  produto_nome TEXT NOT NULL,
  quantidade REAL NOT NULL,
  unidade_medida TEXT
);

CREATE TABLE IF NOT EXISTS avaria_fotos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  avaria_id INTEGER NOT NULL REFERENCES avarias(id) ON DELETE CASCADE,
  arquivo TEXT NOT NULL,
  nome_original TEXT
);

CREATE TABLE IF NOT EXISTS notas_fiscais_email (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmail_message_id TEXT NOT NULL UNIQUE,
  gmail_thread_id TEXT,
  remetente_email TEXT,
  assunto TEXT,
  data_recebimento TEXT,
  extraction_source TEXT NOT NULL DEFAULT 'xml',
  numero_nf TEXT,
  chave_acesso TEXT,
  cnpj_emitente TEXT,
  nome_emitente TEXT,
  cnpj_destinatario TEXT,
  nome_destinatario TEXT,
  cidade_destinatario TEXT,
  estado_destinatario TEXT,
  ddd_destinatario TEXT,
  telefone_destinatario TEXT,
  peso_bruto REAL,
  valor_total REAL,
  data_emissao TEXT,
  placa_veiculo TEXT,
  nome_motorista TEXT,
  remetente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  xml_arquivo TEXT,
  pdf_arquivo TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  precisa_revisao INTEGER NOT NULL DEFAULT 0,
  entrega_id INTEGER REFERENCES entregas(id) ON DELETE SET NULL,
  observacoes TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Linha do tempo de uma carga: notas manuais (qualquer usuario registra algo
-- - atraso, imprevisto, observacao) + eventos automaticos (o sistema
-- registra sozinho quando algo relevante muda, ex: troca de motorista/
-- veiculo, mudanca de status). E um historico, nao um campo editavel -
-- nunca se edita/apaga um registro, so acrescenta um novo.
CREATE TABLE IF NOT EXISTS ocorrencias_carga (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  carga_id INTEGER NOT NULL REFERENCES cargas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'manual',
  texto TEXT NOT NULL,
  usuario_nome TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Orcamentos (propostas comerciais de frete) - remetente e destinatario
-- sempre vem do cadastro de clientes (nunca texto solto), mas o nome/cidade
-- exibidos no PDF sao um "instantaneo" proprio do orcamento, editavel sem
-- mexer no cadastro. So o CNPJ do destinatario e travado quando o cadastro
-- ja tem um - por isso fica salvo aqui tambem, nao so referenciado.
CREATE TABLE IF NOT EXISTS orcamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL,
  destinatario_id INTEGER NOT NULL REFERENCES clientes(id),
  destinatario_nome TEXT NOT NULL,
  destinatario_cnpj TEXT NOT NULL,
  destino_cidade TEXT,
  destino_estado TEXT,
  produto TEXT,
  prazo_entrega TEXT,
  forma_pagamento TEXT,
  descarga_metros REAL,
  mercadoria_segurada INTEGER NOT NULL DEFAULT 1,
  frete_ajustavel_diesel INTEGER NOT NULL DEFAULT 1,
  observacoes TEXT,
  usuario_nome TEXT,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Um orcamento pode ter mais de um "lote" de frete (origens/pesos/valores
-- diferentes pro mesmo destino - existe nos exemplos reais).
CREATE TABLE IF NOT EXISTS orcamento_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orcamento_id INTEGER NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  remetente_id INTEGER NOT NULL REFERENCES clientes(id),
  remetente_nome TEXT NOT NULL,
  peso_kg REAL NOT NULL,
  valor_tonelada REAL,
  valor_frete_total REAL NOT NULL,
  descarga_inclusa INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_entregas_carga_id ON entregas(carga_id);
CREATE INDEX IF NOT EXISTS idx_entregas_cliente_id ON entregas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_entregas_remetente_id ON entregas(remetente_id);
CREATE INDEX IF NOT EXISTS idx_avarias_entrega_id ON avarias(entrega_id);
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_email_status ON notas_fiscais_email(status);
CREATE INDEX IF NOT EXISTS idx_cargas_status ON cargas(status);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_carga_id ON ocorrencias_carga(carga_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_itens_orcamento_id ON orcamento_itens(orcamento_id);
