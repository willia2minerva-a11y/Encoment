// core/utils/SystemLoader.js
export class SystemLoader {
    static systems = {
        'economy': '../../systems/economy/EconomySystem.js',
        'shop': '../../systems/economy/ShopSystem.js',
        'settings': '../../systems/settings/SettingsSystem.js',
        'giftcode': '../../systems/codes/GiftCodeSystem.js',
        'discountcode': '../../systems/codes/DiscountCodeSystem.js'
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
