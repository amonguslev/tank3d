import type {
  ComputedTankStats,
  ComputedWeaponStats,
  MapBiomeId,
  MapDefinition,
  TankTierId,
  TankTierSpec,
  TankUpgradeLevels,
  WeaponSpec
} from './types';

export const MAX_UPGRADE_LEVEL = 5;

export const TANK_TIER_ORDER: TankTierId[] = ['tier1', 'tier2', 'tier3', 'tier4', 'tier5'];

export const MAP_ORDER: MapBiomeId[] = ['hills', 'desert', 'arctic'];

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
    accentColor: 0x38bdf8,
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
      name: 'Задня міні-арта "Джміль"',
      shortName: 'Міні-Арта',
      damage: 38,
      reloadSec: 0.22,
      projectileSpeed: 46,
      projectileStyle: 'mini_artillery',
      aoeRadius: 2.2,
      dispersionDeg: 1.4
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
