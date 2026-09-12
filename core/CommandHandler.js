// core/CommandHandler.js
import Player from './models/Player.js';
import { BalanceCardGenerator } from '../systems/card/BalanceCardGenerator.js';
import { AdminSystem } from '../systems/admin/AdminSystem.js';
import { BalanceCommands } from './commands/BalanceCommands.js';
import { ShopCommands } from './commands/ShopCommands.js';
import { TransferCommands } from './commands/TransferCommands.js';
import { CodeCommands } from './commands/CodeCommands.js';
import { AdminEconomyCommands } from './commands/AdminEconomyCommands.js';
import { SystemLoader } from './utils/SystemLoader.js';

export default class CommandHandler {
    constructor() {
        console.log('🔄 تهيئة CommandHandler...');

        try {
            this.adminSystem = new AdminSystem();
            this.adminSystem.setCommandHandler(this);

            this.cardGenerator = new BalanceCardGenerator();
            this.systems = {};

            this.adminProfileUrl = process.env.ADMIN_PROFILE_URL || 'https://facebook.com/';
            this.adminDisplayName = process.env.ADMIN_DISPLAY_NAME || 'الإدارة';
            this.gamePageUrl = process.env.GAME_PAGE_URL || 'https://facebook.com/MGARA-Game';

            this.initCommandClasses();
            this.commands = this.collectAllCommands();

            console.log('✅ CommandHandler تم تهيئته');
            console.log('📋 الأوامر المسجلة:', Object.keys(this.commands).length);
        } catch (error) {
            console.error('❌ فشل التهيئة:', error);
            throw error;
        }
    }

    initCommandClasses() {
        try {
            this.balanceCommands = new BalanceCommands(this);
            this.shopCommands = new ShopCommands(this);
            this.transferCommands = new TransferCommands(this);
            this.codeCommands = new CodeCommands(this);
            this.adminEconomyCommands = new AdminEconomyCommands(this);
            console.log('✅ تم تهيئة فئات الأوامر');
        } catch (error) {
            console.error('❌ خطأ في تهيئة الفئات:', error);
            throw error;
        }
    }

    collectAllCommands() {
        const allCommands = {};
        const sources = [
            this.balanceCommands,
            this.shopCommands,
            this.transferCommands,
            this.codeCommands,
            this.adminEconomyCommands
        ];

        sources.forEach(source => {
            if (source && typeof source.getCommands === 'function') {
                const commands = source.getCommands();
                if (commands) Object.assign(allCommands, commands);
            }
        });

        return allCommands;
    }

    async getSystem(systemName) {
        try {
            if (!this.systems[systemName]) {
                this.systems[systemName] = await SystemLoader.loadSystem(systemName);
                if (!this.systems[systemName]) return null;
                if (typeof this.systems[systemName].setCommandHandler === 'function') {
                    this.systems[systemName].setCommandHandler(this);
                }
            }
            return this.systems[systemName];
        } catch (error) {
            console.error(`❌ خطأ في تحميل ${systemName}:`, error);
            return null;
        }
    }

    // ✅ تطبيع الأمر
    normalizeCommand(command) {
        if (!command) return command;
        return command.replace(/[_\s]/g, '');
    }

    // ✅ فحص الأمر المركب
    isCompoundCommand(fullCommand) {
        const compound = [
            'اضف رصيد', 'اسحب رصيد', 'تعديل رصيد',
            'اضف منتج', 'حذف منتج', 'تعديل منتج',
            'قائمة المنتجات', 'اضف مخزون',
            'اضف كود', 'حذف كود', 'تعديل كود', 'قائمة الاكواد',
            'اضف خصم', 'حذف خصم', 'تعديل خصم', 'قائمة الخصومات',
            'اسحب صندوق', 'ايداع صندوق',
            'تعديل اعداد', 'حذف اعداد',
            'اقتصاد لاعب', 'معاملات لاعب'
        ];
        return compound.includes(fullCommand);
    }

    handleCompoundCommand(fullCommand) {
        const map = {
            'اضف رصيد': 'اضف_رصيد',
            'اسحب رصيد': 'اسحب_رصيد',
            'تعديل رصيد': 'تعديل_رصيد',
            'اضف منتج': 'اضف_منتج',
            'حذف منتج': 'حذف_منتج',
            'تعديل منتج': 'تعديل_منتج',
            'قائمة المنتجات': 'قائمة_المنتجات',
            'اضف مخزون': 'اضف_مخزون',
            'اضف كود': 'اضف_كود',
            'حذف كود': 'حذف_كود',
            'تعديل كود': 'تعديل_كود',
            'قائمة الاكواد': 'قائمة_الاكواد',
            'اضف خصم': 'اضف_خصم',
            'حذف خصم': 'حذف_خصم',
            'تعديل خصم': 'تعديل_خصم',
            'قائمة الخصومات': 'قائمة_الخصومات',
            'اسحب صندوق': 'اسحب_صندوق',
            'ايداع صندوق': 'ايداع_صندوق',
            'تعديل اعداد': 'تعديل_اعداد',
            'حذف اعداد': 'حذف_اعداد',
            'اقتصاد لاعب': 'اقتصاد_لاعب',
            'معاملات لاعب': 'معاملات_لاعب'
        };

        return {
            command: map[fullCommand] || fullCommand,
            args: []
        };
    }

    // ✅ معالج رئيسي
    async process(sender, message) {
        const { id, name, platform } = sender;
        const processedMessage = message.trim().toLowerCase();

        let commandParts = processedMessage.split(/\s+/);
        let command = commandParts[0];
        let args = commandParts.slice(1);

        // ✅ الأوامر المركبة
        let fullCommandAttempt = command;
        let remainingArgs = [...args];

        for (let i = Math.min(3, args.length); i >= 1; i--) {
            const attempt = command + ' ' + args.slice(0, i).join(' ');
            if (this.isCompoundCommand(attempt)) {
                fullCommandAttempt = attempt;
                remainingArgs = args.slice(i);
                break;
            }
        }

        if (this.isCompoundCommand(fullCommandAttempt)) {
            const result = this.handleCompoundCommand(fullCommandAttempt);
            command = result.command;
            args = result.args.concat(remainingArgs);
        }

        console.log(`📨 أمر: "${command}" من ${name}`);

        // ✅ جلب اللاعب
        let player = null;
        try {
            player = await Player.findOne({ userId: id });
            
            if (!player) {
                // اللاعب غير مسجل
                if (command === 'بدء' || command === 'مساعدة') {
                    return this.getWelcomeMessage();
                }
                return `❌ حسابك غير موجود.\n\n💡 سجّل في صفحة المغارة أولاً:\n${this.gamePageUrl}`;
            }
        } catch (error) {
            console.error('❌ خطأ في جلب اللاعب:', error);
            return '❌ حدث خطأ.';
        }

        // ✅ فحص السجن
        if (player.isJailed && player.isJailed()) {
            if (!player.jailNotified) {
                player.jailNotified = true;
                await player.save();

                const isPermanent = player.jailedUntil.getTime() === 0;
                const timeStr = isPermanent
                    ? '🚔 أنت مسجون بشكل دائم'
                    : `🚔 أنت مسجون حتى\n${player.jailedUntil.toLocaleString('ar-EG')}`;

                return `${timeStr}\n\n📝 السبب: ${player.jailedReason || 'غير محدد'}`;
            }
            return null; // لا رد
        }

        // ✅ فحص الحظر
        if (player.banned) {
            return '❌ تم حظرك من اللعبة.';
        }

        // ✅ فحص التسجيل
        if (player.registrationStatus !== 'completed') {
            return `❌ حسابك غير مفعّل.\n\n💡 سجّل في صفحة المغارة:\n${this.gamePageUrl}`;
        }

        // ✅ الأوامر الأساسية
        if (command === 'بدء' || command === 'مساعدة' || command === 'اوامر') {
            return this.getHelpMessage();
        }

        // ✅ جرب الأمر مباشرة
        try {
            const normalizedCommand = this.normalizeCommand(command);
            const handler = this.commands[command] || this.commands[normalizedCommand];

            if (handler) {
                const result = await handler.call(this, player, args, id);

                if (result === null || result === undefined) return null;
                if (typeof result === 'string') {
                    await player.save();
                }
                return result;
            }

            return this.getUnknownMessage(command);
        } catch (error) {
            console.error('❌ خطأ في معالجة الأمر:', error);
            return `❌ حدث خطأ: ${error.message}`;
        }
    }

    // ✅ رسالة الترحيب
    getWelcomeMessage() {
        return `💰 مرحباً بك في MGARA Economy

📖 صفحة الاقتصاد الرسمية للعبة المغارة

💡 ماذا تجد هنا:
• عرض رصيدك
• شراء منتجات
• تحويل الريو
• استخدام أكواد الخصم

⚠️ للتسجيل واللعب:
${this.gamePageUrl}

📋 أوامرك:
• رصيد - عرض رصيدك
• متجر - عرض المنتجات
• تحويل - تحويل لأي لاعب
• مساعدة - الأوامر كاملة`;
    }

    // ✅ رسالة المساعدة
    getHelpMessage() {
        return `💰 MGARA Economy - المساعدة

📊 الرصيد:
• رصيد - عرض رصيدك
• بطاقة - بطاقة رصيد مصورة
• معاملاتي - سجل معاملاتك

🛒 المتجر:
• متجر [صفحة] - عرض المنتجات
• شراء [ID] - شراء منتج

💸 التحويل:
• تحويل [الاسم] [المبلغ]

🎁 الأكواد:
• هدية [الكود] - استخدام كود هدية
• خصم [الكود] - تفعيل كود خصم

💡 للعب والتسجيل:
${this.gamePageUrl}`;
    }

    // ✅ رسالة أمر غير معروف
    getUnknownMessage(command) {
        return `❓ أمر غير معروف: "${command}"

💡 اكتب "مساعدة" للأوامر.
💡 للعب: ${this.gamePageUrl}`;
    }
    }
