// core/CommandHandler.js
// الموقع: مشترك - يُنسخ في مغارة ريو + سوق ريو
import Player from './Player.js';
import { ProfileCardGenerator } from '../utils/ProfileCardGenerator.js';
import { AdminSystem } from '../systems/admin/AdminSystem.js';
import { RegistrationCommands } from './commands/RegistrationCommands.js';
import { SystemLoader } from './utils/SystemLoader.js';
import { ArabicItemMap } from './utils/ArabicItemMap.js';

// استيرادات الأوامر
import { MenuCommands } from './commands/MenuCommands.js';
import { InfoCommands } from './commands/InfoCommands.js';
import { ExplorationCommands } from './commands/ExplorationCommands.js';
import { GateCommands } from './commands/GateCommands.js';
import { CraftingCommands } from './commands/CraftingCommands.js';
import { BattleCommands } from './commands/BattleCommands.js';
import { AchievementCommands } from './commands/AchievementCommands.js';
import { ReferralCommands } from './commands/ReferralCommands.js';

// أوامر الاقتصاد (تعمل في كلا المستودعين)
import { EconomyCommands } from './commands/EconomyCommands.js';

export default class CommandHandler {
    constructor() {
        console.log('🔄 تهيئة CommandHandler...');

        try {
            this.adminSystem = new AdminSystem();
            this.cardGenerator = new ProfileCardGenerator();
            this.systems = {};
            this.ARABIC_ITEM_MAP = ArabicItemMap.create();

            this.adminProfileUrl = process.env.ADMIN_PROFILE_URL || 'https://facebook.com/';
            this.adminDisplayName = process.env.ADMIN_DISPLAY_NAME || 'الإدارة';
            this.marketPageUrl = process.env.MARKET_PAGE_URL || 'https://facebook.com/SouqRio';
            this.gamePageUrl = process.env.GAME_PAGE_URL || 'https://facebook.com/MgaraRio';

            // ✅ تحديد نوع المستودع (لعبة / سوق)
            this.isMarketMode = process.env.BOT_MODE === 'market';

            this.initCommandClasses();
            this.commands = this.collectAllCommands();

            // ✅ أوامر التسجيل/الحساب المسموحة دائماً (حتى قبل التسجيل)
            this.alwaysAllowed = [
                'بدء', 'ابدأ', 'ابدء', 'ابد', 'start',
                'دخول', 'تسجيل دخول', 'تسجيل_دخول', 'تسجيلالدخول', 'لدي حساب', 'لدي_حساب', 'لديحساب',
                'انشاء', 'إنشاء', 'تسجيل', 'حساب جديد', 'حساب_جديد', 'حسابجديد',
                'الغاء', 'إلغاء', 'cancel',
                'تسجيل خروج', 'تسجيل_خروج', 'تسجيلخروج', 'خروج', 'logout',
                '1', '2',
                'معرفي', 'معرف', 'حسابي', 'معلوماتي'
            ];

            // ✅ بدء تنظيف الجلسات الدورية
            this.getSystem('account').then(acc => {
                if (acc && acc.startCleanupInterval) acc.startCleanupInterval();
            });

            console.log('✅ CommandHandler تم تهيئته');
            console.log('📋 الأوامر المسجلة:', Object.keys(this.commands).length);
            console.log(`🎯 الوضع: ${this.isMarketMode ? 'سوق ريو' : 'مغارة ريو'}`);
        } catch (error) {
            console.error('❌ فشل التهيئة:', error);
            throw error;
        }
    }

    initCommandClasses() {
        try {
            this.registrationCommands = new RegistrationCommands(this);
            
            if (!this.isMarketMode) {
                // 🏰 أوامر اللعبة فقط
                this.menuCommands = new MenuCommands(this);
                this.infoCommands = new InfoCommands(this);
                this.explorationCommands = new ExplorationCommands(this);
                this.gateCommands = new GateCommands(this);
                this.craftingCommands = new CraftingCommands(this);
                this.battleCommands = new BattleCommands(this);
                this.achievementCommands = new AchievementCommands(this);
                this.referralCommands = new ReferralCommands(this);
            }
            
            // 🛒 أوامر الاقتصاد (في كلا الوضعين لكن بتفصيل مختلف)
            this.economyCommands = new EconomyCommands(this);
            
            console.log('✅ تم تهيئة فئات الأوامر');
        } catch (error) {
            console.error('❌ خطأ في تهيئة الفئات:', error);
            throw error;
        }
    }

    collectAllCommands() {
        const allCommands = {};

        const commandSources = [
            this.registrationCommands,
            this.economyCommands
        ];

        if (!this.isMarketMode) {
            commandSources.push(
                this.menuCommands,
                this.infoCommands,
                this.explorationCommands,
                this.gateCommands,
                this.craftingCommands,
                this.battleCommands,
                this.achievementCommands,
                this.referralCommands
            );
        }

        commandSources.forEach(source => {
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
            'تسجيل دخول', 'تسجيل_دخول',
            'تسجيل خروج', 'تسجيل_خروج',
            'لدي حساب', 'لدي_حساب',
            'حساب جديد', 'حساب_جديد',
            'اضف رصيد', 'اسحب رصيد', 'تعديل رصيد',
            'اضف منتج', 'حذف منتج', 'تعديل منتج',
            'قائمة المنتجات', 'اضف مخزون',
            'اضف كود', 'حذف كود', 'تعديل كود', 'قائمة الاكواد',
            'اضف خصم', 'حذف خصم', 'تعديل خصم', 'قائمة الخصومات',
            'اسحب صندوق', 'ايداع صندوق',
            'تعديل اعداد', 'حذف اعداد',
            'اقتصاد لاعب', 'معاملات لاعب',
            'موافقة لاعب', 'اعطاء مورد', 'اعطاء ذهب', 'تغيير اسم',
            'زيادة صحة', 'زيادة مانا', 'اعادة بيانات', 'حظر لاعب',
            'تغيير جنس', 'عرض الردود', 'حذف طلب سحب', 'نزع ادمن',
            'قائمة المحظورين', 'حذف محظور', 'عرض لاعبين',
            'اضف رد', 'ازل رد', 'اضف مهمة', 'حذف مهمة', 'قائمة المهام',
            'اضف سلاح', 'حذف سلاح', 'اضف وحش', 'حذف وحش',
            'اضف مورد', 'حذف مورد', 'عرض اسلحة', 'عرض وحوش',
            'عرض مواقع', 'عرض موارد',
            'اعطاء ادمن', 'ازالة ادمن', 'اعطاء صلاحية', 'ازالة صلاحية',
            'قائمة الادمن', 'قائمة المسجونين',
            'صناعة كاملة', 'فرن كاملة'
        ];
        return compound.includes(fullCommand);
    }

    handleCompoundCommand(fullCommand) {
        const map = {
            'تسجيل دخول': 'تسجيل_دخول',
            'تسجيل خروج': 'تسجيل_خروج',
            'لدي حساب': 'لدي_حساب',
            'حساب جديد': 'حساب_جديد',
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
            'موافقة لاعب': 'موافقة_لاعب',
            'اعطاء مورد': 'اعطاء_مورد',
            'اعطاء ذهب': 'اعطاء_ذهب',
            'تغيير اسم': 'تغيير_اسم',
            'زيادة صحة': 'زيادة_صحة',
            'زيادة مانا': 'زيادة_مانا',
            'اعادة بيانات': 'اعادة_بيانات',
            'حظر لاعب': 'حظر_لاعب',
            'تغيير جنس': 'تغيير_جنس',
            'عرض الردود': 'عرض_الردود',
            'حذف طلب سحب': 'حذف_طلب_سحب',
            'نزع ادمن': 'نزع_ادمن',
            'قائمة المحظورين': 'قائمة_المحظورين',
            'حذف محظور': 'حذف_محظور',
            'عرض لاعبين': 'عرض_لاعبين',
            'اضف رد': 'اضف_رد',
            'ازل رد': 'ازل_رد',
            'اضف مهمة': 'اضف_مهمة',
            'حذف مهمة': 'حذف_مهمة',
            'قائمة المهام': 'قائمة_المهام',
            'اضف سلاح': 'اضف_سلاح',
            'حذف سلاح': 'حذف_سلاح',
            'اضف وحش': 'اضف_وحش',
            'حذف وحش': 'حذف_وحش',
            'اضف مورد': 'اضف_مورد',
            'حذف مورد': 'حذف_مورد',
            'عرض اسلحة': 'عرض_اسلحة',
            'عرض وحوش': 'عرض_وحوش',
            'عرض مواقع': 'عرض_مواقع',
            'عرض موارد': 'عرض_موارد',
            'اعطاء ادمن': 'اعطاء_ادمن',
            'ازالة ادمن': 'ازالة_ادمن',
            'اعطاء صلاحية': 'اعطاء_صلاحية',
            'ازالة صلاحية': 'ازالة_صلاحية',
            'قائمة الادمن': 'قائمة_الادمن',
            'قائمة المسجونين': 'قائمة_المسجونين',
            'صناعة كاملة': 'صناعة_كاملة',
            'فرن كاملة': 'فرن_كاملة'
        };

        return {
            command: map[fullCommand] || fullCommand,
            args: []
        };
    }

    // ===================================
    // المعالج الرئيسي
    // ===================================
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

        // ✅ جلب النظام
        const accountSystem = await this.getSystem('account');
        if (!accountSystem) return '❌ خطأ في النظام.';

        // ✅ تنظيف الجلسات القديمة
        accountSystem.cleanupOldSessions();

        // ✅ فحص قائمة المحظورين
        const BannedPlayer = (await import('./models/BannedPlayer.js')).default;
        const isBanned = await BannedPlayer.isBanned(id);
        if (isBanned) {
            // لا رد - فقط تجاهل
            return null;
        }

        // ✅ فحص جلسات التسجيل/الدخول
        if (accountSystem.hasRegistrationSession(id)) {
            const result = await accountSystem.handleRegistrationStep(id, message);
            if (result.success && result.player) {
                // تم إنشاء الحساب
                return result.message;
            }
            return result.error || result.message;
        }

        if (accountSystem.hasLoginSession(id)) {
            const result = await accountSystem.handleLoginStep(id, message);
            if (result.success && result.player) {
                return result.message;
            }
            return result.error || result.message;
        }

        // ✅ جلب اللاعب بمعرف المنصة
        let player = null;
        try {
            player = await Player.findByPlatform(id);
        } catch (error) {
            console.error('❌ خطأ في جلب اللاعب:', error);
        }

        // ✅ فحص إذا كان لديه حساب
        if (!player) {
            // ليس لديه حساب
            return await this._handleNoAccount(sender, command, args);
        }

        // ✅ فحص الجلسة (هل مسجل خروج؟)
        if (!player.hasActiveSession(id)) {
            // مسجل خروج
            if (this.alwaysAllowed.includes(command) || 
                ['دخول', 'تسجيل_دخول', 'بدء'].includes(command)) {
                // اسمح له بأوامر الحساب
                return await this._handleLoggedOut(player, sender, command, args);
            }
            return `🔒 أنت مسجل خروج.

💡 اكتب "دخول" لتسجيل الدخول من جديد.`;
        }

        // ✅ فحص السجن
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

        // ✅ فحص الحظر
        if (player.banned) {
            return '🚫 أنت محظور من استخدام البوت.';
        }

        // ✅ تحديث آخر نشاط
        player.updateLastActive(id);

        // ✅ فحص المدير
        const userIsAdmin = await this.adminSystem.isAdminAsync(id);
        if (userIsAdmin) {
            const adminResult = await this.tryAdminCommand(command, args, id, player);
            if (adminResult) return adminResult;
        }

        // ✅ الردود التلقائية
        const autoResponse = await this.handleAutoResponse(message);
        if (autoResponse) return autoResponse;

        // ✅ تنفيذ الأمر
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

    // ✅ معالجة اللاعب بدون حساب
    async _handleNoAccount(sender, command, args) {
        const accountSystem = await this.getSystem('account');
        
        // الأوامر المسموحة قبل التسجيل
        const allowed = ['بدء', 'ابدأ', 'ابدء', 'ابد', 'start',
                        'دخول', 'تسجيل_دخول', 'تسجيلالدخول', 'لدي_حساب', 'لديحساب',
                        'انشاء', 'إنشاء', 'تسجيل', 'حساب_جديد', 'حسابجديد',
                        'الغاء', 'إلغاء', 'cancel', '1', '2',
                        'معرفي', 'معرف', 'مساعدة', 'اوامر', 'حالتي', 'حالة'];

        if (!allowed.includes(command)) {
            return accountSystem.getWelcomeMessage(sender.platform || 'facebook');
        }

        // تنفيذ الأمر
        const normalizedCommand = this.normalizeCommand(command);
        const handler = this.commands[command] || this.commands[normalizedCommand];
        
        if (handler) {
            // نمرر null كـ player (لأنه لا يوجد حساب)
            const fakePlayer = { platform: sender.platform, name: sender.name };
            const result = await handler.call(this, fakePlayer, args, sender.id);
            if (result === null || result === undefined) return null;
            return typeof result === 'string' ? result : result.message;
        }

        return accountSystem.getWelcomeMessage(sender.platform || 'facebook');
    }

    // ✅ معالجة اللاعب المسجل خروج
    async _handleLoggedOut(player, sender, command, args) {
        const accountSystem = await this.getSystem('account');
        
        // الأوامر المسموحة
        const allowed = ['بدء', 'ابدأ', 'دخول', 'تسجيل_دخول', 'تسجيلالدخول',
                        'لدي_حساب', 'انشاء', 'إنشاء', 'تسجيل', 'حساب_جديد',
                        'الغاء', 'إلغاء', 'cancel', '1', '2', 'مساعدة'];

        if (!allowed.includes(command)) {
            return `🔒 أنت مسجل خروج.

💡 اكتب "دخول" لتسجيل الدخول من جديد.`;
        }

        const handler = this.commands[command] || this.commands[this.normalizeCommand(command)];
        if (handler) {
            const result = await handler.call(this, player, args, sender.id);
            if (result === null || result === undefined) return null;
            return typeof result === 'string' ? result : result.message;
        }

        return `💡 اكتب "دخول" لتسجيل الدخول.`;
    }

    // ✅ معالجة أوامر الأدمن
    async tryAdminCommand(command, args, id, player) {
        const result = await this.handleAdminCommand(command, args, id);
        if (result) return result;

        const normalized = this.normalizeCommand(command);
        if (normalized !== command) {
            return await this.handleAdminCommand(normalized, args, id);
        }

        return null;
    }

    async handleAdminCommand(command, args, userId) {
        try {
            let player = await Player.findByPlatform(userId);
            if (!player) return null;
            
            const result = await this.adminSystem.handleAdminCommand(
                command, args, userId, player, this.ARABIC_ITEM_MAP
            );
            return result;
        } catch (error) {
            console.error('❌ خطأ في أمر المدير:', error);
            return null;
        }
    }

    // ✅ الردود التلقائية
    async handleAutoResponse(message) {
        try {
            const autoResponseSys = await this.getSystem('autoResponse');
            if (autoResponseSys && typeof autoResponseSys.findAutoResponse === 'function') {
                return autoResponseSys.findAutoResponse(message);
            }
        } catch (error) {
            console.error('❌ خطأ في الرد التلقائي:', error);
        }
        return null;
    }

    // ✅ أمر غير معروف
    async handleUnknown(command, player, isAdmin = false) {
        if (this.isMarketMode) {
            return `❓ أمر غير معروف: "${command}"

💡 اكتب "مساعدة" للأوامر.
🎮 للتسجيل: اكتب "بدء"`;
        }

        const gateHints = {
            'دخل': '💡 هل تقصد "ادخل [اسم البوابة]"؟',
            'استكشف': '💡 هل تقصد "استكشف"؟',
            'اختر': '💡 هل تقصد "اختر [رقم]"؟ مثال: اختر 1',
            'غادر': '💡 هل تقصد "مغادرة" أو "غادر"؟',
            'بوابة': '💡 هل تقصد "بوابات" أو "بوابتي"؟'
        };

        for (const [hintCommand, hintMessage] of Object.entries(gateHints)) {
            if (command.includes(hintCommand)) {
                return `${hintMessage}\n\n❓ أمر غير معروف: "${command}"\nاكتب "مساعدة" للقائمة الكاملة.`;
            }
        }

        return `❓ أمر غير معروف: "${command}"\n💡 اكتب "مساعدة" للقائمة الكاملة.`;
    }
                }
