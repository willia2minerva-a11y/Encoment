// systems/economy/EconomySystem.js
import Player from '../../core/models/Player.js';
import Settings from '../../core/models/Settings.js';

export class EconomySystem {
    constructor() {
        this.PLAYERS_PER_PAGE = 20;
        console.log('💰 نظام الاقتصاد تم تهيئته');
    }

    // ✅ إحصائيات عامة
    async showEconomyStats() {
        try {
            const stats = await Player.aggregate([
                { $match: { registrationStatus: 'completed' } },
                {
                    $group: {
                        _id: null,
                        totalPlayers: { $sum: 1 },
                        totalGold: { $sum: '$gold' },
                        avgGold: { $avg: '$gold' },
                        maxGold: { $max: '$gold' },
                        minGold: { $min: '$gold' }
                    }
                }
            ]);

            if (stats.length === 0) {
                return `💰 إحصائيات الاقتصاد\n\n❌ لا يوجد لاعبون.`;
            }

            const s = stats[0];

            const playersWithGold = await Player.countDocuments({
                registrationStatus: 'completed',
                gold: { $gt: 0 }
            });

            const playersWithZeroGold = await Player.countDocuments({
                registrationStatus: 'completed',
                gold: 0
            });

            const richest = await Player.findOne({
                registrationStatus: 'completed'
            }).sort({ gold: -1 }).select('name gold');

            const economyBox = await Settings.get('economyBox', 0);

            let msg = `💰 إحصائيات الاقتصاد\n\n`;
            msg += `📊 نظرة عامة:\n`;
            msg += `• اللاعبين: ${s.totalPlayers}\n`;
            msg += `• إجمالي الريو: ${Math.floor(s.totalGold)} ريو\n`;
            msg += `• متوسط الريو: ${Math.floor(s.avgGold)} ريو\n`;
            msg += `• أعلى رصيد: ${s.maxGold} ريو\n`;
            msg += `• أقل رصيد: ${s.minGold} ريو\n\n`;
            
            msg += `👥 التوزيع:\n`;
            msg += `• لديهم رصيد: ${playersWithGold}\n`;
            msg += `• رصيدهم صفر: ${playersWithZeroGold}\n\n`;
            
            msg += `🏦 صندوق الاقتصاد: ${economyBox} ريو\n\n`;
            
            msg += `👑 أغنى لاعب:\n`;
            msg += `• ${richest?.name || 'غير محدد'} - ${richest?.gold || 0} ريو\n\n`;
            
            msg += `💡 للقائمة: اغنياء [صفحة]`;

            return msg;
        } catch (error) {
            console.error('❌ خطأ:', error);
            return '❌ حدث خطأ.';
        }
    }

    // ✅ قائمة الأغنياء
    async showRichestPlayers(page = 1) {
        const total = await Player.countDocuments({
            registrationStatus: 'completed'
        });

        if (total === 0) return `💰 لا يوجد لاعبون.`;

        const totalPages = Math.ceil(total / this.PLAYERS_PER_PAGE);
        if (page < 1 || page > totalPages) {
            return `❌ الصفحة ${page} غير موجودة. الإجمالي: ${totalPages}`;
        }

        const skip = (page - 1) * this.PLAYERS_PER_PAGE;

        const players = await Player.find({ registrationStatus: 'completed' })
            .sort({ gold: -1 })
            .skip(skip)
            .limit(this.PLAYERS_PER_PAGE)
            .select('name gold playerId');

        let msg = `💰 أغنى اللاعبين - صفحة ${page}/${totalPages}\n`;

        players.forEach((p, index) => {
            const rank = skip + index + 1;
            const icon = rank === 1 ? '👑' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '▪️';
            msg += `\n${icon} ${rank}. ${p.name}\n`;
            msg += `   💎 ${p.gold} ريو\n`;
            msg += `   🆔 ${p.playerId || 'N/A'}\n`;
        });

        msg += `\n💡 للتنقل: اغنياء [رقم]`;
        return msg;
    }

    // ✅ قائمة الفقراء
    async showPoorestPlayers(page = 1) {
        const total = await Player.countDocuments({
            registrationStatus: 'completed'
        });

        if (total === 0) return `💰 لا يوجد لاعبون.`;

        const totalPages = Math.ceil(total / this.PLAYERS_PER_PAGE);
        if (page < 1 || page > totalPages) {
            return `❌ الصفحة ${page} غير موجودة. الإجمالي: ${totalPages}`;
        }

        const skip = (page - 1) * this.PLAYERS_PER_PAGE;

        const players = await Player.find({ registrationStatus: 'completed' })
            .sort({ gold: 1 })
            .skip(skip)
            .limit(this.PLAYERS_PER_PAGE)
            .select('name gold playerId');

        let msg = `💸 أفقر اللاعبين - صفحة ${page}/${totalPages}\n`;

        players.forEach((p, index) => {
            const rank = skip + index + 1;
            msg += `\n${rank}. ${p.name}\n`;
            msg += `   💎 ${p.gold} ريو\n`;
            msg += `   🆔 ${p.playerId || 'N/A'}\n`;
        });

        msg += `\n💡 للتنقل: فقراء [رقم]`;
        return msg;
    }

    // ✅ اقتصاد لاعب محدد
    async showPlayerEconomy(identifier) {
        const player = await Player.findByIdentifier(identifier);

        if (!player) {
            return `❌ لم يتم العثور على اللاعب: ${identifier}`;
        }

        // ترتيب اللاعب
        const rank = await Player.countDocuments({
            registrationStatus: 'completed',
            gold: { $gt: player.gold }
        }) + 1;

        let msg = `💰 اقتصاد اللاعب: ${player.name}\n\n`;
        msg += `💎 الرصيد: ${player.gold} ريو\n`;
        msg += `🏆 الترتيب: #${rank}\n`;
        msg += `🆔 المعرف: ${player.playerId || 'N/A'}\n`;
        msg += `📱 User ID: ${player.userId}\n\n`;
        
        msg += `👥 الإحالة:\n`;
        msg += `• عدد المدعوين: ${player.referralCount || 0}\n`;
        msg += `• كود الدعوة: ${player.referralCode || 'غير محدد'}\n\n`;
        
        const totalTx = player.transactions?.length || 0;
        msg += `📋 المعاملات: ${totalTx}\n`;

        return msg;
    }

    // ✅ سجل معاملات لاعب (للأدمن)
    async showPlayerTransactions(identifier, page = 1) {
        const player = await Player.findByIdentifier(identifier);

        if (!player) {
            return `❌ لم يتم العثور على اللاعب: ${identifier}`;
        }

        const transactions = (player.transactions || [])
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (transactions.length === 0) {
            return `📋 لا توجد معاملات للاعب ${player.name}.`;
        }

        const PER_PAGE = 10;
        const totalPages = Math.ceil(transactions.length / PER_PAGE);
        const pageNum = Math.max(1, Math.min(page, totalPages));
        const skip = (pageNum - 1) * PER_PAGE;

        const pageTxs = transactions.slice(skip, skip + PER_PAGE);

        let msg = `📋 معاملات ${player.name} - صفحة ${pageNum}/${totalPages}\n`;

        pageTxs.forEach(tx => {
            const date = new Date(tx.createdAt).toLocaleDateString('ar-EG');
            const icons = {
                'deposit': '📥',
                'purchase': '🛒',
                'transfer_sent': '➡️',
                'transfer_received': '⬅️',
                'gift_code': '🎁',
                'admin_add': '👑',
                'admin_remove': '👑'
            };
            const icon = icons[tx.type] || '📌';
            
            msg += `\n${icon} ${tx.description}\n`;
            msg += `   💰 ${tx.amount} ريو\n`;
            msg += `   📅 ${date}\n`;
        });

        msg += `\n💡 للتنقل: معاملات_لاعب [الاسم] [رقم]`;
        return msg;
    }
}
