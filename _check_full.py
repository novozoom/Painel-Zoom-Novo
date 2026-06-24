"""
Enrich final - agora que o deploy do Render preserva full_status.
"""
import pyodbc, requests
from supabase import create_client
from datetime import datetime
from collections import Counter

SUPABASE_URL = "https://izvddltdhxmfgxlimefl.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dmRkbHRkaHhtZmd4bGltZWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzQ0NTgsImV4cCI6MjA4ODgxMDQ1OH0.uo45flx-W8n2CXbd8evdJODFDPIo1J5hbBeIIihmGK8"
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

conn = pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};SERVER=200.187.69.101;DATABASE=AmbarZoomBrinquedos;UID=zoombrinquedos;PWD=zoombrinquedos@2024;Timeout=30;TrustServerCertificate=yes')
cursor = conn.cursor()
cursor.execute("SELECT ORIGEM, TOKEN_TEMP FROM ECOM_METODOS WHERE ECOM_ID = 2 AND TOKEN_TEMP IS NOT NULL")
tokens = {str(r[0]): r[1] for r in cursor.fetchall()}
conn.close()

data_hoje = datetime.now().strftime('%Y-%m-%d')
res = supabase.table("dashboard_pedidos").select("id, pedido_id, integracao, origem, sku").ilike("vendedor", "%MERCADO LIVRE%").eq("data_venda", data_hoje).execute()
pedidos = res.data
print(f"Enriquecendo {len(pedidos)} pedidos...")

shipment_cache = {}
full_count = 0
batch_updates = []

for i, p in enumerate(pedidos):
    origem = str(p.get("origem")).strip()
    ml_id = str(p.get("integracao") or "").strip()
    token = tokens.get(origem)
    if not token or not ml_id or ml_id == 'None':
        continue
    
    try:
        if ml_id in shipment_cache:
            is_full = shipment_cache[ml_id]
        else:
            headers = {"Authorization": f"Bearer {token}"}
            order_resp = requests.get(f"https://api.mercadolibre.com/orders/{ml_id}", headers=headers, timeout=10)
            is_full = 'FALSE'
            if order_resp.status_code == 200:
                shipment_id = order_resp.json().get("shipping", {}).get("id")
                if shipment_id:
                    s_resp = requests.get(f"https://api.mercadolibre.com/shipments/{shipment_id}", headers=headers, timeout=10)
                    if s_resp.status_code == 200:
                        if s_resp.json().get("logistic_type", "") == 'fulfillment':
                            is_full = 'TRUE'
            shipment_cache[ml_id] = is_full
        
        if is_full == 'TRUE':
            full_count += 1
        
        # Update por ID unico do registro (mais confiavel)
        record_id = p.get('id')
        if record_id:
            supabase.table("dashboard_pedidos").update({"full_status": is_full}).eq("id", record_id).execute()
        
        if (i + 1) % 30 == 0:
            print(f"  {i+1}/{len(pedidos)} | Full: {full_count}")
    except:
        pass

print(f"\nFinalizado! {full_count} FULL de {len(pedidos)}")

# Verificar
res2 = supabase.table('dashboard_pedidos').select('origem_nome').eq('data_venda', data_hoje).eq('full_status', 'TRUE').execute()
c = Counter((i.get('origem_nome','').strip()) for i in res2.data)
print(f"\nTotal FULL no Supabase: {len(res2.data)}")
for k, v in c.most_common():
    print(f"  {k}: {v}")
