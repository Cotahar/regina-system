import os
from app import app, db
from sqlalchemy import text

def corrigir_banco_producao():
    print("=== INICIANDO CORREÇÃO TOTAL DO BANCO (RAILWAY/POSTGRES) ===")
    
    with app.app_context():
        # 1. GARANTIR QUE AS TABELAS EXISTEM
        # Isso cria 'unidades', 'tipos_cte', 'formas_pagamento' se elas não existirem
        print(">> Passo 1: Criando tabelas inexistentes (db.create_all)...")
        try:
            db.create_all()
            print("✅ Tabelas verificadas/criadas.")
        except Exception as e:
            print(f"❌ Erro ao criar tabelas: {e}")

        # 2. LISTA DE COMANDOS SQL (Usando sintaxe segura do PostgreSQL)
        # O 'IF NOT EXISTS' impede que o script quebre se a coluna já existir
        comandos_sql = [
            # Tabela Unidades
            "ALTER TABLE unidades ADD COLUMN IF NOT EXISTS uf VARCHAR(2)",
            "ALTER TABLE unidades ADD COLUMN IF NOT EXISTS is_matriz BOOLEAN DEFAULT FALSE",
            "ALTER TABLE unidades ADD COLUMN IF NOT EXISTS tipo_cte_padrao_id INTEGER",
            
            # Tabela Clientes
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS is_remetente BOOLEAN DEFAULT FALSE",
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS padrao_forma_pagamento_id INTEGER",
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS padrao_tipo_pagamento VARCHAR(50)"
        ]

        print(">> Passo 2: Adicionando colunas novas...")
        
        # Conecta ao banco
        with db.engine.connect() as conn:
            # Executa cada comando em uma transação separada
            for sql in comandos_sql:
                try:
                    trans = conn.begin() # Abre transação
                    conn.execute(text(sql))
                    trans.commit()       # Salva imediatamente
                    print(f"✅ Executado: {sql}")
                except Exception as e:
                    trans.rollback()     # Cancela apenas este comando se der erro
                    print(f"⚠ Erro (Ignorado) ao executar '{sql}': {e}")

    print("\n=== PROCESSO FINALIZADO ===")

if __name__ == "__main__":
    corrigir_banco_producao()