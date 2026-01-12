import os
from app import app, db
from sqlalchemy import text

def corrigir_banco_producao():
    print("=== INICIANDO CORREÇÃO TOTAL DO BANCO (RAILWAY/POSTGRES) ===")
    
    with app.app_context():
        # PASSO 1: CRIAR TABELAS QUE NÃO EXISTEM (Unidades, TiposCte, FormasPagamento)
        print(">> [1/2] Verificando e criando tabelas inexistentes...")
        try:
            db.create_all()
            print("✅ Tabelas verificadas/criadas com sucesso.")
        except Exception as e:
            print(f"❌ Erro ao criar tabelas: {e}")

        # PASSO 2: ADICIONAR COLUNAS NOVAS (Usando transações isoladas para evitar travar o banco)
        print(">> [2/2] Adicionando colunas novas nas tabelas existentes...")
        
        comandos_sql = [
            # Tabela Unidades (caso ela já existisse vazia)
            "ALTER TABLE unidades ADD COLUMN IF NOT EXISTS uf VARCHAR(2)",
            "ALTER TABLE unidades ADD COLUMN IF NOT EXISTS is_matriz BOOLEAN DEFAULT FALSE",
            "ALTER TABLE unidades ADD COLUMN IF NOT EXISTS tipo_cte_padrao_id INTEGER",
            
            # Tabela Clientes (Essa com certeza existe e precisa das colunas)
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS is_remetente BOOLEAN DEFAULT FALSE",
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS padrao_forma_pagamento_id INTEGER",
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS padrao_tipo_pagamento VARCHAR(50)"
        ]

        # Conecta ao banco para rodar os ALTER TABLE
        with db.engine.connect() as conn:
            for sql in comandos_sql:
                try:
                    # Abre uma transação para cada comando. Se falhar, não trava o resto.
                    trans = conn.begin() 
                    conn.execute(text(sql))
                    trans.commit()
                    print(f"✅ Executado: {sql}")
                except Exception as e:
                    trans.rollback()
                    # Se der erro, geralmente é porque a coluna já existe ou tabela não permite
                    # O 'IF NOT EXISTS' do Postgres ajuda, mas o Python pode reclamar mesmo assim.
                    print(f"⚠ Aviso (Comando ignorado): {sql} | Motivo: {e}")

    print("\n=== PROCESSO FINALIZADO ===")

if __name__ == "__main__":
    corrigir_banco_producao()