// systems/codes/DiscountCodeSystem.js
import DiscountCode from '../../core/models/DiscountCode.js';
import Player from '../../core/models/Player.js';

export class DiscountCodeSystem {
    constructor() {
        console.log('🎟️ نظام أكواد الخصم تم تهيئته');
    }

    // ✅ إنشاء كود خصم
    async createCode(code, percentage, maxUses, expiresInHours, createdBy, options = {}) {
        if (percentage < 1 || percentage > 100) {
            return { error: '❌ نسبة الخصم بين 1 و 100.' };
        }

        const existing = await DiscountCode.findOne({ code: code.toUpperCase() });
        if (existing) {
            return { error: `❌ يوجد كود بالفعل: ${code}` };
        }

        let expiresAt = null;
        if (expiresInHours && expiresInHours > 0) {
            expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
        }

        const discountCode = new DiscountCode({
            code: code.toUpperCase(),
            percentage,
            maxUses,
            expiresAt,
            createdBy,
            minPurchase: options.minPurchase || 0,
            maxDiscount: options.maxDiscount || null,
            description: options.description || ''
        });

        await discountCode.save();

        let msg = `✅ تم إنشاء كود الخصم\n\n`;
        msg += `🎟️ الكود: ${discountCode.code}\n`;
        msg += `📊 النسبة: ${percentage}%\n`;
        msg += `👥 الاستخدامات: ${maxUses}\n`;
        if (expiresAt) {
            msg += `⏰ ينتهي: ${expiresAt.toLocaleString('ar-EG')}\n`;
        } else {
            msg += `⏰ المدة: حتى استنفاد الاستخدامات\n`;
        }
        if (discountCode.minPurchase > 0) {
            msg += `💵 حد أدنى: ${discountCode.minPurchase} ريو\n`;
        }
        if (discountCode.maxDiscount) {
            msg += `📉 حد أقصى: ${discountCode.maxDiscount} ريو\n`;
        }

        return { success: true, message: msg };
    }

    // ✅ تفعيل خصم للاعب (يُطبق عند الشراء التالي)
    async applyDiscount(player, code) {
        const discountCode = await DiscountCode.findOne({ code: code.toUpperCase() });

        if (!discountCode) {
            return { error: '❌ الكود غير صحيح أو غير موجود.' };
        }

        const validity = discountCode.isValid();
        if (!validity.valid) {
            return { error: validity.reason };
        }

        // ✅ حفظ الخصم على اللاعب
        player.appliedDiscount = {
            code: discountCode.code,
            percentage: discountCode.percentage,
            expiresAt: discountCode.expiresAt
        };

        await player.save();

        let msg = `🎟️ تم تفعيل كود الخصم!\n\n`;
        msg += `🎟️ الكود: ${discountCode.code}\n`;
        msg += `📊 نسبة الخصم: ${discountCode.percentage}%\n`;
        if (discountCode.expiresAt) {
            msg += `⏰ ينتهي: ${discountCode.expiresAt.toLocaleString('ar-EG')}\n`;
        }
        msg += `\n💡 سيُطبق تلقائياً عند الشراء التالي!`;

        return { success: true, message: msg };
    }

    // ✅ عرض كل الأكواد
    async listAllCodes() {
        const codes = await DiscountCode.find({}).sort({ createdAt: -1 });

        if (codes.length === 0) {
            return `📋 لا توجد أكواد خصم.`;
        }

        let msg = `🎟️ أكواد الخصم (${codes.length})\n\n`;

        codes.forEach((c, index) => {
            const statusIcon = c.isActive ? '✅' : '❌';
            const expired = c.expiresAt && c.expiresAt < new Date();
            const finalIcon = expired ? '⏰' : statusIcon;
            
            msg += `${index + 1}. ${finalIcon} ${c.code}\n`;
            msg += `   📊 ${c.percentage}%\n`;
            msg += `   👥 ${c.currentUses}/${c.maxUses}\n`;
            if (c.expiresAt) {
                msg += `   ⏰ ${expired ? 'منتهي' : c.expiresAt.toLocaleDateString('ar-EG')}\n`;
            }
            msg += `\n`;
        });

        return msg;
    }

    // ✅ حذف كود
    async removeCode(code) {
        const result = await DiscountCode.deleteOne({ code: code.toUpperCase() });

        if (result.deletedCount === 0) {
            return { error: `❌ لا يوجد كود: ${code}` };
        }

        return {
            success: true,
            message: `✅ تم حذف الكود: ${code.toUpperCase()}`
        };
    }

    // ✅ تعديل كود
    async editCode(code, field, value) {
        const discountCode = await DiscountCode.findOne({ code: code.toUpperCase() });
        
        if (!discountCode) {
            return { error: `❌ لا يوجد كود: ${code}` };
        }

        const allowedFields = ['percentage', 'maxUses', 'isActive', 'minPurchase', 'maxDiscount', 'description'];

        if (!allowedFields.includes(field)) {
            return { error: `❌ الحقل غير قابل للتعديل: ${field}` };
        }

        if (['percentage', 'maxUses', 'minPurchase', 'maxDiscount'].includes(field)) {
            value = parseInt(value);
            if (isNaN(value)) return { error: '❌ قيمة غير صالحة.' };
            if (field === 'percentage' && (value < 1 || value > 100)) {
                return { error: '❌ النسبة بين 1 و 100.' };
            }
        }

        if (field === 'isActive') {
            value = value === 'true' || value === '1' || value === 'صحيح';
        }

        discountCode[field] = value;
        await discountCode.save();

        return {
            success: true,
            message: `✅ تم تعديل الكود: ${discountCode.code}\n📊 ${field} = ${value}`
        };
    }
}
