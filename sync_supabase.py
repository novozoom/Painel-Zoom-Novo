import os
from supabase import create_client, Client
import pyodbc
import datetime

# Configurações Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://izvddltdhxmfgxlimefl.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dmRkbHRkaHhtZmd4bGltZWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzQ0NTgsImV4cCI6MjA4ODgxMDQ1OH0.uo45flx-W8n2CXbd8evdJODFDPIo1J5hbBeIIihmGK8")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def sincronizar_pedidos(data_inicio, data_fim):
    conn = pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};'
                          'SERVER=200.187.69.101;'
                          'DATABASE=AmbarZoomBrinquedos;'
                          'UID=zoombrinquedos;'
                          'PWD=zoombrinquedos@2024;'
                          'TIMEOUT=60')
    cursor = conn.cursor()

    sql_query = """
WITH PedidoMaterialCount AS (
    SELECT 
        PI.[PEDIDO],
        COUNT(DISTINCT PI.[COD_PEDIDO]) AS ITENS
    FROM 
        [AmbarZoomBrinquedos].[dbo].[PEDIDO_MATERIAIS_ITENS_CLIENTE] AS PI
    GROUP BY 
        PI.[PEDIDO]
)
SELECT 
    PM.[PEDIDO],
    MI.[URL],
    PM.[DATA],
    PM.[ORIGEM],
    EO.[ORIGEM_NOME] AS [ORIGEM_NOME], 
    PM.[VENDEDOR],
    PM.[VLRFRETE],
    PM.[TOTAL_PEDIDO],
    PM.[VLRFRETE_REAL],
    PM.[VLRFRETE_COMPRADOR],   
    PM.[POSICAO],
    PM.[INTEGRACAO],
    PM.[QUANT_ITENS],
    
    PI.[VLR_UNIT],
    PI.[VLR_TOTAL],
    PI.[VLR_FRETE],
    PI.[CODID],
    PI.[COD_PEDIDO],
    COALESCE(SKU.[SKU], SKU.[SKUVARIACAO_MASTER]) AS [SKU], 
    SKU.[COMISSAO_SKU],
    SKU.[CUSTO_ADICIONAL],
    SKU.[SKU] AS [SKU_ECOM], 
    SKU.[MATERIAL_ID],
    SKU.[CUSTO_FRETE],
    SKU.[TITULO],
    CASE 
        WHEN SKU.[VLR_CUSTO] = 0 THEN PI.[VLR_CUSTO] 
        ELSE SKU.[VLR_CUSTO] 
    END AS [VLR_CUSTO], 
    SKU.[CATALOGO],
    CASE 
        WHEN EXISTS (SELECT * FROM [AmbarZoomBrinquedos].[dbo].[ML_SKU_FULL] WHERE SKU = SKU.[SKU]) 
        THEN 'TRUE' 
        ELSE 'FALSE' 
    END AS [FULL],
    PMC.ITENS,
    F.FABRICANTE_DESCR AS [MARCA],
    G.DESCRICAO AS [GRUPO]
FROM 
    [AmbarZoomBrinquedos].[dbo].[PEDIDO_MATERIAIS_CLIENTE] AS PM
JOIN 
    [AmbarZoomBrinquedos].[dbo].[PEDIDO_MATERIAIS_ITENS_CLIENTE] AS PI
    ON PM.[PEDIDO] = PI.[PEDIDO]
JOIN
    [AmbarZoomBrinquedos].[dbo].[ECOM_ORIGEM] AS EO
    ON PM.[ORIGEM] = EO.[ORIGEM_ID] 
JOIN
    [AmbarZoomBrinquedos].[dbo].[MATERIAIS] AS M
    ON M.[COD_INTERNO] = PI.[COD_INTERNO]  
LEFT JOIN 
    [AmbarZoomBrinquedos].[dbo].[FABRICANTE_MATERIAIS] AS F 
    ON M.[FABRICANTE] = F.[COD_FABRICANTE]
LEFT JOIN 
    [AmbarZoomBrinquedos].[dbo].[GRUPO] AS G 
    ON G.[CODIGO] = M.[GRUPO]
OUTER APPLY (
    SELECT TOP 1 *
    FROM [AmbarZoomBrinquedos].[dbo].[ECOM_SKU] AS SKU
    WHERE PI.[COD_PEDIDO] = SKU.[SKU] OR PI.[COD_PEDIDO] = SKU.[SKUVARIACAO_MASTER]
    ORDER BY CASE WHEN PI.[COD_PEDIDO] = SKU.[SKU] THEN 0 ELSE 1 END 
) SKU
LEFT JOIN
    [AmbarZoomBrinquedos].[dbo].[MATERIAIS_IMAGENS] AS MI
    ON PI.[CODID] = MI.[CODID]
JOIN
    PedidoMaterialCount AS PMC
    ON PM.[PEDIDO] = PMC.[PEDIDO]
WHERE 
    CAST(PM.[DATA] AS DATE) BETWEEN ? AND ?
ORDER BY 
    PM.[PEDIDO] DESC;
    """

    print(f"Lendo Aton de {data_inicio} até {data_fim}...")
    cursor.execute(sql_query, data_inicio, data_fim)
    
    rows = cursor.fetchall()
    print(f"Encontrados {len(rows)} itens nos pedidos.")

    # Mapeando os resultados para o formato Supabase
    registros = []
    chaves_vistas = set()
    for row in rows:
        dicionario_resultado = {}
        for idx, col in enumerate(cursor.description):
            dicionario_resultado[col[0]] = row[idx]
        
        # Converte para formato compatível
        registro = {
            "pedido_id": str(dicionario_resultado.get("PEDIDO", "")),
            "data_venda": dicionario_resultado.get("DATA").strftime('%Y-%m-%d %H:%M:%S') if dicionario_resultado.get("DATA") else None,
            "origem": dicionario_resultado.get("ORIGEM"),
            "origem_nome": dicionario_resultado.get("ORIGEM_NOME", ""),
            "vendedor": dicionario_resultado.get("VENDEDOR", ""),
            "total_pedido": float(dicionario_resultado.get("TOTAL_PEDIDO") or 0),
            "vlr_frete_real": float(dicionario_resultado.get("VLRFRETE_REAL") or 0),
            "vlr_frete_comprador": float(dicionario_resultado.get("VLRFRETE_COMPRADOR") or 0),
            "posicao": dicionario_resultado.get("POSICAO", ""),
            "integracao": dicionario_resultado.get("INTEGRACAO", ""),
            "quant_itens": int(dicionario_resultado.get("QUANT_ITENS") or 0),
            "vlr_unit": float(dicionario_resultado.get("VLR_UNIT") or 0),
            "vlr_total": float(dicionario_resultado.get("VLR_TOTAL") or 0),
            "sku": str(dicionario_resultado.get("SKU", "")),
            "comissao_sku": float(dicionario_resultado.get("COMISSAO_SKU") or 0),
            "custo_adicional": float(dicionario_resultado.get("CUSTO_ADICIONAL") or 0),
            "custo_frete": float(dicionario_resultado.get("CUSTO_FRETE") or 0),
            "vlr_custo": float(dicionario_resultado.get("VLR_CUSTO") or 0),
            "titulo": str(dicionario_resultado.get("TITULO") or ""),
            "catalogo": str(dicionario_resultado.get("CATALOGO", "")),
            "full_status": str(dicionario_resultado.get("FULL", "")),
            "url_imagem": str(dicionario_resultado.get("URL", "")),
            "itens": int(dicionario_resultado.get("ITENS") or 0),
            "marca": str(dicionario_resultado.get("MARCA") or "Diversos"),
            "grupo": str(dicionario_resultado.get("GRUPO") or "Diversos")
        }
        
        chave_unica = f"{registro['pedido_id']}_{registro['sku']}"
        if chave_unica not in chaves_vistas:
            chaves_vistas.add(chave_unica)
            registros.append(registro)

    cursor.close()
    conn.close()

    if not registros:
        return {"status": "success", "message": "Nenhum pedido encontrado para sincronizar.", "count": 0}

    # Fazer Upsert no Supabase
    # Dividir em blocos de 500 para evitar timeout de request
    tamanho_bloco = 500
    inseridos = 0
    print(f"Sincronizando {len(registros)} itens com o Supabase...")
    
    for i in range(0, len(registros), tamanho_bloco):
        bloco = registros[i:i+tamanho_bloco]
        # O on_conflict deve incluir a combinação que faz o registro ser único (pedido_id e sku)
        response = supabase.table('dashboard_pedidos').upsert(bloco, on_conflict='pedido_id,sku').execute()
        inseridos += len(bloco)
        
    return {"status": "success", "message": f"{inseridos} itens de pedidos sincronizados com sucesso!", "count": inseridos}

if __name__ == "__main__":
    hoje = datetime.datetime.now().date()
    sincronizar_pedidos(hoje, hoje)
