# 🚀 Manual de Instalação — Painel Zoom (Parceiro)

Este manual é para quem quer rodar o Painel Zoom no **seu próprio ambiente** (GitHub, Render, Supabase, ERP).

---

## Pré-requisitos

- Conta no **GitHub**
- Conta no **Render** (plano free funciona)
- Conta no **Supabase** (plano free funciona)
- Acesso ao **ERP Aton** (SQL Server) com as tabelas padrão

---

## Passo 1: Copiar o código

1. Acesse o repositório original no GitHub
2. Clique em **"Fork"** (canto superior direito)
3. Isso cria uma cópia no SEU GitHub

> Sempre que o repositório original for atualizado, você pode fazer **"Sync fork"** no GitHub para pegar as melhorias.

---

## Passo 2: Criar tabela no Supabase

1. Acesse seu projeto Supabase → **SQL Editor**
2. Cole e execute este SQL:

```sql
CREATE TABLE IF NOT EXISTS dashboard_pedidos (
    id BIGSERIAL PRIMARY KEY,
    pedido_id TEXT NOT NULL,
    data_venda TIMESTAMPTZ,
    origem INTEGER,
    origem_nome TEXT,
    vendedor TEXT,
    total_pedido NUMERIC DEFAULT 0,
    vlr_frete_real NUMERIC DEFAULT 0,
    vlr_frete_comprador NUMERIC DEFAULT 0,
    posicao TEXT,
    integracao TEXT,
    quant_itens INTEGER DEFAULT 0,
    vlr_unit NUMERIC DEFAULT 0,
    vlr_total NUMERIC DEFAULT 0,
    sku TEXT,
    comissao_sku NUMERIC DEFAULT 0,
    custo_adicional NUMERIC DEFAULT 0,
    custo_frete NUMERIC DEFAULT 0,
    vlr_custo NUMERIC DEFAULT 0,
    titulo TEXT,
    catalogo TEXT,
    url_imagem TEXT,
    itens INTEGER DEFAULT 0,
    marca TEXT DEFAULT 'Diversos',
    grupo TEXT DEFAULT 'Diversos',
    cod_interno TEXT,
    full_status TEXT DEFAULT 'FALSE',
    UNIQUE(pedido_id, sku)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pedidos_data ON dashboard_pedidos(data_venda);
CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor ON dashboard_pedidos(vendedor);
CREATE INDEX IF NOT EXISTS idx_pedidos_origem ON dashboard_pedidos(origem);
```

3. Vá em **Settings → API** e copie:
   - `Project URL` (será o `SUPABASE_URL`)
   - `anon public key` (será o `SUPABASE_KEY`)

---

## Passo 3: Deploy no Render

### 3A. Serviço Backend (Python)

1. No Render → **New → Web Service**
2. Conecte ao seu repositório GitHub (o fork)
3. Configure:
   - **Name:** `painel-zoom-backend` (ou o nome que quiser)
   - **Runtime:** Python
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`

4. **Variáveis de ambiente** (Environment → Add Environment Variable):

| Variável | Seu Valor |
|---|---|
| `DB_SERVER` | IP do seu ERP (ex: `200.187.69.101`) |
| `DB_NAME` | Nome do banco (ex: `AmbarSeuNegocio`) |
| `DB_USER` | Usuário SQL (ex: `meuusuario`) |
| `DB_PASS` | Senha SQL |
| `SUPABASE_URL` | URL do seu projeto Supabase |
| `SUPABASE_KEY` | Chave anon do Supabase |

### 3B. Serviço Frontend (React)

1. No Render → **New → Static Site**
2. Conecte ao mesmo repositório GitHub
3. Configure:
   - **Name:** `painel-zoom-frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `build`

4. **Variáveis de ambiente:**

| Variável | Seu Valor |
|---|---|
| `REACT_APP_API_URL` | URL do seu backend no Render (ex: `https://painel-zoom-backend.onrender.com`) |

---

## Passo 4: Testar

1. Acesse a URL do frontend no Render
2. O sistema deve carregar e sincronizar automaticamente
3. Verifique se os pedidos aparecem corretamente

---

## Como receber atualizações

Quando o código for atualizado no repositório original:

1. Acesse seu fork no GitHub
2. Clique em **"Sync fork"** → **"Update branch"**
3. O Render faz deploy automático com o código novo
4. Suas configurações (variáveis de ambiente) **não são afetadas**

---

## Checklist

- [ ] Fork do repositório criado
- [ ] Tabela `dashboard_pedidos` criada no Supabase
- [ ] Backend deployado no Render com variáveis de ambiente
- [ ] Frontend deployado no Render com `REACT_APP_API_URL`
- [ ] Primeiro sync executado com sucesso
- [ ] Pedidos aparecendo no painel
