#
# app.py (ATUALIZADO PARA V2 - MÓDULO 4.2 - Edição de Remetente)
#
import time
import pandas as pd
import os
from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for
from flask_migrate import Migrate
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from sqlalchemy.orm import joinedload


import traceback
from dotenv import load_dotenv # 

from sqlalchemy import func # Para somas no banco


from database import db
from models import Carga, Cliente, Entrega, Usuario, Motorista, Veiculo

# --- INICIALIZAÇÃO E CONFIGURAÇÃO ---
load_dotenv('.env.railway') # <-- LINHA NOVA AQUI
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
                return jsonify({"error": "Acesso não autorizado."}), 401
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
    return decorated_function

def permission_required(permissions):
    def wrapper(f):
        @wraps(f)
        def decorated_view(*args, **kwargs):
            if session.get('user_permission') not in permissions:
                return jsonify({"error": "Permissão negada."}), 403
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

@app.route('/motoristas.html')
@login_required
@permission_required(['admin', 'operador'])
def motoristas_page():
    return send_from_directory('.', 'motoristas.html')

@app.route('/veiculos.html')
@login_required
@permission_required(['admin', 'operador'])
def veiculos_page():
    return send_from_directory('.', 'veiculos.html')

@app.route('/montagem.html')
@login_required
@permission_required(['admin', 'operador'])
def montagem_page():
    return send_from_directory('.', 'montagem.html')

@app.route('/<path:filename>')
def serve_static(filename):
    if filename.endswith(('.js', '.css')):
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
    return jsonify({'user_name': session.get('user_name'), 'user_permission': session.get('user_permission')})

@app.route('/api/verify-password', methods=['POST'])
@login_required
def verify_password():
    password_to_check = request.json.get('password')
    user = Usuario.query.get(session['user_id'])
    if user and check_password_hash(user.senha_hash, password_to_check):
        return jsonify({"success": True})
    return jsonify({"success": False}), 401


# --- API DE CLIENTES ---
# Rota simplificada (agora com is_remetente)
@app.route('/api/clientes', methods=['GET'])
@login_required
def get_clientes():
    clientes_db = Cliente.query.order_by(Cliente.razao_social).all()
    clientes_lista = [{'id': c.id, 'text': f"{c.razao_social} ({c.cidade or 'N/A'})", 'cidade': c.cidade, 'estado': c.estado, 'is_remetente': c.is_remetente} for c in clientes_db]
    return jsonify(clientes_lista)

# Rota completa (agora com is_remetente)
@app.route('/api/clientes/detalhes', methods=['GET'])
@login_required
def get_clientes_detalhes():
    clientes_db = Cliente.query.order_by(Cliente.razao_social).all()
    clientes_lista = [{col.name: getattr(cliente, col.name) for col in cliente.__table__.columns} for cliente in clientes_db]
    return jsonify(clientes_lista)

@app.route('/api/clientes/import', methods=['POST'])
@login_required
@permission_required(['admin'])
def importar_clientes():
    if 'arquivo' not in request.files: return jsonify({"error": "Nenhum arquivo"}), 400
    arquivo = request.files['arquivo']; df = None
    try:
        try:
            try: arquivo.seek(0); df = pd.read_csv(arquivo, header=None, skiprows=1, sep=';'); assert len(df.columns) >= 6
            except: arquivo.seek(0); df = pd.read_csv(arquivo, header=None, skiprows=1); assert len(df.columns) >= 6
        except:
            try: arquivo.seek(0); df = pd.read_excel(arquivo, header=None, skiprows=1, engine='openpyxl')
            except: arquivo.seek(0); df = pd.read_excel(arquivo, header=None, skiprows=1)
        if df is None: return jsonify({"error": "Não leu."}), 500
        if len(df.columns) < 6: return jsonify({"error": f"{len(df.columns)} colunas."}), 400
        df = df.iloc[:, :6]; df.columns = ['codigo_cliente', 'razao_social', 'ddd', 'telefone', 'cidade', 'estado']; novos = 0
        for _, row in df.iterrows():
            if pd.isna(row['codigo_cliente']): continue
            try: code = str(int(row['codigo_cliente']))
            except: code = str(row['codigo_cliente'])
            if not Cliente.query.filter_by(codigo_cliente=code).first():
                ddd = str(int(row['ddd'])) if not pd.isna(row['ddd']) and str(row['ddd']).isdigit() else str(row['ddd'] or '')
                tel = str(row['telefone']) if not pd.isna(row['telefone']) else ''
                cid = str(row['cidade']) if not pd.isna(row['cidade']) else ''
                est = str(row['estado']) if not pd.isna(row['estado']) else ''
                raz = str(row['razao_social']) if not pd.isna(row['razao_social']) else ''
                novo = Cliente(codigo_cliente=code, razao_social=raz, ddd=ddd, telefone=tel, cidade=cid, estado=est, is_remetente=False)
                db.session.add(novo); novos += 1
        db.session.commit()
        return jsonify({"message": f"{novos} clientes importados!"}), 200
    except Exception as e: db.session.rollback(); print(f"ERR Import Cli: {e}"); traceback.print_exc(); return jsonify({"error": f"Erro: {e}"}), 500

@app.route('/api/clientes/<int:cliente_id>', methods=['PUT'])
@login_required
@permission_required(['admin', 'operador'])
def atualizar_cliente(cliente_id): # (agora com is_remetente)
    cl = Cliente.query.get_or_404(cliente_id)
    dados = request.json
    if not dados.get('razao_social') or not dados.get('cidade'): return jsonify({"error": "Razão e Cidade obrigatórios"}), 400
    cl.razao_social = dados['razao_social']
    cl.cidade = dados['cidade']
    cl.estado = dados.get('estado')
    cl.ddd = dados.get('ddd')
    cl.telefone = dados.get('telefone')
    cl.observacoes = dados.get('observacoes')
    cl.is_remetente = dados.get('is_remetente', False)
    db.session.commit()
    return jsonify({"message": "Cliente atualizado"}), 200

# --- APIs de Motorista/Veículo ---
@app.route('/api/motoristas', methods=['GET'])
@login_required
def get_motoristas():
    motoristas_db = Motorista.query.order_by(Motorista.nome).all()
    motoristas_lista = [{'id': m.id, 'codigo': m.codigo, 'nome': m.nome, 'text': m.nome} for m in motoristas_db]
    return jsonify(motoristas_lista)

@app.route('/api/veiculos', methods=['GET'])
@login_required
def get_veiculos():
    veiculos_db = Veiculo.query.order_by(Veiculo.placa).all()
    veiculos_lista = [{'id': v.id, 'placa': v.placa, 'text': v.placa} for v in veiculos_db]
    return jsonify(veiculos_lista)

@app.route('/api/motoristas/import', methods=['POST'])
@login_required
@permission_required(['admin', 'operador'])
def importar_motoristas():
    if 'arquivo' not in request.files: return jsonify({"error": "Nenhum arquivo"}), 400
    arquivo = request.files['arquivo']; df = None
    try:
        try: arquivo.seek(0); df = pd.read_excel(arquivo, header=None, engine='openpyxl')
        except:
            try: arquivo.seek(0); df = pd.read_excel(arquivo, header=None)
            except:
                try: arquivo.seek(0); df = pd.read_csv(arquivo, header=None, sep=';'); assert len(df.columns) >= 2
                except: arquivo.seek(0); df = pd.read_csv(arquivo, header=None); assert len(df.columns) >= 2
        if df is None: return jsonify({"error": "Não leu."}), 500
        if len(df.columns) < 2: return jsonify({"error": "Formato inválido A(cod) B(nome)."}), 400
        df = df.iloc[:, [0, 1]]; df.columns = ['codigo', 'nome']; novos = 0; ignorados = 0
        for _, row in df.iterrows():
            if pd.isna(row['nome']): continue
            cod = str(row['codigo']) if not pd.isna(row['codigo']) else None; nom = str(row['nome']).upper()
            if Motorista.query.filter_by(nome=nom).first() or (cod and Motorista.query.filter_by(codigo=cod).first()): ignorados += 1; continue
            novo = Motorista(codigo=cod, nome=nom); db.session.add(novo); novos += 1
        db.session.commit()
        return jsonify({"message": f"{novos} motoristas importados! ({ignorados} ignorados)"}), 200
    except Exception as e: db.session.rollback(); print(f"ERR Import Mot: {e}"); traceback.print_exc(); return jsonify({"error": f"Erro: {e}"}), 500

@app.route('/api/veiculos/import', methods=['POST'])
@login_required
@permission_required(['admin', 'operador'])
def importar_veiculos():
    if 'arquivo' not in request.files: return jsonify({"error": "Nenhum arquivo"}), 400
    arquivo = request.files['arquivo']; df = None
    try:
        try: arquivo.seek(0); df = pd.read_excel(arquivo, header=None, engine='openpyxl')
        except:
            try: arquivo.seek(0); df = pd.read_excel(arquivo, header=None)
            except:
                try: arquivo.seek(0); df = pd.read_csv(arquivo, header=None, sep=';'); assert len(df.columns) >= 1
                except: arquivo.seek(0); df = pd.read_csv(arquivo, header=None); assert len(df.columns) >= 1
        if df is None: return jsonify({"error": "Não leu."}), 500
        if len(df.columns) < 1: return jsonify({"error": "Formato inválido A(placa)."}), 400
        df = df.iloc[:, [0]]; df.columns = ['placa']; novos = 0; ignorados = 0
        for _, row in df.iterrows():
            if pd.isna(row['placa']): continue
            placa = str(row['placa']).upper().replace('-', '').replace(' ', '')
            if not Veiculo.query.filter_by(placa=placa).first(): novo = Veiculo(placa=placa); db.session.add(novo); novos += 1
            else: ignorados += 1
        db.session.commit()
        return jsonify({"message": f"{novos} veículos importados! ({ignorados} ignorados)"}), 200
    except Exception as e: db.session.rollback(); print(f"ERR Import Veic: {e}"); traceback.print_exc(); return jsonify({"error": f"Erro: {e}"}), 500


# --- API DE CARGAS E ENTREGAS ---
@app.route('/api/cargas', methods=['GET', 'POST'])
@login_required
def gerenciar_cargas():
    if request.method == 'POST':
        if session['user_permission'] not in ['admin', 'operador']: return jsonify({"error": "Permissão negada"}), 403
        dados = request.json
        nova_carga = Carga(codigo_carga=f"CARGA-{int(time.time())}", origem=dados['origem'].upper(), status='Pendente')
        db.session.add(nova_carga); db.session.commit()
        return jsonify({'id': nova_carga.id, 'codigo_carga': nova_carga.codigo_carga, 'origem': nova_carga.origem, 'status': nova_carga.status, 'num_entregas': 0, 'peso_total': 0, 'frete_total': 0, 'motorista': None, 'placa': None, 'destino': None, 'destino_uf': None}), 201
    # GET
    try:
        base_query = Carga.query.filter(Carga.status != 'Rascunho')
        try:
            cargas_pendentes_db = base_query.filter(Carga.status == 'Pendente').order_by(Carga.id.desc()).all()
            cargas_agendadas_db = base_query.filter(Carga.status == 'Agendada').order_by(db.func.coalesce(Carga.data_agendamento, '9999-12-31'), Carga.id.desc()).all()
            cargas_em_transito_db = base_query.filter(Carga.status == 'Em Trânsito').order_by(db.func.coalesce(Carga.previsao_entrega, '9999-12-31'), Carga.id.desc()).all()
        except Exception as query_err: print(f"!!! ERRO query /api/cargas: {query_err}"); traceback.print_exc(); return jsonify({"error": f"Erro query: {query_err}"}), 500
        cargas_ativas = cargas_pendentes_db + cargas_agendadas_db + cargas_em_transito_db; cargas_lista = []
        for i, carga in enumerate(cargas_ativas):
            try:
                peso_total = sum(e.peso_bruto for e in carga.entregas if e and e.peso_bruto is not None)
                frete_total = sum(e.valor_frete for e in carga.entregas if e and e.valor_frete is not None)
                destino = None; destino_uf = None
                destino_entrega = next((e for e in carga.entregas if e and e.is_last_delivery == 1), None)
                if destino_entrega:
                    cliente_destino = destino_entrega.cliente
                    if cliente_destino: destino = destino_entrega.cidade_entrega or cliente_destino.cidade; destino_uf = destino_entrega.estado_entrega or cliente_destino.estado
                    else: print(f"!!! WARN: [Carga ID: {carga.id}] Cliente destino (ID: {destino_entrega.cliente_id}) não encontrado."); destino = destino_entrega.cidade_entrega or "Cliente Inválido"; destino_uf = destino_entrega.estado_entrega or "XX"
                carga_dict = {'id': carga.id, 'codigo_carga': carga.codigo_carga, 'origem': carga.origem, 'status': carga.status, 'motorista': carga.motorista_rel.nome if carga.motorista_rel else None, 'placa': carga.veiculo_rel.placa if carga.veiculo_rel else None, 'data_agendamento': carga.data_agendamento, 'data_carregamento': carga.data_carregamento, 'previsao_entrega': carga.previsao_entrega, 'observacoes': carga.observacoes, 'data_finalizacao': carga.data_finalizacao, 'num_entregas': len(carga.entregas) if carga.entregas else 0, 'peso_total': peso_total, 'frete_total': frete_total, 'destino': destino, 'destino_uf': destino_uf}
                cargas_lista.append(carga_dict)
            except Exception as carga_proc_err: print(f"!!! ERRO processar Carga ID {carga.id}: {carga_proc_err}"); traceback.print_exc()
        return jsonify(cargas_lista)
    except Exception as e: print(f"!!! ERRO GERAL /api/cargas GET: {e}"); traceback.print_exc(); return jsonify({"error": f"Erro: {e}"}), 500

@app.route('/api/cargas/consulta', methods=['GET'])
@login_required
def consultar_cargas():
    try:
        args = request.args; page = args.get('page', 1, type=int); per_page = 10
        query = Carga.query.filter(Carga.status != 'Rascunho')
        if args.get('codigo_carga'): query = query.filter(Carga.codigo_carga.like(f"%{args.get('codigo_carga').upper()}%"))
        if args.get('status'): query = query.filter(Carga.status == args.get('status'))
        if args.get('motorista'): query = query.join(Motorista, Carga.motorista_id == Motorista.id).filter(Motorista.nome.like(f"%{args.get('motorista').upper()}%"))
        if args.get('origem'): query = query.filter(Carga.origem.like(f"%{args.get('origem').upper()}%"))
        if args.get('placa'): query = query.join(Veiculo, Carga.veiculo_id == Veiculo.id).filter(Veiculo.placa.like(f"%{args.get('placa').upper()}%"))
        if args.get('data_finalizacao_inicio') and args.get('data_finalizacao_fim'): query = query.filter(Carga.data_finalizacao.between(args.get('data_finalizacao_inicio'), args.get('data_finalizacao_fim')))
        if args.get('data_carregamento_inicio') and args.get('data_carregamento_fim'): query = query.filter(Carga.data_carregamento.between(args.get('data_carregamento_inicio'), args.get('data_carregamento_fim')))
        if args.get('cliente_id'): query = query.join(Entrega, Carga.id == Entrega.carga_id).filter(Entrega.cliente_id == args.get('cliente_id'))
        pagination = query.order_by(Carga.id.desc()).paginate(page=page, per_page=per_page, error_out=False)
        cargas = pagination.items; cargas_lista = []
        for carga in cargas:
            destino = None; destino_uf = None
            destino_entrega = next((e for e in carga.entregas if e.is_last_delivery == 1), None)
            if destino_entrega and destino_entrega.cliente: destino = destino_entrega.cidade_entrega or destino_entrega.cliente.cidade; destino_uf = destino_entrega.estado_entrega or destino_entrega.cliente.estado
            peso_total = sum(e.peso_bruto for e in carga.entregas if e.peso_bruto)
            cargas_lista.append({'id': carga.id, 'codigo_carga': carga.codigo_carga, 'origem': carga.origem, 'status': carga.status, 'motorista': carga.motorista_rel.nome if carga.motorista_rel else None, 'data_finalizacao': carga.data_finalizacao, 'num_entregas': len(carga.entregas), 'peso_total': peso_total, 'destino': destino, 'destino_uf': destino_uf})
        return jsonify({'cargas': cargas_lista, 'total_paginas': pagination.pages, 'pagina_atual': page, 'total_resultados': pagination.total})
    except Exception as e: print(f"!!! ERRO /api/cargas/consulta GET: {e}"); traceback.print_exc(); return jsonify({"error": f"Erro: {e}"}), 500

@app.route('/api/cargas/<int:carga_id>', methods=['GET'])
@login_required
def get_detalhes_carga(carga_id):
    try:
        carga = Carga.query.get(carga_id)
        if not carga: return jsonify({"error": "Carga não encontrada"}), 404
        detalhes_carga = {c.name: getattr(carga, c.name) for c in carga.__table__.columns}; detalhes_carga['motorista_nome'] = carga.motorista_rel.nome if carga.motorista_rel else None; detalhes_carga['veiculo_placa'] = carga.veiculo_rel.placa if carga.veiculo_rel else None; entregas_lista = []
        for e in carga.entregas:
            cliente = e.cliente; remetente = e.remetente
            cidade = e.cidade_entrega or (cliente.cidade if cliente else 'N/A'); estado = e.estado_entrega or (cliente.estado if cliente else 'N/A')
            entrega_data = {'id': e.id, 'carga_id': e.carga_id, 'cliente_id': e.cliente_id, 'remetente_id': e.remetente_id, 'peso_bruto': e.peso_bruto, 'valor_frete': e.valor_frete, 'peso_cubado': e.peso_cubado, 'nota_fiscal': e.nota_fiscal, 'is_last_delivery': e.is_last_delivery, 'razao_social': cliente.razao_social if cliente else 'Cliente não encontrado', 'cidade': cidade, 'estado': estado, 'cidade_entrega_override': e.cidade_entrega, 'estado_entrega_override': e.estado_entrega, 'ddd': cliente.ddd if cliente else '', 'telefone': cliente.telefone if cliente else '', 'obs_cliente': cliente.observacoes if cliente else '', 'remetente_nome': remetente.razao_social if remetente else 'Remetente não encontrado', 'remetente_cidade': remetente.cidade if remetente else 'N/A'}
            entregas_lista.append(entrega_data)
        return jsonify({"detalhes_carga": detalhes_carga, "entregas": sorted(entregas_lista, key=lambda x: x['razao_social'])})
    except Exception as e: print(f"!!! ERRO /api/cargas/{carga_id} GET: {e}"); traceback.print_exc(); return jsonify({"error": f"Erro: {e}"}), 500

@app.route('/api/cargas/<int:carga_id>/entregas', methods=['POST', 'DELETE'])
@login_required
@permission_required(['admin', 'operador'])
def gerenciar_entregas(carga_id):
    if request.method == 'POST':
        dados = request.json;
        if not dados.get('cliente_id') or dados.get('peso_bruto') is None: return jsonify({"error": "Cliente e Peso Bruto obrigatórios"}), 400
        remetente_padrao = Cliente.query.filter_by(codigo_cliente='000-REMETENTE-V1').first()
        if not remetente_padrao: return jsonify({"error": "Remetente padrão (000-REMETENTE-V1) não encontrado."}), 400
        nova_entrega = Entrega(carga_id=carga_id, cliente_id=dados['cliente_id'], remetente_id=remetente_padrao.id, peso_bruto=dados.get('peso_bruto'), valor_frete=dados.get('valor_frete'))
        db.session.add(nova_entrega); db.session.commit()
        return jsonify({"message": "Entrega (V1) adicionada"}), 201
    if request.method == 'DELETE':
        entrega_id = request.json.get('entrega_id'); entrega = Entrega.query.get(entrega_id)
        if entrega and entrega.carga_id == carga_id:
            try: entrega.carga_id = None; entrega.is_last_delivery = 0; db.session.commit(); return jsonify({"message": "Entrega removida da carga e devolvida para 'Disponíveis'."}), 200
            except Exception as e: db.session.rollback(); return jsonify({"error": f"Erro ao desvincular entrega: {e}"}), 500
        return jsonify({"error": "Entrega não encontrada nesta carga"}), 404

@app.route('/api/cargas/<int:carga_id>/status', methods=['PUT'])
@login_required
def atualizar_status_carga(carga_id):
    carga = Carga.query.get_or_404(carga_id); dados = request.json; permissao_usuario = session['user_permission']
    if 'status' in dados:
        permissoes = {'Rascunho': ['admin', 'operador'], 'Pendente': ['admin', 'operador'], 'Agendada': ['admin', 'operador'], 'Em Trânsito': ['admin', 'operador'], 'Finalizada': ['admin', 'operador']}
        if permissao_usuario not in permissoes.get(dados['status'], []): return jsonify({"error": "Permissão negada"}), 403
    if 'motorista_id' in dados: setattr(carga, 'motorista_id', dados.pop('motorista_id') or None)
    if 'veiculo_id' in dados: setattr(carga, 'veiculo_id', dados.pop('veiculo_id') or None)
    if 'motorista' in dados: dados.pop('motorista')
    if 'placa' in dados: dados.pop('placa')
    for key, value in dados.items():
        if hasattr(carga, key):
            if key in ['origem'] and value is not None: value = value.upper()
            if key in ['frete_pago'] and value == '': value = None
            setattr(carga, key, value)
    db.session.commit(); return jsonify({"message": "Carga atualizada"}), 200

# ***** INÍCIO DA ALTERAÇÃO *****
@app.route('/api/entregas/<int:entrega_id>', methods=['PUT'])
@login_required
@permission_required(['admin', 'operador'])
def atualizar_entrega(entrega_id): # Atualiza entrega individual (V1 ou Disponível)
    entrega = Entrega.query.get_or_404(entrega_id)
    dados = request.json
    
    if 'is_last_delivery' in dados and dados['is_last_delivery'] == 1 and entrega.carga_id: # Só faz sentido se a entrega está numa carga
        Entrega.query.filter(Entrega.carga_id == entrega.carga_id, Entrega.id != entrega_id).update({'is_last_delivery': 0})
        entrega.is_last_delivery = 1
        dados.pop('is_last_delivery')
        
    if 'cidade_entrega' in dados or 'estado_entrega' in dados:
        if session['user_permission'] != 'admin':
            return jsonify({"error": "Apenas admin pode alterar local."}), 403
        entrega.cidade_entrega = dados.pop('cidade_entrega', None) or None
        entrega.estado_entrega = dados.pop('estado_entrega', None) or None
        
    # --- Linha Nova ---
    # Permite que 'operador' ou 'admin' alterem o remetente
    if 'remetente_id' in dados:
        entrega.remetente_id = dados.pop('remetente_id')
    # --- Fim da Linha Nova ---
        
    if 'peso_cobrado' in dados:
        dados.pop('peso_cobrado') # Ignora peso cobrado
        
    for key, value in dados.items():
        if hasattr(entrega, key):
            if key in ['peso_bruto', 'valor_frete', 'peso_cubado'] and value == '':
                value = None
            setattr(entrega, key, value)
            
    if entrega.peso_bruto is None or entrega.peso_bruto == '':
        return jsonify({"error": "Peso Bruto obrigatório"}), 400
        
    db.session.commit()
    return jsonify({"message": "Entrega atualizada"}), 200
# ***** FIM DA ALTERAÇÃO *****


# --- INÍCIO MÓDULO 3: APIs da Montagem de Carga ---
@app.route('/api/entregas/disponiveis', methods=['GET', 'POST'])
@login_required
@permission_required(['admin', 'operador'])
def gerenciar_entregas_disponiveis():
    if request.method == 'POST':
        dados = request.json
        if not all(k in dados for k in ['remetente_id', 'cliente_id', 'peso_bruto']): return jsonify({"error": "Remetente, Destinatário e Peso Bruto são obrigatórios."}), 400
        try:
            nova_entrega = Entrega(carga_id=None, remetente_id=dados['remetente_id'], cliente_id=dados['cliente_id'], peso_bruto=dados.get('peso_bruto'), valor_frete=dados.get('valor_frete'), peso_cubado=dados.get('peso_cubado'), nota_fiscal=dados.get('nota_fiscal'), cidade_entrega=dados.get('cidade_entrega'), estado_entrega=dados.get('estado_entrega'))
            db.session.add(nova_entrega); db.session.commit()
            return jsonify({"message": "Entrega adicionada à lista de disponíveis!"}), 201
        except Exception as e: db.session.rollback(); print(f"Erro ao criar entrega disponível: {e}"); traceback.print_exc(); return jsonify({"error": f"Erro ao salvar no banco: {e}"}), 500
    # GET
    try:
        entregas_db = Entrega.query.options(joinedload(Entrega.cliente), joinedload(Entrega.remetente)).filter(Entrega.carga_id == None).order_by(Entrega.id.desc()).all()
        entregas_lista = []
        for e in entregas_db:
            cliente = e.cliente; remetente = e.remetente
            cidade = e.cidade_entrega or (cliente.cidade if cliente else 'N/A'); estado = e.estado_entrega or (cliente.estado if cliente else 'N/A')
            entregas_lista.append({'id': e.id, 'remetente_id': e.remetente_id, 'cliente_id': e.cliente_id, 'remetente_nome': remetente.razao_social if remetente else 'Remetente Inválido', 'destinatario_nome': cliente.razao_social if cliente else 'Cliente Inválido', 'cidade_entrega': cidade, 'estado_entrega': estado, 'cidade_entrega_override': e.cidade_entrega, 'estado_entrega_override': e.estado_entrega, 'peso_bruto': e.peso_bruto, 'valor_frete': e.valor_frete, 'peso_cubado': e.peso_cubado, 'nota_fiscal': e.nota_fiscal})
        return jsonify(entregas_lista)
    except Exception as e: print(f"Erro ao buscar entregas disponíveis: {e}"); traceback.print_exc(); return jsonify({"error": f"Erro ao buscar: {e}"}), 500

@app.route('/api/entregas/disponiveis/<int:entrega_id>', methods=['DELETE'])
@login_required
@permission_required(['admin', 'operador'])
def excluir_entrega_disponivel(entrega_id):
    entrega = Entrega.query.filter_by(id=entrega_id, carga_id=None).first_or_404()
    try: db.session.delete(entrega); db.session.commit(); return jsonify({"message": "Entrega disponível excluída com sucesso."}), 200
    except Exception as e: db.session.rollback(); print(f"Erro ao excluir entrega disponível {entrega_id}: {e}"); traceback.print_exc(); return jsonify({"error": f"Erro ao excluir: {e}"}), 500

@app.route('/api/cargas/montar', methods=['POST'])
@login_required
@permission_required(['admin', 'operador'])
def montar_carga_rascunho():
    dados = request.json
    if not dados.get('origem') or not dados.get('entrega_ids'): return jsonify({"error": "Origem Principal e IDs das Entregas são obrigatórios."}), 400
    entrega_ids = dados['entrega_ids']
    if not isinstance(entrega_ids, list) or len(entrega_ids) == 0: return jsonify({"error": "Nenhuma entrega selecionada."}), 400
    try:
        nova_carga = Carga(codigo_carga=f"RASC-{int(time.time())}", origem=dados['origem'].upper(), status='Rascunho')
        db.session.add(nova_carga); db.session.flush()
        num_atualizadas = Entrega.query.filter(Entrega.id.in_(entrega_ids), Entrega.carga_id == None).update({'carga_id': nova_carga.id}, synchronize_session=False)
        if num_atualizadas != len(entrega_ids):
            db.session.rollback()
            entregas_encontradas = Entrega.query.filter(Entrega.id.in_(entrega_ids)).all()
            ids_encontrados = {e.id for e in entregas_encontradas}; ids_invalidos = [eid for eid in entrega_ids if eid not in ids_encontrados]; ids_ja_usados = [e.id for e in entregas_encontradas if e.carga_id is not None]
            error_msg = "Algumas entregas não puderam ser adicionadas:"
            if ids_invalidos: error_msg += f" IDs não encontrados: {ids_invalidos}."
            if ids_ja_usados: error_msg += f" IDs já pertencem a outra carga: {ids_ja_usados}."
            return jsonify({"error": error_msg}), 409
        db.session.commit()
        return jsonify({"message": f"Rascunho {nova_carga.codigo_carga} salvo com {num_atualizadas} entregas!"}), 201
    except Exception as e: db.session.rollback(); print(f"Erro ao montar rascunho: {e}"); traceback.print_exc(); return jsonify({"error": f"Erro ao salvar rascunho: {e}"}), 500

@app.route('/api/cargas/rascunhos', methods=['GET'])
@login_required
@permission_required(['admin', 'operador'])
def get_rascunhos():
    try:
        rascunhos_db = db.session.query(Carga.id, Carga.codigo_carga, Carga.origem, func.count(Entrega.id).label('num_entregas')).outerjoin(Entrega, Carga.id == Entrega.carga_id).filter(Carga.status == 'Rascunho').group_by(Carga.id, Carga.codigo_carga, Carga.origem).order_by(Carga.id.desc()).all()
        rascunhos_lista = [{'id': r.id, 'codigo_carga': r.codigo_carga, 'origem': r.origem, 'num_entregas': r.num_entregas} for r in rascunhos_db]
        return jsonify(rascunhos_lista)
    except Exception as e: print(f"Erro ao buscar rascunhos: {e}"); traceback.print_exc(); return jsonify({"error": f"Erro ao buscar rascunhos: {e}"}), 500

@app.route('/api/cargas/<int:carga_id>/confirmar', methods=['PUT'])
@login_required
@permission_required(['admin', 'operador'])
def confirmar_rascunho(carga_id):
    carga = Carga.query.filter_by(id=carga_id, status='Rascunho').first_or_404()
    try: carga.status = 'Pendente'; carga.codigo_carga = f"CARGA-{int(time.time())}"; db.session.commit(); return jsonify({"message": f"Carga {carga.codigo_carga} confirmada e movida para Pendentes!"}), 200
    except Exception as e: db.session.rollback(); print(f"Erro ao confirmar rascunho {carga_id}: {e}"); traceback.print_exc(); return jsonify({"error": f"Erro ao confirmar: {e}"}), 500

@app.route('/api/cargas/<int:carga_id>/devolver-rascunho', methods=['PUT'])
@login_required
@permission_required(['admin', 'operador'])
def devolver_para_rascunho(carga_id):
    carga = Carga.query.get_or_404(carga_id)
    if carga.status not in ['Pendente', 'Agendada']: return jsonify({"error": "Apenas cargas Pendentes ou Agendadas podem ser devolvidas."}), 400
    try:
        carga.status = 'Rascunho'; carga.codigo_carga = f"RASC-{int(time.time())}"; carga.motorista_id = None; carga.veiculo_id = None; carga.data_agendamento = None; carga.data_carregamento = None; carga.previsao_entrega = None
        db.session.commit()
        return jsonify({"message": "Carga devolvida para 'Rascunho'. Redirecionando para a tela de Montagem..."}), 200
    except Exception as e: db.session.rollback(); print(f"Erro ao devolver carga {carga_id} para rascunho: {e}"); traceback.print_exc(); return jsonify({"error": f"Erro ao devolver para rascunho: {e}"}), 500

@app.route('/api/cargas/<int:carga_id>/rascunho', methods=['DELETE'])
@login_required
@permission_required(['admin', 'operador'])
def excluir_rascunho(carga_id):
    carga = Carga.query.filter_by(id=carga_id, status='Rascunho').first_or_404()
    try: Entrega.query.filter_by(carga_id=carga.id).update({'carga_id': None}); db.session.delete(carga); db.session.commit(); return jsonify({"message": f"Rascunho {carga.codigo_carga} excluído e entregas liberadas."}), 200
    except Exception as e: db.session.rollback(); print(f"Erro ao excluir rascunho {carga_id}: {e}"); traceback.print_exc(); return jsonify({"error": f"Erro ao excluir: {e}"}), 500
# --- FIM MÓDULO 3 ---

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
    if not all(k in dados for k in ['nome_usuario', 'senha', 'permissao']): return jsonify({"error": "Campos obrigatórios"}), 400
    if Usuario.query.filter_by(nome_usuario=dados['nome_usuario']).first(): return jsonify({"error": "Usuário já existe"}), 409
    novo = Usuario(nome_usuario=dados['nome_usuario'], senha_hash=generate_password_hash(dados['senha']), permissao=dados['permissao'])
    db.session.add(novo); db.session.commit()
    return jsonify({"message": "Usuário criado"}), 201

@app.route('/api/usuarios/<int:user_id>', methods=['PUT', 'DELETE'])
@login_required
@permission_required(['admin'])
def gerenciar_usuario_especifico(user_id):
    if user_id == 1: return jsonify({"error": "Admin principal não pode ser modificado"}), 403
    usuario = Usuario.query.get_or_404(user_id)
    if request.method == 'PUT':
        dados = request.json
        if not all(k in dados for k in ['nome_usuario', 'permissao']): return jsonify({"error": "Nome e permissão obrigatórios"}), 400
        if Usuario.query.filter(Usuario.nome_usuario == dados['nome_usuario'], Usuario.id != user_id).first(): return jsonify({"error": "Nome de usuário em uso"}), 409
        usuario.nome_usuario = dados['nome_usuario']; usuario.permissao = dados['permissao']
        if 'senha' in dados and dados['senha']: usuario.senha_hash = generate_password_hash(dados['senha'])
        db.session.commit(); return jsonify({"message": "Usuário atualizado"})
    elif request.method == 'DELETE':
        db.session.delete(usuario); db.session.commit(); return jsonify({"message": "Usuário excluído"})

# --- PONTO DE ENTRADA ---
if __name__ == '__main__':
    with app.app_context():
        inspector = db.inspect(db.engine)
        if inspector.has_table(Usuario.__tablename__):
            if not Usuario.query.first(): admin_user = Usuario(nome_usuario='admin', senha_hash=generate_password_hash('admin'), permissao='admin'); db.session.add(admin_user); db.session.commit(); print("Usuário 'admin' criado.")
        else: print("Tabela 'usuarios' não encontrada. Execute 'flask db upgrade'.")
    app.run(debug=True, port=5001)