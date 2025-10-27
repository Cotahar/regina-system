#
# criar_remetente.py (CRIE ESTE ARQUIVO)
#
import os
from app import app, db
from models import Cliente

# Código do remetente padrão para V1
CODIGO_PADRAO = '000-REMETENTE-V1'
NOME_PADRAO = 'REMETENTE PADRÃO (V1)'

def criar_remetente_v1():
    with app.app_context():
        # Verifica se já existe
        remetente = Cliente.query.filter_by(codigo_cliente=CODIGO_PADRAO).first()
        
        if remetente:
            print(f">>> Remetente '{NOME_PADRAO}' já existe.")
            print(f">>> O ID dele é: {remetente.id}")
            print("\n*** Guarde este ID! ***")
        else:
            # Cria um novo
            print(f">>> Criando remetente '{NOME_PADRAO}'...")
            novo_remetente = Cliente(
                codigo_cliente=CODIGO_PADRAO,
                razao_social=NOME_PADRAO,
                cidade="INDISPONIVEL",
                estado="NA"
            )
            db.session.add(novo_remetente)
            db.session.commit()
            print(f">>> Remetente criado com sucesso!")
            print(f">>> O ID dele é: {novo_remetente.id}")
            print("\n*** Guarde este ID! ***")

if __name__ == '__main__':
    print("Executando script para garantir remetente padrão V1...")
    criar_remetente_v1()