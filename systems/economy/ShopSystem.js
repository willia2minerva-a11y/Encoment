// systems/economy/ShopSystem.js
import ShopItem from '../../core/models/ShopItem.js';
import DiscountCode from '../../core/models/DiscountCode.js';
import Player from '../../core/models/Player.js';
import Settings from '../../core/models/Settings.js';
import { items as ITEMS_DATA } from '../../data/items.js';
import { resources as RESOURCES_DATA } from '../../data/resources.js';

export class ShopSystem {
    constructor() {
        this.ITEMS = ITEMS_DATA;
        this.RESOURCES = RESOURCES_DATA;
        console.log('🛒 نظام المتجر تم تهيئته');
    }

    // ✅ ترجمة اسم عنصر
    _translateItemName(itemId) {
        if (this.RESOURCES[itemId]?.name) return this.RESOURCES[itemId].name;
        if (this.ITEMS[itemId]?.name) return this.ITEMS[itemId].name;
        return itemId;
    }

    // ✅ عرض المتجر
    async showShop(page = 1) {
        const perPage = await Settings.get('shopPageSize', 10);
        
        const totalItems = await ShopItem.countDocuments({ isActive: true });
        
        if (totalItems === 0) {
            return `🛒 المتجر\n\n❌ لا توجد منتجات حالياً.`;
        }

        const totalPages = Math.ceil(totalItems / perPage);
        if (page < 1 || page > totalPages) {
            return `❌ الصفحة ${page} غير موجودة. الإجمالي: ${totalPages}`;
        }

        const skip = (page - 1) * perPage;

        const products = await ShopItem.find({ isActive: true })
            .sort({ displayOrder: 1, price: 1 })
            .skip(skip)
            .limit(perPage);

        let msg = `🛒 المتجر - صفحة ${page}/${totalPages}\n\n`;

        products.forEach((p, index) => {
            const globalIndex = skip + index + 1;
            const stockStr = p.stock === null 
                ? '♾️' 
                : p.stock > 0 ? `${p.stock}` : '❌ نفذ';
            
            const typeIcon = p.type === 'game_item' ? '🎮' : '🎁';
            
            msg += `${globalIndex}. ${typeIcon} ${p.name}\n`;
            msg += `   💰 ${p.price} ريو\n`;
            msg += `   📦 المخزون: ${stockStr}\n`;
            if (p.description) msg += `   📝 ${p.description}\n`;
            msg += `   🆔 ID: ${p.id}\n\n`;
        });

        msg += `💡 للشراء: شراء [ID المنتج]`;
        msg += `\n💡 للتنقل: متجر [رقم الصفحة]`;

        return msg;
    }

    // ✅ عرض منتج واحد
    async showProduct(productId) {
        const product = await ShopItem.findOne({ id: productId });

        if (!product) {
            return `❌ المنتج غير موجود: ${productId}`;
        }

        const stockStr = product.stock === null 
            ? '♾️ غير محدود' 
            : product.stock > 0 ? `${product.stock} متاح` : '❌ نفذ';

        const typeStr = product.type === 'game_item' ? '🎮 منتج لعبة' : '🎁 منتج خارجي';

        let msg = `🛒 ${product.name}\n\n`;
        msg += `📝 ${product.description || 'لا يوجد وصف'}\n\n`;
        msg += `💰 السعر: ${product.price} ريو\n`;
        msg += `📦 المخزون: ${stockStr}\n`;
        msg += `🏷️ النوع: ${typeStr}\n`;
        msg += `📊 المبيعات: ${product.totalSold}\n\n`;
        
        msg += `💡 للشراء: شراء ${product.id}`;

        return msg;
    }

    // ✅ شراء منتج
    async purchase(player, productId) {
        const product = await ShopItem.findOne({ id: productId });

        if (!product) {
            return { error: `❌ المنتج غير موجود.` };
        }

        if (!product.isAvailable()) {
            return { error: `❌ ${product.name} غير متوفر حالياً.` };
        }

        // ✅ فحص الخصم المطبق
        let finalPrice = product.price;
        let discountMsg = '';
        let appliedDiscountCode = null;

        if (player.appliedDiscount?.code && player.appliedDiscount.percentage > 0) {
            // فحص الصلاحية
            if (player.appliedDiscount.expiresAt && player.appliedDiscount.expiresAt < new Date()) {
                // انتهى
                player.appliedDiscount = { code: null, percentage: 0, expiresAt: null };
            } else {
                const codeDoc = await DiscountCode.findOne({ code: player.appliedDiscount.code });
                
                if (codeDoc && codeDoc.isActive) {
                    const calc = codeDoc.calculateDiscount(product.price);
                    
                    if (!calc.error) {
                        finalPrice = calc.finalPrice;
                        appliedDiscountCode = codeDoc;
                        discountMsg = `\n🎟️ الخصم المطبق: ${codeDoc.percentage}% (-${calc.discount} ريو)\n💵 السعر النهائي: ${finalPrice} ريو`;
                    }
                }
            }
        }

        // ✅ فحص الرصيد
        if (player.gold < finalPrice) {
            return { 
                error: `❌ رصيدك غير كافٍ!\n\n💰 رصيدك: ${player.gold} ريو\n💵 المطلوب: ${finalPrice} ريو${discountMsg}` 
            };
        }

        // ✅ تنفيذ الشراء
        player.gold -= finalPrice;
        await product.purchase(1);

        // ✅ استخدام الخصم
        if (appliedDiscountCode) {
            await appliedDiscountCode.use();
            player.appliedDiscount = { code: null, percentage: 0, expiresAt: null };
        }

        // ✅ تسليم المنتج
        let deliveryMsg = '';

        if (product.type === 'game_item') {
            // منتج لعبة - يُضاف للحقيبة
            const itemInfo = this.ITEMS[product.gameItemId] || { 
                name: this._translateItemName(product.gameItemId),
                type: 'item'
            };
            
            player.inventory = player.inventory || [];
            const existing = player.inventory.find(i => i.id === product.gameItemId);
            
            if (existing) {
                existing.quantity += product.gameItemQuantity;
            } else {
                player.inventory.push({
                    id: product.gameItemId,
                    name: itemInfo.name,
                    type: itemInfo.type || 'item',
                    quantity: product.gameItemQuantity
                });
            }
            
            deliveryMsg = `\n📦 تم إضافة: ${product.gameItemQuantity} × ${itemInfo.name}`;
        } else {
            // منتج خارجي - يُرسل رابط التسليم
            const adminLink = process.env.ADMIN_PROFILE_URL || 'https://facebook.com/';
            const deliveryText = product.deliveryMessage || 'راسل الإدارة للتسليم';
            const deliveryLink = product.deliveryLink || adminLink;
            
            const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
            
            deliveryMsg = `\n\n📩 للتسليم:\n${deliveryText}\n\n🔗 الرابط:\n${deliveryLink}\n\n📌 رقم طلبك:\n${orderId}`;
        }

        // ✅ إضافة معاملة
        player.addTransaction('purchase', finalPrice, `شراء: ${product.name}`);

        await player.save();

        return {
            success: true,
            message: `✅ تم الشراء بنجاح!\n\n🛒 المنتج: ${product.name}\n💵 المدفوع: ${finalPrice} ريو${discountMsg}\n💰 رصيدك: ${player.gold} ريو${deliveryMsg}`
        };
    }

    // ===================================
    // إدارة المنتجات (للأدمن)
    // ===================================

    async addProduct(data, adminId) {
        // فحص id مكرر
        const existing = await ShopItem.findOne({ id: data.id });
        if (existing) {
            return { error: `❌ يوجد منتج بالمعرف: ${data.id}` };
        }

        const product = new ShopItem({
            ...data,
            displayOrder: data.displayOrder || 0
        });

        await product.save();

        return {
            success: true,
            message: `✅ تم إضافة المنتج\n\n🛒 الاسم: ${product.name}\n🆔 ID: ${product.id}\n💰 السعر: ${product.price} ريو\n📦 المخزون: ${product.stock === null ? '♾️' : product.stock}`
        };
    }

    async removeProduct(productId) {
        const product = await ShopItem.findOne({ id: productId });
        if (!product) {
            return { error: `❌ المنتج غير موجود.` };
        }

        await ShopItem.deleteOne({ id: productId });

        return {
            success: true,
            message: `✅ تم حذف المنتج: ${product.name}`
        };
    }

    async editProduct(productId, field, value) {
        const product = await ShopItem.findOne({ id: productId });
        if (!product) {
            return { error: `❌ المنتج غير موجود.` };
        }

        const allowedFields = ['name', 'description', 'price', 'stock', 'isActive', 'deliveryMessage', 'deliveryLink', 'displayOrder'];

        if (!allowedFields.includes(field)) {
            return { error: `❌ الحقل غير قابل للتعديل: ${field}` };
        }

        // تحويل القيم
        if (field === 'price' || field === 'stock' || field === 'displayOrder') {
            value = parseInt(value);
            if (isNaN(value)) return { error: '❌ قيمة غير صالحة.' };
        }
        if (field === 'isActive') {
            value = value === 'true' || value === '1' || value === 'صحيح';
        }
        if (field === 'stock' && value === 0) {
            // 0 = نفذ
        }

        product[field] = value;
        await product.save();

        return {
            success: true,
            message: `✅ تم تعديل المنتج\n\n🛒 ${product.name}\n📊 ${field} = ${value}`
        };
    }

    async listAllProducts() {
        const products = await ShopItem.find({}).sort({ displayOrder: 1, createdAt: -1 });

        if (products.length === 0) {
            return `📋 لا توجد منتجات.`;
        }

        let msg = `📋 قائمة المنتجات (${products.length})\n\n`;

        products.forEach((p, index) => {
            const stockStr = p.stock === null ? '♾️' : `${p.stock}`;
            const statusIcon = p.isActive ? '✅' : '❌';
            
            msg += `${index + 1}. ${statusIcon} ${p.name}\n`;
            msg += `   🆔 ${p.id}\n`;
            msg += `   💰 ${p.price} ريو\n`;
            msg += `   📦 ${stockStr}\n`;
            msg += `   🏷️ ${p.type}\n\n`;
        });

        return msg;
    }

    async addStock(productId, quantity) {
        const product = await ShopItem.findOne({ id: productId });
        if (!product) return { error: `❌ المنتج غير موجود.` };

        if (product.stock === null) {
            return { error: `❌ المنتج غير محدود - لا يحتاج مخزون.` };
        }

        product.stock += quantity;
        await product.save();

        return {
            success: true,
            message: `✅ تم إضافة ${quantity} للمخزون\n\n🛒 ${product.name}\n📦 المخزون الجديد: ${product.stock}`
        };
    }
}
