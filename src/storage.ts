import type { CameraMode, SaveData, TankClassId, TankUpgradeLevels } from './types';

const STORAGE_KEY_V2 = 'tank_3d_pwa_save_v2';
const STORAGE_KEY_V1 = 'tank_3d_pwa_save_v1';

const VALID_CLASSES: TankClassId[] = ['allrounder', 'apc', 'rocket', 'railgun'];

function createDefaultUpgrades(): TankUpgradeLevels {
  return {
    armor: 0,
    damage: 0,
    fireRate: 0,
    speed: 0
  };
}

function sanitizeUpgrades(raw: Partial<TankUpgradeLevels> | undefined): TankUpgradeLevels {
  return {
    armor: Math.max(0, Math.min(5, Number(raw?.armor) || 0)),
    damage: Math.max(0, Math.min(5, Number(raw?.damage) || 0)),
    fireRate: Math.max(0, Math.min(5, Number(raw?.fireRate) || 0)),
    speed: Math.max(0, Math.min(5, Number(raw?.speed) || 0))
  };
}

function createDefaultSave(): SaveData {
  return {
    coins: 0,
    selectedClass: 'allrounder',
    unlockedClasses: ['allrounder'],
    tankUpgrades: {
      allrounder: createDefaultUpgrades(),
      apc: createDefaultUpgrades(),
      rocket: createDefaultUpgrades(),
      railgun: createDefaultUpgrades()
    },
    baseHpLevel: 0,
    bestScore: 0,
    bestHordeWave: 0,
    unlockedStage: 1,
    totalKills: 0,
    muted: false,
    cameraMode: 'angled',
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
      const rawV2 = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_V2) : null;
      if (rawV2) {
        const parsed = JSON.parse(rawV2) as Partial<SaveData>;
        const unlockedClasses: TankClassId[] = Array.isArray(parsed.unlockedClasses)
          ? parsed.unlockedClasses.filter((c): c is TankClassId => typeof c === 'string' && VALID_CLASSES.includes(c as TankClassId))
          : ['allrounder'];
        if (!unlockedClasses.includes('allrounder')) {
          unlockedClasses.unshift('allrounder');
        }

        const selectedClass: TankClassId =
          parsed.selectedClass && VALID_CLASSES.includes(parsed.selectedClass) && unlockedClasses.includes(parsed.selectedClass)
            ? parsed.selectedClass
            : 'allrounder';

        const tankUpgrades: Record<TankClassId, TankUpgradeLevels> = {
          allrounder: sanitizeUpgrades(parsed.tankUpgrades?.allrounder),
          apc: sanitizeUpgrades(parsed.tankUpgrades?.apc),
          rocket: sanitizeUpgrades(parsed.tankUpgrades?.rocket),
          railgun: sanitizeUpgrades(parsed.tankUpgrades?.railgun)
        };

        const cameraMode: CameraMode =
          parsed.cameraMode === 'angled' || parsed.cameraMode === 'top' || parsed.cameraMode === 'follow'
            ? parsed.cameraMode
            : 'angled';

        return {
          coins: typeof parsed.coins === 'number' && parsed.coins >= 0 ? parsed.coins : 0,
          selectedClass,
          unlockedClasses,
          tankUpgrades,
          baseHpLevel: Math.max(0, Math.min(5, Number(parsed.baseHpLevel) || 0)),
          bestScore: typeof parsed.bestScore === 'number' && parsed.bestScore >= 0 ? parsed.bestScore : 0,
          bestHordeWave: typeof parsed.bestHordeWave === 'number' && parsed.bestHordeWave >= 0 ? parsed.bestHordeWave : 0,
          unlockedStage: typeof parsed.unlockedStage === 'number' ? Math.max(1, parsed.unlockedStage) : 1,
          totalKills: typeof parsed.totalKills === 'number' && parsed.totalKills >= 0 ? parsed.totalKills : 0,
          muted: Boolean(parsed.muted),
          cameraMode,
          touchEnabled: typeof parsed.touchEnabled === 'boolean' ? parsed.touchEnabled : null
        };
      }

      // Check migration from v1
      const rawV1 = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_V1) : null;
      if (rawV1) {
        const parsedV1 = JSON.parse(rawV1) as Record<string, unknown>;
        const initial = createDefaultSave();

        if (typeof parsedV1.bestScore === 'number') {
          initial.bestScore = Math.max(0, parsedV1.bestScore);
        }
        if (typeof parsedV1.unlockedStage === 'number') {
          initial.unlockedStage = Math.max(1, parsedV1.unlockedStage);
        }
        if (typeof parsedV1.totalKills === 'number') {
          initial.totalKills = Math.max(0, parsedV1.totalKills);
        }
        if (typeof parsedV1.muted === 'boolean') {
          initial.muted = parsedV1.muted;
        }
        if (parsedV1.cameraMode === 'angled' || parsedV1.cameraMode === 'top' || parsedV1.cameraMode === 'follow') {
          initial.cameraMode = parsedV1.cameraMode;
        }
        if (typeof parsedV1.touchEnabled === 'boolean') {
          initial.touchEnabled = parsedV1.touchEnabled;
        }

        // Persist initial v2 save right away
        try {
          localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(initial));
        } catch {
          // ignore
        }
        return initial;
      }

      return createDefaultSave();
    } catch {
      return createDefaultSave();
    }
  }

  private persist(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(this.data));
      }
    } catch {
      // Ignore quota or privacy mode errors
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

  unlockClass(classId: TankClassId, cost: number): boolean {
    if (!VALID_CLASSES.includes(classId)) {
      return false;
    }
    if (this.data.unlockedClasses.includes(classId)) {
      return true;
    }
    if (this.spendCoins(cost)) {
      this.data.unlockedClasses.push(classId);
      this.persist();
      return true;
    }
    return false;
  }

  selectClass(classId: TankClassId): void {
    if (this.data.unlockedClasses.includes(classId)) {
      this.data.selectedClass = classId;
      this.persist();
    }
  }

  upgradeTankStat(classId: TankClassId, stat: keyof TankUpgradeLevels, cost: number): boolean {
    if (!this.data.tankUpgrades[classId]) {
      this.data.tankUpgrades[classId] = createDefaultUpgrades();
    }
    const current = this.data.tankUpgrades[classId][stat] ?? 0;
    if (current >= 5) {
      return false;
    }
    if (this.spendCoins(cost)) {
      this.data.tankUpgrades[classId][stat] = current + 1;
      this.persist();
      return true;
    }
    return false;
  }

  upgradeBaseHp(cost: number): boolean {
    if (this.data.baseHpLevel >= 5) {
      return false;
    }
    if (this.spendCoins(cost)) {
      this.data.baseHpLevel += 1;
      this.persist();
      return true;
    }
    return false;
  }

  updateScore(score: number): boolean {
    if (score > this.data.bestScore) {
      this.data.bestScore = score;
      this.persist();
      return true;
    }
    return false;
  }

  updateHordeWave(wave: number): boolean {
    if (wave > this.data.bestHordeWave) {
      this.data.bestHordeWave = wave;
      this.persist();
      return true;
    }
    return false;
  }

  unlockStage(stage: number): void {
    if (stage > this.data.unlockedStage) {
      this.data.unlockedStage = stage;
      this.persist();
    }
  }

  addKill(count = 1): void {
    this.data.totalKills += Math.max(1, count);
    this.persist();
  }

  setMuted(muted: boolean): void {
    this.data.muted = muted;
    this.persist();
  }

  setCameraMode(mode: CameraMode): void {
    this.data.cameraMode = mode;
    this.persist();
  }

  setTouchEnabled(enabled: boolean): void {
    this.data.touchEnabled = enabled;
    this.persist();
  }
}
