import sqlite3
try:
    conn = sqlite3.connect('cargas.db')
    conn.execute('DROP TABLE IF EXISTS alembic_version')
    conn.close()
    print("Tabela de versão do Alembic removida com sucesso!")
except Exception as e:
    print(f"Ocorreu um erro: {e}")