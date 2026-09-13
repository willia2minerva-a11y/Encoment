// data/items.js
import { resources } from './resources.js';
import { weapons } from './weapons.js';
import { armors } from './armors.js';
import { accessories } from './accessories.js';
import { itemsGates } from './items_gates.js';


// دالة مساعدة لتحويل إحصائيات الأسلحة إلى تنسيق stats الموحد
const convertWeaponStats = (weapon) => {
  if (!weapon.attack) return weapon;
  
  return {
    ...weapon,
    stats: {
      damage: weapon.attack,
      // يمكن إضافة المزيد من الإحصائيات هنا إذا كانت موجودة
      ...(weapon.critChance && { critChance: weapon.critChance }),
      ...(weapon.attackSpeed && { attackSpeed: weapon.attackSpeed })
    }
  };
};

// دالة مساعدة لتحويل إحصائيات الدروع إلى تنسيق stats الموحد
const convertArmorStats = (armor) => {
  if (!armor.defense) return armor;
  
  return {
    ...armor,
    stats: {
      defense: armor.defense,
      // إضافة إحصائيات إضافية للدروع
      ...(armor.critResist && { critResist: armor.critResist }),
      ...(armor.part === 'helmet' && { maxHealth: Math.floor(armor.defense * 0.5) }),
      ...(armor.part === 'chestplate' && { maxHealth: Math.floor(armor.defense * 1.0) }),
      ...(armor.part === 'leggings' && { maxHealth: Math.floor(armor.defense * 0.7) })
    }
  };
};

// دالة مساعدة لتحويل إحصائيات الإكسسوارات
const convertAccessoryStats = (accessory) => {
  if (!accessory.effects) return accessory;
  
  const stats = {};
  
  // تحويل effects إلى stats
  if (accessory.effects.attackFlat) stats.damage = accessory.effects.attackFlat;
  if (accessory.effects.attackPct) stats.damagePercent = accessory.effects.attackPct * 100;
  if (accessory.effects.defenseFlat) stats.defense = accessory.effects.defenseFlat;
  if (accessory.effects.defensePct) stats.defensePercent = accessory.effects.defensePct * 100;
  if (accessory.effects.critChance) stats.critChance = accessory.effects.critChance;
  if (accessory.effects.regen) stats.healthRegen = accessory.effects.regen;
  if (accessory.effects.lifeStealPct) stats.lifeSteal = accessory.effects.lifeStealPct * 100;
  
  return {
    ...accessory,
    stats: Object.keys(stats).length > 0 ? stats : undefined
  };
};

// تحويل جميع العناصر
const convertedWeapons = Object.fromEntries(
  Object.entries(weapons).map(([key, weapon]) => [key, convertWeaponStats(weapon)])
);

const convertedArmors = Object.fromEntries(
  Object.entries(armors).map(([key, armor]) => [key, convertArmorStats(armor)])
);

const convertedAccessories = Object.fromEntries(
  Object.entries(accessories).map(([key, accessory]) => [key, convertAccessoryStats(accessory)])
);

export const items = {
  ...resources,
  ...convertedWeapons,
  ...convertedArmors,
  ...convertedAccessories,
  ...itemsGates
};
