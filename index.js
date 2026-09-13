// index.js
// الموقع: سوق ريو (الاقتصاد)
import { DataLoader } from './systems/data/DataLoader.js';
import mongoose from 'mongoose';
import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import CommandHandler from './core/CommandHandler.js';
import { MessageGateway } from './core/MessageGateway.js';

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

// ===================================
// ✅ Messenger Gateway — إرسال آمن (5-8 ثواني بين الرسائل)
// ===================================
const messengerGateway = new MessageGateway(
  {
    send: async (msg) => {
      await axios.post(
        `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
        {
          recipient: { id: msg.recipientId },
          message: { text: msg.text }
        }
      );
    }
  },
  {
    name: 'FB-Gateway-Souq',
    minIntervalMs: 5000,       // 5 ثواني أساس
    jitterMs: 3000,            // + 0-3 ثواني عشوائية
    maxPerHour: 150,           // 150 رسالة/ساعة
    maxPerDay: 1500,           // 1500 رسالة/يوم
    maxRetries: 2
  }
);

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
// إرسال رسائل فيسبوك (عبر Gateway)
// ===================================
async function sendTextMessage(senderId, text, priority = 'normal') {
  messengerGateway.enqueue({
    recipientId: senderId,
    text
  }, priority);
}

async function sendImageMessage(senderId, imagePath, caption = '') {
  try {
    if (!fs.existsSync(imagePath)) throw new Error(`الملف غير موجود: ${imagePath}`);

    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('filedata', fs.createReadStream(imagePath), {
      filename: path.basename(imagePath),
      contentType: 'image/png',
    });
    formData.append('recipient', JSON.stringify({ id: senderId }));
    formData.append('message', JSON.stringify({
      attachment: { type: 'image', payload: { is_reusable: true } }
    }));

    await axios.post(
      'https://graph.facebook.com/v19.0/me/messages',
      formData,
      { params: { access_token: PAGE_ACCESS_TOKEN }, headers: { ...formData.getHeaders() } }
    );

    console.log(`✅ صورة إلى ${senderId}`);
  } catch (error) {
    console.error('❌ خطأ في إرسال الصورة:', error.response?.data || error.message);
    if (caption) await sendTextMessage(senderId, caption + '\n\n(❌ فشل تحميل الصورة)');
  } finally {
    if (fs.existsSync(imagePath)) {
      try { fs.unlinkSync(imagePath); } catch (e) {}
    }
  }
}

// ===================================
// معالجة الإعلانات (عبر Gateway)
// ===================================
async function handleAnnouncement(response, senderId) {
  console.log(`📢 بدء إرسال الإعلان لـ ${response.recipients.length} مستخدم عبر Gateway...`);
  let successCount = 0;
  let failCount = 0;

  for (const recipient of response.recipients) {
    try {
      if (recipient.platform === 'facebook') {
        // ✅ يمر عبر Gateway (low priority للإعلانات)
        await sendTextMessage(recipient.platformId, response.text, 'low');
        successCount++;
      } else if (recipient.platform === 'telegram' && telegramBotInstance) {
        try {
          await telegramBotInstance.sendMessage(recipient.platformId.replace('tg_', ''), response.text);
          successCount++;
        } catch (e) {
          failCount++;
        }
      }
      // ⚠️ لا setTimeout — Gateway يدير التوقيت
    } catch (error) {
      failCount++;
      console.error(`❌ فشل الإرسال إلى ${recipient.platformId}:`, error.message);
    }
  }

  console.log(`✅ تم جدولة الإعلان: ${successCount} في الطابور، ${failCount} فشل`);

  await sendTextMessage(
    senderId,
    `📢 تم إرسال الإعلان للطابور\n\n✅ في الطابور: ${successCount}\n❌ فشل: ${failCount}\n📊 الإجمالي: ${response.recipients.length}\n\n⏰ سيتم الإرسال تدريجيًا (~${Math.ceil(successCount * 6.5 / 60)} دقيقة)`
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
// Health Check
// ===================================
app.get('/', (req, res) => {
  res.status(200).json({
    status: '✅ يعمل',
    name: 'سوق ريو - Souq Rio',
    mode: 'market',
    version: '2.0.0'
  });
});

// ===================================
// Gateway Stats
// ===================================
app.get('/gateway', (req, res) => {
  res.status(200).json(messengerGateway.getStats());
});

// ===================================
// Graceful Shutdown
// ===================================
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM — إيقاف آمن');
  await messengerGateway.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT — إيقاف آمن');
  await messengerGateway.shutdown();
  process.exit(0);
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
// Main
// ===================================
async function main() {
  console.log('🚀 بدء تشغيل سوق ريو - Souq Rio...');

  try {
    // ✅ 1. الاتصال بقاعدة البيانات
    await connectDatabase();

    // ✅ 2. تحميل البيانات من MongoDB
    await DataLoader.initialize();

    // ✅ 2.5. إنشاء/تحديث الأدمن الرئيسي
    const Player = (await import('./core/models/Player.js')).default;
    await Player.ensureRootAdmin();

    // ✅ 3. CommandHandler
    commandHandler = new CommandHandler();
    console.log('✅ تم تهيئة CommandHandler');

    // ✅ 3.5. تشغيل مراقب Gateway
    messengerGateway.startMonitor();

    // ✅ 4. بوت تلغرام
    if (process.env.TELEGRAM_BOT_TOKEN) {
      const telegramModule = await import('./telegramBot.js');
      telegramBotInstance = telegramModule.default;
    }

    // ✅ 5. الخادم
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
