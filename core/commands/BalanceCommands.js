// core/commands/BalanceCommands.js
import { BaseCommand } from './BaseCommand.js';
import Player from '../models/Player.js';  // ← نقطة واحدة، ثم models
export class BalanceCommands extends BaseCommand {
    getCommands() {
        return {
            'رصيد': this.handleBalance.bind(this),
            'رصيدي': this.handleBalance.bind(this),
            'بطاقة': this.handleCard.bind(this),
            'بطاقتي': this.handleCard.bind(this),
            'معاملاتي': this.handleTransactions.bind(this),
            'سجلي': this.handleTransactions.bind(this)
        };
    }

    // ✅ عرض الرصيد
    async handleBalance(player) {
        const check = await this.checkPlayerStatus(player);
        if (check.error) return check.error;

        const rank = await this.getRank(player);

        let msg = `💰 رصيدك\n\n`;
        msg += `👤 الاسم: ${player.name}\n`;
        msg += `🆔 المعرف: ${player.playerId || player.userId}\n`;
        msg += `💎 الرصيد: ${player.gold} ريو\n`;
        msg += `🏆 الترتيب: #${rank}\n\n`;
        
        msg += `💡 للبطاقة: بطاقة`;
        msg += `\n💡 للمتجر: متجر`;
        msg += `\n💡 للمعاملات: معاملاتي`;

        return msg;
    }

    // ✅ الحصول على ترتيب اللاعب
    async getRank(player) {
        const Player = (await import('../../models/Player.js')).default;
        const rank = await Player.countDocuments({
            registrationStatus: 'completed',
            gold: { $gt: player.gold }
        }) + 1;
        return rank;
    }

    // ✅ بطاقة الرصيد (صورة)
    async handleCard(player) {
        const check = await this.checkPlayerStatus(player);
        if (check.error) return check.error;

        try {
            const cardGenerator = this.commandHandler.cardGenerator;
            const imagePath = await cardGenerator.generateCard(player);

            return {
                type: 'image',
                path: imagePath,
                caption: `💳 بطاقة رصيدك يا ${player.name}!`
            };
        } catch (error) {
            return this.handleError(error, 'إنشاء البطاقة');
        }
    }

    // ✅ سجل المعاملات
    async handleTransactions(player) {
        const check = await this.checkPlayerStatus(player);
        if (check.error) return check.error;

        const transactions = (player.transactions || [])
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 15);

        if (transactions.length === 0) {
            return `📋 سجل المعاملات\n\n❌ لا توجد معاملات حالياً.`;
        }

        let msg = `📋 سجل المعاملات (آخر ${transactions.length})\n`;

        transactions.forEach(tx => {
            const date = new Date(tx.createdAt).toLocaleDateString('ar-EG');
            const icons = {
                'deposit': '📥',
                'withdrawal': '📤',
                'purchase': '🛒',
                'transfer_sent': '➡️',
                'transfer_received': '⬅️',
                'gift_code': '🎁',
                'admin_add': '👑',
                'admin_remove': '👑'
            };
            const icon = icons[tx.type] || '📌';

            const sign = ['transfer_sent', 'purchase', 'withdrawal', 'admin_remove'].includes(tx.type) ? '-' : '+';

            msg += `\n${icon} ${tx.description || 'معاملة'}\n`;
            msg += `   💰 ${sign}${tx.amount} ريو\n`;
            msg += `   📅 ${date}\n`;
        });

        return msg;
    }
}
