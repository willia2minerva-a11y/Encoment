import mongoose from 'mongoose';
import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import CommandHandler from './core/CommandHandler.js';

// تحميل متغيرات البيئة
const MONGODB_URI = process.env.MONGODB_URI;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PORT = process.env.PORT || 3000;

if (!MONGODB_URI || !PAGE_ACCESS_TOKEN) {
    console.error('❌ متغيرات البيئة MONGODB_URI و PAGE_ACCESS_TOKEN مطلوبة');
    process.exit(1);
}

// تهيئة Express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let commandHandler;

// الاتصال بقاعدة البيانات
async function connectDatabase() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ تم الاتصال بقاعدة البيانات');
    } catch (error) {
        console.error('❌ فشل الاتصال بقاعدة البيانات:', error);
        process.exit(1);
    }
}

// إرسال رسالة نصية
async function sendTextMessage(senderId, text) {
    try {
        await axios.post(
            `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
            {
                recipient: { id: senderId },
                message: { text: text }
            }
        );
        console.log(`✅ رسالة نصية إلى ${senderId}`);
    } catch (error) {
        console.error('❌ خطأ في إرسال الرسالة:', error.response?.data || error.message);
    }
}

// إرسال صورة
async function sendImageMessage(senderId, imagePath, caption = '') {
    try {
        if (!fs.existsSync(imagePath)) {
            throw new Error(`الملف غير موجود: ${imagePath}`);
        }

        const FormData = (await import('form-data')).default;
        const formData = new FormData();

        formData.append('filedata', fs.createReadStream(imagePath), {
            filename: path.basename(imagePath),
            contentType: 'image/png',
        });

        formData.append('recipient', JSON.stringify({ id: senderId }));
        formData.append('message', JSON.stringify({
            attachment: {
                type: 'image',
                payload: { is_reusable: true }
            }
        }));

        await axios.post(
            'https://graph.facebook.com/v19.0/me/messages',
            formData,
            {
                params: { access_token: PAGE_ACCESS_TOKEN },
                headers: { ...formData.getHeaders() },
            }
        );

        console.log(`✅ صورة إلى ${senderId}`);
    } catch (error) {
        console.error('❌ خطأ في إرسال الصورة:', error.response?.data || error.message);
        if (caption) await sendTextMessage(senderId, caption + '\n\n(❌ فشل تحميل الصورة)');
    } finally {
        if (fs.existsSync(imagePath)) {
            try {
                fs.unlinkSync(imagePath);
            } catch (e) {}
        }
    }
}

// معالجة الرسائل
async function handleMessage(senderId, message) {
    console.log(`📩 رسالة من ${senderId}: ${message}`);

    try {
        if (!commandHandler) {
            commandHandler = new CommandHandler();
        }

        const sender = {
            id: senderId,
            name: `مستخدم-${senderId.slice(-6)}`,
            platform: 'facebook'
        };

        const response = await commandHandler.process(sender, message);

        if (response === null || response === undefined) {
            return;
        }

        if (response && response.type === 'image') {
            await sendImageMessage(senderId, response.path, response.caption);
        } else if (typeof response === 'string') {
            await sendTextMessage(senderId, response);
        } else if (response && response.message) {
            await sendTextMessage(senderId, response.message);
        } else {
            await sendTextMessage(senderId, '❌ لم أتمكن من معالجة طلبك.');
        }
    } catch (error) {
        console.error('❌ خطأ في معالجة الرسالة:', error);
        await sendTextMessage(senderId, '❌ حدث خطأ غير متوقع.');
    }
}

// Webhook - التحقق
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

// Webhook - استقبال الرسائل
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

// Health check
app.get('/', (req, res) => {
    res.status(200).json({
        status: '✅ البوت يعمل',
        name: 'سوق ريو - Souq Rio',
        version: '1.0.0'
    });
});

// معالجة الأخطاء
process.on('unhandledRejection', (reason) => {
    console.error('❌ خطأ غير معالج:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ استثناء غير معالج:', error);
});

// الدالة الرئيسية
async function main() {
    console.log('🚀 بدء تشغيل سوق ريو - Souq Rio...');

    try {
        await connectDatabase();

        commandHandler = new CommandHandler();
        console.log('✅ تم تهيئة CommandHandler');

        if (process.env.TELEGRAM_BOT_TOKEN) {
            await import('./telegramBot.js');
        }

        app.listen(PORT, () => {
            console.log(`✅ يعمل على المنفذ ${PORT}`);
            console.log('📱 جاهز لاستقبال الرسائل...');
        });
    } catch (error) {
        console.error('❌ فشل البدء:', error);
        process.exit(1);
    }
}

main().catch(console.error);
