const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { productsApiClient } = require('./axios-instance');
const { Kafka } = require('kafkajs');
const { createClient } = require('redis'); // Adicionado Redis
require('dotenv').config(); 

const prisma = new PrismaClient();
const app = express();
app.use(express.json({ limit: '200kb' }));

const PORT = process.env.PORT || 3003;

// --- REDIS SETUP ---
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
redisClient.on('error', (err) => console.error('[REDIS ERROR]', err));
(async () => { 
    console.log('[DEBUG] Tentando conectar ao Redis...');
    await redisClient.connect(); 
    console.log('[DEBUG] Redis Conectado!');
})();

// --- KAFKA SETUP ---
const kafka = new Kafka({
  clientId: 'orders-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092'],
  retry: {
    initialRetryTime: 300,
    retries: 5
  }
});
const producer = kafka.producer();
let kafkaConnected = false;

async function connectKafkaProducer() {
  try {
    console.log('[DEBUG] Tentando conectar ao Kafka...');
    await producer.connect();
    console.log('✅ [DEBUG] Orders Service: Kafka Producer conectado');
    kafkaConnected = true;
  } catch (error) {
    console.error('❌ [DEBUG] Erro Kafka Producer:', error.message);
    // Não trava o app, tenta de novo em breve
    setTimeout(connectKafkaProducer, 5000);
  }
}

// --- ROTA POST /orders ---
app.post('/orders', async (req, res) => {
  console.log('--- [DEBUG] INÍCIO DO REQUEST POST /orders ---');
  const { userId, items, paymentData } = req.body; 

  if (!userId || !items) return res.status(400).json({ error: 'Dados incompletos' });

  try {
    // CHECKPOINT 1
    console.log('[DEBUG] 1. Buscando detalhes dos produtos (Chamada HTTP)...');
    
    const productIds = items.map(item => item.productId);
    const productsData = await Promise.all(productIds.map(id =>
      productsApiClient.get(`/products/${id}`)
        .then(r => {
            console.log(`[DEBUG] Produto ${id} encontrado.`);
            return r.data;
        })
        .catch(e => {
            console.error(`[DEBUG] Erro ao buscar produto ${id}:`, e.message);
            throw e;
        })
    ));
    
    console.log('[DEBUG] 2. Todos produtos encontrados. Validando estoque...');
    const productsMap = new Map(productsData.map(p => [p.id, p]));

    const itemsDetailsForOrder = [];
    let totalValue = 0;

    for (const item of items) {
      const product = productsMap.get(item.productId);
      if (product.stock < item.quantity) {
          console.log(`[DEBUG] Estoque insuficiente para ${product.name}`);
          return res.status(400).json({ error: 'Estoque insuficiente.' });
      }
      totalValue += product.price * item.quantity;
      itemsDetailsForOrder.push({ productId: item.productId, quantity: item.quantity, price: product.price });
    }
for (const item of items) {
      const product = productsMap.get(item.productId);
      if (product.stock < item.quantity) return res.status(400).json({ error: 'Estoque insuficiente.' });
      
      // Cálculo seguro do backend
      totalValue += product.price * item.quantity;
      
      itemsDetailsForOrder.push({ productId: item.productId, quantity: item.quantity, price: product.price });
    }

    if (paymentData && paymentData.amount !== undefined) {
        const userAmount = parseFloat(paymentData.amount);
        if (Math.abs(userAmount - totalValue) > 0.01) {
            return res.status(400).json({ 
                error: `Divergência de valores. Calculado: ${totalValue}, Enviado: ${userAmount}. O pedido foi recusado.` 
            });
        }
    }
    // -----------------------------------
    
    // CHECKPOINT 2
    console.log('[DEBUG] 3. Iniciando Transação no Banco de Dados...');
    const newOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId, totalValue, status: 'AGUARDANDO_PAGAMENTO',
          items: { create: itemsDetailsForOrder },
        },
        include: { items: true },
      });

      console.log('[DEBUG] 4. Pedido salvo no banco. Atualizando estoque...');
      await Promise.all(itemsDetailsForOrder.map(item =>
         productsApiClient.post(`/products/${item.productId}/stock/update`, { amount: -item.quantity })
      ));
      
      return order;
    });
    console.log(`[DEBUG] 5. Transação concluída. Pedido ID: ${newOrder.id}`);

    // CHECKPOINT 3
    console.log('[DEBUG] 6. Tentando enviar para o Kafka...');
    if (kafkaConnected) {
      const messagePayload = {
        orderId: newOrder.id,
        userId: userId,
        totalValue: totalValue,
        paymentData: paymentData || { method: "UNKNOWN" }
      };

      await producer.send({
        topic: 'checkout_process',
        messages: [{ key: newOrder.id, value: JSON.stringify(messagePayload) }],
      });
      console.log(`[DEBUG] 7. Sucesso! Evento enviado para o Kafka.`);
    } else {
      console.warn("⚠️ [DEBUG] Kafka OFFline! Pulando envio.");
    }

    res.status(201).json(newOrder);
    console.log('--- [DEBUG] FIM DO REQUEST COM SUCESSO ---');

  } catch (error) {
    console.error("❌ [DEBUG] ERRO FATAL NA ROTA:", error.message);
    const status = error.response ? error.response.status : 500;
    res.status(status).json({ error: error.message });
  }
});

// GET /orders/:id COM CACHE
app.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[DEBUG] Buscando pedido ${id}...`);
    
    // Redis Check
    if (redisClient.isOpen) {
        const cached = await redisClient.get(`order:${id}`);
        if (cached) {
            console.log('[DEBUG] Cache HIT');
            return res.json(JSON.parse(cached));
        }
    }

    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });

    // Redis Set
    if (redisClient.isOpen) {
        await redisClient.set(`order:${id}`, JSON.stringify(order), { EX: 2592000 });
    }
    
    res.json(order);
  } catch (error) { res.status(500).json({ error: 'Erro' }); }
});

app.listen(PORT, () => {
  console.log(`🚀 Orders Service rodando na porta ${PORT}`);
  connectKafkaProducer();
});