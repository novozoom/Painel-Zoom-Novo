import pyodbc

conn = pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};'
                      'SERVER=200.187.69.101;'
                      'DATABASE=AmbarZoomBrinquedos;'
                      'UID=zoombrinquedos;'
                      'PWD=zoombrinquedos@2024;'
                      'TIMEOUT=60')
cursor = conn.cursor()
cursor.execute("SELECT TOP 1 * FROM MATERIAIS")
columns = [column[0] for column in cursor.description]
print(columns)
conn.close()
