# ==============================================================================
# ARQUIVO DE TESTE DAS ROTAS (E-COMMERCE MICROSERVICES)
# ATENCAO: Todas as requisicoes passam pelo KONG API GATEWAY (Porta 8000).
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. SERVICO DE USUARIOS (Users Service)
# ------------------------------------------------------------------------------

# Criar um novo usuário
curl --request POST \
  --url http://localhost:8000/users \
  --header 'Content-Type: application/json' \
  --data '{"name": "Professor Avaliador", "email": "professor@teste.com"}'

# Buscar usuário por ID (Cacheado por 1 dia no Redis)
# SUBSTITUA O ID ABAIXO PELO ID RETORNADO NA CRIACAO
curl --request GET \
  --url http://localhost:8000/users/SUBSTITUA_PELO_ID_DO_USUARIO

# Listar todos usuários (Teste de carga/Rate Limit)
curl --request GET \
  --url http://localhost:8000/users

# ------------------------------------------------------------------------------
# 2. SERVICO DE PRODUTOS (Products Service)
# ------------------------------------------------------------------------------

# Criar um novo produto
curl --request POST \
  --url http://localhost:8000/products \
  --header 'Content-Type: application/json' \
  --data '{"name": "Notebook Dell", "price": 4500.00, "stock": 50}'

# Listar produtos (Cacheado por 4 horas no Redis)
curl --request GET \
  --url http://localhost:8000/products

# Buscar produto por ID
# SUBSTITUA O ID ABAIXO PELO ID RETORNADO NA CRIACAO
curl --request GET \
  --url http://localhost:8000/products/SUBSTITUA_PELO_ID_DO_PRODUTO

# ------------------------------------------------------------------------------
# 3. SERVICO DE PAGAMENTOS (Payments Service)
# ------------------------------------------------------------------------------

# Listar tipos de pagamento (Cache Infinito no Redis)
curl --request GET \
  --url http://localhost:8000/payments/types

# ------------------------------------------------------------------------------
# 4. SERVICO DE PEDIDOS (Orders Service)
# ------------------------------------------------------------------------------

# Criar um pedido (Fluxo Assincrono: API -> Kafka -> Consumer)
# NECESSARIO SUBSTITUIR OS IDs PELOS CRIADOS NOS PASSOS ANTERIORES
curl --request POST \
  --url http://localhost:8000/orders \
  --header 'Content-Type: application/json' \
  --data '{
    "userId": "COLE_AQUI_O_ID_DO_USUARIO",
    "items": [
        { "productId": "COLE_AQUI_O_ID_DO_PRODUTO", "quantity": 1 }
    ],
    "paymentData": { "method": "CREDIT_CARD" }
}'

# Buscar pedido por ID (Cacheado por 30 dias no Redis)
# SUBSTITUA O ID ABAIXO PELO ID DO PEDIDO CRIADO
curl --request GET \
  --url http://localhost:8000/orders/SUBSTITUA_PELO_ID_DO_PEDIDO

# Atualizar status do pedido (Rota auxiliar)
curl --request PUT \
  --url http://localhost:8000/orders/SUBSTITUA_PELO_ID_DO_PEDIDO/status \
  --header 'Content-Type: application/json' \
  --data '{"status": "ENTREGUE"}'

  # --- 7. Deletar Produto ---
# SUBSTITUA PELO ID DO PRODUTO CRIADO
curl -X DELETE http://localhost:8000/products/SUBSTITUA_PELO_ID_DO_PRODUTO

# --- 8. Teste de Segurança (Tentativa de Fraude) ---
# Tenta criar pedido enviando valor errado (Deve dar Erro 400)
curl -X POST http://localhost:8000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "ID_DO_USUARIO",
    "items": [{ "productId": "ID_DO_PRODUTO", "quantity": 1 }],
    "paymentData": { "method": "FRAUDE", "amount": 1.00 }
}'