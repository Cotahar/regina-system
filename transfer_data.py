import os
from dotenv import load_dotenv
import sqlite3

# Primeiro, garantimos que o arquivo .env existe ou é criado.
if not os.path.exists('.env'):
    db_url = input("Cole aqui a 'Postgres Connection URL' da Railway e pressione Enter:\n")
    if db_url.startswith('postgres://'):
        db_url = db_url.replace('postgres://', 'postgresql://', 1)
    with open('.env', 'w') as f:
        f.write(f'DATABASE_URL={db_url}\n')
    print("Arquivo .env criado com sucesso.")

load_dotenv()

# AGORA importamos o app e os modelos
from app import app, db, Usuario, Cliente, Carga, Entrega # Importa Cliente mesmo sem transferir, pois Entrega depende dele

OLD_DB_PATH = 'cargas.db'
print("\n--- INICIANDO TRANSFERÊNCIA DE DADOS ---")

def transfer_data():
    print("\n1. Conectando ao banco de dados antigo (SQLite)...")
    try:
        conn_old = sqlite3.connect(OLD_DB_PATH)
        conn_old.row_factory = sqlite3.Row
        cursor = conn_old.cursor()
        cursor.execute("PRAGMA table_info(entregas)")
        entregas_old_columns = [column[1] for column in cursor.fetchall()]
    except Exception as e:
        print(f"ERRO ao conectar ao SQLite: {e}")
        return

    with app.app_context():
        print("\n2. Limpando tabelas (exceto clientes e usuários já existentes)...")
        try:
            # Limpa apenas cargas e entregas
            db.session.execute(db.text('TRUNCATE TABLE entregas RESTART IDENTITY CASCADE'))
            db.session.execute(db.text('TRUNCATE TABLE cargas RESTART IDENTITY CASCADE'))
            # Não limpa clientes e usuários
            db.session.commit()
            print("Tabelas de Cargas e Entregas limpas com sucesso.")
        except Exception as e:
            print(f"Aviso ao limpar tabelas: {e}")
            db.session.rollback()

        # --- Transferência de USUÁRIOS (Opcional, se precisar recriar o admin) ---
        # print("\n3. Verificando/Transferindo usuários...")
        # usuarios = cursor.execute('SELECT * FROM usuarios').fetchall()
        # for u in usuarios:
        #     # Verifica se o usuário já existe pelo ID antes de tentar mesclar
        #     usuario_existente = db.session.get(Usuario, u['id'])
        #     if not usuario_existente:
        #          novo_usuario = Usuario(id=u['id'], nome_usuario=u['nome_usuario'], senha_hash=u['senha_hash'], permissao=u['permissao'])
        #          db.session.add(novo_usuario) # Adiciona apenas se não existir
        # db.session.commit()
        # print(f"{len(usuarios)} usuários verificados/transferidos.")

        # --- Transferência de CARGAS ---
        print("\n4. Transferindo cargas...")
        cargas_sqlite = cursor.execute('SELECT * FROM cargas').fetchall()
        cargas_transferidas_ids = set() # Guarda os IDs das cargas que realmente foram transferidas
        for c in cargas_sqlite:
            nova_carga = Carga(
                id=c['id'], codigo_carga=c['codigo_carga'], origem=c['origem'], status=c['status'], motorista=c['motorista'],
                placa=c['placa'], data_agendamento=c['data_agendamento'], data_carregamento=c['data_carregamento'],
                previsao_entrega=c['previsao_entrega'], observacoes=c['observacoes'], data_finalizacao=c['data_finalizacao']
            )
            db.session.merge(nova_carga) # Usa merge para atualizar se já existir pelo ID
            cargas_transferidas_ids.add(c['id'])
        db.session.commit()
        print(f"{len(cargas_sqlite)} cargas transferidas.")

        # --- Transferência de ENTREGAS (COM CORREÇÃO FINAL) ---
        print("\n5. Transferindo entregas...")
        entregas_sqlite = cursor.execute('SELECT * FROM entregas').fetchall()
        entregas_transferidas_count = 0
        entregas_puladas_count = 0
        
        # Pega todos os IDs de clientes válidos do banco de dados de destino ANTES do loop
        clientes_validos_ids = {c.id for c in Cliente.query.all()}
        
        for e in entregas_sqlite:
            # ----> CORREÇÃO FINAL APLICADA AQUI <----
            # Verifica se o cliente_id existe na lista de IDs válidos e se a carga_id foi transferida
            if e['cliente_id'] in clientes_validos_ids and e['carga_id'] in cargas_transferidas_ids:
                is_last = e['is_last_delivery'] if 'is_last_delivery' in entregas_old_columns else 0
                nova_entrega = Entrega(
                    id=e['id'], carga_id=e['carga_id'], cliente_id=e['cliente_id'], peso_bruto=e['peso_bruto'],
                    valor_frete=e['valor_frete'], peso_cobrado=e['peso_cobrado'], is_last_delivery=is_last
                )
                db.session.merge(nova_entrega) # Usa merge para atualizar se já existir
                entregas_transferidas_count += 1
            else:
                print(f"  -> Aviso: Pulando entrega ID {e['id']} pois o cliente ID {e['cliente_id']} não foi encontrado no destino ou a carga ID {e['carga_id']} não foi transferida.")
                entregas_puladas_count += 1
                
        db.session.commit()
        print(f"{entregas_transferidas_count} entregas transferidas.")
        if entregas_puladas_count > 0:
            print(f"{entregas_puladas_count} entregas foram puladas devido a referências inválidas.")
    
    conn_old.close()
    print("\n--- TRANSFERÊNCIA CONCLUÍDA! ---")

if __name__ == '__main__':
    transfer_data()