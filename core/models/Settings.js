// core/models/Settings.js
import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    description: { type: String, default: '' },
    updatedBy: { type: String, default: null }
}, { timestamps: true });

// ✅ الحصول على قيمة
settingsSchema.statics.get = async function(key, defaultValue = null) {
    const setting = await this.findOne({ key });
    return setting ? setting.value : defaultValue;
};

// ✅ تعيين قيمة
settingsSchema.statics.set = async function(key, value, updatedBy = null, description = '') {
    const setting = await this.findOne({ key });
    
    if (setting) {
        setting.value = value;
        setting.updatedBy = updatedBy;
        if (description) setting.description = description;
        await setting.save();
    } else {
        await this.create({
            key,
            value,
            description,
            updatedBy
        });
    }
    
    return true;
};

// ✅ الحصول على الكل
settingsSchema.statics.getAll = async function() {
    return await this.find({});
};

// ✅ الإعدادات الافتراضية
settingsSchema.statics.initializeDefaults = async function() {
    const defaults = [
        { key: 'minTransfer', value: 100, description: 'الحد الأدنى للتحويل' },
        { key: 'transferFee', value: 5, description: 'نسبة رسوم التحويل %' },
        { key: 'maxTransfer', value: 100000, description: 'الحد الأقصى للتحويل' },
        { key: 'economyBox', value: 0, description: 'صندوق الاقتصاد (الرسوم)' },
        { key: 'shopPageSize', value: 10, description: 'عدد المنتجات في الصفحة' },
        { key: 'economyEnabled', value: true, description: 'تفعيل النظام الاقتصادي' }
    ];
    
    for (const def of defaults) {
        const existing = await this.findOne({ key: def.key });
        if (!existing) {
            await this.create(def);
        }
    }
    
    console.log('✅ تم تهيئة الإعدادات الافتراضية');
};

const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
export default Settings;
