export type GameModeKind = 'waves' | 'duel';

export type MapBiomeId = 'hills' | 'desert' | 'arctic';

export type TankTierId = 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'tier5';

export type WeaponSlot = 1 | 2;

export type ProjectileStyle = 'ap' | 'heavy' | 'he' | 'electric' | 'mini_artillery';

export type PowerUpKind = 'repair' | 'damage' | 'speed' | 'shield';

export interface TankUpgradeLevels {
  hp: number;     // 0..5
  damage: number; // 0..5
  reload: number; // 0..5
  speed: number;  // 0..5
}

export interface WeaponSpec {
  slot: WeaponSlot;
  name: string;
  shortName: string;
  damage: number;
  reloadSec: number;
  projectileSpeed: number;
  projectileStyle: ProjectileStyle;
  aoeRadius: number;
  chainCount?: number;
  chainRange?: number;
  dispersionDeg: number;
}

export interface TankTierSpec {
  id: TankTierId;
  tierNumber: 1 | 2 | 3 | 4 | 5;
  romanTier: 'I' | 'II' | 'III' | 'IV' | 'V';
  classLabel: string;
  name: string;
  subtitle: string;
  description: string;
  unlockCost: number;
  baseHp: number;
  baseSpeed: number;
  reverseSpeed: number;
  hullTurnSpeed: number;
  turretTurnSpeed: number;
  hullScaleLength: number;
  hullScaleWidth: number;
  hullColor: number;
  turretColor: number;
  accentColor: number;
  primaryWeapon: WeaponSpec;
  secondaryWeapon?: WeaponSpec;
}

export interface ComputedWeaponStats {
  slot: WeaponSlot;
  name: string;
  shortName: string;
  damage: number;
  reloadSec: number;
  projectileSpeed: number;
  projectileStyle: ProjectileStyle;
  aoeRadius: number;
  chainCount?: number;
  chainRange?: number;
  dispersionDeg: number;
}

export interface ComputedTankStats {
  maxHp: number;
  speed: number;
  reverseSpeed: number;
  hullTurnSpeed: number;
  turretTurnSpeed: number;
  primaryWeapon: ComputedWeaponStats;
  secondaryWeapon: ComputedWeaponStats | null;
}

export interface MapDefinition {
  id: MapBiomeId;
  name: string;
  subtitle: string;
  skyColor: number;
  fogColor: number;
  groundColor: number;
  hillColor: number;
}

export interface SaveData {
  coins: number;
  selectedTank: TankTierId;
  unlockedTanks: TankTierId[];
  tankUpgrades: Record<TankTierId, TankUpgradeLevels>;
  selectedMap: MapBiomeId;
  testDriveEnabled: boolean;
  bestWave: number;
  bestScore: number;
  duelWins: number;
  totalKills: number;
  muted: boolean;
  touchEnabled: boolean | null;
}

export interface MinimapEntity {
  kind: 'player' | 'enemy' | 'boss' | 'pickup';
  x: number;
  z: number;
  yaw?: number;
}

export interface HudState {
  mode: GameModeKind;
  mapId: MapBiomeId;
  mapName: string;
  waveNumber: number;
  enemiesRemaining: number;
  totalKillsInRun: number;
  score: number;
  bestWave: number;
  coins: number;
  coinsEarnedInRun: number;
  playerHp: number;
  playerMaxHp: number;
  speedKmh: number;
  activeWeaponSlot: WeaponSlot;
  hasSecondaryWeapon: boolean;
  primaryWeaponName: string;
  secondaryWeaponName: string | null;
  primaryReloadLeft: number;
  primaryReloadTotal: number;
  secondaryReloadLeft: number;
  secondaryReloadTotal: number;
  repairCooldownLeft: number;
  repairCooldownTotal: number;
  isSniper: boolean;
  sniperZoom: number;
  aimDistanceMeters: number;
  targetEnemyName: string | null;
  targetEnemyHp: number;
  targetEnemyMaxHp: number;
  bossName: string | null;
  bossHp: number;
  bossMaxHp: number;
  damageBoostTimer: number;
  shieldTimer: number;
  testDriveActive: boolean;
  worldHalfSize: number;
  cameraYaw: number;
  hullYaw: number;
  turretYaw: number;
  minimapEntities: MinimapEntity[];
}

export interface FloatingTextItem {
  x: number;
  y: number;
  text: string;
  color: string;
  big?: boolean;
}

export interface BattleSummary {
  victory: boolean;
  mode: GameModeKind;
  waveReached: number;
  kills: number;
  damageDealt: number;
  coinsEarned: number;
  score: number;
  isNewBestWave: boolean;
}
