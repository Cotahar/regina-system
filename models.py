# A CORREÇÃO ESTÁ NESTA LINHA: importamos do novo arquivo 'database'.
from database import db

class Cliente(db.Model):
    __tablename__ = 'clientes'
    id = db.Column(db.Integer, primary_key=True)
    codigo_cliente = db.Column(db.String, unique=True, nullable=False)
    razao_social = db.Column(db.String, nullable=False)
    ddd = db.Column(db.String)
    telefone = db.Column(db.String)
    cidade = db.Column(db.String)
    estado = db.Column(db.String)
    observacoes = db.Column(db.String)

class Carga(db.Model):
    __tablename__ = 'cargas'
    id = db.Column(db.Integer, primary_key=True)
    codigo_carga = db.Column(db.String, unique=True, nullable=False)
    origem = db.Column(db.String, nullable=False)
    status = db.Column(db.String, nullable=False, default='Pendente')
    motorista = db.Column(db.String)
    placa = db.Column(db.String)
    data_agendamento = db.Column(db.String)
    data_carregamento = db.Column(db.String)
    previsao_entrega = db.Column(db.String)
    observacoes = db.Column(db.String)
    data_finalizacao = db.Column(db.String)
    entregas = db.relationship('Entrega', backref='carga', lazy=True, cascade="all, delete-orphan")

class Entrega(db.Model):
    __tablename__ = 'entregas'
    id = db.Column(db.Integer, primary_key=True)
    carga_id = db.Column(db.Integer, db.ForeignKey('cargas.id'), nullable=False)
    cliente_id = db.Column(db.Integer, db.ForeignKey('clientes.id'), nullable=False)
    peso_bruto = db.Column(db.Float)
    valor_frete = db.Column(db.Float)
    peso_cobrado = db.Column(db.Float)
    is_last_delivery = db.Column(db.Integer, default=0)
    cliente = db.relationship('Cliente')

class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    nome_usuario = db.Column(db.String, unique=True, nullable=False)
    senha_hash = db.Column(db.String, nullable=False)
    permissao = db.Column(db.String, nullable=False)