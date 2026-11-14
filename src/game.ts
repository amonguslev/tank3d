import * as THREE from 'three';
import type { SoundEngine } from './audio';
import { computeBaseMaxHp, computeTankStats, TANK_CLASSES } from './classes';
import type { InputManager } from './input';
import {
  ARENA_HALF,
  BASE_SUB_COORDS,
  BASE_WALL_COORDS,
  buildSubGrid,
  getHordeStageDefinition,
  getStageInfo,
  type StageDefinition
} from './levels';
import { createTankVisual, SharedAssets, type TankVisual } from './meshes';
import { ParticleSystem } from './particles';
import type { StorageManager } from './storage';
import {
  type BossSpec,
  type CameraMode,
  type ComputedTankStats,
  type EnemyKind,
  type FloatingTextItem,
  type GameModeKind,
  type HudState,
  type PowerUpKind,
  type RadarIndicator,
  type StageKills,
  SubTile,
  type TankClassId
} from './types';

// ============================================================================
// Internal Entity Interfaces
// ============================================================================

interface PlayerEntity {
  x: number;
  z: number;
  hullAngle: number;
  turretAngle: number;
  hp: number;
  maxHp: number;
  reloadTimer: number;
  activeBullets: number;
  treadDist: number;
  iceVelX: number;
  iceVelZ: number;
  apcBarrelSide: number;
  visual: TankVisual;
  stats: ComputedTankStats;
}

interface EnemyEntity {
  kind: EnemyKind;
  isBonus: boolean;
  x: number;
  z: number;
  hullAngle: number;
  turretAngle: number;
  speed: number;
  hp: number;
  maxHp: number;
  reloadTimer: number;
  reloadDelay: number;
  bulletSpeed: number;
  activeBullets: number;
  maxBullets: number;
  aiTurnTimer: number;
  aiShootTimer: number;
  visual: TankVisual;
}

interface BossEntity {
  spec: BossSpec;
  x: number;
  z: number;
  hullAngle: number;
  turretAngle: number;
  speed: number;
  hp: number;
  maxHp: number;
  phase: 1 | 2;
  shootTimer: number;
  mortarTimer: number;
  visual: TankVisual;
}

interface BulletEntity {
  fromPlayer: boolean;
  ownerEnemy?: EnemyEntity;
  isRocket?: boolean;
  damage: number;
  aoeRadius?: number;
  canBreakSteel: boolean;
  x: number;
  z: number;
  vx: number;
  vz: number;
  mesh: THREE.Mesh;
}

interface TelegraphZoneEntity {
  x: number;
  z: number;
  radius: number;
  timer: number;
  group: THREE.Group;
  fillMat: THREE.MeshBasicMaterial;
}

interface BarrelEntity {
  x: number;
  z: number;
  hp: number;
  mesh: THREE.Group;
}

interface CoinEntity {
  x: number;
  z: number;
  value: number;
  mesh: THREE.Group;
}

interface PowerUpEntity {
  kind: PowerUpKind;
  x: number;
  z: number;
  timer: number;
  mesh: THREE.Group;
}

interface SpawnPortal {
  x: number;
  z: number;
  timer: number;
  enemyKind?: EnemyKind;
  isBonus?: boolean;
  isBoss?: boolean;
  mesh: THREE.Mesh;
}

export interface GameCallbacks {
  onHudUpdate: (hud: HudState) => void;
  onStageIntro: (stageOrWave: number, name: string) => void;
  onStageVictory: (stage: number, kills: StageKills, totalScore: number, coinsEarned: number) => void;
  onGameOver: (reason: string, score: number, bestScore: number, isNewRecord: boolean, coinsEarned: number) => void;
  onPauseChanged: (paused: boolean) => void;
  onRadarUpdate?: (indicators: RadarIndicator[]) => void;
  onFloatingText?: (item: FloatingTextItem) => void;
}

const ENEMY_BASE_POINTS: Record<EnemyKind, number> = {
  basic: 100,
  fast: 200,
  power: 300,
  armor: 400
};

export class TankGame3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private assets: SharedAssets;
  private particles: ParticleSystem;

  private arenaGroup = new THREE.Group();
  private tileMeshes: (THREE.Object3D | null)[][] = [];
  private baseMesh: THREE.Group | null = null;
  private grid: SubTile[][] = [];

  private player: PlayerEntity | null = null;
  private enemies: EnemyEntity[] = [];
  private boss: BossEntity | null = null;
  private bullets: BulletEntity[] = [];
  private barrels: BarrelEntity[] = [];
  private coins: CoinEntity[] = [];
  private portals: SpawnPortal[] = [];
  private telegraphs: TelegraphZoneEntity[] = [];
  private powerUp: PowerUpEntity | null = null;

  // Hangar Preview state
  private hangarTankVisual: TankVisual | null = null;
  private hangarPodium: THREE.Mesh | null = null;
  private hangarClassId: TankClassId = 'allrounder';

  // 3D Aim reticle
  private aimReticle: THREE.Group;
  private raycaster = new THREE.Raycaster();
  private mouseVec2 = new THREE.Vector2();
  private aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.74);
  private rayIntersection = new THREE.Vector3();

  // Mode and Camera
  private mode: 'menu' | 'playing' | 'paused' | 'hangar' | 'ending' = 'menu';
  private gameMode: GameModeKind = 'campaign';
  private cameraMode: CameraMode;
  private elapsed = 0;
  private shakeIntensity = 0;

  // Run stats
  private currentStage = 1;
  private hordeWave = 1;
  private stageDef: StageDefinition = getStageInfo(1);
  private score = 0;
  private lives = 3;
  private playerStars = 0;
  private runCoinsEarned = 0;
  private playerRespawnTimer = 0;
  private shieldTimer = 0;
  private freezeTimer = 0;
  private shovelTimer = 0;

  // HQ Base stats
  private baseHp = 260;
  private baseMaxHp = 260;
  private baseDestroyed = false;
  private lastBaseHitTime = 0;

  // Wave & Spawn Management
  private enemyQueue: { kind: EnemyKind; isBonus: boolean }[] = [];
  private spawnCooldown = 1.0;
  private nextSpawnSlot = 0;
  private stageKills: StageKills = { basic: 0, fast: 0, power: 0, armor: 0, boss: 0 };

  private endDelayTimer = 0;
  private endOutcome: 'victory' | 'gameover' | 'horde_next' | null = null;
  private gameOverReason = '';
  private uiSyncTimer = 0;

  private lastFrameTime = performance.now();

  constructor(
    private canvas: HTMLCanvasElement,
    private input: InputManager,
    private sound: SoundEngine,
    private storage: StorageManager,
    private callbacks: GameCallbacks
  ) {
    this.cameraMode = this.storage.getData().cameraMode;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0d13);
    this.scene.fog = new THREE.FogExp2(0x0a0d13, 0.009);

    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.5, 160);

    this.assets = new SharedAssets();
    this.particles = new ParticleSystem(this.scene);

    this.aimReticle = this.assets.createAimReticle();
    this.aimReticle.visible = false;
    this.scene.add(this.aimReticle);

    this.setupLights();
    this.setupStaticArenaBase();
    this.scene.add(this.arenaGroup);

    // Initial background preview map
    this.loadArenaMap(getStageInfo(1));

    window.addEventListener('resize', () => this.onResize());
    this.onResize();

    this.input.onPauseToggle = () => {
      if (this.mode === 'playing') this.setPaused(true);
      else if (this.mode === 'paused') this.setPaused(false);
    };

    this.input.onCameraToggle = () => {
      this.cycleCameraMode();
    };

    requestAnimationFrame((t) => this.loop(t));
  }

  private setupLights(): void {
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.95);
    this.scene.add(hemi);

    const dirLight = new THREE.DirectionalLight(0xfff7ed, 1.55);
    dirLight.position.set(18, 32, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 5;
    dirLight.shadow.camera.far = 75;
    const d = 24;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0008;
    this.scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    rimLight.position.set(-20, 16, -18);
    this.scene.add(rimLight);
  }

  private setupStaticArenaBase(): void {
    // Main 36x36 arena floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), this.assets.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Outer dark groundskirt
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x070a0f, roughness: 1 })
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.05;
    this.scene.add(outer);

    // Perimeter armored walls at ±18.6
    const wallH = 1.55;
    const wallThick = 1.2;
    const north = new THREE.Mesh(new THREE.BoxGeometry(38.4, wallH, wallThick), this.assets.borderMat);
    north.position.set(0, wallH / 2, -18.6);
    north.castShadow = true;
    north.receiveShadow = true;

    const south = north.clone();
    south.position.set(0, wallH / 2, 18.6);

    const west = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, 36), this.assets.borderMat);
    west.position.set(-18.6, wallH / 2, 0);
    west.castShadow = true;
    west.receiveShadow = true;

    const east = west.clone();
    east.position.set(18.6, wallH / 2, 0);

    this.scene.add(north, south, west, east);
  }

  private onResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // ============================================================================
  // Public Control API
  // ============================================================================

  getCameraMode(): CameraMode {
    return this.cameraMode;
  }

  cycleCameraMode(): CameraMode {
    const order: CameraMode[] = ['angled', 'top', 'follow'];
    const next = order[(order.indexOf(this.cameraMode) + 1) % order.length];
    this.cameraMode = next;
    this.storage.setCameraMode(next);
    this.sound.playUiClick();
    return next;
  }

  showMenuPreview(stageNum = 1): void {
    this.mode = 'menu';
    this.clearDynamicEntities();
    this.clearHangarPreview();
    this.loadArenaMap(getStageInfo(stageNum));
  }

  showHangarPreview(classId: TankClassId): void {
    this.mode = 'hangar';
    this.hangarClassId = classId;
    this.clearDynamicEntities();
    this.clearHangarPreview();

    this.arenaGroup.visible = false;

    this.hangarPodium = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.5, 0.16, 32),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.75 })
    );
    this.hangarPodium.position.set(0, -0.08, 0);
    this.hangarPodium.receiveShadow = true;
    this.scene.add(this.hangarPodium);

    this.hangarTankVisual = createTankVisual({ isPlayer: true, playerClass: classId });
    this.hangarTankVisual.root.position.set(0, 0, 0);
    this.scene.add(this.hangarTankVisual.root);
  }

  private clearHangarPreview(): void {
    this.arenaGroup.visible = true;
    if (this.hangarPodium) {
      this.scene.remove(this.hangarPodium);
      this.hangarPodium.geometry.dispose();
      if (this.hangarPodium.material instanceof THREE.Material) {
        this.hangarPodium.material.dispose();
      }
      this.hangarPodium = null;
    }
    if (this.hangarTankVisual) {
      this.scene.remove(this.hangarTankVisual.root);
      this.hangarTankVisual = null;
    }
  }

  startCampaignRun(startStage = 1): void {
    this.gameMode = 'campaign';
    this.score = 0;
    this.lives = 3;
    this.playerStars = 0;
    this.runCoinsEarned = 0;
    this.startStage(startStage);
  }

  startNewRun(startStage = 1): void {
    this.startCampaignRun(startStage);
  }

  startHordeRun(): void {
    this.gameMode = 'horde';
    this.hordeWave = 1;
    this.score = 0;
    this.lives = 3;
    this.playerStars = 0;
    this.runCoinsEarned = 0;
    this.startHordeWave(1);
  }

  startStage(stageNum: number): void {
    this.currentStage = stageNum;
    this.stageDef = getStageInfo(stageNum);
    this.setupRoundCommon(this.stageDef);
    this.callbacks.onStageIntro(this.currentStage, this.stageDef.name);
  }

  private startHordeWave(wave: number): void {
    this.hordeWave = wave;
    this.stageDef = getHordeStageDefinition(wave);
    this.setupRoundCommon(this.stageDef);
    this.callbacks.onStageIntro(this.hordeWave, this.stageDef.name);
  }

  private setupRoundCommon(stageDef: StageDefinition): void {
    this.stageKills = { basic: 0, fast: 0, power: 0, armor: 0, boss: 0 };

    this.clearDynamicEntities();
    this.clearHangarPreview();
    this.particles.clear();
    this.input.reset();

    this.baseMaxHp = computeBaseMaxHp(this.storage.getData().baseHpLevel);
    this.baseHp = this.baseMaxHp;
    this.baseDestroyed = false;
    this.lastBaseHitTime = 0;

    this.endOutcome = null;
    this.endDelayTimer = 0;
    this.freezeTimer = 0;
    this.shovelTimer = 0;
    this.playerRespawnTimer = 0;

    this.loadArenaMap(stageDef);

    // Build enemy queue
    this.enemyQueue = stageDef.enemies.map((kind, i) => ({
      kind,
      isBonus: i === 3 || i === 9 || i === 16 || (this.gameMode === 'horde' && i % 6 === 5)
    }));
    this.spawnCooldown = 0.8;
    this.nextSpawnSlot = 0;

    // Spawn boss if present in stage definition
    if (stageDef.boss) {
      this.spawnBossPortal(stageDef.boss);
    }

    this.spawnPlayerTank(3.5);

    this.mode = 'playing';
    this.sound.playStageStart();
    this.emitHud();
  }

  setPaused(paused: boolean): void {
    if (paused && this.mode === 'playing') {
      this.mode = 'paused';
      this.input.reset();
      this.callbacks.onPauseChanged(true);
    } else if (!paused && this.mode === 'paused') {
      this.mode = 'playing';
      this.lastFrameTime = performance.now();
      this.callbacks.onPauseChanged(false);
    }
  }

  // ============================================================================
  // Arena & Map Loading
  // ============================================================================

  private loadArenaMap(stage: StageDefinition): void {
    while (this.arenaGroup.children.length > 0) {
      this.arenaGroup.remove(this.arenaGroup.children[0]);
    }

    // Apply Biome textures & materials
    this.assets.applyBiome(stage.biome);

    const sub = buildSubGrid(stage);
    this.grid = sub.grid;
    this.tileMeshes = Array.from({ length: 36 }, () => Array.from({ length: 36 }, () => null));

    for (let sz = 0; sz < 36; sz++) {
      for (let sx = 0; sx < 36; sx++) {
        this.rebuildSubTileMesh(sx, sz, stage);
      }
    }

    // Spawn Barrels from layout
    this.clearBarrels();
    for (const b of sub.barrels) {
      this.spawnBarrel(b.x, b.z);
    }

    // Build Base HQ crest at (0, 0, 17)
    this.baseMesh = this.assets.createBaseMesh(false);
    this.baseMesh.position.set(0, 0, 17);
    this.arenaGroup.add(this.baseMesh);
  }

  private rebuildSubTileMesh(sx: number, sz: number, stage?: StageDefinition): void {
    const old = this.tileMeshes[sz][sx];
    if (old) {
      this.arenaGroup.remove(old);
      this.tileMeshes[sz][sx] = null;
    }

    const tile = this.grid[sz][sx];
    const wx = -17.5 + sx;
    const wz = -17.5 + sz;

    if (tile === SubTile.Brick) {
      const m = new THREE.Mesh(this.assets.brickGeo, this.assets.brickMat);
      m.position.set(wx, 0.575, wz);
      m.castShadow = true;
      m.receiveShadow = true;
      this.arenaGroup.add(m);
      this.tileMeshes[sz][sx] = m;
    } else if (tile === SubTile.Steel) {
      const m = new THREE.Mesh(this.assets.steelGeo, this.assets.steelMat);
      m.position.set(wx, 0.66, wz);
      m.castShadow = true;
      m.receiveShadow = true;
      this.arenaGroup.add(m);
      this.tileMeshes[sz][sx] = m;
    } else if (tile === SubTile.Water) {
      const m = new THREE.Mesh(this.assets.waterGeo, this.assets.waterMat);
      m.position.set(wx, 0.05, wz);
      this.arenaGroup.add(m);
      this.tileMeshes[sz][sx] = m;
    } else if (tile === SubTile.Ice) {
      const m = new THREE.Mesh(this.assets.iceGeo, this.assets.iceMat);
      m.position.set(wx, 0.03, wz);
      m.receiveShadow = true;
      this.arenaGroup.add(m);
      this.tileMeshes[sz][sx] = m;
    } else if (tile === SubTile.Forest) {
      const clump = this.assets.createForestClump(stage?.biome ?? this.stageDef.biome);
      clump.position.set(wx, 0, wz);
      this.arenaGroup.add(clump);
      this.tileMeshes[sz][sx] = clump;
    }
  }

  private setBaseWallMaterial(tile: SubTile): void {
    for (const [sx, sz] of BASE_WALL_COORDS) {
      this.grid[sz][sx] = tile;
      this.rebuildSubTileMesh(sx, sz);
    }
  }

  private destroySubTile(sx: number, sz: number): void {
    if (sx < 0 || sx >= 36 || sz < 0 || sz >= 36) return;
    const tile = this.grid[sz][sx];
    if (tile === SubTile.Brick || tile === SubTile.Steel) {
      this.grid[sz][sx] = SubTile.Empty;
      const m = this.tileMeshes[sz][sx];
      if (m) {
        this.arenaGroup.remove(m);
        this.tileMeshes[sz][sx] = null;
      }
      const wx = -17.5 + sx;
      const wz = -17.5 + sz;
      this.particles.spawnBrickDebris(wx, wz);
      this.sound.playBrickHit();
    }
  }

  // ============================================================================
  // Explosive Barrels
  // ============================================================================

  private spawnBarrel(x: number, z: number): void {
    const mesh = this.assets.createBarrelMesh();
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.barrels.push({ x, z, hp: 1, mesh });
  }

  private clearBarrels(): void {
    for (const b of this.barrels) {
      this.scene.remove(b.mesh);
    }
    this.barrels = [];
  }

  private detonateBarrel(barrel: BarrelEntity): void {
    const idx = this.barrels.indexOf(barrel);
    if (idx === -1) return;
    this.barrels.splice(idx, 1);
    this.scene.remove(barrel.mesh);

    const bx = barrel.x;
    const bz = barrel.z;

    this.sound.playExplosion(true);
    this.particles.spawnExplosion(bx, bz, true);
    this.particles.spawnScorchCrater(bx, bz, true);
    this.shake(0.42);

    const aoeRadius = 3.6;
    const damage = 95;

    // Damage enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const d = Math.hypot(e.x - bx, e.z - bz);
      if (d <= aoeRadius) {
        this.damageEnemy(e, damage);
      }
    }

    // Damage Boss
    if (this.boss) {
      const d = Math.hypot(this.boss.x - bx, this.boss.z - bz);
      if (d <= aoeRadius + 0.8) {
        this.damageBoss(damage);
      }
    }

    // Damage Player
    if (this.player && this.shieldTimer <= 0) {
      const d = Math.hypot(this.player.x - bx, this.player.z - bz);
      if (d <= aoeRadius) {
        this.damagePlayer(45);
      }
    }

    // Destroy bricks in radius
    this.destroyBricksInRadius(bx, bz, aoeRadius);

    // Chain detonate nearby barrels
    for (let i = this.barrels.length - 1; i >= 0; i--) {
      const other = this.barrels[i];
      const d = Math.hypot(other.x - bx, other.z - bz);
      if (d <= aoeRadius) {
        this.detonateBarrel(other);
      }
    }
  }

  private destroyBricksInRadius(cx: number, cz: number, radius: number): void {
    const minSx = Math.max(0, Math.floor(cx - radius + 18));
    const maxSx = Math.min(35, Math.floor(cx + radius + 18));
    const minSz = Math.max(0, Math.floor(cz - radius + 18));
    const maxSz = Math.min(35, Math.floor(cz + radius + 18));

    for (let sz = minSz; sz <= maxSz; sz++) {
      for (let sx = minSx; sx <= maxSx; sx++) {
        if (this.grid[sz][sx] === SubTile.Brick) {
          const wx = -17.5 + sx;
          const wz = -17.5 + sz;
          if (Math.hypot(wx - cx, wz - cz) <= radius) {
            this.destroySubTile(sx, sz);
          }
        }
      }
    }
  }

  // ============================================================================
  // Spawning (Player, Enemies, Boss, Portals)
  // ============================================================================

  private spawnPlayerTank(shieldSec: number): void {
    if (this.player) {
      this.scene.remove(this.player.visual.root);
    }

    const save = this.storage.getData();
    const stats = computeTankStats(save.selectedClass, save.tankUpgrades[save.selectedClass], this.playerStars);
    const visual = createTankVisual({ isPlayer: true, playerClass: save.selectedClass });
    this.scene.add(visual.root);

    this.player = {
      x: -4.0,
      z: 16.0,
      hullAngle: 0,
      turretAngle: 0,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      reloadTimer: 0,
      activeBullets: 0,
      treadDist: 0,
      iceVelX: 0,
      iceVelZ: 0,
      apcBarrelSide: 1,
      visual,
      stats
    };

    this.shieldTimer = shieldSec;
    this.syncPlayerTransform();
  }

  private spawnBossPortal(bossSpec: BossSpec): void {
    const spawnMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 2.2, 32),
      new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    spawnMesh.rotation.x = -Math.PI / 2;
    spawnMesh.position.set(0, 0.08, -14);
    this.scene.add(spawnMesh);

    this.portals.push({
      x: 0,
      z: -14,
      timer: 1.6,
      isBoss: true,
      mesh: spawnMesh
    });
  }

  private createBoss(spec: BossSpec): void {
    const visual = createTankVisual({ isPlayer: false, bossId: spec.id });
    visual.root.scale.setScalar(1.65);
    this.scene.add(visual.root);

    this.boss = {
      spec,
      x: 0,
      z: -14,
      hullAngle: Math.PI,
      turretAngle: Math.PI,
      speed: spec.speed,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      phase: 1,
      shootTimer: 1.2,
      mortarTimer: 4.5,
      visual
    };

    this.syncBossTransform();
    this.sound.playBossAlert();
    this.shake(0.5);
    this.showFloatingText(0, -14, `☠️ ${spec.name}`, '#f43f5e', true);
  }

  private spawnEnemyPortal(slotIndex: number, kind: EnemyKind, isBonus: boolean): void {
    const spawnSlots = [
      { x: -15, z: -16 },
      { x: 0, z: -16 },
      { x: 15, z: -16 }
    ];
    const pos = spawnSlots[slotIndex % spawnSlots.length];

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 1.25, 24),
      new THREE.MeshBasicMaterial({
        color: isBonus ? 0xf43f5e : 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.06, pos.z);
    this.scene.add(ring);

    this.portals.push({
      x: pos.x,
      z: pos.z,
      timer: 1.1,
      enemyKind: kind,
      isBonus,
      mesh: ring
    });
  }

  private createEnemyTank(x: number, z: number, kind: EnemyKind, isBonus: boolean): EnemyEntity {
    const visual = createTankVisual({ isPlayer: false, enemyKind: kind, isBonus });
    this.scene.add(visual.root);

    let speed = 4.6;
    let hp = 1;
    let bulletSpeed = 14;
    let reloadDelay = 1.1;

    if (kind === 'fast') {
      speed = 7.6;
      bulletSpeed = 16;
      reloadDelay = 0.95;
    } else if (kind === 'power') {
      speed = 5.4;
      bulletSpeed = 21;
      reloadDelay = 0.65;
    } else if (kind === 'armor') {
      speed = 4.2;
      hp = 4;
      bulletSpeed = 15;
      reloadDelay = 1.2;
    }

    const enemy: EnemyEntity = {
      kind,
      isBonus,
      x,
      z,
      hullAngle: Math.PI, // Facing south into arena
      turretAngle: Math.PI,
      speed,
      hp,
      maxHp: hp,
      reloadTimer: 0.5,
      reloadDelay,
      bulletSpeed,
      activeBullets: 0,
      maxBullets: 1,
      aiTurnTimer: 0.4 + Math.random() * 0.8,
      aiShootTimer: 0.3 + Math.random() * 0.8,
      visual
    };

    this.syncEnemyTransform(enemy);
    return enemy;
  }

  // ============================================================================
  // Clear & Clean
  // ============================================================================

  private clearDynamicEntities(): void {
    if (this.player) {
      this.scene.remove(this.player.visual.root);
      this.player = null;
    }
    for (const e of this.enemies) {
      this.scene.remove(e.visual.root);
    }
    this.enemies = [];

    if (this.boss) {
      this.scene.remove(this.boss.visual.root);
      this.boss = null;
    }

    for (const b of this.bullets) {
      this.scene.remove(b.mesh);
    }
    this.bullets = [];

    for (const p of this.portals) {
      this.scene.remove(p.mesh);
    }
    this.portals = [];

    for (const c of this.coins) {
      this.scene.remove(c.mesh);
    }
    this.coins = [];

    for (const t of this.telegraphs) {
      this.scene.remove(t.group);
      t.fillMat.dispose();
    }
    this.telegraphs = [];

    if (this.powerUp) {
      this.scene.remove(this.powerUp.mesh);
      this.powerUp = null;
    }

    this.clearBarrels();
    this.aimReticle.visible = false;
  }

  // ============================================================================
  // Player Actions & Weapons
  // ============================================================================

  private updatePlayerMovement(dt: number): void {
    if (!this.player) return;

    const mv = this.input.getMoveVector();
    const len = Math.hypot(mv.x, mv.z);
    const p = this.player;

    const tile = this.getTileAt(p.x, p.z);
    const onIce = tile === SubTile.Ice;

    let moveX = 0;
    let moveZ = 0;

    if (len > 0.05) {
      const normX = mv.x / len;
      const normZ = mv.z / len;
      const targetHullAngle = Math.atan2(-normX, -normZ);

      // Smooth hull turning towards movement direction
      const diff = Math.atan2(Math.sin(targetHullAngle - p.hullAngle), Math.cos(targetHullAngle - p.hullAngle));
      p.hullAngle += diff * Math.min(1.0, dt * 14);

      const speed = p.stats.speed;
      moveX = normX * speed * dt;
      moveZ = normZ * speed * dt;

      if (onIce) {
        p.iceVelX = p.iceVelX * 0.85 + moveX * 0.15;
        p.iceVelZ = p.iceVelZ * 0.85 + moveZ * 0.15;
      } else {
        p.iceVelX = 0;
        p.iceVelZ = 0;
      }
      this.sound.playMoveTick();
    } else {
      if (onIce && (Math.abs(p.iceVelX) > 0.001 || Math.abs(p.iceVelZ) > 0.001)) {
        moveX = p.iceVelX;
        moveZ = p.iceVelZ;
        p.iceVelX *= 0.94;
        p.iceVelZ *= 0.94;
      }
    }

    // Try combined movement with circular wall sliding
    const r = 0.78;
    const nx = p.x + moveX;
    const nz = p.z + moveZ;

    if (!this.isCircleBlocked(nx, nz, r)) {
      p.x = nx;
      p.z = nz;
      p.treadDist += Math.hypot(moveX, moveZ);
    } else if (!this.isCircleBlocked(nx, p.z, r)) {
      p.x = nx;
      p.treadDist += Math.abs(moveX);
    } else if (!this.isCircleBlocked(p.x, nz, r)) {
      p.z = nz;
      p.treadDist += Math.abs(moveZ);
    }

    // Spawn tread marks periodically
    if (p.treadDist >= 0.55) {
      this.particles.spawnTreadMark(p.x, p.z, p.hullAngle);
      p.treadDist = 0;
    }

    // Smooth recoil recovery
    if (p.visual.recoilGroup.position.z > 0) {
      p.visual.recoilGroup.position.z = Math.max(0, p.visual.recoilGroup.position.z - dt * 2.5);
    }

    this.syncPlayerTransform();
  }

  private updatePlayerAiming(): void {
    if (!this.player) return;
    const p = this.player;

    // 1. Mouse Aim on PC
    if (this.input.isMouseAimActive()) {
      const ndc = this.input.getMouseNdc();
      if (ndc) {
        this.mouseVec2.set(ndc.x, ndc.y);
        this.raycaster.setFromCamera(this.mouseVec2, this.camera);
        if (this.raycaster.ray.intersectPlane(this.aimPlane, this.rayIntersection)) {
          this.aimReticle.visible = true;
          this.aimReticle.position.set(this.rayIntersection.x, 0.06, this.rayIntersection.z);
          p.turretAngle = Math.atan2(-(this.rayIntersection.x - p.x), -(this.rayIntersection.z - p.z));
          return;
        }
      }
    }

    // 2. Touch Aim Stick on Mobile (dragged)
    const touchAim = this.input.getTouchAimVector();
    if (touchAim) {
      this.aimReticle.visible = true;
      p.turretAngle = Math.atan2(-touchAim.x, -touchAim.z);
      this.aimReticle.position.set(p.x + touchAim.x * 6.5, 0.06, p.z + touchAim.z * 6.5);
      return;
    }

    // No active manual aim stick: hide reticle
    this.aimReticle.visible = false;
  }

  private handlePlayerShooting(dt: number): void {
    if (!this.player) return;
    const p = this.player;

    if (p.reloadTimer > 0) {
      p.reloadTimer -= dt;
    }

    // Brawl Stars quick-tap auto-aim
    if (this.input.consumeAutoAimTap()) {
      const target = this.findNearestAutoAimTarget(p.x, p.z, 22.0);
      if (target) {
        p.turretAngle = Math.atan2(-(target.x - p.x), -(target.z - p.z));
      }
      this.triggerPlayerShot();
      return;
    }

    // Standard continuous / queued fire
    if (this.input.consumeFire()) {
      this.triggerPlayerShot();
    }
  }

  private findNearestAutoAimTarget(px: number, pz: number, maxDist: number): { x: number; z: number } | null {
    let bestDist = maxDist;
    let bestTarget: { x: number; z: number } | null = null;

    // Check Boss first
    if (this.boss) {
      const d = Math.hypot(this.boss.x - px, this.boss.z - pz);
      if (d <= bestDist) {
        bestDist = d;
        bestTarget = { x: this.boss.x, z: this.boss.z };
      }
    }

    // Check Enemies
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - px, e.z - pz);
      if (d < bestDist) {
        bestDist = d;
        bestTarget = { x: e.x, z: e.z };
      }
    }

    // If enemies/boss found in range, prioritize them
    if (bestTarget) return bestTarget;

    // Otherwise fall back to nearest explosive barrel
    for (const b of this.barrels) {
      const d = Math.hypot(b.x - px, b.z - pz);
      if (d < bestDist) {
        bestDist = d;
        bestTarget = { x: b.x, z: b.z };
      }
    }

    return bestTarget;
  }

  private triggerPlayerShot(): void {
    const p = this.player;
    if (!p) return;
    if (p.reloadTimer > 0 || p.activeBullets >= p.stats.maxActiveBullets) return;

    p.reloadTimer = p.stats.reloadDelay;
    p.visual.recoilGroup.position.z = 0.22;

    const angle = p.turretAngle;
    const dirX = -Math.sin(angle);
    const dirZ = -Math.cos(angle);
    const tipX = p.x + dirX * 1.35;
    const tipZ = p.z + dirZ * 1.35;

    const classId = this.storage.getData().selectedClass;

    if (classId === 'railgun') {
      // Instant Piercing Electromagnetic Shot
      this.sound.playShoot('railgun');
      this.particles.spawnMuzzleFlash(tipX, tipZ, 0x38bdf8);
      this.executeRailgunShot(tipX, tipZ, dirX, dirZ, p.stats);
      return;
    }

    if (classId === 'apc') {
      // Fast Twin Autocannon Shot
      p.apcBarrelSide = -p.apcBarrelSide;
      const perpX = -dirZ * 0.18 * p.apcBarrelSide;
      const perpZ = dirX * 0.18 * p.apcBarrelSide;
      const spawnX = tipX + perpX;
      const spawnZ = tipZ + perpZ;

      this.sound.playShoot('apc');
      this.particles.spawnMuzzleFlash(spawnX, spawnZ, 0x67e8f9);

      this.spawnBullet({
        fromPlayer: true,
        damage: p.stats.damage,
        canBreakSteel: p.stats.breaksSteel,
        x: spawnX,
        z: spawnZ,
        vx: dirX * p.stats.bulletSpeed,
        vz: dirZ * p.stats.bulletSpeed
      });
      p.activeBullets++;
      return;
    }

    if (classId === 'rocket') {
      // Explosive Rocket with AoE
      this.sound.playShoot('rocket');
      this.particles.spawnMuzzleFlash(tipX, tipZ, 0xf97316);

      this.spawnBullet({
        fromPlayer: true,
        isRocket: true,
        damage: p.stats.damage,
        aoeRadius: p.stats.aoeRadius,
        canBreakSteel: p.stats.breaksSteel,
        x: tipX,
        z: tipZ,
        vx: dirX * p.stats.bulletSpeed,
        vz: dirZ * p.stats.bulletSpeed
      });
      p.activeBullets++;
      return;
    }

    // Classic Allrounder Cannon
    this.sound.playShoot('cannon');
    this.particles.spawnMuzzleFlash(tipX, tipZ, 0xfef08a);

    this.spawnBullet({
      fromPlayer: true,
      damage: p.stats.damage,
      canBreakSteel: p.stats.breaksSteel,
      x: tipX,
      z: tipZ,
      vx: dirX * p.stats.bulletSpeed,
      vz: dirZ * p.stats.bulletSpeed
    });
    p.activeBullets++;
  }

  private executeRailgunShot(
    startX: number,
    startZ: number,
    dirX: number,
    dirZ: number,
    stats: ComputedTankStats
  ): void {
    let curX = startX;
    let curZ = startZ;
    const step = 0.35;
    const maxSteps = 100;
    let endX = startX + dirX * 36;
    let endZ = startZ + dirZ * 36;

    const hitEnemies = new Set<EnemyEntity>();
    let hitBoss = false;

    for (let s = 0; s < maxSteps; s++) {
      curX += dirX * step;
      curZ += dirZ * step;

      // Arena boundary check
      if (Math.abs(curX) >= ARENA_HALF || Math.abs(curZ) >= ARENA_HALF) {
        endX = curX;
        endZ = curZ;
        break;
      }

      // Check tile collision: pierces & destroys both Brick and Steel!
      const sx = Math.floor(curX + 18);
      const sz = Math.floor(curZ + 18);
      if (sx >= 0 && sx < 36 && sz >= 0 && sz < 36) {
        const tile = this.grid[sz][sx];
        if (tile === SubTile.Brick || tile === SubTile.Steel) {
          this.destroySubTile(sx, sz);
        } else if (tile === SubTile.Base) {
          endX = curX;
          endZ = curZ;
          break;
        }
      }

      // Detonate barrels on line
      for (let i = this.barrels.length - 1; i >= 0; i--) {
        const b = this.barrels[i];
        if (Math.hypot(b.x - curX, b.z - curZ) < 0.8) {
          this.detonateBarrel(b);
        }
      }

      // Pierce all enemies on line
      for (const e of this.enemies) {
        if (!hitEnemies.has(e) && Math.hypot(e.x - curX, e.z - curZ) < 0.95) {
          hitEnemies.add(e);
          this.damageEnemy(e, stats.damage);
        }
      }

      // Pierce Boss
      if (this.boss && !hitBoss && Math.hypot(this.boss.x - curX, this.boss.z - curZ) < 1.6) {
        hitBoss = true;
        this.damageBoss(stats.damage);
      }
    }

    this.particles.spawnRailgunBeam(startX, startZ, endX, endZ);
    this.shake(0.32);
  }

  // ============================================================================
  // Bullets & Collision
  // ============================================================================

  private spawnBullet(options: {
    fromPlayer: boolean;
    ownerEnemy?: EnemyEntity;
    isRocket?: boolean;
    damage: number;
    aoeRadius?: number;
    canBreakSteel: boolean;
    x: number;
    z: number;
    vx: number;
    vz: number;
  }): void {
    const mat = options.fromPlayer ? this.assets.playerBulletMat : this.assets.enemyBulletMat;
    const mesh = new THREE.Mesh(this.assets.bulletGeo, mat);
    mesh.position.set(options.x, 0.72, options.z);
    this.scene.add(mesh);

    this.bullets.push({
      fromPlayer: options.fromPlayer,
      ownerEnemy: options.ownerEnemy,
      isRocket: options.isRocket,
      damage: options.damage,
      aoeRadius: options.aoeRadius,
      canBreakSteel: options.canBreakSteel,
      x: options.x,
      z: options.z,
      vx: options.vx,
      vz: options.vz,
      mesh
    });
  }

  private updateBullets(dt: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.mesh.position.set(b.x, 0.72, b.z);

      // Rocket trail smoke
      if (b.isRocket) {
        this.particles.spawnProjectileTrail(b.x, b.z);
      }

      // 1. Arena borders
      if (Math.abs(b.x) > ARENA_HALF || Math.abs(b.z) > ARENA_HALF) {
        this.onBulletHit(b, b.x, b.z);
        this.removeBullet(i);
        continue;
      }

      // 2. Barrels collision
      let hitBarrel = false;
      for (const barrel of this.barrels) {
        if (Math.hypot(barrel.x - b.x, barrel.z - b.z) < 0.75) {
          this.detonateBarrel(barrel);
          this.onBulletHit(b, b.x, b.z);
          this.removeBullet(i);
          hitBarrel = true;
          break;
        }
      }
      if (hitBarrel) continue;

      // 3. Grid tile collision
      const sx = Math.floor(b.x + 18);
      const sz = Math.floor(b.z + 18);
      if (sx >= 0 && sx < 36 && sz >= 0 && sz < 36) {
        const tile = this.grid[sz][sx];

        if (tile === SubTile.Brick) {
          this.destroySubTile(sx, sz);
          this.onBulletHit(b, b.x, b.z);
          this.removeBullet(i);
          continue;
        } else if (tile === SubTile.Steel) {
          if (b.canBreakSteel) {
            this.destroySubTile(sx, sz);
          } else {
            this.sound.playSteelHit();
            this.particles.spawnSparks(b.x, b.z);
          }
          this.onBulletHit(b, b.x, b.z);
          this.removeBullet(i);
          continue;
        } else if (tile === SubTile.Base) {
          this.damageBase(28);
          this.onBulletHit(b, b.x, b.z);
          this.removeBullet(i);
          continue;
        }
      }

      // 4. Player bullet hitting enemies / Boss
      if (b.fromPlayer) {
        let hitEnemy = false;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (Math.hypot(e.x - b.x, e.z - b.z) < 0.85) {
            this.damageEnemy(e, b.damage);
            this.onBulletHit(b, b.x, b.z);
            this.removeBullet(i);
            hitEnemy = true;
            break;
          }
        }
        if (hitEnemy) continue;

        if (this.boss && Math.hypot(this.boss.x - b.x, this.boss.z - b.z) < 1.55) {
          this.damageBoss(b.damage);
          this.onBulletHit(b, b.x, b.z);
          this.removeBullet(i);
          continue;
        }
      }

      // 5. Enemy bullet hitting Player
      if (!b.fromPlayer && this.player) {
        if (Math.hypot(this.player.x - b.x, this.player.z - b.z) < 0.85) {
          this.damagePlayer(b.damage);
          this.onBulletHit(b, b.x, b.z);
          this.removeBullet(i);
          continue;
        }
      }
    }
  }

  private onBulletHit(b: BulletEntity, hitX: number, hitZ: number): void {
    if (b.isRocket && b.aoeRadius) {
      // Rocket AoE Detonation
      this.sound.playExplosion(false);
      this.particles.spawnExplosion(hitX, hitZ, false);
      this.particles.spawnScorchCrater(hitX, hitZ, false);

      const rad = b.aoeRadius;
      // AoE damage enemies
      for (const e of this.enemies) {
        if (Math.hypot(e.x - hitX, e.z - hitZ) <= rad) {
          this.damageEnemy(e, b.damage);
        }
      }
      // AoE damage Boss
      if (this.boss && Math.hypot(this.boss.x - hitX, this.boss.z - hitZ) <= rad + 0.8) {
        this.damageBoss(b.damage);
      }
      // Detonate barrels in radius
      for (let i = this.barrels.length - 1; i >= 0; i--) {
        const bar = this.barrels[i];
        if (Math.hypot(bar.x - hitX, bar.z - hitZ) <= rad) {
          this.detonateBarrel(bar);
        }
      }
      this.destroyBricksInRadius(hitX, hitZ, rad);
    } else {
      this.particles.spawnSparks(hitX, hitZ);
    }
  }

  private removeBullet(index: number): void {
    const b = this.bullets[index];
    this.scene.remove(b.mesh);
    if (b.fromPlayer && this.player) {
      this.player.activeBullets = Math.max(0, this.player.activeBullets - 1);
    } else if (b.ownerEnemy) {
      b.ownerEnemy.activeBullets = Math.max(0, b.ownerEnemy.activeBullets - 1);
    }
    this.bullets.splice(index, 1);
  }

  // ============================================================================
  // Damage & Health (Player, Base, Enemies, Boss)
  // ============================================================================

  private damagePlayer(damage: number): void {
    if (!this.player) return;
    if (this.shieldTimer > 0) {
      this.sound.playArmorHit();
      this.particles.spawnSparks(this.player.x, this.player.z);
      return;
    }

    this.player.hp = Math.max(0, this.player.hp - damage);
    this.sound.playArmorHit();
    this.shake(0.25);
    this.showFloatingText(this.player.x, this.player.z, `-${damage}`, '#f43f5e');

    if (this.player.hp <= 0) {
      this.sound.playExplosion(true);
      this.particles.spawnExplosion(this.player.x, this.player.z, true);
      this.scene.remove(this.player.visual.root);
      this.player = null;
      this.lives--;

      if (this.lives > 0) {
        this.playerRespawnTimer = 1.4;
      } else {
        this.triggerGameOver('Усі життя вичерпано!');
      }
    }
    this.emitHud();
  }

  private damageBase(damage: number): void {
    if (this.baseDestroyed) return;

    this.baseHp = Math.max(0, this.baseHp - damage);
    this.lastBaseHitTime = performance.now();
    this.particles.spawnSparks(0, 17);
    this.sound.playArmorHit();
    this.showFloatingText(0, 17, `-${damage} 🦅`, '#f43f5e', true);

    if (this.baseHp <= 0) {
      this.baseDestroyed = true;
      this.sound.playExplosion(true);
      this.particles.spawnExplosion(0, 17, true);
      this.particles.spawnScorchCrater(0, 17, true);

      if (this.baseMesh) {
        this.scene.remove(this.baseMesh);
        this.arenaGroup.remove(this.baseMesh);
      }
      this.baseMesh = this.assets.createBaseMesh(true);
      this.baseMesh.position.set(0, 0, 17);
      this.arenaGroup.add(this.baseMesh);

      this.triggerGameOver('Штаб було зруйновано!');
    }
    this.emitHud();
  }

  private damageEnemy(enemy: EnemyEntity, damage: number): void {
    enemy.hp -= damage;
    this.showFloatingText(enemy.x, enemy.z, `-${damage}`, '#fca5a5');

    if (enemy.hp <= 0) {
      const idx = this.enemies.indexOf(enemy);
      if (idx !== -1) {
        this.enemies.splice(idx, 1);
        this.scene.remove(enemy.visual.root);
      }

      this.sound.playExplosion(false);
      this.particles.spawnExplosion(enemy.x, enemy.z, false);
      this.shake(0.18);

      const pts = ENEMY_BASE_POINTS[enemy.kind] ?? 100;
      this.score += pts;
      this.stageKills[enemy.kind]++;
      this.storage.addKill(1);

      // Drop 3D Coins
      const coinAmt =
        enemy.kind === 'armor' ? 24 : enemy.kind === 'power' ? 18 : enemy.kind === 'fast' ? 14 : 10;
      this.spawnCoin(enemy.x, enemy.z, coinAmt);

      // Drop powerup if bonus tank
      if (enemy.isBonus) {
        this.spawnRandomPowerUp(enemy.x, enemy.z);
      }
    } else {
      this.sound.playArmorHit();
      this.particles.spawnSparks(enemy.x, enemy.z);
    }
    this.emitHud();
  }

  private damageBoss(damage: number): void {
    if (!this.boss) return;
    this.boss.hp = Math.max(0, this.boss.hp - damage);
    this.showFloatingText(this.boss.x, this.boss.z, `-${damage}`, '#f43f5e', true);

    // Phase transition check
    if (this.boss.phase === 1 && this.boss.hp <= this.boss.maxHp * 0.5) {
      this.boss.phase = 2;
      this.boss.speed *= 1.25;
      this.sound.playBossAlert();
      this.particles.spawnExplosion(this.boss.x, this.boss.z, true);
      this.showFloatingText(this.boss.x, this.boss.z, '🔥 ФАЗА 2: ЛЮТЬ!', '#ef4444', true);
    }

    if (this.boss.hp <= 0) {
      const b = this.boss;
      this.sound.playExplosion(true);
      this.particles.spawnExplosion(b.x, b.z, true);
      this.particles.spawnExplosion(b.x + 0.8, b.z - 0.8, true);
      this.particles.spawnExplosion(b.x - 0.8, b.z + 0.8, true);
      this.shake(0.55);

      this.score += b.spec.points;
      this.stageKills.boss++;

      // Drop big boss reward coins
      this.spawnCoin(b.x, b.z, b.spec.rewardCoins);
      this.showFloatingText(b.x, b.z, `+${b.spec.points} ☠️ БОС ЗНИЩЕНИЙ!`, '#fbbf24', true);

      this.scene.remove(b.visual.root);
      this.boss = null;
    } else {
      this.sound.playArmorHit();
      this.particles.spawnSparks(this.boss.x, this.boss.z);
    }
    this.emitHud();
  }

  // ============================================================================
  // Coins & PowerUps
  // ============================================================================

  private spawnCoin(x: number, z: number, value: number): void {
    const mesh = this.assets.createCoinMesh();
    mesh.position.set(x, 0.45, z);
    this.scene.add(mesh);
    this.coins.push({ x, z, value, mesh });
  }

  private updateCoins(dt: number): void {
    const p = this.player;

    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.mesh.rotation.y += dt * 4.2;
      c.mesh.position.y = 0.42 + Math.sin(this.elapsed * 5.5 + c.x * 2) * 0.12;

      if (p) {
        const d = Math.hypot(p.x - c.x, p.z - c.z);

        // Magnet attraction within 4.0 units
        if (d <= 4.0) {
          const spd = Math.max(8.0, 15.0 - d * 2);
          c.x += ((p.x - c.x) / d) * spd * dt;
          c.z += ((p.z - c.z) / d) * spd * dt;
          c.mesh.position.set(c.x, c.mesh.position.y, c.z);
        }

        // Pickup collection
        if (d <= 0.82) {
          this.storage.addCoins(c.value);
          this.runCoinsEarned += c.value;
          this.sound.playCoinPickup();
          this.showFloatingText(c.x, c.z, `+${c.value} 🪙`, '#fbbf24', true);
          this.scene.remove(c.mesh);
          this.coins.splice(i, 1);
          this.emitHud();
        }
      }
    }
  }

  private spawnRandomPowerUp(x: number, z: number): void {
    if (this.powerUp) {
      this.scene.remove(this.powerUp.mesh);
      this.powerUp = null;
    }

    const pool: PowerUpKind[] = ['star', 'shield', 'clock', 'shovel', 'grenade', 'life', 'repair'];
    const kind = pool[Math.floor(Math.random() * pool.length)];

    const mesh = this.assets.createPowerUpMesh(kind);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);

    this.powerUp = { kind, x, z, timer: 16.0, mesh };
    this.sound.playPowerUpSpawn();
  }

  private updatePowerUps(dt: number): void {
    if (!this.powerUp) return;
    const pu = this.powerUp;
    pu.timer -= dt;
    pu.mesh.rotation.y += dt * 2.5;

    if (pu.timer <= 0) {
      this.scene.remove(pu.mesh);
      this.powerUp = null;
      return;
    }

    if (this.player && Math.hypot(this.player.x - pu.x, this.player.z - pu.z) < 1.05) {
      this.applyPowerUp(pu.kind);
      this.scene.remove(pu.mesh);
      this.powerUp = null;
    }
  }

  private applyPowerUp(kind: PowerUpKind): void {
    if (!this.player) return;

    if (kind === 'repair') {
      // Restores +45% Player HP and +35% HQ Base HP
      const healP = Math.round(this.player.maxHp * 0.45);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + healP);

      const healB = Math.round(this.baseMaxHp * 0.35);
      this.baseHp = Math.min(this.baseMaxHp, this.baseHp + healB);

      this.sound.playRepair();
      this.showFloatingText(this.player.x, this.player.z, '+РЕМОНТ! 🔧', '#10b981', true);
    } else if (kind === 'star') {
      this.playerStars = Math.min(3, this.playerStars + 1);
      const save = this.storage.getData();
      this.player.stats = computeTankStats(save.selectedClass, save.tankUpgrades[save.selectedClass], this.playerStars);
      this.player.maxHp = this.player.stats.maxHp;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
      this.player.visual.twinBarrel.visible = this.playerStars >= 2;
      this.sound.playPowerUpPickup();
      this.showFloatingText(this.player.x, this.player.z, '★ ЗБРОЯ ПОКРАЩЕНА!', '#fbbf24', true);
    } else if (kind === 'shield') {
      this.shieldTimer = 10.0;
      this.sound.playPowerUpPickup();
      this.showFloatingText(this.player.x, this.player.z, '🛡️ ЕНЕРГОЩИТ!', '#38bdf8', true);
    } else if (kind === 'clock') {
      this.freezeTimer = 9.0;
      this.sound.playPowerUpPickup();
      this.showFloatingText(this.player.x, this.player.z, '⏱️ ЗАМОРОЗКА!', '#a855f7', true);
    } else if (kind === 'shovel') {
      this.shovelTimer = 16.0;
      this.setBaseWallMaterial(SubTile.Steel);
      this.sound.playPowerUpPickup();
      this.showFloatingText(0, 17, '🧱 СТАЛЕВИЙ ШТАБ!', '#94a3b8', true);
    } else if (kind === 'grenade') {
      this.sound.playExplosion(true);
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        this.damageEnemy(e, 999);
      }
      this.shake(0.4);
      this.showFloatingText(this.player.x, this.player.z, '💣 БОМБА!', '#f43f5e', true);
    } else if (kind === 'life') {
      this.lives++;
      this.sound.playPowerUpPickup(true);
      this.showFloatingText(this.player.x, this.player.z, '❤️ +1 ЖИТТЯ!', '#22c55e', true);
    }
    this.emitHud();
  }

  // ============================================================================
  // Enemy & Boss AI Loops
  // ============================================================================

  private updateEnemyAI(dt: number): void {
    if (this.freezeTimer > 0) return;

    for (const e of this.enemies) {
      e.aiTurnTimer -= dt;
      e.aiShootTimer -= dt;
      e.reloadTimer -= dt;

      if (e.aiTurnTimer <= 0) {
        e.aiTurnTimer = 0.8 + Math.random() * 1.4;

        // Choose target: 50% player, 35% base, 15% random
        let tx = 0;
        let tz = 17;
        const roll = Math.random();
        if (roll < 0.5 && this.player) {
          tx = this.player.x;
          tz = this.player.z;
        } else if (roll > 0.85) {
          tx = (Math.random() - 0.5) * 28;
          tz = (Math.random() - 0.5) * 28;
        }

        e.hullAngle = Math.atan2(-(tx - e.x), -(tz - e.z));
        e.turretAngle = e.hullAngle;
      }

      // Move along hull angle
      const dx = -Math.sin(e.hullAngle) * e.speed * dt;
      const dz = -Math.cos(e.hullAngle) * e.speed * dt;
      const r = 0.78;

      if (!this.isCircleBlocked(e.x + dx, e.z + dz, r)) {
        e.x += dx;
        e.z += dz;
      } else {
        // Pick new angle immediately if blocked
        e.hullAngle += (Math.random() > 0.5 ? 1 : -1) * (Math.PI * 0.5);
        e.turretAngle = e.hullAngle;
      }

      // Shoot
      if (e.aiShootTimer <= 0 && e.reloadTimer <= 0 && e.activeBullets < e.maxBullets) {
        e.aiShootTimer = 1.0 + Math.random() * 1.5;
        e.reloadTimer = e.reloadDelay;

        const bDirX = -Math.sin(e.turretAngle);
        const bDirZ = -Math.cos(e.turretAngle);
        const tipX = e.x + bDirX * 1.25;
        const tipZ = e.z + bDirZ * 1.25;

        this.particles.spawnMuzzleFlash(tipX, tipZ, 0xf43f5e);
        this.spawnBullet({
          fromPlayer: false,
          ownerEnemy: e,
          damage: 28,
          canBreakSteel: false,
          x: tipX,
          z: tipZ,
          vx: bDirX * e.bulletSpeed,
          vz: bDirZ * e.bulletSpeed
        });
        e.activeBullets++;
      }

      this.syncEnemyTransform(e);
    }
  }

  private updateBossAI(dt: number): void {
    if (!this.boss || this.freezeTimer > 0) return;
    const b = this.boss;

    b.shootTimer -= dt;
    b.mortarTimer -= dt;

    // Boss looks towards player if alive, else towards center
    const targetX = this.player ? this.player.x : 0;
    const targetZ = this.player ? this.player.z : 12;

    const angleToTarget = Math.atan2(-(targetX - b.x), -(targetZ - b.z));
    b.turretAngle = angleToTarget;

    // Movement: slowly advance towards player/base
    const moveDirX = -Math.sin(angleToTarget) * b.speed * dt * 0.4;
    const moveDirZ = -Math.cos(angleToTarget) * b.speed * dt * 0.4;
    const r = 1.48;

    if (!this.isCircleBlocked(b.x + moveDirX, b.z + moveDirZ, r)) {
      b.x += moveDirX;
      b.z += moveDirZ;
      b.hullAngle = angleToTarget;
    }

    // Regular Fan Attack
    if (b.shootTimer <= 0) {
      b.shootTimer = b.phase === 1 ? 1.6 : 1.1;
      const count = b.phase === 1 ? 3 : 5;
      const spread = b.phase === 1 ? 0.22 : 0.18;
      const startOffset = -((count - 1) / 2) * spread;

      for (let i = 0; i < count; i++) {
        const shotAngle = b.turretAngle + startOffset + i * spread;
        const dirX = -Math.sin(shotAngle);
        const dirZ = -Math.cos(shotAngle);
        const tipX = b.x + dirX * 2.2;
        const tipZ = b.z + dirZ * 2.2;

        this.particles.spawnMuzzleFlash(tipX, tipZ, 0xef4444);
        this.spawnBullet({
          fromPlayer: false,
          damage: 34,
          canBreakSteel: true,
          x: tipX,
          z: tipZ,
          vx: dirX * 18,
          vz: dirZ * 18
        });
      }
      this.sound.playShoot(true);
    }

    // Mortar Barrage with Red Warning Telegraph Zones!
    if (b.mortarTimer <= 0 && this.player) {
      b.mortarTimer = b.phase === 1 ? 5.2 : 3.4;
      this.sound.playMortarWhistle();

      const numZones = b.phase === 1 ? 2 : 3;
      for (let i = 0; i < numZones; i++) {
        const offsetDist = i === 0 ? 0 : 2.5 + Math.random() * 3.5;
        const offsetAngle = Math.random() * Math.PI * 2;
        const zx = Math.max(-16, Math.min(16, this.player.x + Math.cos(offsetAngle) * offsetDist));
        const zz = Math.max(-16, Math.min(16, this.player.z + Math.sin(offsetAngle) * offsetDist));

        const zone = this.assets.createTelegraphZone(2.5);
        zone.group.position.set(zx, 0.04, zz);
        this.scene.add(zone.group);

        this.telegraphs.push({
          x: zx,
          z: zz,
          radius: 2.5,
          timer: 1.35,
          group: zone.group,
          fillMat: zone.fillMat
        });
      }
    }

    this.syncBossTransform();
  }

  private updateTelegraphZones(dt: number): void {
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const t = this.telegraphs[i];
      t.timer -= dt;

      // Pulsing red alpha
      const pulse = 0.28 + Math.sin((1.35 - t.timer) * 16) * 0.18;
      t.fillMat.opacity = pulse;

      if (t.timer <= 0) {
        // Mortar Impact Detonation
        this.sound.playExplosion(true);
        this.particles.spawnExplosion(t.x, t.z, true);
        this.particles.spawnScorchCrater(t.x, t.z, true);

        // Damage Player
        if (this.player && this.shieldTimer <= 0) {
          const d = Math.hypot(this.player.x - t.x, this.player.z - t.z);
          if (d <= t.radius) {
            this.damagePlayer(45);
          }
        }

        // Damage bricks & barrels in zone
        this.destroyBricksInRadius(t.x, t.z, t.radius);
        for (let j = this.barrels.length - 1; j >= 0; j--) {
          const b = this.barrels[j];
          if (Math.hypot(b.x - t.x, b.z - t.z) <= t.radius) {
            this.detonateBarrel(b);
          }
        }

        this.scene.remove(t.group);
        t.fillMat.dispose();
        this.telegraphs.splice(i, 1);
      }
    }
  }

  // ============================================================================
  // Collision Helper (Circular vs SubGrid & Barrels)
  // ============================================================================

  private getTileAt(x: number, z: number): SubTile {
    const sx = Math.floor(x + 18);
    const sz = Math.floor(z + 18);
    if (sx < 0 || sx >= 36 || sz < 0 || sz >= 36) return SubTile.Empty;
    return this.grid[sz][sx];
  }

  private isCircleBlocked(x: number, z: number, radius: number): boolean {
    // Outer perimeter boundary
    if (Math.abs(x) + radius > 17.8 || Math.abs(z) + radius > 17.8) {
      return true;
    }

    const minSx = Math.max(0, Math.floor(x - radius + 18));
    const maxSx = Math.min(35, Math.floor(x + radius + 18));
    const minSz = Math.max(0, Math.floor(z - radius + 18));
    const maxSz = Math.min(35, Math.floor(z + radius + 18));

    for (let sz = minSz; sz <= maxSz; sz++) {
      for (let sx = minSx; sx <= maxSx; sx++) {
        const tile = this.grid[sz][sx];
        if (tile === SubTile.Brick || tile === SubTile.Steel || tile === SubTile.Water || tile === SubTile.Base) {
          const wx = -17.5 + sx;
          const wz = -17.5 + sz;
          // Closest point on unit box [-0.5, 0.5]
          const cx = Math.max(wx - 0.49, Math.min(wx + 0.49, x));
          const cz = Math.max(wz - 0.49, Math.min(wz + 0.49, z));
          const distSq = (x - cx) ** 2 + (z - cz) ** 2;
          if (distSq < radius * radius) {
            return true;
          }
        }
      }
    }

    // Barrels collision
    for (const b of this.barrels) {
      const distSq = (x - b.x) ** 2 + (z - b.z) ** 2;
      if (distSq < (radius + 0.5) ** 2) {
        return true;
      }
    }

    return false;
  }

  // ============================================================================
  // Camera & Screen Radar Projection
  // ============================================================================

  private shake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  private updateCamera(dt: number): void {
    if (this.mode === 'menu') {
      this.elapsed += dt;
      const radius = 38;
      const angle = this.elapsed * 0.12;
      this.camera.position.set(Math.cos(angle) * radius, 26, Math.sin(angle) * radius);
      this.camera.lookAt(0, 0, 0);
      return;
    }

    if (this.mode === 'hangar') {
      const aspect = window.innerWidth / window.innerHeight;
      if (aspect > 1.1) {
        // Desktop: camera framed to shift tank to left half
        this.camera.position.set(-2.8, 3.8, 6.2);
        this.camera.lookAt(1.6, 0.5, 0);
      } else {
        // Mobile: shift tank to top half
        this.camera.position.set(0, 5.2, 7.0);
        this.camera.lookAt(0, -1.2, 0);
      }
      return;
    }

    // Combat camera following player
    const px = this.player ? this.player.x : 0;
    const pz = this.player ? this.player.z : 12;

    let targetCamX = 0;
    let targetCamY = 28;
    let targetCamZ = 22;
    let lookTargetX = px * 0.25;
    let lookTargetY = 0;
    let lookTargetZ = pz * 0.25;

    if (this.cameraMode === 'top') {
      targetCamX = px * 0.2;
      targetCamY = 38;
      targetCamZ = pz * 0.2;
      lookTargetX = 0;
      lookTargetZ = 0;
    } else if (this.cameraMode === 'follow' && this.player) {
      const dx = -Math.sin(this.player.hullAngle);
      const dz = -Math.cos(this.player.hullAngle);
      targetCamX = px - dx * 7.5;
      targetCamY = 8.5;
      targetCamZ = pz - dz * 7.5;
      lookTargetX = px + dx * 5;
      lookTargetY = 1.0;
      lookTargetZ = pz + dz * 5;
    } else {
      // Default 'angled'
      targetCamX = px * 0.45;
      targetCamY = 24.5;
      targetCamZ = pz * 0.45 + 17.5;
    }

    // Screen Shake
    if (this.shakeIntensity > 0) {
      targetCamX += (Math.random() - 0.5) * this.shakeIntensity * 1.8;
      targetCamY += (Math.random() - 0.5) * this.shakeIntensity * 1.8;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 2.2);
    }

    this.camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), Math.min(1.0, dt * 7.5));
    this.camera.lookAt(lookTargetX, lookTargetY, lookTargetZ);
  }

  private emitRadar(): void {
    if (!this.callbacks.onRadarUpdate || this.mode !== 'playing') {
      this.callbacks.onRadarUpdate?.([]);
      return;
    }

    const indicators: RadarIndicator[] = [];
    const width = window.innerWidth;
    const height = window.innerHeight;
    const now = performance.now();

    const projectTarget = (wx: number, wz: number, kind: 'base' | 'boss' | 'enemy', urgent = false) => {
      const pos = new THREE.Vector3(wx, 0.6, wz);
      pos.project(this.camera);

      // Handle behind camera
      if (pos.z > 1.0) {
        pos.x = -pos.x;
        pos.y = -pos.y;
      }

      const isOffscreen = Math.abs(pos.x) > 0.85 || Math.abs(pos.y) > 0.85 || pos.z > 1.0;
      if (isOffscreen || urgent) {
        const dx = pos.x;
        const dy = pos.y;
        const scale = Math.min(0.86 / (Math.abs(dx) || 0.001), 0.86 / (Math.abs(dy) || 0.001));
        const cx = Math.max(-0.86, Math.min(0.86, dx * scale));
        const cy = Math.max(-0.86, Math.min(0.86, dy * scale));

        const px = (cx * 0.5 + 0.5) * width;
        const py = (-cy * 0.5 + 0.5) * height;
        const angleRad = Math.atan2(dx, dy);

        indicators.push({ kind, x: px, y: py, angleRad, urgent });
      }
    };

    // 1. Headquarters Base (0, 0, 17)
    const isBaseUrgent = now - this.lastBaseHitTime < 3000;
    projectTarget(0, 17, 'base', isBaseUrgent);

    // 2. Boss
    if (this.boss) {
      projectTarget(this.boss.x, this.boss.z, 'boss', false);
    }

    // 3. Enemies
    for (const e of this.enemies) {
      projectTarget(e.x, e.z, 'enemy', false);
    }

    this.callbacks.onRadarUpdate(indicators);
  }

  private showFloatingText(worldX: number, worldZ: number, text: string, color: string, big = false): void {
    if (!this.callbacks.onFloatingText) return;
    const pos = new THREE.Vector3(worldX, 1.2, worldZ);
    pos.project(this.camera);
    if (pos.z > 1.0) return;

    const px = (pos.x * 0.5 + 0.5) * window.innerWidth;
    const py = (-pos.y * 0.5 + 0.5) * window.innerHeight;
    this.callbacks.onFloatingText({ x: px, y: py, text, color, big });
  }

  // ============================================================================
  // Sync 3D Transforms
  // ============================================================================

  private syncPlayerTransform(): void {
    if (!this.player) return;
    const p = this.player;
    p.visual.root.position.set(p.x, 0, p.z);
    p.visual.hullGroup.rotation.y = p.hullAngle;
    p.visual.turretPivot.rotation.y = p.turretAngle;
    p.visual.shieldMesh.visible = this.shieldTimer > 0;
  }

  private syncEnemyTransform(e: EnemyEntity): void {
    e.visual.root.position.set(e.x, 0, e.z);
    e.visual.hullGroup.rotation.y = e.hullAngle;
    e.visual.turretPivot.rotation.y = e.turretAngle;
  }

  private syncBossTransform(): void {
    if (!this.boss) return;
    const b = this.boss;
    b.visual.root.position.set(b.x, 0, b.z);
    b.visual.hullGroup.rotation.y = b.hullAngle;
    b.visual.turretPivot.rotation.y = b.turretAngle;
  }

  // ============================================================================
  // Main Game Loop
  // ============================================================================

  private loop(now: number): void {
    requestAnimationFrame((t) => this.loop(t));

    const dt = Math.min(0.066, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    if (this.mode === 'hangar') {
      if (this.hangarTankVisual) {
        this.elapsed += dt;
        this.hangarTankVisual.hullGroup.rotation.y = this.elapsed * 0.6;
        this.hangarTankVisual.turretPivot.rotation.y = Math.sin(this.elapsed * 1.3) * 0.35;
      }
      this.updateCamera(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.mode === 'menu') {
      this.updateCamera(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.mode === 'paused') {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Mode is 'playing' or 'ending'
    this.elapsed += dt;

    if (this.shieldTimer > 0) this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    if (this.freezeTimer > 0) this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    if (this.shovelTimer > 0) {
      this.shovelTimer = Math.max(0, this.shovelTimer - dt);
      if (this.shovelTimer <= 0) {
        this.setBaseWallMaterial(SubTile.Brick);
      }
    }

    // Respawn Player after death
    if (this.playerRespawnTimer > 0) {
      this.playerRespawnTimer -= dt;
      if (this.playerRespawnTimer <= 0 && this.lives > 0) {
        this.spawnPlayerTank(3.5);
      }
    }

    // Portal spawning
    for (let i = this.portals.length - 1; i >= 0; i--) {
      const p = this.portals[i];
      p.timer -= dt;
      p.mesh.rotation.z += dt * 4;
      if (p.timer <= 0) {
        this.scene.remove(p.mesh);
        this.portals.splice(i, 1);
        if (p.isBoss && this.stageDef.boss) {
          this.createBoss(this.stageDef.boss);
        } else if (p.enemyKind) {
          const e = this.createEnemyTank(p.x, p.z, p.enemyKind, Boolean(p.isBonus));
          this.enemies.push(e);
        }
      }
    }

    // Queue new enemy spawns
    if (this.enemyQueue.length > 0 && this.enemies.length < 5) {
      this.spawnCooldown -= dt;
      if (this.spawnCooldown <= 0) {
        this.spawnCooldown = 1.2;
        const next = this.enemyQueue.shift()!;
        this.spawnEnemyPortal(this.nextSpawnSlot++, next.kind, next.isBonus);
      }
    }

    // Updates
    this.updatePlayerMovement(dt);
    this.updatePlayerAiming();
    this.handlePlayerShooting(dt);

    this.updateEnemyAI(dt);
    this.updateBossAI(dt);
    this.updateTelegraphZones(dt);
    this.updateBullets(dt);
    this.updateCoins(dt);
    this.updatePowerUps(dt);
    this.particles.update(dt);

    // End condition evaluation
    this.checkEndConditions(dt);

    this.updateCamera(dt);

    this.uiSyncTimer += dt;
    if (this.uiSyncTimer >= 0.06) {
      this.uiSyncTimer = 0;
      this.emitRadar();
      this.emitHud();
    }

    this.renderer.render(this.scene, this.camera);
  }

  // ============================================================================
  // Win / Loss / Horde Transitions
  // ============================================================================

  private checkEndConditions(dt: number): void {
    if (this.mode !== 'playing') {
      if (this.mode === 'ending') {
        this.endDelayTimer -= dt;
        if (this.endDelayTimer <= 0) {
          this.executeRoundConclusion();
        }
      }
      return;
    }

    // Stage Clear Check: queue empty, all enemies defeated, boss defeated
    const noEnemiesLeft =
      this.enemyQueue.length === 0 &&
      this.enemies.length === 0 &&
      this.portals.length === 0 &&
      (!this.boss || this.boss.hp <= 0);

    if (noEnemiesLeft && !this.baseDestroyed && this.lives > 0) {
      this.mode = 'ending';
      this.endOutcome = this.gameMode === 'horde' ? 'horde_next' : 'victory';
      this.endDelayTimer = 1.6;
      if (this.gameMode === 'campaign') {
        this.sound.playVictory();
      }
    }
  }

  private triggerGameOver(reason: string): void {
    if (this.mode === 'ending') return;
    this.mode = 'ending';
    this.endOutcome = 'gameover';
    this.gameOverReason = reason;
    this.endDelayTimer = 1.6;
    this.sound.playGameOver();
  }

  private executeRoundConclusion(): void {
    if (this.endOutcome === 'victory') {
      const stageCoins = this.currentStage * 35;
      this.storage.addCoins(stageCoins);
      this.runCoinsEarned += stageCoins;
      this.storage.unlockStage(this.currentStage + 1);
      this.storage.updateScore(this.score);

      this.callbacks.onStageVictory(this.currentStage, this.stageKills, this.score, this.runCoinsEarned);
    } else if (this.endOutcome === 'horde_next') {
      // Wave complete: award wave bonus, heal player and base, then auto-start next wave
      const waveCoins = this.hordeWave * 30;
      this.storage.addCoins(waveCoins);
      this.runCoinsEarned += waveCoins;
      this.storage.updateHordeWave(this.hordeWave);
      this.storage.updateScore(this.score);

      // Heal Player +30% and Base +20%
      if (this.player) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp * 0.3));
      }
      this.baseHp = Math.min(this.baseMaxHp, this.baseHp + Math.round(this.baseMaxHp * 0.2));

      this.sound.playRepair();
      this.startHordeWave(this.hordeWave + 1);
    } else if (this.endOutcome === 'gameover') {
      const isNewRecord = this.storage.updateScore(this.score);
      this.callbacks.onGameOver(this.gameOverReason, this.score, this.storage.getData().bestScore, isNewRecord, this.runCoinsEarned);
    }
  }

  private emitHud(): void {
    const save = this.storage.getData();
    const hud: HudState = {
      mode: this.gameMode,
      stageOrWave: this.gameMode === 'campaign' ? this.currentStage : this.hordeWave,
      stageName: this.stageDef.name,
      biome: this.stageDef.biome,
      enemiesRemaining: this.enemyQueue.length + this.enemies.length + (this.boss ? 1 : 0),
      lives: Math.max(0, this.lives),
      playerHp: this.player ? Math.max(0, this.player.hp) : 0,
      playerMaxHp: this.player ? this.player.maxHp : 100,
      baseHp: Math.max(0, this.baseHp),
      baseMaxHp: this.baseMaxHp,
      stars: this.playerStars,
      score: this.score,
      bestScore: save.bestScore,
      coins: save.coins,
      shieldTimer: Math.max(0, this.shieldTimer),
      freezeTimer: Math.max(0, this.freezeTimer),
      shovelTimer: Math.max(0, this.shovelTimer),
      bossName: this.boss ? this.boss.spec.name : null,
      bossHp: this.boss ? Math.max(0, this.boss.hp) : 0,
      bossMaxHp: this.boss ? this.boss.maxHp : 0
    };
    this.callbacks.onHudUpdate(hud);
  }
}
