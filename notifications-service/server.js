const amqp = require('amqplib');
require('dotenv').config();

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const QUEUE_NAME = 'payment_notifications';

async function startConsumer() {
  console.log('Iniciando consumidor de notificações...');
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    console.log(`[+] Aguardando mensagens na fila: ${QUEUE_NAME}.`);

    channel.prefetch(1); 
    channel.consume(QUEUE_NAME, (msg) => {
      if (msg !== null) {
        try {
          const payload = JSON.parse(msg.content.toString());
          console.log('---------------------------------');
          console.log('[📩] Nova Notificação Recebida:');
          console.log(`   -> Para Usuário: ${payload.userId}`);
          console.log(`   -> Mensagem: ${payload.message}`);
          console.log('---------------------------------');
          channel.ack(msg);
        } catch (error) {
          console.error('Erro ao processar mensagem:', error.message);
          channel.nack(msg, false, false);
        }
      }
    });
  } catch (error) {
    console.error('Erro RabbitMQ:', error.message);
    console.log('Tentando reconectar em 10s...');
    setTimeout(startConsumer, 10000);
  }
}

startConsumer();