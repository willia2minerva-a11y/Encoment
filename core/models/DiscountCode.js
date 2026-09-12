// core/models/DiscountCode.js
import mongoose from 'mongoose';

const discountCodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    percentage: { type: Number, required: true, min: 1, max: 100 },
    
    // ✅ الاستخدامات
    maxUses: { type: Number, required: true, min: 1 },
    currentUses: { type: Number, default: 0 },
    
    // ✅ المدة (اختيارية)
    expiresAt: { type: Date, default: null },
    
    // ✅ من أنشأه
    createdBy: { type: String, default: null },
    
    // ✅ حالة التفعيل
    isActive: { type: Boolean, default: true },
    
    // ✅ الحد الأدنى للشراء (اختياري)
    minPurchase: { type: Number, default: 0 },
    
    // ✅ الحد الأقصى للخصم (اختياري)
    maxDiscount: { type: Number, default: null },
    
    // ✅ وصف
    description: { type: String, default: '' }
}, { timestamps: true });

// ✅ فحص الصلاحية
discountCodeSchema.methods.isValid = function() {
    if (!this.isActive) return { valid: false, reason: '❌ الكود غير مفعّل.' };
    
    if (this.expiresAt && this.expiresAt < new Date()) {
        return { valid: false, reason: '❌ انتهت صلاحية الكود.' };
    }
    
    if (this.currentUses >= this.maxUses) {
        return { valid: false, reason: '❌ تم استنفاد الكود بالكامل.' };
    }
    
    return { valid: true };
};

// ✅ حساب الخصم
discountCodeSchema.methods.calculateDiscount = function(price) {
    if (price < this.minPurchase) {
        return { error: `❌ الحد الأدنى للشراء: ${this.minPurchase} ريو` };
    }
    
    let discount = Math.floor(price * (this.percentage / 100));
    
    // تطبيق الحد الأقصى
    if (this.maxDiscount !== null && discount > this.maxDiscount) {
        discount = this.maxDiscount;
    }
    
    const finalPrice = price - discount;
    
    return {
        success: true,
        discount,
        finalPrice,
        percentage: this.percentage
    };
};

// ✅ استخدام الكود
discountCodeSchema.methods.use = async function() {
    const validity = this.isValid();
    if (!validity.valid) {
        return { error: validity.reason };
    }
    
    this.currentUses += 1;
    
    if (this.currentUses >= this.maxUses) {
        this.isActive = false;
    }
    
    await this.save();
    
    return { success: true };
};

const DiscountCode = mongoose.models.DiscountCode || mongoose.model('DiscountCode', discountCodeSchema);
export default DiscountCode;
