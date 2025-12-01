const axios = require('axios');

// Configuração padrão com timeout de 10 segundos (10000ms)
const api = axios.create({
    timeout: 10000, 
});

module.exports = api;