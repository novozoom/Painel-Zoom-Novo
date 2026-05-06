from flask import Blueprint, jsonify, request
from flask_cors import CORS
import datetime
import os
from supabase import create_client, Client

bp = Blueprint("faturamento_atual", __name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://izvddltdhxmfgxlimefl.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dmRkbHRkaHhtZmd4bGltZWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzQ0NTgsImV4cCI6MjA4ODgxMDQ1OH0.uo45flx-W8n2CXbd8evdJODFDPIo1J5hbBeIIihmGK8")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

@bp.route('/api/sync', methods=['POST'])
def sync_aton():
    data_inicio_str = request.json.get('data_inicio') if request.is_json else None
    data_fim_str = request.json.get('data_fim') if request.is_json else None
    
    if data_inicio_str and data_fim_str:
        data_inicio = datetime.datetime.strptime(data_inicio_str, '%Y-%m-%d').date()
        data_fim = datetime.datetime.strptime(data_fim_str, '%Y-%m-%d').date()
    else:
        data_inicio = datetime.datetime.now().date()
        data_fim = datetime.datetime.now().date()
        
    try:
        from sync_supabase import sincronizar_pedidos
        resultado = sincronizar_pedidos(data_inicio, data_fim)
        return jsonify(resultado)
    except Exception as e:
        import traceback
        return jsonify({"status": "error", "message": str(e), "traceback": traceback.format_exc()}), 500

@bp.route('/api/resultados')
def obter_resultados():
    data_inicio_str = request.args.get('data_inicio')
    data_fim_str = request.args.get('data_fim')
    
    if data_inicio_str and data_fim_str:
        data_inicio = data_inicio_str + " 00:00:00"
        data_fim = data_fim_str + " 23:59:59"
    else:
        hoje = datetime.datetime.now().date().strftime('%Y-%m-%d')
        data_inicio = hoje + " 00:00:00"
        data_fim = hoje + " 23:59:59"

    # Buscar do Supabase
    response = supabase.table('dashboard_pedidos').select('*').gte('data_venda', data_inicio).lte('data_venda', data_fim).execute()
    
    # Mapear de volta para o formato esperado pelo React
    resultados = []
    for item in response.data:
        resultados.append({
            "PEDIDO": item.get("pedido_id"),
            "URL": item.get("url_imagem"),
            "DATA": item.get("data_venda"),
            "ORIGEM": item.get("origem"),
            "ORIGEM_NOME": item.get("origem_nome"),
            "VENDEDOR": item.get("vendedor"),
            "VLRFRETE": item.get("vlr_frete_real"),
            "TOTAL_PEDIDO": item.get("total_pedido"),
            "VLRFRETE_REAL": item.get("vlr_frete_real"),
            "VLRFRETE_COMPRADOR": item.get("vlr_frete_comprador"),
            "POSICAO": item.get("posicao"),
            "INTEGRACAO": item.get("integracao"),
            "QUANT_ITENS": item.get("quant_itens"),
            "VLR_UNIT": item.get("vlr_unit"),
            "VLR_TOTAL": item.get("vlr_total"),
            "VLR_FRETE": item.get("vlr_frete_real"),
            "CODID": None,
            "COD_PEDIDO": item.get("sku"),
            "SKU": item.get("sku"),
            "COMISSAO_SKU": item.get("comissao_sku"),
            "CUSTO_ADICIONAL": item.get("custo_adicional"),
            "MATERIAL_ID": None,
            "CUSTO_FRETE": item.get("custo_frete"),
            "TITULO": item.get("titulo"),
            "VLR_CUSTO": item.get("vlr_custo"),
            "CATALOGO": item.get("catalogo"),
            "FULL": item.get("full_status"),
            "ITENS": item.get("itens"),
            "MARCA": item.get("marca"),
            "GRUPO": item.get("grupo")
        })

    # Ordenar por PEDIDO decrescente como no SQL original
    resultados = sorted(resultados, key=lambda x: x['PEDIDO'], reverse=True)
    return jsonify(resultados)
