import pyodbc
import requests
import enrich_ml_api

conn = pyodbc.connect('DRIVER={ODBC Driver 18 for SQL Server};SERVER=200.187.69.101;DATABASE=AmbarZoomBrinquedos;UID=zoombrinquedos;PWD=zoombrinquedos@2024;Timeout=10;TrustServerCertificate=yes')
tokens = enrich_ml_api.get_ml_tokens(conn)
token = tokens.get('3')
headers = {'Authorization': f'Bearer {token}'}

packs = ['2000012921769223', '2000012921426889']
order_ids = []

for p in packs:
    pack_data = requests.get(f'https://api.mercadolibre.com/packs/{p}', headers=headers).json()
    orders = pack_data.get('orders', [])
    order_ids.extend([str(o.get('id')) for o in orders])

print('Child Orders:', order_ids)

if order_ids:
    cursor = conn.cursor()
    placeholders = ','.join(['?']*len(order_ids))
    cursor.execute(f"SELECT TOP 5 PEDIDO, ORIGEM, INTEGRACAO, DATA FROM PEDIDO_MATERIAIS_CLIENTE WHERE INTEGRACAO IN ({placeholders})", *order_ids)
    print('ERP Data:', cursor.fetchall())
