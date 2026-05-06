import os
import pyodbc
import requests
from supabase import create_client

def get_ml_tokens(conn):
    cursor = conn.cursor()
    # ECOM_ID = 2 é Mercado Livre
    cursor.execute("SELECT ORIGEM, TOKEN_TEMP FROM ECOM_METODOS WHERE ECOM_ID = 2 AND TOKEN_TEMP IS NOT NULL")
    rows = cursor.fetchall()
    tokens = {}
    for row in rows:
        tokens[str(row[0])] = row[1]
    return tokens

def fetch_ml_api_data(pedido_id, token):
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Resolver o Order ID (se for pack, pegar o primeiro order_id)
    pack_resp = requests.get(f"https://api.mercadolibre.com/packs/{pedido_id}", headers=headers)
    
    order_id = None
    shipment_id = None
    
    if pack_resp.status_code == 200:
        p_data = pack_resp.json()
        orders = p_data.get("orders", [])
        if orders:
            order_id = orders[0].get("id")
        shipment_id = p_data.get("shipment", {}).get("id")
    else:
        # Tenta como order direto
        order_resp = requests.get(f"https://api.mercadolibre.com/orders/{pedido_id}", headers=headers)
        if order_resp.status_code == 200:
            order_id = pedido_id
            o_data = order_resp.json()
            shipment_id = o_data.get("shipping", {}).get("id")
            
    if not order_id:
        return None  # Não encontrou na API

    # 2. Buscar Dados do Pedido (Taxas)
    sale_fee_total = 0.0
    o_resp = requests.get(f"https://api.mercadolibre.com/orders/{order_id}", headers=headers)
    if o_resp.status_code == 200:
        o_data = o_resp.json()
        for item in o_data.get("order_items", []):
            fee = item.get("sale_fee", 0)
            qty = item.get("quantity", 1)
            if fee:
                sale_fee_total += float(fee) * qty
                
    # 3. Buscar Dados de Envio (Logística e Frete)
    logistic_type = "unknown"
    shipping_cost = 0.0
    if shipment_id:
        s_resp = requests.get(f"https://api.mercadolibre.com/shipments/{shipment_id}", headers=headers)
        if s_resp.status_code == 200:
            s_data = s_resp.json()
            logistic_type = s_data.get("logistic_type", "")
            
            # Tentar pegar o list_cost ou base_cost
            opt = s_data.get("shipping_option", {})
            if opt and opt.get("list_cost"):
                shipping_cost = float(opt.get("list_cost"))
            else:
                base = s_data.get("base_cost")
                if base:
                    shipping_cost = float(base)
                    
    is_full = 'TRUE' if logistic_type == 'fulfillment' else 'FALSE'
    
    return {
        "full_status": is_full,
        "frete": shipping_cost,
        "tarifaDeVenda": sale_fee_total,
        "taxaFixa": 0.0  # O sale_fee do ML já engloba a taxa fixa de R$6 quando aplicável
    }

def run_enrichment(data_inicio_date=None, data_fim_date=None):
    SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://izvddltdhxmfgxlimefl.supabase.co")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dmRkbHRkaHhtZmd4bGltZWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzQ0NTgsImV4cCI6MjA4ODgxMDQ1OH0.uo45flx-W8n2CXbd8evdJODFDPIo1J5hbBeIIihmGK8")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    try:
        conn = pyodbc.connect('DRIVER={ODBC Driver 18 for SQL Server};SERVER=200.187.69.101;DATABASE=AmbarZoomBrinquedos;UID=zoombrinquedos;PWD=zoombrinquedos@2024;Timeout=10;TrustServerCertificate=yes')
        tokens = get_ml_tokens(conn)
        conn.close()
    except Exception as e:
        print("Erro ao conectar no ERP para buscar tokens:", e)
        return

    from datetime import datetime, timedelta
    
    if not data_inicio_date:
        data_limite_inicio = (datetime.utcnow() - timedelta(days=2)).strftime('%Y-%m-%d')
    else:
        data_limite_inicio = data_inicio_date.strftime('%Y-%m-%d')
        
    if not data_fim_date:
        data_limite_fim = datetime.utcnow().strftime('%Y-%m-%d')
    else:
        data_limite_fim = data_fim_date.strftime('%Y-%m-%d')
    
    try:
        res = supabase.table("dashboard_pedidos").select("pedido_id, integracao, origem, vlr_total, vlr_custo, vlr_frete_comprador").ilike("vendedor", "%MERCADO LIVRE%").gte("data_venda", data_limite_inicio).lte("data_venda", data_limite_fim).execute()
        pedidos = res.data
    except Exception as e:
        print("Erro ao buscar pedidos no Supabase:", e)
        return

    print(f"Encontrados {len(pedidos)} pedidos recentes do Mercado Livre para checagem.")
    
    atualizados = 0
    for p in pedidos:
        origem = str(p.get("origem")).strip()
        pedido_id = str(p.get("pedido_id")).strip()
        ml_pedido_id = str(p.get("integracao")).strip()
        
        token = tokens.get(origem)
        if not token or not ml_pedido_id:
            continue
            
        ml_data = fetch_ml_api_data(ml_pedido_id, token)
        if ml_data:
            valor_venda = float(p.get("vlr_total", 0))
            frete_comprador = float(p.get("vlr_frete_comprador", 0))
            
            shipping_cost = ml_data["frete"]
            sale_fee_total = ml_data["tarifaDeVenda"]
            
            # Engenharia Reversa para o App.js:
            # App.js: frete = (vlr_frete_real - vlr_frete_comprador) / quant
            # Queremos que (vlr_frete_real - vlr_frete_comprador) = shipping_cost
            novo_frete_real = shipping_cost + frete_comprador
            
            # App.js: tarifa = valorDeVenda * (comissao_sku / 100)
            # Queremos que valorDeVenda * (comissao_sku / 100) = sale_fee_total
            nova_comissao = (sale_fee_total / valor_venda * 100) if valor_venda > 0 else 0
            
            try:
                supabase.table("dashboard_pedidos").update({
                    "full_status": ml_data["full_status"],
                    "vlr_frete_real": novo_frete_real,
                    "comissao_sku": nova_comissao
                }).eq("pedido_id", pedido_id).execute()
                atualizados += 1
            except Exception as e:
                print(f"Erro ao atualizar {pedido_id}:", e)
                
    print(f"Enriquecimento concluído! {atualizados} pedidos atualizados.")

if __name__ == "__main__":
    run_enrichment()
