import type {
  ComputedTankStats,
  ComputedWeaponStats,
  MapBiomeId,
  MapDefinition,
  TankCamoId,
  TankCamoSpec,
  TankTierId,
  TankTierSpec,
  TankUpgradeLevels,
  WeaponSpec
} from './types';

export const MAX_UPGRADE_LEVEL = 5;

export const TANK_TIER_ORDER: TankTierId[] = ['tier1', 'tier2', 'tier3', 'tier4', 'tier5'];

export const CAMO_ORDER: TankCamoId[] = ['default', 'forest', 'desert', 'arctic', 'crimson', 'black_red', 'vip_gold', 'neon_cyber'];

export const CAMO_SPECS: Record<TankCamoId, TankCamoSpec> = {
  default: {
    id: 'default',
    name: 'Стандарт',
    cost: 0,
    previewBg: 'linear-gradient(135deg, #4b5563, #6b7280)'
  },
  forest: {
    id: 'forest',
    name: 'Лісовий',
    cost: 250,
    previewBg: 'linear-gradient(135deg, #1f3d1a, #4d7c0f)',
    hullColor: 0x24421e,
    turretColor: 0x2f5727,
    trimColor: 0x3f6212,
    roughness: 0.78,
    metalness: 0.25
  },
  desert: {
    id: 'desert',
    name: 'Пустеля',
    cost: 350,
    previewBg: 'linear-gradient(135deg, #d4a373, #b45309)',
    hullColor: 0xc2955d,
    turretColor: 0xd4a373,
    trimColor: 0x92400e,
    roughness: 0.72,
    metalness: 0.25
  },
  arctic: {
    id: 'arctic',
    name: 'Зимовий',
    cost: 450,
    previewBg: 'linear-gradient(135deg, #e2e8f0, #64748b)',
    hullColor: 0xdbeafe,
    turretColor: 0x94a3b8,
    trimColor: 0x475569,
    headlightColor: 0xbae6fd,
    headlightEmissive: 0x38bdf8,
    roughness: 0.55,
    metalness: 0.35
  },
  crimson: {
    id: 'crimson',
    name: 'Червоний',
    cost: 300,
    previewBg: 'linear-gradient(135deg, #991b1b, #ef4444)',
    hullColor: 0xb91c1c,
    turretColor: 0x991b1b,
    trimColor: 0xf87171,
    armorDarkColor: 0x450a0a,
    headlightColor: 0xfecaca,
    headlightEmissive: 0xef4444,
    metalness: 0.45,
    roughness: 0.4
  },
  black_red: {
    id: 'black_red',
    name: 'Черв.-чорний',
    cost: 400,
    previewBg: 'linear-gradient(135deg, #09090b 40%, #ef4444 100%)',
    hullColor: 0x0b0b0f,
    turretColor: 0x141418,
    trimColor: 0x991b1b,
    armorDarkColor: 0x09090b,
    emissiveColor: 0x7f1d1d,
    emissiveIntensity: 0.55,
    headlightColor: 0xef4444,
    headlightEmissive: 0x991b1b,
    gunAccentColor: 0xf87171,
    gunEmissiveColor: 0xef4444,
    metalness: 0.75,
    roughness: 0.28
  },
  vip_gold: {
    id: 'vip_gold',
    name: 'VIP Золото',
    cost: 900,
    previewBg: 'linear-gradient(135deg, #18181b 45%, #f59e0b 100%)',
    hullColor: 0x141418,
    turretColor: 0x1c1917,
    trimColor: 0xf59e0b,
    armorDarkColor: 0x27272a,
    headlightColor: 0xfef08a,
    headlightEmissive: 0xf59e0b,
    metalness: 0.9,
    roughness: 0.22
  },
  neon_cyber: {
    id: 'neon_cyber',
    name: 'Неон Кібер',
    cost: 1200,
    previewBg: 'linear-gradient(135deg, #0f172a 40%, #06b6d4 100%)',
    hullColor: 0x0f172a,
    turretColor: 0x1e1b4b,
    trimColor: 0x06b6d4,
    emissiveColor: 0x0891b2,
    emissiveIntensity: 0.65,
    headlightColor: 0x67e8f9,
    headlightEmissive: 0x06b6d4,
    metalness: 0.75,
    roughness: 0.28
  }
};

export const MAP_ORDER: MapBiomeId[] = ['hills', 'desert', 'arctic', 'volcano', 'city'];

export const MAP_DEFINITIONS: Record<MapBiomeId, MapDefinition> = {
  hills: {
    id: 'hills',
    name: 'Малинівські Пагорби',
    subtitle: 'Зелені пагорби, лісосмуги та руїни села',
    skyColor: 0x87ceeb,
    fogColor: 0xc8e6c9,
    groundColor: 0x3d7032,
    hillColor: 0x2e5624
  },
  desert: {
    id: 'desert',
    name: 'Піщаний Каньйон',
    subtitle: 'Дюни Ель-Халлуфа, скелі та покинуті бункери',
    skyColor: 0xfde68a,
    fogColor: 0xfef3c7,
    groundColor: 0xd97706,
    hillColor: 0xb45309
  },
  arctic: {
    id: 'arctic',
    name: 'Полярний Рубіж',
    subtitle: 'Засніжені висоти, крижані скелі та ангари',
    skyColor: 0x93c5fd,
    fogColor: 0xe0f2fe,
    groundColor: 0xf1f5f9,
    hillColor: 0x94a3b8
  },
  volcano: {
    id: 'volcano',
    name: 'Вулканічна Долина',
    subtitle: 'Базальтові скелі, річки палаючої лави та попелясті кратери',
    skyColor: 0x2d0f0a,
    fogColor: 0x3d120a,
    groundColor: 0x1c1917,
    hillColor: 0x991b1b
  },
  city: {
    id: 'city',
    name: 'Хіммельсдорф',
    subtitle: 'Бруковані проспекти, зруйновані будівлі, Замкова гора та нічні вуличні бої',
    skyColor: 0x111827,     // Глибоке сутінкове нічне небо
    fogColor: 0x1f2937,     // Густий вечірній міський серпанок
    groundColor: 0x1f242d,  // Асфальт і темна бруківка
    hillColor: 0x4b5563     // Гранітний Замковий пагорб
  }
};

export const TANK_SPECS: Record<TankTierId, TankTierSpec> = {
  tier1: {
    id: 'tier1',
    tierNumber: 1,
    romanTier: 'I',
    classLabel: 'Легкий танк',
    name: 'ЛТ-1 «Блискавка»',
    subtitle: 'Швидкий розвідник для динамічних атак',
    description: 'Легкий маневрений танк першого рівня. Має високу швидкість та відмінну скорострільність гармати.',
    unlockCost: 0,
    baseHp: 260,
    baseSpeed: 13.5,
    reverseSpeed: 7.0,
    hullTurnSpeed: 2.8,
    turretTurnSpeed: 3.5,
    hullScaleLength: 1.0,
    hullScaleWidth: 1.0,
    hullColor: 0x16a34a,
    turretColor: 0x15803d,
    accentColor: 0x86efac,
    primaryWeapon: {
      slot: 1,
      name: '37-мм скорострільна гармата',
      shortName: '37-мм АП',
      damage: 45,
      reloadSec: 1.1,
      projectileSpeed: 48,
      projectileStyle: 'ap',
      aoeRadius: 0,
      dispersionDeg: 0.8
    },
    secondaryWeapon: {
      slot: 2,
      name: 'Легка арта "Град"',
      shortName: 'Арта',
      damage: 130,
      reloadSec: 10.0,
      projectileSpeed: 44,
      projectileStyle: 'mini_artillery',
      aoeRadius: 4.8,
      dispersionDeg: 0.8
    }
  },
  tier2: {
    id: 'tier2',
    tierNumber: 2,
    romanTier: 'II',
    classLabel: 'Середній танк',
    name: 'СТ-2 «Козак»',
    subtitle: 'Універсальний боєць передової',
    description: 'Збалансований середній танк з міцною бронею, гарною маневровістю та надійною нарізною гарматою.',
    unlockCost: 250,
    baseHp: 380,
    baseSpeed: 11.5,
    reverseSpeed: 6.0,
    hullTurnSpeed: 2.4,
    turretTurnSpeed: 3.0,
    hullScaleLength: 1.05,
    hullScaleWidth: 1.05,
    hullColor: 0x2563eb,
    turretColor: 0x1d4ed8,
    accentColor: 0x93c5fd,
    primaryWeapon: {
      slot: 1,
      name: '76-мм нарізна гармата Л-11',
      shortName: '76-мм ББ',
      damage: 75,
      reloadSec: 1.4,
      projectileSpeed: 52,
      projectileStyle: 'ap',
      aoeRadius: 0,
      dispersionDeg: 0.7
    },
    secondaryWeapon: {
      slot: 2,
      name: 'Артилерійська батарея',
      shortName: 'Арта',
      damage: 180,
      reloadSec: 10.0,
      projectileSpeed: 46,
      projectileStyle: 'mini_artillery',
      aoeRadius: 5.2,
      dispersionDeg: 0.75
    }
  },
  tier3: {
    id: 'tier3',
    tierNumber: 3,
    romanTier: 'III',
    classLabel: 'Важкий танк',
    name: 'ТТ-3 «Бастіон»',
    subtitle: 'Важкий штурмовий проривач',
    description: 'Потужний важкий танк з товстою бронею та важким калібром. Повільний, але нищівний у лобових сутичках.',
    unlockCost: 600,
    baseHp: 560,
    baseSpeed: 9.2,
    reverseSpeed: 4.8,
    hullTurnSpeed: 2.0,
    turretTurnSpeed: 2.4,
    hullScaleLength: 1.12,
    hullScaleWidth: 1.1,
    hullColor: 0xd97706,
    turretColor: 0xb45309,
    accentColor: 0xfde047,
    primaryWeapon: {
      slot: 1,
      name: '100-мм бронебійна гармата Д-10',
      shortName: '100-мм Важка',
      damage: 125,
      reloadSec: 1.9,
      projectileSpeed: 50,
      projectileStyle: 'heavy',
      aoeRadius: 0,
      dispersionDeg: 0.65
    },
    secondaryWeapon: {
      slot: 2,
      name: 'Важкий арт-дивізіон',
      shortName: 'Арта',
      damage: 240,
      reloadSec: 10.0,
      projectileSpeed: 48,
      projectileStyle: 'mini_artillery',
      aoeRadius: 5.8,
      dispersionDeg: 0.7
    }
  },
  tier4: {
    id: 'tier4',
    tierNumber: 4,
    romanTier: 'IV',
    classLabel: 'ПТ-САУ',
    name: 'ПТ-4 «Грім-Фугас»',
    subtitle: 'Винищувач танків з фугасною гаубицею',
    description: 'Потужна протитанкова гармата з величезним фугасним ураженням по площі для ліквідації скупчень ворогів.',
    unlockCost: 1100,
    baseHp: 680,
    baseSpeed: 9.8,
    reverseSpeed: 5.2,
    hullTurnSpeed: 2.2,
    turretTurnSpeed: 2.2,
    hullScaleLength: 1.18,
    hullScaleWidth: 1.12,
    hullColor: 0xdc2626,
    turretColor: 0xb91c1c,
    accentColor: 0xfca5a5,
    primaryWeapon: {
      slot: 1,
      name: '122-мм фугасна гаубиця М-30',
      shortName: '122-мм ОФ',
      damage: 185,
      reloadSec: 2.3,
      projectileSpeed: 44,
      projectileStyle: 'he',
      aoeRadius: 4.5,
      dispersionDeg: 0.85
    },
    secondaryWeapon: {
      slot: 2,
      name: 'Гаубичний арт-удар',
      shortName: 'Арта',
      damage: 310,
      reloadSec: 10.0,
      projectileSpeed: 50,
      projectileStyle: 'mini_artillery',
      aoeRadius: 6.4,
      dispersionDeg: 0.65
    }
  },
  tier5: {
    id: 'tier5',
    tierNumber: 5,
    romanTier: 'V',
    classLabel: 'Електро-Дредноут',
    name: 'Т-5 «Електро-Левіафан»',
    subtitle: 'Двогарматний футуристичний надважкий танк',
    description: 'Вершина танкобудування: 152-мм електромагнітна гармата Тесла та автономна задня скорострільна міні-артилерія!',
    unlockCost: 1800,
    baseHp: 950,
    baseSpeed: 10.2,
    reverseSpeed: 5.5,
    hullTurnSpeed: 1.9,
    turretTurnSpeed: 2.6,
    hullScaleLength: 1.85,
    hullScaleWidth: 1.15,
    hullColor: 0x1e293b,
    turretColor: 0x0f172a,
    accentColor: 0xef4444,
    primaryWeapon: {
      slot: 1,
      name: 'Електро-гармата Тесла 152 мм',
      shortName: '152-мм Тесла',
      damage: 240,
      reloadSec: 1.8,
      projectileSpeed: 58,
      projectileStyle: 'electric',
      aoeRadius: 3.2,
      chainCount: 2,
      chainRange: 9,
      dispersionDeg: 0.6
    },
    secondaryWeapon: {
      slot: 2,
      name: 'Орбітальна арта "Джміль"',
      shortName: 'Арта',
      damage: 380,
      reloadSec: 10.0,
      projectileSpeed: 54,
      projectileStyle: 'mini_artillery',
      aoeRadius: 7.2,
      dispersionDeg: 0.5
    }
  }
};

const UPGRADE_COSTS_BY_TIER: Record<number, number[]> = {
  1: [40, 75, 120, 180, 260],
  2: [60, 110, 175, 260, 370],
  3: [90, 155, 240, 350, 500],
  4: [130, 215, 325, 470, 660],
  5: [180, 290, 430, 620, 860]
};

export function getUpgradeCost(tierNumber: number, currentLevel: number): number {
  if (currentLevel < 0 || currentLevel >= MAX_UPGRADE_LEVEL) {
    return 9999;
  }
  const tierCosts = UPGRADE_COSTS_BY_TIER[tierNumber] ?? UPGRADE_COSTS_BY_TIER[1];
  return tierCosts[currentLevel] ?? 9999;
}

function computeWeaponStats(
  weapon: WeaponSpec,
  damageLevel: number,
  reloadLevel: number,
  damageMultiplier: number
): ComputedWeaponStats {
  const scaledDamage = Math.round(weapon.damage * (1 + damageLevel * 0.12) * damageMultiplier);
  const reloadFactor = Math.max(0.5, 1 - reloadLevel * 0.07);
  const scaledReload = Number(Math.max(0.05, weapon.reloadSec * reloadFactor).toFixed(3));

  return {
    slot: weapon.slot,
    name: weapon.name,
    shortName: weapon.shortName,
    damage: scaledDamage,
    reloadSec: scaledReload,
    projectileSpeed: weapon.projectileSpeed,
    projectileStyle: weapon.projectileStyle,
    aoeRadius: weapon.aoeRadius,
    chainCount: weapon.chainCount,
    chainRange: weapon.chainRange,
    dispersionDeg: weapon.dispersionDeg
  };
}

export function computeTankStats(
  tierId: TankTierId,
  upgrades: TankUpgradeLevels,
  damageMultiplier = 1
): ComputedTankStats {
  const spec = TANK_SPECS[tierId] ?? TANK_SPECS.tier1;
  const hpLevel = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, upgrades?.hp ?? 0));
  const damageLevel = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, upgrades?.damage ?? 0));
  const reloadLevel = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, upgrades?.reload ?? 0));
  const speedLevel = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, upgrades?.speed ?? 0));

  const maxHp = Math.round(spec.baseHp * (1 + hpLevel * 0.12));
  const speed = Number((spec.baseSpeed * (1 + speedLevel * 0.06)).toFixed(2));
  const reverseSpeed = Number((spec.reverseSpeed * (1 + speedLevel * 0.06)).toFixed(2));
  const hullTurnSpeed = Number((spec.hullTurnSpeed * (1 + speedLevel * 0.04)).toFixed(2));
  const turretTurnSpeed = Number((spec.turretTurnSpeed * (1 + reloadLevel * 0.04)).toFixed(2));

  const primaryWeapon = computeWeaponStats(spec.primaryWeapon, damageLevel, reloadLevel, damageMultiplier);
  const secondaryWeapon = spec.secondaryWeapon
    ? computeWeaponStats(spec.secondaryWeapon, damageLevel, reloadLevel, damageMultiplier)
    : null;

  return {
    maxHp,
    speed,
    reverseSpeed,
    hullTurnSpeed,
    turretTurnSpeed,
    primaryWeapon,
    secondaryWeapon
  };
}
