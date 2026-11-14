export type GameModeKind = 'campaign' | 'horde';

export type CameraMode = 'angled' | 'top' | 'follow';

export type BiomeId = 'industrial' | 'desert' | 'arctic' | 'volcanic';

export type TankClassId = 'allrounder' | 'apc' | 'rocket' | 'railgun';

export type EnemyKind = 'basic' | 'fast' | 'power' | 'armor';

export type BossId = 'mammoth' | 'artillery' | 'cryo' | 'inferno';

export type PowerUpKind = 'star' | 'shield' | 'clock' | 'shovel' | 'grenade' | 'life' | 'repair';

export enum SubTile {
  Empty = 0,
  Brick = 1,
  Steel = 2,
  Water = 3,
  Forest = 4,
  Ice = 5,
  Base = 6
}

export interface TankUpgradeLevels {
  armor: number;    // 0..5
  damage: number;   // 0..5
  fireRate: number; // 0..5
  speed: number;    // 0..5
}

export interface TankClassSpec {
  id: TankClassId;
  name: string;
  subtitle: string;
  description: string;
  unlockCost: number;
  baseHp: number;
  baseDamage: number;
  baseReload: number;
  baseSpeed: number;
  bulletSpeed: number;
  maxActiveBullets: number;
  aoeRadius: number;
  piercing: boolean;
  breaksSteelBase: boolean;
  hullColor: number;
  turretColor: number;
}

export interface ComputedTankStats {
  maxHp: number;
  damage: number;
  reloadDelay: number;
  speed: number;
  bulletSpeed: number;
  maxActiveBullets: number;
  aoeRadius: number;
  piercing: boolean;
  breaksSteel: boolean;
}

export interface SaveData {
  coins: number;
  selectedClass: TankClassId;
  unlockedClasses: TankClassId[];
  tankUpgrades: Record<TankClassId, TankUpgradeLevels>;
  baseHpLevel: number; // 0..5
  bestScore: number;
  bestHordeWave: number;
  unlockedStage: number;
  totalKills: number;
  muted: boolean;
  cameraMode: CameraMode;
  touchEnabled: boolean | null;
}

export interface BossSpec {
  id: BossId;
  name: string;
  maxHp: number;
  speed: number;
  contactDamage: number;
  rewardCoins: number;
  points: number;
}

export interface BarrelSpawn {
  x: number;
  z: number;
}

export interface StageDefinition {
  id: number;
  name: string;
  biome: BiomeId;
  /** 18 rows of 18 chars (macro-grid 18x18 -> sub-grid 36x36, world -18..+18) */
  layout: string[];
  enemies: EnemyKind[];
  boss?: BossSpec;
}

export interface StageKills {
  basic: number;
  fast: number;
  power: number;
  armor: number;
  boss: number;
}

export interface HudState {
  mode: GameModeKind;
  stageOrWave: number;
  stageName: string;
  biome: BiomeId;
  enemiesRemaining: number;
  lives: number;
  playerHp: number;
  playerMaxHp: number;
  baseHp: number;
  baseMaxHp: number;
  stars: number;
  score: number;
  bestScore: number;
  coins: number;
  shieldTimer: number;
  freezeTimer: number;
  shovelTimer: number;
  bossName: string | null;
  bossHp: number;
  bossMaxHp: number;
}

export interface RadarIndicator {
  kind: 'base' | 'boss' | 'enemy';
  x: number;
  y: number;
  angleRad: number;
  urgent?: boolean;
}

export interface FloatingTextItem {
  x: number;
  y: number;
  text: string;
  color: string;
  big?: boolean;
}
