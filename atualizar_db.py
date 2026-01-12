from app import app, db
from sqlalchemy import text

def corrigir_tudo():
    print("=== VERIFICANDO E CORRIGINDO BANCO DE DADOS ===")
    with app.app_context():
        with db.engine.connect() as conn:
            trans = conn.begin()
            try:
                # 1. Correções na Tabela UNIDADES
                print(">> Verificando Tabela UNIDADES...")
                try: conn.execute(text("ALTER TABLE unidades ADD COLUMN uf TEXT"))
                except: pass
                try: conn.execute(text("ALTER TABLE unidades ADD COLUMN is_matriz BOOLEAN DEFAULT 0"))
                except: pass
                try: conn.execute(text("ALTER TABLE unidades ADD COLUMN tipo_cte_padrao_id INTEGER"))
                except: pass

                # 2. Correções na Tabela CLIENTES (Garantia)
                print(">> Verificando Tabela CLIENTES...")
                try: conn.execute(text("ALTER TABLE clientes ADD COLUMN padrao_forma_pagamento_id INTEGER"))
                except: pass
                try: conn.execute(text("ALTER TABLE clientes ADD COLUMN padrao_tipo_pagamento TEXT"))
                except: pass
                try: conn.execute(text("ALTER TABLE clientes ADD COLUMN is_remetente BOOLEAN DEFAULT 0"))
                except: pass

                trans.commit()
                print("\n✅ BANCO DE DADOS ATUALIZADO COM SUCESSO!")
            except Exception as e:
                trans.rollback()
                print(f"\n❌ Erro: {e}")

if __name__ == "__main__":
    corrigir_tudo()