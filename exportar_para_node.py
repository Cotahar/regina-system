"""
Exporta todos os dados do banco atual (Flask/SQLAlchemy - Postgres ou SQLite local)
para um unico arquivo JSON, para ser importado pelo sistema novo (Node.js/SQLite)
atraves do script v2/src/db/import-from-python.js.

Uso:
    python exportar_para_node.py

Gera: export_dados.json (na raiz do projeto)

Observacao: as fotos de avarias ficam armazenadas no Google Drive no sistema
antigo. Este export traz apenas os metadados (id do arquivo no Drive), pois o
sistema novo guarda fotos localmente em v2/uploads/avarias/ - baixe as fotos
importantes do Drive manualmente, se precisar delas no sistema novo.
"""
import json
from app import app, db
from models import (
    Motorista, Veiculo, Unidade, TipoCte, FormaPagamento, Cliente,
    Carga, Entrega, Usuario, Marca, Avaria, AvariaItem, AvariaFoto
)


def serializar_data(valor):
    if valor is None:
        return None
    if hasattr(valor, 'isoformat'):
        return valor.isoformat()
    return valor


def exportar():
    with app.app_context():
        dados = {
            'motoristas': [
                {'id': m.id, 'codigo': m.codigo, 'nome': m.nome}
                for m in Motorista.query.all()
            ],
            'veiculos': [
                {'id': v.id, 'placa': v.placa}
                for v in Veiculo.query.all()
            ],
            'unidades': [
                {
                    'id': u.id, 'nome': u.nome, 'uf': u.uf,
                    'is_matriz': bool(u.is_matriz), 'tipo_cte_padrao_id': u.tipo_cte_padrao_id
                }
                for u in Unidade.query.all()
            ],
            'tipos_cte': [
                {'id': t.id, 'descricao': t.descricao}
                for t in TipoCte.query.all()
            ],
            'formas_pagamento': [
                {'id': f.id, 'descricao': f.descricao}
                for f in FormaPagamento.query.all()
            ],
            'clientes': [
                {
                    'id': c.id, 'codigo_cliente': c.codigo_cliente, 'razao_social': c.razao_social,
                    'ddd': c.ddd, 'telefone': c.telefone, 'cidade': c.cidade, 'estado': c.estado,
                    'observacoes': c.observacoes, 'is_remetente': bool(c.is_remetente),
                    'padrao_forma_pagamento_id': c.padrao_forma_pagamento_id,
                    'padrao_tipo_pagamento': c.padrao_tipo_pagamento
                }
                for c in Cliente.query.all()
            ],
            'marcas': [
                {'id': m.id, 'nome': m.nome}
                for m in Marca.query.all()
            ],
            'usuarios': [
                {'id': u.id, 'nome_usuario': u.nome_usuario, 'senha_hash': u.senha_hash, 'permissao': u.permissao}
                for u in Usuario.query.all()
            ],
            'cargas': [
                {
                    'id': c.id, 'codigo_carga': c.codigo_carga, 'origem': c.origem, 'status': c.status,
                    'motorista_id': c.motorista_id, 'veiculo_id': c.veiculo_id, 'frete_pago': c.frete_pago,
                    'data_agendamento': serializar_data(c.data_agendamento),
                    'data_carregamento': serializar_data(c.data_carregamento),
                    'previsao_entrega': serializar_data(c.previsao_entrega),
                    'observacoes': c.observacoes,
                    'data_finalizacao': serializar_data(c.data_finalizacao),
                    'observacoes_faturamento': c.observacoes_faturamento,
                    'rota_manifesto': c.rota_manifesto,
                    'vale_pedagio_marca': c.vale_pedagio_marca,
                    'vale_pedagio_rota': c.vale_pedagio_rota,
                    'vale_pedagio_eixos': c.vale_pedagio_eixos,
                    'adiantamento_percentual': c.adiantamento_percentual,
                    'adiantamento_valor': c.adiantamento_valor
                }
                for c in Carga.query.all()
            ],
            'entregas': [
                {
                    'id': e.id, 'carga_id': e.carga_id, 'cliente_id': e.cliente_id, 'remetente_id': e.remetente_id,
                    'peso_bruto': e.peso_bruto, 'valor_frete': e.valor_frete, 'peso_cubado': e.peso_cubado,
                    'nota_fiscal': e.nota_fiscal, 'cidade_entrega': e.cidade_entrega, 'estado_entrega': e.estado_entrega,
                    'is_last_delivery': e.is_last_delivery, 'valor_tonelada': e.valor_tonelada,
                    'tipo_pagamento': e.tipo_pagamento, 'unidade_id': e.unidade_id, 'tipo_cte_id': e.tipo_cte_id,
                    'forma_pagamento_id': e.forma_pagamento_id
                }
                for e in Entrega.query.all()
            ],
            'avarias': [
                {
                    'id': a.id, 'nota_fiscal': a.nota_fiscal, 'entrega_id': a.entrega_id, 'marca_id': a.marca_id,
                    'tipo_descarga': a.tipo_descarga, 'observacoes': a.observacoes, 'status': a.status,
                    'data_criacao': serializar_data(a.data_criacao), 'registro_envio': a.registro_envio,
                    'retorno_fabrica': a.retorno_fabrica, 'valor_cobranca': a.valor_cobranca
                }
                for a in Avaria.query.all()
            ],
            'avaria_itens': [
                {
                    'id': i.id, 'avaria_id': i.avaria_id, 'produto_nome': i.produto_nome,
                    'quantidade': i.quantidade, 'unidade_medida': i.unidade_medida
                }
                for i in AvariaItem.query.all()
            ],
            'avaria_fotos_drive': [
                {'id': f.id, 'avaria_id': f.avaria_id, 'google_drive_id': f.google_drive_id, 'drive_link': f.drive_link}
                for f in AvariaFoto.query.all()
            ]
        }

    with open('export_dados.json', 'w', encoding='utf-8') as arquivo:
        json.dump(dados, arquivo, ensure_ascii=False, indent=2)

    total = sum(len(v) for v in dados.values())
    print(f"Exportado com sucesso! {total} registros no total -> export_dados.json")
    print("Copie esse arquivo para v2/ e rode: node src/db/import-from-python.js")


if __name__ == '__main__':
    exportar()
