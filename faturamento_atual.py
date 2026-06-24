from flask import Blueprint, jsonify, request
from flask_cors import CORS
import datetime
import os
import time
from supabase import create_client, Client

bp = Blueprint("faturamento_atual", __name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://izvddltdhxmfgxlimefl.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dmRkbHRkaHhtZmd4bGltZWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzQ0NTgsImV4cCI6MjA4ODgxMDQ1OH0.uo45flx-W8n2CXbd8evdJODFDPIo1J5hbBeIIihmGK8")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ========== CACHE EM MEMÓRIA ==========
_cache_resultados = {}   # { "2026-05-15_2026-05-15": { "data": [...], "ts": 1234567890 } }
CACHE_TTL_RESULTADOS = 300  # 5 minutos

def _get_cache(key):
    entry = _cache_resultados.get(key)
    if entry and (time.time() - entry["ts"]) < CACHE_TTL_RESULTADOS:
        return entry["data"]
    return None

def _set_cache(key, data):
    # Limita o cache a 20 entradas para não explodir a memória
    if len(_cache_resultados) > 20:
        oldest_key = min(_cache_resultados, key=lambda k: _cache_resultados[k]["ts"])
        del _cache_resultados[oldest_key]
    _cache_resultados[key] = {"data": data, "ts": time.time()}


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
        
        # Invalida cache após sync para que o próximo GET traga dados frescos
        cache_key = f"{data_inicio_str}_{data_fim_str}"
        if cache_key in _cache_resultados:
            del _cache_resultados[cache_key]
        
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
        data_inicio_str = hoje
        data_fim_str = hoje

    # Verifica cache primeiro
    cache_key = f"{data_inicio_str}_{data_fim_str}"
    cached = _get_cache(cache_key)
    if cached is not None:
        return jsonify(cached)

    # Buscar do Supabase
    response = supabase.table('dashboard_pedidos').select('*').gte('data_venda', data_inicio).lte('data_venda', data_fim).execute()
    
    # Ordenar por pedido_id decrescente
    resultados = sorted(response.data, key=lambda x: x.get('pedido_id', ''), reverse=True)
    
    # Salva no cache
    _set_cache(cache_key, resultados)
    
    return jsonify(resultados)
