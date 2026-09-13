// core/CommandHandler.js
// الموقع: سوق ريو فقط
import Player from './models/Player.js';
import { AdminSystem } from '../systems/admin/AdminSystem.js';
import { RegistrationCommands } from './commands/RegistrationCommands.js';
import { EconomyCommands } from './commands/EconomyCommands.js';
import { BalanceCardGenerator } from '../systems/card/BalanceCardGenerator.js';
import { SystemLoader } from './utils/SystemLoader.js';

export default class CommandHandler {
    constructor() {
        console.log('🔄 تهيئة CommandHandler (سوق ريو)...');

        try {
            this.adminSystem = new AdminSystem();
            this.cardGenerator = new BalanceCardGenerator();
            this.systems = {};

            this.adminProfileUrl = process.env.ADMIN_PROFILE_URL || 'https://facebook.com/';
            this.adminDisplayName = process.env.ADMIN_DISPLAY_NAME || 'الإدارة';
            this.gamePageUrl = process.env.GAME_PAGE_URL || 'https://facebook.com/MgaraRio';
            this.marketPageUrl = process.env.MARKET_PAGE_URL || 'https://facebook.com/SouqRio';

            this.ARABIC_ITEM_MAP = {};
            this.isMarketMode = true;
            console.log('🎯 الوضع: سوق ريو');

            this.initCommandClasses();
            this.commands = this.collectAllCommands();

            this.alwaysAllowed = [
                'بدء', 'ابدأ', 'ابدء', 'ابد', 'start',
                'دخول', 'تسجيل دخول', 'تسجيل_دخول', 'تسجيلالدخول', 'لدي حساب', 'لدي_حساب', 'لديحساب',
                'انشاء', 'إنشاء', 'تسجيل', 'حساب جديد', 'حساب_جديد', 'حسابجديد',
                'الغاء', 'إلغاء', 'cancel',
                'تسجيل خروج', 'تسجيل_خروج', 'تسجيلخروج', 'خروج', 'logout',
                'معرفي', 'معرف', 'حسابي', 'معلوماتي',
                'مساعدة', 'اوامر', 'رصيد', 'رصيدي',
                'تأكيد', 'موافق', 'نعم', 'رجوع'
            ];

            this.loadAccountSystem();

            console.log('✅ CommandHandler (سوق ريو) تم تهيئته');
            console.log('📋 الأوامر المسجلة:', Object.keys(this.commands).length);
        } catch (error) {
            console.error('❌ فشل التهيئة:', error);
            throw error;
        }
    }

    async loadAccountSystem() {
        console.log('🔍 التحقق من AccountSystem...');
        const accountSystem = await SystemLoader.loadSystem('account');
        if (accountSystem) {
            this.systems['account'] = accountSystem;
            if (typeof accountSystem.startCleanupInterval === 'function') {
                accountSystem.startCleanupInterval();
            }
            console.log('✅ AccountSystem جاهز');
        } else {
            console.error('❌❌❌ AccountSystem لم يتم تحميله!');
        }
    }

    initCommandClasses() {
        try {
            this.registrationCommands = new RegistrationCommands(this);
            this.economyCommands = new EconomyCommands(this);
            console.log('✅ تم تهيئة فئات الأوامر');
        } catch (error) {
            console.error('❌ خطأ في تهيئة الفئات:', error);
            throw error;
        }
    }

    collectAllCommands() {
        const allCommands = {};
        const sources = [this.registrationCommands, this.economyCommands];

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
            if (this.systems[systemName]) {
                return this.systems[systemName];
            }

            const system = await SystemLoader.loadSystem(systemName);
            if (!system) {
                console.error(`❌ getSystem('${systemName}') فشل`);
                return null;
            }

            if (typeof system.setCommandHandler === 'function') {
                system.setCommandHandler(this);
            }

            this.systems[systemName] = system;
            return system;
        } catch (error) {
            console.error(`❌ خطأ في getSystem('${systemName}'):`, error);
            return null;
        }
    }

    normalizeCommand(command) {
        if (!command) return command;
        return command.replace(/[_\s]/g, '');
    }

    // ✅ محدّث: يحتوي كل الأوامر المركبة
    isCompoundCommand(fullCommand) {
        const compound = [
            // ===== التسجيل =====
            'تسجيل دخول', 'تسجيل_دخول', 'تسجيل خروج', 'تسجيل_خروج',
            'لدي حساب', 'لدي_حساب', 'حساب جديد', 'حساب_جديد',

            // ===== اقتصاد =====
            'اضف رصيد', 'اسحب رصيد', 'تعديل رصيد',
            'اضف منتج', 'حذف منتج', 'تعديل منتج', 'قائمة المنتجات', 'اضف مخزون',
            'اضف كود', 'حذف كود', 'تعديل كود', 'قائمة الاكواد',
            'اضف خصم', 'حذف خصم', 'تعديل خصم', 'قائمة الخصومات',
            'اسحب صندوق', 'ايداع صندوق', 'تعديل اعداد', 'حذف اعداد',
            'اقتصاد لاعب', 'معاملات لاعب',

            // ===== بطاقات =====
            'اضف بطاقة', 'حذف بطاقة', 'قائمة البطاقات', 'الغاء بطاقة',
            'مشتري بطاقة', 'مشتريات بطاقة',

            // ===== اشتراكات =====
            'اضف اشتراك', 'حذف اشتراك', 'قائمة الاشتراكات',
            'مشتركي اشتراك', 'الغاء اشتراكي',

            // ✅ ===== أوامر الأدمن =====
            'موافقة لاعب',
            'تغيير اسم', 'تغيير جنس',
            'حظر لاعب',
            'نزع ادمن', 'ازالة ادمن',
            'قائمة المحظورين', 'حذف محظور',
            'اعادة بيانات',
            'اعطاء ذهب', 'اعطاء مورد',
            'زيادة صحة', 'زيادة مانا',
            'اضف رد', 'ازل رد', 'عرض الردود',
            'عرض لاعبين',
            'اضف مهمة', 'حذف مهمة', 'قائمة المهام',
            'اعطاء ادمن',
            'اعطاء صلاحية', 'ازالة صلاحية',
            'قائمة الادمن', 'قائمة المسجونين'
        ];
        return compound.includes(fullCommand);
    }

    // ✅ محدّث: يحتوي كل التحويلات
    handleCompoundCommand(fullCommand) {
        const map = {
            // ===== التسجيل =====
            'تسجيل دخول': 'تسجيل_دخول',
            'تسجيل خروج': 'تسجيل_خروج',
            'لدي حساب': 'لدي_حساب',
            'حساب جديد': 'حساب_جديد',

            // ===== اقتصاد =====
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
            'معاملات لاعب': 'معاملات_لاعب',

            // ===== بطاقات =====
            'اضف بطاقة': 'اضف_بطاقة',
            'حذف بطاقة': 'حذف_بطاقة',
            'قائمة البطاقات': 'قائمة_البطاقات',
            'الغاء بطاقة': 'الغاء_بطاقة',
            'مشتري بطاقة': 'مشتري_بطاقة',
            'مشتريات بطاقة': 'مشتريات_بطاقة',

            // ===== اشتراكات =====
            'اضف اشتراك': 'اضف_اشتراك',
            'حذف اشتراك': 'حذف_اشتراك',
            'قائمة الاشتراكات': 'قائمة_الاشتراكات',
            'مشتركي اشتراك': 'مشتركي_اشتراك',
            'الغاء اشتراكي': 'الغاء_اشتراكي',

            // ✅ ===== أوامر الأدمن =====
            'موافقة لاعب': 'موافقة_لاعب',
            'تغيير اسم': 'تغيير_اسم',
            'تغيير جنس': 'تغيير_جنس',
            'حظر لاعب': 'حظر_لاعب',
            'نزع ادمن': 'نزع_ادمن',
            'ازالة ادمن': 'ازالة_ادمن',
            'قائمة المحظورين': 'قائمة_المحظورين',
            'حذف محظور': 'حذف_محظور',
            'اعادة بيانات': 'اعادة_بيانات',
            'اعطاء ذهب': 'اعطاء_ذهب',
            'اعطاء مورد': 'اعطاء_مورد',
            'زيادة صحة': 'زيادة_صحة',
            'زيادة مانا': 'زيادة_مانا',
            'اضف رد': 'اضف_رد',
            'ازل رد': 'ازل_رد',
            'عرض الردود': 'عرض_الردود',
            'عرض لاعبين': 'عرض_لاعبين',
            'اضف مهمة': 'اضف_مهمة',
            'حذف مهمة': 'حذف_مهمة',
            'قائمة المهام': 'قائمة_المهام',
            'اعطاء ادمن': 'اعطاء_ادمن',
            'اعطاء صلاحية': 'اعطاء_صلاحية',
            'ازالة صلاحية': 'ازالة_صلاحية',
            'قائمة الادمن': 'قائمة_الادمن',
            'قائمة المسجونين': 'قائمة_المسجونين'
        };

        return { command: map[fullCommand] || fullCommand, args: [] };
    }

    async process(sender, message) {
        const { id, name, platform } = sender;
        const processedMessage = message.trim().toLowerCase();

        if (!processedMessage) return null;

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

        console.log(`📨 أمر: "${command}" من ${name} (${id})`);

        const accountSystem = await this.getSystem('account');
        if (!accountSystem) {
            console.error('❌❌❌ AccountSystem غير متوفر!');
            return '❌ خطأ في النظام.\n\n💡 حاول لاحقاً.';
        }

        accountSystem.cleanupOldSessions();

        try {
            const BannedPlayer = (await import('./models/BannedPlayer.js')).default;
            const isBanned = await BannedPlayer.isBanned(id);
            if (isBanned) return null;
        } catch (e) {}

        if (accountSystem.hasRegistrationSession(id)) {
            const result = await accountSystem.handleRegistrationStep(id, message);
            return result.error || result.message;
        }

        if (accountSystem.hasLoginSession(id)) {
            const result = await accountSystem.handleLoginStep(id, message);
            return result.error || result.message;
        }

        let player = null;
        try {
            player = await Player.findByPlatform(id);
        } catch (error) {
            console.error('❌ خطأ في جلب اللاعب:', error);
        }

        if (!player) {
            return await this._handleNoAccount(sender, command, args);
        }

        if (!player.hasActiveSession(id)) {
            return await this._handleLoggedOut(player, sender, command, args);
        }

        if (player.isJailed()) {
            if (!player.jailNotified) {
                player.jailNotified = true;
                await player.save();

                const isPermanent = player.jailedUntil.getTime() === 0;
                const timeStr = isPermanent
                    ? '🚔 أنت مسجون بشكل دائم'
                    : `🚔 أنت مسجون حتى\n${player.jailedUntil.toLocaleString('ar-EG')}`;

                return `${timeStr}\n\n📝 السبب: ${player.jailedReason || 'غير محدد'}`;
            }
            return null;
        }

        if (player.banned) {
            return '🚫 أنت محظور.';
        }

        player.updateLastActive(id);

        const userIsAdmin = await this.adminSystem.isAdminAsync(id);

        if (command === 'مساعدة' || command === 'اوامر' || command === 'الاوامر' || command === 'الأوامر') {
            if (userIsAdmin) return this.getAdminHelp();
            return this.getHelpMessage();
        }

        if (command === 'بدء' || command === 'start') {
            if (userIsAdmin) return this.getAdminHelp();
            return this.getWelcomeMessage();
        }

        if (userIsAdmin) {
            const adminResult = await this.handleAdminCommand(command, args, id, player);
            if (adminResult) return adminResult;
        }

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

            return await this.handleUnknown(command, player, userIsAdmin);
        } catch (error) {
            console.error('❌ خطأ في معالجة الأمر:', error);
            return `❌ حدث خطأ: ${error.message}`;
        }
    }

    async _handleNoAccount(sender, command, args) {
        const accountSystem = await this.getSystem('account');

        const accountCommands = [
            'بدء', 'ابدأ', 'ابدء', 'ابد', 'start',
            'دخول', 'تسجيل_دخول', 'تسجيلالدخول', 'لدي_حساب', 'لديحساب',
            'انشاء', 'إنشاء', 'تسجيل', 'حساب_جديد', 'حسابجديد',
            'الغاء', 'إلغاء', 'cancel',
            'معرفي', 'معرف', 'مساعدة', 'اوامر',
            'تأكيد', 'موافق', 'نعم', 'رجوع'
        ];

        if (command === 'مساعدة' || command === 'اوامر') {
            return this.getWelcomeMessage();
        }

        if (!accountCommands.includes(command)) {
            return accountSystem.getWelcomeMessage(sender.platform || 'facebook');
        }

        const regCommands = this.registrationCommands.getCommands();
        const normalizedCommand = this.normalizeCommand(command);
        const handler = regCommands[command] || regCommands[normalizedCommand];

        if (handler) {
            const fakePlayer = {
                platform: sender.platform,
                name: sender.name,
                username: null,
                currentLocation: 'forest',
                level: 1,
                gold: 10,
                isRoot: false,
                isApproved: () => false,
                isPending: () => false,
                isApprovedButNotCompleted: () => false,
                isJailed: () => false,
                hasActiveSession: () => false,
                getActivePermissions: () => [],
                hasPermission: () => false
            };

            try {
                const result = await handler.call(this.registrationCommands, fakePlayer, args, sender.id);
                if (result === null || result === undefined) return null;
                return typeof result === 'string' ? result : result.message;
            } catch (error) {
                console.error('❌ خطأ:', error);
                return accountSystem.getWelcomeMessage(sender.platform || 'facebook');
            }
        }

        return accountSystem.getWelcomeMessage(sender.platform || 'facebook');
    }

    async _handleLoggedOut(player, sender, command, args) {
        const allowed = [
            'بدء', 'ابدأ', 'دخول', 'تسجيل_دخول', 'تسجيلالدخول',
            'لدي_حساب', 'انشاء', 'إنشاء', 'تسجيل', 'حساب_جديد',
            'الغاء', 'إلغاء', 'cancel', 'مساعدة', 'اوامر',
            'تأكيد', 'موافق', 'نعم', 'رجوع'
        ];

        if (!allowed.includes(command)) {
            return `🔒 أنت مسجل خروج.\n\n💡 اكتب "دخول" لتسجيل الدخول.`;
        }

        if (command === 'مساعدة' || command === 'اوامر') {
            return this.getHelpMessage();
        }

        const regCommands = this.registrationCommands.getCommands();
        const normalizedCommand = this.normalizeCommand(command);
        const handler = regCommands[command] || regCommands[normalizedCommand];

        if (handler) {
            try {
                const result = await handler.call(this.registrationCommands, player, args, sender.id);
                if (result === null || result === undefined) return null;
                return typeof result === 'string' ? result : result.message;
            } catch (error) {
                console.error('❌ خطأ:', error);
                return `🔒 أنت مسجل خروج.\n\n💡 اكتب "دخول" لتسجيل الدخول.`;
            }
        }

        return `💡 اكتب "دخول" لتسجيل الدخول.`;
    }

    async handleAdminCommand(command, args, userId, player) {
        try {
            const result = await this.adminSystem.handleAdminCommand(
                command, args, userId, player, this.ARABIC_ITEM_MAP
            );

            if (result) return result;

            const normalized = this.normalizeCommand(command);
            if (normalized !== command) {
                return await this.adminSystem.handleAdminCommand(
                    normalized, args, userId, player, this.ARABIC_ITEM_MAP
                );
            }
            return null;
        } catch (error) {
            console.error('❌ خطأ في أمر المدير:', error);
            return null;
        }
    }

    getWelcomeMessage() {
        const gameUrl = this.gamePageUrl || 'https://facebook.com/MgaraRio';

        return `🛒 مرحباً بك في سوق ريو - Souq Rio

📖 السوق الرسمي لعالم ريو

💡 ماذا تجد هنا:
• عرض رصيدك من الريو
• شراء منتجات اللعبة والخدمات
• تحويل الريو لأصدقائك
• استخدام أكواد الخصم والهدايا
• بطاقة رصيد مصورة

🎮 للعب والتسجيل:
${gameUrl}

📋 أوامرك:
• رصيد - عرض رصيدك
• متجر - عرض المنتجات
• تحويل - تحويل لأي لاعب
• مساعدة - الأوامر كاملة`;
    }

    getHelpMessage() {
        const gameUrl = this.gamePageUrl || 'https://facebook.com/MgaraRio';

        return `🛒 سوق ريو - Souq Rio

💰 رصيدك:
• رصيد — عرض رصيدك
• بطاقة — بطاقة رصيد مصورة
• معاملاتي — سجل معاملاتك

🛍️ التسوق:
• متجر — عرض المنتجات
• منتج [اسم] — تفاصيل منتج
• شراء [اسم] — شراء منتج

💸 التحويل:
• تحويل [اسم] [مبلغ]

🎁 الأكواد:
• هدية [الكود]
• خصم [الكود]

🎮 للعب: ${gameUrl}`;
    }

    getAdminHelp() {
        return `👑 أوامر الأدمن - سوق ريو

💰 الرصيد:
• اضف_رصيد [ID] [المبلغ]
• اسحب_رصيد [ID] [المبلغ]
• تعديل_رصيد [ID] [المبلغ]

🛒 المنتجات:
• اضف_منتج [ID] [الاسم] [السعر] [النوع]
• حذف_منتج [ID]
• تعديل_منتج [ID] [الحقل] [القيمة]
• قائمة_المنتجات
• اضف_مخزون [ID] [الكمية]

🎁 الأكواد:
• اضف_كود [الكود] [المبلغ] [الاستخدامات] [المدة]
• حذف_كود [الكود]
• قائمة_الاكواد
• اضف_خصم [الكود] [النسبة] [الاستخدامات] [المدة]
• حذف_خصم [الكود]
• قائمة_الخصومات

📊 الإحصائيات:
• اقتصاد
• اغنياء [صفحة]
• فقراء [صفحة]
• اقتصاد_لاعب [الاسم]
• معاملات_لاعب [الاسم]

🏦 الصندوق:
• صندوق
• اسحب_صندوق [المبلغ]
• ايداع_صندوق [المبلغ]

⚙️ الإعدادات:
• اعدادات
• تعديل_اعداد [المفتاح] [القيمة]

🔐 الصلاحيات:
• اعطاء_ادمن [ID] [مدة]
• نزع_ادمن [ID]
• قائمة_الادمن
• صلاحيات [ID]

🚫 الحظر:
• حظر_لاعب [ID] [صحيح/خطأ]
• قائمة_المحظورين
• حذف_محظور [ID]

🚔 السجن:
• سجن [ID] [المدة]
• اطلاق [ID]
• قائمة_المسجونين

📢 الإعلان:
• اعلان [النص]

💡 الأوامر تقبل أي شكل:
اضف_رصيد | اضف رصيد | اضفرصيد`;
    }

    async handleUnknown(command, player, isAdmin = false) {
        let msg = `❓ أمر غير معروف: "${command}"\n\n`;
        
        if (isAdmin) {
            msg += `💡 اكتب "مدير" للأوامر الإدارية.\n`;
        }
        
        msg += `💡 اكتب "مساعدة" للأوامر.`;
        return msg;
    }
    }
