// core/utils/SystemLoader.js
// الموقع: مشترك - يُنسخ في مغارة ريو + سوق ريو
export class SystemLoader {
    static systems = {
        // ✅ نظام الحسابات (مشترك)
        'account': '../../systems/account/AccountSystem.js',
        
        // ✅ الردود التلقائية
        'autoResponse': '../../systems/autoResponse/AutoResponseSystem.js',
        
        // ✅ الصلاحيات
        'permission': '../../systems/permissions/PermissionSystem.js',
        
        // ✅ أنظمة السوق (في وضع السوق فقط، لكنها موجودة أيضاً في اللعبة)
        'economy': '../../systems/economy/EconomySystem.js',
        'shop': '../../systems/economy/ShopSystem.js',
        'settings': '../../systems/settings/SettingsSystem.js',
        'giftcode': '../../systems/codes/GiftCodeSystem.js',
        'discountcode': '../../systems/codes/DiscountCodeSystem.js',
        
        // ✅ أنظمة اللعبة (تُحمَّل عند الحاجة)
        'battle': '../../systems/battle/BattleSystem.js',
        'world': '../../systems/world/WorldMap.js',
        'gathering': '../../systems/gathering/GatheringSystem.js',
        'profile': '../../systems/profile/ProfileSystem.js',
        'registration': '../../systems/registration/RegistrationSystem.js',
        'travel': '../../systems/world/TravelSystem.js',
        'crafting': '../../systems/crafting/CraftingSystem.js',
        'furnace': '../../systems/furnace/FurnaceSystem.js',
        'transaction': '../../systems/economy/TransactionSystem.js',
        'gate': '../../systems/world/GateSystem.js',
        'achievement': '../../systems/achievements/AchievementSystem.js',
        'referral': '../../systems/referral/ReferralSystem.js'
    };

    static async loadSystem(systemName) {
        if (!this.systems[systemName]) {
            console.error(`❌ نظام غير معروف: ${systemName}`);
            return null;
        }

        const path = this.systems[systemName];
        console.log(`🔄 تحميل النظام: ${systemName}`);
        console.log(`   → المسار: ${path}`);

        try {
            const module = await import(path);
            const SystemClass = module.default || Object.values(module)[0];
            
            if (!SystemClass) {
                console.error(`❌ لا يوجد export في: ${path}`);
                return null;
            }

            const instance = new SystemClass();
            console.log(`✅ تم تحميل ${systemName} بنجاح`);
            return instance;
        } catch (error) {
            console.error(`❌ فشل تحميل ${systemName}:`);
            console.error(`   → الرسالة: ${error.message}`);
            console.error(`   → الملف: ${error.url || path}`);
            console.error(`   → Stack:`, error.stack?.split('\n').slice(0, 5).join('\n'));
            return null;
        }
    }
}
