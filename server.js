const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const app = express();
const PORT = 3000;

app.use(express.json());

// --- Rotas de Produtos ---
// GET /produtos: Lista todos os produtos
app.get('/produtos', async (req, res) => {
  const produtos = await prisma.produto.findMany();
  res.status(200).json(produtos);
});

// GET /produtos/:id: Busca um produto por ID
app.get('/produtos/:id', async (req, res) => {
  const produto = await prisma.produto.findUnique({
    where: { id: parseInt(req.params.id) }
  });
  if (!produto) {
    return res.status(404).json({ mensagem: 'Produto não encontrado.' });
  }
  res.status(200).json(produto);
});

// POST /produtos: Adiciona um novo produto
app.post('/produtos', async (req, res) => {
  const { nome, preco, estoque } = req.body;
  if (!nome || !preco || estoque === undefined) {
    return res.status(400).json({ mensagem: 'Campos obrigatórios faltando.' });
  }
  const novoProduto = await prisma.produto.create({
    data: { nome, preco, estoque }
  });
  res.status(201).json(novoProduto);
});

// PUT /produtos/:id: Atualiza um produto (sem estoque)
app.put('/produtos/:id', async (req, res) => {
  const { nome, preco } = req.body;
  try {
    const produtoAtualizado = await prisma.produto.update({
      where: { id: parseInt(req.params.id) },
      data: { nome, preco }
    });
    res.status(200).json(produtoAtualizado);
  } catch (error) {
    res.status(404).json({ mensagem: 'Produto não encontrado.' });
  }
});

// Atualiza o estoque do produto
app.put('/produtos/estoque/:id', async (req, res) => {
  const { quantidade, tipo } = req.body;
  if (!quantidade || !tipo) {
    return res.status(400).json({ mensagem: 'Quantidade e tipo são obrigatórios.' });
  }
  try {
    const produto = await prisma.produto.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!produto) {
      return res.status(404).json({ mensagem: 'Produto não encontrado.' });
    }

    const novoEstoque = tipo === 'ENTRADA' ? produto.estoque + quantidade : produto.estoque - quantidade;
    if (novoEstoque < 0) {
      return res.status(400).json({ mensagem: 'Estoque insuficiente para essa operação.' });
    }

    const produtoAtualizado = await prisma.produto.update({
      where: { id: parseInt(req.params.id) },
      data: { estoque: novoEstoque }
    });

    await prisma.movimentacaoEstoque.create({
      data: {
        produtoId: parseInt(req.params.id),
        tipo: tipo,
        quantidade: quantidade
      }
    });

    res.status(200).json(produtoAtualizado);
  } catch (error) {
    res.status(500).json({ mensagem: 'Erro ao atualizar estoque.' });
  }
});

// DELETE /produtos/:id: Deleta um produto
app.delete('/produtos/:id', async (req, res) => {
  try {
    await prisma.produto.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.status(200).json({ mensagem: 'Produto excluído com sucesso.' });
  } catch (error) {
    res.status(404).json({ mensagem: 'Produto não encontrado.' });
  }
});

// --- Rotas de Clientes ---
app.post('/clientes', async (req, res) => {
  const { nome, email } = req.body;
  if (!nome || !email) {
    return res.status(400).json({ mensagem: 'Nome e email são obrigatórios.' });
  }
  try {
    const novoCliente = await prisma.cliente.create({
      data: { nome, email }
    });
    res.status(201).json(novoCliente);
  } catch (error) {
    res.status(500).json({ mensagem: 'Erro ao cadastrar cliente.' });
  }
});

app.get('/clientes/:clienteId/pedidos', async (req, res) => {
  try {
    const pedidosCliente = await prisma.pedido.findMany({
      where: { clienteId: parseInt(req.params.clienteId) },
      include: { itens: { include: { produto: true } } }
    });
    res.status(200).json(pedidosCliente);
  } catch (error) {
    res.status(500).json({ mensagem: 'Erro ao buscar pedidos do cliente.' });
  }
});

// --- Rotas de Pedidos ---
// GET /pedidos: Lista todos os pedidos
app.get('/pedidos', async (req, res) => {
  const pedidos = await prisma.pedido.findMany({
    include: { itens: { include: { produto: true } }, cliente: true }
  });
  res.status(200).json(pedidos);
});

// GET /pedidos/:id: Busca um pedido por ID
app.get('/pedidos/:id', async (req, res) => {
  try {
    const pedido = await prisma.pedido.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { itens: { include: { produto: true } }, cliente: true, pagamentos: true }
    });
    if (!pedido) {
      return res.status(404).json({ mensagem: 'Pedido não encontrado.' });
    }
    res.status(200).json(pedido);
  } catch (error) {
    res.status(500).json({ mensagem: 'Erro ao buscar pedido.' });
  }
});

// POST /pedidos: Cria um novo pedido (com cliente)
app.post('/pedidos', async (req, res) => {
  const { clienteId, itens } = req.body;
  if (!clienteId || !itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ mensagem: 'Dados do pedido incompletos.' });
  }
  
  try {
    const resultado = await prisma.$transaction(async (prisma) => {
      let valorTotal = 0;
      const itensComDetalhes = [];
      
      for (const item of itens) {
        const produto = await prisma.produto.findUnique({ where: { id: item.produtoId } });
        if (!produto || produto.estoque < item.quantidade) {
          throw new Error(`Estoque insuficiente para o produto ID ${item.produtoId}.`);
        }
        
        valorTotal += produto.preco * item.quantidade;
        itensComDetalhes.push({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          precoUnitario: produto.preco
        });
      }
      
      const novoPedido = await prisma.pedido.create({
        data: {
          clienteId,
          valorTotal,
          itens: {
            create: itensComDetalhes,
          },
        },
        include: { itens: true }
      });
      
      for (const item of itens) {
        await prisma.produto.update({
          where: { id: item.produtoId },
          data: { estoque: { decrement: item.quantidade } }
        });
      }
      
      return novoPedido;
    });

    res.status(201).json(resultado);
  } catch (error) {
    res.status(400).json({ mensagem: error.message });
  }
});

// --- NOVOS ENDPOINTS ---

// Endpoint para confirmar o pagamento do pedido
app.post('/pedidos/:id/pagamento', async (req, res) => {
  const { metodos } = req.body; // Ex: [{ metodo: 'CARTAO', valor: 100 }, { metodo: 'PIX', valor: 50 }]
  if (!metodos || !Array.isArray(metodos) || metodos.length === 0) {
    return res.status(400).json({ mensagem: 'Métodos de pagamento inválidos.' });
  }
  
  try {
    const pedido = await prisma.pedido.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!pedido) {
      return res.status(404).json({ mensagem: 'Pedido não encontrado.' });
    }
    
    // Simulação da lógica de pagamento: 20% de chance de falha
    const pagamentoFalhou = Math.random() < 0.2;
    const statusFinal = pagamentoFalhou ? 'FALHA_NO_PAGAMENTO' : 'PAGO';

    await prisma.$transaction(async (prisma) => {
      // Cria registros de pagamento na tabela `Pagamento`
      for (const metodo of metodos) {
        await prisma.pagamento.create({
          data: {
            pedidoId: pedido.id,
            metodo: metodo.metodo,
            valor: metodo.valor,
            sucesso: !pagamentoFalhou
          }
        });
      }

      // Atualiza o status do pedido
      const pedidoAtualizado = await prisma.pedido.update({
        where: { id: pedido.id },
        data: { status: statusFinal }
      });

      // Se o pagamento falhou, o pedido é cancelado e o estoque é revertido
      if (pagamentoFalhou) {
        const itensPedido = await prisma.itensPedido.findMany({ where: { pedidoId: pedido.id } });
        for (const item of itensPedido) {
          await prisma.produto.update({
            where: { id: item.produtoId },
            data: { estoque: { increment: item.quantidade } }
          });
        }
      }
      
      return pedidoAtualizado;
    });

    res.status(200).json({
      mensagem: `Status do pedido atualizado para: ${statusFinal}`,
      sucesso: !pagamentoFalhou
    });

  } catch (error) {
    res.status(500).json({ mensagem: 'Erro ao processar pagamento.' });
  }
});

// Endpoint para buscar os métodos de pagamento de um pedido
app.get('/pedidos/:id/pagamentos', async (req, res) => {
    try {
        const pagamentos = await prisma.pagamento.findMany({
            where: { pedidoId: parseInt(req.params.id) }
        });
        if (pagamentos.length === 0) {
            return res.status(404).json({ mensagem: 'Nenhum pagamento encontrado para este pedido.' });
        }
        res.status(200).json(pagamentos);
    } catch (error) {
        res.status(500).json({ mensagem: 'Erro ao buscar pagamentos.' });
    }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});