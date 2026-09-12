// core/models/ShopItem.js
import mongoose from 'mongoose';

const shopItemSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    
    // ✅ نوع المنتج
    // 'game_item' = منتج لعبة (يُضاف للحقيبة)
    // 'external' = منتج خارجي (رابط + تسليم يدوي)
    type: { type: String, enum: ['game_item', 'external'], required: true },
    
    // ✅ الفئة (للعرض فقط)
    category: { 
        type: String, 
        enum: ['weapon', 'armor', 'accessory', 'tool', 'resource', 'potion', 'design', 'account', 'service', 'other'],
        default: 'other'
    },
    
    // ✅ المخزون
    // null = غير محدود
    // 0 = نفذ
    // > 0 = عدد متاح
    stock: { type: Number, default: null, min: 0 },
    
    // ✅ حالة التفعيل
    isActive: { type: Boolean, default: true },
    
    // ✅ لمنتجات اللعبة (type: 'game_item')
    gameItemId: { type: String, default: null },       // id من items.js
    gameItemQuantity: { type: Number, default: 1 },
    
    // ✅ للمنتجات الخارجية (type: 'external')
    deliveryMessage: { type: String, default: '' },     // رسالة التسليم
    deliveryLink: { type: String, default: '' },         // رابط الحساب
    
    // ✅ إحصائيات
    totalSold: { type: Number, default: 0 },
    
    // ✅ ترتيب العرض
    displayOrder: { type: Number, default: 0 }
}, { timestamps: true });

// ✅ فحص التوفر
shopItemSchema.methods.isAvailable = function() {
    if (!this.isActive) return false;
    if (this.stock === null) return true; // غير محدود
    return this.stock > 0;
};

// ✅ شراء منتج
shopItemSchema.methods.purchase = async function(quantity = 1) {
    if (!this.isAvailable()) {
        return { error: '❌ المنتج غير متوفر حالياً.' };
    }
    
    if (this.stock !== null && this.stock < quantity) {
        return { error: `❌ الكمية المطلوبة غير متوفرة. المتاح: ${this.stock}` };
    }
    
    // خصم من المخزون
    if (this.stock !== null) {
        this.stock -= quantity;
    }
    
    this.totalSold += quantity;
    await this.save();
    
    return { success: true };
};

const ShopItem = mongoose.models.ShopItem || mongoose.model('ShopItem', shopItemSchema);
export default ShopItem;
