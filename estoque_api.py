from flask import Blueprint, jsonify, request
import pyodbc
import os

bp = Blueprint("estoque", __name__)

DB_SERVER = os.environ.get("DB_SERVER", "200.187.69.101")
DB_NAME = os.environ.get("DB_NAME", "AmbarZoomBrinquedos")
DB_USER = os.environ.get("DB_USER", "zoombrinquedos")
DB_PASS = os.environ.get("DB_PASS", "zoombrinquedos@2024")

def get_conn():
    return pyodbc.connect(f'DRIVER={{ODBC Driver 17 for SQL Server}};'
                          f'SERVER={DB_SERVER};'
                          f'DATABASE={DB_NAME};'
                          f'UID={DB_USER};'
                          f'PWD={DB_PASS};'
                          'TrustServerCertificate=yes;'
                          'TIMEOUT=15')

@bp.route('/api/estoque/busca')
def busca_estoque():
    termo = request.args.get('q', '').strip()
    if len(termo) < 2:
        return jsonify({"status": "error", "message": "Digite pelo menos 2 caracteres."}), 400

    conn = get_conn()
    cursor = conn.cursor()
    
    # Adicionando wildcards para pesquisa parcial
    # Pesquisa por COD_BARRAS, COD_INTERNO, titulo(DESCRICAO) ou Fornecedor
    termo_sql = f"%{termo}%"

    try:
        # Busca produtos que correspondem ao termo
        # Não limita fortemente para evitar truncar pesquisa por fornecedor (que traz muitos)
        cursor.execute("""
            SELECT TOP 50
                M.CODID, M.COD_INTERNO, M.COD_BARRAS, M.DESCRICAO, 
                M.VLR_CUSTO, M.FOTOPATH, F.FABRICANTE_DESCR,
                G.DESCRICAO AS NOME_GRUPO, SG.DESCRICAO AS NOME_SUBGRUPO
            FROM MATERIAIS M
            LEFT JOIN FABRICANTE_MATERIAIS F ON M.FABRICANTE = F.COD_FABRICANTE
            LEFT JOIN GRUPO G ON M.GRUPO = G.CODIGO
            LEFT JOIN SUB_GRUPO SG ON M.SUBGRUPO = SG.CODIGO_SUBGRUPO
            WHERE (M.INATIVO = 'N' OR M.INATIVO IS NULL)
              AND (
                M.COD_BARRAS LIKE ? 
                OR M.COD_INTERNO LIKE ?
                OR M.DESCRICAO LIKE ?
                OR F.FABRICANTE_DESCR LIKE ?
                OR G.DESCRICAO LIKE ?
                OR SG.DESCRICAO LIKE ?
              )
        """, (termo_sql, termo_sql, termo_sql, termo_sql, termo_sql, termo_sql))
        
        produtos = []
        rows = cursor.fetchall()
        for row in rows:
            codid = row.CODID
            cod_interno = row.COD_INTERNO.strip() if row.COD_INTERNO else ""
            cod_barras = row.COD_BARRAS.strip() if row.COD_BARRAS else ""
            descricao = row.DESCRICAO.strip() if row.DESCRICAO else "Sem Descrição"
            custo = float(row.VLR_CUSTO) if row.VLR_CUSTO else 0.0
            fornecedor = row.FABRICANTE_DESCR.strip() if row.FABRICANTE_DESCR else "N/A"
            grupo = row.NOME_GRUPO.strip() if row.NOME_GRUPO else "N/A"
            subgrupo = row.NOME_SUBGRUPO.strip() if row.NOME_SUBGRUPO else "N/A"
            
            # Foto: se tiver FOTOPATH, tenta formar a url local, caso não seja link já
            foto_url = None
            if row.FOTOPATH:
                fp = row.FOTOPATH.strip()
                if fp.startswith("http"):
                    foto_url = fp.replace("http://", "https://")
                else:
                    foto_url = "https://ambarxcloud.com.br/zoombrinquedos/" + fp

            produtos.append({
                "codid": codid,
                "cod_interno": cod_interno,
                "cod_barras": cod_barras,
                "descricao": descricao,
                "custo": custo,
                "fornecedor": fornecedor,
                "grupo": grupo,
                "subgrupo": subgrupo,
                "foto_url": foto_url,
                "estoques": [],
                "vendas_7d": 0,
                "vendas_30d": 0,
                "lucro_total_30d": 0,
                "lucro_total_7d": 0,
                "lucro_medio": 0,
                "ultima_venda": None
            })

        if not produtos:
            return jsonify({"status": "success", "resultados": []})

        # Para os produtos retornados, buscamos estoque e vendas em batch
        # Para não fazer selects em loop (n+1)
        codids = [p["codid"] for p in produtos]
        cods_internos = [p["cod_interno"] for p in produtos if p["cod_interno"]]

        # --- BUSCA ESTOQUE ---
        if codids:
            placeholders = ",".join("?" * len(codids))
            cursor.execute(f"""
                SELECT EM.MATERIAL_ID, A.ARMAZEM_DESCR, SUM(COALESCE(EM.ESTOQUE, 0)) AS QTD
                FROM ESTOQUE_MATERIAIS EM
                JOIN ESTOQUE_ARMAZEM A ON A.ARMAZEM_ID = EM.ARMAZEM
                WHERE EM.MATERIAL_ID IN ({placeholders})
                GROUP BY EM.MATERIAL_ID, A.ARMAZEM_DESCR
                HAVING SUM(COALESCE(EM.ESTOQUE, 0)) <> 0
            """, codids)
            
            map_estoque = {}
            for e_row in cursor.fetchall():
                mat_id = e_row.MATERIAL_ID
                armazem = e_row.ARMAZEM_DESCR.strip()
                qtd = int(float(e_row.QTD))
                
                if mat_id not in map_estoque:
                    map_estoque[mat_id] = []
                map_estoque[mat_id].append({"armazem": armazem, "quantidade": qtd})
                
            for p in produtos:
                if p["codid"] in map_estoque:
                    p["estoques"] = sorted(map_estoque[p["codid"]], key=lambda x: x["quantidade"], reverse=True)

        # --- BUSCA VENDAS 30 DIAS e 7 DIAS ---
        if cods_internos:
            placeholders_int = ",".join("?" * len(cods_internos))
            cursor.execute(f"""
                SELECT PI.COD_INTERNO, 
                       SUM(CASE WHEN PM.DATA >= GETDATE() - 30 THEN PI.QUANT ELSE 0 END) AS VENDAS_30D,
                       SUM(CASE WHEN PM.DATA >= GETDATE() - 7 THEN PI.QUANT ELSE 0 END) AS VENDAS_7D
                FROM PEDIDO_MATERIAIS_ITENS_CLIENTE PI
                JOIN PEDIDO_MATERIAIS_CLIENTE PM ON PM.PEDIDO = PI.PEDIDO
                WHERE PI.COD_INTERNO IN ({placeholders_int}) 
                  AND PM.POSICAO <> 'CANCELADO'
                  AND PM.DATA >= GETDATE() - 30
                GROUP BY PI.COD_INTERNO
            """, cods_internos)
            
            map_vendas_30 = {}
            map_vendas_7 = {}
            for v_row in cursor.fetchall():
                cod_int = v_row.COD_INTERNO.strip()
                map_vendas_30[cod_int] = int(float(v_row.VENDAS_30D)) if v_row.VENDAS_30D else 0
                map_vendas_7[cod_int] = int(float(v_row.VENDAS_7D)) if v_row.VENDAS_7D else 0
                
            for p in produtos:
                if p["cod_interno"] in map_vendas_30:
                    p["vendas_30d"] = map_vendas_30[p["cod_interno"]]
                    p["vendas_7d"] = map_vendas_7[p["cod_interno"]]

        # --- BUSCA DADOS DE VENDAS (Qtd, Lucro, Última Venda) E FOTOS NO SUPABASE ---
        # Usamos o Supabase para ter o lucro preciso e fotos, buscando histórico de até 90 dias
        map_fotos_supabase = {}
        map_lucro_30 = {}
        map_lucro_7 = {}
        map_qtd_30_sup = {}
        map_ultima_venda = {}

        if cods_internos:
            try:
                import requests
                from datetime import datetime, timedelta
                
                hoje = datetime.utcnow()
                data_limite_90 = (hoje - timedelta(days=90)).strftime('%Y-%m-%d')
                data_limite_30 = (hoje - timedelta(days=30)).strftime('%Y-%m-%d')
                data_limite_7 = (hoje - timedelta(days=7)).strftime('%Y-%m-%d')

                SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://izvddltdhxmfgxlimefl.supabase.co")
                SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6dmRkbHRkaHhtZmd4bGltZWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMzQ0NTgsImV4cCI6MjA4ODgxMDQ1OH0.uo45flx-W8n2CXbd8evdJODFDPIo1J5hbBeIIihmGK8")
                if SUPABASE_KEY:
                    skus_join = ",".join(cods_internos)
                    res = requests.get(
                        f"{SUPABASE_URL}/rest/v1/dashboard_pedidos?cod_interno=in.({skus_join})&data_venda=gte.{data_limite_90}&select=cod_interno,url_imagem,lucro,data_venda,quant_itens&limit=5000",
                        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
                        timeout=5
                    )
                    if res.status_code == 200:
                        for item_data in res.json():
                            ci = item_data.get("cod_interno", "").strip()
                            if not ci: continue
                            
                            # Foto
                            ui = item_data.get("url_imagem", "").strip()
                            if ui and ui != 'None' and len(ui) > 10:
                                map_fotos_supabase[ci] = ui
                                
                            # Métricas
                            dv = item_data.get("data_venda")
                            lucro = float(item_data.get("lucro", 0) or 0)
                            qtd = int(item_data.get("quant_itens", 1) or 1)
                            
                            # Última Venda (Max)
                            if dv:
                                if ci not in map_ultima_venda or dv > map_ultima_venda[ci]:
                                    map_ultima_venda[ci] = dv
                                    
                                # Acumulado 30D e 7D
                                if dv >= data_limite_30:
                                    map_lucro_30[ci] = map_lucro_30.get(ci, 0) + lucro
                                    map_qtd_30_sup[ci] = map_qtd_30_sup.get(ci, 0) + qtd
                                if dv >= data_limite_7:
                                    map_lucro_7[ci] = map_lucro_7.get(ci, 0) + lucro

            except Exception as e:
                print("Erro Supabase:", e)

        cursor.execute(f"""
            SELECT CODID, URL FROM MATERIAIS_IMAGENS 
            WHERE CODID IN ({placeholders}) AND IMG_IDX = 0
        """, codids)
        map_fotos_aton = {}
        for f_row in cursor.fetchall():
            if f_row.URL and len(f_row.URL) > 10:
                map_fotos_aton[f_row.CODID] = f_row.URL.strip()
            
        for p in produtos:
            cod_int = p["cod_interno"]
            codid = p["codid"]
            
            melhor_foto = None
            if cod_int in map_fotos_supabase:
                melhor_foto = map_fotos_supabase[cod_int]
            elif codid in map_fotos_aton:
                melhor_foto = map_fotos_aton[codid]
                
            if melhor_foto:
                # Corrigir URLs do Mercado Livre que vem como http://
                p["foto_url"] = melhor_foto.replace("http://", "https://")
                
            # Atualizar Métricas Financeiras
            if cod_int in map_ultima_venda:
                # Converter de 2026-05-18 para DD/MM/AAAA
                try:
                    p["ultima_venda"] = f'{map_ultima_venda[cod_int][8:10]}/{map_ultima_venda[cod_int][5:7]}/{map_ultima_venda[cod_int][:4]}'
                except:
                    p["ultima_venda"] = map_ultima_venda[cod_int]
            
            p["lucro_total_30d"] = map_lucro_30.get(cod_int, 0)
            p["lucro_total_7d"] = map_lucro_7.get(cod_int, 0)
            
            qtd_sup = map_qtd_30_sup.get(cod_int, 0)
            if qtd_sup > 0:
                p["lucro_medio"] = p["lucro_total_30d"] / qtd_sup
            else:
                p["lucro_medio"] = p["custo"] * 0.15 # Fallback estético de margem se não houver vendas
                
        # Ordenar os resultados para trazer os itens com maior giro 30d primeiro
        produtos.sort(key=lambda x: x["vendas_30d"], reverse=True)

        return jsonify({"status": "success", "resultados": produtos})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()
