from flask import Blueprint, jsonify
import pyodbc
import datetime

bp = Blueprint("faturamento_anterior", __name__)

@bp.route('/api/faturamento_ontem')
def obter_faturamento_ontem():
    conn = pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};'
                          'SERVER=200.187.69.101;'
                          'DATABASE=AmbarZoomBrinquedos;'
                          'UID=zoombrinquedos;'
                          'PWD=zoombrinquedos@2024;')
    cursor = conn.cursor()

    data_ontem = datetime.date.today() - datetime.timedelta(days=1)

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

    return jsonify(resultado)
