import pyodbc
conn = pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};SERVER=200.187.69.101;DATABASE=AmbarZoomBrinquedos;UID=zoombrinquedos;PWD=zoombrinquedos@2024;TIMEOUT=60')
cursor = conn.cursor()
cursor.execute("SELECT COD_PEDIDO, COD_INTERNO FROM PEDIDO_MATERIAIS_ITENS_CLIENTE WHERE PEDIDO = '560059'")
print(cursor.fetchall())
