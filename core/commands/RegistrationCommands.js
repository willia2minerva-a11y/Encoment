// core/commands/RegistrationCommands.js
// الموقع: مشترك - يُنسخ في مغارة ريو + سوق ريو
import { BaseCommand } from './BaseCommand.js';

export class RegistrationCommands extends BaseCommand {
    getCommands() {
        return {
            // بدء / الحساب
            'بدء': this.handleStart.bind(this),
            'ابدأ': this.handleStart.bind(this),
            'ابدء': this.handleStart.bind(this),
            'ابد': this.handleStart.bind(this),
            'start': this.handleStart.bind(this),
            
            // تسجيل دخول
            'دخول': this.handleLoginStart.bind(this),
            'تسجيل دخول': this.handleLoginStart.bind(this),
            'تسجيل_دخول': this.handleLoginStart.bind(this),
            'تسجيلالدخول': this.handleLoginStart.bind(this),
            'لدي حساب': this.handleLoginStart.bind(this),
            'لدي_حساب': this.handleLoginStart.bind(this),
            'لديحساب': this.handleLoginStart.bind(this),
            
            // إنشاء حساب
            'انشاء': this.handleRegisterStart.bind(this),
            'إنشاء': this.handleRegisterStart.bind(this),
            'تسجيل': this.handleRegisterStart.bind(this),
            'حساب جديد': this.handleRegisterStart.bind(this),
            'حساب_جديد': this.handleRegisterStart.bind(this),
            'حسابجديد': this.handleRegisterStart.bind(this),
            
            // إلغاء
            'الغاء': this.handleCancel.bind(this),
            'إلغاء': this.handleCancel.bind(this),
            'cancel': this.handleCancel.bind(this),
            
            // تسجيل خروج
            'تسجيل خروج': this.handleLogout.bind(this),
            'تسجيل_خروج': this.handleLogout.bind(this),
            'تسجيلخروج': this.handleLogout.bind(this),
            'خروج': this.handleLogout.bind(this),
            'logout': this.handleLogout.bind(this),
            
            // الرقم 1 و 2 (للاختيار)
            '1': this.handleChoice1.bind(this),
            '2': this.handleChoice2.bind(this),
            
            // معرفي / حسابي
            'معرفي': this.handleGetId.bind(this),
            'معرف': this.handleGetId.bind(this),
            'حسابي': this.handleGetAccount.bind(this),
            'معلوماتي': this.handleGetAccount.bind(this)
        };
    }

    // ===================================
    // بدء - عرض القائمة
    // ===================================
    async handleStart(player, args, senderId) {
        return await this._handleStartFlow(player, senderId);
    }

    async _handleStartFlow(player, senderId) {
        const accountSystem = await this.getSystem('account');
        if (!accountSystem) return '❌ نظام الحسابات غير متوفر.';

        // هل لديه حساب؟
        const hasAccount = await accountSystem.hasAccount(senderId);
        if (hasAccount) {
            // لديه حساب نشط
            return this._getWelcomeBackMessage(player);
        }

        // مرتبط لكن مسجل خروج
        const isLinked = await accountSystem.isLinkedButLoggedOut(senderId);
        if (isLinked) {
            return `👋 مرحباً بعودتك!

🔒 أنت مسجل خروج من هذه المنصة.

💡 اكتب "دخول" لتسجيل الدخول من جديد.`;
        }

        // ليس لديه حساب
        return accountSystem.getWelcomeMessage(player?.platform || 'facebook');
    }

    _getWelcomeBackMessage(player) {
        const locationName = this._getLocationName(player.currentLocation);
        
        return `🎮 مرحباً ${player.username}!

📊 معلوماتك:
• المستوى: ${player.level}
• الرصيد: ${player.gold} ريو
• الموقع: ${locationName}
• ID: ${player.playerId}

اكتب "مساعدة" لعرض الأوامر.`;
    }

    // ===================================
    // اختيار 1 (لدي حساب)
    // ===================================
    async handleChoice1(player, args, senderId) {
        return await this.handleLoginStart(player, args, senderId);
    }

    // ===================================
    // اختيار 2 (إنشاء حساب)
    // ===================================
    async handleChoice2(player, args, senderId) {
        return await this.handleRegisterStart(player, args, senderId);
    }

    // ===================================
    // بدء تسجيل دخول
    // ===================================
    async handleLoginStart(player, args, senderId) {
        const accountSystem = await this.getSystem('account');
        if (!accountSystem) return '❌ نظام الحسابات غير متوفر.';

        // إذا كان لديه حساب نشط
        if (await accountSystem.hasAccount(senderId)) {
            return `✅ أنت مسجل دخول بالفعل يا ${player.username}.\n\n💡 اكتب "مساعدة" للأوامر.`;
        }

        // بدء جلسة الدخول
        const result = await accountSystem.startLogin(
            senderId,
            player?.platform || 'facebook',
            player?.name || null
        );

        return result.message;
    }

    // ===================================
    // بدء إنشاء حساب
    // ===================================
    async handleRegisterStart(player, args, senderId) {
        const accountSystem = await this.getSystem('account');
        if (!accountSystem) return '❌ نظام الحسابات غير متوفر.';

        // إذا كان لديه حساب نشط
        if (await accountSystem.hasAccount(senderId)) {
            return `✅ لديك حساب بالفعل يا ${player.username}.\n\n💡 اكتب "تسجيل خروج" أولاً إذا أردت إنشاء حساب آخر.`;
        }

        // بدء جلسة التسجيل
        const result = await accountSystem.startRegistration(
            senderId,
            player?.platform || 'facebook',
            player?.name || null
        );

        return result.message;
    }

    // ===================================
    // إلغاء
    // ===================================
    async handleCancel(player, args, senderId) {
        const accountSystem = await this.getSystem('account');
        if (!accountSystem) return '❌ نظام الحسابات غير متوفر.';

        accountSystem.cancelAllSessions(senderId);
        return '❌ تم إلغاء العملية.\n\n💡 اكتب "بدء" للبدء من جديد.';
    }

    // ===================================
    // تسجيل خروج
    // ===================================
    async handleLogout(player, args, senderId) {
        const accountSystem = await this.getSystem('account');
        if (!accountSystem) return '❌ نظام الحسابات غير متوفر.';

        // هل لديه حساب نشط؟
        if (!await accountSystem.hasAccount(senderId)) {
            return '❌ أنت غير مسجل دخول.\n\n💡 اكتب "بدء" للدخول أو إنشاء حساب.';
        }

        // إذا كان الأدمن الرئيسي - منع
        if (this.commandHandler?.adminSystem?.isRootAdmin(senderId)) {
            return '❌ لا يمكنك تسجيل الخروج كأدمن رئيسي.';
        }

        // تنفيذ تسجيل الخروج
        const result = await accountSystem.logout(player, senderId);

        return result.message;
    }

    // ===================================
    // معرفي
    // ===================================
    async handleGetId(player, args, senderId) {
        if (!player || !player.username) {
            return `🆔 معرفك في المنصة: ${senderId}\n\n💡 ليس لديك حساب بعد.`;
        }

        return `🆔 معلومات حسابك

👤 اسم المستخدم: ${player.username}
🎯 معرف اللاعب: ${player.playerId}
📱 معرف المنصة: ${senderId}`;
    }

    // ===================================
    // حسابي
    // ===================================
    async handleGetAccount(player, args, senderId) {
        if (!player || !player.username) {
            return `❌ ليس لديك حساب بعد.\n\n💡 اكتب "بدء" للإنشاء.`;
        }

        const platforms = (player.linkedPlatforms || []).map(p => {
            const platformName = p.platform === 'telegram' ? 'تلغرام' : 'فيسبوك';
            return `• ${platformName}: ${p.platformId}`;
        }).join('\n');

        return `👤 معلومات حسابك

🆔 اسم المستخدم: ${player.username}
🎯 معرف اللاعب: ${player.playerId}
⚧️ الجنس: ${player.gender === 'male' ? 'ذكر 👦' : 'أنثى 👧'}
📊 المستوى: ${player.level}
💰 الرصيد: ${player.gold} ريو

📱 المنصات المرتبطة:
${platforms || 'لا يوجد'}

💡 لتسجيل الخروج: "تسجيل خروج"`;
    }

    // ===================================
    // أدوات مساعدة
    // ===================================
    _getLocationName(locationId) {
        const names = {
            'forest': 'الغابة', 'desert': 'الصحراء',
            'mountain': 'الجبل', 'cave': 'الكهف',
            'plains': 'السهول', 'village': 'القرية'
        };
        return names[locationId] || locationId;
    }
}
