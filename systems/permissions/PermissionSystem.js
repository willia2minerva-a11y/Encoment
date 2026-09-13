// systems/permissions/PermissionSystem.js
// الموقع: سوق ريو
import Player from '../../core/models/Player.js';

export class PermissionSystem {
    constructor() {
        this.PERMISSION_TYPES = {
            'full_admin': 'مدير كامل',
            'approve': 'موافقة على اللاعبين',
            'ban': 'حظر ورفع حظر',
            'economy': 'إدارة الاقتصاد',
            'tasks': 'إدارة المهام',
            'give': 'إعطاء الموارد',
            'content': 'إدارة المحتوى',
            'jail': 'السجن والإطلاق',
            'modify': 'تعديل الإحصائيات'
        };

        // ✅ نطاق IDs الجديد
        this.ADMIN_ID_MIN = 1001;       // الأدمن المعيَّن (بعد الأدمن الرئيسي 1000)
        this.ADMIN_ID_MAX = 1099;
        this.ROOT_ADMIN_ID = '1000';    // الأدمن الرئيسي
        this.PLAYER_ID_MIN = 1100;
        this.PLAYER_ID_MAX = 9999;

        console.log('🔐 نظام الصلاحيات (DB-based) تم تهيئته');
    }

    // ===================================
    // فحص الأدمن الرئيسي
    // ===================================

    // ✅ جديد: هل هذا platformId يخص الأدمن الرئيسي؟
    async isRootAdmin(platformId) {
        if (!platformId) return false;
        try {
            const rootAdmin = await Player.findOne({ isRoot: true });
            if (!rootAdmin) return false;
            return (rootAdmin.linkedPlatforms || []).some(p => p.platformId === platformId);
        } catch (error) {
            console.error('❌ خطأ في isRootAdmin:', error);
            return false;
        }
    }

    // ✅ هل هذا الحساب هو الأدمن الرئيسي؟
    isRootPlayer(player) {
        return player && player.isRoot === true;
    }

    // ✅ جلب حساب الأدمن الرئيسي
    async getRootAdmin() {
        try {
            return await Player.findOne({ isRoot: true });
        } catch (error) {
            return null;
        }
    }

    // ===================================
    // فحص الصلاحية
    // ===================================
    async hasPermission(userId, permissionType) {
        try {
            const player = await Player.findByIdentifier(userId);
            if (!player) return false;

            // الأدمن الرئيسي = كل الصلاحيات
            if (player.isRoot) return true;

            return player.hasPermission(permissionType);
        } catch (error) {
            console.error('❌ خطأ في فحص الصلاحية:', error);
            return false;
        }
    }

    // ===================================
    // توليد IDs
    // ===================================

    // ✅ الأدمن المعيَّن: 1001-1099
    async getNextAdminId() {
        const lastId = await Player.getLastAdminNumericId();
        const nextId = lastId + 1;

        if (nextId > this.ADMIN_ID_MAX) {
            throw new Error(`تم الوصول للحد الأقصى من المدراء (${this.ADMIN_ID_MAX})`);
        }

        return nextId.toString();
    }

    // ✅ اللاعب العادي: P1100+
    async getNextPlayerId() {
        const lastId = await Player.getLastPlayerNumericId();
        const nextId = lastId + 1;

        if (nextId > this.PLAYER_ID_MAX) {
            throw new Error(`تم الوصول للحد الأقصى من اللاعبين (${this.PLAYER_ID_MAX})`);
        }

        return `P${nextId}`;
    }

    // ===================================
    // منح صلاحية
    // ===================================
    async grantPermission(targetIdentifier, permissionType, grantedBy, durationHours = null) {
        try {
            if (!this.PERMISSION_TYPES[permissionType]) {
                return { error: `❌ نوع الصلاحية "${permissionType}" غير صالح.` };
            }

            const target = await Player.findByIdentifier(targetIdentifier);
            if (!target) return { error: '❌ اللاعب غير موجود.' };

            // ⚠️ لا يمكن تعديل الأدمن الرئيسي
            if (target.isRoot) {
                return { error: '❌ لا يمكن تعديل صلاحيات الأدمن الرئيسي.' };
            }

            let idChanged = false;
            let oldId = target.playerId;

            // ✅ تحويل ID لمدير عند منح full_admin
            if (permissionType === 'full_admin') {
                const isAdminId = /^\d+$/.test(target.playerId);

                if (!isAdminId) {
                    const newAdminId = await this.getNextAdminId();
                    target.originalPlayerId = target.playerId;
                    target.playerId = newAdminId;
                    idChanged = true;
                }
            }

            // فحص إن كانت الصلاحية موجودة
            const existingPerm = target.adminPermissions.find(p => p.type === permissionType);

            if (existingPerm) {
                existingPerm.grantedBy = grantedBy;
                existingPerm.grantedAt = new Date();
                existingPerm.expiresAt = durationHours
                    ? new Date(Date.now() + durationHours * 60 * 60 * 1000)
                    : null;
            } else {
                target.adminPermissions.push({
                    type: permissionType,
                    grantedBy,
                    grantedAt: new Date(),
                    expiresAt: durationHours
                        ? new Date(Date.now() + durationHours * 60 * 60 * 1000)
                        : null
                });
            }

            await target.save();

            const typeName = this.PERMISSION_TYPES[permissionType];
            let msg = `✅ تم منح الصلاحية\n\n`;
            msg += `👤 اللاعب: ${target.name}\n`;
            msg += `🔐 الصلاحية: ${typeName}\n`;
            msg += `⏰ المدة: ${durationHours ? `${durationHours} ساعة` : 'دائمة'}`;

            if (idChanged) {
                msg += `\n\n🎯 ID القديم: ${oldId} (تم إلغاؤه)`;
                msg += `\n🎯 ID الجديد: ${target.playerId}`;
            }

            return { success: true, message: msg };
        } catch (error) {
            console.error('❌ خطأ في منح الصلاحية:', error);
            return { error: `❌ حدث خطأ: ${error.message}` };
        }
    }

    // ===================================
    // إزالة صلاحية محددة
    // ===================================
    async revokePermission(targetIdentifier, permissionType) {
        try {
            const target = await Player.findByIdentifier(targetIdentifier);
            if (!target) return { error: '❌ اللاعب غير موجود.' };

            if (target.isRoot) {
                return { error: '❌ لا يمكن تعديل صلاحيات الأدمن الرئيسي.' };
            }

            const beforeCount = target.adminPermissions.length;
            target.adminPermissions = target.adminPermissions.filter(p => p.type !== permissionType);

            if (target.adminPermissions.length === beforeCount) {
                return { error: `❌ اللاعب لا يملك الصلاحية "${this.PERMISSION_TYPES[permissionType] || permissionType}".` };
            }

            await target.save();

            const typeName = this.PERMISSION_TYPES[permissionType] || permissionType;
            return { success: true, message: `✅ تم إزالة صلاحية ${typeName} من ${target.name}.` };
        } catch (error) {
            return { error: `❌ حدث خطأ: ${error.message}` };
        }
    }

    // ===================================
    // إزالة كل الصلاحيات + إعادة ID لاعب
    // ===================================
    async revokeAllPermissions(targetIdentifier) {
        try {
            const target = await Player.findByIdentifier(targetIdentifier);
            if (!target) return { error: '❌ اللاعب غير موجود.' };

            if (target.isRoot) {
                return { error: '❌ لا يمكن نزع صلاحيات الأدمن الرئيسي!' };
            }

            if (!target.adminPermissions || target.adminPermissions.length === 0) {
                return { error: '❌ اللاعب ليس لديه صلاحيات.' };
            }

            const oldPlayerId = target.playerId;

            // إزالة الصلاحيات
            target.adminPermissions = [];
            target.originalPlayerId = null;

            // ✅ إعطاء ID لاعب عادي جديد (P1100+)
            const newPlayerId = await this.getNextPlayerId();
            target.playerId = newPlayerId;

            await target.save();

            return {
                success: true,
                message: `✅ تم نزع صلاحيات الأدمن\n\n👤 اللاعب: ${target.name}\n🆔 ID القديم: ${oldPlayerId}\n🆔 ID الجديد: ${target.playerId}\n\n💡 اللاعب الآن لاعب عادي.`
            };
        } catch (error) {
            return { error: `❌ حدث خطأ: ${error.message}` };
        }
    }

    // ===================================
    // عرض صلاحيات لاعب
    // ===================================
    async showPlayerPermissions(targetIdentifier) {
        try {
            const target = await Player.findByIdentifier(targetIdentifier);
            if (!target) return { error: '❌ اللاعب غير موجود.' };

            const activePerms = target.getActivePermissions();

            // ✅ الأدمن الرئيسي
            if (target.isRoot) {
                return {
                    message: `👤 ${target.name}\n\n🆔 ID: ${target.playerId}\n📌 الأدمن الرئيسي\n\n👑 جميع الصلاحيات\n• لا يمكن حظره\n• لا يمكن نزعه\n• لا يمكن سجنه`
                };
            }

            if (activePerms.length === 0) {
                return { message: `👤 ${target.name}\n\n❌ ليس لديه أي صلاحيات.` };
            }

            let msg = `🔐 صلاحيات ${target.name}\n\n`;
            msg += `🆔 ID: ${target.playerId}\n`;
            if (target.originalPlayerId) {
                msg += `📌 ID الأصلي: ${target.originalPlayerId}\n`;
            }
            msg += `\n📋 الصلاحيات:\n`;

            activePerms.forEach(p => {
                const typeName = this.PERMISSION_TYPES[p.type] || p.type;
                const expires = p.expiresAt
                    ? `⏰ تنتهي: ${new Date(p.expiresAt).toLocaleString('ar-EG')}`
                    : '♾️ دائمة';
                msg += `• ${typeName}\n  ${expires}\n`;
            });

            return { message: msg };
        } catch (error) {
            return { error: `❌ حدث خطأ: ${error.message}` };
        }
    }

    // ===================================
    // قائمة كل المدراء
    // ===================================
    async showAllAdmins() {
        try {
            // 1. الأدمن الرئيسي (من DB)
            const rootAdmin = await Player.findOne({ isRoot: true });

            // 2. الأدمن المعيَّن
            const admins = await Player.find({
                'adminPermissions.0': { $exists: true },
                isRoot: { $ne: true }
            }).select('name playerId originalPlayerId adminPermissions linkedPlatforms');

            const activeAdmins = admins.filter(a => a.getActivePermissions().length > 0);

            let msg = '';
            let count = 0;

            // الأدمن الرئيسي
            if (rootAdmin) {
                count++;
                msg += `${count}. 👑 ${rootAdmin.name}\n`;
                msg += `   🆔 ${rootAdmin.playerId}\n`;
                msg += `   📌 الأدمن الرئيسي\n`;
                msg += `   📱 المنصات: ${(rootAdmin.linkedPlatforms || []).length}\n\n`;
            }

            // المدراء المعيَّنون
            for (const admin of activeAdmins) {
                count++;
                const perms = admin.getActivePermissions();
                const hasFullAdmin = perms.some(p => p.type === 'full_admin');
                const icon = hasFullAdmin ? '🔐' : '⚙️';

                msg += `${count}. ${icon} ${admin.name}\n`;
                msg += `   🆔 ${admin.playerId}\n`;
                msg += `   📊 ${perms.length} صلاحية\n\n`;
            }

            if (count === 0) {
                return { message: '👑 لا يوجد مدراء حالياً.' };
            }

            return { message: `👑 قائمة المدراء (${count})\n\n${msg}` };
        } catch (error) {
            return { error: `❌ حدث خطأ: ${error.message}` };
        }
    }

    // ===================================
    // أدوات مساعدة
    // ===================================
    getPermissionName(type) {
        return this.PERMISSION_TYPES[type] || type;
    }

    getAllPermissionTypes() {
        return Object.keys(this.PERMISSION_TYPES);
    }
                    }
