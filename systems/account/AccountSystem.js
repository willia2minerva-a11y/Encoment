// systems/account/AccountSystem.js
// الموقع: مشترك - يُنسخ في مغارة ريو + سوق ريو
import bcrypt from 'bcryptjs';
import Player from '../../core/models/Player.js';

export class AccountSystem {
    constructor() {
        // ✅ جلسات التسجيل المؤقتة (قبل إنشاء الحساب)
        this.registrationSessions = new Map(); // platformId => { step, data, startedAt }
        
        // ✅ جلسات تسجيل الدخول
        this.loginSessions = new Map(); // platformId => { step, username, startedAt }
        
        // ✅ محاولات الدخول الفاشلة
        this.loginAttempts = new Map(); // platformId => { count, lockedUntil }
        
        // ✅ إعدادات
        this.USERNAME_MIN = 3;
        this.USERNAME_MAX = 9;
        this.PASSWORD_MIN = 4;
        this.MAX_LOGIN_ATTEMPTS = 3;
        this.LOCK_DURATION_MINUTES = 5;
        this.SESSION_TIMEOUT_MINUTES = 10;
        
        console.log('👤 نظام الحسابات تم تهيئته');
    }

    // ===================================
    // فحص الحساب والجلسات
    // ===================================

    // ✅ هل المستخدم لديه حساب مربوط بهذه المنصة؟
    async hasAccount(platformId) {
        const player = await Player.findByPlatform(platformId);
        if (!player) return false;
        return player.hasActiveSession(platformId);
    }

    // ✅ هل المستخدم مرتبط (لكن مسجل خروج)؟
    async isLinkedButLoggedOut(platformId) {
        const player = await Player.findByPlatform(platformId);
        if (!player) return false;
        return !player.hasActiveSession(platformId);
    }

    // ✅ فحص وجود جلسة تسجيل
    hasRegistrationSession(platformId) {
        return this.registrationSessions.has(platformId);
    }

    // ✅ فحص وجود جلسة دخول
    hasLoginSession(platformId) {
        return this.loginSessions.has(platformId);
    }

    // ✅ إلغاء كل الجلسات للمستخدم
    cancelAllSessions(platformId) {
        this.registrationSessions.delete(platformId);
        this.loginSessions.delete(platformId);
    }

    // ✅ تنظيف الجلسات القديمة
    cleanupOldSessions() {
        const now = Date.now();
        const timeout = this.SESSION_TIMEOUT_MINUTES * 60 * 1000;

        for (const [id, session] of this.registrationSessions.entries()) {
            if (now - session.startedAt > timeout) {
                this.registrationSessions.delete(id);
            }
        }

        for (const [id, session] of this.loginSessions.entries()) {
            if (now - session.startedAt > timeout) {
                this.loginSessions.delete(id);
            }
        }
    }

    // ===================================
    // عرض قائمة البداية
    // ===================================

    getWelcomeMessage(platform) {
        const platformName = platform === 'telegram' ? 'تلغرام' : 'فيسبوك';
        
        return `🎮 مرحباً بك في مغارة ريو!

👤 ليس لديك حساب بعد على ${platformName}.

📋 اختر:

1️⃣ لدي حساب (تسجيل دخول)
2️⃣ إنشاء حساب جديد

💡 اكتب الرقم أو الكلمة:
• "1" أو "دخول" أو "تسجيل دخول"
• "2" أو "انشاء" أو "تسجيل"`;
    }

    // ===================================
    // تدفق الإنشاء
    // ===================================

    // ✅ بدء الإنشاء
    async startRegistration(platformId, platform, displayName) {
        this.registrationSessions.set(platformId, {
            step: 'username',
            data: {
                username: null,
                gender: null,
                password: null,
                platform,
                displayName
            },
            startedAt: Date.now()
        });

        return {
            success: true,
            message: `📝 إنشاء حساب جديد

الخطوة 1/3: اسم المستخدم

📋 الشروط:
• من 3 إلى 9 أحرف إنجليزية
• بدون مسافات أو رموز
• حروف وأرقام فقط

💡 مثال: Ahmed أو Ali123

❌ للإلغاء: الغاء`
        };
    }

    // ✅ معالجة خطوات الإنشاء
    async handleRegistrationStep(platformId, message) {
        const session = this.registrationSessions.get(platformId);
        if (!session) {
            return { error: '❌ لا توجد جلسة تسجيل.' };
        }

        const text = message.trim();
        const lower = text.toLowerCase();

        // إلغاء
        if (lower === 'الغاء' || lower === 'إلغاء' || lower === 'cancel') {
            this.registrationSessions.delete(platformId);
            return {
                success: true,
                message: '❌ تم إلغاء التسجيل.\n\n💡 اكتب "بدء" للمحاولة مرة أخرى.'
            };
        }

        // ✅ Step 1: Username
        if (session.step === 'username') {
            // فحص الشروط
            if (text.length < this.USERNAME_MIN || text.length > this.USERNAME_MAX) {
                return {
                    error: `❌ الاسم يجب أن يكون بين ${this.USERNAME_MIN} و ${this.USERNAME_MAX} أحرف.\n\n💡 جرب مرة أخرى:` 
                };
            }

            if (!/^[a-zA-Z0-9]+$/.test(text)) {
                return {
                    error: '❌ الاسم يجب أن يكون إنجليزي فقط (حروف وأرقام، بدون مسافات).\n\n💡 جرب مرة أخرى:'
                };
            }

            // فحص التوفر
            const existing = await Player.findByUsername(text);
            if (existing) {
                return {
                    error: `❌ الاسم "${text}" مستخدم بالفعل.\n\n💡 اختر اسماً آخر:`
                };
            }

            // حفظ
            session.data.username = text;
            session.step = 'gender';
            session.startedAt = Date.now();

            return {
                success: true,
                message: `✅ الاسم متاح: ${text}

الخطوة 2/3: الجنس

📋 اختر جنس شخصيتك:
• اكتب "ذكر" 👦
• اكتب "أنثى" 👧

⚠️ هذا الخيار نهائي ولا يمكن تغييره لاحقاً.

❌ للإلغاء: الغاء`
            };
        }

        // ✅ Step 2: Gender
        if (session.step === 'gender') {
            let gender = null;
            if (lower === 'ذكر' || lower === 'male' || lower === 'رجل' || lower === 'ولد') {
                gender = 'male';
            } else if (lower === 'انثى' || lower === 'أنثى' || lower === 'female' || lower === 'بنت' || lower === 'فتاة') {
                gender = 'female';
            } else {
                return {
                    error: '❌ اختر "ذكر" أو "أنثى" فقط.\n\n💡 جرب مرة أخرى:'
                };
            }

            session.data.gender = gender;
            session.step = 'password';
            session.startedAt = Date.now();

            return {
                success: true,
                message: `✅ الجنس: ${gender === 'male' ? 'ذكر 👦' : 'أنثى 👧'}

الخطوة 3/3: كلمة السر

📋 الشروط:
• 4 أحرف على الأقل
• يمكن أن تحتوي على حروف وأرقام ورموز
• لا تنسها! (لن يمكنك الدخول بدونها)

💡 اكتب كلمة السر الآن:

❌ للإلغاء: الغاء`
            };
        }

        // ✅ Step 3: Password
        if (session.step === 'password') {
            if (text.length < this.PASSWORD_MIN) {
                return {
                    error: `❌ كلمة السر يجب أن تكون ${this.PASSWORD_MIN} أحرف على الأقل.\n\n💡 جرب مرة أخرى:`
                };
            }

            if (text.length > 50) {
                return {
                    error: '❌ كلمة السر طويلة جداً (50 حرف كحد أقصى).\n\n💡 جرب مرة أخرى:'
                };
            }

            session.data.password = text;
            session.step = 'confirmation';
            session.startedAt = Date.now();

            return {
                success: true,
                message: `⚠️ تأكيد البيانات

📋 ملخص حسابك:

👤 اسم المستخدم: ${session.data.username}
⚧️ الجنس: ${session.data.gender === 'male' ? 'ذكر 👦' : 'أنثى 👧'}
🔐 كلمة السر: ${text}

⚠️ هل أنت متأكد من صحة البيانات؟

• اكتب "تأكيد" أو "1" → إنشاء الحساب
• اكتب "الغاء" → إلغاء التسجيل
• اكتب "رجوع" → إعادة إدخال كلمة السر`
            };
        }

        // ✅ Step 4: Confirmation
        if (session.step === 'confirmation') {
            if (lower === 'تأكيد' || lower === '1' || lower === 'موافق' || lower === 'نعم' || lower === 'confirm') {
                return await this._createAccount(platformId, session);
            }

            if (lower === 'رجوع') {
                session.step = 'password';
                session.startedAt = Date.now();
                return {
                    success: true,
                    message: '🔐 أعد كتابة كلمة السر:'
                };
            }

            return {
                error: '❌ اكتب "تأكيد" أو "الغاء".'
            };
        }

        return { error: '❌ خطأ في الجلسة.' };
    }

    // ✅ إنشاء الحساب فعلياً
    async _createAccount(platformId, session) {
        try {
            const data = session.data;

            // تشفير كلمة السر
            const passwordHash = await bcrypt.hash(data.password, 10);

            // إنشاء الحساب
            const player = await Player.createAccount(
                data.username,
                passwordHash,
                data.gender,
                data.platform,
                platformId,
                data.displayName
            );

            // حذف الجلسة
            this.registrationSessions.delete(platformId);

            // إنشاء رمز إحالة
            const code = this._generateReferralCode(player.playerId);
            player.referralCode = code;
            await player.save();

            return {
                success: true,
                player,
                message: `🎉 تم إنشاء حسابك بنجاح!

📋 **معلومات حسابك:**

👤 اسم المستخدم: ${data.username}
⚧️ الجنس: ${data.gender === 'male' ? 'ذكر 👦' : 'أنثى 👧'}
🔐 كلمة السر: ${data.password}
🆔 معرف اللاعب: ${player.playerId}

⚠️ **احفظ هذه المعلومات جيداً!**
ستحتاجها لتسجيل الدخول من أي منصة.
لا يمكن استرجاع كلمة السر إذا فقدتها.

🎮 يمكنك الآن:
• اللعب في مغارة ريو
• التسوق في سوق ريو
• استخدام نفس الحساب من فيسبوك وتلغرام

اكتب "مساعدة" لعرض الأوامر.`
            };
        } catch (error) {
            console.error('❌ خطأ في إنشاء الحساب:', error);
            this.registrationSessions.delete(platformId);
            return {
                error: '❌ حدث خطأ في إنشاء الحساب. جرب مرة أخرى.'
            };
        }
    }

    // ===================================
    // تدفق تسجيل الدخول
    // ===================================

    // ✅ بدء تسجيل الدخول
    async startLogin(platformId, platform, displayName) {
        this.loginSessions.set(platformId, {
            step: 'username',
            username: null,
            platform,
            displayName,
            startedAt: Date.now()
        });

        return {
            success: true,
            message: `🔐 تسجيل الدخول

📝 اكتب اسم المستخدم:

💡 مثال: Ahmed

❌ للإلغاء: الغاء`
        };
    }

    // ✅ معالجة خطوات الدخول
    async handleLoginStep(platformId, message) {
        const session = this.loginSessions.get(platformId);
        if (!session) {
            return { error: '❌ لا توجد جلسة دخول.' };
        }

        const text = message.trim();
        const lower = text.toLowerCase();

        // إلغاء
        if (lower === 'الغاء' || lower === 'إلغاء' || lower === 'cancel') {
            this.loginSessions.delete(platformId);
            return {
                success: true,
                message: '❌ تم إلغاء تسجيل الدخول.\n\n💡 اكتب "بدء" للمحاولة مرة أخرى.'
            };
        }

        // ✅ Step 1: Username
        if (session.step === 'username') {
            const player = await Player.findByUsername(text);

            if (!player) {
                return {
                    error: `❌ لا يوجد حساب بهذا الاسم.\n\n💡 تأكد من الاسم أو أنشئ حساباً جديداً.\n\nجرب مرة أخرى:`
                };
            }

            session.username = player.username;
            session.step = 'password';
            session.startedAt = Date.now();

            return {
                success: true,
                message: `✅ تم العثور على الحساب.

👤 الاسم: ${player.username}

🔐 اكتب كلمة السر:

❌ للإلغاء: الغاء`
            };
        }

        // ✅ Step 2: Password
        if (session.step === 'password') {
            // فحص القفل
            const attempts = this.loginAttempts.get(platformId);
            if (attempts?.lockedUntil && Date.now() < attempts.lockedUntil) {
                const remaining = Math.ceil((attempts.lockedUntil - Date.now()) / 1000 / 60);
                return {
                    error: `🔒 محظور من تسجيل الدخول مؤقتاً.\n\n⏰ حاول بعد ${remaining} دقيقة.`
                };
            }

            const player = await Player.findByUsername(session.username);
            if (!player) {
                this.loginSessions.delete(platformId);
                return { error: '❌ حدث خطأ. جرب مرة أخرى.' };
            }

            // فحص كلمة السر
            const isValid = await bcrypt.compare(text, player.passwordHash);

            if (!isValid) {
                // زيادة المحاولات
                const currentAttempts = this.loginAttempts.get(platformId) || { count: 0 };
                currentAttempts.count += 1;
                currentAttempts.lastAttempt = Date.now();

                if (currentAttempts.count >= this.MAX_LOGIN_ATTEMPTS) {
                    currentAttempts.lockedUntil = Date.now() + this.LOCK_DURATION_MINUTES * 60 * 1000;
                    this.loginAttempts.set(platformId, currentAttempts);
                    
                    return {
                        error: `❌ كلمة السر خاطئة!\n\n🔒 تم حظرك من تسجيل الدخول لمدة ${this.LOCK_DURATION_MINUTES} دقائق.`
                    };
                }

                this.loginAttempts.set(platformId, currentAttempts);
                const remaining = this.MAX_LOGIN_ATTEMPTS - currentAttempts.count;

                return {
                    error: `❌ كلمة السر خاطئة!\n\n⚠️ متبقي ${remaining} محاولة قبل الحظر المؤقت.\n\nحاول مرة أخرى:`
                };
            }

            // ✅ كلمة السر صحيحة
            this.loginAttempts.delete(platformId);
            this.loginSessions.delete(platformId);

            // ربط المنصة
            const linkResult = player.linkPlatform(
                session.platform,
                platformId,
                session.displayName
            );

            if (linkResult.error) {
                return { error: linkResult.error };
            }

            // إزالة من قائمة الخروج
            player.loggedOutPlatforms = (player.loggedOutPlatforms || [])
                .filter(p => p !== platformId);

            await player.save();

            return {
                success: true,
                player,
                message: `✅ تم تسجيل الدخول بنجاح!

👤 مرحباً ${player.username}!

📊 معلوماتك:
• المستوى: ${player.level}
• الرصيد: ${player.gold} ريو
• ID: ${player.playerId}

🎮 اكتب "مساعدة" لعرض الأوامر.`
            };
        }

        return { error: '❌ خطأ في الجلسة.' };
    }

    // ===================================
    // تسجيل الخروج
    // ===================================

    async logout(player, platformId) {
        const result = player.unlinkPlatform(platformId);
        if (result.error) return result;

        await player.save();

        return {
            success: true,
            message: `✅ تم تسجيل الخروج بنجاح.

👤 حسابك: ${player.username}

💡 لديك خيارات:
• تسجيل دخول من جديد: "بدء"
• من نفس المنصة

⚠️ ملاحظة: حسابك محفوظ، يمكنك العودة في أي وقت.
📝 استخدم اسم المستخدم وكلمة السر للدخول.`
        };
    }

    // ===================================
    // أدوات مساعدة
    // ===================================

    _generateReferralCode(playerId) {
        if (!playerId) return null;
        const numericPart = playerId.toString().slice(-5);
        const randomLetters = Math.random().toString(36).substring(2, 5).toUpperCase();
        return `MG${numericPart}${randomLetters}`;
    }

    // ✅ فحص إذا كان النص يبدأ بأمر
    isAccountCommand(text) {
        const lower = text.toLowerCase().trim();
        const commands = [
            'بدء', 'ابدأ', 'ابدء',
            'دخول', 'تسجيل دخول', 'تسجيل_دخول', 'تسجيلالدخول', 'لدي حساب', 'لدي_حساب',
            'انشاء', 'إنشاء', 'تسجيل', 'حساب جديد', 'حساب_جديد',
            'الغاء', 'إلغاء', 'cancel',
            'تسجيل خروج', 'تسجيل_خروج', 'تسجيلخروج', 'خروج', 'logout',
            'معرفي', 'حسابي'
        ];
        return commands.some(cmd => lower === cmd || lower.startsWith(cmd));
    }

    // ✅ تنظيف دوري
    startCleanupInterval() {
        setInterval(() => {
            this.cleanupOldSessions();
        }, 5 * 60 * 1000); // كل 5 دقائق
    }
            }
