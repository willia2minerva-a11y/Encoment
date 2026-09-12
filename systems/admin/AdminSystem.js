// systems/admin/AdminSystem.js
import Player from '../../core/models/Player.js';

export class AdminSystem {
    constructor() {
        this.commandHandler = null;
        console.log('👑 نظام المدير (Economy) تم تهيئته');
    }

    setCommandHandler(handler) {
        this.commandHandler = handler;
    }

    // ✅ فحص الأدمن (غير متزامن)
    async isAdminAsync(userId) {
        const ADMIN_PSID = process.env.ADMIN_PSID;
        const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;

        const adminIds = [
            ADMIN_PSID,
            ADMIN_TELEGRAM_ID ? `tg_${ADMIN_TELEGRAM_ID}` : null
        ].filter(Boolean);

        return adminIds.includes(userId);
    }

    // ✅ نسخة متزامنة (للاستخدام في CommandHandler)
    isAdmin(userId) {
        const ADMIN_PSID = process.env.ADMIN_PSID;
        const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;

        const adminIds = [
            ADMIN_PSID,
            ADMIN_TELEGRAM_ID ? `tg_${ADMIN_TELEGRAM_ID}` : null
        ].filter(Boolean);

        return adminIds.includes(userId);
    }

    generateUniqueId() {
        return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
