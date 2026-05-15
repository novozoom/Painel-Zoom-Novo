from flask import Blueprint, jsonify
import pyodbc
import datetime
import time

bp = Blueprint("faturamento_anterior", __name__)

# Cache para dados de ontem (não mudam durante o dia)
_cache_ontem = {"data": None, "ts": 0, "date": None}
CACHE_TTL_ONTEM = 600  # 10 minutos

@bp.route('/api/faturamento_ontem')
def obter_faturamento_ontem():
    data_ontem = datetime.date.today() - datetime.timedelta(days=1)
    
    # Se já temos cache válido para essa data, retorna direto
    if (_cache_ontem["data"] is not None 
        and _cache_ontem["date"] == str(data_ontem)
        and (time.time() - _cache_ontem["ts"]) < CACHE_TTL_ONTEM):
        return jsonify(_cache_ontem["data"])
    
    try:
        conn = pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};'
                              'SERVER=200.187.69.101;'
                              'DATABASE=AmbarZoomBrinquedos;'
                              'UID=zoombrinquedos;'
                              'PWD=zoombrinquedos@2024;',
                              timeout=15)
        cursor = conn.cursor()

        sql_query = """
        SELECT
            PM.[PEDIDO],
            PM.[DATA],
            PM.[POSICAO],
            PM.[TOTAL_PEDIDO]
        FROM 
            [AmbarZoomBrinquedos].[dbo].[PEDIDO_MATERIAIS_CLIENTE] AS PM
        WHERE 
            CAST(PM.[DATA] AS DATE)= ?
        """

        cursor.execute(sql_query, data_ontem)

        resultado = []
        for row in cursor.fetchall():
            dicionario_resultado = {}
            for idx, col in enumerate(cursor.description):
                dicionario_resultado[col[0]] = row[idx]
            resultado.append(dicionario_resultado)

        cursor.close()
        conn.close()
        
        # Salva no cache
        _cache_ontem["data"] = resultado
        _cache_ontem["ts"] = time.time()
        _cache_ontem["date"] = str(data_ontem)

        return jsonify(resultado)
    except Exception as e:
        # Se der timeout no SQL Server, retorna cache antigo ou lista vazia
        if _cache_ontem["data"] is not None:
            return jsonify(_cache_ontem["data"])
        return jsonify([])
