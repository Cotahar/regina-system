import pandas as pd
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

# Tenta carregar do .env se existir
load_dotenv('.env.railway')

# --- CONFIGURAÇÃO ---
# Se rodar localmente, COLE SUA URL PÚBLICA DO RAILWAY AQUI se o .env não funcionar
DB_URL = "postgresql://postgres:JPwuripJRPksDlOvADaJWFnHwsvzDaaV@turntable.proxy.rlwy.net:12015/railway"

def realizar_backup():
    if not DB_URL or "COLE_SUA" in DB_URL:
        print("ERRO: Você precisa configurar a DB_URL no script ou no .env!")
        return

    print(f"Conectando ao banco...")
    try:
        engine = create_engine(DB_URL)
        conn = engine.connect()
        print("Conexão bem sucedida!")
    except Exception as e:
        print(f"Erro ao conectar: {e}")
        return

    # Lista das tabelas (algumas podem não existir ainda, e tudo bem)
    tabelas = [
        'clientes', 
        'motoristas', 
        'veiculos', 
        'usuarios', 
        'cargas', 
        'entregas', 
    ]
    
    if not os.path.exists('backup_hoje'):
        os.makedirs('backup_hoje')

    print("\nIniciando exportação...")
    
    for tabela in tabelas:
        try:
            # Tenta ler a tabela
            df = pd.read_sql(f"SELECT * FROM {tabela}", conn)
            
            arquivo_excel = f"backup_hoje/{tabela}.xlsx"
            df.to_excel(arquivo_excel, index=False)
            print(f"✅ Tabela '{tabela}' salva: {len(df)} registros.")
            
        except Exception as e:
            # Se der erro (ex: tabela não existe), faz ROLLBACK para destrava a conexão
            print(f"⚠️ Pulei a tabela '{tabela}': {e.__class__.__name__}")
            try:
                conn.rollback()
            except:
                pass # Se não der para dar rollback, vida que segue

    conn.close()
    print("\n--- BACKUP CONCLUÍDO! Verifique a pasta 'backup_hoje' ---")

if __name__ == "__main__":
    realizar_backup()