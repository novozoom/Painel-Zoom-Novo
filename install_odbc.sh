#!/usr/bin/env bash
set -e

# Atualiza pacotes
apt-get update

# Dependências básicas
apt-get install -y curl gnupg apt-transport-https

# Adiciona o repositório da Microsoft
curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add -
curl https://packages.microsoft.com/config/debian/12/prod.list > /etc/apt/sources.list.d/mssql-release.list

# Atualiza e instala o driver
apt-get update
ACCEPT_EULA=Y apt-get install -y msodbcsql17 unixodbc-dev
