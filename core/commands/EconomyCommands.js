// core/commands/EconomyCommands.js
// الموقع: سوق ريو
import { BaseCommand } from './BaseCommand.js';

export class EconomyCommands extends BaseCommand {
    getCommands() {
        return {
            // ====== الرصيد ======
            'رصيد': this.handleBalance.bind(this),
            'رصيدي': this.handleBalance.bind(this),
            'بطاقة': this.handleCard.bind(this),
            'بطاقتي': this.handleCard.bind(this),
            'معاملاتي': this.handleTransactions.bind(this),
            'سجلي': this.handleTransactions.bind(this),

            // ====== المتجر ======
            'متجر': this.handleShop.bind(this),
            'المتجر': this.handleShop.bind(this),
            'منتجات': this.handleShop.bind(this),
            'منتج': this.handleProductInfo.bind(this),
            'شراء': this.handlePurchase.bind(this),
            'اشتري': this.handlePurchase.bind(this),
            'اشتر': this.handlePurchase.bind(this),

            // ====== التحويل ======
            'تحويل': this.handleTransfer.bind(this),
            'حول': this.handleTransfer.bind(this),

            // ====== الأكواد ======
            'هدية': this.handleGiftCode.bind(this),
            'كود': this.handleGiftCode.bind(this),
            'خصم': this.handleDiscountCode.bind(this),
            'كوبون': this.handleDiscountCode.bind(this),

            // ====== أوامر الأدمن الاقتصادية ======
            'اضف_رصيد': this.handleAddBalance.bind(this),
            'اسحب_رصيد': this.handleRemoveBalance.bind(this),
            'تعديل_رصيد': this.handleSetBalance.bind(this),
            'اضف_منتج': this.handleAddProduct.bind(this),
            'حذف_منتج': this.handleRemoveProduct.bind(this),
            'تعديل_منتج': this.handleEditProduct.bind(this),
            'قائمة_المنتجات': this.handleListProducts.bind(this),
            'اضف_مخزون': this.handleAddStock.bind(this),
            'اضف_كود': this.handleAddGiftCode.bind(this),
            'حذف_كود': this.handleRemoveGiftCode.bind(this),
            'قائمة_الاكواد': this.handleListGiftCodes.bind(this),
            'اضف_خصم': this.handleAddDiscountCode.bind(this),
            'حذف_خصم': this.handleRemoveDiscountCode.bind(this),
            'قائمة_الخصومات': this.handleListDiscountCodes.bind(this),
            'اقتصاد': this.handleEconomyStats.bind(this),
            'اغنياء': this.handleRichest.bind(this),
            'فقراء': this.handlePoorest.bind(this),
            'اقتصاد_لاعب': this.handlePlayerEconomy.bind(this),
            'معاملات_لاعب': this.handlePlayerTransactions.bind(this),
            'صندوق': this.handleBox.bind(this),
            'اسحب_صندوق': this.handleWithdrawBox.bind(this),
            'ايداع_صندوق': this.handleDepositBox.bind(this),
            'اعدادات': this.handleSettings.bind(this),
            'تعديل_اعداد': this.handleEditSetting.bind(this)
        };
    }

    // ===================================
    // الرصيد
    // ===================================
    async handleBalance(player) {
        const check = await this.checkPlayerStatus(player);
        if (check.error) return check.error;

        const gameUrl = this.commandHandler?.gamePageUrl || 'https://facebook.com/MgaraRio';

        return `💰 رصيدك في سوق ريو

👤 ${player.username || player.name}
🆔 ${player.playerId || 'N/A'}
💎 الرصيد: ${player.gold} ريو

🎮 اجمع المزيد من الريو في مغارة ريو:
${gameUrl}

💡 استخدم "متجر" لرؤية المنتجات`;
    }

    async handleCard(player) {
        const check = await this.checkPlayerStatus(player);
        if (check.error) return check.error;

        try {
            const cardGen = this.commandHandler.cardGenerator;
            if (!cardGen) return '❌ نظام البطاقة غير متوفر.';
            
            const path = await cardGen.generateCard(player);
            return {
                type: 'image',
                path,
                caption: `💳 بطاقة رصيدك يا ${player.username || player.name}`
            };
        } catch (error) {
            return this.handleError(error, 'إنشاء البطاقة');
        }
    }

    async handleTransactions(player) {
        const check = await this.checkPlayerStatus(player);
        if (check.error) return check.error;

        const txs = (player.transactions || [])
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 15);

        if (txs.length === 0) return `📋 لا توجد معاملات.`;

        let msg = `📋 سجل المعاملات (${txs.length})\n`;
        txs.forEach(tx => {
            const date = new Date(tx.createdAt).toLocaleDateString('ar-EG');
            const icon = tx.type === 'deposit' ? '📥' :
                         tx.type === 'purchase' ? '🛒' :
                         tx.type === 'transfer_sent' ? '➡️' :
                         tx.type === 'transfer_received' ? '⬅️' :
                         tx.type === 'gift_code' ? '🎁' : '📌';
            const sign = ['purchase', 'transfer_sent', 'withdrawal'].includes(tx.type) ? '-' : '+';
            msg += `\n${icon} ${tx.description}\n   💰 ${sign}${tx.amount} ريو\n   📅 ${date}\n`;
        });
        return msg;
    }

    // ===================================
    // المتجر
    // ===================================
    async handleShop(player, args) {
        const check = await this.checkPlayerStatus(player);
        if (check.error) return check.error;

        const shopSystem = await this.getSystem('shop');
        if (!shopSystem) return '❌ نظام المتجر غير متوفر.';

        const page = parseInt(args[0]) || 1;
        return await shopSystem.showShop(page);
    }

    async handleProductInfo(player, args) {
        const check = await this.checkPlayerStatus(player);
        if (check.error) return check.error;

        if (args.length === 0) {
            return `❌ اكتب اسم المنتج أو ID

مثال:
• منتج تصميم
• منتج fire_sword

💡 للعرض الكامل: متجر`;
        }

        const shopSystem = await this.getSystem('shop');
        if (!shopSystem) return '❌ نظام المتجر غير متوفر.';

        return await shopSystem.showProduct(args.join(' '));
    }

    async handlePurchase(player, args) {
        const check = await this.checkPlayerStatus(player);
        if (check.error) return check.error;

        if (args.length === 0) {
            return `❌ اكتب اسم المنتج

مثال:
• شراء تصميم
• شراء fire_sword
• شراء تصميم 3 (لشراء 3)

💡 للعرض: متجر`;
        }

        let quantity = 1;
        let productQuery = args.join(' ');

        // ✅ فحص إذا كان آخر جزء رقم = كمية
        const lastArg = args[args.length - 1];
        if (!isNaN(lastArg) && args.length > 1) {
            quantity = parseInt(lastArg);
            productQuery = args.slice(0, -1).join(' ');
            
            if (quantity <= 0 || quantity > 100) {
                return '❌ الكمية يجب أن تكون بين 1 و 100.';
            }
        }

        const shopSystem = await this.getSystem('shop');
        if (!shopSystem) return '❌ نظام المتجر غير متوفر.';

        // ✅ إذا كانت الكمية غير محددة، اسأل اللاعب
        if (args.length === 1 && quantity === 1) {
            // فحص وجود منتج
            const product = await shopSystem._findProduct(productQuery);
            
            if (!product) {
                return `❌ لم يتم العثور على المنتج: "${productQuery}"\n\n💡 للعرض: متجر`;
            }

            // إذا كان المنتج من نوع "game_item" أو "external" وليس حدث/اشتراك
            if (product.type === 'game_item' || product.type === 'external') {
                return `🛒 ${product.name}

💰 السعر: ${product.price} ريو
📦 المتاح: ${product.stock === null ? '♾️' : product.stock}

❓ كم تريد أن تشتري؟

💡 اكتب:
• شراء ${product.name} 1
• شراء ${product.name} 2
• ...الخ`;
            }
        }

        const result = await shopSystem.purchase(player, productQuery, quantity);
        return result.error || result.message;
    }

    // ===================================
    // التحويل
    // ===================================
    async handleTransfer(player, args) {
        const check = await this.checkPlayerStatus(player);
        if (check.error) return check.error;

        if (args.length < 2) {
            return `❌ الاستخدام: تحويل [الاسم] [المبلغ]

مثال:
• تحويل Ahmed 500
• تحويل Sara 1000`;
        }

        const amount = parseInt(args[args.length - 1]);
        const targetName = args.slice(0, -1).join(' ');

        if (isNaN(amount) || amount <= 0) return '❌ مبلغ غير صالح.';

        const Settings = (await import('../models/Settings.js')).default;
        const Player = (await import('../models/Player.js')).default;

        const minTransfer = await Settings.get('minTransfer', 100);
        const maxTransfer = await Settings.get('maxTransfer', 100000);
        const feePercent = await Settings.get('transferFee', 5);

        if (amount < minTransfer) return `❌ الحد الأدنى: ${minTransfer} ريو`;
        if (amount > maxTransfer) return `❌ الحد الأقصى: ${maxTransfer} ريو`;

        const fee = Math.floor(amount * (feePercent / 100));
        const totalDeduction = amount + fee;

        if (player.gold < totalDeduction) {
            return `❌ رصيدك غير كافٍ!\n\n💰 رصيدك: ${player.gold}\n💸 المبلغ: ${amount}\n💵 الرسوم: ${fee}\n📊 الإجمالي: ${totalDeduction}`;
        }

        const target = await Player.findByIdentifier(targetName);
        if (!target) return `❌ لم يتم العثور على اللاعب: ${targetName}`;
        if (target.userId === player.userId) return '❌ لا يمكنك التحويل لنفسك!';
        if (target.banned) return '❌ اللاعب محظور.';

        player.gold -= totalDeduction;
        target.gold += amount;

        player.addTransaction('transfer_sent', amount, `تحويل إلى ${target.username}`, target.username);
        target.addTransaction('transfer_received', amount, `تحويل من ${player.username}`, player.username);

        const box = await Settings.get('economyBox', 0);
        await Settings.set('economyBox', box + fee);

        await player.save();
        await target.save();

        return `✅ تم التحويل

📤 من: ${player.username}
📥 إلى: ${target.username}
💸 المبلغ: ${amount} ريو
💵 الرسوم: ${fee} ريو
💰 رصيدك الجديد: ${player.gold} ريو`;
    }

    // ===================================
    // الأكواد
    // ===================================
    async handleGiftCode(player, args) {
        const check = await this.checkPlayerStatus(player);
        if (check.error) return check.error;

        if (args.length === 0) return '❌ اكتب كود الهدية. مثال: هدية WELCOME';

        const sys = await this.getSystem('giftcode');
        if (!sys) return '❌ نظام الأكواد غير متوفر.';

        return await sys.redeemCode(player, args[0]);
    }

    async handleDiscountCode(player, args) {
        const check = await this.checkPlayerStatus(player);
        if (check.error) return check.error;

        if (args.length === 0) {
            if (player.appliedDiscount?.code) {
                return `🎟️ خصم مطبق: ${player.appliedDiscount.code}\n📊 ${player.appliedDiscount.percentage}%`;
            }
            return '❌ اكتب كود الخصم. مثال: خصم SAVE20';
        }

        const sys = await this.getSystem('discountcode');
        if (!sys) return '❌ نظام الأكواد غير متوفر.';

        const result = await sys.applyDiscount(player, args[0]);
        return result.error || result.message;
    }

    // ===================================
    // أوامر الأدمن
    // ===================================
    async isAdmin(player) {
        return await this.commandHandler.adminSystem.isAdminAsync(player.userId);
    }

    async handleAddBalance(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';
        if (args.length < 2) return '❌ الاستخدام: اضف_رصيد [ID] [المبلغ]';

        const Player = (await import('../models/Player.js')).default;
        const target = await Player.findByIdentifier(args[0]);
        const amount = parseInt(args[1]);

        if (!target || isNaN(amount) || amount <= 0) return '❌ بيانات غير صالحة.';

        target.gold += amount;
        target.addTransaction('admin_add', amount, `إضافة من الإدارة`, player.username);
        await target.save();

        return `✅ تمت إضافة ${amount} ريو إلى ${target.username}`;
    }

    async handleRemoveBalance(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';
        if (args.length < 2) return '❌ الاستخدام: اسحب_رصيد [ID] [المبلغ]';

        const Player = (await import('../models/Player.js')).default;
        const target = await Player.findByIdentifier(args[0]);
        const amount = parseInt(args[1]);

        if (!target || isNaN(amount) || amount <= 0) return '❌ بيانات غير صالحة.';
        if (target.gold < amount) return '❌ رصيد اللاعب غير كافٍ.';

        target.gold -= amount;
        target.addTransaction('admin_remove', amount, `خصم من الإدارة`, player.username);
        await target.save();

        return `✅ تم خصم ${amount} ريو من ${target.username}`;
    }

    async handleSetBalance(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';
        if (args.length < 2) return '❌ الاستخدام: تعديل_رصيد [ID] [المبلغ]';

        const Player = (await import('../models/Player.js')).default;
        const target = await Player.findByIdentifier(args[0]);
        const amount = parseInt(args[1]);

        if (!target || isNaN(amount) || amount < 0) return '❌ بيانات غير صالحة.';

        const old = target.gold;
        target.gold = amount;
        target.addTransaction('admin_add', Math.abs(amount - old), `تعديل من الإدارة`, player.username);
        await target.save();

        return `✅ تم تعديل الرصيد من ${old} إلى ${amount}`;
    }

    async handleAddProduct(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';
        if (args.length < 4) {
            return `❌ الاستخدام: اضف_منتج [ID] [الاسم] [السعر] [النوع]

📝 الأنواع:
• لعبة - منتج لعبة
• خارجي - منتج خارجي
• بطاقة - بطاقة حدث
• اشتراك - اشتراك`;
        }

        const shopSystem = await this.getSystem('shop');
        if (!shopSystem) return '❌ نظام المتجر غير متوفر.';

        const [productId, name, priceStr, rawType] = args;
        const price = parseInt(priceStr);

        if (isNaN(price) || price <= 0) return '❌ سعر غير صالح.';

        let type = 'game_item';
        if (rawType === 'خارجي' || rawType === 'external') type = 'external';
        else if (rawType === 'بطاقة' || rawType === 'event') type = 'event_ticket';
        else if (rawType === 'اشتراك' || rawType === 'subscription') type = 'subscription';
        else if (rawType === 'لعبة' || rawType === 'game_item') type = 'game_item';
        else return '❌ النوع غير صالح.';

        const productData = {
            id: productId,
            name,
            description: '',
            price,
            type,
            stock: null,
            isActive: true,
            displayOrder: 0
        };

        if (type === 'game_item') {
            productData.gameItemId = args[4] || productId;
            productData.gameItemQuantity = parseInt(args[5]) || 1;
        } else if (type === 'external') {
            productData.deliveryMessage = args[4] || 'راسل الإدارة للتسليم';
            productData.deliveryLink = args[5] || process.env.ADMIN_PROFILE_URL || '';
        } else if (type === 'event_ticket') {
            productData.ticketEventName = args[4] || name;
        } else if (type === 'subscription') {
            productData.subName = args[4] || name;
            productData.subPrice = price;
            productData.subInterval = args[5] || 'monthly';
        }

        return await shopSystem.addProduct(productData, player.userId);
    }

    async handleRemoveProduct(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';
        if (args.length === 0) return '❌ الاستخدام: حذف_منتج [ID أو الاسم]';

        const shopSystem = await this.getSystem('shop');
        if (!shopSystem) return '❌ نظام المتجر غير متوفر.';

        return await shopSystem.removeProduct(args.join(' '));
    }

    async handleEditProduct(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';
        if (args.length < 3) return '❌ الاستخدام: تعديل_منتج [ID] [الحقل] [القيمة]';

        const shopSystem = await this.getSystem('shop');
        if (!shopSystem) return '❌ نظام المتجر غير متوفر.';

        return await shopSystem.editProduct(args[0], args[1], args.slice(2).join(' '));
    }

    async handleListProducts(player) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';

        const shopSystem = await this.getSystem('shop');
        if (!shopSystem) return '❌ نظام المتجر غير متوفر.';

        return await shopSystem.listAllProducts();
    }

    async handleAddStock(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';
        if (args.length < 2) return '❌ الاستخدام: اضف_مخزون [ID أو الاسم] [الكمية]';

        const shopSystem = await this.getSystem('shop');
        if (!shopSystem) return '❌ نظام المتجر غير متوفر.';

        const quantity = parseInt(args[args.length - 1]);
        const productQuery = args.slice(0, -1).join(' ');

        return await shopSystem.addStock(productQuery, quantity);
    }

    async handleAddGiftCode(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';
        if (args.length < 3) return `❌ الاستخدام: اضف_كود [الكود] [المبلغ] [الاستخدامات] [المدة بالساعات]`;

        const sys = await this.getSystem('giftcode');
        if (!sys) return '❌ نظام الأكواد غير متوفر.';

        const [code, amountStr, usesStr, hoursStr] = args;
        const result = await sys.createCode(
            code,
            parseInt(amountStr),
            parseInt(usesStr),
            hoursStr ? parseFloat(hoursStr) : null,
            player.username
        );
        return result.error || result.message;
    }

    async handleRemoveGiftCode(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';
        if (args.length === 0) return '❌ الاستخدام: حذف_كود [الكود]';

        const sys = await this.getSystem('giftcode');
        if (!sys) return '❌ نظام الأكواد غير متوفر.';

        return await sys.removeCode(args[0]);
    }

    async handleListGiftCodes(player) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';

        const sys = await this.getSystem('giftcode');
        if (!sys) return '❌ نظام الأكواد غير متوفر.';

        return await sys.listAllCodes();
    }

    async handleAddDiscountCode(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';
        if (args.length < 3) return '❌ الاستخدام: اضف_خصم [الكود] [النسبة] [الاستخدامات] [المدة]';

        const sys = await this.getSystem('discountcode');
        if (!sys) return '❌ نظام الأكواد غير متوفر.';

        const [code, pctStr, usesStr, hoursStr] = args;
        const result = await sys.createCode(
            code,
            parseInt(pctStr),
            parseInt(usesStr),
            hoursStr ? parseFloat(hoursStr) : null,
            player.username
        );
        return result.error || result.message;
    }

    async handleRemoveDiscountCode(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';
        if (args.length === 0) return '❌ الاستخدام: حذف_خصم [الكود]';

        const sys = await this.getSystem('discountcode');
        if (!sys) return '❌ نظام الأكواد غير متوفر.';

        return await sys.removeCode(args[0]);
    }

    async handleListDiscountCodes(player) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';

        const sys = await this.getSystem('discountcode');
        if (!sys) return '❌ نظام الأكواد غير متوفر.';

        return await sys.listAllCodes();
    }

    async handleEconomyStats(player) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';

        const sys = await this.getSystem('economy');
        if (!sys) return '❌ نظام الاقتصاد غير متوفر.';

        return await sys.showEconomyStats();
    }

    async handleRichest(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';

        const sys = await this.getSystem('economy');
        if (!sys) return '❌ نظام الاقتصاد غير متوفر.';

        return await sys.showRichestPlayers(parseInt(args[0]) || 1);
    }

    async handlePoorest(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';

        const sys = await this.getSystem('economy');
        if (!sys) return '❌ نظام الاقتصاد غير متوفر.';

        return await sys.showPoorestPlayers(parseInt(args[0]) || 1);
    }

    async handlePlayerEconomy(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';
        if (args.length === 0) return '❌ الاستخدام: اقتصاد_لاعب [الاسم]';

        const sys = await this.getSystem('economy');
        if (!sys) return '❌ نظام الاقتصاد غير متوفر.';

        return await sys.showPlayerEconomy(args.join(' '));
    }

    async handlePlayerTransactions(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';
        if (args.length === 0) return '❌ الاستخدام: معاملات_لاعب [الاسم] [صفحة]';

        const sys = await this.getSystem('economy');
        if (!sys) return '❌ نظام الاقتصاد غير متوفر.';

        const page = parseInt(args[args.length - 1]) || 1;
        const name = isNaN(parseInt(args[args.length - 1])) ? args.join(' ') : args.slice(0, -1).join(' ');

        return await sys.showPlayerTransactions(name, page);
    }

    // ===================================
    // الصندوق
    // ===================================
    async handleBox(player) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';

        const Settings = (await import('../models/Settings.js')).default;
        const box = await Settings.get('economyBox', 0);
        const fee = await Settings.get('transferFee', 5);

        return `🏦 صندوق الاقتصاد\n\n💰 الرصيد: ${box} ريو\n📊 نسبة الرسوم: ${fee}%`;
    }

    async handleWithdrawBox(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';
        if (args.length === 0) return '❌ الاستخدام: اسحب_صندوق [المبلغ]';

        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount <= 0) return '❌ مبلغ غير صالح.';

        const Settings = (await import('../models/Settings.js')).default;
        const box = await Settings.get('economyBox', 0);
        if (box < amount) return `❌ الصندوق لا يحتوي على مبلغ كافٍ. الرصيد: ${box}`;

        await Settings.set('economyBox', box - amount);
        player.gold += amount;
        player.addTransaction('admin_add', amount, `سحب من الصندوق`, 'system');
        await player.save();

        return `✅ تم السحب\n💰 المبلغ: ${amount}\n💎 رصيدك: ${player.gold}\n🏦 الصندوق: ${box - amount}`;
    }

    async handleDepositBox(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';
        if (args.length === 0) return '❌ الاستخدام: ايداع_صندوق [المبلغ]';

        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount <= 0) return '❌ مبلغ غير صالح.';
        if (player.gold < amount) return '❌ رصيدك غير كافٍ.';

        const Settings = (await import('../models/Settings.js')).default;
        const box = await Settings.get('economyBox', 0);

        player.gold -= amount;
        player.addTransaction('admin_remove', amount, `إيداع في الصندوق`, 'system');
        await Settings.set('economyBox', box + amount);
        await player.save();

        return `✅ تم الإيداع\n💰 المبلغ: ${amount}\n💎 رصيدك: ${player.gold}\n🏦 الصندوق: ${box + amount}`;
    }

    // ===================================
    // الإعدادات
    // ===================================
    async handleSettings(player) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';

        const sys = await this.getSystem('settings');
        if (!sys) return '❌ نظام الإعدادات غير متوفر.';

        return await sys.showAll();
    }

    async handleEditSetting(player, args) {
        if (!await this.isAdmin(player)) return '❌ هذا الأمر للمدراء فقط.';
        if (args.length < 2) return '❌ الاستخدام: تعديل_اعداد [المفتاح] [القيمة]';

        const key = args[0];
        let value = args.slice(1).join(' ');
        if (!isNaN(value) && value !== '') value = parseFloat(value);
        if (value === 'true' || value === 'صحيح') value = true;
        if (value === 'false' || value === 'خطأ') value = false;

        const sys = await this.getSystem('settings');
        if (!sys) return '❌ نظام الإعدادات غير متوفر.';

        await sys.set(key, value, player.username);

        return `✅ تم تعديل الإعداد\n⚙️ ${key} = ${value}`;
    }
    }
