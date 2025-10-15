-- Apaga as tabelas antigas se existirem, para garantir um começo limpo
DROP TABLE IF EXISTS entregas;
DROP TABLE IF EXISTS cargas;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS usuarios;

-- Tabela para armazenar os clientes importados
CREATE TABLE clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_cliente TEXT NOT NULL UNIQUE,
    razao_social TEXT NOT NULL,
    ddd TEXT,
    telefone TEXT,
    cidade TEXT,
    estado TEXT,
    observacoes TEXT
);

-- Tabela para armazenar a VIAGEM/CARGA
CREATE TABLE cargas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo_carga TEXT NOT NULL UNIQUE,
    origem TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendente',
    motorista TEXT,
    placa TEXT,
    data_agendamento TEXT,
    data_carregamento TEXT,
    previsao_entrega TEXT,
    observacoes TEXT,
    data_finalizacao TEXT
);

-- Tabela para armazenar cada ENTREGA dentro de uma CARGA
CREATE TABLE entregas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    carga_id INTEGER NOT NULL,
    cliente_id INTEGER NOT NULL,
    peso_bruto REAL,
    valor_frete REAL,
    peso_cobrado REAL,
    FOREIGN KEY (carga_id) REFERENCES cargas (id),
    FOREIGN KEY (cliente_id) REFERENCES clientes (id)
);

-- Tabela para armazenar os usuários do sistema
CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_usuario TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    permissao TEXT NOT NULL -- (ex: 'admin', 'operador', 'rastreador')
);