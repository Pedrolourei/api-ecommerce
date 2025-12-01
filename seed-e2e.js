const axios = require('axios');

// AGORA TUDO PASSA PELO GATEWAY (Porta 8000)
const GATEWAY_URL = 'http://localhost:8000';

const USERS_API = `${GATEWAY_URL}/users`;
const PRODUCTS_API = `${GATEWAY_URL}/products`;
const ORDERS_API = `${GATEWAY_URL}/orders`;

// Dados aleatórios
const randomSuffix = Math.floor(Math.random() * 10000);
const mockUser = {
    name: `Cliente Seed ${randomSuffix}`,
    email: `cliente${randomSuffix}@teste.com`
};
const mockProduct = {
    name: `Produto Seed ${randomSuffix}`,
    price: (Math.random() * 1000).toFixed(2),
    stock: 100
};

async function runSeed() {
    console.log('🌱 --- INICIANDO SEED VIA KONG (GATEWAY) ---');

    try {
        // 1. Criar Usuário
        console.log('1. Criando Usuário...');
        const userRes = await axios.post(USERS_API, mockUser);
        const userId = userRes.data.id;
        console.log(`   ✅ Usuário criado: ${userId}`);

        // 2. Criar Produto
        console.log('2. Criando Produto...');
        const prodRes = await axios.post(PRODUCTS_API, mockProduct);
        const productId = prodRes.data.id;
        console.log(`   ✅ Produto criado: ${productId}`);

        // 3. Criar Pedido
        console.log('3. Criando Pedido...');
        const orderPayload = {
            userId: userId,
            items: [{ productId: productId, quantity: 2 }],
            paymentData: { method: "CREDIT_CARD_SEED" }
        };

        const orderRes = await axios.post(ORDERS_API, orderPayload);
        const orderId = orderRes.data.id;
        
        console.log(`   ✅ Pedido Criado! ID: ${orderId}`);
        console.log('   🚀 Verifique Kafka UI e Redis Commander.');

    } catch (error) {
        console.error('❌ ERRO NO SEED (Verifique se o Kong subiu):', error.response ? error.response.data : error.message);
    }
}

runSeed();