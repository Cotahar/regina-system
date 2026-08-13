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
  placa TEXT NOT NULL UNIQUE
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
  contato_extra TEXT
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
  adiantamento_valor REAL
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
  valor_combinado REAL,
  repasse_destinatario TEXT
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

CREATE INDEX IF NOT EXISTS idx_entregas_carga_id ON entregas(carga_id);
CREATE INDEX IF NOT EXISTS idx_entregas_cliente_id ON entregas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_entregas_remetente_id ON entregas(remetente_id);
CREATE INDEX IF NOT EXISTS idx_avarias_entrega_id ON avarias(entrega_id);
CREATE INDEX IF NOT EXISTS idx_cargas_status ON cargas(status);
