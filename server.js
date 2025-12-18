// server.js
// Serviço Node.js para integração com WhatsApp Web
// - Geração de QR Code (endpoint /qr)
// - Status da conexão (/status)
// - Envio de mensagens via HTTP (/enviar)

const express = require('express');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
app.use(express.json({ limit: '1mb' }));

// ==========================
// WhatsApp Client
// ==========================
const client = new Client({
  authStrategy: new LocalAuth(), // mantém sessão local
  puppeteer: {
    headless: true, // executa em background (sem abrir navegador)
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

let lastQrDataUrl = null;
let isReady = false;

// ==========================
// Eventos do WhatsApp
// ==========================
client.on('qr', async (qr) => {
  try {
    // Exibe QR no terminal (opcional)
    qrcodeTerminal.generate(qr, { small: true });

    // Gera QR em formato DataURL (PNG)
    lastQrDataUrl = await qrcode.toDataURL(qr, {
      width: 300,
      margin: 1
    });

    isReady = false;
    console.log('[QR] Novo QR Code gerado.');
  } catch (err) {
    console.error('Erro ao gerar QR:', err);
  }
});

client.on('ready', () => {
  isReady = true;
  lastQrDataUrl = null;
  console.log('✅ WhatsApp conectado e pronto.');
});

client.on('auth_failure', (msg) => {
  console.error('⚠️ Falha de autenticação:', msg);
});

client.on('disconnected', (reason) => {
  console.warn('⚠️ WhatsApp desconectado:', reason);
  isReady = false;

  // tenta reconectar automaticamente
  setTimeout(() => {
    client.initialize();
  }, 3000);
});

// Inicializa o cliente
client.initialize();

// ========================================================
// Comando interno: responder com o ID do chat ao enviar "/id"
// Útil para identificar grupos ou contatos
// ========================================================
client.on('message', async (msg) => {
  try {
    if (msg.body.trim().toLowerCase() === '/id') {
      const chatId = msg.from;
      await msg.reply(`🔑 *ID do chat:* ${chatId}`);
      console.log('ID enviado:', chatId);
    }
  } catch (err) {
    console.error('Erro ao processar comando /id:', err);
  }
});

// ==========================
// Endpoints HTTP
// ==========================

// Retorna status e QR Code (se existir)
app.get('/qr', (req, res) => {
  res.json({
    ready: isReady,
    qr: lastQrDataUrl
  });
});

// Retorna apenas o status da conexão
app.get('/status', (req, res) => {
  res.json({ ready: isReady });
});

/*
POST /enviar
Body JSON:
{
  "group_id": "ID_DO_GRUPO_OU_CHAT",
  "mensagem": "Texto da mensagem"
}
*/
app.post('/enviar', async (req, res) => {
  try {
    const { group_id, mensagem } = req.body;

    if (!group_id || !mensagem) {
      return res
        .status(400)
        .json({ erro: 'group_id e mensagem são obrigatórios' });
    }

    await client.sendMessage(group_id, mensagem);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err?.message || err);
    return res.status(500).json({ erro: String(err) });
  }
});

// ==========================
// Start Server
// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server rodando em http://localhost:${PORT}`);
});