# Usa a imagem base completa do Node.js v18 (baseada em Debian)
FROM node:18

# Instala utilitários de rede (pode remover se não usar mais wait-for-it ou ping)
RUN apt-get update && apt-get install -y netcat-traditional iputils-ping

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia primeiro os arquivos de dependências
COPY package*.json ./

# Instala todas as dependências do projeto
RUN npm install

# Copia os arquivos do Prisma
COPY prisma ./prisma/

# Gera o Prisma Client
RUN npx prisma generate

# Copia o resto do código da sua aplicação
COPY . .

# Expõe a porta (AJUSTE PARA CADA SERVIÇO: 3001, 3002, 3003, 3004)
EXPOSE 3003