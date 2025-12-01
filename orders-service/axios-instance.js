// orders-service/axios-instance.js
const axios = require('axios');

// Criamos uma instância do Axios configurada para falar com o products-service.
// A URL base virá da variável de ambiente que definimos no docker-compose.yml
const productsApiClient = axios.create({
  baseURL: process.env.PRODUCTS_SERVICE_URL, // Ex: http://products-service:3002
  timeout: 10000, // Timeout de 10 segundos
});

module.exports = { productsApiClient };