const axios = require('axios');

// Cliente para se comunicar com o Orders Service
const ordersApiClient = axios.create({
  baseURL: process.env.ORDERS_SERVICE_URL, 
  timeout: 10000, 
});

// Apenas exportamos o ordersApiClient. REMOVEMOS o notificationsApiClient.
module.exports = { ordersApiClient };