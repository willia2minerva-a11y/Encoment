// core/commands/AdminEconomyCommands.js
import { BaseCommand } from './BaseCommand.js';
import Player from '../models/Player.js';
import ShopItem from '../models/ShopItem.js';
import GiftCode from '../models/GiftCode.js';
import DiscountCode from '../models/DiscountCode.js';
import Settings from '../models/Settings.js';

export class AdminEconomyCommands extends BaseCommand {
    getCommands() {
        return {
            // الاقتصاد
            'اقتصاد': this.handleEconomyStats.bind(this),
            'اغنياء': this.handleRichest.bind(this),
            'فقراء': this.handlePoorest.bind(this),
            'اقتصاد_لاعب': this.handlePlayerEconomy.bind(this),
            'معاملات_لاعب': this.handlePlayerTransactions.bind(this),
            
            // الرصيد
            'اضف_رصيد': this.handleAddBalance.bind(this),
            'اسحب_رصيد': this.handleRemoveBalance.bind(this),
            'تعديل_رصيد': this.handleSetBalance.bind(this),
            
            // المنتجات
            'اضف_منتج': this.handleAddProduct.bind(this),
            'حذف_منتج': this.handleRemoveProduct.bind(this),
            'تعديل_منتج': this.handleEditProduct.bind(this),
            'قائمة_المنتجات': this.handleListProducts.bind(this),
            'اضف_مخزون': this.handleAddStock.bind(this),
            
            // أكواد الهدايا
            'اضف_كود': this.handleAddGiftCode.bind(this),
            'حذف_كود': this.handleRemoveGiftCode.bind(this),
            'تعديل_كود': this.handleEditGiftCode.bind(this),
            'قائمة_الاكواد': this.handleListGiftCodes.bind(this),
            
            // أكواد الخصم
            'اضف_خصم': this.handleAddDiscountCode.bind(this),
            'حذف_خصم': this.handleRemoveDiscountCode.bind(this),
            'تعديل_خصم': this.handleEditDiscountCode.bind(this),
            'قائمة_الخصومات': this.handleListDiscountCodes.bind(this),
            
            // الصندوق
            'صندوق': this.handleBox.bind(this),
            'اسحب_صندوق': this.handleWithdrawFromBox.bind(this),
            'ايداع_صندوق': this.handleDepositToBox.bind(this),
            
            // الإعدادات
            'اعدادات': this.handleShowSettings.bind(this),
            'تعديل_اعداد': this.handleEditSetting.bind(this),
            'حذف_اعداد': this.handleDeleteSetting.bind(this)
        };
    }

    // ✅ فحص الأدمن
    async isAdmin(player) {
        return await this.commandHandler.adminSystem.isAdminAsync(player.userId);
    }

    // ===================================
    // الاقتصاد العام
    // ===================================

    async handleEconomyStats(player) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        const economySystem = await this.getSystem('economy');
        if (!economySystem) return '❌ نظام الاقتصاد غير متوفر.';

        return await economySystem.showEconomyStats();
    }

    async handleRichest(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        const page = parseInt(args[0]) || 1;
        const economySystem = await this.getSystem('economy');
        if (!economySystem) return '❌ نظام الاقتصاد غير متوفر.';

        return await economySystem.showRichestPlayers(page);
    }

    async handlePoorest(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        const page = parseInt(args[0]) || 1;
        const economySystem = await this.getSystem('economy');
        if (!economySystem) return '❌ نظام الاقتصاد غير متوفر.';

        return await economySystem.showPoorestPlayers(page);
    }

    async handlePlayerEconomy(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        if (args.length === 0) return '❌ الاستخدام: اقتصاد_لاعب [الاسم]';

        const economySystem = await this.getSystem('economy');
        if (!economySystem) return '❌ نظام الاقتصاد غير متوفر.';

        return await economySystem.showPlayerEconomy(args.join(' '));
    }

    async handlePlayerTransactions(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        if (args.length === 0) return '❌ الاستخدام: معاملات_لاعب [الاسم] [صفحة]';

        const page = parseInt(args[args.length - 1]) || 1;
        const targetName = isNaN(parseInt(args[args.length - 1])) 
            ? args.join(' ') 
            : args.slice(0, -1).join(' ');

        const economySystem = await this.getSystem('economy');
        if (!economySystem) return '❌ نظام الاقتصاد غير متوفر.';

        return await economySystem.showPlayerTransactions(targetName, page);
    }

    // ===================================
    // الرصيد
    // ===================================

    async handleAddBalance(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        if (args.length < 2) return '❌ الاستخدام: اضف_رصيد [ID] [المبلغ]';

        const targetId = args[0];
        const amount = parseInt(args[1]);

        if (isNaN(amount) || amount <= 0) return '❌ مبلغ غير صالح.';

        const target = await Player.findByIdentifier(targetId);
        if (!target) return `❌ لم يتم العثور على اللاعب: ${targetId}`;

        target.gold += amount;
        target.addTransaction('admin_add', amount, `إضافة من الإدارة`, player.name);
        await target.save();

        return `✅ تمت إضافة الرصيد

👤 اللاعب: ${target.name}
💰 المبلغ: ${amount} ريو
💎 الرصيد الجديد: ${target.gold} ريو`;
    }

    async handleRemoveBalance(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        if (args.length < 2) return '❌ الاستخدام: اسحب_رصيد [ID] [المبلغ]';

        const targetId = args[0];
        const amount = parseInt(args[1]);

        if (isNaN(amount) || amount <= 0) return '❌ مبلغ غير صالح.';

        const target = await Player.findByIdentifier(targetId);
        if (!target) return `❌ لم يتم العثور على اللاعب: ${targetId}`;

        if (target.gold < amount) {
            return `❌ رصيد اللاعب غير كافٍ.\n\n💰 رصيده: ${target.gold} ريو`;
        }

        target.gold -= amount;
        target.addTransaction('admin_remove', amount, `خصم من الإدارة`, player.name);
        await target.save();

        return `✅ تم خصم الرصيد

👤 اللاعب: ${target.name}
💰 المبلغ: ${amount} ريو
💎 الرصيد الجديد: ${target.gold} ريو`;
    }

    async handleSetBalance(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        if (args.length < 2) return '❌ الاستخدام: تعديل_رصيد [ID] [المبلغ]';

        const targetId = args[0];
        const amount = parseInt(args[1]);

        if (isNaN(amount) || amount < 0) return '❌ مبلغ غير صالح.';

        const target = await Player.findByIdentifier(targetId);
        if (!target) return `❌ لم يتم العثور على اللاعب: ${targetId}`;

        const oldGold = target.gold;
        target.gold = amount;
        
        const diff = amount - oldGold;
        const type = diff >= 0 ? 'admin_add' : 'admin_remove';
        target.addTransaction(type, Math.abs(diff), `تعديل الرصيد من الإدارة`, player.name);
        
        await target.save();

        return `✅ تم تعديل الرصيد

👤 اللاعب: ${target.name}
💰 الرصيد السابق: ${oldGold} ريو
💎 الرصيد الجديد: ${target.gold} ريو`;
    }

    // ===================================
    // المنتجات
    // ===================================

    async handleAddProduct(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        if (args.length < 4) {
            return `❌ الاستخدام: اضف_منتج [ID] [الاسم] [السعر] [النوع] [خيارات]

📝 الأنواع:
• لعبة (game_item) - يضاف للحقيبة
• خارجي (external) - يُسلّم يدوياً

مثال لعبة:
اضف_منتج fire_sword سيف_النار 500 لعبة fire_sword 1

مثال خارجي:
اضف_منتج design1 تصميم_خاص 300 خارجي "راسل الإدارة"`;
        }

        const productId = args[0];
        const name = args[1];
        const price = parseInt(args[2]);
        const rawType = args[3];

        if (isNaN(price) || price <= 0) return '❌ سعر غير صالح.';

        // تحديد النوع
        let type = 'game_item';
        if (rawType === 'خارجي' || rawType === 'external') {
            type = 'external';
        } else if (rawType === 'لعبة' || rawType === 'game_item') {
            type = 'game_item';
        } else {
            return '❌ النوع يجب أن يكون "لعبة" أو "خارجي".';
        }

        const productData = {
            id: productId,
            name: name,
            description: '',
            price: price,
            type: type,
            stock: null,
            isActive: true,
            displayOrder: 0
        };

        // خيارات إضافية
        if (type === 'game_item') {
            productData.gameItemId = args[4] || productId;
            productData.gameItemQuantity = parseInt(args[5]) || 1;
        } else {
            productData.deliveryMessage = args[4] || 'راسل الإدارة للتسليم';
            productData.deliveryLink = args[5] || process.env.ADMIN_PROFILE_URL || '';
        }

        const shopSystem = await this.getSystem('shop');
        if (!shopSystem) return '❌ نظام المتجر غير متوفر.';

        const result = await shopSystem.addProduct(productData, player.userId);
        return result.error || result.message;
    }

    async handleRemoveProduct(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        if (args.length === 0) return '❌ الاستخدام: حذف_منتج [ID]';

        const shopSystem = await this.getSystem('shop');
        if (!shopSystem) return '❌ نظام المتجر غير متوفر.';

        const result = await shopSystem.removeProduct(args[0]);
        return result.error || result.message;
    }

    async handleEditProduct(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        if (args.length < 3) {
            return `❌ الاستخدام: تعديل_منتج [ID] [الحقل] [القيمة]

📝 الحقول المتاحة:
• name - الاسم
• description - الوصف
• price - السعر
• stock - المخزون (null = غير محدود)
• isActive - التفعيل (true/false)
• deliveryMessage - رسالة التسليم
• deliveryLink - رابط التسليم
• displayOrder - ترتيب العرض`;
        }

        const productId = args[0];
        const field = args[1];
        const value = args.slice(2).join(' ');

        const shopSystem = await this.getSystem('shop');
        if (!shopSystem) return '❌ نظام المتجر غير متوفر.';

        const result = await shopSystem.editProduct(productId, field, value);
        return result.error || result.message;
    }

    async handleListProducts(player) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        const shopSystem = await this.getSystem('shop');
        if (!shopSystem) return '❌ نظام المتجر غير متوفر.';

        return await shopSystem.listAllProducts();
    }

    async handleAddStock(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        if (args.length < 2) return '❌ الاستخدام: اضف_مخزون [ID] [الكمية]';

        const productId = args[0];
        const quantity = parseInt(args[1]);

        if (isNaN(quantity) || quantity <= 0) return '❌ كمية غير صالحة.';

        const shopSystem = await this.getSystem('shop');
        if (!shopSystem) return '❌ نظام المتجر غير متوفر.';

        const result = await shopSystem.addStock(productId, quantity);
        return result.error || result.message;
    }

    // ===================================
    // أكواد الهدايا
    // ===================================

    async handleAddGiftCode(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص للمدراء فقط.';

        if (args.length < 3) {
            return `❌ الاستخدام: اضف_كود [الكود] [المبلغ] [الاستخدامات] [المدة بالساعات]

أمثلة:
• اضف_كود WELCOME 100 10 (بدون مدة)
• اضف_كود SAVE50 50 20 24 (لمدة 24 ساعة)`;
        }

        const code = args[0];
        const amount = parseInt(args[1]);
        const maxUses = parseInt(args[2]);
        const expiresInHours = args[3] ? parseFloat(args[3]) : null;

        if (isNaN(amount) || amount <= 0) return '❌ مبلغ غير صالح.';
        if (isNaN(maxUses) || maxUses <= 0) return '❌ عدد استخدامات غير صالح.';

        const giftCodeSystem = await this.getSystem('giftcode');
        if (!giftCodeSystem) return '❌ نظام الأكواد غير متوفر.';

        const result = await giftCodeSystem.createCode(
            code, amount, maxUses, expiresInHours, player.name
        );

        return result.error || result.message;
    }

    async handleRemoveGiftCode(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        if (args.length === 0) return '❌ الاستخدام: حذف_كود [الكود]';

        const giftCodeSystem = await this.getSystem('giftcode');
        if (!giftCodeSystem) return '❌ نظام الأكواد غير متوفر.';

        const result = await giftCodeSystem.removeCode(args[0]);
        return result.error || result.message;
    }

    async handleEditGiftCode(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        if (args.length < 3) return '❌ الاستخدام: تعديل_كود [الكود] [الحقل] [القيمة]';

        const code = args[0];
        const field = args[1];
        const value = args.slice(2).join(' ');

        const giftCodeSystem = await this.getSystem('giftcode');
        if (!giftCodeSystem) return '❌ نظام الأكواد غير متوفر.';

        const result = await giftCodeSystem.editCode(code, field, value);
        return result.error || result.message;
    }

    async handleListGiftCodes(player) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        const giftCodeSystem = await this.getSystem('giftcode');
        if (!giftCodeSystem) return '❌ نظام الأكواد غير متوفر.';

        return await giftCodeSystem.listAllCodes();
    }

    // ===================================
    // أكواد الخصم
    // ===================================

    async handleAddDiscountCode(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        if (args.length < 3) {
            return `❌ الاستخدام: اضف_خصم [الكود] [النسبة%] [الاستخدامات] [المدة]

أمثلة:
• اضف_خصم SAVE20 20 10 (بدون مدة)
• اضف_خصم VIP30 30 5 48 (لمدة 48 ساعة)`;
        }

        const code = args[0];
        const percentage = parseInt(args[1]);
        const maxUses = parseInt(args[2]);
        const expiresInHours = args[3] ? parseFloat(args[3]) : null;

        if (isNaN(percentage) || percentage < 1 || percentage > 100) {
            return '❌ النسبة بين 1 و 100.';
        }
        if (isNaN(maxUses) || maxUses <= 0) return '❌ عدد استخدامات غير صالح.';

        const discountCodeSystem = await this.getSystem('discountcode');
        if (!discountCodeSystem) return '❌ نظام الأكواد غير متوفر.';

        const result = await discountCodeSystem.createCode(
            code, percentage, maxUses, expiresInHours, player.name
        );

        return result.error || result.message;
    }

    async handleRemoveDiscountCode(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        if (args.length === 0) return '❌ الاستخدام: حذف_خصم [الكود]';

        const discountCodeSystem = await this.getSystem('discountcode');
        if (!discountCodeSystem) return '❌ نظام الأكواد غير متوفر.';

        const result = await discountCodeSystem.removeCode(args[0]);
        return result.error || result.message;
    }

    async handleEditDiscountCode(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        if (args.length < 3) return '❌ الاستخدام: تعديل_خصم [الكود] [الحقل] [القيمة]';

        const code = args[0];
        const field = args[1];
        const value = args.slice(2).join(' ');

        const discountCodeSystem = await this.getSystem('discountcode');
        if (!discountCodeSystem) return '❌ نظام الأكواد غير متوفر.';

        const result = await discountCodeSystem.editCode(code, field, value);
        return result.error || result.message;
    }

    async handleListDiscountCodes(player) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        const discountCodeSystem = await this.getSystem('discountcode');
        if (!discountCodeSystem) return '❌ نظام الأكواد غير متوفر.';

        return await discountCodeSystem.listAllCodes();
    }

    // ===================================
    // الصندوق
    // ===================================

    async handleBox(player) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        const box = await Settings.get('economyBox', 0);
        const feePercent = await Settings.get('transferFee', 5);

        return `🏦 صندوق الاقتصاد

💰 الرصيد الحالي: ${box} ريو
📊 نسبة الرسوم: ${feePercent}%

💡 للاستخدام:
• اسحب_صندوق [المبلغ] - سحب للرصيد الشخصي
• ايداع_صندوق [المبلغ] - إيداع في الصندوق`;
    }

    async handleWithdrawFromBox(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        if (args.length === 0) return '❌ الاستخدام: اسحب_صندوق [المبلغ]';

        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount <= 0) return '❌ مبلغ غير صالح.';

        const box = await Settings.get('economyBox', 0);

        if (box < amount) {
            return `❌ الصندوق لا يحتوي على مبلغ كافٍ.\n\n💰 الصندوق: ${box} ريو`;
        }

        await Settings.set('economyBox', box - amount);
        player.gold += amount;
        player.addTransaction('admin_add', amount, `سحب من الصندوق`, 'system');
        await player.save();

        return `✅ تم السحب من الصندوق

💰 المبلغ: ${amount} ريو
💎 رصيدك: ${player.gold} ريو
🏦 الصندوق المتبقي: ${box - amount} ريو`;
    }

    async handleDepositToBox(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        if (args.length === 0) return '❌ الاستخدام: ايداع_صندوق [المبلغ]';

        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount <= 0) return '❌ مبلغ غير صالح.';

        if (player.gold < amount) {
            return `❌ رصيدك غير كافٍ.\n\n💰 رصيدك: ${player.gold} ريو`;
        }

        const box = await Settings.get('economyBox', 0);

        player.gold -= amount;
        player.addTransaction('admin_remove', amount, `إيداع في الصندوق`, 'system');
        await Settings.set('economyBox', box + amount);
        await player.save();

        return `✅ تم الإيداع في الصندوق

💰 المبلغ: ${amount} ريو
💎 رصيدك: ${player.gold} ريو
🏦 الصندوق الجديد: ${box + amount} ريو`;
    }

    // ===================================
    // الإعدادات
    // ===================================

    async handleShowSettings(player) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        const settingsSystem = await this.getSystem('settings');
        if (!settingsSystem) return '❌ نظام الإعدادات غير متوفر.';

        return await settingsSystem.showAll();
    }

    async handleEditSetting(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص للمدراء فقط.';

        if (args.length < 2) return '❌ الاستخدام: تعديل_اعداد [المفتاح] [القيمة]';

        const key = args[0];
        let value = args.slice(1).join(' ');

        // تحويل الأرقام
        if (!isNaN(value) && value !== '') {
            value = parseFloat(value);
        }

        // true/false
        if (value === 'true' || value === 'صحيح') value = true;
        if (value === 'false' || value === 'خطأ') value = false;

        const settingsSystem = await this.getSystem('settings');
        if (!settingsSystem) return '❌ نظام الإعدادات غير متوفر.';

        await settingsSystem.set(key, value, player.name);

        return `✅ تم تعديل الإعداد

⚙️ المفتاح: ${key}
📊 القيمة الجديدة: ${value}`;
    }

    async handleDeleteSetting(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر خاص بالمدراء فقط.';

        if (args.length === 0) return '❌ الاستخدام: حذف_اعداد [المفتاح]';

        const settingsSystem = await this.getSystem('settings');
        if (!settingsSystem) return '❌ نظام الإعدادات غير متوفر.';

        const result = await settingsSystem.remove(args[0]);
        return result.error || result.message;
    }
}
