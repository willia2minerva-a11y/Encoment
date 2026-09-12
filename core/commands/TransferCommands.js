// core/commands/TransferCommands.js
import { BaseCommand } from '../BaseCommand.js';
import Player from '../../models/Player.js';
import Settings from '../../models/Settings.js';

export class TransferCommands extends BaseCommand {
    getCommands() {
        return {
            'تحويل': this.handleTransfer.bind(this),
            'حول': this.handleTransfer.bind(this)
        };
    }

    // ✅ تحويل ريو
    async handleTransfer(player, args) {
        const check = await this.checkPlayerStatus(player);
        if (check.error) return check.error;

        if (args.length < 2) {
            const minTransfer = await Settings.get('minTransfer', 100);
            return `❌ الاستخدام: تحويل [اسم اللاعب] [المبلغ]

مثال: تحويل Ahmed 500

📊 الحد الأدنى: ${minTransfer} ريو`;
        }

        const amount = parseInt(args[args.length - 1]);
        const targetName = args.slice(0, -1).join(' ');

        // ✅ فحص المبلغ
        if (isNaN(amount) || amount <= 0) {
            return '❌ مبلغ غير صالح.';
        }

        // ✅ الإعدادات
        const minTransfer = await Settings.get('minTransfer', 100);
        const maxTransfer = await Settings.get('maxTransfer', 100000);
        const feePercent = await Settings.get('transferFee', 5);

        if (amount < minTransfer) {
            return `❌ الحد الأدنى للتحويل: ${minTransfer} ريو`;
        }

        if (amount > maxTransfer) {
            return `❌ الحد الأقصى للتحويل: ${maxTransfer} ريو`;
        }

        // ✅ حساب الرسوم
        const fee = Math.floor(amount * (feePercent / 100));
        const totalDeduction = amount + fee;

        // ✅ فحص الرصيد
        if (player.gold < totalDeduction) {
            return `❌ رصيدك غير كافٍ!

💰 رصيدك: ${player.gold} ريو
💸 المبلغ: ${amount} ريو
💵 الرسوم (${feePercent}%): ${fee} ريو
📊 الإجمالي: ${totalDeduction} ريو`;
        }

        // ✅ البحث عن اللاعب المستهدف
        const target = await Player.findByIdentifier(targetName);

        if (!target) {
            return `❌ لم يتم العثور على اللاعب: ${targetName}`;
        }

        if (target.userId === player.userId) {
            return '❌ لا يمكنك التحويل لنفسك!';
        }

        // ✅ فحص المستهدف
        if (target.banned) {
            return '❌ اللاعب محظور.';
        }

        if (target.registrationStatus !== 'completed') {
            return '❌ حساب اللاعب غير مفعّل.';
        }

        // ✅ تنفيذ التحويل
        player.gold -= totalDeduction;
        target.gold += amount;

        // ✅ معاملات
        player.addTransaction('transfer_sent', amount, `تحويل إلى ${target.name} (رسوم: ${fee})`, target.name);
        target.addTransaction('transfer_received', amount, `تحويل من ${player.name}`, player.name);

        // ✅ إضافة الرسوم لصندوق الاقتصاد
        const economyBox = await Settings.get('economyBox', 0);
        await Settings.set('economyBox', economyBox + fee);

        await player.save();
        await target.save();

        return `✅ تم التحويل بنجاح!

📤 من: ${player.name}
📥 إلى: ${target.name}
💸 المبلغ: ${amount} ريو
💵 الرسوم: ${fee} ريو (${feePercent}%)
📊 إجمالي المخصوم: ${totalDeduction} ريو
💰 رصيدك الجديد: ${player.gold} ريو`;
    }
}
