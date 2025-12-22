# app.py CORRIGIDO (V7.2 - CORREÇÃO DE INDENTAÇÃO)

import time
import pandas as pd
import os
from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for, render_template
from flask_migrate import Migrate
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from sqlalchemy.orm import joinedload
from sqlalchemy import func, or_
import traceback
from dotenv import load_dotenv

from database import db
from models import Carga, Cliente, Entrega, Usuario, Motorista, Veiculo

# --- INICIALIZAÇÃO E CONFIGURAÇÃO ---
load_dotenv('.env.railway') # Garante que as variáveis de ambiente sejam lidas
app = Flask(__name__)
app.secret_key = 'sua-chave-secreta-muito-segura-aqui-12345'

# Configuração do Banco de Dados (Lê do .env.railway ou usa sqlite local)
basedir = os.path.abspath(os.path.dirname(__file__))
database_url = os.environ.get('DATABASE_URL') or 'sqlite:///' + os.path.join(basedir, 'cargas.db')
app.config['SQLALCHEMY_DATABASE_URI'] = database_url

db.init_app(app)
migrate = Migrate(app, db)

# --- DECORATOR DE AUTENTICAÇÃO ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify(error='Sessão expirada, faça login novamente.'), 401
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
    return decorated_function

# --- ROTAS DE AUTENTICAÇÃO E SESSÃO ---
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    nome_usuario = data.get('nome_usuario')
    senha = data.get('senha')
    
    user = Usuario.query.filter_by(nome_usuario=nome_usuario).first()
    
    if user and check_password_hash(user.senha_hash, senha):
        session['user_id'] = user.id
        session['user_name'] = user.nome_usuario
        session['user_permission'] = user.permissao
        return jsonify(message='Login bem-sucedido!')
    
    return jsonify(error='Usuário ou senha inválidos'), 401

@app.route('/logout')
def logout():
    session.pop('user_id', None)
    session.pop('user_name', None)
    session.pop('user_permission', None)
    return redirect(url_for('login_page'))

@app.route('/api/session', methods=['GET'])
@login_required
def get_session():
    return jsonify(
        user_name=session.get('user_name'),
        user_permission=session.get('user_permission')
    )
#
# COLE ESTE NOVO BLOCO DE CÓDIGO (APROX. LINHA 73)
#

@app.route('/api/verify-password', methods=['POST'])
@login_required
def verify_password():
    try:
        data = request.json
        senha_digitada = data.get('password')
        
        # Pega o ID do usuário que está logado na sessão
        user_id = session.get('user_id')
        if not user_id:
            return jsonify(error='Sessão não encontrada'), 401
            
        usuario = Usuario.query.get(user_id)
        if not usuario:
            return jsonify(error='Usuário não encontrado'), 401
        
        # Compara a senha digitada com a senha hasheada no banco
        if check_password_hash(usuario.senha_hash, senha_digitada):
            return jsonify(message='Senha correta!'), 200
        else:
            return jsonify(error='Senha incorreta'), 401
            
    except Exception as e:
        print(f"Erro em /api/verify-password: {e}")
        return jsonify(error=f"Erro interno: {str(e)}"), 500

# --- ROTAS DAS PÁGINAS (HTML) ---
@app.route('/')
@login_required
def index():
    return send_from_directory('.', 'index.html')

@app.route('/login')
def login_page():
    return send_from_directory('.', 'login.html')

@app.route('/clientes.html')
@login_required
def clientes_page():
    return send_from_directory('.', 'clientes.html')

@app.route('/montagem.html')
@login_required
def montagem_page():
    return send_from_directory('.', 'montagem.html')
    
@app.route('/consulta.html')
@login_required
def consulta_page():
    return send_from_directory('.', 'consulta.html')

@app.route('/motoristas.html')
@login_required
def motoristas_page():
    if session.get('user_permission') != 'admin':
        return redirect(url_for('index'))
    return send_from_directory('.', 'motoristas.html')

@app.route('/veiculos.html')
@login_required
def veiculos_page():
    if session.get('user_permission') != 'admin':
        return redirect(url_for('index'))
    return send_from_directory('.', 'veiculos.html')

@app.route('/usuarios.html')
@login_required
def usuarios_page():
    if session.get('user_permission') != 'admin':
        return redirect(url_for('index'))
    return send_from_directory('.', 'usuarios.html')

# --- ROTAS DA API (DADOS) ---

# --- API: CLIENTES ---
@app.route('/api/clientes/detalhes', methods=['GET'])
@login_required
def get_clientes_detalhes():
    try:
        # --- INÍCIO DA OTIMIZAÇÃO (CORREÇÃO 4.2) ---
        # Faz um JOIN e conta as entregas em uma única query
        query_result = db.session.query(
            Cliente,
            func.count(Entrega.id)
        ).outerjoin(
            Entrega, Entrega.cliente_id == Cliente.id
        ).group_by(
            Cliente.id
        ).order_by(
            Cliente.razao_social
        ).all()

        clientes_data = []
        # Agora 'c' é o Cliente e 'entregas_count' é a contagem
        for c, entregas_count in query_result: 

            text = f"{(c.razao_social or '').upper()} ({(c.cidade or 'N/A')}-{(c.estado or 'N/A')})"

            clientes_data.append({
                'id': c.id,
                'codigo_cliente': c.codigo_cliente,
                'razao_social': c.razao_social,
                'telefone_completo': f"({c.ddd or ''}) {c.telefone or ''}".strip(),
                'cidade': c.cidade,
                'estado': c.estado,
                'is_remetente': c.is_remetente,
                'entregas_count': entregas_count, # A contagem vem do JOIN
                'text': text,

                # Adiciona os campos que o dataset do JS precisa (CORREÇÃO 4.1)
                'ddd': c.ddd,
                'telefone': c.telefone,
                'observacoes': c.observacoes
            })
        # --- FIM DA OTIMIZAÇÃO ---

        return jsonify(clientes_data)
    except Exception as e:
        print(f"Erro em /api/clientes/detalhes: {e}")
        traceback.print_exc() # Adiciona log de erro
        return jsonify(error=f"Erro interno ao buscar clientes: {str(e)}"), 500

@app.route('/api/clientes', methods=['GET'])
@login_required
def get_clientes():
    try:
        clientes = Cliente.query.all()
        # Simplificado para o Select2
        clientes_data = [{
            'id': c.id, 
            'text': f"{(c.razao_social or '').upper()} ({(c.cidade or 'N/A')}-{(c.estado or 'N/A')})",
            'cidade': c.cidade,
            'estado': c.estado,
            'is_remetente': c.is_remetente
        } for c in clientes]
        return jsonify(clientes_data)
    except Exception as e:
        print(f"Erro em /api/clientes: {e}")
        return jsonify(error=f"Erro interno ao buscar clientes: {str(e)}"), 500

@app.route('/api/clientes/import', methods=['POST'])
@login_required
def importar_clientes():
    if 'arquivo' not in request.files:
        return jsonify(error='Nenhum arquivo enviado'), 400
    arquivo = request.files['arquivo']
    
    try: # <--- O 'try' começa aqui
        if arquivo.filename.endswith('.csv'):
            df = pd.read_csv(arquivo, dtype=str)
        else:
            df = pd.read_excel(arquivo, dtype=str)
        
        df = df.fillna('')
        novos_count = 0
        ignorados_count = 0
        
        codigos_existentes = set(row[0] for row in db.session.query(Cliente.codigo_cliente).all())

        # ***** CORREÇÃO DE INDENTAÇÃO APLICADA AQUI *****
        # Este loop agora está DENTRO do 'try'
        for _, row in df.iterrows():
            codigo = str(row.iloc[0]).strip()
            if not codigo or codigo in codigos_existentes:
                ignorados_count += 1
                continue
            
            # --- CORREÇÃO DE MAPEAMENTO APLICADA ---
            razao_social = str(row.iloc[1]).strip().upper() if len(row) > 1 else ''
            ddd = str(row.iloc[2]).strip()[:2] if len(row) > 2 else ''             # <-- Correto (C)
            telefone = str(row.iloc[3]).strip() if len(row) > 3 else ''           # <-- Correto (D)
            cidade = str(row.iloc[4]).strip().upper() if len(row) > 4 else ''       # <-- Correto (E)
            estado = str(row.iloc[5]).strip().upper()[:2] if len(row) > 5 else ''   # <-- Correto (F)
            observacoes = str(row.iloc[6]).strip() if len(row) > 6 else '' # <-- Correto (G, se existir)

            # Garante que clientes sem razão social não sejam importados
            if not razao_social:
                ignorados_count += 1
                continue

            novo_cliente = Cliente(
                codigo_cliente=codigo,
                razao_social=razao_social,
                cidade=cidade,
                estado=estado,
                ddd=ddd,
                telefone=telefone,
                observacoes=observacoes,
                is_remetente=False # Padrão
            )
            db.session.add(novo_cliente)
            codigos_existentes.add(codigo)
            novos_count += 1

        db.session.commit()
        return jsonify(message=f'Importação concluída! {novos_count} novos clientes importados, {ignorados_count} ignorados (código já existente).')

    except Exception as e: # <--- O 'except' correspondente
        db.session.rollback()
        print(f"Erro na importação de clientes: {e}")
        traceback.print_exc()
        return jsonify(error=f'Erro ao processar o arquivo: {str(e)}'), 500
        
@app.route('/api/clientes/<int:cliente_id>', methods=['PUT'])
@login_required
def update_cliente(cliente_id):
    try:
        data = request.json
        cliente = Cliente.query.get(cliente_id)
        if not cliente:
            return jsonify(error='Cliente não encontrado'), 404

        cliente.razao_social = (data.get('razao_social') or '').upper()
        cliente.cidade = (data.get('cidade') or '').upper()
        cliente.estado = (data.get('estado') or '').upper()
        cliente.ddd = data.get('ddd') or None
        cliente.telefone = data.get('telefone') or None
        cliente.observacoes = data.get('observacoes') or None
        cliente.is_remetente = data.get('is_remetente', False)
        
        db.session.commit()
        return jsonify(message='Cliente atualizado com sucesso!')
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao atualizar cliente {cliente_id}: {e}")
        return jsonify(error=f'Erro interno: {str(e)}'), 500

@app.route('/api/cargas', methods=['GET', 'POST'])
@login_required
def handle_cargas():
# --- POST (Criação de Carga V2 - Pendente) ---
    if request.method == 'POST':
        # ... (A parte do POST continua idêntica) ...
        try:
            data = request.json
            origem = data.get('origem')

            if not origem:
                return jsonify(error="Origem é obrigatória."), 400

            # Cria a nova Carga já como Pendente
            nova_carga = Carga(
                codigo_carga=f"CARGA-{int(time.time())}",
                origem=origem.upper(),
                status='Pendente' 
            )
            db.session.add(nova_carga)
            db.session.commit() 

            # O frontend (script.js) espera o objeto da carga de volta
            # para chamar adicionarCartaoNaTela()
            carga_dict = nova_carga.to_dict()
            carga_dict['motorista_nome'] = None
            carga_dict['placa_veiculo'] = None
            carga_dict['entregas'] = []
            carga_dict['num_entregas'] = 0
            carga_dict['destinos'] = []
            carga_dict['destino_principal'] = 'N/A'
            carga_dict['peso_total'] = 0.0
            
            return jsonify(carga_dict), 201 # Retorna o objeto da carga

        except Exception as e:
            db.session.rollback()
            print(f"Erro em POST /api/cargas (V2): {e}")
            return jsonify(error=f"Erro interno: {str(e)}"), 500
            
    # --- GET (Listagem Painel Principal) ---
    if request.method == 'GET':
        try:
            status_filter = request.args.get('status')
            
            # Filtra para não mostrar Rascunhos nem Finalizadas no painel
            base_query = Carga.query.options(
                joinedload(Carga.motorista_rel), 
                joinedload(Carga.veiculo_rel), 
                joinedload(Carga.entregas).joinedload(Entrega.cliente)
            ).filter(Carga.status != 'Rascunho', Carga.status != 'Finalizada')

            if status_filter:
                base_query = base_query.filter(Carga.status == status_filter)
                
            cargas = base_query.order_by(Carga.id.desc()).all()
            
            cargas_data = []
            
            for carga in cargas:
                carga_dict = carga.to_dict()
                
                carga_dict['motorista_nome'] = carga.motorista_rel.nome if carga.motorista_rel else None
                carga_dict['placa_veiculo'] = carga.veiculo_rel.placa if carga.veiculo_rel else None
                carga_dict['entregas'] = [e.to_dict() for e in carga.entregas]
                
                peso_total_carga = 0.0
                frete_total_acumulado = 0.0 # --- NOVO (ITEM 9) ---
                destinos_set = set()
                destino_principal_str = None 
                destinos_unicos_count = set() 

                for e in carga.entregas:
                    if e.peso_bruto:
                        peso_total_carga += e.peso_bruto
                    if e.valor_frete:
                        frete_total_acumulado += e.valor_frete # --- SOMA FRETE ---

                    cidade_final = e.cidade_entrega or (e.cliente.cidade if e.cliente else None)
                    estado_final = e.estado_entrega or (e.cliente.estado if e.cliente else None)
                    cidade_str = (cidade_final or "").upper()
                    estado_str = (estado_final or "").upper()
                    
                    cliente_id = e.cliente_id
                    chave_unica = f"{cliente_id}_{cidade_str}_{estado_str}"
                    destinos_unicos_count.add(chave_unica)
                    
                    destino_formatado = None
                    if cidade_str or estado_str: 
                        destino_formatado = f"{cidade_str}-{estado_str}"
                        destinos_set.add(destino_formatado)
                    
                    if e.is_last_delivery == 1 and destino_formatado:
                        destino_principal_str = destino_formatado
                
                destinos_list = sorted(list(destinos_set)) 
                carga_dict['destinos'] = destinos_list
                carga_dict['destino_principal'] = destino_principal_str or (destinos_list[0] if destinos_list else 'N/A')
                carga_dict['peso_total'] = peso_total_carga 
                carga_dict['valor_frete_total'] = frete_total_acumulado # --- ENVIA PARA O FRONT ---
                carga_dict['num_entregas'] = len(destinos_unicos_count)
                
                cargas_data.append(carga_dict)
                
            return jsonify(cargas_data)
        
        except Exception as e:
            print(f"Erro em GET /api/cargas: {e}")
            traceback.print_exc() 
            return jsonify(error=f"Erro interno ao buscar cargas: {str(e)}"), 500
            
@app.route('/api/cargas/consulta', methods=['GET'])
@login_required
def get_cargas_consulta():
    try:
        query = Carga.query.options(
            joinedload(Carga.motorista_rel),
            joinedload(Carga.veiculo_rel),
            joinedload(Carga.entregas).joinedload(Entrega.cliente)
        ).filter(Carga.status != 'Rascunho')

        # Aplicar filtros
        if request.args.get('codigo_carga'):
            query = query.filter(Carga.codigo_carga.ilike(f"%{request.args.get('codigo_carga')}%"))
        if request.args.get('origem'):
            query = query.filter(Carga.origem.ilike(f"%{request.args.get('origem')}%"))
        if request.args.get('status'):
            query = query.filter(Carga.status == request.args.get('status'))
        if request.args.get('motorista'):
            query = query.join(Carga.motorista_rel).filter(Motorista.nome.ilike(f"%{request.args.get('motorista')}%"))
        if request.args.get('placa'):
            query = query.join(Carga.veiculo_rel).filter(Veiculo.placa.ilike(f"%{request.args.get('placa')}%"))
        if request.args.get('cliente_id'):
            query = query.join(Carga.entregas).filter(Entrega.cliente_id == request.args.get('cliente_id'))
        if request.args.get('data_carregamento_inicio'):
            query = query.filter(Carga.data_carregamento >= request.args.get('data_carregamento_inicio'))
        if request.args.get('data_carregamento_fim'):
            query = query.filter(Carga.data_carregamento <= request.args.get('data_carregamento_fim'))
        if request.args.get('data_finalizacao_inicio'):
            query = query.filter(Carga.data_finalizacao >= request.args.get('data_finalizacao_inicio'))
        if request.args.get('data_finalizacao_fim'):
            query = query.filter(Carga.data_finalizacao <= request.args.get('data_finalizacao_fim'))

        # Paginação
        page = request.args.get('page', 1, type=int)
        per_page = 20
        total = query.count()
        cargas = query.order_by(Carga.id.desc()).paginate(page=page, per_page=per_page, error_out=False).items
        
        cargas_data = []
        for carga in cargas:
            peso_total_bruto = sum(e.peso_bruto for e in carga.entregas if e.peso_bruto)
            
            # >>>>> CORREÇÃO 6: Lógica de destinos "à prova de nulos"
            destinos_set = set()
            
            # ***** INÍCIO DA CORREÇÃO DO BUG 2 *****
            destinos_unicos_count = set() # Novo set para contagem real
            # ***** FIM DA CORREÇÃO DO BUG 2 *****
            
            for e in carga.entregas:
                # Lógica de destino (incluindo override)
                cidade_final = e.cidade_entrega or (e.cliente.cidade if e.cliente else None)
                estado_final = e.estado_entrega or (e.cliente.estado if e.cliente else None)

                cidade_str = (cidade_final or "").upper()
                estado_str = (estado_final or "").upper()
                
                if cidade_str or estado_str: # Evita adicionar "- " se ambos forem nulos
                    destinos_set.add(f"{cidade_str}-{estado_str}")
                    
                # ***** INÍCIO DA CORREÇÃO DO BUG 2 *****
                # Chave única: "ID_CLIENTE_CIDADE_ESTADO"
                cliente_id = e.cliente_id
                chave_unica = f"{cliente_id}_{cidade_str}_{estado_str}"
                destinos_unicos_count.add(chave_unica)
                # ***** FIM DA CORREÇÃO DO BUG 2 *****
                        
            destinos = sorted(list(destinos_set))

            cargas_data.append({
                'id': carga.id,
                'codigo_carga': carga.codigo_carga,
                'status': carga.status,
                'origem': carga.origem,
                'destino_principal': destinos[0] if destinos else 'N/A',
                'motorista_nome': carga.motorista_rel.nome if carga.motorista_rel else 'N/A',
                
                # ***** INÍCIO DA CORREÇÃO DO BUG 2 *****
                'num_entregas': len(destinos_unicos_count), # Usa a contagem real
                # ***** FIM DA CORREÇÃO DO BUG 2 *****
                
                'peso_total_bruto': peso_total_bruto,
                'data_finalizacao': carga.data_finalizacao,
                
                # CHAVES DE COMPATIBILIDADE (para consulta.js)
                'destino': destinos[0] if destinos else 'N/A',
                'motorista': carga.motorista_rel.nome if carga.motorista_rel else 'N/A',
                'peso_total': peso_total_bruto
            })
            
        return jsonify(
            cargas=cargas_data,
            total_resultados=total,       # Sincronizado com consulta.js
            pagina_atual=page,            # Sincronizado com consulta.js
            total_paginas=(total + per_page - 1) // per_page 
        )
        
    except Exception as e:
        print(f"Erro em /api/cargas/consulta: {e}")
        traceback.print_exc()
        return jsonify(error=f"Erro interno ao consultar cargas: {str(e)}"), 500
        
@app.route('/api/cargas/<int:carga_id>', methods=['GET'])
@login_required
def get_carga_detalhes(carga_id):
    try:
        # CORREÇÃO: Usar joinedload para trazer tudo de uma vez e evitar erros de sessão
        carga = Carga.query.options(
            joinedload(Carga.motorista_rel),
            joinedload(Carga.veiculo_rel),
            joinedload(Carga.entregas).joinedload(Entrega.cliente),
            joinedload(Carga.entregas).joinedload(Entrega.remetente)
        ).get(carga_id)
        
        if not carga:
            return jsonify(error='Carga não encontrada'), 404

        # 1. Prepara os detalhes da carga
        detalhes_carga = carga.to_dict()
        detalhes_carga['motorista_nome'] = carga.motorista_rel.nome if carga.motorista_rel else None
        detalhes_carga['placa_veiculo'] = carga.veiculo_rel.placa if carga.veiculo_rel else None

        # 2. Prepara os detalhes das entregas
        entregas_data = []
        for entrega in carga.entregas:
            entregas_data.append({
                'id': entrega.id,
                'remetente_id': entrega.remetente_id,
                'cliente_id': entrega.cliente_id,
                # Dados do Remetente (Protegido contra Nulos)
                'remetente_nome': (entrega.remetente.razao_social or 'N/A') if entrega.remetente else 'N/A',
                'remetente_cidade': (entrega.remetente.cidade or 'N/A') if entrega.remetente else 'N/A', 
                # Dados do Destinatário
                'razao_social': (entrega.cliente.razao_social or 'N/A') if entrega.cliente else 'N/A',
                # Cidade/Estado (Com override)
                'cidade': entrega.cidade_entrega or (entrega.cliente.cidade or '') if entrega.cliente else (entrega.cidade_entrega or ''),
                'estado': entrega.estado_entrega or (entrega.cliente.estado or '') if entrega.cliente else (entrega.estado_entrega or ''),
                'ddd': (entrega.cliente.ddd or '') if entrega.cliente else '',
                'telefone': (entrega.cliente.telefone or '') if entrega.cliente else '',
                'obs_cliente': (entrega.cliente.observacoes or '') if entrega.cliente else '',
                # Campos de Override
                'cidade_entrega_override': entrega.cidade_entrega,
                'estado_entrega_override': entrega.estado_entrega,
                # Valores
                'peso_bruto': entrega.peso_bruto,
                'valor_frete': entrega.valor_frete,
                'peso_cubado': entrega.peso_cubado,
                'nota_fiscal': entrega.nota_fiscal,
                'is_last_delivery': entrega.is_last_delivery
            })

        return jsonify({
            'detalhes_carga': detalhes_carga,
            'entregas': entregas_data
        })
    except Exception as e:
        print(f"Erro em /api/cargas/<id>: {e}")
        traceback.print_exc()
        return jsonify(error=f"Erro interno: {str(e)}"), 500        
#
# --- NOVA ROTA DO ESPELHO DE CARGA (VERSÃO HTML) ---
#
@app.route('/cargas/<int:carga_id>/espelho_impressao')
@login_required
def get_carga_espelho_html(carga_id):
    try:
        # 1. Buscar a carga e todos os dados relacionados de uma vez
        carga = Carga.query.options(
            joinedload(Carga.motorista_rel),
            joinedload(Carga.veiculo_rel),
            joinedload(Carga.entregas).joinedload(Entrega.cliente),
            joinedload(Carga.entregas).joinedload(Entrega.remetente)
        ).get(carga_id)

        if not carga:
            return "Carga não encontrada", 404

        # 2. Processar os dados (Agrupamentos e Totais)
        entregas_agrupadas = {}
        coletas_por_remetente = {}
        peso_total_carga = 0.0

        for e in carga.entregas:
            peso_bruto = e.peso_bruto or 0
            peso_total_carga += peso_bruto
            cliente_nome = (e.cliente.razao_social or 'N/A') if e.cliente else 'N/A'
            cidade_final = e.cidade_entrega or (e.cliente.cidade if e.cliente else 'N/A')
            estado_final = e.estado_entrega or (e.cliente.estado if e.cliente else 'N/A')
            destino_key = f"{cliente_nome}_{cidade_final}_{estado_final}"

            if destino_key not in entregas_agrupadas:
                entregas_agrupadas[destino_key] = {
                    'cliente': cliente_nome,
                    'cidade_uf': f"{cidade_final}-{estado_final}",
                    'peso': 0.0
                }
            entregas_agrupadas[destino_key]['peso'] += peso_bruto
            remetente_nome = (e.remetente.razao_social or 'SEM REMETENTE') if e.remetente else 'SEM REMETENTE'

            if remetente_nome not in coletas_por_remetente:
                coletas_por_remetente[remetente_nome] = {
                    'entregas': {},
                    'total_peso': 0.0
                }
            coletas_por_remetente[remetente_nome]['total_peso'] += peso_bruto

            if destino_key not in coletas_por_remetente[remetente_nome]['entregas']:
                coletas_por_remetente[remetente_nome]['entregas'][destino_key] = {
                    'cliente': cliente_nome,
                    'cidade_uf': f"{cidade_final}-{estado_final}",
                    'peso': 0.0
                }

            coletas_por_remetente[remetente_nome]['entregas'][destino_key]['peso'] += peso_bruto

        lista_entregas = sorted(entregas_agrupadas.values(), key=lambda x: x['cliente'])
        lista_coletas = sorted(coletas_por_remetente.items(), key=lambda x: x[0]) 

        # Ordena as sub-entregas dentro de cada coleta
        for rem_nome, dados_coleta in lista_coletas:
            dados_coleta['entregas'] = sorted(dados_coleta['entregas'].values(), key=lambda x: x['cliente'])

        # 3. Renderizar o template HTML
        return render_template(
            'espelho.html',
            carga=carga,
            lista_entregas=lista_entregas,
            lista_coletas=lista_coletas,
            peso_total_carga=peso_total_carga,
            total_destinos=len(lista_entregas)
        )

    except Exception as e:
        print(f"Erro ao gerar espelho HTML da carga {carga_id}: {e}")
        traceback.print_exc()
        return f"Erro interno: {str(e)}", 500
        
# --- API: MONTAGEM (RASCUNHOS) ---
@app.route('/api/cargas/montar', methods=['POST'])
@login_required
def montar_carga_rascunho():
    try:
        data = request.json
        origem = data.get('origem')
        entrega_ids = data.get('entrega_ids')

        if not origem or not entrega_ids:
            return jsonify(error='Origem e IDs de entrega são obrigatórios'), 400

        nova_carga = Carga(
            codigo_carga=f"RASC-{int(time.time())}",
            origem=origem.upper(),
            status='Rascunho'
        )
        db.session.add(nova_carga)
        
        # Vincula as entregas à nova carga (Rascunho)
        entregas_para_vincular = Entrega.query.filter(Entrega.id.in_(entrega_ids), Entrega.carga_id == None).all()
        
        if len(entregas_para_vincular) != len(entrega_ids):
             db.session.rollback()
             return jsonify(error='Uma ou mais entregas selecionadas já estão em outra carga.'), 409
             
        for entrega in entregas_para_vincular:
            entrega.carga = nova_carga

        db.session.commit()
        return jsonify(message=f'Rascunho {nova_carga.codigo_carga} salvo com sucesso!', carga_id=nova_carga.id), 201

    except Exception as e:
        db.session.rollback()
        print(f"Erro em /api/cargas/montar: {e}")
        return jsonify(error=f"Erro interno: {str(e)}"), 500

@app.route('/api/cargas/<int:carga_id>/montar', methods=['PUT'])
@login_required
def update_rascunho(carga_id):
    try:
        data = request.json
        # IDs que o frontend quer que estejam na carga
        frontend_ids = set(data.get('entrega_ids', []))
        
        carga = Carga.query.filter_by(id=carga_id, status='Rascunho').first()
        if not carga:
            return jsonify(error='Rascunho não encontrado'), 404

        # IDs que estão atualmente na carga no banco
        current_ids_in_db = {e.id for e in carga.entregas}

        # 1. Encontra o que precisa ser ADICIONADO
        ids_to_add = frontend_ids - current_ids_in_db
        if ids_to_add:
            # Verifica se as entregas a adicionar estão REALMENTE disponíveis
            entregas_to_add = Entrega.query.filter(
                Entrega.id.in_(ids_to_add), 
                Entrega.carga_id == None
            ).all()

            # Se a contagem for diferente, alguma entrega foi "roubada" por outra carga
            if len(entregas_to_add) != len(ids_to_add):
                db.session.rollback()
                return jsonify(error='Uma ou mais entregas selecionadas já estão em outra carga. Atualize a lista.'), 409
            
            # Adiciona as novas entregas à carga
            for entrega in entregas_to_add:
                entrega.carga_id = carga.id

        # 2. Encontra o que precisa ser REMOVIDO
        ids_to_remove = current_ids_in_db - frontend_ids
        if ids_to_remove:
            # Desvincula as entregas removidas (devolve para "Disponíveis")
            Entrega.query.filter(
                Entrega.id.in_(ids_to_remove), 
                Entrega.carga_id == carga.id
            ).update({'carga_id': None}, synchronize_session=False)

        # 3. Atualiza a origem
        if 'origem' in data:
            carga.origem = data.get('origem', carga.origem).upper()

        db.session.commit()
        return jsonify(message=f'Rascunho {carga.codigo_carga} atualizado com sucesso!', carga_id=carga.id), 200

    except Exception as e:
        db.session.rollback()
        print(f"Erro em PUT /api/cargas/<id>/montar: {e}")
        traceback.print_exc()
        return jsonify(error=f"Erro interno: {str(e)}"), 500

@app.route('/api/cargas/rascunhos', methods=['GET'])
@login_required
def get_rascunhos():
    try:
        rascunhos = Carga.query.filter_by(status='Rascunho').order_by(Carga.id.desc()).all()
        rascunhos_data = []
        for r in rascunhos:
            rascunhos_data.append({
                'id': r.id,
                'codigo_carga': r.codigo_carga,
                'origem': r.origem,
                'num_entregas': len(r.entregas)
            })
        return jsonify(rascunhos_data)
    except Exception as e:
        print(f"Erro em /api/cargas/rascunhos: {e}")
        return jsonify(error=f"Erro interno: {str(e)}"), 500

@app.route('/api/cargas/<int:carga_id>/rascunho', methods=['DELETE'])
@login_required
def excluir_rascunho(carga_id):
    try:
        carga = Carga.query.filter_by(id=carga_id, status='Rascunho').first()
        if not carga:
            return jsonify(error='Rascunho não encontrado'), 404

        # Desvincula entregas
        for entrega in carga.entregas:
            entrega.carga_id = None
            
        db.session.delete(carga)
        db.session.commit()
        return jsonify(message=f'Rascunho {carga.codigo_carga} excluído. Entregas voltaram para "Disponíveis".')
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao excluir rascunho {carga_id}: {e}")
        return jsonify(error=f"Erro interno: {str(e)}"), 500

@app.route('/api/cargas/<int:carga_id>/confirmar', methods=['PUT'])
@login_required
def confirmar_rascunho(carga_id):
    try:
        carga = Carga.query.filter_by(id=carga_id, status='Rascunho').first()
        if not carga:
            return jsonify(error='Rascunho não encontrado'), 404
            
        if not carga.entregas:
            return jsonify(error='Não é possível confirmar um rascunho vazio'), 400

        carga.status = 'Pendente'
        carga.codigo_carga = f"CARGA-{int(time.time())}"
        
        db.session.commit()
        return jsonify(message=f'Carga {carga.codigo_carga} confirmada e movida para Pendentes.')
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao confirmar rascunho {carga_id}: {e}")
        return jsonify(error=f"Erro interno: {str(e)}"), 500
        
@app.route('/api/cargas/<int:carga_id>/devolver-rascunho', methods=['PUT'])
@login_required
def devolver_para_rascunho(carga_id):
    try:
        carga = Carga.query.get(carga_id)
        if not carga:
            return jsonify(error='Carga não encontrada'), 404
        
        # Só pode devolver se estiver Pendente ou Agendada
        if carga.status not in ['Pendente', 'Agendada']:
            return jsonify(error=f'Não é possível devolver uma carga com status {carga.status}.'), 400

        # Atualiza o status e o código
        carga.status = 'Rascunho'
        carga.codigo_carga = f"RASC-{int(time.time())}" # Gera um novo código de Rascunho
        
        # Limpa os dados da viagem anterior
        carga.motorista_id = None
        carga.veiculo_id = None
        carga.data_agendamento = None
        carga.data_carregamento = None
        carga.previsao_entrega = None
        
        db.session.commit()
        # Retorna o JSON que o JavaScript espera
        return jsonify(message='Carga devolvida para Rascunho. Redirecionando...')
        
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao devolver para rascunho {carga_id}: {e}")
        traceback.print_exc()
        return jsonify(error=f"Erro interno: {str(e)}"), 500
        
@app.route('/api/cargas/<int:carga_id>/status', methods=['PUT'])
@login_required
def update_carga_status(carga_id):
    try:
        data = request.json
        carga = Carga.query.get(carga_id)
        if not carga:
            return jsonify(error='Carga não encontrada'), 404

        # --- INÍCIO DA TRAVA DE ADMIN (REGREDIR STATUS) ---
        if 'status' in data:
            novo_status = data['status']
            status_atual = carga.status
            
            # Define as ações de "regressão" que SÃO SOMENTE DE ADMIN
            is_regressao_admin_only = (
                (status_atual == 'Finalizada' and novo_status == 'Em Trânsito') or
                (status_atual == 'Em Trânsito' and novo_status == 'Agendada')
            )
            
            # Se for uma dessas e o user NÃO for admin, bloqueia.
            if is_regressao_admin_only and session.get('user_permission') != 'admin':
                return jsonify(error='Apenas administradores podem regredir o status da carga.'), 403
            
            # A regressão 'Agendada' -> 'Pendente' (Cancelar Agendamento) 
            # é permitida para todos, então não é incluída na verificação acima.
        # --- FIM DA TRAVA DE ADMIN ---

        # Atualiza todos os campos que podem vir do frontend
        if 'status' in data:
            carga.status = data['status']
        if 'data_agendamento' in data:
            carga.data_agendamento = data['data_agendamento'] or None
        if 'data_carregamento' in data:
            carga.data_carregamento = data['data_carregamento'] or None
        if 'previsao_entrega' in data:
            carga.previsao_entrega = data['previsao_entrega'] or None
        if 'data_finalizacao' in data:
            carga.data_finalizacao = data['data_finalizacao'] or None
        if 'motorista_id' in data:
            carga.motorista_id = data['motorista_id'] or None
        if 'veiculo_id' in data:
            carga.veiculo_id = data['veiculo_id'] or None
        if 'origem' in data:
            carga.origem = data.get('origem', carga.origem).upper()
        if 'observacoes' in data:
            carga.observacoes = data.get('observacoes', carga.observacoes)
        if 'frete_pago' in data:
            carga.frete_pago = data.get('frete_pago', carga.frete_pago)

        db.session.commit()
        return jsonify(message='Status da carga atualizado com sucesso!')
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao atualizar status da carga {carga_id}: {e}")
        return jsonify(error=f"Erro interno: {str(e)}"), 500        

@app.route('/api/cargas/<int:carga_id>', methods=['DELETE'])
@login_required
def delete_carga_permanente(carga_id):
    if session.get('user_permission') != 'admin':
        return jsonify(error='Apenas administradores podem excluir cargas.'), 403

    try:
        carga = Carga.query.get(carga_id)
        if not carga:
            return jsonify(error='Carga não encontrada'), 404
            
        # Pega a ação desejada ('delete_entregas' ou 'return_to_pool')
        action = request.args.get('action', 'return_to_pool')

        if action == 'delete_entregas':
            # Apaga as entregas do banco
            for entrega in carga.entregas:
                db.session.delete(entrega)
        else:
            # Devolve as entregas para o pool (remove o vínculo)
            for entrega in carga.entregas:
                entrega.carga_id = None
                entrega.is_last_delivery = 0 # Reseta flag de destino

        db.session.delete(carga)
        db.session.commit()
        return jsonify(message='Carga excluída com sucesso.')

    except Exception as e:
        db.session.rollback()
        print(f"Erro ao excluir carga {carga_id}: {e}")
        return jsonify(error=f"Erro interno: {str(e)}"), 500


# --- API: Edição de Entregas (Dentro do Modal de Carga) ---
@app.route('/api/cargas/<int:carga_id>/entregas', methods=['POST', 'DELETE'])
@login_required
def handle_carga_entregas(carga_id):
    carga = Carga.query.get(carga_id)
    if not carga:
        return jsonify(error='Carga não encontrada'), 404
        
    # --- Adiciona uma nova entrega (Coleta Rápida V1) ---
    if request.method == 'POST':
        try:
            data = request.json
            cliente_id = data.get('cliente_id')
            remetente_id = data.get('remetente_id') # <-- LINHA NOVA

            # Validação (se o frontend não enviar por algum motivo)
            if not remetente_id:
                 return jsonify(error='Remetente não foi selecionado.'), 400
                 
            cliente = Cliente.query.get(cliente_id)
            if not cliente:
                 return jsonify(error='Cliente (Destinatário) não encontrado.'), 404

            nova_entrega = Entrega(
                carga_id=carga.id,
                cliente_id=cliente.id,
                remetente_id=remetente_id,
                peso_bruto=data.get('peso_bruto'),
                valor_frete=data.get('valor_frete'),
                cidade_entrega=cliente.cidade, # Padrão do cliente
                estado_entrega=cliente.estado # Padrão do cliente
            )
            db.session.add(nova_entrega)
            db.session.commit()
            return jsonify(message='Entrega rápida adicionada com sucesso!'), 201
            
        except Exception as e:
            db.session.rollback()
            print(f"Erro em POST /api/cargas/<id>/entregas: {e}")
            return jsonify(error=f"Erro interno: {str(e)}"), 500

    # --- Remove uma entrega (Devolve para Disponíveis) ---
    if request.method == 'DELETE':
        try:
            data = request.json
            entrega_id = data.get('entrega_id')
            entrega = Entrega.query.get(entrega_id)
            
            if not entrega or entrega.carga_id != carga.id:
                return jsonify(error='Entrega não encontrada nesta carga'), 404
            
            # Desvincula a entrega da carga (ela volta para "Disponíveis")
            entrega.carga_id = None
            db.session.commit()
            return jsonify(message='Entrega devolvida para "Disponíveis".')

        except Exception as e:
            db.session.rollback()
            print(f"Erro em DELETE /api/cargas/<id>/entregas: {e}")
            return jsonify(error=f"Erro interno: {str(e)}"), 500
            
@app.route('/api/entregas/disponiveis', methods=['GET', 'POST'])
@login_required
def handle_entregas_disponiveis():
    if request.method == 'POST':
        # ... (A parte do POST continua idêntica) ...
        try:
            data = request.json
            nova_entrega = Entrega(
                carga_id=None, # Disponível
                cliente_id=data.get('cliente_id'),
                remetente_id=data.get('remetente_id'),
                peso_bruto=data.get('peso_bruto'),
                valor_frete=data.get('valor_frete'),
                peso_cubado=data.get('peso_cubado'),
                nota_fiscal=data.get('nota_fiscal'),
                cidade_entrega=data.get('cidade_entrega'), # Cidade padrão do cliente
                estado_entrega=data.get('estado_entrega')  # Estado padrão do cliente
            )
            db.session.add(nova_entrega)
            db.session.commit()
            return jsonify(message='Entrega adicionada à lista de disponíveis!'), 201
        except Exception as e:
            db.session.rollback()
            print(f"Erro em POST /api/entregas/disponiveis: {e}")
            return jsonify(error=f"Erro interno: {str(e)}"), 500

    if request.method == 'GET':
        try:
            # --- INÍCIO DA OTIMIZAÇÃO (LENTIDÃO) ---
            entregas = Entrega.query.options(
                joinedload(Entrega.remetente), 
                joinedload(Entrega.cliente)
            ).filter_by(carga_id=None).all()
            # --- FIM DA OTIMIZAÇÃO ---
            
            entregas_data = []
            for e in entregas:
                # Agora o e.remetente e e.cliente vêm do JOIN, sem novas queries
                entregas_data.append({
                    'id': e.id,
                    'remetente_id': e.remetente_id,
                    'cliente_id': e.cliente_id,
                    'remetente_nome': (e.remetente.razao_social or 'N/A') if e.remetente else 'N/A',
                    'destinatario_nome': (e.cliente.razao_social or 'N/A') if e.cliente else 'N/A',
                    'cidade_entrega': e.cidade_entrega or (e.cliente.cidade if e.cliente else ''),
                    'estado_entrega': e.estado_entrega or (e.cliente.estado if e.cliente else ''),
                    'cidade_entrega_override': e.cidade_entrega, 
                    'estado_entrega_override': e.estado_entrega,
                    'peso_bruto': e.peso_bruto,
                    'valor_frete': e.valor_frete,
                    'peso_cubado': e.peso_cubado,
                    'nota_fiscal': e.nota_fiscal,
                    'selecionada': False # Para controle no front-end
                })
            return jsonify(entregas_data)
        except Exception as e:
            print(f"Erro em GET /api/entregas/disponiveis: {e}")
            traceback.print_exc()
            return jsonify(error=f"Erro interno: {str(e)}"), 500
            
@app.route('/api/entregas/disponiveis/<int:entrega_id>', methods=['DELETE'])
@login_required
def delete_entrega_disponivel(entrega_id):
    try:
        entrega = Entrega.query.filter_by(id=entrega_id, carga_id=None).first()
        if not entrega:
            return jsonify(error='Entrega disponível não encontrada'), 404
            
        db.session.delete(entrega)
        db.session.commit()
        return jsonify(message='Entrega disponível excluída com sucesso.')
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao excluir entrega disponível {entrega_id}: {e}")
        return jsonify(error=f"Erro interno: {str(e)}"), 500

@app.route('/api/entregas/<int:entrega_id>', methods=['PUT'])
@login_required
def update_entrega(entrega_id):
    try:
        data = request.json
        entrega = Entrega.query.get(entrega_id)
        if not entrega:
            return jsonify(error='Entrega não encontrada'), 404

        # --- CORREÇÃO: Atualização parcial ---
        # Itera por todos os campos que podem ser enviados e atualiza
        # apenas aqueles que vieram na requisição.
        
        if 'remetente_id' in data:
            entrega.remetente_id = data['remetente_id']
        if 'peso_bruto' in data:
            entrega.peso_bruto = data['peso_bruto']
        if 'valor_frete' in data:
            entrega.valor_frete = data['valor_frete']
        if 'peso_cubado' in data: # CORRIGIDO O NOME
            entrega.peso_cubado = data['peso_cubado']
        if 'nota_fiscal' in data:
            entrega.nota_fiscal = data['nota_fiscal']
        if 'cidade_entrega' in data:
            entrega.cidade_entrega = data['cidade_entrega']
        if 'estado_entrega' in data:
            entrega.estado_entrega = data['estado_entrega']
            
        # Esta é a correção para o BUG 1 (Radio Button)
        if 'is_last_delivery' in data:
            # Zera a flag em todas as entregas desta carga
            Entrega.query.filter_by(carga_id=entrega.carga_id).update({'is_last_delivery': 0})
            db.session.flush()
            # Define a flag apenas para a entrega clicada
            entrega.is_last_delivery = 1

        db.session.commit()
        return jsonify(message='Entrega atualizada com sucesso!')
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao atualizar entrega {entrega_id}: {e}")
        return jsonify(error=f"Erro interno: {str(e)}"), 500
 
# --- NOVA ROTA: EDIÇÃO EM LOTE DE REMETENTE (MÓDULO 6) ---
@app.route('/api/entregas/bulk-update-remetente', methods=['PUT'])
@login_required
def bulk_update_remetente():
    try:
        data = request.json
        entrega_ids = data.get('entrega_ids')
        novo_remetente_id = data.get('novo_remetente_id')

        if not entrega_ids or not isinstance(entrega_ids, list) or not entrega_ids:
            return jsonify(error='Nenhuma entrega selecionada.'), 400
            
        if not novo_remetente_id:
            return jsonify(error='Novo remetente não informado.'), 400

        # Verifica se o novo remetente existe
        novo_remetente = Cliente.query.get(novo_remetente_id)
        if not novo_remetente:
            return jsonify(error='Remetente não encontrado.'), 404

        # Executa a atualização em lote (UPDATE WHERE id IN (...))
        # Isso é muito mais eficiente do que atualizar um por um
        count = Entrega.query.filter(Entrega.id.in_(entrega_ids)).update(
            {'remetente_id': novo_remetente.id}, 
            synchronize_session=False
        )
        
        db.session.commit()
        
        return jsonify(message=f'{count} entrega(s) atualizada(s) para o remetente {novo_remetente.razao_social}!')

    except Exception as e:
        db.session.rollback()
        print(f"Erro em bulk-update-remetente: {e}")
        return jsonify(error=f"Erro interno: {str(e)}"), 500
 
# --- API: MOTORISTAS ---
@app.route('/api/motoristas', methods=['GET'])
@login_required
def get_motoristas():
    try:
        motoristas = Motorista.query.order_by(Motorista.nome).all()
        return jsonify([m.to_dict() for m in motoristas])
    except Exception as e:
        print(f"Erro em /api/motoristas: {e}")
        return jsonify(error=f"Erro interno: {str(e)}"), 500

@app.route('/api/motoristas/import', methods=['POST'])
@login_required
def importar_motoristas():
    if 'arquivo' not in request.files:
        return jsonify(error='Nenhum arquivo enviado'), 400
    arquivo = request.files['arquivo']
    
    try:
        if arquivo.filename.endswith('.csv'):
            df = pd.read_csv(arquivo, dtype=str, header=None)
        else:
            df = pd.read_excel(arquivo, dtype=str, header=None)
        
        df = df.fillna('')
        novos_count = 0
        ignorados_count = 0
        
        codigos_existentes = set(row[0] for row in db.session.query(Motorista.codigo).all() if row[0])

        for _, row in df.iterrows():
            codigo = str(row.iloc[0]).strip()
            nome = str(row.iloc[1]).strip().upper()

            if not nome: # Nome é obrigatório
                continue
            
            if codigo and codigo in codigos_existentes:
                ignorados_count += 1
                continue
                
            novo_motorista = Motorista(
                codigo=codigo if codigo else None,
                nome=nome
            )
            db.session.add(novo_motorista)
            if codigo:
                codigos_existentes.add(codigo)
            novos_count += 1

        db.session.commit()
        return jsonify(message=f'Importação concluída! {novos_count} novos motoristas importados, {ignorados_count} ignorados (código já existente).')

    except Exception as e:
        db.session.rollback()
        print(f"Erro na importação de motoristas: {e}")
        return jsonify(error=f'Erro ao processar o arquivo: {str(e)}'), 500

# --- API: VEÍCULOS ---
@app.route('/api/veiculos', methods=['GET'])
@login_required
def get_veiculos():
    try:
        veiculos = Veiculo.query.order_by(Veiculo.placa).all()
        return jsonify([v.to_dict() for v in veiculos])
    except Exception as e:
        print(f"Erro em /api/veiculos: {e}")
        return jsonify(error=f"Erro interno: {str(e)}"), 500

@app.route('/api/veiculos/import', methods=['POST'])
@login_required
def importar_veiculos():
    if 'arquivo' not in request.files:
        return jsonify(error='Nenhum arquivo enviado'), 400
    arquivo = request.files['arquivo']
    
    try:
        if arquivo.filename.endswith('.csv'):
            df = pd.read_csv(arquivo, dtype=str, header=None)
        else:
            df = pd.read_excel(arquivo, dtype=str, header=None)
        
        df = df.fillna('')
        novos_count = 0
        ignorados_count = 0
        
        placas_existentes = set(row[0] for row in db.session.query(Veiculo.placa).all())

        for _, row in df.iterrows():
            placa = str(row.iloc[0]).strip().upper().replace('-', '') # Limpa e formata

            if not placa or placa in placas_existentes:
                ignorados_count += 1
                continue
                
            novo_veiculo = Veiculo(placa=placa)
            db.session.add(novo_veiculo)
            placas_existentes.add(placa)
            novos_count += 1

        db.session.commit()
        return jsonify(message=f'Importação concluída! {novos_count} novos veículos importados, {ignorados_count} ignorados (placa já existente).')

    except Exception as e:
        db.session.rollback()
        print(f"Erro na importação de veículos: {e}")
        return jsonify(error=f'Erro ao processar o arquivo: {str(e)}'), 500

# --- API: USUÁRIOS (Admin) ---
@app.route('/api/usuarios', methods=['GET', 'POST'])
@login_required
def handle_usuarios():
    if session.get('user_permission') != 'admin':
        return jsonify(error='Acesso negado'), 403

    if request.method == 'POST':
        try:
            data = request.json
            nome_usuario = data.get('nome_usuario')
            senha = data.get('senha')
            permissao = data.get('permissao')
            
            if not nome_usuario or not senha or not permissao:
                return jsonify(error='Todos os campos são obrigatórios'), 400
            
            if Usuario.query.filter_by(nome_usuario=nome_usuario).first():
                return jsonify(error='Nome de usuário já existe'), 409

            novo_usuario = Usuario(
                nome_usuario=nome_usuario,
                senha_hash=generate_password_hash(senha),
                permissao=permissao
            )
            db.session.add(novo_usuario)
            db.session.commit()
            return jsonify(message='Usuário cadastrado com sucesso!'), 201
        except Exception as e:
            db.session.rollback()
            return jsonify(error=f"Erro interno: {str(e)}"), 500

    if request.method == 'GET':
        usuarios = Usuario.query.all()
        return jsonify([{'id': u.id, 'nome_usuario': u.nome_usuario, 'permissao': u.permissao} for u in usuarios])

@app.route('/api/usuarios/<int:user_id>', methods=['PUT', 'DELETE'])
@login_required
def handle_usuario(user_id):
    if session.get('user_permission') != 'admin':
        return jsonify(error='Acesso negado'), 403
        
    if user_id == 1: # Proteção do admin mestre
        return jsonify(error='Não é possível modificar o usuário admin principal'), 403

    usuario = Usuario.query.get(user_id)
    if not usuario:
        return jsonify(error='Usuário não encontrado'), 404

    if request.method == 'DELETE':
        try:
            db.session.delete(usuario)
            db.session.commit()
            return jsonify(message='Usuário excluído com sucesso!')
        except Exception as e:
            db.session.rollback()
            return jsonify(error=f"Erro interno: {str(e)}"), 500

    if request.method == 'PUT':
        try:
            data = request.json
            nome_usuario = data.get('nome_usuario')
            senha = data.get('senha')
            permissao = data.get('permissao')
            
            if not nome_usuario or not permissao:
                 return jsonify(error='Nome de usuário e permissão são obrigatórios'), 400
            
            # Verifica se o novo nome de usuário já está em uso por *outro* usuário
            usuario_existente = Usuario.query.filter(Usuario.nome_usuario == nome_usuario, Usuario.id != user_id).first()
            if usuario_existente:
                return jsonify(error='Nome de usuário já está em uso por outro usuário'), 409

            usuario.nome_usuario = nome_usuario
            usuario.permissao = permissao
            if senha: # Só atualiza a senha se uma nova for fornecida
                usuario.senha_hash = generate_password_hash(senha)
                
            db.session.commit()
            return jsonify(message='Usuário atualizado com sucesso!')
        except Exception as e:
            db.session.rollback()
            return jsonify(error=f"Erro interno: {str(e)}"), 500

# --- NOVA ROTA: AGRUPAR ENTREGAS (MÓDULO 7) ---
@app.route('/api/entregas/agrupar', methods=['POST'])
@login_required
def agrupar_entregas():
    try:
        data = request.json
        entrega_ids = data.get('entrega_ids')

        if not entrega_ids or len(entrega_ids) < 2:
            return jsonify(error='Selecione pelo menos 2 entregas para agrupar.'), 400

        # Busca as entregas no banco
        entregas = Entrega.query.filter(Entrega.id.in_(entrega_ids)).all()
        
        if not entregas:
            return jsonify(error='Entregas não encontradas.'), 404

        # Validação 1: Verificar se todas são do mesmo cliente (Destinatário)
        primeiro_cliente_id = entregas[0].cliente_id
        if any(e.cliente_id != primeiro_cliente_id for e in entregas):
            return jsonify(error='Todas as entregas devem pertencer ao mesmo Cliente (Destinatário).'), 400

        # A "sobrevivente" será a primeira da lista
        entrega_principal = entregas[0]
        
        # Variáveis para somar/concatenar
        total_peso = entrega_principal.peso_bruto or 0.0
        total_frete = entrega_principal.valor_frete or 0.0
        total_cubado = entrega_principal.peso_cubado or 0.0
        notas_fiscais = [str(entrega_principal.nota_fiscal)] if entrega_principal.nota_fiscal else []

        # Itera sobre as outras para somar e depois excluir
        for e in entregas[1:]:
            total_peso += (e.peso_bruto or 0.0)
            total_frete += (e.valor_frete or 0.0)
            total_cubado += (e.peso_cubado or 0.0)
            if e.nota_fiscal:
                notas_fiscais.append(str(e.nota_fiscal))
            
            # Marca para deletar do banco
            db.session.delete(e)

        # Atualiza a entrega principal
        entrega_principal.peso_bruto = total_peso
        entrega_principal.valor_frete = total_frete
        entrega_principal.peso_cubado = total_cubado
        # Concatena as NFs
        entrega_principal.nota_fiscal = " / ".join(filter(None, notas_fiscais))

        db.session.commit()
        
        return jsonify(message=f'Sucesso! {len(entregas)} entregas foram agrupadas em uma única linha.')

    except Exception as e:
        db.session.rollback()
        print(f"Erro em agrupar_entregas: {e}")
        return jsonify(error=f"Erro interno: {str(e)}"), 500
        
# --- Servir arquivos estáticos (CSS, JS) ---
@app.route('/<path:filename>')
def serve_static(filename):
    if filename in ['style.css', 'script.js', 'clientes.js', 'montagem.js', 'consulta.js', 'motoristas.js', 'veiculos.js', 'usuarios.js']:
        return send_from_directory('.', filename)
    # Correção do bug do favicon.ico
    return "Arquivo não encontrado", 404

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, host='0.0.0.0', port=5000)