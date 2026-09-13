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

        this.ADMIN_ID_MIN = 1000;
        this.ADMIN_ID_MAX = 1099;
        this.PLAYER_ID_MIN = 1100;
        this.PLAYER_ID_MAX = 9999;

        console.log('🔐 نظام الصلاحيات (السوق) تم تهيئته');
    }

    // ✅ هل المستخدم أدمن رئيسي؟
    isRootAdmin(userId) {
        if (!userId) return false;
        const ADMIN_PSID = process.env.ADMIN_PSID;
        const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;

        // فيسبوك
        if (ADMIN_PSID && userId === ADMIN_PSID) return true;

        // تلغرام: مع أو بدون tg_
        if (ADMIN_TELEGRAM_ID) {
            if (userId === ADMIN_TELEGRAM_ID) return true;
            if (userId === `tg_${ADMIN_TELEGRAM_ID}`) return true;
        }

        return false;
    }

    async hasPermission(userId, permissionType) {
        try {
            if (this.isRootAdmin(userId)) return true;
            const player = await Player.findByIdentifier(userId);
            if (!player) return false;
            return player.hasPermission(permissionType);
        } catch (error) {
            return false;
        }
    }

    async getNextAdminId() {
        const lastId = await Player.getLastAdminNumericId();
        const nextId = lastId + 1;
        if (nextId > this.ADMIN_ID_MAX) {
            throw new Error(`تم الوصول للحد الأقصى من المدراء (${this.ADMIN_ID_MAX})`);
        }
        return nextId.toString();
    }

    async getNextPlayerId() {
        const lastId = await Player.getLastPlayerNumericId();
        const nextId = lastId + 1;
        if (nextId > this.PLAYER_ID_MAX) {
            throw new Error(`تم الوصول للحد الأقصى من اللاعبين (${this.PLAYER_ID_MAX})`);
        }
        return `P${nextId}`;
    }

    async grantPermission(targetIdentifier, permissionType, grantedBy, durationHours = null) {
        try {
            if (!this.PERMISSION_TYPES[permissionType]) {
                return { error: `❌ نوع الصلاحية "${permissionType}" غير صالح.` };
            }

            const target = await Player.findByIdentifier(targetIdentifier);
            if (!target) return { error: '❌ اللاعب غير موجود.' };

            let idChanged = false;
            let oldId = target.playerId;

            if (permissionType === 'full_admin') {
                const isAdminId = /^\d+$/.test(target.playerId);
                if (!isAdminId) {
                    const newAdminId = await this.getNextAdminId();
                    target.originalPlayerId = target.playerId;
                    target.playerId = newAdminId;
                    idChanged = true;
                }
            }

            const existingPerm = target.adminPermissions.find(p => p.type === permissionType);
            if (existingPerm) {
                existingPerm.grantedBy = grantedBy;
                existingPerm.grantedAt = new Date();
                existingPerm.expiresAt = durationHours ? new Date(Date.now() + durationHours * 60 * 60 * 1000) : null;
            } else {
                target.adminPermissions.push({
                    type: permissionType,
                    grantedBy,
                    grantedAt: new Date(),
                    expiresAt: durationHours ? new Date(Date.now() + durationHours * 60 * 60 * 1000) : null
                });
            }

            await target.save();

            const typeName = this.PERMISSION_TYPES[permissionType];
            let msg = `✅ تم منح الصلاحية\n\n👤 ${target.name}\n🔐 ${typeName}\n⏰ ${durationHours ? `${durationHours} ساعة` : 'دائمة'}`;
            if (idChanged) msg += `\n\n🎯 ID الجديد: ${target.playerId}`;

            return { success: true, message: msg };
        } catch (error) {
            return { error: `❌ خطأ: ${error.message}` };
        }
    }

    async revokePermission(targetIdentifier, permissionType) {
        try {
            const target = await Player.findByIdentifier(targetIdentifier);
            if (!target) return { error: '❌ اللاعب غير موجود.' };

            const beforeCount = target.adminPermissions.length;
            target.adminPermissions = target.adminPermissions.filter(p => p.type !== permissionType);

            if (target.adminPermissions.length === beforeCount) {
                return { error: `❌ اللاعب لا يملك هذه الصلاحية.` };
            }

            await target.save();
            const typeName = this.PERMISSION_TYPES[permissionType] || permissionType;
            return { success: true, message: `✅ تم إزالة صلاحية ${typeName}.` };
        } catch (error) {
            return { error: `❌ خطأ: ${error.message}` };
        }
    }

    async revokeAllPermissions(targetIdentifier) {
        try {
            const target = await Player.findByIdentifier(targetIdentifier);
            if (!target) return { error: '❌ اللاعب غير موجود.' };

            if (!target.adminPermissions || target.adminPermissions.length === 0) {
                return { error: '❌ اللاعب ليس لديه صلاحيات.' };
            }

            // منع نزع الصلاحيات من الأدمن الرئيسي
            const targetPlatformIds = (target.linkedPlatforms || []).map(p => p.platformId);
            for (const pid of targetPlatformIds) {
                if (this.isRootAdmin(pid)) {
                    return { error: '❌ لا يمكن نزع صلاحيات الأدمن الرئيسي!' };
                }
            }

            const oldPlayerId = target.playerId;
            target.adminPermissions = [];
            const newPlayerId = await this.getNextPlayerId();
            target.playerId = newPlayerId;
            target.originalPlayerId = null;

            await target.save();

            return {
                success: true,
                message: `✅ تم نزع الصلاحيات\n\n👤 ${target.name}\n🆔 من ${oldPlayerId} إلى ${target.playerId}`
            };
        } catch (error) {
            return { error: `❌ خطأ: ${error.message}` };
        }
    }

    async showPlayerPermissions(targetIdentifier) {
        try {
            const target = await Player.findByIdentifier(targetIdentifier);
            if (!target) return { error: '❌ اللاعب غير موجود.' };

            const activePerms = target.getActivePermissions();
            const targetPlatformIds = (target.linkedPlatforms || []).map(p => p.platformId);
            const isRoot = targetPlatformIds.some(pid => this.isRootAdmin(pid));

            if (activePerms.length === 0 && !isRoot) {
                return { message: `👤 ${target.name}\n\n❌ ليس لديه أي صلاحيات.` };
            }

            let msg = `🔐 صلاحيات ${target.name}\n\n🆔 ID: ${target.playerId}\n\n`;

            if (isRoot) {
                msg += `👑 الأدمن الرئيسي\n• جميع الصلاحيات\n\n`;
            }

            if (activePerms.length > 0) {
                msg += `📋 الصلاحيات:\n`;
                activePerms.forEach(p => {
                    const typeName = this.PERMISSION_TYPES[p.type] || p.type;
                    const expires = p.expiresAt ? `⏰ ${new Date(p.expiresAt).toLocaleString('ar-EG')}` : '♾️ دائمة';
                    msg += `• ${typeName}\n  ${expires}\n`;
                });
            }

            return { message: msg };
        } catch (error) {
            return { error: `❌ خطأ: ${error.message}` };
        }
    }

    async showAllAdmins() {
        try {
            const admins = await Player.find({
                'adminPermissions.0': { $exists: true }
            }).select('name playerId adminPermissions linkedPlatforms');

            const activeAdmins = admins.filter(a => a.getActivePermissions().length > 0);

            let msg = `👑 قائمة المدراء\n\n`;
            let count = 0;

            // الأدمن الرئيسي (من env)
            const ADMIN_PSID = process.env.ADMIN_PSID;
            const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;
            const rootAdminIds = [];
            if (ADMIN_PSID) rootAdminIds.push(ADMIN_PSID);
            if (ADMIN_TELEGRAM_ID) rootAdminIds.push(ADMIN_TELEGRAM_ID);

            for (const rootId of rootAdminIds) {
                const rootPlayer = await Player.findByIdentifier(rootId);
                if (rootPlayer) {
                    count++;
                    msg += `${count}. 👑 ${rootPlayer.name}\n   🆔 ${rootPlayer.playerId || rootId}\n   📌 الأدمن الرئيسي\n\n`;
                }
            }

            for (const admin of activeAdmins) {
                // تخطي الأدمن الرئيسي (تم عرضه)
                const adminPlatformIds = (admin.linkedPlatforms || []).map(p => p.platformId);
                const isRootPlayer = adminPlatformIds.some(pid => this.isRootAdmin(pid));
                if (isRootPlayer) continue;

                count++;
                const perms = admin.getActivePermissions();
                const hasFullAdmin = perms.some(p => p.type === 'full_admin');
                const icon = hasFullAdmin ? '🔐' : '⚙️';
                msg += `${count}. ${icon} ${admin.name}\n   🆔 ${admin.playerId}\n   📊 ${perms.length} صلاحية\n\n`;
            }

            if (count === 0) return { message: '👑 لا يوجد مدراء حالياً.' };

            return { message: msg };
        } catch (error) {
            return { error: `❌ خطأ: ${error.message}` };
        }
    }

    getPermissionName(type) {
        return this.PERMISSION_TYPES[type] || type;
    }

    getAllPermissionTypes() {
        return Object.keys(this.PERMISSION_TYPES);
    }
            }
