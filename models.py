#
# models.py (ATUALIZADO PARA V2 - CORRIGINDO WARNINGS)
#
from database import db

# MÓDULO 1: Novo modelo de Motorista
class Motorista(db.Model):
    __tablename__ = 'motoristas'
    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String, unique=True, nullable=True) 
    nome = db.Column(db.String, nullable=False)
    # Relação com Carga
    cargas = db.relationship('Carga', back_populates='motorista_rel', lazy=True)

# MÓDULO 1: Novo modelo de Veículo
class Veiculo(db.Model):
    __tablename__ = 'veiculos'
    id = db.Column(db.Integer, primary_key=True)
    placa = db.Column(db.String, unique=True, nullable=False) 
    # Relação com Carga
    cargas = db.relationship('Carga', back_populates='veiculo_rel', lazy=True)

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
    
    # --- LINHA NOVA ADICIONADA ---
    is_remetente = db.Column(db.Boolean, default=False, nullable=False)
    # --- FIM DA LINHA NOVA ---
    
    # Relação como Destinatário
    entregas_como_destinatario = db.relationship('Entrega', 
                                                 foreign_keys='Entrega.cliente_id', 
                                                 back_populates='cliente',
                                                 lazy=True)
    
    # Relação como Remetente
    entregas_como_remetente = db.relationship('Entrega', 
                                               foreign_keys='Entrega.remetente_id', 
                                               back_populates='remetente',
                                               lazy=True)

class Carga(db.Model):
    __tablename__ = 'cargas'
    id = db.Column(db.Integer, primary_key=True)
    codigo_carga = db.Column(db.String, unique=True, nullable=False)
    origem = db.Column(db.String, nullable=False)
    status = db.Column(db.String, nullable=False, default='Pendente') 
    
    motorista_id = db.Column(db.Integer, db.ForeignKey('motoristas.id'), nullable=True)
    veiculo_id = db.Column(db.Integer, db.ForeignKey('veiculos.id'), nullable=True)
    frete_pago = db.Column(db.Float, nullable=True)
    
    data_agendamento = db.Column(db.String)
    data_carregamento = db.Column(db.String)
    previsao_entrega = db.Column(db.String)
    observacoes = db.Column(db.String)
    data_finalizacao = db.Column(db.String)
    
    # Relação com Motorista
    motorista_rel = db.relationship('Motorista', back_populates='cargas')
    # Relação com Veículo
    veiculo_rel = db.relationship('Veiculo', back_populates='cargas')
    # Relação com Entrega
    entregas = db.relationship('Entrega', 
                               back_populates='carga',
                               lazy=True, 
                               cascade="all, delete-orphan", 
                               foreign_keys='Entrega.carga_id')

class Entrega(db.Model):
    __tablename__ = 'entregas'
    id = db.Column(db.Integer, primary_key=True)
    
    carga_id = db.Column(db.Integer, db.ForeignKey('cargas.id'), nullable=True) 
    cliente_id = db.Column(db.Integer, db.ForeignKey('clientes.id'), nullable=False) # Destinatário
    remetente_id = db.Column(db.Integer, db.ForeignKey('clientes.id'), nullable=False) # Remetente
    
    peso_bruto = db.Column(db.Float)
    valor_frete = db.Column(db.Float)
    peso_cubado = db.Column(db.Float, nullable=True)
    nota_fiscal = db.Column(db.String, nullable=True)
    cidade_entrega = db.Column(db.String, nullable=True)
    estado_entrega = db.Column(db.String, nullable=True)
    is_last_delivery = db.Column(db.Integer, default=0) 

    # Relação com Carga
    carga = db.relationship('Carga', foreign_keys=[carga_id], back_populates='entregas')

    # Relação com o Destinatário
    cliente = db.relationship('Cliente', 
                              foreign_keys=[cliente_id], 
                              back_populates='entregas_como_destinatario')

    # Relação com o Remetente
    remetente = db.relationship('Cliente', 
                                foreign_keys=[remetente_id], 
                                back_populates='entregas_como_remetente')

class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    nome_usuario = db.Column(db.String, unique=True, nullable=False)
    senha_hash = db.Column(db.String, nullable=False)
    permissao = db.Column(db.String, nullable=False)