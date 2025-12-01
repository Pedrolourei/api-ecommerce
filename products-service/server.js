// ... imports (express, prisma, redis) iguais ao user ...
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('redis');
const prisma = new PrismaClient();
const app = express();

app.use(express.json({ limit: '200kb' })); // REQUISITO 200kb

const PORT = process.env.PORT || 3002;
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
(async () => { await redisClient.connect(); })();

// POST /products (Invalida cache da lista)
app.post('/products', async (req, res) => {
  try {
    const { name, price, stock } = req.body;
    const product = await prisma.product.create({ data: { name, price: parseFloat(price), stock: parseInt(stock)} });
    
    // Invalida cache de lista
    await redisClient.del('products:all');
    
    res.status(201).json(product);
  } catch (error) { res.status(500).json({ error: 'Erro ao criar' }); }
});

// GET /products COM CACHE (TTL 4 Horas = 14400s)
app.get('/products', async (req, res) => {
  try {
    const cacheKey = 'products:all';
    const cached = await redisClient.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const products = await prisma.product.findMany();
    await redisClient.set(cacheKey, JSON.stringify(products), { EX: 14400 });
    res.json(products);
  } catch (error) { res.status(500).json({ error: 'Erro' }); }
});

// GET /products/:id (Sem cache obrigatório, mas boa prática)
app.get('/products/:id', async (req, res) => {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    if(!product) return res.status(404).json({error: "Not found"});
    res.json(product);
});

// POST update stock (Atualizar estoque invalida cache da lista? Talvez não precise ser agressivo, mas vamos invalidar)
app.post('/products/:id/stock/update', async (req, res) => {
    // ... logica de update ...
    try {
        const { id } = req.params;
        const { amount } = req.body;
        // ... verificações ...
        const updated = await prisma.product.update({ where: { id }, data: { stock: { increment: amount } }});
        
        await redisClient.del('products:all'); // Limpa cache da lista
        res.json(updated);
    } catch(e) { res.status(500).json({error: e.message})}
});

app.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verifica se existe
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });

    // Deleta do banco
    await prisma.product.delete({ where: { id } });

    // CRÍTICO: Invalida o cache da lista de produtos
    if (redisClient.isOpen) {
        await redisClient.del('products:all');
    }

    res.status(204).send(); // 204 No Content
  } catch (error) {
    // Se o produto estiver em um pedido, o banco pode impedir (integridade referencial)
    res.status(500).json({ error: 'Erro ao deletar produto (pode estar em uso).' });
  }
});

app.listen(PORT, () => console.log(`🚀 Products Service na porta ${PORT}`));