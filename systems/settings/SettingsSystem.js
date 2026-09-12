// systems/settings/SettingsSystem.js
import Settings from '../../core/models/Settings.js';

export class SettingsSystem {
    constructor() {
        console.log('⚙️ نظام الإعدادات تم تهيئته');
    }

    // ✅ تهيئة الإعدادات الافتراضية
    async initialize() {
        await Settings.initializeDefaults();
    }

    // ✅ الحصول على إعداد
    async get(key, defaultValue = null) {
        return await Settings.get(key, defaultValue);
    }

    // ✅ تعيين إعداد
    async set(key, value, updatedBy = null) {
        return await Settings.set(key, value, updatedBy);
    }

    // ✅ عرض كل الإعدادات
    async showAll() {
        const settings = await Settings.getAll();
        
        if (settings.length === 0) {
            return '⚙️ لا توجد إعدادات.';
        }

        let msg = `⚙️ إعدادات الاقتصاد (${settings.length})\n\n`;
        
        settings.forEach(s => {
            msg += `🔹 ${s.key}\n`;
            msg += `   📊 القيمة: ${s.value}\n`;
            if (s.description) msg += `   📝 ${s.description}\n`;
            msg += `\n`;
        });

        msg += `💡 لتعديل: تعديل_اعداد [المفتاح] [القيمة]`;
        return msg;
    }

    // ✅ عرض إعداد محدد
    async show(key) {
        const setting = await Settings.findOne({ key });
        
        if (!setting) {
            return `❌ لا يوجد إعداد بالمفتاح: ${key}`;
        }

        let msg = `⚙️ الإعداد: ${setting.key}\n\n`;
        msg += `📊 القيمة: ${setting.value}\n`;
        if (setting.description) msg += `📝 الوصف: ${setting.description}\n`;
        if (setting.updatedBy) msg += `👤 آخر تعديل: ${setting.updatedBy}\n`;
        msg += `📅 آخر تحديث: ${setting.updatedAt.toLocaleString('ar-EG')}`;

        return msg;
    }

    // ✅ حذف إعداد
    async remove(key) {
        const result = await Settings.deleteOne({ key });
        
        if (result.deletedCount === 0) {
            return { error: `❌ لا يوجد إعداد بالمفتاح: ${key}` };
        }

        return { success: true, message: `✅ تم حذف الإعداد: ${key}` };
    }
          }
