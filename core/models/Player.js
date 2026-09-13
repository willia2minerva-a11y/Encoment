// core/Player.js
// الموقع: لعبة مغارة ريو (والسوق يستخدم نسخة مشابهة)
import mongoose from 'mongoose';
import { DataLoader } from '../systems/data/DataLoader.js';   // ✅ جديد

// ✅ بدلاً من global.itemsData
Object.defineProperty(global, 'itemsData', {
    get: () => DataLoader.getItems(),
    configurable: true
});

// ===================================
// Schemas فرعية
// ===================================
const inventoryItemSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0, default: 1 }
}, { _id: false });

const activeEffectSchema = new mongoose.Schema({
    type: { type: String, required: true },
    value: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    grantedBy: String,
    grantedAt: { type: Date, default: Date.now }
}, { _id: false });

const adminPermissionSchema = new mongoose.Schema({
    type: { type: String, required: true },
    grantedBy: String,
    grantedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null }
}, { _id: false });

const linkedPlatformSchema = new mongoose.Schema({
    platform: { 
        type: String, 
        enum: ['facebook', 'telegram'], 
        required: true 
    },
    platformId: { type: String, required: true },
    displayName: { type: String, default: null },
    linkedAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now }
}, { _id: false });

// ===================================
// Player Schema
// ===================================
const playerSchema = new mongoose.Schema({
    // ✅ الحساب
    username: { 
        type: String, 
        unique: true, 
        sparse: true,
        lowercase: true,
        trim: true
    },
    passwordHash: { type: String, default: null },
    gender: { 
        type: String, 
        enum: ['male', 'female', null], 
        default: null 
    },
    
    // ✅ ربط المنصات
    linkedPlatforms: [linkedPlatformSchema],
    loggedOutPlatforms: { type: [String], default: [] },
    
    // معلومات اللاعب
    playerId: { type: String, unique: true, sparse: true },
    name: { type: String, default: null },
    registrationStatus: { 
        type: String, 
        enum: ['pending', 'approved', 'completed'], 
        default: 'completed'
    },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: String, default: null },
    
    level: { type: Number, default: 1, min: 1 },
    experience: { type: Number, default: 0, min: 0 },
    gold: { type: Number, default: 10, min: 0 },
    
    transactions: [{
        id: { type: String, required: true },
        type: { type: String, required: true },
        amount: { type: Number, required: true },
        status: { type: String, default: 'completed' },
        description: { type: String, default: '' },
        targetPlayer: { type: String, default: null },
        createdAt: { type: Date, default: Date.now }
    }],
    
    health: { type: Number, default: 100, min: 0 },
    maxHealth: { type: Number, default: 100, min: 1 },
    mana: { type: Number, default: 50, min: 0 },
    maxMana: { type: Number, default: 50, min: 0 },
    stamina: { type: Number, default: 100, min: 0 },
    maxStamina: { type: Number, default: 100, min: 1 },
    lastStaminaAction: { type: Date, default: Date.now },
    lastHealthRegen: { type: Date, default: Date.now },
    lastManaRegen: { type: Date, default: Date.now },
    healthRegenRate: { type: Number, default: 0.5 },
    manaRegenRate: { type: Number, default: 0.3 },
    regenInterval: { type: Number, default: 300000 },
    currentLocation: { type: String, default: 'forest' },
    
    inventory: [inventoryItemSchema],
    skills: {
        gathering: { type: Number, default: 1 },
        combat: { type: Number, default: 1 },
        crafting: { type: Number, default: 1 }
    },
    equipment: {
        weapon: { type: String, default: null },
        armor: { type: String, default: null },
        accessory: { type: String, default: null },
        tool: { type: String, default: null }
    },
    stats: {
        battlesWon: { type: Number, default: 0 },
        battlesLost: { type: Number, default: 0 },
        monstersKilled: { type: Number, default: 0 },
        questsCompleted: { type: Number, default: 0 },
        resourcesGathered: { type: Number, default: 0 },
        itemsCrafted: { type: Number, default: 0 }
    },
    cooldowns: {
        gather: { type: Date, default: null },
        battle: { type: Date, default: null },
        craft: { type: Date, default: null }
    },
    dailyTaskDate: { type: String, default: '' },
    dailyTasksList: { type: Array, default: [] },
    dailyTaskProgress: { type: Map, of: Number, default: {} },
    completedDailyTasks: { type: [String], default: [] },
    unlockedAchievements: { type: [String], default: [] },
    
    referralCode: { type: String, unique: true, sparse: true },
    referralCount: { type: Number, default: 0 },
    referredPlayers: [{
        userId: String,
        name: String,
        date: { type: Date, default: Date.now }
    }],
    lastDailyReward: { type: Date, default: null },
    dailyStreak: { type: Number, default: 0 },
    
    bonusStats: {
        attack: { type: Number, default: 0 },
        defense: { type: Number, default: 0 },
        maxHealth: { type: Number, default: 0 },
        maxMana: { type: Number, default: 0 },
        maxStamina: { type: Number, default: 0 }
    },
    activeEffects: [activeEffectSchema],
    adminPermissions: [adminPermissionSchema],
    
    jailedUntil: { type: Date, default: null },
    jailedReason: { type: String, default: null },
    jailedBy: { type: String, default: null },
    jailNotified: { type: Boolean, default: false },
    
    banned: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// ===================================
// Methods
// ===================================

playerSchema.methods.isLinkedTo = function(platformId) {
    return (this.linkedPlatforms || []).some(p => p.platformId === platformId);
};

playerSchema.methods.linkPlatform = function(platform, platformId, displayName = null) {
    this.linkedPlatforms = this.linkedPlatforms || [];
    const existing = this.linkedPlatforms.find(p => p.platformId === platformId);
    
    if (existing) {
        existing.lastActive = new Date();
        if (displayName) existing.displayName = displayName;
        return { success: true, alreadyLinked: true };
    }
    
    if (this.linkedPlatforms.length >= 5) {
        return { error: '❌ الحد الأقصى 5 منصات لكل حساب.' };
    }
    
    this.linkedPlatforms.push({
        platform,
        platformId,
        displayName,
        linkedAt: new Date(),
        lastActive: new Date()
    });
    
    return { success: true };
};

playerSchema.methods.unlinkPlatform = function(platformId) {
    this.linkedPlatforms = (this.linkedPlatforms || []).filter(
        p => p.platformId !== platformId
    );
    
    if (!this.loggedOutPlatforms.includes(platformId)) {
        this.loggedOutPlatforms.push(platformId);
    }
    
    return { success: true };
};

playerSchema.methods.updateLastActive = function(platformId) {
    const linked = (this.linkedPlatforms || []).find(p => p.platformId === platformId);
    if (linked) linked.lastActive = new Date();
};

playerSchema.methods.hasActiveSession = function(platformId) {
    return this.isLinkedTo(platformId) && 
           !this.loggedOutPlatforms.includes(platformId);
};

playerSchema.methods.isJailed = function() {
    if (!this.jailedUntil) return false;
    if (this.jailedUntil.getTime() === 0) return true;
    return this.jailedUntil > new Date();
};

playerSchema.methods.getActivePermissions = function() {
    const now = new Date();
    return (this.adminPermissions || []).filter(p => {
        if (!p.expiresAt) return true;
        return p.expiresAt > now;
    });
};

playerSchema.methods.hasPermission = function(permissionType) {
    const perms = this.getActivePermissions();
    if (perms.some(p => p.type === 'full_admin')) return true;
    return perms.some(p => p.type === permissionType);
};

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

playerSchema.methods.isApproved = function() { return this.registrationStatus === 'completed'; };
playerSchema.methods.isPending = function() { return this.registrationStatus === 'pending'; };
playerSchema.methods.isApprovedButNotCompleted = function() { return this.registrationStatus === 'approved'; };

playerSchema.methods.getActualStamina = function() {
    const maxStam = this.maxStamina || 100;
    const lastActionTime = this.lastStaminaAction ? this.lastStaminaAction.getTime() : Date.now();
    const now = Date.now();
    const minutesPassed = (now - lastActionTime) / (1000 * 60);
    const recoveredStamina = Math.floor(minutesPassed * 5);
    this.stamina = Math.min(this.stamina + recoveredStamina, maxStam);
    if (recoveredStamina > 0) this.lastStaminaAction = new Date(now);
    return this.stamina;
};

playerSchema.methods.useStamina = function(amount) {
    const actualStamina = this.getActualStamina();
    if (actualStamina >= amount) {
        this.stamina = actualStamina - amount;
        this.lastStaminaAction = Date.now();
        return true;
    }
    return false;
};

playerSchema.methods.addGold = function(amount) {
    this.gold = (this.gold || 0) + amount;
    if (this.gold < 0) this.gold = 0;
};

playerSchema.methods.removeGold = function(amount) {
    if (this.gold >= amount) {
        this.gold -= amount;
        return true;
    }
    return false;
};

playerSchema.methods.addItem = function(id, name, type, quantity = 1) {
    if (!this.inventory) this.inventory = [];
    const existing = this.inventory.find(i => i.id === id);
    if (existing) existing.quantity += quantity;
    else this.inventory.push({ id, name, type, quantity });
};

playerSchema.methods.removeItem = function(id, quantity = 1) {
    if (!this.inventory) return false;
    const idx = this.inventory.findIndex(i => i.id === id);
    if (idx !== -1) {
        if (this.inventory[idx].quantity > quantity) this.inventory[idx].quantity -= quantity;
        else this.inventory.splice(idx, 1);
        return true;
    }
    return false;
};

playerSchema.methods.getItemQuantity = function(id) {
    if (!this.inventory) return 0;
    const item = this.inventory.find(i => i.id === id);
    return item ? item.quantity : 0;
};

playerSchema.methods.addExperience = function(amount) {
    this.experience = (this.experience || 0) + amount;
    const required = (this.level || 1) * 100;
    if (this.experience >= required) {
        this.levelUp();
        return true;
    }
    return false;
};

playerSchema.methods.levelUp = function() {
    this.level = (this.level || 1) + 1;
    this.experience = 0;
    if (!this.skills) this.skills = { gathering: 1, combat: 1, crafting: 1 };
    this.skills.combat += 0.1;
    this.skills.gathering += 0.1;
    this.skills.crafting += 0.1;
};

playerSchema.methods.heal = function(amount) {
    this.health = Math.min((this.health || 0) + amount, this.maxHealth);
};

playerSchema.methods.takeDamage = function(amount) {
    this.health = Math.max(0, (this.health || 0) - amount);
    return this.health > 0;
};

playerSchema.methods.respawn = function() {
    this.health = this.maxHealth || 100;
    this.mana = this.maxMana || 50;
    this.stamina = this.maxStamina || 100;
    this.currentLocation = 'forest';
    const goldLoss = Math.floor((this.gold || 0) * 0.1);
    this.gold = Math.max(0, this.gold - goldLoss);
    return goldLoss;
};

playerSchema.methods.setCooldown = function(action, minutes = 1) {
    if (!this.cooldowns) this.cooldowns = {};
    const t = new Date();
    t.setMinutes(t.getMinutes() + minutes);
    this.cooldowns[action] = t;
};

playerSchema.methods.getEquippedItemStats = function(itemsData) {
    const stats = { damage: 0, defense: 0, maxHealth: 0, maxMana: 0, maxStamina: 0, critChance: 0, healthRegen: 0 };
    if (!itemsData) return stats;
    for (const slot in this.equipment) {
        const id = this.equipment[slot];
        if (id && itemsData[id]?.stats) {
            const s = itemsData[id].stats;
            stats.damage += s.damage || 0;
            stats.defense += s.defense || 0;
            stats.maxHealth += s.maxHealth || 0;
            stats.maxMana += s.maxMana || 0;
            stats.maxStamina += s.maxStamina || 0;
            stats.critChance += s.critChance || 0;
            stats.healthRegen += s.healthRegen || 0;
        }
    }
    return stats;
};

playerSchema.methods.recalculateMaxStats = function(equipped) {
    const bonus = this.bonusStats || {};
    this.maxHealth = 100 + ((this.level || 1) - 1) * 20 + (equipped.maxHealth || 0) + (bonus.maxHealth || 0);
    this.maxMana = 50 + ((this.level || 1) - 1) * 10 + (equipped.maxMana || 0) + (bonus.maxMana || 0);
    this.maxStamina = 100 + (equipped.maxStamina || 0) + (bonus.maxStamina || 0);
    this.health = Math.min(this.health, this.maxHealth);
    this.mana = Math.min(this.mana, this.maxMana);
    this.stamina = Math.min(this.stamina, this.maxStamina);
};

playerSchema.methods.getTotalStats = function(itemsData) {
    const bonus = this.bonusStats || {};
    const eq = this.getEquippedItemStats(itemsData);
    return {
        damage: 10 + ((this.level || 1) - 1) * 2 + (eq.damage || 0) + (bonus.attack || 0),
        defense: 5 + ((this.level || 1) - 1) + (eq.defense || 0) + (bonus.defense || 0),
        maxHealth: 100 + ((this.level || 1) - 1) * 20 + (eq.maxHealth || 0) + (bonus.maxHealth || 0),
        maxMana: 50 + ((this.level || 1) - 1) * 10 + (eq.maxMana || 0) + (bonus.maxMana || 0),
        maxStamina: 100 + (eq.maxStamina || 0) + (bonus.maxStamina || 0),
        critChance: 5 + (eq.critChance || 0),
        healthRegen: 1 + (eq.healthRegen || 0)
    };
};

playerSchema.methods.getAttackDamage = function(itemsData) {
    if (!itemsData) return 10;
    const t = this.getTotalStats(itemsData);
    return Math.floor(t.damage * ((this.skills && this.skills.combat) || 1));
};

playerSchema.methods.getDefense = function(itemsData) {
    if (!itemsData) return 5;
    const t = this.getTotalStats(itemsData);
    return Math.floor(t.defense * ((this.skills && this.skills.combat) || 1));
};

playerSchema.methods.equipItem = function(itemId, itemType, itemsData) {
    if (this.getItemQuantity(itemId) === 0) {
        return { error: `❌ لا تملك هذا العنصر.` };
    }
    const slot = ['weapon', 'armor', 'accessory', 'tool'].includes(itemType) ? itemType : null;
    if (!slot) return { error: `❌ نوع غير صالح.` };
    const old = this.equipment[slot];
    this.equipment[slot] = itemId;
    this.recalculateMaxStats(this.getEquippedItemStats(itemsData));
    return { success: true, oldItemId: old };
};

playerSchema.methods.unequipItem = function(slot, itemsData) {
    if (!['weapon', 'armor', 'accessory', 'tool'].includes(slot)) {
        return { error: '❌ خانة غير صالحة.' };
    }
    const removed = this.equipment[slot];
    if (!removed) return { error: '❌ لا يوجد شيء.' };
    this.equipment[slot] = null;
    this.recalculateMaxStats(this.getEquippedItemStats(itemsData));
    return { success: true };
};

// ===================================
// Pre-save
// ===================================
playerSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    this.recalculateMaxStats(this.getEquippedItemStats(DataLoader.getItems()));
    next();
});

// ===================================
// Statics
// ===================================

playerSchema.statics.getLastPlayerNumericId = async function() {
    const last = await this.findOne({ playerId: { $regex: /^P\d+$/ } }).sort({ playerId: -1 }).exec();
    if (last?.playerId) {
        const id = parseInt(last.playerId.substring(1), 10);
        if (!isNaN(id) && id >= 1100) return id;
    }
    return 1099;
};

playerSchema.statics.getLastAdminNumericId = async function() {
    const last = await this.findOne({ playerId: { $regex: /^\d+$/ } }).sort({ playerId: -1 }).exec();
    if (last?.playerId) {
        const id = parseInt(last.playerId, 10);
        if (!isNaN(id) && id >= 1000) return id;
    }
    return 999;
};

playerSchema.statics.findByUsername = async function(username) {
    if (!username) return null;
    return await this.findOne({ username: username.toLowerCase().trim() });
};

playerSchema.statics.findByPlatform = async function(platformId) {
    if (!platformId) return null;
    return await this.findOne({ 'linkedPlatforms.platformId': platformId });
};

playerSchema.statics.findByIdentifier = async function(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim();

    let player = await this.findOne({ username: clean.toLowerCase() });
    if (player) return player;

    player = await this.findOne({ playerId: clean });
    if (player) return player;

    player = await this.findOne({ playerId: clean.toUpperCase() });
    if (player) return player;

    player = await this.findOne({ 'linkedPlatforms.platformId': clean });
    if (player) return player;

    return null;
};

playerSchema.statics.createAccount = async function(username, passwordHash, gender, platform, platformId, displayName) {
    const lastId = await this.getLastPlayerNumericId();
    const newPlayerId = `P${lastId + 1}`;

    if (lastId + 1 > 9999) throw new Error('تم الوصول للحد الأقصى من اللاعبين');

    const player = new this({
        username: username.toLowerCase(),
        passwordHash,
        gender,
        name: username,
        playerId: newPlayerId,
        registrationStatus: 'completed',
        linkedPlatforms: [{
            platform,
            platformId,
            displayName,
            linkedAt: new Date(),
            lastActive: new Date()
        }],
        level: 1,
        experience: 0,
        gold: 10,
        health: 100,
        maxHealth: 100,
        mana: 50,
        maxMana: 50,
        stamina: 100,
        maxStamina: 100,
        currentLocation: 'forest',
        inventory: [
            { id: 'wood', name: 'خشب', type: 'resource', quantity: 5 },
            { id: 'stone', name: 'حجر', type: 'resource', quantity: 3 }
        ],
        skills: { gathering: 1, combat: 1, crafting: 1 },
        equipment: { weapon: null, armor: null, accessory: null, tool: null },
        stats: { battlesWon: 0, battlesLost: 0, monstersKilled: 0, questsCompleted: 0, resourcesGathered: 0, itemsCrafted: 0 },
        bonusStats: { attack: 0, defense: 0, maxHealth: 0, maxMana: 0, maxStamina: 0 },
        activeEffects: [],
        adminPermissions: []
    });

    await player.save();
    return player;
};

const Player = mongoose.model('Player', playerSchema);
export default Player;
