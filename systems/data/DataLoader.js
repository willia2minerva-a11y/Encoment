// systems/data/DataLoader.js
// الموقع: مشترك - يُنسخ في مغارة ريو + سوق ريو
import mongoose from 'mongoose';

export class DataLoader {
    // ===================================
    // المتغيرات الثابتة (Cache)
    // ===================================
    static items = {};
    static resources = {};
    static monsters = {};
    static locations = {};
    static recipes = {};
    static gates = {};
    static npcs = {};
    static skills = {};
    static weapons = {};
    static armors = {};
    static accessories = {};
    static crafting = {};
    static itemGates = {};

    static isLoaded = false;
    static loadSource = 'none'; // 'mongodb' | 'files' | 'none'

    // ===================================
    // initialize - يُستدعى مرة واحدة عند بدء البوت
    // ===================================
    static async initialize() {
        if (this.isLoaded) {
            console.log('⚠️ DataLoader محمّل بالفعل');
            return true;
        }

        console.log('📦 بدء تحميل البيانات...');

        try {
            // ✅ محاولة القراءة من MongoDB أولاً
            const success = await this._loadFromMongoDB();
            
            if (success) {
                this.loadSource = 'mongodb';
                this.isLoaded = true;
                console.log('✅ تم تحميل البيانات من MongoDB');
                this._logSummary();
                return true;
            }

            // ⚠️ إذا فشل MongoDB → ارجع للملفات
            console.log('⚠️ MongoDB فشل - سيتم استخدام الملفات');
            const fileSuccess = await this._loadFromFiles();
            
            if (fileSuccess) {
                this.loadSource = 'files';
                this.isLoaded = true;
                console.log('✅ تم تحميل البيانات من الملفات');
                this._logSummary();
                return true;
            }

            // ❌ كلاهما فشل
            console.error('❌ فشل تحميل البيانات من جميع المصادر');
            return false;

        } catch (error) {
            console.error('❌ خطأ في initialize:', error);
            return false;
        }
    }

    // ===================================
    // _loadFromMongoDB - قراءة من MongoDB
    // ===================================
    static async _loadFromMongoDB() {
        try {
            if (mongoose.connection.readyState !== 1) {
                console.log('⚠️ MongoDB غير متصل');
                return false;
            }

            const db = mongoose.connection.db;
            
            // قراءة كل collection
            const collections = await db.listCollections().toArray();
            const collectionNames = collections.map(c => c.name);

            console.log(`📊 Collections الموجودة: ${collectionNames.length}`);

            // دالة مساعدة لقراءة collection
            const loadCollection = async (name) => {
                if (!collectionNames.includes(name)) {
                    console.log(`   ⚠️ ${name} غير موجودة`);
                    return {};
                }

                try {
                    const doc = await db.collection(name).findOne({});
                    if (!doc) return {};

                    // حذف الحقول الخاصة
                    const { _id, __v, id, ...data } = doc;

                    // إذا كان المستند يحتوي على حقل واحد فقط (id) وحقول أخرى
                    // نعيد البيانات كما هي
                    const keys = Object.keys(data);
                    console.log(`   ✅ ${name}: ${keys.length} عنصر`);
                    return data;

                } catch (error) {
                    console.log(`   ❌ فشل قراءة ${name}:`, error.message);
                    return {};
                }
            };

            // قراءة الكل بالتوازي
            const [
                items, resources, monsters, locations,
                recipes, gates, npcs, skills,
                weapons, armors, accessories,
                crafting, itemGates
            ] = await Promise.all([
                loadCollection('items'),
                loadCollection('resources'),
                loadCollection('monsters'),
                loadCollection('locations'),
                loadCollection('recipes'),
                loadCollection('gates'),
                loadCollection('npcs'),
                loadCollection('skills'),
                loadCollection('weapons'),
                loadCollection('armors'),
                loadCollection('accessories'),
                loadCollection('craftings'),
                loadCollection('itemgates')
            ]);

            // ✅ دمج الأسلحة والدروع والإكسسوارات في items
            this.items = {
                ...items,
                ...weapons,
                ...armors,
                ...accessories
            };
            
            this.resources = resources;
            this.monsters = monsters;
            this.locations = locations;
            this.recipes = recipes;
            this.gates = gates;
            this.npcs = npcs;
            this.skills = skills;
            this.weapons = weapons;
            this.armors = armors;
            this.accessories = accessories;
            this.crafting = crafting;
            this.itemGates = itemGates;

            // ✅ التحقق من وجود بيانات أساسية
            if (Object.keys(this.items).length === 0) {
                console.log('⚠️ items فارغة في MongoDB');
                return false;
            }

            return true;

        } catch (error) {
            console.error('❌ خطأ في MongoDB load:', error.message);
            return false;
        }
    }

    // ===================================
    // _loadFromFiles - قراءة من الملفات (احتياطي)
    // ===================================
    static async _loadFromFiles() {
        try {
            console.log('📂 محاولة التحميل من الملفات...');

            // ✅ محاولة قراءة الملفات الموجودة (قد تفشل بعضها)
            const loadFile = async (path, defaultValue = {}) => {
                try {
                    const module = await import(path);
                    const data = module.default || module[Object.keys(module)[0]] || defaultValue;
                    return data;
                } catch (e) {
                    console.log(`   ⚠️ فشل تحميل ${path}:`, e.message);
                    return defaultValue;
                }
            };

            const [
                items, resources, monsters, locations,
                recipes, gates
            ] = await Promise.all([
                loadFile('../../data/items.js'),
                loadFile('../../data/resources.js'),
                loadFile('../../data/monsters.js'),
                loadFile('../../data/locations.js'),
                loadFile('../../data/recipes.js'),
                loadFile('../../data/gates.js')
            ]);

            this.items = items;
            this.resources = resources;
            this.monsters = monsters;
            this.locations = locations;
            this.recipes = recipes;
            this.gates = gates;

            // إذا كانت items فارغة تماماً
            if (Object.keys(this.items).length === 0) {
                console.log('⚠️ لا توجد items في الملفات أيضاً');
                return false;
            }

            return true;

        } catch (error) {
            console.error('❌ خطأ في الملفات:', error.message);
            return false;
        }
    }

    // ===================================
    // _logSummary - عرض ملخص
    // ===================================
    static _logSummary() {
        console.log('');
        console.log('📊 ملخص البيانات المحمّلة:');
        console.log(`   📦 items: ${Object.keys(this.items).length}`);
        console.log(`   🌿 resources: ${Object.keys(this.resources).length}`);
        console.log(`   👹 monsters: ${Object.keys(this.monsters).length}`);
        console.log(`   📍 locations: ${Object.keys(this.locations).length}`);
        console.log(`   📜 recipes: ${Object.keys(this.recipes).length}`);
        console.log(`   🚪 gates: ${Object.keys(this.gates).length}`);
        console.log(`   ⚔️ weapons: ${Object.keys(this.weapons).length}`);
        console.log(`   🛡️ armors: ${Object.keys(this.armors).length}`);
        console.log(`   💍 accessories: ${Object.keys(this.accessories).length}`);
        console.log(`   📱 المصدر: ${this.loadSource}`);
        console.log('');
    }

    // ===================================
    // Getters - للوصول السريع
    // ===================================
    static getItems() {
        return this.items;
    }

    static getResources() {
        return this.resources;
    }

    static getMonsters() {
        return this.monsters;
    }

    static getLocations() {
        return this.locations;
    }

    static getRecipes() {
        return this.recipes;
    }

    static getGates() {
        return this.gates;
    }

    static getNpcs() {
        return this.npcs;
    }

    static getSkills() {
        return this.skills;
    }

    static getWeapons() {
        return this.weapons;
    }

    static getArmors() {
        return this.armors;
    }

    static getAccessories() {
        return this.accessories;
    }

    static getCrafting() {
        return this.crafting;
    }

    static getItemGates() {
        return this.itemGates;
    }

    // ===================================
    // refresh - إعادة التحميل (بعد إضافة/حذف)
    // ===================================
    static async refresh() {
        console.log('🔄 إعادة تحميل البيانات...');
        this.isLoaded = false;
        return await this.initialize();
    }

    // ===================================
    // معلومات
    // ===================================
    static getStatus() {
        return {
            isLoaded: this.isLoaded,
            loadSource: this.loadSource,
            counts: {
                items: Object.keys(this.items).length,
                resources: Object.keys(this.resources).length,
                monsters: Object.keys(this.monsters).length,
                locations: Object.keys(this.locations).length,
                recipes: Object.keys(this.recipes).length,
                gates: Object.keys(this.gates).length
            }
        };
    }
}

export default DataLoader;
