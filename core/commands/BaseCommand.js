// core/commands/BaseCommand.js
import Player from '../models/Player.js';

export class BaseCommand {
    constructor(commandHandler) {
        this.commandHandler = commandHandler;
    }

    // ✅ التحقق من حالة اللاعب
    async checkPlayerStatus(player) {
        if (!player) return { error: '❌ لم يتم العثور على حسابك.' };

        if (player.banned) {
            return { error: '❌ تم حظرك من سوق ريو.\n\n💡 تواصل مع الإدارة.' };
        }

        if (player.isJailed && player.isJailed()) {
            const isPermanent = player.jailedUntil.getTime() === 0;
            const timeStr = isPermanent
                ? '🚔 أنت مسجون بشكل دائم'
                : `🚔 أنت مسجون حتى\n${player.jailedUntil.toLocaleString('ar-EG')}`;
            return { error: `${timeStr}\n\n📝 السبب: ${player.jailedReason || 'غير محدد'}` };
        }

        if (player.registrationStatus !== 'completed') {
            return { error: '❌ حسابك غير مفعّل.\n\n💡 سجّل في مغارة ريو أولاً.' };
        }

        return { success: true };
    }

    // ✅ اختصار
    async checkPlayerApproval(player) {
        return await this.checkPlayerStatus(player);
    }

    // ✅ جلب النظام
    async getSystem(systemName) {
        return await this.commandHandler.getSystem(systemName);
    }

    // ✅ حفظ آمن (يتجاهل خطأ الوثيقة المحذوفة)
    async safeSave(player) {
        try {
            if (!player) return false;
            await player.save();
            return true;
        } catch (error) {
            if (error.name === 'DocumentNotFoundError' || error.message?.includes('No matching document')) {
                console.warn('⚠️ الوثيقة محذوفة من DB، تجاهل الحفظ');
                return false;
            }
            console.error('❌ خطأ في الحفظ:', error);
            throw error;
        }
    }

    // ✅ معالجة الأخطاء العامة
    handleError(error, action = 'تنفيذ الأمر') {
        console.error(`❌ خطأ في ${action}:`, error);

        // خطأ الوثيقة المحذوفة
        if (error.name === 'DocumentNotFoundError' || error.message?.includes('No matching document')) {
            return '⚠️ حدث تعارض في البيانات.\n\n💡 جرب مرة أخرى بعد لحظات.';
        }

        // أخطاء أخرى
        return `❌ حدث خطأ أثناء ${action}.`;
    }

    // ✅ إضافة ريو بشكل آمن (بدون save)
    async addGold(player, amount, transaction = null) {
        const update = { $inc: { gold: amount } };

        if (transaction) {
            update.$push = {
                transactions: {
                    $each: [{
                        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        ...transaction,
                        createdAt: new Date()
                    }],
                    $position: 0
                }
            };
        }

        await Player.updateOne({ userId: player.userId }, update);
        
        // تحديث الذاكرة
        player.gold += amount;
        if (transaction) {
            player.transactions = player.transactions || [];
            player.transactions.unshift({
                id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                ...transaction,
                createdAt: new Date()
            });
        }
    }

    // ✅ خصم ريو بشكل آمن
    async removeGold(player, amount, transaction = null) {
        const update = { $inc: { gold: -amount } };

        if (transaction) {
            update.$push = {
                transactions: {
                    $each: [{
                        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        ...transaction,
                        createdAt: new Date()
                    }],
                    $position: 0
                }
            };
        }

        await Player.updateOne({ userId: player.userId }, update);

        // تحديث الذاكرة
        player.gold -= amount;
        if (transaction) {
            player.transactions = player.transactions || [];
            player.transactions.unshift({
                id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                ...transaction,
                createdAt: new Date()
            });
        }
    }

    // ✅ إضافة معاملة فقط (بدون تعديل الرصيد)
    async addTransaction(player, type, amount, description, targetPlayer = null) {
        const transaction = {
            id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            amount,
            status: 'completed',
            description,
            targetPlayer,
            createdAt: new Date()
        };

        await Player.updateOne(
            { userId: player.userId },
            { 
                $push: {
                    transactions: {
                        $each: [transaction],
                        $position: 0
                    }
                }
            }
        );

        // تحديث الذاكرة
        player.transactions = player.transactions || [];
        player.transactions.unshift(transaction);
    }
}
