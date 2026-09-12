// core/commands/CodeCommands.js
import { BaseCommand } from './BaseCommand.js';

export class CodeCommands extends BaseCommand {
    getCommands() {
        return {
            'هدية': this.handleGiftCode.bind(this),
            'كود': this.handleGiftCode.bind(this),
            'خصم': this.handleDiscountCode.bind(this),
            'كوبون': this.handleDiscountCode.bind(this)
        };
    }

    // ✅ استخدام كود هدية
    async handleGiftCode(player, args) {
        const check = await this.checkPlayerStatus(player);
        if (check.error) return check.error;

        if (args.length === 0) {
            return `❌ اكتب كود الهدية.\n\nمثال: هدية WELCOME100`;
        }

        const code = args[0];

        const giftCodeSystem = await this.getSystem('giftcode');
        if (!giftCodeSystem) return '❌ نظام الأكواد غير متوفر.';

        const result = await giftCodeSystem.redeemCode(player, code);
        return result.error || result.message;
    }

    // ✅ تفعيل كود خصم
    async handleDiscountCode(player, args) {
        const check = await this.checkPlayerStatus(player);
        if (check.error) return check.error;

        if (args.length === 0) {
            // إذا كان لديه خصم مطبق
            if (player.appliedDiscount?.code) {
                return `🎟️ خصم مطبق حالياً

🎟️ الكود: ${player.appliedDiscount.code}
📊 النسبة: ${player.appliedDiscount.percentage}%
💡 سيُطبق عند الشراء التالي

❌ لإزالته: أرسل "خصم" بدون كود (قريباً)`;
            }

            return `❌ اكتب كود الخصم.\n\nمثال: خصم SAVE20`;
        }

        const code = args[0];

        const discountCodeSystem = await this.getSystem('discountcode');
        if (!discountCodeSystem) return '❌ نظام الأكواد غير متوفر.';

        const result = await discountCodeSystem.applyDiscount(player, code);
        return result.error || result.message;
    }
}
