const express = require('express');
const { PrismaClient, Prisma } = require('@prisma/client');
const { createClient } = require('redis');

const prisma = new PrismaClient();
const app = express();

// REQUISITO: Tamanho máximo de 200kb
app.use(express.json({ limit: '200kb' }));

const PORT = process.env.PORT || 3001;

// Configuração Redis
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
redisClient.on('error', (err) => console.log('Redis Client Error', err));
(async () => { await redisClient.connect(); })();

// Rotas existentes...
// POST /users (Mantém igual, sem cache)
app.post('/users', async (req, res) => {
  // ... seu código de criar usuário ...
  const { name, email } = req.body;
  try {
    const newUser = await prisma.user.create({ data: { name, email } });
    res.status(201).json(newUser);
  } catch (error) { res.status(500).json({error: error.message}); }
});

// GET /users/:id COM CACHE (TTL 1 Dia = 86400s)
app.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 1. Tenta pegar do Redis
    const cacheKey = `user:${id}`;
    const cachedUser = await redisClient.get(cacheKey);
    if (cachedUser) {
        console.log('[CACHE] Hit no Redis');
        return res.json(JSON.parse(cachedUser));
    }

    // 2. Se não tem, busca no banco
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    // 3. Salva no Redis
    await redisClient.set(cacheKey, JSON.stringify(user), { EX: 86400 }); // 1 dia
    console.log('[CACHE] Miss - Salvo no Redis');

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

// GET /users (Listar todos) - Sem cache obrigatório no requisito
app.get('/users', async (req, res) => {
    const users = await prisma.user.findMany();
    res.json(users);
});

// PUT /users/:id (Limpa o cache se atualizar!)
app.put('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email } = req.body;
        const updated = await prisma.user.update({ where: { id }, data: { name, email }});
        
        // Invalida o cache
        await redisClient.del(`user:${id}`);
        
        res.json(updated);
    } catch(e) { res.status(500).json({error: e.message})}
});

// DELETE (Limpa cache)
app.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.user.delete({ where: { id }});
        await redisClient.del(`user:${id}`);
        res.json({ success: true });
    } catch(e) { res.status(500).json({error: e.message})}
});

app.listen(PORT, () => console.log(`🚀 Users Service rodando na porta ${PORT}`));