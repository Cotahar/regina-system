#
# models.py (VERSÃO 7 - CORRIGINDO AMBIGUIDADE NOS DOIS LADOS)
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

    def to_dict(self):
        """Converte o objeto Motorista para um dicionário (JSON)."""
        return {
            'id': self.id,
            'codigo': self.codigo,
            'nome': self.nome,
            'text': f"{(self.codigo or '')} - {(self.nome or '').upper()}"
        }

# MÓDULO 1: Novo modelo de Veículo
class Veiculo(db.Model):
    __tablename__ = 'veiculos'
    id = db.Column(db.Integer, primary_key=True)
    placa = db.Column(db.String, unique=True, nullable=False) 
    # Relação com Carga
    cargas = db.relationship('Carga', back_populates='veiculo_rel', lazy=True)

    def to_dict(self):
        """Converte o objeto Veiculo para um dicionário (JSON)."""
        return {
            'id': self.id,
            'placa': self.placa,
            'text': (self.placa or '').upper()
        }

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
    is_remetente = db.Column(db.Boolean, default=False, nullable=False)
    
    # Relação como Destinatário
    # LADO 1: O Cliente usa a chave 'Entrega.cliente_id' para encontrar suas entregas
    entregas_como_destinatario = db.relationship('Entrega', 
                                                 foreign_keys='Entrega.cliente_id', 
                                                 back_populates='cliente',
                                                 lazy=True)
    
    # Relação como Remetente
    # LADO 1: O Cliente usa a chave 'Entrega.remetente_id' para encontrar suas remessas
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
                               
    def to_dict(self):
        """Converte o objeto Carga para um dicionário (JSON)."""
        return {
            'id': self.id,
            'codigo_carga': self.codigo_carga,
            'origem': self.origem,
            'status': self.status,
            'motorista_id': self.motorista_id,
            'veiculo_id': self.veiculo_id,
            'frete_pago': self.frete_pago,
            'data_agendamento': self.data_agendamento,
            'data_carregamento': self.data_carregamento,
            'previsao_entrega': self.previsao_entrega,
            'observacoes': self.observacoes,
            'data_finalizacao': self.data_finalizacao
        }


class Entrega(db.Model):
    __tablename__ = 'entregas'
    id = db.Column(db.Integer, primary_key=True)
    
    carga_id = db.Column(db.Integer, db.ForeignKey('cargas.id'), nullable=True) 
    cliente_id = db.Column(db.Integer, db.ForeignKey('clientes.id'), nullable=False) # Destinatário
    remetente_id = db.Column(db.Integer, db.ForeignKey('clientes.id'), nullable=True) # Remetente
    
    peso_bruto = db.Column(db.Float)
    valor_frete = db.Column(db.Float)
    peso_cubado = db.Column(db.Float, nullable=True)
    nota_fiscal = db.Column(db.String, nullable=True)
    cidade_entrega = db.Column(db.String, nullable=True) # Override
    estado_entrega = db.Column(db.String, nullable=True) # Override
    is_last_delivery = db.Column(db.Integer, default=0) 

    # Relação com Carga
    carga = db.relationship('Carga', foreign_keys='Entrega.carga_id', back_populates='entregas')

    # Relação com o Destinatário
    # LADO 2: A Entrega usa a coluna 'cliente_id' para encontrar seu cliente
    cliente = db.relationship('Cliente', 
                          foreign_keys=[cliente_id], 
                          back_populates='entregas_como_destinatario')

    # Relação com o Remetente
    # LADO 2: A Entrega usa a coluna 'remetente_id' para encontrar seu remetente
    remetente = db.relationship('Cliente', 
                            foreign_keys=[remetente_id], 
                            back_populates='entregas_como_remetente')

    def to_dict(self):
        """Converte o objeto Entrega para um dicionário (JSON)."""
        return {
            'id': self.id,
            'carga_id': self.carga_id,
            'cliente_id': self.cliente_id,
            'remetente_id': self.remetente_id,
            'peso_bruto': self.peso_bruto,
            'valor_frete': self.valor_frete,
            'peso_cubado': self.peso_cubado,
            'nota_fiscal': self.nota_fiscal,
            'cidade_entrega': self.cidade_entrega,
            'estado_entrega': self.estado_entrega,
            'is_last_delivery': self.is_last_delivery
        }

class Usuario(db.Model):
    __tablename__ = 'usuarios'
    id = db.Column(db.Integer, primary_key=True)
    nome_usuario = db.Column(db.String, unique=True, nullable=False)
    senha_hash = db.Column(db.String, nullable=False)
    permissao = db.Column(db.String, nullable=False)