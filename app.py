import sqlite3
import time
import pandas as pd
import math # Importamos a biblioteca math para o cálculo de páginas
import os
from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

app = Flask(__name__)
app.secret_key = 'sua-chave-secreta-muito-segura-aqui-12345'

if os.name == 'nt':
    # Estamos no ambiente local (Windows)
    DATABASE = 'cargas.db'
else:
    # Estamos no ambiente de produção (Linux/PythonAnywhere)
    DATABASE = '/home/ruanbnunes/cargas.db'

# --- Funções de Banco de Dados e Autenticação ---

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

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

# --- Rotas de Páginas e Arquivos Estáticos ---

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
@permission_required(['admin', 'operador'])
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

# --- API de Autenticação ---

@app.route('/api/login', methods=['POST'])
def login_api():
    dados = request.json
    db = get_db()
    user = db.execute('SELECT * FROM usuarios WHERE nome_usuario = ?', (dados.get('nome_usuario'),)).fetchone()
    db.close()
    if user and check_password_hash(user['senha_hash'], dados.get('senha')):
        session.clear()
        session['user_id'] = user['id']
        session['user_name'] = user['nome_usuario']
        session['user_permission'] = user['permissao']
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
    db = get_db()
    user = db.execute('SELECT senha_hash FROM usuarios WHERE id = ?', (session['user_id'],)).fetchone()
    db.close()
    if user and check_password_hash(user['senha_hash'], password_to_check):
        return jsonify({"success": True})
    return jsonify({"success": False}), 401

# --- API de Clientes ---

@app.route('/api/clientes', methods=['GET'])
@login_required
def get_clientes():
    db = get_db()
    clientes = [dict(row) for row in db.execute('SELECT * FROM clientes ORDER BY razao_social').fetchall()]
    db.close()
    return jsonify(clientes)

@app.route('/api/clientes/import', methods=['POST'])
@login_required
@permission_required(['admin', 'operador'])
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
        db = get_db()
        cursor = db.cursor()
        novos_clientes = 0
        for _, row in df.iterrows():
            if pd.isna(row['codigo_cliente']): continue
            codigo_str = str(int(row['codigo_cliente']))
            ddd_str = ''
            if not pd.isna(row['ddd']):
                try: ddd_str = str(int(row['ddd']))
                except (ValueError, TypeError): ddd_str = str(row['ddd'])
            cursor.execute("SELECT id FROM clientes WHERE codigo_cliente = ?", (codigo_str,))
            if cursor.fetchone() is None:
                cursor.execute(
                    "INSERT INTO clientes (codigo_cliente, razao_social, ddd, telefone, cidade, estado, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (codigo_str, row['razao_social'], ddd_str, str(row['telefone']), row['cidade'], row['estado'], None)
                )
                novos_clientes += 1
        db.commit()
        db.close()
        return jsonify({"message": f"{novos_clientes} novos clientes importados!"}), 200
    except Exception as e:
        return jsonify({"error": f"Ocorreu um erro inesperado: {e}"}), 500

@app.route('/api/clientes/<int:cliente_id>', methods=['PUT'])
@login_required
@permission_required(['admin', 'operador'])
def atualizar_cliente(cliente_id):
    dados = request.json
    if not dados.get('razao_social') or not dados.get('cidade'): return jsonify({"error": "Razão Social e Cidade são obrigatórios"}), 400
    db = get_db()
    db.execute(
        'UPDATE clientes SET razao_social = ?, ddd = ?, telefone = ?, cidade = ?, estado = ?, observacoes = ? WHERE id = ?',
        (dados['razao_social'], dados.get('ddd'), dados.get('telefone'), dados['cidade'], dados.get('estado'), dados.get('observacoes'), cliente_id)
    )
    db.commit()
    db.close()
    return jsonify({"message": "Cliente atualizado com sucesso"}), 200

# --- API de Cargas ---

@app.route('/api/cargas', methods=['GET', 'POST'])
@login_required
def gerenciar_cargas():
    if request.method == 'POST':
        if session['user_permission'] not in ['admin', 'operador']: return jsonify({"error": "Permissão negada"}), 403
        dados = request.json
        codigo_carga = f"CARGA-{int(time.time())}"
        db = get_db()
        db.execute('INSERT INTO cargas (codigo_carga, origem) VALUES (?, ?)', (codigo_carga, dados['origem']))
        db.commit()
        nova_carga = dict(db.execute('SELECT * FROM cargas WHERE codigo_carga = ?', (codigo_carga,)).fetchone())
        db.close()
        return jsonify(nova_carga), 201

    db = get_db()
    cargas = [dict(row) for row in db.execute('''
        SELECT c.*, COUNT(e.id) as num_entregas, SUM(e.peso_bruto) as peso_total, SUM(e.valor_frete) as frete_total
        FROM cargas c LEFT JOIN entregas e ON c.id = e.carga_id
        WHERE c.status != 'Finalizada'
        GROUP BY c.id ORDER BY c.id DESC
    ''').fetchall()]
    db.close()
    return jsonify(cargas)

# <<<< ROTA DE CONSULTA ATUALIZADA COM PAGINAÇÃO >>>>
@app.route('/api/cargas/consulta', methods=['GET'])
@login_required
def consultar_cargas():
    args = request.args
    page = args.get('page', 1, type=int)
    per_page = 10
    offset = (page - 1) * per_page

    base_query = "FROM cargas c"
    count_query = "SELECT COUNT(DISTINCT c.id) as total "

    conditions = []
    params = []

    if args.get('codigo_carga'):
        conditions.append("c.codigo_carga LIKE ?")
        params.append(f"%{args.get('codigo_carga').upper()}%")
    if args.get('status'):
        conditions.append("c.status = ?")
        params.append(args.get('status'))
    if args.get('motorista'):
        conditions.append("c.motorista LIKE ?")
        params.append(f"%{args.get('motorista').upper()}%")
    if args.get('origem'):
        conditions.append("c.origem LIKE ?")
        params.append(f"%{args.get('origem').upper()}%")
    if args.get('data_inicio') and args.get('data_fim'):
        conditions.append("date(c.data_finalizacao) BETWEEN ? AND ?")
        params.extend([args.get('data_inicio'), args.get('data_fim')])

    if conditions:
        base_query += " WHERE " + " AND ".join(conditions)

    db = get_db()

    # Executa a query para contar o total de resultados
    total_results = db.execute(count_query + base_query, params).fetchone()['total']
    total_paginas = math.ceil(total_results / per_page)

    # Executa a query principal com JOIN, GROUP BY e paginação
    main_query = f"""
        SELECT c.*, COUNT(e.id) as num_entregas, SUM(e.peso_bruto) as peso_total
        {base_query}
        LEFT JOIN entregas e ON c.id = e.carga_id
        GROUP BY c.id ORDER BY c.id DESC
        LIMIT ? OFFSET ?
    """

    paginated_params = params + [per_page, offset]
    cargas = [dict(row) for row in db.execute(main_query, paginated_params).fetchall()]

    db.close()

    return jsonify({
        'cargas': cargas,
        'total_paginas': total_paginas,
        'pagina_atual': page
    })


@app.route('/api/cargas/<int:carga_id>', methods=['GET'])
@login_required
def get_detalhes_carga(carga_id):
    db = get_db()
    carga_info = db.execute('SELECT * FROM cargas WHERE id = ?', (carga_id,)).fetchone()
    if carga_info is None: db.close(); return jsonify({"error": "Carga não encontrada"}), 404
    entregas_lista = [dict(row) for row in db.execute('''
        SELECT e.*, cl.razao_social, cl.cidade, cl.estado, cl.ddd, cl.telefone, cl.observacoes as obs_cliente
        FROM entregas e JOIN clientes cl ON e.cliente_id = cl.id WHERE e.carga_id = ?
    ''', (carga_id,)).fetchall()]
    db.close()
    return jsonify({"detalhes_carga": dict(carga_info), "entregas": entregas_lista})

@app.route('/api/cargas/<int:carga_id>/entregas', methods=['POST', 'DELETE'])
@login_required
@permission_required(['admin', 'operador'])
def gerenciar_entregas(carga_id):
    db = get_db()
    if request.method == 'POST':
        dados = request.json
        if not dados.get('cliente_id') or dados.get('peso_bruto') is None:
            db.close()
            return jsonify({"error": "Cliente e Peso Bruto são obrigatórios"}), 400
        db.execute(
            'INSERT INTO entregas (carga_id, cliente_id, peso_bruto, valor_frete, peso_cobrado) VALUES (?, ?, ?, ?, ?)',
            (carga_id, dados['cliente_id'], dados['peso_bruto'], dados.get('valor_frete'), dados.get('peso_cobrado'))
        )
        db.commit()
        db.close()
        return jsonify({"message": "Entrega adicionada com sucesso"}), 201

    if request.method == 'DELETE':
        entrega_id = request.json.get('entrega_id')
        db.execute('DELETE FROM entregas WHERE id = ? AND carga_id = ?', (entrega_id, carga_id))
        db.commit()
        db.close()
        return jsonify({"message": "Entrega excluída com sucesso"}), 200

@app.route('/api/cargas/<int:carga_id>/status', methods=['PUT'])
@login_required
def atualizar_status_carga(carga_id):
    dados = request.json
    novo_status = dados.get('status')
    permissao_usuario = session['user_permission']

    if novo_status:
        permissoes_necessarias = {
            'Agendada': ['admin', 'operador'], 'Em Trânsito': ['admin', 'operador'],
            'Finalizada': ['admin', 'operador', 'rastreador'], 'Pendente': ['admin', 'operador']
        }
        if permissao_usuario not in permissoes_necessarias.get(novo_status, []):
            return jsonify({"error": "Permissão negada para esta ação"}), 403

    motorista = dados.get('motorista')
    if motorista is not None: motorista = motorista.upper()
    placa = dados.get('placa')
    if placa is not None: placa = placa.upper()

    db = get_db()
    campos_para_atualizar = {}
    if novo_status: campos_para_atualizar['status'] = novo_status
    if 'origem' in dados: campos_para_atualizar['origem'] = dados['origem']
    if 'data_agendamento' in dados: campos_para_atualizar['data_agendamento'] = dados.get('data_agendamento')
    if 'motorista' in dados: campos_para_atualizar['motorista'] = motorista
    if 'placa' in dados: campos_para_atualizar['placa'] = placa
    if 'data_carregamento' in dados: campos_para_atualizar['data_carregamento'] = dados.get('data_carregamento')
    if 'previsao_entrega' in dados: campos_para_atualizar['previsao_entrega'] = dados.get('previsao_entrega')
    if 'observacoes' in dados: campos_para_atualizar['observacoes'] = dados.get('observacoes')
    if 'data_finalizacao' in dados: campos_para_atualizar['data_finalizacao'] = dados.get('data_finalizacao')

    if not campos_para_atualizar: return jsonify({"error": "Nenhum dado para atualizar"}), 400

    query_set = ", ".join([f"{campo} = ?" for campo in campos_para_atualizar])
    valores = list(campos_para_atualizar.values())
    valores.append(carga_id)

    db.execute(f'UPDATE cargas SET {query_set} WHERE id = ?', valores)
    db.commit()
    db.close()
    return jsonify({"message": "Carga atualizada com sucesso"}), 200

# --- API de Usuários ---

@app.route('/api/usuarios', methods=['GET'])
@login_required
@permission_required(['admin', 'operador'])
def get_usuarios():
    db = get_db()
    usuarios = [dict(row) for row in db.execute('SELECT id, nome_usuario, permissao FROM usuarios ORDER BY nome_usuario').fetchall()]
    db.close()
    return jsonify(usuarios)

@app.route('/api/usuarios', methods=['POST'])
@login_required
@permission_required(['admin', 'operador'])
def criar_usuario():
    dados = request.json
    nome_usuario = dados.get('nome_usuario')
    senha = dados.get('senha')
    permissao = dados.get('permissao')

    if not nome_usuario or not senha or not permissao:
        return jsonify({"error": "Todos os campos são obrigatórios"}), 400
    db = get_db()
    cursor = db.cursor()
    existente = cursor.execute('SELECT id FROM usuarios WHERE nome_usuario = ?', (nome_usuario,)).fetchone()
    if existente:
        db.close()
        return jsonify({"error": "Este nome de usuário já está em uso"}), 409
    senha_hash = generate_password_hash(senha)
    cursor.execute(
        "INSERT INTO usuarios (nome_usuario, senha_hash, permissao) VALUES (?, ?, ?)",
        (nome_usuario, senha_hash, permissao)
    )
    db.commit()
    db.close()
    return jsonify({"message": "Usuário criado com sucesso"}), 201

@app.route('/api/usuarios/<int:user_id>', methods=['PUT', 'DELETE'])
@login_required
@permission_required(['admin'])
def gerenciar_usuario_especifico(user_id):
    db = get_db()
    cursor = db.cursor()
    if user_id == 1:
        db.close()
        return jsonify({"error": "O administrador principal não pode ser modificado ou excluído"}), 403

    if request.method == 'PUT':
        dados = request.json
        nome_usuario = dados.get('nome_usuario')
        permissao = dados.get('permissao')
        senha = dados.get('senha')

        if not nome_usuario or not permissao:
            db.close()
            return jsonify({"error": "Nome de usuário e permissão são obrigatórios"}), 400

        # Verifica se o novo nome de usuário já está em uso por outro usuário
        existente = cursor.execute('SELECT id FROM usuarios WHERE nome_usuario = ? AND id != ?', (nome_usuario, user_id)).fetchone()
        if existente:
            db.close()
            return jsonify({"error": "Este nome de usuário já está em uso"}), 409

        if senha:
            senha_hash = generate_password_hash(senha)
            cursor.execute('UPDATE usuarios SET nome_usuario = ?, permissao = ?, senha_hash = ? WHERE id = ?', (nome_usuario, permissao, senha_hash, user_id))
        else:
            cursor.execute('UPDATE usuarios SET nome_usuario = ?, permissao = ? WHERE id = ?', (nome_usuario, permissao, user_id))

        db.commit()
        db.close()
        return jsonify({"message": "Usuário atualizado com sucesso"})

    elif request.method == 'DELETE':
        cursor.execute('DELETE FROM usuarios WHERE id = ?', (user_id,))
        db.commit()
        db.close()
        return jsonify({"message": "Usuário excluído com sucesso"})
        
        # --- API para Entregas (NOVA ROTA DE EDIÇÃO) ---

@app.route('/api/entregas/<int:entrega_id>', methods=['PUT'])
@login_required
@permission_required(['admin', 'operador'])
def atualizar_entrega(entrega_id):
    dados = request.json
    peso_bruto = dados.get('peso_bruto')
    valor_frete = dados.get('valor_frete')
    peso_cobrado = dados.get('peso_cobrado')

    if peso_bruto is None or peso_bruto == '':
        return jsonify({"error": "Peso Bruto é um campo obrigatório"}), 400

    db = get_db()
    db.execute(
        'UPDATE entregas SET peso_bruto = ?, valor_frete = ?, peso_cobrado = ? WHERE id = ?',
        (peso_bruto, valor_frete, peso_cobrado, entrega_id)
    )
    db.commit()
    db.close()
    return jsonify({"message": "Entrega atualizada com sucesso"})
    
if __name__ == '__main__':
    app.run(debug=True, port=5001)