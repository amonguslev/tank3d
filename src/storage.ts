import { CAMO_ORDER, MAP_ORDER, MAX_UPGRADE_LEVEL, TANK_SPECS, TANK_TIER_ORDER } from './classes';
import type { BattleSummary, MapBiomeId, SaveData, TankCamoId, TankTierId, TankUpgradeLevels } from './types';

const STORAGE_KEY_V3 = 'tank_3d_wot_save_v3';
const STORAGE_KEY_V2 = 'tank_3d_pwa_save_v2';
const STORAGE_KEY_V1 = 'tank_3d_pwa_save_v1';

function createDefaultUpgrades(): TankUpgradeLevels {
  return {
    hp: 0,
    damage: 0,
    reload: 0,
    speed: 0
  };
}

function sanitizeUpgrades(raw: Partial<TankUpgradeLevels> | undefined): TankUpgradeLevels {
  return {
    hp: Math.max(0, Math.min(MAX_UPGRADE_LEVEL, Number(raw?.hp) || 0)),
    damage: Math.max(0, Math.min(MAX_UPGRADE_LEVEL, Number(raw?.damage) || 0)),
    reload: Math.max(0, Math.min(MAX_UPGRADE_LEVEL, Number(raw?.reload) || 0)),
    speed: Math.max(0, Math.min(MAX_UPGRADE_LEVEL, Number(raw?.speed) || 0))
  };
}

function createDefaultSave(): SaveData {
  return {
    coins: 200,
    selectedTank: 'tier1',
    unlockedTanks: ['tier1'],
    tankUpgrades: {
      tier1: createDefaultUpgrades(),
      tier2: createDefaultUpgrades(),
      tier3: createDefaultUpgrades(),
      tier4: createDefaultUpgrades(),
      tier5: createDefaultUpgrades()
    },
    unlockedCamos: ['default'],
    selectedCamo: 'default',
    tankCamos: {
      tier1: 'default',
      tier2: 'default',
      tier3: 'default',
      tier4: 'default',
      tier5: 'default'
    },
    selectedMap: 'hills',
    testDriveEnabled: false,
    bestWave: 0,
    bestScore: 0,
    duelWins: 0,
    teamBattleWins: 0,
    totalKills: 0,
    muted: false,
    touchEnabled: null
  };
}

export class StorageManager {
  private data: SaveData;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      if (typeof localStorage === 'undefined') {
        return createDefaultSave();
      }

      // 1. Direct v3 loading
      const rawV3 = localStorage.getItem(STORAGE_KEY_V3);
      if (rawV3) {
        const parsed = JSON.parse(rawV3) as Partial<SaveData>;

        const unlockedTanks: TankTierId[] = Array.isArray(parsed.unlockedTanks)
          ? parsed.unlockedTanks.filter((t): t is TankTierId => typeof t === 'string' && TANK_TIER_ORDER.includes(t as TankTierId))
          : ['tier1'];
        if (!unlockedTanks.includes('tier1')) {
          unlockedTanks.unshift('tier1');
        }

        const testDriveEnabled = Boolean(parsed.testDriveEnabled);

        const selectedTank: TankTierId =
          parsed.selectedTank &&
          TANK_TIER_ORDER.includes(parsed.selectedTank) &&
          (unlockedTanks.includes(parsed.selectedTank) || testDriveEnabled)
            ? parsed.selectedTank
            : 'tier1';

        const tankUpgrades: Record<TankTierId, TankUpgradeLevels> = {
          tier1: sanitizeUpgrades(parsed.tankUpgrades?.tier1),
          tier2: sanitizeUpgrades(parsed.tankUpgrades?.tier2),
          tier3: sanitizeUpgrades(parsed.tankUpgrades?.tier3),
          tier4: sanitizeUpgrades(parsed.tankUpgrades?.tier4),
          tier5: sanitizeUpgrades(parsed.tankUpgrades?.tier5)
        };

        const selectedMap: MapBiomeId =
          parsed.selectedMap && MAP_ORDER.includes(parsed.selectedMap)
            ? parsed.selectedMap
            : 'hills';

        const unlockedCamos: TankCamoId[] = Array.isArray(parsed.unlockedCamos)
          ? parsed.unlockedCamos.filter((c): c is TankCamoId => typeof c === 'string' && CAMO_ORDER.includes(c as TankCamoId))
          : ['default'];
        if (!unlockedCamos.includes('default')) {
          unlockedCamos.unshift('default');
        }

        const selectedCamo: TankCamoId =
          parsed.selectedCamo &&
          CAMO_ORDER.includes(parsed.selectedCamo) &&
          unlockedCamos.includes(parsed.selectedCamo)
            ? parsed.selectedCamo
            : 'default';

        const sanitizeCamoRecord = (raw?: Partial<Record<TankTierId, TankCamoId>>): Record<TankTierId, TankCamoId> => {
          const res: Record<TankTierId, TankCamoId> = {
            tier1: 'default',
            tier2: 'default',
            tier3: 'default',
            tier4: 'default',
            tier5: 'default'
          };
          for (const t of TANK_TIER_ORDER) {
            const val = raw?.[t];
            if (val && CAMO_ORDER.includes(val) && unlockedCamos.includes(val)) {
              res[t] = val;
            } else {
              res[t] = selectedCamo;
            }
          }
          return res;
        };

        const tankCamos = sanitizeCamoRecord(parsed.tankCamos);

        return {
          coins: typeof parsed.coins === 'number' && parsed.coins >= 0 ? parsed.coins : 200,
          selectedTank,
          unlockedTanks,
          tankUpgrades,
          unlockedCamos,
          selectedCamo,
          tankCamos,
          selectedMap,
          testDriveEnabled: Boolean(parsed.testDriveEnabled),
          bestWave: typeof parsed.bestWave === 'number' && parsed.bestWave >= 0 ? parsed.bestWave : 0,
          bestScore: typeof parsed.bestScore === 'number' && parsed.bestScore >= 0 ? parsed.bestScore : 0,
          duelWins: typeof parsed.duelWins === 'number' && parsed.duelWins >= 0 ? parsed.duelWins : 0,
          teamBattleWins: typeof parsed.teamBattleWins === 'number' && parsed.teamBattleWins >= 0 ? parsed.teamBattleWins : 0,
          totalKills: typeof parsed.totalKills === 'number' && parsed.totalKills >= 0 ? parsed.totalKills : 0,
          muted: Boolean(parsed.muted),
          touchEnabled: typeof parsed.touchEnabled === 'boolean' ? parsed.touchEnabled : null
        };
      }

      // 2. Migration from v2
      const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
      if (rawV2) {
        const parsedV2 = JSON.parse(rawV2) as Record<string, unknown>;
        const migrated = createDefaultSave();

        if (typeof parsedV2.coins === 'number' && parsedV2.coins > 0) {
          migrated.coins = Math.max(200, Math.round(parsedV2.coins));
        }
        if (typeof parsedV2.bestScore === 'number') {
          migrated.bestScore = Math.max(0, parsedV2.bestScore);
        }
        if (typeof parsedV2.totalKills === 'number') {
          migrated.totalKills = Math.max(0, parsedV2.totalKills);
        }
        if (typeof parsedV2.bestHordeWave === 'number') {
          migrated.bestWave = Math.max(0, parsedV2.bestHordeWave);
        }
        if (typeof parsedV2.muted === 'boolean') {
          migrated.muted = parsedV2.muted;
        }
        if (typeof parsedV2.touchEnabled === 'boolean') {
          migrated.touchEnabled = parsedV2.touchEnabled;
        }

        try {
          localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(migrated));
        } catch {
          // ignore
        }
        return migrated;
      }

      // 3. Migration from v1
      const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
      if (rawV1) {
        const parsedV1 = JSON.parse(rawV1) as Record<string, unknown>;
        const migrated = createDefaultSave();

        if (typeof parsedV1.bestScore === 'number') {
          migrated.bestScore = Math.max(0, parsedV1.bestScore);
        }
        if (typeof parsedV1.totalKills === 'number') {
          migrated.totalKills = Math.max(0, parsedV1.totalKills);
        }
        if (typeof parsedV1.muted === 'boolean') {
          migrated.muted = parsedV1.muted;
        }
        if (typeof parsedV1.touchEnabled === 'boolean') {
          migrated.touchEnabled = parsedV1.touchEnabled;
        }

        try {
          localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(migrated));
        } catch {
          // ignore
        }
        return migrated;
      }

      const initial = createDefaultSave();
      try {
        localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(initial));
      } catch {
        // ignore
      }
      return initial;
    } catch {
      return createDefaultSave();
    }
  }

  private persist(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_V3, JSON.stringify(this.data));
      }
    } catch {
      // Ignore quota or privacy mode errors
    }
  }

  save(): void {
    this.persist();
  }

  private getHighestUnlockedTank(): TankTierId {
    for (let i = TANK_TIER_ORDER.length - 1; i >= 0; i--) {
      const tier = TANK_TIER_ORDER[i];
      if (this.data.unlockedTanks.includes(tier)) {
        return tier;
      }
    }
    return 'tier1';
  }

  private ensureValidSelectedTank(): void {
    if (!this.data.testDriveEnabled && !this.data.unlockedTanks.includes(this.data.selectedTank)) {
      this.data.selectedTank = this.getHighestUnlockedTank();
    }
  }

  getData(): Readonly<SaveData> {
    return this.data;
  }

  addCoins(amount: number): void {
    if (typeof amount === 'number' && amount > 0) {
      this.data.coins += Math.round(amount);
      this.persist();
    }
  }

  spendCoins(amount: number): boolean {
    const cost = Math.round(amount);
    if (cost > 0 && this.data.coins >= cost) {
      this.data.coins -= cost;
      this.persist();
      return true;
    }
    return false;
  }

  unlockTank(tierId: TankTierId, cost?: number): boolean {
    if (!TANK_TIER_ORDER.includes(tierId)) {
      return false;
    }
    if (this.data.unlockedTanks.includes(tierId)) {
      return true;
    }
    const finalCost = cost !== undefined ? cost : (TANK_SPECS[tierId]?.unlockCost ?? 0);
    if (finalCost <= 0 || this.spendCoins(finalCost)) {
      this.data.unlockedTanks.push(tierId);
      this.persist();
      return true;
    }
    return false;
  }

  isTankAvailable(tierId: TankTierId): boolean {
    return this.data.testDriveEnabled || this.data.unlockedTanks.includes(tierId);
  }

  selectTank(tierId: TankTierId): boolean {
    if (this.data.unlockedTanks.includes(tierId) || this.data.testDriveEnabled) {
      this.data.selectedTank = tierId;
      this.persist();
      return true;
    }
    return false;
  }

  isCamoUnlocked(camoId: TankCamoId): boolean {
    return Array.isArray(this.data.unlockedCamos) && this.data.unlockedCamos.includes(camoId);
  }

  getSelectedCamo(tierId?: TankTierId): TankCamoId {
    const targetTier = tierId || this.data.selectedTank;
    return this.data.tankCamos?.[targetTier] || this.data.selectedCamo || 'default';
  }

  selectCamo(camoId: TankCamoId, tierId?: TankTierId): boolean {
    if (!this.isCamoUnlocked(camoId)) {
      return false;
    }
    this.data.selectedCamo = camoId;
    const targetTier = tierId || this.data.selectedTank;
    if (!this.data.tankCamos) {
      this.data.tankCamos = {
        tier1: 'default',
        tier2: 'default',
        tier3: 'default',
        tier4: 'default',
        tier5: 'default'
      };
    }
    this.data.tankCamos[targetTier] = camoId;
    this.save();
    return true;
  }

  unlockCamo(camoId: TankCamoId, cost: number, tierId?: TankTierId): boolean {
    if (!CAMO_ORDER.includes(camoId)) {
      return false;
    }
    if (this.isCamoUnlocked(camoId)) {
      this.selectCamo(camoId, tierId);
      return true;
    }
    const price = Math.round(cost);
    if (price <= 0 || this.spendCoins(price)) {
      if (!this.data.unlockedCamos.includes(camoId)) {
        this.data.unlockedCamos.push(camoId);
      }
      this.selectCamo(camoId, tierId);
      this.save();
      return true;
    }
    return false;
  }

  upgradeStat(tierId: TankTierId, stat: keyof TankUpgradeLevels, cost: number): boolean {
    if (!TANK_TIER_ORDER.includes(tierId)) {
      return false;
    }
    if (!this.data.tankUpgrades[tierId]) {
      this.data.tankUpgrades[tierId] = createDefaultUpgrades();
    }
    const current = this.data.tankUpgrades[tierId][stat] ?? 0;
    if (current >= MAX_UPGRADE_LEVEL) {
      return false;
    }
    if (this.spendCoins(cost)) {
      this.data.tankUpgrades[tierId][stat] = current + 1;
      this.persist();
      return true;
    }
    return false;
  }

  /** Alias for upgradeStat */
  upgradeTankStat(tierId: TankTierId, stat: keyof TankUpgradeLevels, cost: number): boolean {
    return this.upgradeStat(tierId, stat, cost);
  }

  selectMap(mapId: MapBiomeId): boolean {
    if (MAP_ORDER.includes(mapId)) {
      this.data.selectedMap = mapId;
      this.persist();
      return true;
    }
    return false;
  }

  setTestDrive(enabled: boolean): void {
    this.data.testDriveEnabled = Boolean(enabled);
    this.ensureValidSelectedTank();
    this.persist();
  }

  toggleTestDrive(): boolean {
    this.data.testDriveEnabled = !this.data.testDriveEnabled;
    this.ensureValidSelectedTank();
    this.persist();
    return this.data.testDriveEnabled;
  }

  recordBattleResult(result: BattleSummary): void {
    this.data.totalKills += Math.max(0, Math.round(result.kills || 0));

    if (typeof result.score === 'number' && result.score > this.data.bestScore) {
      this.data.bestScore = Math.round(result.score);
    }

    if (result.mode === 'waves' && typeof result.waveReached === 'number' && result.waveReached > this.data.bestWave) {
      this.data.bestWave = Math.round(result.waveReached);
    }

    if (result.mode === 'duel' && result.victory) {
      this.data.duelWins += 1;
    }

    if (result.mode === 'team_battle' && result.victory) {
      this.data.teamBattleWins += 1;
    }

    if (typeof result.coinsEarned === 'number' && result.coinsEarned > 0) {
      this.data.coins += Math.round(result.coinsEarned);
    }

    this.persist();
  }

  updateScore(score: number): boolean {
    if (score > this.data.bestScore) {
      this.data.bestScore = Math.round(score);
      this.persist();
      return true;
    }
    return false;
  }

  updateBestWave(wave: number): boolean {
    if (wave > this.data.bestWave) {
      this.data.bestWave = Math.round(wave);
      this.persist();
      return true;
    }
    return false;
  }

  addKill(count = 1): void {
    this.data.totalKills += Math.max(1, Math.round(count));
    this.persist();
  }

  setMuted(muted: boolean): void {
    this.data.muted = Boolean(muted);
    this.persist();
  }

  setTouchEnabled(enabled: boolean | null): void {
    this.data.touchEnabled = enabled;
    this.persist();
  }

  resetProgress(): void {
    this.data = createDefaultSave();
    this.persist();
  }
}
