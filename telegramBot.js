// telegramBot.js
// الموقع: سوق ريو (الاقتصاد)
import TelegramBot from 'node-telegram-bot-api';
import CommandHandler from './core/CommandHandler.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

let bot = null;
let commandHandler = null;

if (!TELEGRAM_BOT_TOKEN) {
    console.log('⚠️ لم يتم توفير TELEGRAM_BOT_TOKEN');
} else {
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
        polling: {
            interval: 1000,
            params: { timeout: 10 }
        }
    });

    commandHandler = new CommandHandler();

    // ===================================
    // معالجة الإعلانات
    // ===================================
    async function handleAnnouncement(response, chatId) {
        console.log(`📢 إرسال الإعلان لـ ${response.recipients.length} مستخدم...`);
        let successCount = 0;
        let failCount = 0;

        for (const recipient of response.recipients) {
            try {
                if (recipient.platform === 'telegram') {
                    const chatIdToSend = recipient.platformId.replace('tg_', '');
                    await bot.sendMessage(chatIdToSend, response.text);
                    successCount++;
                }
                await new Promise(r => setTimeout(r, 100));
            } catch (error) {
                failCount++;
                console.error(`❌ فشل الإرسال إلى ${recipient.platformId}:`, error.message);
            }
        }

        await bot.sendMessage(
            chatId,
            `📢 تم إرسال الإعلان\n\n✅ نجح: ${successCount}\n❌ فشل: ${failCount}\n📊 الإجمالي: ${response.recipients.length}`
        );
    }

    // ===================================
    // معالجة الرسائل
    // ===================================
    bot.on('message', async (msg) => {
        try {
            const chatId = msg.chat.id;
            let text = msg.text;

            if (!text) return;

            if (text === '/start') text = 'بدء';

            const sender = {
                id: `tg_${msg.from.id}`,
                name: msg.from.first_name || msg.from.username || 'مستخدم',
                platform: 'telegram'
            };

            const response = await commandHandler.process(sender, text);

            if (response === null || response === undefined) return;

            if (response && response._announcement) {
                await handleAnnouncement(response, chatId);
                return;
            }

            if (response && response.type === 'image') {
                await bot.sendPhoto(chatId, response.path, { caption: response.caption || '' });
            }
            else if (typeof response === 'string') {
                await bot.sendMessage(chatId, response);
            }
            else if (response && response.message) {
                await bot.sendMessage(chatId, response.message);
            }
            else {
                await bot.sendMessage(chatId, '❌ لم أتمكن من معالجة طلبك.');
            }
        } catch (error) {
            console.error('❌ خطأ في بوت تلغرام:', error);
            try {
                await bot.sendMessage(msg.chat.id, '❌ حدث خطأ غير متوقع.');
            } catch (e) {}
        }
    });

    console.log('✅ تم تشغيل بوت تلغرام (سوق ريو)');
}

export default bot;
