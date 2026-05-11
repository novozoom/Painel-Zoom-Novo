import enrich_ml_api
import os
import pyodbc
from supabase import create_client

SUPABASE_URL = 'https://izvddltdhxmfgxlimefl.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dmRkbHRkaHhtZmd4bGltZWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzQ0NTgsImV4cCI6MjA4ODgxMDQ1OH0.uo45flx-W8n2CXbd8evdJODFDPIo1J5hbBeIIihmGK8'
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

conn = pyodbc.connect('DRIVER={ODBC Driver 18 for SQL Server};SERVER=200.187.69.101;DATABASE=AmbarZoomBrinquedos;UID=zoombrinquedos;PWD=zoombrinquedos@2024;Timeout=10;TrustServerCertificate=yes')
tokens = enrich_ml_api.get_ml_tokens(conn)

target_integracoes = ['2000016375349510', '2000016375348536', '2000016375036392']

for integracao in target_integracoes:
    res = supabase.table('dashboard_pedidos').select('*').eq('integracao', integracao).execute()
    for p in res.data:
        pedido_id = str(p.get("pedido_id")).strip()
        origem = str(p.get("origem")).strip()
        vlr_frete_comprador = float(p.get("vlr_frete_comprador") or 0.0)
        vlr_total = float(p.get("vlr_total") or 0.0)
        
        token = tokens.get(origem)
        if not token: continue
        
        ml_data = enrich_ml_api.fetch_ml_api_data(integracao, token)
        if not ml_data: continue
        
        # Recalcula frete real e comissao base
        # Se for fulfillment, o custo de frete eh gratis para o vendedor, e a tarifa de venda é fixa 
        novo_frete_real = vlr_frete_comprador
        if ml_data["full_status"] == "TRUE":
            novo_frete_real = 0.0
            
        nova_comissao = ml_data["tarifaDeVenda"]
        
        # Atualiza
        supabase.table("dashboard_pedidos").update({
            "full_status": ml_data["full_status"],
            "vlr_frete_real": novo_frete_real,
            "comissao_sku": nova_comissao
        }).eq("pedido_id", pedido_id).execute()
        print(f"Updated {pedido_id} (integracao: {integracao}) to FULL: {ml_data['full_status']}")
