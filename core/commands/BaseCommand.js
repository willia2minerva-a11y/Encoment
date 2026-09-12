// core/commands/BaseCommand.js
export class BaseCommand {
    constructor(commandHandler) {
        this.commandHandler = commandHandler;
    }

    // ✅ التحقق من حالة اللاعب
    async checkPlayerStatus(player) {
        if (!player) return { error: '❌ لم يتم العثور على حسابك.' };

        // محظور
        if (player.banned) {
            return { error: '❌ تم حظرك من اللعبة.\n\n💡 تواصل مع الإدارة.' };
        }

        // مسجون
        if (player.isJailed && player.isJailed()) {
            const isPermanent = player.jailedUntil.getTime() === 0;
            const timeStr = isPermanent
                ? '🚔 أنت مسجون بشكل دائم'
                : `🚔 أنت مسجون حتى\n${player.jailedUntil.toLocaleString('ar-EG')}`;
            return { error: `${timeStr}\n\n📝 السبب: ${player.jailedReason || 'غير محدد'}` };
        }

        // لم يوافق عليه
        if (player.registrationStatus !== 'completed') {
            return { error: '❌ حسابك غير مفعّل.\n\n💡 سجّل في صفحة المغارة أولاً.' };
        }

        return { success: true };
    }

    // ✅ اختصار
    async checkPlayerApproval(player) {
        return await this.checkPlayerStatus(player);
    }

    async getSystem(systemName) {
        return await this.commandHandler.getSystem(systemName);
    }

    handleError(error, action = 'تنفيذ الأمر') {
        console.error(`❌ خطأ في ${action}:`, error);
        return `❌ حدث خطأ أثناء ${action}.`;
    }
}
