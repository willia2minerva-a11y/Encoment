// telegramBot.js
import TelegramBot from 'node-telegram-bot-api';
import CommandHandler from './core/CommandHandler.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
    console.log('⚠️ لم يتم توفير TELEGRAM_BOT_TOKEN');
} else {
    const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
        polling: {
            interval: 1000,
            params: { timeout: 10 }
        }
    });

    const commandHandler = new CommandHandler();

    bot.on('message', async (msg) => {
        try {
            const chatId = msg.chat.id;
            const text = msg.text;

            if (!text) return;

            const sender = {
                id: `tg_${msg.from.id}`,
                name: msg.from.first_name || msg.from.username || 'مستخدم',
                platform: 'telegram'
            };

            const response = await commandHandler.process(sender, text);

            // ✅ لا رد (سجن أو فارغ)
            if (response === null || response === undefined) {
                return;
            }

            if (response && response.type === 'image') {
                bot.sendPhoto(chatId, response.path, { caption: response.caption || '' });
            } else if (typeof response === 'string') {
                bot.sendMessage(chatId, response);
            } else if (response && response.message) {
                bot.sendMessage(chatId, response.message);
            } else {
                bot.sendMessage(chatId, '❌ لم أتمكن من معالجة طلبك.');
            }
        } catch (error) {
            console.error('❌ خطأ في بوت تلغرام:', error);
            bot.sendMessage(chatId, '❌ حدث خطأ غير متوقع.');
        }
    });

    console.log('✅ تم تشغيل بوت تلغرام (Economy)');
}
