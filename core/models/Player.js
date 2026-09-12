// core/models/Player.js
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
    id: { type: String, required: true },
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, default: 'completed' },
    description: { type: String, default: '' },
    targetPlayer: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

const playerSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    platform: { type: String, default: 'facebook' },
    name: { type: String, required: true },
    playerId: { type: String, unique: true, sparse: true },
    registrationStatus: { type: String, default: 'pending' },
    gold: { type: Number, default: 0, min: 0 },

    // المعاملات
    transactions: [transactionSchema],

    // الإحالة
    referralCode: { type: String, unique: true, sparse: true },
    referralCount: { type: Number, default: 0 },
    referredPlayers: [{
        userId: String,
        name: String,
        date: { type: Date, default: Date.now }
    }],

    // الأكواد المستخدمة
    usedGiftCodes: { type: [String], default: [] },

    // الخصم المطبق
    appliedDiscount: {
        code: { type: String, default: null },
        percentage: { type: Number, default: 0 },
        expiresAt: { type: Date, default: null }
    },

    // الحظر والسجن
    banned: { type: Boolean, default: false },
    jailedUntil: { type: Date, default: null },
    jailedReason: { type: String, default: null },
    jailNotified: { type: Boolean, default: false }
}, {
    timestamps: true,
    strict: false,
    collection: 'players',
    optimisticConcurrency: false // ✅ منع خطأ "No matching document"
});

// ✅ فحص السجن
playerSchema.methods.isJailed = function() {
    if (!this.jailedUntil) return false;
    if (this.jailedUntil.getTime() === 0) return true; // دائم
    return this.jailedUntil > new Date();
};

// ✅ إضافة معاملة
playerSchema.methods.addTransaction = function(type, amount, description, targetPlayer = null) {
    this.transactions = this.transactions || [];
    this.transactions.push({
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        amount,
        status: 'completed',
        description,
        targetPlayer,
        createdAt: new Date()
    });
};

// ✅ حفظ آمن (يتجاهل خطأ الوثيقة المحذوفة)
playerSchema.methods.safeSave = async function() {
    try {
        await this.save();
        return true;
    } catch (error) {
        if (error.name === 'DocumentNotFoundError' || error.message?.includes('No matching document')) {
            console.warn('⚠️ الوثيقة غير موجودة، يتم تجاهل الحفظ');
            return false;
        }
        throw error;
    }
};

// ✅ البحث بأي معرف
playerSchema.statics.findByIdentifier = async function(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim();

    let player = await this.findOne({ userId: clean });
    if (player) return player;

    player = await this.findOne({ playerId: clean });
    if (player) return player;

    player = await this.findOne({ playerId: clean.toUpperCase() });
    if (player) return player;

    player = await this.findOne({ name: new RegExp(`^${clean}$`, 'i') });
    if (player) return player;

    player = await this.findOne({ name: new RegExp(clean, 'i') });
    return player;
};

// ✅ إضافة ريو بأمان (بدون save)
playerSchema.statics.addGoldSafe = async function(userId, amount, transaction = null) {
    const update = { $inc: { gold: amount } };
    
    if (transaction) {
        update.$push = {
            transactions: {
                $each: [{
                    id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    ...transaction,
                    createdAt: new Date()
                }],
                $position: 0
            }
        };
    }

    return await this.updateOne({ userId }, update);
};

// ✅ خصم ريو بأمان
playerSchema.statics.removeGoldSafe = async function(userId, amount, transaction = null) {
    const update = { $inc: { gold: -amount } };
    
    if (transaction) {
        update.$push = {
            transactions: {
                $each: [{
                    id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    ...transaction,
                    createdAt: new Date()
                }],
                $position: 0
            }
        };
    }

    return await this.updateOne({ userId }, update);
};

const Player = mongoose.models.Player || mongoose.model('Player', playerSchema);
export default Player;
