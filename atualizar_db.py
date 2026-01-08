from app import app, db
from sqlalchemy import text
import os

def corrigir_banco():
    print("=== INICIANDO CORREÇÃO DO BANCO DE DADOS ===")
    
    # Pega o caminho exato que o Flask usa
    db_url = app.config['SQLALCHEMY_DATABASE_URI']
    print(f"Configuração do Banco: {db_url}")
    
    # Remove o prefixo sqlite:/// para checar se o arquivo existe
    arquivo_db = db_url.replace('sqlite:///', '')
    if not os.path.exists(arquivo_db):
        print(f"ERRO: O arquivo '{arquivo_db}' não foi encontrado nesta pasta!")
        return

    with app.app_context():
        # Usa a conexão direta do SQLAlchemy (Engine)
        with db.engine.connect() as conn:
            transaction = conn.begin()
            try:
                # 1. Adicionar padrao_forma_pagamento_id
                try:
                    print("Tentando criar coluna 'padrao_forma_pagamento_id'...")
                    conn.execute(text("ALTER TABLE clientes ADD COLUMN padrao_forma_pagamento_id INTEGER"))
                    print("✅ Sucesso.")
                except Exception as e:
                    if "duplicate column" in str(e).lower(): print("⚠ Coluna já existe (Ignorado).")
                    else: print(f"❌ Erro: {e}")

                # 2. Adicionar padrao_tipo_pagamento
                try:
                    print("Tentando criar coluna 'padrao_tipo_pagamento'...")
                    conn.execute(text("ALTER TABLE clientes ADD COLUMN padrao_tipo_pagamento TEXT"))
                    print("✅ Sucesso.")
                except Exception as e:
                    if "duplicate column" in str(e).lower(): print("⚠ Coluna já existe (Ignorado).")
                    else: print(f"❌ Erro: {e}")

                # 3. Adicionar is_remetente
                try:
                    print("Tentando criar coluna 'is_remetente'...")
                    conn.execute(text("ALTER TABLE clientes ADD COLUMN is_remetente BOOLEAN DEFAULT 0"))
                    print("✅ Sucesso.")
                except Exception as e:
                    if "duplicate column" in str(e).lower(): print("⚠ Coluna já existe (Ignorado).")
                    else: print(f"❌ Erro: {e}")

                transaction.commit()
                print("\n=== CORREÇÃO FINALIZADA COM SUCESSO ===")
                
            except Exception as main_error:
                transaction.rollback()
                print(f"\n❌ ERRO CRÍTICO NA TRANSAÇÃO: {main_error}")

if __name__ == "__main__":
    corrigir_banco()