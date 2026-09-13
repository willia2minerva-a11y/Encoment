// systems/admin/AdminSystem.js
// الموقع: سوق ريو
import Player from '../../core/models/Player.js';
import BannedPlayer from '../../core/models/BannedPlayer.js';
import { items } from '../../data/items.js';
import { AutoResponseSystem } from '../autoResponse/AutoResponseSystem.js';
import { PermissionSystem } from '../permissions/PermissionSystem.js';

export class AdminSystem {
    constructor() {
        this.adminCommands = new Map();
        this.autoResponseSystem = new AutoResponseSystem();
        this.permissionSystem = new PermissionSystem();
        this.commandHandler = null;
        console.log('👑 نظام المدير (سوق - DB-based) تم تهيئته');
    }

    setCommandHandler(handler) {
        this.commandHandler = handler;
    }

    async isRootAdmin(userId) {
        if (!userId) return false;
        try {
            const rootAdmin = await Player.findOne({ isRoot: true });
            if (!rootAdmin) return false;
            return (rootAdmin.linkedPlatforms || []).some(p => p.platformId === userId);
        } catch (error) {
            return false;
        }
    }

    async isAdmin(userId) {
        if (!userId) return false;
        if (await this.isRootAdmin(userId)) return true;
        try {
            const player = await Player.findByPlatform(userId);
            if (!player) return false;
            if (player.isRoot) return true;
            return player.getActivePermissions().length > 0;
        } catch (error) {
            return false;
        }
    }

    async isAdminAsync(userId) {
        return await this.isAdmin(userId);
    }

    _translateRarity(rarity) {
        const map = {
            'common': 'عادي', 'uncommon': 'غير عادي', 'rare': 'نادر',
            'epic': 'ملحمي', 'legendary': 'أسطوري', 'mythic': 'خرافي',
            'divine': 'إلهي', 'special': 'خاص'
        };
        return map[rarity] || rarity || 'عادي';
    }

    _parseDuration(input) {
        if (!input) return null;
        const str = input.toString().trim().toLowerCase();
        const numMatch = str.match(/^(\d+)$/);
        if (numMatch) return parseInt(numMatch[1]) * 60 * 60 * 1000;
        const match = str.match(/^(\d+)(د|س|ي|m|h|d)$/);
        if (!match) return null;
        const value = parseInt(match[1]);
        const unit = match[2];
        switch (unit) {
            case 'د': case 'm': return value * 60 * 1000;
            case 'س': case 'h': return value * 60 * 60 * 1000;
            case 'ي': case 'd': return value * 24 * 60 * 60 * 1000;
        }
        return null;
    }

    _formatDuration(ms) {
        if (ms < 60 * 1000) return `${Math.floor(ms / 1000)} ثانية`;
        if (ms < 60 * 60 * 1000) return `${Math.floor(ms / (60 * 1000))} دقيقة`;
        if (ms < 24 * 60 * 60 * 1000) return `${Math.floor(ms / (60 * 60 * 1000))} ساعة`;
        return `${Math.floor(ms / (24 * 60 * 60 * 1000))} يوم`;
    }

    getAdminHelp() {
        return `👑 أوامر الأدمن - سوق ريو

📢 الإعلان
• اعلان [النص]

💰 الرصيد
• اعطاء_ذهب [ID] [الكمية]

🔐 الصلاحيات
• اعطاء_ادمن [ID] [مدة]
• ازالة_ادمن [ID]
• نزع_ادمن [ID]
• قائمة_الادمن
• صلاحيات [ID]

🚫 الحظر
• حظر_لاعب [ID] [صحيح/خطأ]
• قائمة_المحظورين [صفحة]
• حذف_محظور [ID]

🚔 السجن
• سجن [ID] [المدة]
• اطلاق [ID]
• قائمة_المسجونين

📋 العرض
• عرض_لاعبين [صفحة]

💡 الأوامر تقبل أي شكل:
موافقة_لاعب | موافقة لاعب | موافقةلاعب`;
    }

    _getCommandMap() {
        return {
            'مدير': 'مدير',
            'موافقةلاعب': 'موافقة_لاعب',
            'اعادةبيانات': 'اعادة_بيانات',
            'تغييراسم': 'تغيير_اسم',
            'تغييرجنس': 'تغيير_جنس',
            'حظرلاعب': 'حظر_لاعب',
            'نزعادمن': 'نزع_ادمن',
            'قائمةالمحظورين': 'قائمة_المحظورين',
            'حذفمحظور': 'حذف_محظور',
            'اعطاءذهب': 'اعطاء_ذهب',
            'اعطاءمورد': 'اعطاء_مورد',
            'زيادةصحة': 'زيادة_صحة',
            'زيادةمانا': 'زيادة_مانا',
            'اضفرد': 'اضف_رد',
            'ازلرد': 'ازل_رد',
            'عرضالردود': 'عرض_الردود',
            'عرضاسلحة': 'عرض_اسلحة',
            'عرضوحوش': 'عرض_وحوش',
            'عرضمواقع': 'عرض_مواقع',
            'عرضموارد': 'عرض_موارد',
            'عرضلاعبين': 'عرض_لاعبين',
            'اضفمهمة': 'اضف_مهمة',
            'حذفمهمة': 'حذف_مهمة',
            'قائمةالمهام': 'قائمة_المهام',
            'اضفسلاح': 'اضف_سلاح',
            'حذفسلاح': 'حذف_سلاح',
            'اضفوحش': 'اضف_وحش',
            'حذفوحش': 'حذف_وحش',
            'اضفمورد': 'اضف_مورد',
            'حذفمورد': 'حذف_مورد',
            'اعطاءادمن': 'اعطاء_ادمن',
            'ازالةادمن': 'ازالة_ادمن',
            'اعطاءصلاحية': 'اعطاء_صلاحية',
            'ازالةصلاحية': 'ازالة_صلاحية',
            'قائمةالادمن': 'قائمة_الادمن',
            'صلاحيات': 'صلاحيات',
            'سجن': 'سجن',
            'اطلاق': 'اطلاق',
            'قائمةالمسجونين': 'قائمة_المسجونين',
            'اعلان': 'اعلان'
        };
    }

    async handleAdminCommand(command, args, senderId, player, itemMap) {
        const normalizedCommand = command.replace(/[_\s]/g, '');
        const commandMap = this._getCommandMap();
        const canonicalCommand = commandMap[normalizedCommand] || command;

        const findTargetPlayer = async (id) => {
            if (!id) return null;
            return await Player.findByIdentifier(id);
        };

        switch (canonicalCommand) {
            case 'مدير': return this.getAdminHelp();
            case 'موافقة_لاعب': return await this.handleApprovePlayer(args, senderId);
            case 'اعادة_بيانات': return await this.handleResetPlayer(args, findTargetPlayer, player);
            case 'تغيير_اسم': return await this.handleSetPlayerName(args, findTargetPlayer);
            case 'تغيير_جنس': return await this.handleSetPlayerGender(args, findTargetPlayer);
            case 'حظر_لاعب': return await this.handleBanPlayer(args, findTargetPlayer, senderId);
            case 'نزع_ادمن': return await this.handleRevokeAdmin(args, senderId, player);
            case 'قائمة_المحظورين': return await this.handleBannedList(args);
            case 'حذف_محظور': return await this.handleRemoveBanned(args, senderId);
            case 'اعطاء_ذهب': return await this.handleGiveGold(args, findTargetPlayer);
            case 'اعطاء_مورد': return await this.handleGiveItem(args, findTargetPlayer, itemMap);
            case 'زيادة_صحة': return await this.handleIncreaseStat(args, 'maxHealth', findTargetPlayer);
            case 'زيادة_مانا': return await this.handleIncreaseStat(args, 'maxMana', findTargetPlayer);
            case 'اضف_رد': return await this.handleAddAutoResponse(args, senderId);
            case 'ازل_رد': return await this.handleRemoveAutoResponse(args, senderId);
            case 'عرض_الردود': return await this.handleShowAutoResponses(args, senderId);
            case 'عرض_اسلحة': return await this.handleShowItemsByType(args, 'weapon');
            case 'عرض_وحوش': return await this.handleShowMonsters(args);
            case 'عرض_مواقع': return await this.handleShowLocations(args);
            case 'عرض_موارد': return await this.handleShowResources(args);
            case 'عرض_لاعبين': return await this.handleShowPlayers(args);
            case 'اضف_سلاح': return await this.handleAddWeapon(args);
            case 'حذف_سلاح': return await this.handleDeleteWeapon(args);
            case 'اضف_وحش': return await this.handleAddMonster(args);
            case 'حذف_وحش': return await this.handleDeleteMonster(args);
            case 'اضف_مورد': return await this.handleAddResource(args);
            case 'حذف_مورد': return await this.handleDeleteResource(args);
            case 'اضف_مهمة': return await this.handleAddTaskCommand(args, senderId);
            case 'حذف_مهمة': return await this.handleRemoveTaskCommand(args, senderId);
            case 'قائمة_المهام': return await this.handleListTasksCommand(args, senderId);
            case 'اعطاء_ادمن': return await this.handleGrantAdmin(args, senderId, player);
            case 'ازالة_ادمن': return await this.handleRevokeAdmin(args, senderId, player);
            case 'اعطاء_صلاحية': return await this.handleGrantPermission(args, senderId, player);
            case 'ازالة_صلاحية': return await this.handleRevokePermission(args, senderId, player);
            case 'قائمة_الادمن': return await this.handleListAdmins(senderId);
            case 'صلاحيات': return await this.handleShowPermissions(args, senderId);
            case 'سجن': return await this.handleJail(args, senderId, player);
            case 'اطلاق': return await this.handleRelease(args, senderId, player);
            case 'قائمة_المسجونين': return await this.handleJailList(senderId, player);
            case 'اعلان': return await this.handleAnnouncement(args, senderId, player);
            default: return null;
        }
    }

    async handleAnnouncement(args, senderId, senderPlayer) {
        const isRoot = senderPlayer && senderPlayer.isRoot;
        const isDBAdmin = senderPlayer && senderPlayer.hasPermission && senderPlayer.hasPermission('full_admin');

        if (!isRoot && !isDBAdmin) {
            return '❌ ليس لديك صلاحية الإعلان.';
        }

        if (args.length === 0) {
            return `❌ الاستخدام: اعلان [النص]`;
        }

        const announcementText = args.join(' ');
        if (announcementText.length > 1000) {
            return '❌ الإعلان طويل جداً (الحد الأقصى 1000 حرف).';
        }

        const allPlayers = await Player.find({
            'linkedPlatforms.0': { $exists: true },
            banned: { $ne: true }
        });

        if (allPlayers.length === 0) {
            return '❌ لا يوجد لاعبون لإرسال الإعلان إليهم.';
        }

        const announcement = `📢 إعلان رسمي

${announcementText}

━━━━━━━━━━━━━━━━━━
🕐 ${new Date().toLocaleString('ar-EG')}
👑 الإدارة`;

        return {
            _announcement: true,
            text: announcement,
            recipients: allPlayers.map(p =>
                (p.linkedPlatforms || []).map(lp => ({
                    platform: lp.platform,
                    platformId: lp.platformId
                }))
            ).flat(),
            senderName: senderPlayer?.username || senderId,
            count: allPlayers.length
        };
    }

    async handleApprovePlayer(args, senderId) {
        if (args.length === 0) {
            const pendingPlayers = await Player.find({
                registrationStatus: 'pending',
                banned: { $ne: true }
            }).select('username playerId linkedPlatforms createdAt').sort({ createdAt: 1 });

            if (pendingPlayers.length === 0) return '✅ لا يوجد لاعبين بانتظار الموافقة.';

            let message = `⏳ اللاعبين المنتظرين (${pendingPlayers.length}):\n\n`;
            pendingPlayers.forEach((p, index) => {
                message += `${index + 1}. ${p.username || 'غير محدد'}\n`;
                message += `   🆔 ${p.playerId || 'N/A'}\n`;
                message += `   📱 ${(p.linkedPlatforms || []).map(l => l.platformId).join(', ')}\n\n`;
            });
            message += `💡 للموافقة: موافقة_لاعب [ID]`;
            return message;
        }

        const target = await Player.findByIdentifier(args[0]);
        if (!target) return `❌ لم يتم العثور على اللاعب.`;
        if (target.banned) return '❌ هذا اللاعب محظور!';
        if (target.registrationStatus === 'completed') return '❌ هذا اللاعب مسجل بالفعل.';

        target.registrationStatus = 'completed';
        target.approvedAt = new Date();
        target.approvedBy = senderId;
        await target.save();

        return `✅ تمت الموافقة على اللاعب ${target.username}!`;
    }

    async handleBanPlayer(args, findTargetPlayer, senderId) {
        const targetId = args[0];
        const banStatusRaw = args[1] ? args[1].toLowerCase() : 'true';

        if (!targetId) return '❌ الاستخدام: حظر_لاعب [ID] [صحيح/خطأ]';

        const target = await findTargetPlayer(targetId);
        if (!target) return `❌ لم يتم العثور على اللاعب ${targetId}.`;
        if (target.isRoot) return '❌ لا يمكن حظر الأدمن الرئيسي!';

        const isBanning = banStatusRaw === 'true' || banStatusRaw === 'صحيح' || banStatusRaw === 'حظر';

        if (isBanning) {
            const alreadyBanned = await BannedPlayer.findOne({ userId: target.username });
            if (alreadyBanned) return `❌ اللاعب ${target.username} محظور بالفعل.`;

            const bannedPlatforms = target.linkedPlatforms || [];

            await BannedPlayer.create({
                userId: target.username,
                name: target.username,
                playerId: target.playerId,
                platform: bannedPlatforms[0]?.platform || 'facebook',
                bannedBy: senderId,
                bannedAt: new Date(),
                reason: 'حظر إداري',
                level: target.level,
                gold: target.gold,
                wasAdmin: target.getActivePermissions().length > 0,
                adminPermissions: target.adminPermissions || [],
                linkedPlatformIds: bannedPlatforms.map(p => p.platformId)
            });

            const oldUsername = target.username;
            const oldId = target.playerId;
            await target.deleteOne();

            return `🚫 تم حظر اللاعب نهائياً\n\n👤 اسم المستخدم: ${oldUsername}\n🆔 ID: ${oldId}`;
        } else {
            const bannedRecord = await BannedPlayer.findOne({ userId: target.username });
            if (!bannedRecord) return `❌ اللاعب ${target.username} غير محظور.`;
            await BannedPlayer.deleteOne({ userId: target.username });
            return `✅ تم رفع الحظر عن ${bannedRecord.name}`;
        }
    }

    async handleRevokeAdmin(args, senderId, senderPlayer) {
        const isRoot = senderPlayer && senderPlayer.isRoot;
        const senderHasFull = senderPlayer && senderPlayer.hasPermission && senderPlayer.hasPermission('full_admin');

        if (!isRoot && !senderHasFull) return '❌ ليس لديك صلاحية.';
        if (args.length < 1) return `❌ الاستخدام: نزع_ادمن [ID]`;

        const target = await Player.findByIdentifier(args[0]);
        if (!target) return `❌ لم يتم العثور على اللاعب.`;
        if (target.isRoot) return '❌ لا يمكن نزع صلاحيات الأدمن الرئيسي!';

        const result = await this.permissionSystem.revokeAllPermissions(args[0]);
        return result.error || result.message;
    }

    async handleBannedList(args) {
        const page = parseInt(args[0]) || 1;
        const result = await BannedPlayer.getBannedList(page);
        if (result.error) return result.error;

        let msg = `🚫 قائمة المحظورين - صفحة ${result.page}/${result.totalPages}\n`;
        msg += `📊 الإجمالي: ${result.total}\n\n`;

        result.banned.forEach((b, index) => {
            const rank = (result.page - 1) * 20 + index + 1;
            const date = new Date(b.bannedAt).toLocaleDateString('ar-EG');
            const icon = b.wasAdmin ? '👑🚫' : '🚫';
            msg += `${rank}. ${icon} ${b.name}\n`;
            msg += `   🆔 ${b.playerId || 'N/A'}\n`;
            msg += `   📅 ${date}\n`;
            msg += `   📝 ${b.reason}\n\n`;
        });

        return msg;
    }

    async handleRemoveBanned(args, senderId) {
        if (args.length === 0) return '❌ الاستخدام: حذف_محظور [ID]';
        const identifier = args.join(' ');
        const result = await BannedPlayer.removeBan(identifier);
        if (result.error) return result.error;
        return `✅ تم حذف ${result.info.name} من قائمة المحظورين.`;
    }

    async handleResetPlayer(args, findTargetPlayer, senderPlayer) {
        const target = await findTargetPlayer(args[0]);
        if (!target) return `❌ لم يتم العثور.`;
        if (target.isRoot) return '❌ لا يمكن!';
        const oldUsername = target.username;
        await target.deleteOne();
        return `🗑️ تم مسح ${oldUsername}.`;
    }

    async handleSetPlayerName(args, findTargetPlayer) {
        const target = await findTargetPlayer(args[0]);
        const newName = args.slice(1).join(' ');
        if (!target || !newName) return '❌ استخدام خاطئ.';
        target.name = newName;
        await target.save();
        return `✅ تم تغيير الاسم إلى ${newName}.`;
    }

    async handleSetPlayerGender(args, findTargetPlayer) {
        const target = await findTargetPlayer(args[0]);
        const g = args[1]?.toLowerCase();
        if (!target || !['ذكر', 'أنثى', 'male', 'female'].includes(g)) return '❌ استخدام خاطئ.';
        target.gender = (g === 'ذكر' || g === 'male') ? 'male' : 'female';
        await target.save();
        return `✅ تم تغيير الجنس.`;
    }

    async handleGiveGold(args, findTargetPlayer) {
        const target = await findTargetPlayer(args[0]);
        const amount = parseInt(args[1]);
        if (!target || isNaN(amount) || amount <= 0) return '❌ استخدام خاطئ.';
        target.addGold(amount);
        await target.save();
        return `✅ تم إعطاء ${target.username} ${amount} ريو.`;
    }

    async handleGiveItem(args, findTargetPlayer, itemMap) {
        if (args.length < 3) return '❌ استخدام خاطئ.';
        const target = await findTargetPlayer(args[0]);
        const quantity = parseInt(args[args.length - 1]);
        const rawItemName = args.slice(1, -1).join(' ').toLowerCase();
        const itemId = itemMap[rawItemName] || rawItemName;
        const itemInfo = items[itemId];
        if (!target || !itemInfo || isNaN(quantity)) return '❌ بيانات خاطئة.';
        target.addItem(itemInfo.id, itemInfo.name, itemInfo.type, quantity);
        await target.save();
        return `✅ تم إضافة ${quantity} × ${itemInfo.name} لـ ${target.username}.`;
    }

    async handleIncreaseStat(args, statToChange, findTargetPlayer) {
        const target = await findTargetPlayer(args[0]);
        const amount = parseInt(args[1]);
        if (!target || isNaN(amount) || amount <= 0) return '❌ استخدام خاطئ.';
        if (statToChange === 'maxHealth') { target.maxHealth += amount; target.health += amount; }
        else { target.maxMana += amount; target.mana += amount; }
        await target.save();
        return `✅ تم الزيادة.`;
    }

    async handleAddAutoResponse(args, senderId) {
        const parts = args.join(' ').split('||');
        if (parts.length < 2) return '❌ الاستخدام: اضف_رد [الكلمة] || [الرد]';
        this.autoResponseSystem.addResponse(parts[0].trim().toLowerCase(), parts.slice(1).join('||').trim());
        return `✅ تم إضافة الرد.`;
    }

    async handleRemoveAutoResponse(args, senderId) {
        const keyword = args.join(' ').toLowerCase().trim();
        if (!keyword) return '❌ الاستخدام: ازل_رد [الكلمة]';
        const removed = this.autoResponseSystem.removeResponse(keyword);
        return removed ? `✅ تم الحذف.` : `❌ لا يوجد.`;
    }

    async handleShowAutoResponses(args, senderId) {
        const all = this.autoResponseSystem.getAllResponses();
        const keys = Object.keys(all);
        if (keys.length === 0) return '📝 لا توجد ردود.';
        let msg = `🤖 الردود (${keys.length}):\n\n`;
        for (const key of keys) msg += `• ${key}: ${all[key]}\n`;
        return msg;
    }

    async handleShowPlayers(args) {
        const page = parseInt(args[0]) || 1;
        const perPage = 10;
        const total = await Player.countDocuments({ registrationStatus: 'completed' });
        if (total === 0) return '📋 لا يوجد لاعبون.';
        const totalPages = Math.ceil(total / perPage);
        if (page < 1 || page > totalPages) return `❌ الصفحة ${page} غير موجودة. الإجمالي: ${totalPages}`;
        const skip = (page - 1) * perPage;
        const players = await Player.find({ registrationStatus: 'completed' })
            .sort({ level: -1 })
            .skip(skip)
            .limit(perPage)
            .select('username playerId linkedPlatforms level gold isRoot');

        let msg = `📋 اللاعبون - صفحة ${page}/${totalPages}\n📊 الإجمالي: ${total}\n\n`;
        players.forEach((p, i) => {
            const rank = skip + i + 1;
            const icon = p.isRoot ? '👑' : '👤';
            msg += `${rank}. ${icon} ${p.username}\n`;
            msg += `   🆔 ${p.playerId || 'N/A'}\n`;
            msg += `   📊 Lv.${p.level} | 💰 ${p.gold} ريو\n\n`;
        });
        return msg;
    }

    async handleShowItemsByType(args, type) {
        const page = parseInt(args[0]) || 1;
        const perPage = 10;
        const list = Object.entries(items).filter(([_, i]) => i.type === type);
        const totalPages = Math.ceil(list.length / perPage);
        if (totalPages === 0) return `❌ لا توجد عناصر.`;
        if (page < 1 || page > totalPages) return `❌ الصفحة غير موجودة.`;
        const start = (page - 1) * perPage;
        let msg = `📋 ${type} - صفحة ${page}/${totalPages}\n\n`;
        list.slice(start, start + perPage).forEach(([id, item]) => {
            msg += `• ${item.name} (${id})\n`;
            if (item.level) msg += `  المستوى: ${item.level}\n`;
            msg += `\n`;
        });
        return msg;
    }

    async handleShowMonsters(args) {
        const { monsters } = await import('../../data/monsters.js');
        const list = Object.entries(monsters);
        const page = parseInt(args[0]) || 1;
        const perPage = 10;
        const totalPages = Math.ceil(list.length / perPage);
        if (page < 1 || page > totalPages) return `❌ الصفحة غير موجودة.`;
        const start = (page - 1) * perPage;
        let msg = `👹 الوحوش - صفحة ${page}/${totalPages}\n\n`;
        list.slice(start, start + perPage).forEach(([id, m]) => {
            msg += `• ${m.name} (${id})\n  Lv.${m.level} | HP:${m.health || m.maxHealth}\n\n`;
        });
        return msg;
    }

    async handleShowLocations(args) {
        const { locations } = await import('../../data/locations.js');
        const list = Object.entries(locations);
        const page = parseInt(args[0]) || 1;
        const perPage = 10;
        const totalPages = Math.ceil(list.length / perPage);
        if (page < 1 || page > totalPages) return `❌ الصفحة غير موجودة.`;
        const start = (page - 1) * perPage;
        let msg = `📍 المواقع - صفحة ${page}/${totalPages}\n\n`;
        list.slice(start, start + perPage).forEach(([id, l]) => {
            msg += `• ${l.name || id} (${id})\n\n`;
        });
        return msg;
    }

    async handleShowResources(args) {
        const { resources } = await import('../../data/resources.js');
        const list = Object.entries(resources);
        const page = parseInt(args[0]) || 1;
        const perPage = 10;
        const totalPages = Math.ceil(list.length / perPage);
        if (page < 1 || page > totalPages) return `❌ الصفحة غير موجودة.`;
        const start = (page - 1) * perPage;
        let msg = `🌿 الموارد - صفحة ${page}/${totalPages}\n\n`;
        list.slice(start, start + perPage).forEach(([id, r]) => {
            msg += `• ${r.name} (${id})\n\n`;
        });
        return msg;
    }

    async handleAddWeapon(args) {
        if (args.length < 3) return '❌ الاستخدام: اضف_سلاح [اسم] [قوة] [مستوى]';
        const name = args.slice(0, -2).join(' ');
        const attack = parseInt(args[args.length - 2]);
        const level = parseInt(args[args.length - 1]);
        if (isNaN(attack) || isNaN(level)) return '❌ أرقام خاطئة.';
        const id = name.toLowerCase().replace(/\s+/g, '_');
        try {
            const { Weapon } = await import('../../core/models/Weapon.js');
            await Weapon.updateOne({ id }, { $set: { id, name, type: 'weapon', attack, level, rarity: 'common' } }, { upsert: true });
            return `✅ تمت الإضافة.`;
        } catch (e) { return '❌ فشل.'; }
    }

    async handleDeleteWeapon(args) {
        const id = args.join(' ').toLowerCase().replace(/\s+/g, '_');
        try {
            const { Weapon } = await import('../../core/models/Weapon.js');
            await Weapon.deleteOne({ id });
            return `✅ تم الحذف.`;
        } catch (e) { return '❌ فشل.'; }
    }

    async handleAddMonster(args) {
        if (args.length < 4) return '❌ الاستخدام: اضف_وحش [اسم] [صحة] [ضرر] [مستوى]';
        const name = args.slice(0, -3).join(' ');
        const health = parseInt(args[args.length - 3]);
        const damage = parseInt(args[args.length - 2]);
        const level = parseInt(args[args.length - 1]);
        if ([health, damage, level].some(isNaN)) return '❌ أرقام خاطئة.';
        const id = name.toLowerCase().replace(/\s+/g, '_');
        try {
            const { Monster } = await import('../../core/models/Monster.js');
            await Monster.updateOne({ id }, { $set: { id, name, level, health, maxHealth: health, damage } }, { upsert: true });
            return `✅ تمت الإضافة.`;
        } catch (e) { return '❌ فشل.'; }
    }

    async handleDeleteMonster(args) {
        const id = args.join(' ').toLowerCase().replace(/\s+/g, '_');
        try {
            const { Monster } = await import('../../core/models/Monster.js');
            await Monster.deleteOne({ id });
            return `✅ تم الحذف.`;
        } catch (e) { return '❌ فشل.'; }
    }

    async handleAddResource(args) {
        if (args.length < 3) return '❌ الاستخدام: اضف_مورد [اسم] [ندرة] [موقع]';
        const name = args.slice(0, -2).join(' ');
        const rarity = args[args.length - 2];
        const location = args[args.length - 1];
        const id = name.toLowerCase().replace(/\s+/g, '_');
        try {
            const { Resource } = await import('../../core/models/Resource.js');
            await Resource.updateOne({ id }, { $set: { id, name, rarity, locations: [location] } }, { upsert: true });
            return `✅ تمت الإضافة.`;
        } catch (e) { return '❌ فشل.'; }
    }

    async handleDeleteResource(args) {
        const id = args.join(' ').toLowerCase().replace(/\s+/g, '_');
        try {
            const { Resource } = await import('../../core/models/Resource.js');
            await Resource.deleteOne({ id });
            return `✅ تم الحذف.`;
        } catch (e) { return '❌ فشل.'; }
    }

    async handleAddTaskCommand(args, senderId) {
        if (args.length < 4) return '❌ الاستخدام: اضف_مهمة [الاسم] [النوع] [الهدف] [المكافأة]';
        const reward = parseInt(args[args.length - 1]);
        const target = parseInt(args[args.length - 2]);
        const rawType = args[args.length - 3];
        const name = args.slice(0, -3).join(' ').replace(/["']/g, '');
        if (isNaN(target) || isNaN(reward)) return '❌ أرقام خاطئة.';
        const achievementSystem = this.commandHandler ? await this.commandHandler.getSystem('achievement') : null;
        if (!achievementSystem) return '❌ نظام المهام غير متوفر.';
        const type = achievementSystem._translateTaskType(rawType);
        await achievementSystem.addCustomTask(name, type, target, reward);
        return `✅ تمت الإضافة.`;
    }

    async handleRemoveTaskCommand(args) {
        const taskId = args.join(' ');
        const achievementSystem = this.commandHandler ? await this.commandHandler.getSystem('achievement') : null;
        if (!achievementSystem) return '❌ نظام المهام غير متوفر.';
        const removed = await achievementSystem.removeCustomTask(taskId);
        return removed ? `✅ تم الحذف.` : `❌ غير موجود.`;
    }

    async handleListTasksCommand() {
        const achievementSystem = this.commandHandler ? await this.commandHandler.getSystem('achievement') : null;
        if (!achievementSystem) return '❌ نظام المهام غير متوفر.';
        const tasks = await achievementSystem.listCustomTasks();
        if (tasks.length === 0) return '📋 لا توجد مهام.';
        let msg = `📋 المهام (${tasks.length})\n`;
        tasks.forEach(t => {
            msg += `\n📌 ${t.name}\n   🆔 ${t.id}\n   🎯 ${achievementSystem._getTypeNameArabic(t.type)}\n   💰 ${t.reward} ريو\n`;
        });
        return msg;
    }

    async handleGrantAdmin(args, senderId, senderPlayer) {
        const isRoot = senderPlayer && senderPlayer.isRoot;
        const senderHasFull = senderPlayer && senderPlayer.hasPermission && senderPlayer.hasPermission('full_admin');

        if (!isRoot && !senderHasFull) return '❌ ليس لديك صلاحية.';
        if (args.length < 1) return `❌ الاستخدام: اعطاء_ادمن [ID] [مدة]`;

        const durationHours = args[1] ? parseInt(args[1]) : null;
        const result = await this.permissionSystem.grantPermission(args[0], 'full_admin', senderId, durationHours);
        return result.error || result.message;
    }

    async handleGrantPermission(args, senderId, senderPlayer) {
        const isRoot = senderPlayer && senderPlayer.isRoot;
        const senderHasFull = senderPlayer && senderPlayer.hasPermission && senderPlayer.hasPermission('full_admin');

        if (!isRoot && !senderHasFull) return '❌ ليس لديك صلاحية.';
        if (args.length < 2) return '❌ الاستخدام: اعطاء_صلاحية [ID] [النوع] [مدة]';

        const durationHours = args[2] ? parseInt(args[2]) : null;
        const result = await this.permissionSystem.grantPermission(args[0], args[1], senderId, durationHours);
        return result.error || result.message;
    }

    async handleRevokePermission(args, senderId, senderPlayer) {
        const isRoot = senderPlayer && senderPlayer.isRoot;
        const senderHasFull = senderPlayer && senderPlayer.hasPermission && senderPlayer.hasPermission('full_admin');

        if (!isRoot && !senderHasFull) return '❌ ليس لديك صلاحية.';
        if (args.length < 2) return '❌ الاستخدام: ازالة_صلاحية [ID] [النوع]';

        const result = await this.permissionSystem.revokePermission(args[0], args[1]);
        return result.error || result.message;
    }

    async handleListAdmins(senderId) {
        const result = await this.permissionSystem.showAllAdmins();
        return result.error || result.message;
    }

    async handleShowPermissions(args, senderId) {
        if (args.length < 1) return '❌ الاستخدام: صلاحيات [ID]';
        const result = await this.permissionSystem.showPlayerPermissions(args[0]);
        return result.error || result.message;
    }

    async handleJail(args, senderId, senderPlayer) {
        const isRoot = senderPlayer && senderPlayer.isRoot;
        const hasJailPerm = senderPlayer && senderPlayer.hasPermission && senderPlayer.hasPermission('jail');

        if (!isRoot && !hasJailPerm) return '❌ ليس لديك صلاحية.';
        if (args.length < 1) return '❌ الاستخدام: سجن [ID] [مدة]';

        const target = await Player.findByIdentifier(args[0]);
        if (!target) return `❌ لم يتم العثور.`;
        if (target.isRoot) return '❌ لا يمكن سجن الأدمن الرئيسي!';

        const durationInput = args[1];
        if (durationInput) {
            const durationMs = this._parseDuration(durationInput);
            if (!durationMs) return `❌ مدة خاطئة.`;
            target.jailedUntil = new Date(Date.now() + durationMs);
            target.jailedReason = 'سجن إداري';
            target.jailedBy = senderId;
            target.jailNotified = false;
            await target.save();
            return `🚔 تم سجن ${target.username}\n⏳ ${this._formatDuration(durationMs)}`;
        } else {
            target.jailedUntil = new Date(0);
            target.jailedReason = 'سجن دائم';
            target.jailedBy = senderId;
            target.jailNotified = false;
            await target.save();
            return `🚔 سجن دائم لـ ${target.username}`;
        }
    }

    async handleRelease(args, senderId, senderPlayer) {
        const isRoot = senderPlayer && senderPlayer.isRoot;
        const hasJailPerm = senderPlayer && senderPlayer.hasPermission && senderPlayer.hasPermission('jail');

        if (!isRoot && !hasJailPerm) return '❌ ليس لديك صلاحية.';
        if (args.length < 1) return '❌ الاستخدام: اطلاق [ID]';

        const target = await Player.findByIdentifier(args[0]);
        if (!target) return `❌ لم يتم العثور.`;
        if (!target.isJailed()) return '❌ اللاعب ليس مسجوناً.';

        target.jailedUntil = null;
        target.jailedReason = null;
        target.jailedBy = null;
        target.jailNotified = false;
        await target.save();
        return `✅ تم إطلاق ${target.username}.`;
    }

    async handleJailList(senderId, senderPlayer) {
        const isRoot = senderPlayer && senderPlayer.isRoot;
        const hasJailPerm = senderPlayer && senderPlayer.hasPermission && senderPlayer.hasPermission('jail');

        if (!isRoot && !hasJailPerm) return '❌ ليس لديك صلاحية.';

        const now = new Date();
        const jailed = await Player.find({
            $or: [
                { jailedUntil: { $gt: now } },
                { jailedUntil: { $eq: new Date(0) } }
            ]
        }).select('username playerId jailedUntil');

        if (jailed.length === 0) return '🚔 لا يوجد مسجونون.';

        let msg = `🚔 المسجونون (${jailed.length})\n\n`;
        jailed.forEach((p, i) => {
            const isPerm = p.jailedUntil.getTime() === 0;
            msg += `${i + 1}. ${p.username}\n`;
            msg += `   🆔 ${p.playerId}\n`;
            msg += `   ⏰ ${isPerm ? 'دائم' : p.jailedUntil.toLocaleString('ar-EG')}\n\n`;
        });
        return msg;
    }

    findAutoResponse(message) {
        return this.autoResponseSystem.findAutoResponse(message);
    }
    }
