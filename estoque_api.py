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
                "vendas_30d": 0
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

        # --- BUSCA FOTOS MELHORES (ECOM, FULL, ATON) SE NECESSÁRIO ---
        # Prioridade igual ao pedidos: 1) ML_SKU_FULL, 2) MATERIAIS_IMAGENS, 3) ECOM_SKU
        if cods_internos:
            cursor.execute(f"""
                SELECT SKU, URL FROM ML_SKU_FULL 
                WHERE SKU IN ({placeholders_int})
            """, cods_internos)
            map_fotos_full = {}
            for row in cursor.fetchall():
                if row.URL and len(row.URL) > 10:
                    map_fotos_full[row.SKU.strip()] = row.URL.strip()

            cursor.execute(f"""
                SELECT SKU, FOTOPATH FROM ECOM_SKU 
                WHERE SKU IN ({placeholders_int})
            """, cods_internos)
            map_fotos_ecom = {}
            for row in cursor.fetchall():
                if row.FOTOPATH and len(row.FOTOPATH) > 10:
                    map_fotos_ecom[row.SKU.strip()] = row.FOTOPATH.strip()
        else:
            map_fotos_full = {}
            map_fotos_ecom = {}

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
            if cod_int in map_fotos_full:
                melhor_foto = map_fotos_full[cod_int]
            elif codid in map_fotos_aton:
                melhor_foto = map_fotos_aton[codid]
            elif cod_int in map_fotos_ecom:
                melhor_foto = map_fotos_ecom[cod_int]
                
            if melhor_foto:
                # Corrigir URLs do Mercado Livre que vem como http://
                p["foto_url"] = melhor_foto.replace("http://", "https://")

        return jsonify({"status": "success", "resultados": produtos})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()
