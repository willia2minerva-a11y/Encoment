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
    // ✅ polling: false أولاً
    bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false });
    commandHandler = new CommandHandler();

    (async () => {
        try {
            await new Promise(r => setTimeout(r, 5000));
            try { await bot.deleteWebHook(); } catch (e) {}
            await bot.startPolling({ restart: true });
            console.log('✅ بدأ polling (سوق ريو)');
        } catch (error) {
            console.error('⚠️ خطأ polling:', error.message);
        }
    })();

    async function handleAnnouncement(response, chatId) {
        console.log(`📢 إرسال لـ ${response.recipients.length} مستخدم`);
        let successCount = 0;
        let failCount = 0;

        for (const recipient of response.recipients) {
            try {
                if (recipient.platform === 'telegram') {
                    const cid = recipient.platformId.replace('tg_', '');
                    await bot.sendMessage(cid, response.text);
                    successCount++;
                }
                await new Promise(r => setTimeout(r, 150));
            } catch (error) {
                failCount++;
            }
        }

        await bot.sendMessage(chatId, 
            `📢 تم الإرسال\n\n✅ نجح: ${successCount}\n❌ فشل: ${failCount}\n📊 الإجمالي: ${response.recipients.length}`
        );
    }

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
            } else if (typeof response === 'string') {
                await bot.sendMessage(chatId, response);
            } else if (response && response.message) {
                await bot.sendMessage(chatId, response.message);
            } else {
                await bot.sendMessage(chatId, '❌ لم أتمكن من معالجة طلبك.');
            }
        } catch (error) {
            console.error('❌ خطأ:', error);
            try { await bot.sendMessage(msg.chat.id, '❌ حدث خطأ.'); } catch (e) {}
        }
    });

    bot.on('polling_error', (error) => {
        if (!error.message.includes('409')) {
            console.error('⚠️ polling error:', error.message);
        }
    });

    process.on('SIGTERM', async () => {
        console.log('🛑 SIGTERM - إيقاف polling...');
        try { await bot.stopPolling(); } catch (e) {}
    });

    process.on('SIGINT', async () => {
        console.log('🛑 SIGINT - إيقاف polling...');
        try { await bot.stopPolling(); } catch (e) {}
    });

    console.log('✅ telegramBot.js (سوق ريو) جاهز');
}

export default bot;
