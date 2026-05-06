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
        from enrich_ml_api import run_enrichment
        resultado = sincronizar_pedidos(data_inicio, data_fim)
        
        # Roda o enriquecimento por cima para o Mercado Livre
        run_enrichment(data_inicio, data_fim)
        
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

    # Buscar do Supabase — retornar direto em lowercase (formato que o React espera)
    response = supabase.table('dashboard_pedidos').select('*').gte('data_venda', data_inicio).lte('data_venda', data_fim).execute()
    
    # Ordenar por pedido_id decrescente
    resultados = sorted(response.data, key=lambda x: x.get('pedido_id', ''), reverse=True)
    return jsonify(resultados)
