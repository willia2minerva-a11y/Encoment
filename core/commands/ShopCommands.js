// core/commands/ShopCommands.js
import { BaseCommand } from './BaseCommand.js';

export class ShopCommands extends BaseCommand {
    getCommands() {
        return {
            'متجر': this.handleShop.bind(this),
            'المتجر': this.handleShop.bind(this),
            'شراء': this.handlePurchase.bind(this),
            'اشتري': this.handlePurchase.bind(this),
            'منتج': this.handleProductInfo.bind(this),
            'تفاصيل': this.handleProductInfo.bind(this)
        };
    }

    // ✅ عرض المتجر
    async handleShop(player, args) {
        const check = await this.checkPlayerStatus(player);
        if (check.error) return check.error;

        const shopSystem = await this.getSystem('shop');
        if (!shopSystem) return '❌ نظام المتجر غير متوفر.';

        const page = parseInt(args[0]) || 1;
        return await shopSystem.showShop(page);
    }

    // ✅ عرض تفاصيل منتج
    async handleProductInfo(player, args) {
        const check = await this.checkPlayerStatus(player);
        if (check.error) return check.error;

        if (args.length === 0) {
            return `❌ اكتب ID المنتج.\n\nمثال: منتج fire_sword`;
        }

        const shopSystem = await this.getSystem('shop');
        if (!shopSystem) return '❌ نظام المتجر غير متوفر.';

        return await shopSystem.showProduct(args[0]);
    }

    // ✅ شراء منتج
    async handlePurchase(player, args) {
        const check = await this.checkPlayerStatus(player);
        if (check.error) return check.error;

        if (args.length === 0) {
            return `❌ اكتب ID المنتج.\n\nمثال: شراء fire_sword\n\n💡 للعرض: متجر`;
        }

        const productId = args[0];

        const shopSystem = await this.getSystem('shop');
        if (!shopSystem) return '❌ نظام المتجر غير متوفر.';

        const result = await shopSystem.purchase(player, productId);
        return result.error || result.message;
    }
}
