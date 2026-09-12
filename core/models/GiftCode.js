// core/models/GiftCode.js
import mongoose from 'mongoose';

const giftCodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true, uppercase: true },
    amount: { type: Number, required: true, min: 1 },
    
    // ✅ الاستخدامات
    maxUses: { type: Number, required: true, min: 1 },
    currentUses: { type: Number, default: 0 },
    
    // ✅ من استخدمه (لمنع التكرار)
    usedBy: { type: [String], default: [] },
    
    // ✅ المدة (اختيارية)
    expiresAt: { type: Date, default: null },
    
    // ✅ من أنشأه
    createdBy: { type: String, default: null },
    
    // ✅ حالة التفعيل
    isActive: { type: Boolean, default: true },
    
    // ✅ وصف اختياري
    description: { type: String, default: '' }
}, { timestamps: true });

// ✅ فحص الصلاحية
giftCodeSchema.methods.isValid = function() {
    if (!this.isActive) return { valid: false, reason: '❌ الكود غير مفعّل.' };
    
    if (this.expiresAt && this.expiresAt < new Date()) {
        return { valid: false, reason: '❌ انتهت صلاحية الكود.' };
    }
    
    if (this.currentUses >= this.maxUses) {
        return { valid: false, reason: '❌ تم استنفاد الكود بالكامل.' };
    }
    
    return { valid: true };
};

// ✅ فحص استخدام اللاعب
giftCodeSchema.methods.hasBeenUsedBy = function(userId) {
    return this.usedBy.includes(userId);
};

// ✅ استخدام الكود
giftCodeSchema.methods.use = async function(userId) {
    if (this.hasBeenUsedBy(userId)) {
        return { error: '❌ لقد استخدمت هذا الكود مسبقاً.' };
    }
    
    const validity = this.isValid();
    if (!validity.valid) {
        return { error: validity.reason };
    }
    
    this.currentUses += 1;
    this.usedBy.push(userId);
    
    // إذا انتهت كل الاستخدامات، عطّله
    if (this.currentUses >= this.maxUses) {
        this.isActive = false;
    }
    
    await this.save();
    
    return { success: true, amount: this.amount };
};

const GiftCode = mongoose.models.GiftCode || mongoose.model('GiftCode', giftCodeSchema);
export default GiftCode;
