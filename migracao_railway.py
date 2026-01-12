# migracao_railway.py
import os
from app import app, db
from sqlalchemy import text

def migrar_banco_producao():
    print("=== INICIANDO MIGRAÇÃO DO BANCO DE DADOS (RAILWAY) ===")
    
    # Pega a URL do banco do ambiente (Railway injeta isso automaticamente)
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print("⚠ ATENÇÃO: DATABASE_URL não encontrada. Se estiver rodando local, certifique-se que o .env está carregado.")
        # Não aborta, pois pode estar usando SQLite local de fallback
    
    with app.app_context():
        with db.engine.connect() as conn:
            transaction = conn.begin()
            try:
                print(">> Verificando tabelas e colunas...")

                # --- 1. Tabela UNIDADES ---
                # Adiciona UF
                try:
                    conn.execute(text("ALTER TABLE unidades ADD COLUMN uf VARCHAR(2)"))
                    print("✅ [Unidades] Coluna 'uf' criada.")
                except Exception as e:
                    print(f"ℹ [Unidades] Coluna 'uf' já existe ou erro: {e}")

                # Adiciona Is_Matriz
                try:
                    # Postgres usa BOOLEAN, SQLite aceita também. O DEFAULT ajuda a não quebrar dados antigos.
                    conn.execute(text("ALTER TABLE unidades ADD COLUMN is_matriz BOOLEAN DEFAULT FALSE"))
                    print("✅ [Unidades] Coluna 'is_matriz' criada.")
                except Exception as e:
                    print(f"ℹ [Unidades] Coluna 'is_matriz' já existe ou erro: {e}")

                # Adiciona Tipo CT-e Padrão
                try:
                    conn.execute(text("ALTER TABLE unidades ADD COLUMN tipo_cte_padrao_id INTEGER"))
                    print("✅ [Unidades] Coluna 'tipo_cte_padrao_id' criada.")
                except Exception as e:
                    print(f"ℹ [Unidades] Coluna 'tipo_cte_padrao_id' já existe ou erro: {e}")

                # --- 2. Tabela CLIENTES ---
                # Adiciona Is_Remetente
                try:
                    conn.execute(text("ALTER TABLE clientes ADD COLUMN is_remetente BOOLEAN DEFAULT FALSE"))
                    print("✅ [Clientes] Coluna 'is_remetente' criada.")
                except Exception as e:
                    print(f"ℹ [Clientes] Coluna 'is_remetente' já existe ou erro: {e}")

                # Adiciona Padrão Forma Pagamento
                try:
                    conn.execute(text("ALTER TABLE clientes ADD COLUMN padrao_forma_pagamento_id INTEGER"))
                    print("✅ [Clientes] Coluna 'padrao_forma_pagamento_id' criada.")
                except Exception as e:
                    print(f"ℹ [Clientes] Coluna 'padrao_forma_pagamento_id' já existe ou erro: {e}")

                # Adiciona Padrão Tipo Pagamento
                try:
                    conn.execute(text("ALTER TABLE clientes ADD COLUMN padrao_tipo_pagamento VARCHAR(50)"))
                    print("✅ [Clientes] Coluna 'padrao_tipo_pagamento' criada.")
                except Exception as e:
                    print(f"ℹ [Clientes] Coluna 'padrao_tipo_pagamento' já existe ou erro: {e}")

                transaction.commit()
                print("\n=== MIGRAÇÃO CONCLUÍDA COM SUCESSO! ===")
                
            except Exception as main_error:
                transaction.rollback()
                print(f"\n❌ ERRO CRÍTICO NA MIGRAÇÃO: {main_error}")

if __name__ == "__main__":
    migrar_banco_producao()