// systems/economy/ShopSystem.js
// الموقع: سوق ريو
import ShopItem from '../../core/models/ShopItem.js';
import DiscountCode from '../../core/models/DiscountCode.js';
import Player from '../../core/models/Player.js';
import Settings from '../../core/models/Settings.js';
import { DataLoader } from '../data/DataLoader.js';

export class ShopSystem {
    constructor() {
        this.ITEMS = DataLoader.getItems() || {};
        this.RESOURCES = DataLoader.getResources() || {};
        this.commandHandler = null;
        console.log('🛒 نظام المتجر تم تهيئته');
    }

    setCommandHandler(handler) {
        this.commandHandler = handler;
        // تحديث البيانات
        this.ITEMS = DataLoader.getItems() || {};
        this.RESOURCES = DataLoader.getResources() || {};
    }

    // ✅ ترجمة اسم عنصر
    _translateItemName(itemId) {
        if (this.RESOURCES[itemId]?.name) return this.RESOURCES[itemId].name;
        if (this.ITEMS[itemId]?.name) return this.ITEMS[itemId].name;
        return itemId;
    }

    // ===================================
    // العرض
    // ===================================

    // ✅ عرض المتجر
    async showShop(page = 1) {
        const perPage = await Settings.get('shopPageSize', 10);

        const totalItems = await ShopItem.countDocuments({ isActive: true });

        if (totalItems === 0) {
            return `🛒 المتجر

❌ لا توجد منتجات حالياً.

💡 تابع قناة الإعلانات لمعرفة المنتجات الجديدة!`;
        }

        const totalPages = Math.ceil(totalItems / perPage);
        if (page < 1 || page > totalPages) {
            return `❌ الصفحة ${page} غير موجودة.

📄 إجمالي الصفحات: ${totalPages}`;
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
                ? '♾️ غير محدود' 
                : p.stock > 0 ? `${p.stock} متاح` : '❌ نفذ';
            
            const typeIcon = p.type === 'game_item' ? '🎮' :
                            p.type === 'external' ? '🎁' :
                            p.type === 'event_ticket' ? '🎫' :
                            p.type === 'subscription' ? '📅' : '📦';
            
            msg += `${globalIndex}. ${typeIcon} ${p.name}\n`;
            msg += `   💰 السعر: ${p.price} ريو\n`;
            msg += `   📦 المخزون: ${stockStr}\n`;
            if (p.description) msg += `   📝 ${p.description}\n`;
            msg += `\n`;
        });

        msg += `━━━━━━━━━━━━━━━\n`;
        msg += `💡 للشراء: شراء [اسم المنتج]\n`;
        msg += `💡 لتفاصيل منتج: منتج [اسم المنتج]\n`;
        if (totalPages > 1) {
            msg += `💡 للتنقل: متجر [رقم الصفحة]\n`;
        }

        return msg;
    }

    // ✅ عرض تفاصيل منتج
    async showProduct(productQuery) {
        const product = await this._findProduct(productQuery);

        if (!product) {
            return `❌ لم يتم العثور على المنتج: "${productQuery}"

💡 للعرض: متجر`;
        }

        const stockStr = product.stock === null 
            ? '♾️ غير محدود' 
            : product.stock > 0 ? `${product.stock} متاح` : '❌ نفذ';

        const typeStr = product.type === 'game_item' ? '🎮 منتج لعبة' :
                        product.type === 'external' ? '🎁 منتج خارجي' :
                        product.type === 'event_ticket' ? '🎫 بطاقة حدث' :
                        product.type === 'subscription' ? '📅 اشتراك' : '📦 منتج';

        let msg = `🛒 ${product.name}\n\n`;
        msg += `📝 ${product.description || 'لا يوجد وصف'}\n\n`;
        msg += `💰 السعر: ${product.price} ريو\n`;
        msg += `📦 المخزون: ${stockStr}\n`;
        msg += `🏷️ النوع: ${typeStr}\n`;
        msg += `📊 المبيعات: ${product.totalSold}\n\n`;
        
        msg += `💡 للشراء: شراء ${product.name}`;

        return msg;
    }

    // ===================================
    // البحث عن منتج
    // ===================================
    async _findProduct(query) {
        if (!query) return null;
        
        const clean = query.trim();

        // 1. بالـ ID
        let product = await ShopItem.findOne({ id: clean });
        if (product) return product;

        // 2. بالاسم (تام)
        product = await ShopItem.findOne({ 
            name: { $regex: new RegExp(`^${clean}$`, 'i') } 
        });
        if (product) return product;

        // 3. بالاسم (جزئي)
        product = await ShopItem.findOne({ 
            name: { $regex: new RegExp(clean, 'i') } 
        });
        return product;
    }

    // ===================================
    // الشراء
    // ===================================
    async purchase(player, productQuery, quantity = 1) {
        const product = await this._findProduct(productQuery);

        if (!product) {
            return { error: `❌ لم يتم العثور على المنتج: "${productQuery}"` };
        }

        if (!product.isAvailable()) {
            return { error: `❌ ${product.name} غير متوفر حالياً.` };
        }

        // ✅ فحص المخزون
        if (product.stock !== null && product.stock < quantity) {
            return { error: `❌ الكمية المطلوبة غير متوفرة.\n\n📦 المتاح: ${product.stock}` };
        }

        // ✅ حساب السعر النهائي
        const totalPrice = product.price * quantity;
        let finalPrice = totalPrice;
        let discountMsg = '';
        let appliedDiscountCode = null;

        if (player.appliedDiscount?.code && player.appliedDiscount.percentage > 0) {
            if (player.appliedDiscount.expiresAt && player.appliedDiscount.expiresAt < new Date()) {
                player.appliedDiscount = { code: null, percentage: 0, expiresAt: null };
            } else {
                const codeDoc = await DiscountCode.findOne({ code: player.appliedDiscount.code });
                
                if (codeDoc && codeDoc.isActive) {
                    const calc = codeDoc.calculateDiscount(totalPrice);
                    
                    if (!calc.error) {
                        finalPrice = calc.finalPrice;
                        appliedDiscountCode = codeDoc;
                        discountMsg = `\n🎟️ الخصم: ${codeDoc.percentage}% (-${calc.discount} ريو)`;
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

        // ✅ خصم الرصيد
        player.gold -= finalPrice;

        // ✅ خصم المخزون
        if (product.stock !== null) {
            product.stock -= quantity;
        }
        product.totalSold += quantity;
        await product.save();

        // ✅ استخدام الخصم
        if (appliedDiscountCode) {
            await appliedDiscountCode.use();
            player.appliedDiscount = { code: null, percentage: 0, expiresAt: null };
        }

        // ✅ تسليم المنتج
        let deliveryMsg = '';

        if (product.type === 'game_item') {
            const itemInfo = this.ITEMS[product.gameItemId] || { 
                name: this._translateItemName(product.gameItemId),
                type: 'item'
            };
            
            player.inventory = player.inventory || [];
            const existing = player.inventory.find(i => i.id === product.gameItemId);
            const totalQty = (product.gameItemQuantity || 1) * quantity;
            
            if (existing) {
                existing.quantity += totalQty;
            } else {
                player.inventory.push({
                    id: product.gameItemId,
                    name: itemInfo.name,
                    type: itemInfo.type || 'item',
                    quantity: totalQty
                });
            }
            
            deliveryMsg = `\n\n📦 تم إضافة: ${totalQty} × ${itemInfo.name}`;
        } else if (product.type === 'event_ticket') {
            // ✅ بطاقة حدث
            const ticket = {
                eventName: product.ticketEventName || product.name,
                productId: product.id,
                boughtAt: new Date(),
                price: finalPrice
            };
            
            player.eventTickets = player.eventTickets || [];
            player.eventTickets.push(ticket);
            
            deliveryMsg = `\n\n🎫 تم تسجيلك في: ${ticket.eventName}`;
        } else if (product.type === 'subscription') {
            // ✅ اشتراك
            const sub = {
                name: product.subName || product.name,
                productId: product.id,
                price: product.subPrice || product.price,
                interval: product.subInterval || 'monthly',
                startedAt: new Date(),
                lastPaidAt: new Date(),
                nextPayment: this._calcNextPayment(product.subInterval || 'monthly')
            };
            
            player.subscriptions = player.subscriptions || [];
            // إزالة أي اشتراك قديم بنفس الاسم
            player.subscriptions = player.subscriptions.filter(s => s.name !== sub.name);
            player.subscriptions.push(sub);
            
            deliveryMsg = `\n\n📅 تم تفعيل اشتراك: ${sub.name}`;
        } else {
            // ✅ منتج خارجي
            const adminLink = process.env.ADMIN_PROFILE_URL || 'https://facebook.com/';
            const deliveryText = product.deliveryMessage || 'راسل الإدارة للتسليم';
            const deliveryLink = product.deliveryLink || adminLink;
            const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
            
            deliveryMsg = `\n\n📩 للتسليم:\n${deliveryText}\n\n🔗 ${deliveryLink}\n\n📌 رقم طلبك: ${orderId}`;
        }

        // ✅ معاملة
        player.addTransaction('purchase', finalPrice, `شراء: ${product.name}${quantity > 1 ? ` ×${quantity}` : ''}`);

        await player.save();

        return {
            success: true,
            message: `✅ تم الشراء بنجاح!

🛒 المنتج: ${product.name}${quantity > 1 ? `\n📦 الكمية: ${quantity}` : ''}
💵 المدفوع: ${finalPrice} ريو${discountMsg}
💰 رصيدك الجديد: ${player.gold} ريو${deliveryMsg}`
        };
    }

    _calcNextPayment(interval) {
        const next = new Date();
        if (interval === 'weekly') {
            next.setDate(next.getDate() + 7);
        } else if (interval === 'monthly') {
            next.setMonth(next.getMonth() + 1);
        } else if (interval === 'daily') {
            next.setDate(next.getDate() + 1);
        }
        return next;
    }

    // ===================================
    // أوامر الأدمن
    // ===================================
    async addProduct(data, adminId) {
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
            message: `✅ تم إضافة المنتج

🛒 ${product.name}
🆔 ${product.id}
💰 ${product.price} ريو
📦 ${product.stock === null ? '♾️' : product.stock}`
        };
    }

    async removeProduct(productQuery) {
        const product = await this._findProduct(productQuery);
        if (!product) {
            return { error: `❌ المنتج غير موجود.` };
        }

        const name = product.name;
        await ShopItem.deleteOne({ id: product.id });

        return {
            success: true,
            message: `✅ تم حذف المنتج: ${name}`
        };
    }

    async editProduct(productQuery, field, value) {
        const product = await this._findProduct(productQuery);
        if (!product) return { error: `❌ المنتج غير موجود.` };

        const allowedFields = ['name', 'description', 'price', 'stock', 'isActive', 
                               'deliveryMessage', 'deliveryLink', 'displayOrder'];

        if (!allowedFields.includes(field)) {
            return { error: `❌ الحقل غير قابل للتعديل: ${field}` };
        }

        if (field === 'price' || field === 'stock' || field === 'displayOrder') {
            value = parseInt(value);
            if (isNaN(value)) return { error: '❌ قيمة غير صالحة.' };
        }
        if (field === 'isActive') {
            value = value === 'true' || value === '1' || value === 'صحيح';
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
            msg += `   💰 ${p.price} ريو | 📦 ${stockStr}\n`;
            msg += `   🏷️ ${p.type} | 🆔 ${p.id}\n\n`;
        });

        return msg;
    }

    async addStock(productQuery, quantity) {
        const product = await this._findProduct(productQuery);
        if (!product) return { error: `❌ المنتج غير موجود.` };

        if (product.stock === null) {
            return { error: `❌ المنتج غير محدود - لا يحتاج مخزون.` };
        }

        product.stock += quantity;
        await product.save();

        return {
            success: true,
            message: `✅ تم إضافة ${quantity} للمخزون\n\n🛒 ${product.name}\n📦 المخزون: ${product.stock}`
        };
    }
                }
