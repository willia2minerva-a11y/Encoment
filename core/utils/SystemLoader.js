// core/utils/SystemLoader.js
// الموقع: مشترك - يُنسخ في مغارة ريو + سوق ريو
export class SystemLoader {
    static systems = {
        // ✅ جديد - مشترك
        'account': '../../systems/account/AccountSystem.js',
        
        // ✅ اقتصادي - مشترك
        'economy': '../../systems/economy/EconomySystem.js',
        'shop': '../../systems/economy/ShopSystem.js',
        'settings': '../../systems/settings/SettingsSystem.js',
        'giftcode': '../../systems/codes/GiftCodeSystem.js',
        'discountcode': '../../systems/codes/DiscountCodeSystem.js',
        
        // ✅ لعبة فقط
        'battle': '../../systems/battle/BattleSystem.js',
        'world': '../../systems/world/WorldMap.js',
        'gathering': '../../systems/gathering/GatheringSystem.js',
        'profile': '../../systems/profile/ProfileSystem.js',
        'registration': '../../systems/registration/RegistrationSystem.js',
        'autoResponse': '../../systems/autoResponse/AutoResponseSystem.js',
        'travel': '../../systems/world/TravelSystem.js',
        'crafting': '../../systems/crafting/CraftingSystem.js',
        'furnace': '../../systems/furnace/FurnaceSystem.js',
        'transaction': '../../systems/economy/TransactionSystem.js',
        'gate': '../../systems/world/GateSystem.js',
        'achievement': '../../systems/achievements/AchievementSystem.js',
        'referral': '../../systems/referral/ReferralSystem.js',
        'permission': '../../systems/permissions/PermissionSystem.js'
    };

    static async loadSystem(systemName) {
        try {
            if (this.systems[systemName]) {
                console.log(`🔄 تحميل: ${systemName}`);
                const module = await import(this.systems[systemName]);
                const SystemClass = module.default || Object.values(module)[0];
                if (SystemClass) {
                    console.log(`✅ تم تحميل: ${systemName}`);
                    return new SystemClass();
                }
            }
        } catch (error) {
            console.log(`⚠️ System ${systemName} not available:`, error.message);
        }
        return null;
    }
}
