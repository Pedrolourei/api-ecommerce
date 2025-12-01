# Usa a imagem base completa do Node.js v18 (baseada em Debian)
FROM node:18

RUN apt-get update && apt-get install -y netcat-traditional iputils-ping


WORKDIR /app


COPY package*.json ./


RUN npm install

COPY prisma ./prisma/


RUN npx prisma generate

COPY . .

EXPOSE 3001