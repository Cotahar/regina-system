# ESTA É A VERSÃO CORRETA E DEFINITIVA DO init_db.py
from werkzeug.security import generate_password_hash
from app import app, db, Usuario # Importa o app, o db e o modelo Usuario

# --- CONFIGURAÇÃO INICIAL ---
PRIMEIRO_USUARIO = 'admin'
PRIMEIRA_SENHA = 'admin'
PRIMEIRA_PERMISSAO = 'admin'

# Usa o contexto da aplicação para garantir que a conexão com o BD seja a correta
with app.app_context():
    # Verifica se o primeiro usuário já existe
    if Usuario.query.filter_by(nome_usuario=PRIMEIRO_USUARIO).first() is None:
        print(f"Criando usuário inicial: {PRIMEIRO_USUARIO}...")
        
        # Cria a instância do usuário usando o modelo SQLAlchemy
        novo_usuario = Usuario(
            nome_usuario=PRIMEIRO_USUARIO,
            senha_hash=generate_password_hash(PRIMEIRA_SENHA),
            permissao=PRIMEIRA_PERMISSAO
        )
        
        # Adiciona o novo usuário à sessão e salva no banco de dados
        db.session.add(novo_usuario)
        db.session.commit()
        
        print("Usuário admin criado com sucesso!")
    else:
        print(f"Usuário '{PRIMEIRO_USUARIO}' já existe.")

print("\nBanco de dados verificado com sucesso!")