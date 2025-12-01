# Usa uma imagem base leve do Node.js
FROM node:18-alpine

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de dependência e instala
# O uso do 'package*.json' garante que o lockfile (se existir) seja copiado também
COPY package*.json ./
# Instala todas as dependências do projeto
RUN npm install

# Copia o código da aplicação (server.js, utils/, prisma/, etc.)
COPY . .

# Comando padrão para iniciar a aplicação 
# (Será sobrescrito no docker-compose.yml para rodar as migrações/db push)
CMD ["npm", "start"]