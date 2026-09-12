// systems/codes/GiftCodeSystem.js
import GiftCode from '../../core/models/GiftCode.js';
import Player from '../../core/models/Player.js';

export class GiftCodeSystem {
    constructor() {
        console.log('🎁 نظام أكواد الهدايا تم تهيئته');
    }

    // ✅ إنشاء كود هدية
    async createCode(code, amount, maxUses, expiresInHours, createdBy, description = '') {
        // فحص التكرار
        const existing = await GiftCode.findOne({ code: code.toUpperCase() });
        if (existing) {
            return { error: `❌ يوجد كود بالفعل بالاسم: ${code}` };
        }

        // حساب تاريخ الانتهاء
        let expiresAt = null;
        if (expiresInHours && expiresInHours > 0) {
            expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
        }

        const giftCode = new GiftCode({
            code: code.toUpperCase(),
            amount,
            maxUses,
            expiresAt,
            createdBy,
            description
        });

        await giftCode.save();

        let msg = `✅ تم إنشاء كود الهدية\n\n`;
        msg += `🎁 الكود: ${giftCode.code}\n`;
        msg += `💰 القيمة: ${amount} ريو\n`;
        msg += `👥 الاستخدامات: ${maxUses}\n`;
        if (expiresAt) {
            msg += `⏰ ينتهي: ${expiresAt.toLocaleString('ar-EG')}\n`;
        } else {
            msg += `⏰ المدة: حتى استنفاد الاستخدامات\n`;
        }

        return { success: true, message: msg };
    }

    // ✅ استخدام كود هدية
    async redeemCode(player, code) {
        const giftCode = await GiftCode.findOne({ code: code.toUpperCase() });

        if (!giftCode) {
            return { error: '❌ الكود غير صحيح أو غير موجود.' };
        }

        // فحص الاستخدام
        const useResult = await giftCode.use(player.userId);

        if (useResult.error) {
            return { error: useResult.error };
        }

        // ✅ إضافة المبلغ
        player.gold += useResult.amount;
        player.usedGiftCodes = player.usedGiftCodes || [];
        player.usedGiftCodes.push(giftCode.code);
        player.addTransaction('gift_code', useResult.amount, `استخدام كود هدية: ${giftCode.code}`);

        await player.save();

        return {
            success: true,
            message: `🎁 تم استخدام كود الهدية!\n\n💰 ربحت: ${useResult.amount} ريو\n💎 رصيدك: ${player.gold} ريو\n\n📊 الكود: ${giftCode.code}\n👥 استخدامات متبقية: ${giftCode.maxUses - giftCode.currentUses}`
        };
    }

    // ✅ عرض كل الأكواد (للأدمن)
    async listAllCodes() {
        const codes = await GiftCode.find({}).sort({ createdAt: -1 });

        if (codes.length === 0) {
            return `📋 لا توجد أكواد هدايا.`;
        }

        let msg = `🎁 أكواد الهدايا (${codes.length})\n\n`;

        codes.forEach((c, index) => {
            const statusIcon = c.isActive ? '✅' : '❌';
            const expired = c.expiresAt && c.expiresAt < new Date();
            const finalIcon = expired ? '⏰' : statusIcon;
            
            msg += `${index + 1}. ${finalIcon} ${c.code}\n`;
            msg += `   💰 ${c.amount} ريو\n`;
            msg += `   👥 ${c.currentUses}/${c.maxUses}\n`;
            if (c.expiresAt) {
                msg += `   ⏰ ${expired ? 'منتهي' : c.expiresAt.toLocaleDateString('ar-EG')}\n`;
            } else {
                msg += `   ⏰ دائم\n`;
            }
            msg += `\n`;
        });

        msg += `💡 للحذف: حذف_كود [الكود]`;
        return msg;
    }

    // ✅ حذف كود
    async removeCode(code) {
        const result = await GiftCode.deleteOne({ code: code.toUpperCase() });

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
        const giftCode = await GiftCode.findOne({ code: code.toUpperCase() });
        
        if (!giftCode) {
            return { error: `❌ لا يوجد كود: ${code}` };
        }

        const allowedFields = ['amount', 'maxUses', 'isActive', 'description'];

        if (!allowedFields.includes(field)) {
            return { error: `❌ الحقل غير قابل للتعديل: ${field}` };
        }

        if (field === 'amount' || field === 'maxUses') {
            value = parseInt(value);
            if (isNaN(value) || value <= 0) return { error: '❌ قيمة غير صالحة.' };
        }

        if (field === 'isActive') {
            value = value === 'true' || value === '1' || value === 'صحيح';
        }

        giftCode[field] = value;
        await giftCode.save();

        return {
            success: true,
            message: `✅ تم تعديل الكود: ${giftCode.code}\n📊 ${field} = ${value}`
        };
    }
}
