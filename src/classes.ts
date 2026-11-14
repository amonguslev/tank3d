import type { ComputedTankStats, TankClassId, TankClassSpec, TankUpgradeLevels } from './types';

export const MAX_UPGRADE_LEVEL = 5;

export const TANK_CLASS_ORDER: TankClassId[] = ['allrounder', 'apc', 'rocket', 'railgun'];

export const TANK_CLASSES: Record<TankClassId, TankClassSpec> = {
  allrounder: {
    id: 'allrounder',
    name: 'Універсал «Козак»',
    subtitle: 'Середній бойовий танк',
    description: 'Збалансована броня, швидкість і надійна бронебійна гармата.',
    unlockCost: 0,
    baseHp: 120,
    baseDamage: 36,
    baseReload: 0.38,
    baseSpeed: 7.0,
    bulletSpeed: 20,
    maxActiveBullets: 3,
    aoeRadius: 0,
    piercing: false,
    breaksSteelBase: false,
    hullColor: 0xf59e0b,
    turretColor: 0xfbbf24
  },
  apc: {
    id: 'apc',
    name: 'БТР «Стриж»',
    subtitle: 'Скорострільний розвідник',
    description: 'Висока маневровість та спарена автоматична гармата для шквального вогню.',
    unlockCost: 350,
    baseHp: 95,
    baseDamage: 16,
    baseReload: 0.14,
    baseSpeed: 8.8,
    bulletSpeed: 24,
    maxActiveBullets: 6,
    aoeRadius: 0,
    piercing: false,
    breaksSteelBase: false,
    hullColor: 0x06b6d4,
    turretColor: 0x67e8f9
  },
  rocket: {
    id: 'rocket',
    name: 'РСЗВ «Град»',
    subtitle: 'Ракетна установка AoE',
    description: 'Випускає фугасні ракети, що вибухають по площі й трощать скупчення ворогів та цеглу.',
    unlockCost: 750,
    baseHp: 140,
    baseDamage: 64,
    baseReload: 0.72,
    baseSpeed: 6.0,
    bulletSpeed: 16,
    maxActiveBullets: 2,
    aoeRadius: 2.7,
    piercing: false,
    breaksSteelBase: false,
    hullColor: 0xea580c,
    turretColor: 0xfb923c
  },
  railgun: {
    id: 'railgun',
    name: 'Титан «Мамонт»',
    subtitle: 'Важкий рейлган',
    description: 'Надважка броня та електромагнітний постріл, що прошиває ворогів наскрізь і руйнує сталь.',
    unlockCost: 1300,
    baseHp: 195,
    baseDamage: 98,
    baseReload: 0.92,
    baseSpeed: 5.2,
    bulletSpeed: 36,
    maxActiveBullets: 2,
    aoeRadius: 0,
    piercing: true,
    breaksSteelBase: true,
    hullColor: 0x6366f1,
    turretColor: 0x38bdf8
  }
};

const UPGRADE_COSTS: number[] = [80, 150, 260, 420, 650];
const BASE_UPGRADE_COSTS: number[] = [100, 200, 350, 550, 800];

export function getUpgradeCost(currentLevel: number): number {
  if (currentLevel < 0 || currentLevel >= MAX_UPGRADE_LEVEL) {
    return 9999;
  }
  return UPGRADE_COSTS[currentLevel] ?? 9999;
}

export function getBaseUpgradeCost(currentLevel: number): number {
  if (currentLevel < 0 || currentLevel >= MAX_UPGRADE_LEVEL) {
    return 9999;
  }
  return BASE_UPGRADE_COSTS[currentLevel] ?? 9999;
}

export function computeTankStats(
  classId: TankClassId,
  upgrades: TankUpgradeLevels,
  inRunStars = 0
): ComputedTankStats {
  const spec = TANK_CLASSES[classId] ?? TANK_CLASSES.allrounder;
  const armorLevel = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, upgrades?.armor ?? 0));
  const damageLevel = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, upgrades?.damage ?? 0));
  const fireRateLevel = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, upgrades?.fireRate ?? 0));
  const speedLevel = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, upgrades?.speed ?? 0));
  const stars = Math.max(0, inRunStars);

  const maxHp = Math.round(spec.baseHp * (1 + armorLevel * 0.18));
  const damage = Math.round(spec.baseDamage * (1 + damageLevel * 0.15 + stars * 0.10));

  let reloadDelay = spec.baseReload * Math.max(0.4, 1 - fireRateLevel * 0.08);
  if (stars >= 2) {
    reloadDelay *= 0.90;
  }
  reloadDelay = Number(Math.max(0.06, reloadDelay).toFixed(3));

  const speed = Number((spec.baseSpeed * (1 + speedLevel * 0.06) + (stars >= 1 ? 0.5 : 0)).toFixed(2));
  const bulletSpeed = spec.bulletSpeed + (stars >= 1 ? 4 : 0);
  const maxActiveBullets = spec.maxActiveBullets + (stars >= 2 ? 1 : 0);
  const aoeRadius = spec.aoeRadius;
  const piercing = spec.piercing;
  const breaksSteel = spec.breaksSteelBase || stars >= 3;

  return {
    maxHp,
    damage,
    reloadDelay,
    speed,
    bulletSpeed,
    maxActiveBullets,
    aoeRadius,
    piercing,
    breaksSteel
  };
}

export function computeBaseMaxHp(baseHpLevel: number): number {
  const level = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, baseHpLevel));
  return 260 + level * 90;
}
