export type GameModeKind = 'waves' | 'duel' | 'team_battle';

export type TeamSide = 'allies' | 'enemies';

export type MapBiomeId = 'hills' | 'desert' | 'arctic';

export type TankTierId = 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'tier5';

export type TankCamoId = 'default' | 'forest' | 'desert' | 'arctic' | 'crimson' | 'black_red' | 'vip_gold' | 'neon_cyber';

export interface TankCamoSpec {
  id: TankCamoId;
  name: string;
  cost: number;
  previewBg: string; // CSS background/gradient для свотча
  hullColor?: number;
  turretColor?: number;
  trimColor?: number;
  armorDarkColor?: number;
  metalness?: number;
  roughness?: number;
  emissiveColor?: number;
  emissiveIntensity?: number;
  headlightColor?: number;
  headlightEmissive?: number;
  gunAccentColor?: number;
  gunEmissiveColor?: number;
}

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
  unlockedCamos: TankCamoId[];
  selectedCamo: TankCamoId;
  tankCamos: Record<TankTierId, TankCamoId>;
  selectedMap: MapBiomeId;
  testDriveEnabled: boolean;
  bestWave: number;
  bestScore: number;
  duelWins: number;
  teamBattleWins: number;
  totalKills: number;
  muted: boolean;
  touchEnabled: boolean | null;
}

export interface MinimapEntity {
  kind: 'player' | 'enemy' | 'boss' | 'pickup' | 'ally' | 'base';
  x: number;
  z: number;
  yaw?: number;
  captureState?: TeamSide | 'contested' | null;
}

export interface EnemyPlateInfo {
  id: number;
  romanTier: string;
  name: string;
  hp: number;
  maxHp: number;
  isBoss: boolean;
  screenX: number;
  screenY: number;
  hpPercent?: number;
  isAlly?: boolean;
}

export interface TeamRosterEntry {
  tier: number;
  alive: boolean;
  isPlayer?: boolean;
}

export interface TeamBattleHudState {
  alliesAlive: number;
  enemiesAlive: number;
  alliesRoster: TeamRosterEntry[];
  enemiesRoster: TeamRosterEntry[];
  captureProgress: number; // 0..100
  captureTeam: TeamSide | 'contested' | null;
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
  teamBattle?: TeamBattleHudState | null;
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
