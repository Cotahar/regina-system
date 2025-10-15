import sqlite3
from werkzeug.security import generate_password_hash

# --- CONFIGURAÇÃO INICIAL ---
PRIMEIRO_USUARIO = 'admin'
PRIMEIRA_SENHA = 'admin'
PRIMEIRA_PERMISSAO = 'admin'

connection = sqlite3.connect('cargas.db')

with open('schema.sql') as f:
    connection.executescript(f.read())

cursor = connection.cursor()

# Verifica se o primeiro usuário já existe
cursor.execute("SELECT id FROM usuarios WHERE nome_usuario = ?", (PRIMEIRO_USUARIO,))
if cursor.fetchone() is None:
    print(f"Criando usuário inicial: {PRIMEIRO_USUARIO}...")
    senha_hash = generate_password_hash(PRIMEIRA_SENHA)
    cursor.execute(
        "INSERT INTO usuarios (nome_usuario, senha_hash, permissao) VALUES (?, ?, ?)",
        (PRIMEIRO_USUARIO, senha_hash, PRIMEIRA_PERMISSAO)
    )
    print("Usuário admin criado com sucesso!")
else:
    print(f"Usuário '{PRIMEIRO_USUARIO}' já existe.")

connection.commit()
connection.close()

print("\nBanco de dados inicializado e verificado com sucesso!")