# Use uma imagem base oficial do Python com o sistema Debian 12 (Bookworm)
FROM python:3.11-slim

# Define que a instalação será não-interativa
ENV DEBIAN_FRONTEND=noninteractive

# Instala as dependências de sistema
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl gnupg unixodbc-dev && \
    #
    # --- Adiciona o repositório da Microsoft da forma correta para Debian 12 ---
    # 1. Baixa a chave GPG da Microsoft e salva no formato correto
    curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /etc/apt/keyrings/microsoft.gpg && \
    chmod a+r /etc/apt/keyrings/microsoft.gpg && \
    #
    # 2. Adiciona o repositório da Microsoft, especificando a chave para verificação
    echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/microsoft.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql-release.list && \
    #
    # --- Instala o driver ---
    apt-get update && \
    ACCEPT_EULA=Y apt-get install -y msodbcsql17 && \
    #
    # --- Limpa o cache para manter a imagem final pequena ---
    rm -rf /var/lib/apt/lists/*

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia e instala as dependências do Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código da aplicação
COPY . .

# Comando que será executado quando o contêiner iniciar
CMD ["python", "app.py"]
