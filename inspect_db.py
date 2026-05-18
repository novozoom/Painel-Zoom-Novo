import pyodbc

def main():
    conn = pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};SERVER=200.187.69.101;DATABASE=AmbarZoomBrinquedos;UID=zoombrinquedos;PWD=zoombrinquedos@2024;', timeout=15)
    cursor = conn.cursor()
    
    cursor.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'")
    tables = cursor.fetchall()
    print("--- TABLES ---")
    for t in tables:
        name = t[0].upper()
        if 'PRODUTO' in name or 'ESTOQUE' in name or 'ITEM' in name or 'MATERIAL' in name or 'FORNECEDOR' in name or 'MARCA' in name:
            print(t[0])
            
    cursor.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS")
    views = cursor.fetchall()
    print("\n--- VIEWS ---")
    for v in views:
        name = v[0].upper()
        if 'PRODUTO' in name or 'ESTOQUE' in name or 'ITEM' in name or 'MATERIAL' in name or 'FORNECEDOR' in name or 'MARCA' in name:
            print(v[0])
            
if __name__ == '__main__':
    main()
