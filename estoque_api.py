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
                M.VLR_CUSTO, M.FOTOPATH, F.FABRICANTE_DESCR
            FROM MATERIAIS M
            LEFT JOIN FABRICANTE_MATERIAIS F ON M.FABRICANTE = F.COD_FABRICANTE
            WHERE (M.INATIVO = 'N' OR M.INATIVO IS NULL)
              AND (
                M.COD_BARRAS LIKE ? 
                OR M.COD_INTERNO LIKE ?
                OR M.DESCRICAO LIKE ?
                OR F.FABRICANTE_DESCR LIKE ?
              )
        """, (termo_sql, termo_sql, termo_sql, termo_sql))
        
        produtos = []
        rows = cursor.fetchall()
        for row in rows:
            codid = row.CODID
            cod_interno = row.COD_INTERNO.strip() if row.COD_INTERNO else ""
            cod_barras = row.COD_BARRAS.strip() if row.COD_BARRAS else ""
            descricao = row.DESCRICAO.strip() if row.DESCRICAO else "Sem Descrição"
            custo = float(row.VLR_CUSTO) if row.VLR_CUSTO else 0.0
            fornecedor = row.FABRICANTE_DESCR.strip() if row.FABRICANTE_DESCR else "MARCA NÃO DEFINIDA"
            
            # Foto: se tiver FOTOPATH, tenta formar a url local, caso não seja link já
            foto_url = None
            if row.FOTOPATH:
                fp = row.FOTOPATH.strip()
                if fp.startswith("http"):
                    foto_url = fp
                else:
                    foto_url = "https://ambarxcloud.com.br/zoombrinquedos/" + fp

            produtos.append({
                "codid": codid,
                "cod_interno": cod_interno,
                "cod_barras": cod_barras,
                "descricao": descricao,
                "custo": custo,
                "fornecedor": fornecedor,
                "foto_url": foto_url,
                "estoques": [],
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

        # --- BUSCA VENDAS 30 DIAS ---
        if cods_internos:
            placeholders_int = ",".join("?" * len(cods_internos))
            cursor.execute(f"""
                SELECT PI.COD_INTERNO, SUM(PI.QUANT) AS VENDAS
                FROM PEDIDO_MATERIAIS_ITENS_CLIENTE PI
                JOIN PEDIDO_MATERIAIS_CLIENTE PM ON PM.PEDIDO = PI.PEDIDO
                WHERE PI.COD_INTERNO IN ({placeholders_int}) 
                  AND PM.POSICAO <> 'CANCELADO'
                  AND PM.DATA >= GETDATE() - 30
                GROUP BY PI.COD_INTERNO
            """, cods_internos)
            
            map_vendas = {}
            for v_row in cursor.fetchall():
                cod_int = v_row.COD_INTERNO.strip()
                qtd = int(float(v_row.VENDAS))
                map_vendas[cod_int] = qtd
                
            for p in produtos:
                if p["cod_interno"] in map_vendas:
                    p["vendas_30d"] = map_vendas[p["cod_interno"]]

        # --- BUSCA FOTOS MELHORES (ECOM) SE NECESSÁRIO ---
        # Muitos itens no ERP usam a tabela MATERIAIS_IMAGENS do ecom
        cursor.execute(f"""
            SELECT CODID, URL FROM MATERIAIS_IMAGENS 
            WHERE CODID IN ({placeholders}) AND IMG_IDX = 0
        """, codids)
        map_fotos = {}
        for f_row in cursor.fetchall():
            map_fotos[f_row.CODID] = f_row.URL
            
        for p in produtos:
            if p["codid"] in map_fotos and map_fotos[p["codid"]] and len(map_fotos[p["codid"]]) > 10:
                p["foto_url"] = map_fotos[p["codid"]]

        return jsonify({"status": "success", "resultados": produtos})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()
