import time
import pandas as pd
import os
from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for
from flask_migrate import Migrate
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

from database import db
from models import Carga, Cliente, Entrega, Usuario

# --- INICIALIZAÇÃO E CONFIGURAÇÃO ---
app = Flask(__name__)
app.secret_key = 'sua-chave-secreta-muito-segura-aqui-12345'

basedir = os.path.abspath(os.path.dirname(__file__))

database_url = os.environ.get('DATABASE_URL')
if database_url and database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
    
app.config['SQLALCHEMY_DATABASE_URI'] = database_url or \
    'sqlite:///' + os.path.join(basedir, 'cargas.db')

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)
migrate = Migrate(app, db)

# --- DECORATORS DE AUTENTICAÇÃO ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.path.startswith('/api/'):
                return jsonify({"error": "Acesso não autorizado, por favor faça o login."}), 401
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
    return decorated_function

def permission_required(permissions):
    def wrapper(f):
        @wraps(f)
        def decorated_view(*args, **kwargs):
            if session.get('user_permission') not in permissions:
                return jsonify({"error": "Você não tem permissão para realizar esta ação."}), 403
            return f(*args, **kwargs)
        return decorated_view
    return wrapper

# --- ROTAS DE PÁGINAS ESTÁTICAS ---
@app.route('/login')
def login_page():
    return send_from_directory('.', 'login.html')

@app.route('/')
@login_required
def index():
    return send_from_directory('.', 'index.html')

@app.route('/clientes.html')
@login_required
def clientes_page():
    return send_from_directory('.', 'clientes.html')

@app.route('/usuarios.html')
@login_required
@permission_required(['admin'])
def usuarios_page():
    return send_from_directory('.', 'usuarios.html')

@app.route('/consulta.html')
@login_required
def consulta_page():
    return send_from_directory('.', 'consulta.html')

@app.route('/<path:filename>')
def serve_static(filename):
    if filename.endswith('.js') or filename.endswith('.css'):
        return send_from_directory('.', filename)
    return "File not found", 404

# --- API DE AUTENTICAÇÃO ---
@app.route('/api/login', methods=['POST'])
def login_api():
    dados = request.json
    user = Usuario.query.filter_by(nome_usuario=dados.get('nome_usuario')).first()
    if user and check_password_hash(user.senha_hash, dados.get('senha')):
        session.clear()
        session['user_id'] = user.id
        session['user_name'] = user.nome_usuario
        session['user_permission'] = user.permissao
        return jsonify({"message": "Login bem-sucedido"})
    return jsonify({"error": "Usuário ou senha inválidos"}), 401

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login_page'))

@app.route('/api/session', methods=['GET'])
@login_required
def get_session_info():
    return jsonify({ 'user_name': session.get('user_name'), 'user_permission': session.get('user_permission') })

@app.route('/api/verify-password', methods=['POST'])
@login_required
def verify_password():
    password_to_check = request.json.get('password')
    user = Usuario.query.get(session['user_id'])
    if user and check_password_hash(user.senha_hash, password_to_check):
        return jsonify({"success": True})
    return jsonify({"success": False}), 401

# --- API DE CLIENTES ---
@app.route('/api/clientes', methods=['GET'])
@login_required
def get_clientes():
    clientes_db = Cliente.query.order_by(Cliente.razao_social).all()
    clientes_lista = [{c.name: getattr(cliente, c.name) for c in cliente.__table__.columns} for cliente in clientes_db]
    return jsonify(clientes_lista)

@app.route('/api/clientes/import', methods=['POST'])
@login_required
@permission_required(['admin'])
def importar_clientes():
    if 'arquivo' not in request.files: return jsonify({"error": "Nenhum arquivo enviado"}), 400
    arquivo = request.files['arquivo']
    if arquivo.filename == '': return jsonify({"error": "Nome de arquivo vazio"}), 400
    try:
        try: df = pd.read_csv(arquivo, header=None, skiprows=1)
        except Exception:
            arquivo.seek(0)
            df = pd.read_excel(arquivo, header=None, skiprows=1)
        if len(df.columns) != 6: return jsonify({"error": f"Formato inválido. Esperado 6 colunas, mas tem {len(df.columns)}."}), 400
        df.columns = ['codigo_cliente', 'razao_social', 'ddd', 'telefone', 'cidade', 'estado']
        novos_clientes = 0
        for _, row in df.iterrows():
            if pd.isna(row['codigo_cliente']): continue
            codigo_str = str(int(row['codigo_cliente']))
            if not Cliente.query.filter_by(codigo_cliente=codigo_str).first():
                ddd_str = ''
                if not pd.isna(row['ddd']):
                    try: ddd_str = str(int(row['ddd']))
                    except (ValueError, TypeError): ddd_str = str(row['ddd'])
                novo_cliente = Cliente(
                    codigo_cliente=codigo_str, razao_social=row['razao_social'], ddd=ddd_str, 
                    telefone=str(row['telefone']), cidade=row['cidade'], estado=row['estado']
                )
                db.session.add(novo_cliente)
                novos_clientes += 1
        db.session.commit()
        return jsonify({"message": f"{novos_clientes} novos clientes importados!"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Ocorreu um erro inesperado: {e}"}), 500

@app.route('/api/clientes/<int:cliente_id>', methods=['PUT'])
@login_required
@permission_required(['admin', 'operador'])
def atualizar_cliente(cliente_id):
    cliente = Cliente.query.get_or_404(cliente_id)
    dados = request.json
    if not dados.get('razao_social') or not dados.get('cidade'): 
        return jsonify({"error": "Razão Social e Cidade são obrigatórios"}), 400
    cliente.razao_social = dados['razao_social']
    cliente.cidade = dados['cidade']
    cliente.estado = dados.get('estado')
    cliente.ddd = dados.get('ddd')
    cliente.telefone = dados.get('telefone')
    cliente.observacoes = dados.get('observacoes')
    db.session.commit()
    return jsonify({"message": "Cliente atualizado com sucesso"}), 200

# --- API DE CARGAS E ENTREGAS ---
@app.route('/api/cargas', methods=['GET', 'POST'])
@login_required
def gerenciar_cargas():
    if request.method == 'POST':
        if session['user_permission'] not in ['admin', 'operador']: 
            return jsonify({"error": "Permissão negada"}), 403
        dados = request.json
        nova_carga = Carga(codigo_carga=f"CARGA-{int(time.time())}", origem=dados['origem'].upper())
        db.session.add(nova_carga)
        db.session.commit()
        return jsonify({
            'id': nova_carga.id, 'codigo_carga': nova_carga.codigo_carga, 'origem': nova_carga.origem, 
            'status': nova_carga.status, 'num_entregas': 0, 'peso_total': 0, 'frete_total': 0,
            'motorista': None, 'placa': None, 'destino': None, 'destino_uf': None
        }), 201
    
    # GET
    # --- ALTERAÇÃO DA TASK 4 (ORDENAÇÃO) ---
    # 1. Buscar Pendentes (mais recentes primeiro)
    cargas_pendentes_db = Carga.query.filter_by(status='Pendente').order_by(Carga.id.desc()).all()
    
    # 2. Buscar Agendadas (agendamento mais próximo primeiro, nulos no fim)
    cargas_agendadas_db = Carga.query.filter_by(status='Agendada').order_by(db.func.coalesce(Carga.data_agendamento, '9999-12-31'), Carga.id.desc()).all()
    
    # 3. Buscar Em Trânsito (previsão mais próxima primeiro, nulos no fim)
    cargas_em_transito_db = Carga.query.filter_by(status='Em Trânsito').order_by(db.func.coalesce(Carga.previsao_entrega, '9999-12-31'), Carga.id.desc()).all()

    # Combinar as listas na ordem correta
    cargas_ativas = cargas_pendentes_db + cargas_agendadas_db + cargas_em_transito_db
    # --- FIM DA ALTERAÇÃO DA TASK 4 ---

    cargas_lista = []
    for carga in cargas_ativas:
        peso_total = sum(e.peso_bruto for e in carga.entregas if e.peso_bruto)
        frete_total = sum(e.valor_frete for e in carga.entregas if e.valor_frete)
        
        # --- ALTERAÇÃO DA TASK 3 (DESTINO + UF) ---
        destino_entrega = Entrega.query.filter_by(carga_id=carga.id, is_last_delivery=1).first()
        destino = None
        destino_uf = None # Nova variável
        if destino_entrega and destino_entrega.cliente:
            destino = destino_entrega.cliente.cidade
            destino_uf = destino_entrega.cliente.estado # Buscar o estado
        # --- FIM DA ALTERAÇÃO DA TASK 3 ---

        cargas_lista.append({
            'id': carga.id, 'codigo_carga': carga.codigo_carga, 'origem': carga.origem, 'status': carga.status, 
            'motorista': carga.motorista, 'placa': carga.placa, 'data_agendamento': carga.data_agendamento, 
            'data_carregamento': carga.data_carregamento, 'previsao_entrega': carga.previsao_entrega, 
            'observacoes': carga.observacoes, 'data_finalizacao': carga.data_finalizacao, 
            'num_entregas': len(carga.entregas), 'peso_total': peso_total, 'frete_total': frete_total,
            'destino': destino,
            'destino_uf': destino_uf # Adicionado ao JSON
        })
    return jsonify(cargas_lista)

@app.route('/api/cargas/consulta', methods=['GET'])
@login_required
def consultar_cargas():
    args = request.args
    page = args.get('page', 1, type=int)
    per_page = 10
    query = Carga.query

    if args.get('codigo_carga'):
        query = query.filter(Carga.codigo_carga.like(f"%{args.get('codigo_carga').upper()}%"))
    if args.get('status'):
        query = query.filter(Carga.status == args.get('status'))
    if args.get('motorista'):
        query = query.filter(Carga.motorista.like(f"%{args.get('motorista').upper()}%"))
    if args.get('origem'):
        query = query.filter(Carga.origem.like(f"%{args.get('origem').upper()}%"))
    if args.get('placa'):
        query = query.filter(Carga.placa.like(f"%{args.get('placa').upper()}%"))
    if args.get('data_finalizacao_inicio') and args.get('data_finalizacao_fim'):
        query = query.filter(Carga.data_finalizacao.between(args.get('data_finalizacao_inicio'), args.get('data_finalizacao_fim')))
    if args.get('data_carregamento_inicio') and args.get('data_carregamento_fim'):
        query = query.filter(Carga.data_carregamento.between(args.get('data_carregamento_inicio'), args.get('data_carregamento_fim')))
    if args.get('cliente_id'):
        query = query.join(Entrega).filter(Entrega.cliente_id == args.get('cliente_id'))

    pagination = query.order_by(Carga.id.desc()).paginate(page=page, per_page=per_page, error_out=False)
    cargas = pagination.items
    
    cargas_lista = []
    for carga in cargas:
        # --- ALTERAÇÃO DA TASK 3 (DESTINO + UF) ---
        destino_entrega = Entrega.query.filter_by(carga_id=carga.id, is_last_delivery=1).first()
        destino = None
        destino_uf = None # Nova variável
        if destino_entrega and destino_entrega.cliente:
            destino = destino_entrega.cliente.cidade
            destino_uf = destino_entrega.cliente.estado # Buscar o estado
        # --- FIM DA ALTERAÇÃO DA TASK 3 ---
            
        peso_total = sum(e.peso_bruto for e in carga.entregas if e.peso_bruto)
        cargas_lista.append({
            'id': carga.id, 'codigo_carga': carga.codigo_carga, 'origem': carga.origem,
            'status': carga.status, 'motorista': carga.motorista, 'data_finalizacao': carga.data_finalizacao,
            'num_entregas': len(carga.entregas), 'peso_total': peso_total, 
            'destino': destino,
            'destino_uf': destino_uf # Adicionado ao JSON
        })
    return jsonify({'cargas': cargas_lista, 'total_paginas': pagination.pages, 'pagina_atual': page, 'total_resultados': pagination.total})


@app.route('/api/cargas/<int:carga_id>', methods=['GET'])
@login_required
def get_detalhes_carga(carga_id):
    carga = Carga.query.get_or_404(carga_id)
    detalhes_carga = {c.name: getattr(carga, c.name) for c in carga.__table__.columns}
    entregas_lista = []
    for e in carga.entregas:
        entregas_lista.append({
            'id': e.id, 'carga_id': e.carga_id, 'cliente_id': e.cliente_id,
            'peso_bruto': e.peso_bruto, 'valor_frete': e.valor_frete, 'peso_cobrado': e.peso_cobrado, 
            'is_last_delivery': e.is_last_delivery, 'razao_social': e.cliente.razao_social, 
            'cidade': e.cliente.cidade, 'estado': e.cliente.estado, 'ddd': e.cliente.ddd, 
            'telefone': e.cliente.telefone, 'obs_cliente': e.cliente.observacoes
        })
    return jsonify({"detalhes_carga": detalhes_carga, "entregas": sorted(entregas_lista, key=lambda x: x['razao_social'])})


@app.route('/api/cargas/<int:carga_id>/entregas', methods=['POST', 'DELETE'])
@login_required
@permission_required(['admin', 'operador'])
def gerenciar_entregas(carga_id):
    if request.method == 'POST':
        dados = request.json
        if not dados.get('cliente_id') or dados.get('peso_bruto') is None: 
            return jsonify({"error": "Cliente e Peso Bruto são obrigatórios"}), 400
        nova_entrega = Entrega(
            carga_id=carga_id, cliente_id=dados['cliente_id'], peso_bruto=dados.get('peso_bruto'), 
            valor_frete=dados.get('valor_frete'), peso_cobrado=dados.get('peso_cobrado')
        )
        db.session.add(nova_entrega)
        db.session.commit()
        return jsonify({"message": "Entrega adicionada com sucesso"}), 201
    
    if request.method == 'DELETE':
        entrega = Entrega.query.get(request.json.get('entrega_id'))
        if entrega and entrega.carga_id == carga_id:
            db.session.delete(entrega)
            db.session.commit()
            return jsonify({"message": "Entrega excluída com sucesso"}), 200
        return jsonify({"error": "Entrega não encontrada"}), 404

@app.route('/api/cargas/<int:carga_id>/status', methods=['PUT'])
@login_required
def atualizar_status_carga(carga_id):
    carga = Carga.query.get_or_404(carga_id)
    dados = request.json
    permissao_usuario = session['user_permission']
    
    if 'status' in dados:
        permissoes = {'Agendada': ['admin', 'operador'], 'Em Trânsito': ['admin', 'operador'],
                      'Finalizada': ['admin', 'operador'], 'Pendente': ['admin', 'operador']}
        if permissao_usuario not in permissoes.get(dados['status'], []):
            return jsonify({"error": "Permissão negada para esta ação"}), 403

    for key, value in dados.items():
        if hasattr(carga, key):
            if key in ['motorista', 'placa', 'origem'] and value is not None:
                value = value.upper()
            setattr(carga, key, value)
    db.session.commit()
    return jsonify({"message": "Carga atualizada com sucesso"}), 200

@app.route('/api/entregas/<int:entrega_id>', methods=['PUT'])
@login_required
@permission_required(['admin', 'operador'])
def atualizar_entrega(entrega_id):
    entrega = Entrega.query.get_or_404(entrega_id)
    dados = request.json

    if 'is_last_delivery' in dados and dados['is_last_delivery'] == 1:
        Entrega.query.filter_by(carga_id=entrega.carga_id).update({'is_last_delivery': 0})
        db.session.flush()

    for key, value in dados.items():
        if hasattr(entrega, key): 
            setattr(entrega, key, value)
            
    if 'peso_bruto' not in dados and (entrega.peso_bruto is None or entrega.peso_bruto == ''):
        return jsonify({"error": "Peso Bruto é um campo obrigatório"}), 400
        
    db.session.commit()
    return jsonify({"message": "Entrega atualizada com sucesso"}), 200

# --- API DE USUÁRIOS ---
@app.route('/api/usuarios', methods=['GET'])
@login_required
@permission_required(['admin'])
def get_usuarios():
    usuarios = Usuario.query.order_by(Usuario.nome_usuario).all()
    return jsonify([{'id': u.id, 'nome_usuario': u.nome_usuario, 'permissao': u.permissao} for u in usuarios])

@app.route('/api/usuarios', methods=['POST'])
@login_required
@permission_required(['admin'])
def criar_usuario():
    dados = request.json
    if not all(k in dados for k in ['nome_usuario', 'senha', 'permissao']):
        return jsonify({"error": "Todos os campos são obrigatórios"}), 400
    if Usuario.query.filter_by(nome_usuario=dados['nome_usuario']).first():
        return jsonify({"error": "Este nome de usuário já está em uso"}), 409
    novo_usuario = Usuario(
        nome_usuario=dados['nome_usuario'],
        senha_hash=generate_password_hash(dados['senha']),
        permissao=dados['permissao']
    )
    db.session.add(novo_usuario)
    db.session.commit()
    return jsonify({"message": "Usuário criado com sucesso"}), 201

@app.route('/api/usuarios/<int:user_id>', methods=['PUT', 'DELETE'])
@login_required
@permission_required(['admin'])
def gerenciar_usuario_especifico(user_id):
    if user_id == 1: return jsonify({"error": "O administrador principal não pode ser modificado"}), 403
    usuario = Usuario.query.get_or_404(user_id)
    if request.method == 'PUT':
        dados = request.json
        if not all(k in dados for k in ['nome_usuario', 'permissao']):
            return jsonify({"error": "Nome de usuário e permissão são obrigatórios"}), 400
        if Usuario.query.filter(Usuario.nome_usuario == dados['nome_usuario'], Usuario.id != user_id).first():
            return jsonify({"error": "Este nome de usuário já está em uso"}), 409
        usuario.nome_usuario = dados['nome_usuario']
        usuario.permissao = dados['permissao']
        if 'senha' in dados and dados['senha']:
            usuario.senha_hash = generate_password_hash(dados['senha'])
        db.session.commit()
        return jsonify({"message": "Usuário atualizado com sucesso"})
    elif request.method == 'DELETE':
        db.session.delete(usuario)
        db.session.commit()
        return jsonify({"message": "Usuário excluído com sucesso"})

# --- PONTO DE ENTRADA ---
if __name__ == '__main__':
    app.run(debug=True, port=5001)