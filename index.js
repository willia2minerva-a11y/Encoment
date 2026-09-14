// index.js
// الموقع: سوق ريو (الاقتصاد)
import { DataLoader } from './systems/data/DataLoader.js';
import mongoose from 'mongoose';
import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import CommandHandler from './core/CommandHandler.js';
import MessageGateway from './core/MessageGateway.js';

const MONGODB_URI = process.env.MONGODB_URI;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PORT = process.env.PORT || 3000;

if (!MONGODB_URI || !PAGE_ACCESS_TOKEN) {
  console.error('❌ متغيرات البيئة مطلوبة');
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let commandHandler;
let telegramBotInstance = null;
let messageGateway;

// ===================================
// الاتصال بقاعدة البيانات
// ===================================
async function connectDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ تم الاتصال بقاعدة البيانات');
  } catch (error) {
    console.error('❌ فشل الاتصال:', error);
    process.exit(1);
  }
}

// ===================================
// Transports
// ===================================
async function sendTextTransport(recipientId, text) {
  const response = await axios.post(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id: recipientId },
      message: { text: text }
    },
    { timeout: 20000 }
  );
  return response.data;
}

async function sendImageTransport(recipientId, imagePath, caption = '') {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`الملف غير موجود: ${imagePath}`);
  }

  const formData = new FormData();
  formData.append('filedata', fs.createReadStream(imagePath), {
    filename: path.basename(imagePath),
    contentType: 'image/png',
  });
  formData.append('recipient', JSON.stringify({ id: recipientId }));
  formData.append('message', JSON.stringify({
    attachment: { type: 'image', payload: { is_reusable: true } }
  }));

  try {
    const response = await axios.post(
      'https://graph.facebook.com/v19.0/me/messages',
      formData,
      {
        params: { access_token: PAGE_ACCESS_TOKEN },
        headers: { ...formData.getHeaders() },
        timeout: 30000
      }
    );
    return response.data;
  } finally {
    if (fs.existsSync(imagePath)) {
      try { fs.unlinkSync(imagePath); } catch (e) {}
    }
  }
}

// ===================================
// تهيئة Gateway
// ===================================
function setupMessageGateway() {
  messageGateway = new MessageGateway({
    sendText: sendTextTransport,
    sendImage: sendImageTransport,
    logger: console,
    name: 'FB-Gateway-Souq'
  });
  messageGateway.startMonitor();
  console.log('🛡️ MessageGateway مفعل (5-15s / 16s spam)');
}

// ===================================
// Helpers
// ===================================
async function sendTextMessage(senderId, text, options = {}) {
  if (!messageGateway) setupMessageGateway();
  try {
    return await messageGateway.sendText(senderId, text, options);
  } catch (error) {
    console.error('❌ فشل الإرسال:', error.message);
    return null;
  }
}

async function sendImageMessage(senderId, imagePath, caption = '', options = {}) {
  if (!messageGateway) setupMessageGateway();
  try {
    return await messageGateway.sendImage(senderId, imagePath, caption, options);
  } catch (error) {
    console.error('❌ فشل إرسال الصورة:', error.message);
    return null;
  }
}

// ===================================
// معالجة الإعلانات
// ===================================
async function handleAnnouncement(response, senderId) {
  console.log(`📢 جدولة إعلان لـ ${response.recipients.length} مستخدم...`);
  let queuedCount = 0;
  let failCount = 0;

  for (const recipient of response.recipients) {
    try {
      if (recipient.platform === 'facebook') {
        await sendTextMessage(recipient.platformId, response.text, { priority: 'low' });
        queuedCount++;
      } else if (recipient.platform === 'telegram' && telegramBotInstance) {
        try {
          await telegramBotInstance.sendMessage(recipient.platformId.replace('tg_', ''), response.text);
          queuedCount++;
        } catch (e) {
          failCount++;
        }
      }
    } catch (error) {
      failCount++;
      console.error(`❌ فشل جدولة ${recipient.platformId}:`, error.message);
    }
  }

  const minutes = Math.ceil(queuedCount * 10 / 60);
  console.log(`✅ تم جدولة: ${queuedCount} | فشل: ${failCount}`);

  await sendTextMessage(
    senderId,
    `📢 تم جدولة الإعلان\n\n✅ في الطابور: ${queuedCount}\n❌ فشل: ${failCount}\n📊 الإجمالي: ${response.recipients.length}\n\n⏰ سيُرسل تدريجيًا (~${minutes} دقيقة)`
  );
}

// ===================================
// معالجة الرسائل
// ===================================
async function handleMessage(senderId, message) {
  console.log(`📩 رسالة من ${senderId}: ${message}`);

  try {
    if (!commandHandler) commandHandler = new CommandHandler();

    const sender = {
      id: senderId,
      name: `مستخدم-${senderId.slice(-6)}`,
      platform: 'facebook'
    };

    const response = await commandHandler.process(sender, message);

    if (response === null || response === undefined) return;

    if (response && response._announcement) {
      await handleAnnouncement(response, senderId);
      return;
    }

    if (response && response.type === 'image') {
      await sendImageMessage(senderId, response.path, response.caption);
    }
    else if (typeof response === 'string') {
      await sendTextMessage(senderId, response);
    }
    else if (response && response.message) {
      await sendTextMessage(senderId, response.message);
    }
    else {
      await sendTextMessage(senderId, '❌ لم أتمكن من معالجة طلبك.');
    }
  } catch (error) {
    console.error('❌ خطأ في معالجة الرسالة:', error);
    await sendTextMessage(senderId, '❌ حدث خطأ غير متوقع.');
  }
}

// ===================================
// Webhook
// ===================================
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ تم التحقق من webhook');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  try {
    const { body } = req;
    if (body.object === 'page') {
      for (const entry of body.entry) {
        for (const event of entry.messaging) {
          if (event.message && event.message.text) {
            await handleMessage(event.sender.id, event.message.text);
          }
          if (event.postback && event.postback.payload === 'GET_STARTED') {
            await handleMessage(event.sender.id, 'بدء');
          }
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('❌ خطأ webhook:', error);
    res.sendStatus(500);
  }
});

// ===================================
// Health + Stats
// ===================================
app.get('/', (req, res) => {
  res.status(200).json({
    status: '✅ يعمل',
    name: 'سوق ريو - Souq Rio',
    mode: 'market',
    version: '2.0.0'
  });
});

app.get('/gateway', (req, res) => {
  if (!messageGateway) return res.status(503).json({ error: 'Gateway not ready' });
  res.status(200).json(messageGateway.getStatus());
});

// ===================================
// الأخطاء
// ===================================
process.on('unhandledRejection', (reason) => {
  console.error('❌ خطأ غير معالج:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ استثناء غير معالج:', error);
});

// ===================================
// Graceful Shutdown
// ===================================
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM — إيقاف آمن');
  if (messageGateway) await messageGateway.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT — إيقاف آمن');
  if (messageGateway) await messageGateway.shutdown();
  process.exit(0);
});

// ===================================
// Main
// ===================================
async function main() {
  console.log('🚀 بدء تشغيل سوق ريو - Souq Rio...');

  try {
    await connectDatabase();
    await DataLoader.initialize();

    const Player = (await import('./core/models/Player.js')).default;
    await Player.ensureRootAdmin();

    commandHandler = new CommandHandler();
    console.log('✅ تم تهيئة CommandHandler');

    setupMessageGateway();

    if (process.env.TELEGRAM_BOT_TOKEN) {
      const telegramModule = await import('./telegramBot.js');
      telegramBotInstance = telegramModule.default;
    }

    app.listen(PORT, () => {
      console.log(`✅ يعمل على المنفذ ${PORT}`);
      console.log('📱 جاهز لاستقبال الرسائل');
    });
  } catch (error) {
    console.error('❌ فشل البدء:', error);
    process.exit(1);
  }
}

main().catch(console.error);
