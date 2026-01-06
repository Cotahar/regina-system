from app import app, db
from sqlalchemy import text
from models import Marca # Importa para o SQLAlchemy reconhecer

def atualizar_banco():
    with app.app_context():
        print("--- INICIANDO ATUALIZAÇÃO DO BANCO DE DADOS ---")
        
        # 1. Cria novas tabelas (Como a 'marcas' e 'avaria_fotos' se não existirem)
        print("1. Verificando novas tabelas...")
        db.create_all()
        print("   ✅ Tabelas garantidas.")

        # 2. Popula Marcas Padrão se estiver vazio
        if not Marca.query.first():
            print("2. Populando marcas padrão...")
            marcas_padrao = ["ELIANE", "PORTINARI", "PORTOBELLO", "INCEPA", "CEUSA", "ELIZABETH", "BIANCHOGRES", "DELTA"]
            for m in marcas_padrao:
                db.session.add(Marca(nome=m))
            db.session.commit()
            print("   ✅ Marcas criadas.")

        # 3. Adiciona colunas novas na tabela 'avarias' (Migração Manual)
        print("3. Verificando novas colunas na tabela 'avarias'...")
        with db.engine.connect() as conn:
            # Lista de colunas para adicionar
            novas_colunas = [
                ("registro_envio", "TEXT"),
                ("retorno_fabrica", "TEXT"),
                ("valor_cobranca", "FLOAT")
            ]
            
            for col_nome, col_tipo in novas_colunas:
                try:
                    conn.execute(text(f"ALTER TABLE avarias ADD COLUMN {col_nome} {col_tipo}"))
                    print(f"   ✅ Coluna '{col_nome}' criada.")
                except Exception as e:
                    # Se der erro, provavelmente já existe (ignora)
                    print(f"   ℹ️ Coluna '{col_nome}' já existe ou erro: {e.__class__.__name__}")
            
            conn.commit()
            
        print("\n--- ATUALIZAÇÃO CONCLUÍDA COM SUCESSO! 🚀 ---")

if __name__ == "__main__":
    atualizar_banco()