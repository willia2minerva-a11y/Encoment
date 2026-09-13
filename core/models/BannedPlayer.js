// core/models/BannedPlayer.js
// الموقع: سوق ريو
import mongoose from 'mongoose';

const bannedPlayerSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    playerId: { type: String, default: null },
    platform: { type: String, default: 'facebook' },
    bannedBy: { type: String, required: true },
    bannedAt: { type: Date, default: Date.now },
    reason: { type: String, default: 'حظر إداري' },
    level: { type: Number, default: 1 },
    gold: { type: Number, default: 0 },
    wasAdmin: { type: Boolean, default: false },
    adminPermissions: { type: Array, default: [] },
    linkedPlatformIds: { type: [String], default: [] }
}, { timestamps: true });

// ✅ عرض قائمة المحظورين (بصفحات)
bannedPlayerSchema.statics.getBannedList = async function(page = 1, perPage = 20) {
    const total = await this.countDocuments();
    const totalPages = Math.ceil(total / perPage);
    
    if (page < 1 || page > totalPages) {
        return { error: `❌ الصفحة ${page} غير موجودة. الإجمالي: ${totalPages}` };
    }
    
    const skip = (page - 1) * perPage;
    
    const banned = await this.find({})
        .sort({ bannedAt: -1 })
        .skip(skip)
        .limit(perPage);
    
    return {
        success: true,
        banned,
        page,
        totalPages,
        total
    };
};

// ✅ فحص إذا كان userId محظوراً
bannedPlayerSchema.statics.isBanned = async function(userId) {
    const banned = await this.findOne({ userId });
    return !!banned;
};

// ✅ حذف من قائمة المحظورين (رفع الحظر نهائياً)
bannedPlayerSchema.statics.removeBan = async function(identifier) {
    if (!identifier) return { error: '❌ يجب تحديد المعرف' };
    
    const clean = identifier.trim();
    
    let banned = await this.findOne({ userId: clean });
    if (!banned) banned = await this.findOne({ playerId: clean });
    if (!banned) banned = await this.findOne({ name: new RegExp(`^${clean}$`, 'i') });
    
    if (!banned) {
        return { error: `❌ لم يتم العثور على المحظور: ${identifier}` };
    }
    
    const info = {
        userId: banned.userId,
        name: banned.name,
        playerId: banned.playerId
    };
    
    await this.deleteOne({ _id: banned._id });
    
    return { success: true, info };
};

const BannedPlayer = mongoose.models.BannedPlayer || mongoose.model('BannedPlayer', bannedPlayerSchema);
export default BannedPlayer;
