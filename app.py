# app.py CORRIGIDO (V7.2 - CORREÇÃO DE INDENTAÇÃO)

import time
import pandas as pd
import os
from flask import Flask, request, jsonify, send_from_directory, session, redirect, url_for
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
        clientes = Cliente.query.order_by(Cliente.razao_social).all()
        clientes_data = []
        for c in clientes:
            entregas_count = Entrega.query.filter_by(cliente_id=c.id).count()
            
            # >>>>> CORREÇÃO 1: Adicionado `(c.razao_social or '')` para evitar erro .upper() em Nulos
            text = f"{(c.codigo_cliente or '')} - {(c.razao_social or '').upper()}"
            
            clientes_data.append({
                'id': c.id,
                'codigo_cliente': c.codigo_cliente,
                'razao_social': c.razao_social,
                'telefone_completo': f"({c.ddd or ''}) {c.telefone or ''}".strip(),
                'cidade': c.cidade,
                'estado': c.estado,
                'is_remetente': c.is_remetente,
                'entregas_count': entregas_count,
                'text': text
            })
        return jsonify(clientes_data)
    except Exception as e:
        print(f"Erro em /api/clientes/detalhes: {e}")
        return jsonify(error=f"Erro interno ao buscar clientes: {str(e)}"), 500


@app.route('/api/clientes', methods=['GET'])
@login_required
def get_clientes():
    try:
        clientes = Cliente.query.all()
        # Simplificado para o Select2
        clientes_data = [{
            'id': c.id, 
            'text': f"{(c.codigo_cliente or '')} - {(c.razao_social or '').upper()}", # >>>>> CORREÇÃO 2: Proteção contra Nulos
            'cidade': c.cidade,
            'estado': c.estado,
            'is_remetente': c.is_remetente
        } for c in clientes]
        return jsonify(clientes_data)
    except Exception as e:
        print(f"Erro em /api/clientes: {e}")
        return jsonify(error=f"Erro interno ao buscar clientes: {str(e)}"), 500

@app.route('/api/clientes', methods=['POST'])
@login_required
def importar_clientes():
    if 'arquivo' not in request.files:
        return jsonify(error='Nenhum arquivo enviado'), 400
    arquivo = request.files['arquivo']
    
    try:
        if arquivo.filename.endswith('.csv'):
            df = pd.read_csv(arquivo, dtype=str)
        else:
            df = pd.read_excel(arquivo, dtype=str)
        
        df = df.fillna('')
        novos_count = 0
        ignorados_count = 0
        
        codigos_existentes = set(row[0] for row in db.session.query(Cliente.codigo_cliente).all())

        for _, row in df.iterrows():
            codigo = str(row.iloc[0]).strip()
            if not codigo or codigo in codigos_existentes:
                ignorados_count += 1
                continue
                
            razao_social = str(row.iloc[1]).strip().upper()
            cidade = str(row.iloc[2]).strip().upper()
            estado = str(row.iloc[3]).strip().upper()[:2]
            ddd = str(row.iloc[4]).strip()[:2]
            telefone = str(row.iloc[5]).strip()
            observacoes = str(row.iloc[6]).strip()

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

    except Exception as e:
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

# --- API: CARGAS ---
@app.route('/api/cargas', methods=['GET', 'POST'])
@login_required
def handle_cargas():
    # --- POST (Criação da Carga Rápida V1) ---
    if request.method == 'POST':
        try:
            data = request.json
            cliente_id = data.get('cliente_id')
            peso_bruto = data.get('peso_bruto')
            
            # Busca o remetente padrão V1
            remetente_padrao = Cliente.query.filter_by(codigo_cliente='000-REMETENTE-V1').first()
            if not remetente_padrao:
                return jsonify(error="Cliente '000-REMETENTE-V1' não cadastrado. Crie este cliente na tela de Clientes e marque-o como Remetente."), 400

            cliente = Cliente.query.get(cliente_id)
            if not cliente:
                 return jsonify(error="Cliente (Destinatário) não encontrado."), 404

            # Cria a Carga (Rascunho)
            nova_carga = Carga(
                codigo_carga=f"RASC-{int(time.time())}",
                origem=remetente_padrao.cidade.upper() if remetente_padrao.cidade else 'ORIGEM V1',
                status='Rascunho'
            )
            db.session.add(nova_carga)
            db.session.flush() # Pega o ID da Carga antes de commitar

            # Cria a Entrega
            nova_entrega = Entrega(
                carga_id=nova_carga.id,
                cliente_id=cliente.id,
                remetente_id=remetente_padrao.id,
                peso_bruto=peso_bruto,
                cidade_entrega=cliente.cidade, # Usa dados do cliente
                estado_entrega=cliente.estado # Usa dados do cliente
            )
            db.session.add(nova_entrega)
            
            # Confirma a Carga (Muda status)
            nova_carga.status = 'Pendente'
            nova_carga.codigo_carga = f"CARGA-{int(time.time())}"
            
            db.session.commit()
            return jsonify(message=f'Carga {nova_carga.codigo_carga} criada com sucesso!'), 201

        except Exception as e:
            db.session.rollback()
            print(f"Erro em POST /api/cargas (V1): {e}")
            return jsonify(error=f"Erro interno: {str(e)}"), 500
            
    # --- GET (Listagem Painel Principal) ---
    if request.method == 'GET':
        try:
            status_filter = request.args.get('status')
            
            # Filtra para não mostrar Rascunhos nem Finalizadas no painel
            base_query = Carga.query.filter(Carga.status != 'Rascunho', Carga.status != 'Finalizada')

            if status_filter:
                base_query = base_query.filter(Carga.status == status_filter)
                
            cargas = base_query.order_by(Carga.data_carregamento.desc()).all()
            
            cargas_data = []
            
            # ***** INÍCIO DA CORREÇÃO DE INDENTAÇÃO *****
            # Este bloco 'for' agora está DENTRO do 'try'
            for carga in cargas:
                carga_dict = carga.to_dict()
                
                # Dados das relações (acesso seguro)
                carga_dict['motorista_nome'] = carga.motorista_rel.nome if carga.motorista_rel else None
                carga_dict['placa_veiculo'] = carga.veiculo_rel.placa if carga.veiculo_rel else None
                
                # Processamento de entregas
                carga_dict['entregas'] = [e.to_dict() for e in carga.entregas]
                carga_dict['num_entregas'] = len(carga.entregas)
                
                # --- CORREÇÃO DE PESO E DESTINO ---
                peso_total_carga = 0.0
                destinos_set = set()
                
                for e in carga.entregas:
                    # 1. Acumula o peso
                    if e.peso_bruto:
                        peso_total_carga += e.peso_bruto

                    # 2. Define destinos
                    if e.cliente: # Garante que a entrega tem um cliente associado
                        cidade_str = (e.cliente.cidade or "").upper()
                        estado_str = (e.cliente.estado or "").upper()
                        if cidade_str or estado_str:
                            destinos_set.add(f"{cidade_str}-{estado_str}")
                
                destinos_list = sorted(list(destinos_set)) 
            
                carga_dict['destinos'] = destinos_list
                carga_dict['destino_principal'] = destinos_list[0] if destinos_list else 'N/A'
                
                # 3. Adiciona o peso total ao dicionário
                carga_dict['peso_total'] = peso_total_carga 
                
                cargas_data.append(carga_dict)
            # ***** FIM DA CORREÇÃO DE INDENTAÇÃO *****
                
            return jsonify(cargas_data)
        
        except Exception as e:
            print(f"Erro em GET /api/cargas: {e}")
            traceback.print_exc() # Imprime o stack trace completo no log do servidor
            return jsonify(error=f"Erro interno ao buscar cargas: {str(e)}"), 500

@app.route('/api/cargas/consulta', methods=['GET'])
@login_required
def get_cargas_consulta():
    try:
        # >>>>> CORREÇÃO 5: Query simplificada para evitar crash inicial
        query = Carga.query.filter(Carga.status != 'Rascunho')

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
            for e in carga.entregas:
                if e.cliente: # Garante que a entrega tem um cliente associado
                    cidade_str = (e.cliente.cidade or "").upper() # (ou "") garante que .upper() não falhe
                    estado_str = (e.cliente.estado or "").upper()
                    if cidade_str or estado_str: # Evita adicionar "- " se ambos forem nulos
                        destinos_set.add(f"{cidade_str}-{estado_str}")
            destinos = sorted(list(destinos_set))

            cargas_data.append({
                'id': carga.id,
                'codigo_carga': carga.codigo_carga,
                'status': carga.status,
                'origem': carga.origem,
                'destino_principal': destinos[0] if destinos else 'N/A',
                'motorista_nome': carga.motorista_rel.nome if carga.motorista_rel else 'N/A',
                'num_entregas': len(carga.entregas),
                'peso_total_bruto': peso_total_bruto,
                'data_finalizacao': carga.data_finalizacao,
                
                # CHAVES DE COMPATIBILIDADE (para consulta.js)
                'destino': destinos[0] if destinos else 'N/A',
                'motorista': carga.motorista_rel.nome if carga.motorista_rel else 'N/A',
                'peso_total': peso_total_bruto
            })
            
        return jsonify(
            cargas=cargas_data,
            total=total,
            page=page,
            per_page=per_page,
            total_pages=(total + per_page - 1) // per_page
        )
    except Exception as e:
        print(f"Erro em /api/cargas/consulta: {e}")
        traceback.print_exc()
        return jsonify(error=f"Erro interno ao consultar cargas: {str(e)}"), 500


@app.route('/api/cargas/<int:carga_id>', methods=['GET'])
@login_required
def get_carga_detalhes(carga_id):
    try:
        carga = Carga.query.get(carga_id)
        
        if not carga:
            return jsonify(error='Carga não encontrada'), 404

        # 1. Prepara os detalhes da carga
        detalhes_carga = carga.to_dict()
        detalhes_carga['motorista_nome'] = carga.motorista_rel.nome if carga.motorista_rel else None
        detalhes_carga['placa_veiculo'] = carga.veiculo_rel.placa if carga.veiculo_rel else None

        # 2. Prepara os detalhes das entregas (com TODOS os campos que o modal precisa)
        entregas_data = []
        for entrega in carga.entregas:
            entregas_data.append({
                'id': entrega.id,
                'remetente_id': entrega.remetente_id,
                'cliente_id': entrega.cliente_id,
                # Dados do Remetente
                'remetente_nome': (entrega.remetente.razao_social or 'N/A') if entrega.remetente else 'N/A',
                'remetente_cidade': (entrega.remetente.cidade or 'N/A') if entrega.remetente else 'N/A', 
                # Dados do Destinatário (Cliente)
                'razao_social': (entrega.cliente.razao_social or 'N/A') if entrega.cliente else 'N/A',
                'cidade': (entrega.cliente.cidade or '') if entrega.cliente else '',
                'estado': (entrega.cliente.estado or '') if entrega.cliente else '',
                'ddd': (entrega.cliente.ddd or '') if entrega.cliente else '',
                'telefone': (entrega.cliente.telefone or '') if entrega.cliente else '',
                'obs_cliente': (entrega.cliente.observacoes or '') if entrega.cliente else '',
                # Campos de Override da Entrega
                'cidade_entrega_override': entrega.cidade_entrega,
                'estado_entrega_override': entrega.estado_entrega,
                # Valores da Entrega
                'peso_bruto': entrega.peso_bruto,
                'valor_frete': entrega.valor_frete,
                'peso_cubado': entrega.peso_cubado,
                'nota_fiscal': entrega.nota_fiscal,
                'is_last_delivery': entrega.is_last_delivery
            })

        # 3. Retorna no formato que o JavaScript (script.js) espera
        return jsonify({
            'detalhes_carga': detalhes_carga,
            'entregas': entregas_data
        })
    except Exception as e:
        print(f"Erro em /api/cargas/<id>: {e}")
        traceback.print_exc()
        return jsonify(error=f"Erro interno: {str(e)}"), 500
        
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
        
@app.route('/api/cargas/<int:carga_id>/status', methods=['PUT'])
@login_required
def update_carga_status(carga_id):
    try:
        data = request.json
        carga = Carga.query.get(carga_id)
        if not carga:
            return jsonify(error='Carga não encontrada'), 404

        # Atualiza todos os campos que podem vir do frontend
        # (salvar, agendar, iniciar-transito, finalizar)
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
# --- API: ENTREGAS (Disponíveis e Edição) ---
@app.route('/api/entregas/disponiveis', methods=['GET', 'POST'])
@login_required
def handle_entregas_disponiveis():
    if request.method == 'POST':
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
            entregas = Entrega.query.filter_by(carga_id=None).all()
            entregas_data = []
            for e in entregas:
                # >>>>> CORREÇÃO 9: Acesso seguro (à prova de nulos)
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

        # Atualiza campos
        entrega.remetente_id = data.get('remetente_id')
        entrega.peso_bruto = data.get('peso_bruto')
        entrega.valor_frete = data.get('valor_frete')
        entrega.peso_cubado = data.get('peso_cubado')
        entrega.nota_fiscal = data.get('nota_fiscal')
        
        # Campos de override
        entrega.cidade_entrega = data.get('cidade_entrega')
        entrega.estado_entrega = data.get('estado_entrega')
        
        db.session.commit()
        return jsonify(message='Entrega atualizada com sucesso!')
    except Exception as e:
        db.session.rollback()
        print(f"Erro ao atualizar entrega {entrega_id}: {e}")
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