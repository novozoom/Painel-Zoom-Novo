import pyodbc
conn = pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};SERVER=200.187.69.101;DATABASE=AmbarZoomBrinquedos;UID=zoombrinquedos;PWD=zoombrinquedos@2024;')
cursor = conn.cursor()
cursor.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'")
tables = cursor.fetchall()
print("Tables in DB:")
for t in tables:
    if 'PRODUTO' in t[0].upper() or 'ESTOQUE' in t[0].upper() or 'ITEM' in t[0].upper() or 'MATERIAL' in t[0].upper() or 'GRUPO' in t[0].upper() or 'MARCA' in t[0].upper() or 'FORNECEDOR' in t[0].upper():
        print(t[0])
