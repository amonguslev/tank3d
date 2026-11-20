import * as THREE from 'three';
import type { SoundEngine } from './audio';
import {
  computeTankStats,
  MAP_DEFINITIONS,
  TANK_SPECS,
  TANK_TIER_ORDER
} from './classes';
import type { InputManager, WotInputSnapshot } from './input';
import {
  buildWoTMapArena,
  type BuiltMapArena,
  generateDuelOpponent,
  generateWaveEnemies,
  type MapObstacle,
  type EnemyWaveUnitSpec,
  WORLD_HALF_SIZE
} from './levels';
import {
  createCaptureBaseMesh,
  createExplosiveBarrelMesh,
  createHangarEnvironment,
  createPickupMesh,
  createProjectileMesh,
  createTankRig,
  type CaptureBaseVisual,
  type TankVisualRig
} from './meshes';
import { ParticleSystem } from './particles';
import type { StorageManager } from './storage';
import type {
  BattleSummary,
  ComputedTankStats,
  FloatingTextItem,
  GameModeKind,
  HudState,
  MapBiomeId,
  MinimapEntity,
  PowerUpKind,
  ProjectileStyle,
  TankCamoId,
  TankTierId,
  TeamBattleHudState,
  TeamRosterEntry,
  TeamSide,
  WeaponSlot
} from './types';

// ============================================================================
// Public Interfaces & Types
// ============================================================================

export interface EnemyPlateScreenItem {
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

export interface TurretAimScreenOffset {
  dxPx: number;
  dyPx: number;
  converged: boolean;
}

export interface TankGameCallbacks {
  onHudUpdate: (hud: HudState) => void;
  onEnemyPlatesUpdate: (plates: EnemyPlateScreenItem[]) => void;
  onTurretAimUpdate: (aim: TurretAimScreenOffset) => void;
  onFloatingText: (item: FloatingTextItem) => void;
  onWaveBanner: (title: string, subtitle?: string) => void;
  onBattleEnd: (summary: BattleSummary) => void;
  onPauseChange?: (paused: boolean) => void;
  onPauseChanged?: (paused: boolean) => void;
}

// ============================================================================
// Internal Battle Entities
// ============================================================================

interface ActiveEnemy {
  id: number;
  team: TeamSide;
  spec: EnemyWaveUnitSpec;
  rig: TankVisualRig;
  x: number;
  z: number;
  groundY: number;
  hullYaw: number;
  turretYaw: number;
  gunPitch: number;
  hp: number;
  maxHp: number;
  reloadLeft: number;
  frontRecoil: number;
  aiTimer: number;
  targetPos: THREE.Vector3;
  stuckTimer: number;
  vx: number;
  vz: number;
  strafeDir: number;
  evasionTimer: number;
  lastHitTime: number;
  lastAttackerIsPlayer: boolean;
  reverseTimer: number;
}

interface ActiveProjectile {
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  team: TeamSide;
  fromPlayer: boolean;
  ownerEnemyId?: number;
  damage: number;
  style: ProjectileStyle;
  aoeRadius: number;
  chainCount: number;
  chainRange: number;
  gravity: number;
  life: number;
  maxLife: number;
}

interface ActivePickup {
  group: THREE.Group;
  kind: PowerUpKind;
  x: number;
  z: number;
  groundY: number;
  life: number;
}

interface ActiveBarrel {
  mesh: THREE.Group;
  x: number;
  z: number;
  groundY: number;
  radius: number;
  alive: boolean;
}

// ============================================================================
// TankGame3D: World of Tanks Edition (v3.0) 3D Game Engine
// ============================================================================

export class TankGame3D {
  // Core infrastructure
  private canvas: HTMLCanvasElement;
  private audio: SoundEngine;
  private input: InputManager;
  private storage: StorageManager;
  private callbacks: TankGameCallbacks;

  // Three.js Renderers & Scenes
  private renderer: THREE.WebGLRenderer;
  private battleScene: THREE.Scene;
  private hangarScene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  // Particle System
  private battleParticles: ParticleSystem;

  // State flags
  private inBattle = false;
  private paused = false;
  private animationFrameId: number | null = null;
  private lastTimeSec = 0;

  // Hangar State
  private hangarRig: TankVisualRig | null = null;
  private hangarTierId: TankTierId = 'tier1';
  private hangarOrbitYaw = 0.55;
  private hangarOrbitPitch = 0.28;
  private hangarTurntableYaw = 0;
  private hangarEnv: THREE.Group | null = null;

  // Active Battle Setup
  private currentMode: GameModeKind = 'waves';
  private currentMapId: MapBiomeId = 'hills';
  private playerTierId: TankTierId = 'tier1';
  private arena: BuiltMapArena | null = null;
  private arenaLights: THREE.Group | null = null;

  // Player Tank State
  private playerRig: TankVisualRig | null = null;
  private playerStats!: ComputedTankStats;
  private playerX = 0;
  private playerZ = 0;
  private playerGroundY = 0;
  private playerHullYaw = 0;
  private playerTurretYaw = 0;
  private playerGunPitch = 0;
  private playerHp = 300;
  private playerMaxHp = 300;
  private playerSpeedKmh = 0;
  private playerTreadDist = 0;

  // Weapon Systems
  private activeWeaponSlot: WeaponSlot = 1;
  private primaryReloadLeft = 0;
  private secondaryReloadLeft = 0;
  private repairCooldownLeft = 0;
  private playerFrontRecoil = 0;
  private playerRearRecoil = 0;

  // Satellite Artillery Systems
  private artyShotsLeft = 2;
  private artyShotsMax = 2;
  private artyInterShotCooldown = 0;
  private artyAutoReloadTimer = 0;
  private artyAimPos = new THREE.Vector2(0, 0);
  private artyReticleMesh: THREE.Group | null = null;
  private lastInputYaw = 0;
  private lastInputPitch = 0;

  // Power-up Buff Timers
  private damageBoostTimer = 0;
  private speedBoostTimer = 0;
  private shieldTimer = 0;

  // WoT Camera & Targeting
  private cameraLookDir = new THREE.Vector3(0, 0, 1);
  private wasSniper = false;
  private aimDistanceMeters = 50;
  private targetEnemyName: string | null = null;
  private targetEnemyHp = 0;
  private targetEnemyMaxHp = 0;

  // Battle Wave Management
  private waveNumber = 1;
  private waveQueue: EnemyWaveUnitSpec[] = [];
  private activeEnemies: ActiveEnemy[] = [];
  private enemyIdCounter = 1;

  // Duel Mode
  private duelOpponent: ActiveEnemy | null = null;

  // Team Battle 5v5 + Capture Base Mode
  private captureBaseVisual: CaptureBaseVisual | null = null;
  private captureProgress = 0;
  private captureTeam: TeamSide | 'contested' | null = null;
  private captureOwnerProgressTeam: TeamSide | null = null;
  private baseAlarmTimer = 0;
  private teamAlliesRoster: Array<{ id: number; tier: number; isPlayer?: boolean }> = [];
  private teamEnemiesRoster: Array<{ id: number; tier: number }> = [];

  // Entities
  private projectiles: ActiveProjectile[] = [];
  private pickups: ActivePickup[] = [];
  private barrels: ActiveBarrel[] = [];

  // Statistics for Run
  private score = 0;
  private coinsEarned = 0;
  private killsInRun = 0;
  private totalDamageDealt = 0;
  private battleEndTime = 0;

  // Screen shake
  private screenShakeIntensity = 0;

  constructor(
    canvas: HTMLCanvasElement,
    audioOrInput: SoundEngine | InputManager,
    inputOrAudio: InputManager | SoundEngine,
    storage: StorageManager,
    callbacks: TankGameCallbacks
  ) {
    this.canvas = canvas;

    // Flexible dependency injection (guards against parameter order inversions)
    if ('unlock' in audioOrInput && typeof (audioOrInput as SoundEngine).unlock === 'function') {
      this.audio = audioOrInput as SoundEngine;
      this.input = inputOrAudio as InputManager;
    } else {
      this.input = audioOrInput as InputManager;
      this.audio = inputOrAudio as SoundEngine;
    }

    this.storage = storage;
    this.callbacks = callbacks;

    // WebGL Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Scenes
    this.battleScene = new THREE.Scene();
    this.hangarScene = new THREE.Scene();

    // Perspective Camera (Default 58° FOV)
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.2, 380);

    // Particle Systems
    this.battleParticles = new ParticleSystem(this.battleScene);

    // Bind Window Resize
    window.addEventListener('resize', () => this.handleResize());

    // Init Hangar Environment
    this.initHangarEnvironment();

    // Start animation loop
    this.lastTimeSec = performance.now() / 1000;
    this.tick = this.tick.bind(this);
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  // ==========================================================================
  // Public Interface Methods
  // ==========================================================================

  showHangar(tierId?: TankTierId): void {
    this.inBattle = false;
    this.paused = false;
    this.input.setGameplayActive(false);

    const savedTank = this.storage.getData().selectedTank;
    const targetTier = tierId ?? savedTank ?? 'tier1';
    this.setHangarTank(targetTier);
  }

  setHangarTank(tierId: TankTierId, camoId?: TankCamoId): void {
    this.hangarTierId = tierId;

    if (this.hangarRig) {
      this.hangarScene.remove(this.hangarRig.root);
      this.hangarRig = null;
    }

    const activeCamo = camoId ?? this.storage.getSelectedCamo(tierId);
    const rig = createTankRig(tierId, { isEnemy: false, isBoss: false, camoId: activeCamo });
    rig.root.position.set(0, 0.35, 0);
    this.hangarRig = rig;
    this.hangarScene.add(rig.root);
  }

  orbitHangar(deltaYawRad: number, deltaPitchRad = 0): void {
    this.hangarOrbitYaw -= deltaYawRad;
    this.hangarOrbitPitch = Math.max(-0.05, Math.min(0.68, this.hangarOrbitPitch + deltaPitchRad));
  }

  setArtilleryAim(worldX: number, worldZ: number): void {
    const aimLimit = WORLD_HALF_SIZE - 1;
    this.artyAimPos.set(
      Math.max(-aimLimit, Math.min(aimLimit, worldX)),
      Math.max(-aimLimit, Math.min(aimLimit, worldZ))
    );
  }

  startBattle(mode: GameModeKind, tierId: TankTierId, mapId: MapBiomeId): void {
    this.inBattle = true;
    this.paused = false;
    this.currentMode = mode;
    this.currentMapId = mapId;
    this.playerTierId = tierId;

    // Clean previous battle data
    this.cleanBattleScene();

    // Activate input
    this.input.setGameplayActive(true);

    // Build arena
    this.arena = buildWoTMapArena(mapId);
    this.battleScene.add(this.arena.group);

    // Setup arena lights and sky/fog
    this.setupArenaLighting(mapId);

    // Player Stats from upgrades
    const upgrades = this.storage.getData().tankUpgrades[tierId];
    this.playerStats = computeTankStats(tierId, upgrades);
    this.playerHp = this.playerStats.maxHp;
    this.playerMaxHp = this.playerStats.maxHp;

    // Player Rig
    const playerCamo = this.storage.getSelectedCamo(tierId);
    this.playerRig = createTankRig(tierId, { isEnemy: false, isBoss: false, camoId: playerCamo });
    this.battleScene.add(this.playerRig.root);

    // Initial position from spawn
    const spawn = this.arena.playerSpawn;
    this.playerX = spawn.x;
    this.playerZ = spawn.z;
    this.playerHullYaw = spawn.yaw;
    this.playerTurretYaw = spawn.yaw;
    this.playerGunPitch = 0;
    this.playerGroundY = this.arena.getHeightAt(this.playerX, this.playerZ);
    this.playerRig.root.position.set(this.playerX, this.playerGroundY, this.playerZ);
    this.playerRig.root.rotation.y = this.playerHullYaw;

    // Align camera angles with spawn direction (subtle downward tilt)
    this.input.resetCameraAngles(spawn.yaw, -0.05);

    // Reset weapons & buffers
    this.activeWeaponSlot = 1;
    this.wasSniper = false;
    this.primaryReloadLeft = 0;
    this.secondaryReloadLeft = 0;
    this.repairCooldownLeft = 0;
    this.damageBoostTimer = 0;
    this.speedBoostTimer = 0;
    this.shieldTimer = 0;
    this.playerRig.shieldMesh.visible = false;

    // Reset Artillery Satellite status
    this.artyShotsLeft = this.artyShotsMax;
    this.artyInterShotCooldown = 0;
    this.artyAutoReloadTimer = 0;
    this.artyAimPos.set(this.playerX, this.playerZ);
    this.lastInputYaw = spawn.yaw;
    this.lastInputPitch = -0.05;

    if (!this.artyReticleMesh) {
      this.artyReticleMesh = this.createArtilleryReticleMesh();
    }
    this.artyReticleMesh.visible = false;
    this.battleScene.add(this.artyReticleMesh);

    // Run counters
    this.score = 0;
    this.coinsEarned = 0;
    this.killsInRun = 0;
    this.totalDamageDealt = 0;
    this.waveNumber = 1;

    // Spawn explosive barrels
    this.spawnArenaBarrels();

    // Spawn Mode-Specific Units
    if (this.currentMode === 'duel') {
      this.initDuelMode();
    } else if (this.currentMode === 'team_battle') {
      this.initTeamBattleMode();
    } else {
      this.initWaveMode(1);
    }

    // Play stage start sound
    this.audio.playStageStart();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.input.setGameplayActive(!paused && this.inBattle);
    this.callbacks.onPauseChange?.(paused);
    // Legacy support
    (this.callbacks as unknown as { onPauseChanged?: (p: boolean) => void }).onPauseChanged?.(paused);
  }

  isPaused(): boolean {
    return this.paused;
  }

  isInBattle(): boolean {
    return this.inBattle;
  }

  restartCurrentBattle(): void {
    if (this.inBattle) {
      if (this.coinsEarned > 0 || this.killsInRun > 0) {
        this.storage.recordBattleResult({
          victory: false,
          mode: this.currentMode,
          waveReached: Math.max(1, this.waveNumber - 1),
          kills: this.killsInRun,
          damageDealt: this.totalDamageDealt,
          coinsEarned: this.coinsEarned,
          score: this.score,
          isNewBestWave: false
        });
      }
      this.startBattle(this.currentMode, this.playerTierId, this.currentMapId);
    }
  }

  returnToHangar(): void {
    if (this.inBattle && (this.coinsEarned > 0 || this.killsInRun > 0)) {
      this.storage.recordBattleResult({
        victory: false,
        mode: this.currentMode,
        waveReached: Math.max(1, this.waveNumber - 1),
        kills: this.killsInRun,
        damageDealt: this.totalDamageDealt,
        coinsEarned: this.coinsEarned,
        score: this.score,
        isNewBestWave: false
      });
    }
    this.cleanBattleScene();
    this.showHangar(this.storage.getData().selectedTank);
  }

  handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.cleanBattleScene();
    this.renderer.dispose();
  }

  // ==========================================================================
  // Hangar Environment & Lighting
  // ==========================================================================

  private initHangarEnvironment(): void {
    this.hangarEnv = createHangarEnvironment();
    this.hangarScene.add(this.hangarEnv);

    // Ambient light
    const ambient = new THREE.AmbientLight(0xfffbeb, 0.65);
    this.hangarScene.add(ambient);

    // Directional warm sunlight through skylights
    const sun = new THREE.DirectionalLight(0xfef3c7, 1.8);
    sun.position.set(12, 22, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    this.hangarScene.add(sun);

    // Warm turntable rim light
    const rim = new THREE.PointLight(0x38bdf8, 1.4, 25);
    rim.position.set(0, 4.5, -6);
    this.hangarScene.add(rim);

    // Hangar fog
    this.hangarScene.fog = new THREE.Fog(0x18181b, 20, 65);
    this.hangarScene.background = new THREE.Color(0x18181b);
  }

  // ==========================================================================
  // Battle Environment & Lighting Setup
  // ==========================================================================

  private setupArenaLighting(mapId: MapBiomeId): void {
    const mapDef = MAP_DEFINITIONS[mapId];

    // Sky & Fog
    this.battleScene.background = new THREE.Color(mapDef.skyColor);
    this.battleScene.fog = new THREE.FogExp2(mapDef.fogColor, 0.0055);

    this.arenaLights = new THREE.Group();
    this.arenaLights.name = 'ArenaLights';

    // Hemisphere Light (для Хіммельсдорфа: глибоке нічне небо та теплий вечірній відблиск ліхтарів)
    const hemiSky = mapId === 'city' ? 0x2563eb : mapDef.skyColor;
    const hemiGround = mapId === 'city' ? 0xd97706 : mapDef.groundColor;
    const hemiIntensity = mapId === 'city' ? 0.75 : 0.85;
    const hemi = new THREE.HemisphereLight(hemiSky, hemiGround, hemiIntensity);
    hemi.position.set(0, 50, 0);
    this.arenaLights.add(hemi);

    // Контрастне місячне світло для міста або сонячне для денних карт
    const dirColor = mapId === 'city' ? 0xdbeafe : 0xffffff;
    const dirIntensity = mapId === 'city' ? 1.4 : 1.6;
    const sun = new THREE.DirectionalLight(dirColor, dirIntensity);
    sun.position.set(50, 75, 45);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 240;
    const d = 95;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0004;
    this.arenaLights.add(sun);

    this.battleScene.add(this.arenaLights);
  }

  private spawnArenaBarrels(): void {
    if (!this.arena) return;
    this.barrels = [];

    for (const p of this.arena.barrelSpawns) {
      const mesh = createExplosiveBarrelMesh();
      const groundY = this.arena.getHeightAt(p.x, p.z);
      mesh.position.set(p.x, groundY, p.z);
      this.battleScene.add(mesh);

      this.barrels.push({
        mesh,
        x: p.x,
        z: p.z,
        groundY,
        radius: 0.55,
        alive: true
      });
    }
  }

  // ==========================================================================
  // Mode Initializations
  // ==========================================================================

  private initWaveMode(wave: number): void {
    this.waveNumber = wave;
    const waveUnits = generateWaveEnemies(wave);
    this.waveQueue = [...waveUnits];
    this.activeEnemies = [];

    const isBoss = wave % 5 === 0;
    if (isBoss) {
      this.audio.playBossAlert();
      this.callbacks.onWaveBanner?.(
        `ХВИЛЯ ${wave}: БОС!`,
        'УВАГА: Наближається надважкий командирський танк!'
      );
    } else {
      this.callbacks.onWaveBanner?.(
        `ХВИЛЯ ${wave}`,
        `Знищте ${waveUnits.length} ворожих танків!`
      );
    }

    // Spawn up to 5 initial active enemies
    this.fillWaveSpawns();
  }

  private fillWaveSpawns(): void {
    if (!this.arena) return;

    // Maximum 5-6 simultaneously active enemies on arena
    const maxSimultaneous = 5;
    while (this.activeEnemies.length < maxSimultaneous && this.waveQueue.length > 0) {
      const spec = this.waveQueue.shift()!;
      this.spawnWaveEnemy(spec);
    }
  }

  private spawnWaveEnemy(spec: EnemyWaveUnitSpec): void {
    if (!this.arena) return;

    // Pick spawn point furthest from player
    const spawnPoints = this.arena.waveSpawnPoints;
    let bestDist = -1;
    let bestPt = spawnPoints[0];

    for (const pt of spawnPoints) {
      const d = Math.hypot(pt.x - this.playerX, pt.z - this.playerZ);
      if (d > bestDist) {
        bestDist = d;
        bestPt = pt;
      }
    }

    // Add slight jitter
    const sx = bestPt.x + (Math.random() - 0.5) * 8;
    const sz = bestPt.z + (Math.random() - 0.5) * 8;
    const groundY = this.arena.getHeightAt(sx, sz);

    const rig = createTankRig(spec.tierId, {
      isEnemy: true,
      isBoss: spec.isBoss,
      scaleOverride: spec.scale
    });
    rig.root.position.set(sx, groundY, sz);
    this.battleScene.add(rig.root);

    const enemy: ActiveEnemy = {
      id: this.enemyIdCounter++,
      team: 'enemies',
      spec,
      rig,
      x: sx,
      z: sz,
      groundY,
      hullYaw: Math.atan2(this.playerX - sx, this.playerZ - sz),
      turretYaw: Math.atan2(this.playerX - sx, this.playerZ - sz),
      gunPitch: 0,
      hp: spec.hp,
      maxHp: spec.hp,
      reloadLeft: Math.random() * spec.reloadSec * 0.7,
      frontRecoil: 0,
      aiTimer: Math.random() * 1.5,
      targetPos: new THREE.Vector3(this.playerX, 0, this.playerZ),
      stuckTimer: 0,
      vx: 0,
      vz: 0,
      strafeDir: Math.random() < 0.5 ? 1 : -1,
      evasionTimer: 0,
      lastHitTime: 0,
      lastAttackerIsPlayer: false,
      reverseTimer: 0
    };

    rig.root.rotation.y = enemy.hullYaw;
    this.activeEnemies.push(enemy);
  }

  private initDuelMode(): void {
    if (!this.arena) return;

    const wins = this.storage.getData().duelWins;
    const opponentSpec = generateDuelOpponent(this.playerTierId, wins);

    const spawn = this.arena.duelEnemySpawn;
    const groundY = this.arena.getHeightAt(spawn.x, spawn.z);

    const rig = createTankRig(opponentSpec.tierId, {
      isEnemy: true,
      isBoss: false,
      scaleOverride: opponentSpec.scale
    });
    rig.root.position.set(spawn.x, groundY, spawn.z);
    rig.root.rotation.y = spawn.yaw;
    this.battleScene.add(rig.root);

    const opponent: ActiveEnemy = {
      id: this.enemyIdCounter++,
      team: 'enemies',
      spec: opponentSpec,
      rig,
      x: spawn.x,
      z: spawn.z,
      groundY,
      hullYaw: spawn.yaw,
      turretYaw: spawn.yaw,
      gunPitch: 0,
      hp: opponentSpec.hp,
      maxHp: opponentSpec.hp,
      reloadLeft: 1.0,
      frontRecoil: 0,
      aiTimer: 0,
      targetPos: new THREE.Vector3(this.playerX, 0, this.playerZ),
      stuckTimer: 0,
      vx: 0,
      vz: 0,
      strafeDir: 1,
      evasionTimer: 0,
      lastHitTime: 0,
      lastAttackerIsPlayer: true,
      reverseTimer: 0
    };

    this.duelOpponent = opponent;
    this.activeEnemies.push(opponent);

    this.callbacks.onWaveBanner?.(
      'БИТВА 1 НА 1',
      `Суперник: ${opponentSpec.name}`
    );
  }

  private initTeamBattleMode(): void {
    if (!this.arena || !this.playerRig) return;

    // 1. Ensure player spawns at southern base line, facing north (yaw = Math.PI)
    this.playerX = this.arena.playerSpawn.x;
    this.playerZ = this.arena.playerSpawn.z;
    this.playerHullYaw = this.arena.playerSpawn.yaw;
    this.playerTurretYaw = this.arena.playerSpawn.yaw;
    this.playerGroundY = this.arena.getHeightAt(this.playerX, this.playerZ);
    this.playerRig.root.position.set(this.playerX, this.playerGroundY, this.playerZ);
    this.playerRig.root.rotation.y = this.playerHullYaw;
    this.input.resetCameraAngles(this.arena.playerSpawn.yaw, -0.05);

    // 2. Setup central capture base at (0, 0), radius 13m
    this.captureProgress = 0;
    this.captureTeam = null;
    this.captureOwnerProgressTeam = null;
    this.baseAlarmTimer = 0;
    this.captureBaseVisual = createCaptureBaseMesh(13);
    const baseY = this.arena.getHeightAt(0, 0);
    this.captureBaseVisual.group.position.set(0, baseY, 0);
    this.battleScene.add(this.captureBaseVisual.group);

    // 3. Helper to pick balanced bot tier around player's tier
    const playerTierNum = TANK_SPECS[this.playerTierId].tierNumber;
    const minTier = Math.max(1, playerTierNum - 1);
    const maxTier = Math.min(5, playerTierNum + 1);

    const pickBotTierId = (): TankTierId => {
      const t = minTier + Math.floor(Math.random() * (maxTier - minTier + 1));
      return TANK_TIER_ORDER[t - 1];
    };

    const makeBotSpec = (tierId: TankTierId, isAlly: boolean): EnemyWaveUnitSpec => {
      const tankSpec = TANK_SPECS[tierId];
      return {
        tierId,
        isBoss: false,
        name: isAlly ? `${tankSpec.name}` : `${tankSpec.name}`,
        hp: tankSpec.baseHp,
        damage: tankSpec.primaryWeapon.damage,
        reloadSec: tankSpec.primaryWeapon.reloadSec,
        speed: tankSpec.baseSpeed,
        scale: 1.0,
        rewardCoins: 45 + tankSpec.tierNumber * 20,
        scorePoints: 250 + tankSpec.tierNumber * 120
      };
    };

    this.teamAlliesRoster = [{ id: 0, tier: playerTierNum, isPlayer: true }];
    this.teamEnemiesRoster = [];

    // 4. Spawn 4 allied bots on southern line
    const allyXs = [-36, -18, 18, 36];
    for (const ax of allyXs) {
      const tierId = pickBotTierId();
      const spec = makeBotSpec(tierId, true);
      const az = this.arena.playerSpawn.z + (Math.random() * 4 - 2);
      const groundY = this.arena.getHeightAt(ax, az);

      const rig = createTankRig(tierId, { isAlly: true });
      rig.root.position.set(ax, groundY, az);
      rig.root.rotation.y = Math.PI;
      this.battleScene.add(rig.root);

      const allyBot: ActiveEnemy = {
        id: this.enemyIdCounter++,
        team: 'allies',
        spec,
        rig,
        x: ax,
        z: az,
        groundY,
        hullYaw: Math.PI,
        turretYaw: Math.PI,
        gunPitch: 0,
        hp: spec.hp,
        maxHp: spec.hp,
        reloadLeft: 0.6 + Math.random() * 0.6,
        frontRecoil: 0,
        aiTimer: Math.random() * 1.2,
        targetPos: new THREE.Vector3(0, 0, 0),
        stuckTimer: 0,
        vx: 0,
        vz: 0,
        strafeDir: Math.random() < 0.5 ? 1 : -1,
        evasionTimer: 0,
        lastHitTime: 0,
        lastAttackerIsPlayer: false,
        reverseTimer: 0
      };

      this.activeEnemies.push(allyBot);
      this.teamAlliesRoster.push({
        id: allyBot.id,
        tier: TANK_SPECS[tierId].tierNumber
      });
    }

    // 5. Spawn 5 enemy bots on northern line
    const enemyXs = [-36, -18, 0, 18, 36];
    for (const ex of enemyXs) {
      const tierId = pickBotTierId();
      const spec = makeBotSpec(tierId, false);
      const ez = this.arena.duelEnemySpawn.z - (Math.random() * 4 - 2);
      const groundY = this.arena.getHeightAt(ex, ez);

      const rig = createTankRig(tierId, { isEnemy: true });
      rig.root.position.set(ex, groundY, ez);
      rig.root.rotation.y = 0;
      this.battleScene.add(rig.root);

      const enemyBot: ActiveEnemy = {
        id: this.enemyIdCounter++,
        team: 'enemies',
        spec,
        rig,
        x: ex,
        z: ez,
        groundY,
        hullYaw: 0,
        turretYaw: 0,
        gunPitch: 0,
        hp: spec.hp,
        maxHp: spec.hp,
        reloadLeft: 0.6 + Math.random() * 0.6,
        frontRecoil: 0,
        aiTimer: Math.random() * 1.2,
        targetPos: new THREE.Vector3(0, 0, 0),
        stuckTimer: 0,
        vx: 0,
        vz: 0,
        strafeDir: Math.random() < 0.5 ? 1 : -1,
        evasionTimer: 0,
        lastHitTime: 0,
        lastAttackerIsPlayer: false,
        reverseTimer: 0
      };

      this.activeEnemies.push(enemyBot);
      this.teamEnemiesRoster.push({
        id: enemyBot.id,
        tier: TANK_SPECS[tierId].tierNumber
      });
    }

    this.callbacks.onWaveBanner?.(
      'КОМАНДНИЙ БІЙ 5 НА 5',
      'Знищте ворогів або захопіть центральну базу!'
    );
  }

  // ==========================================================================
  // Main Animation Tick
  // ==========================================================================

  private tick(nowMs: number): void {
    const nowSec = nowMs / 1000;
    const dt = Math.min(0.1, Math.max(0.001, nowSec - this.lastTimeSec));
    this.lastTimeSec = nowSec;

    if (!this.inBattle) {
      this.updateHangar(dt, nowSec);
      this.renderer.render(this.hangarScene, this.camera);
    } else {
      if (!this.paused) {
        this.updateBattle(dt, nowSec);
      }
      this.renderer.render(this.battleScene, this.camera);
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  // ==========================================================================
  // Hangar Loop Update
  // ==========================================================================

  private updateHangar(dt: number, timeSec: number): void {
    // Turntable slow rotation
    this.hangarTurntableYaw += dt * 0.18;

    if (this.hangarRig) {
      this.hangarRig.root.rotation.y = this.hangarTurntableYaw;
      this.hangarRig.updateVisuals(timeSec, 0, 0);
    }

    // Camera positioning based on orbit angles
    const dist = this.hangarTierId === 'tier5' ? 11.4 : 9.6;
    const cx = Math.sin(this.hangarOrbitYaw) * Math.cos(this.hangarOrbitPitch) * dist;
    const cy = Math.sin(this.hangarOrbitPitch) * dist + 1.85;
    const cz = Math.cos(this.hangarOrbitYaw) * Math.cos(this.hangarOrbitPitch) * dist;

    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(0, 1.15, 0);

    if (this.camera.fov !== 52) {
      this.camera.fov = 52;
      this.camera.updateProjectionMatrix();
    }
  }

  // ==========================================================================
  // Battle Loop Update
  // ==========================================================================

  private updateBattle(dt: number, timeSec: number): void {
    if (!this.arena || !this.playerRig) return;

    // 1. Consume Player Input Snapshot
    const snap = this.input.consumeSnapshot();

    // Check pause request from input
    if (snap.pauseRequest) {
      this.setPaused(true);
      return;
    }

    // 2. Weapon Slot Switching (Digit1, Digit2, KeyQ)
    if (snap.weaponSlotRequest && this.playerStats.secondaryWeapon) {
      const targetSlot = snap.weaponSlotRequest;
      if (targetSlot !== this.activeWeaponSlot) {
        this.activeWeaponSlot = targetSlot;
        this.audio.playWeaponSwitch(targetSlot);
        this.input.setCurrentWeaponSlot(targetSlot);
      }
    }

    // 3. Repair Kit Request (Digit3, R, F)
    if (snap.repairRequest) {
      this.handleRepairKit();
    }

    // 4. Update Buff Timers
    if (this.damageBoostTimer > 0) this.damageBoostTimer -= dt;
    if (this.speedBoostTimer > 0) this.speedBoostTimer -= dt;
    if (this.shieldTimer > 0) {
      this.shieldTimer -= dt;
      this.playerRig.shieldMesh.visible = true;
    } else {
      this.playerRig.shieldMesh.visible = false;
    }

    // 5. Update Reload Timers
    if (this.primaryReloadLeft > 0) {
      const prev = this.primaryReloadLeft;
      this.primaryReloadLeft = Math.max(0, this.primaryReloadLeft - dt);
      if (prev > 0 && this.primaryReloadLeft === 0) {
        this.audio.playReloadReady();
      }
    }

    if (this.secondaryReloadLeft > 0) {
      const prevSecondary = this.secondaryReloadLeft;
      this.secondaryReloadLeft = Math.max(0, this.secondaryReloadLeft - dt);
      if (prevSecondary > 0 && this.secondaryReloadLeft === 0) {
        this.artyShotsLeft = this.artyShotsMax;
        this.artyAutoReloadTimer = 0;
        this.audio.playReloadReady();
      }
    } else if (this.artyShotsLeft < this.artyShotsMax) {
      // Якщо гравець вистрілив 1 снаряд і не зробив другий постріл протягом 10с — батарея перезаряджається
      this.artyAutoReloadTimer = Math.max(0, this.artyAutoReloadTimer - dt);
      if (this.artyAutoReloadTimer === 0) {
        this.artyShotsLeft = this.artyShotsMax;
        this.audio.playReloadReady();
      }
    }

    if (this.artyInterShotCooldown > 0) {
      this.artyInterShotCooldown = Math.max(0, this.artyInterShotCooldown - dt);
    }

    if (this.repairCooldownLeft > 0) {
      this.repairCooldownLeft = Math.max(0, this.repairCooldownLeft - dt);
    }

    // Recoil decay
    this.playerFrontRecoil = Math.max(0, this.playerFrontRecoil - dt * 3.5);
    this.playerRearRecoil = Math.max(0, this.playerRearRecoil - dt * 4.5);

    // 6. Update Player Hull Movement & Terrain Conformance
    this.updatePlayerMovement(snap, dt);

    // 7. Update WoT Camera & Sniper Mode
    this.updateWotCamera(snap, dt);

    // 8. Turret Aiming & WoT Convergence Offset
    this.updateTurretAiming(snap, dt);

    // 9. Player Firing Action
    if (snap.firing) {
      this.handlePlayerFiring();
    }

    // 10. Update Enemy AI, Navigation, and Enemy Firing
    this.updateEnemies(dt, timeSec);

    // 11. Update Projectiles & Collisions
    this.updateProjectiles(dt);

    // 12. Update Pickups & Barrels
    this.updatePickups(dt);

    // 13. Update Particles
    this.battleParticles.update(dt);

    // 14. Update Visual Rigs
    this.playerRig.updateVisuals(timeSec, this.playerFrontRecoil, this.playerRearRecoil);
    for (const enemy of this.activeEnemies) {
      enemy.frontRecoil = Math.max(0, enemy.frontRecoil - dt * 3.5);
      enemy.rig.updateVisuals(timeSec, enemy.frontRecoil, 0);
    }

    // 15. Check Wave Progress & Team Battle Base Capture
    if (this.currentMode === 'waves') {
      this.checkWaveProgress();
    } else if (this.currentMode === 'team_battle') {
      this.updateTeamBattleBase(dt);
    }

    // 16. Compile HUD & Enemy Plates Callbacks
    this.dispatchHudState(snap);
    this.dispatchEnemyPlates();
  }

  // ==========================================================================
  // Player Movement & Conformance
  // ==========================================================================

  private updatePlayerMovement(snap: WotInputSnapshot, dt: number): void {
    if (!this.arena || !this.playerRig) return;

    const stats = this.playerStats;
    const speedMult = this.speedBoostTimer > 0 ? 1.35 : 1.0;

    // Steering
    // snap.steer > 0 (KeyA) turns left (+yaw); steer < 0 (KeyD) turns right (-yaw)
    const reverseFactor = snap.throttle < -0.1 ? -1 : 1;
    this.playerHullYaw += snap.steer * stats.hullTurnSpeed * reverseFactor * dt;

    // Linear speed
    let targetSpeed = 0;
    if (snap.throttle > 0.05) {
      targetSpeed = snap.throttle * stats.speed * speedMult;
    } else if (snap.throttle < -0.05) {
      targetSpeed = snap.throttle * stats.reverseSpeed * speedMult;
    }

    // Move forward in XZ plane along hull orientation (where +Z is forward)
    const forwardX = Math.sin(this.playerHullYaw);
    const forwardZ = Math.cos(this.playerHullYaw);

    const nextX = this.playerX + forwardX * targetSpeed * dt;
    const nextZ = this.playerZ + forwardZ * targetSpeed * dt;

    // Obstacle collision check
    if (!this.checkObstacleCollision(nextX, nextZ, this.playerRig.halfWidth + 0.35)) {
      const playerClamp = WORLD_HALF_SIZE - 7;
      this.playerX = THREE.MathUtils.clamp(nextX, -playerClamp, playerClamp);
      this.playerZ = THREE.MathUtils.clamp(nextZ, -playerClamp, playerClamp);
    }

    // Terrain height & normal conformance
    this.playerGroundY = this.arena.getHeightAt(this.playerX, this.playerZ);
    this.playerRig.root.position.set(this.playerX, this.playerGroundY, this.playerZ);

    const normal = this.arena.getNormalAt(this.playerX, this.playerZ);
    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.playerHullYaw);
    const qSlope = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    this.playerRig.root.quaternion.copy(qSlope.multiply(qYaw));

    // Calculate speed in km/h for HUD
    this.playerSpeedKmh = Math.round(Math.abs(targetSpeed) * 3.6);

    // Track marks & audio tick
    if (Math.abs(targetSpeed) > 0.4) {
      this.playerTreadDist += Math.abs(targetSpeed) * dt;
      if (this.playerTreadDist > 0.65) {
        this.playerTreadDist = 0;
        this.battleParticles.spawnTrackMark(
          this.playerRig.root.position,
          this.playerHullYaw,
          this.playerRig.halfWidth * 0.72,
          normal
        );
        this.audio.playMoveTick();
      }
    }
  }

  // ==========================================================================
  // WoT Camera & Sniper Optics
  // ==========================================================================

  private updateWotCamera(snap: WotInputSnapshot, dt: number): void {
    if (!this.arena || !this.playerRig) return;

    // Calculate unit lookDir from camera yaw & pitch
    const cosP = Math.cos(snap.cameraPitch);
    this.cameraLookDir.set(
      Math.sin(snap.cameraYaw) * cosP,
      Math.sin(snap.cameraPitch),
      Math.cos(snap.cameraYaw) * cosP
    ).normalize();

    // Active Turret & Anchor selection
    const isSlot2 = this.activeWeaponSlot === 2;
    const activeTurretPivot = (isSlot2 && this.playerRig.rearTurretPivot) ? this.playerRig.rearTurretPivot : this.playerRig.frontTurretPivot;
    const activeSniperAnchor = (isSlot2 && this.playerRig.rearSniperAnchor) ? this.playerRig.rearSniperAnchor : this.playerRig.frontSniperAnchor;

    // Trigger sniper scope toggle sound on state change
    if (snap.isSniper !== this.wasSniper) {
      this.wasSniper = snap.isSniper;
      this.audio.playSniperToggle(snap.isSniper);
    }

    if (isSlot2 && snap.isSniper) {
      // 🛰️ Супутниковий режим артилерії: вид зверху на всю карту
      this.playerRig.frontTurretPivot.visible = true;
      if (this.playerRig.rearTurretPivot) {
        this.playerRig.rearTurretPivot.visible = true;
      }

      const aspect = window.innerWidth / Math.max(1, window.innerHeight);
      // Розраховуємо висоту орбітальної камери з урахуванням тактичного зуму артилерії
      const fullHeight = aspect < 1 ? Math.min(390, 265 / aspect) : 265;
      const zoomStep = snap.artyZoomStep || 1;
      const zoomT = THREE.MathUtils.clamp((zoomStep - 1) / 3, 0, 1);
      const satHeight = THREE.MathUtils.lerp(fullHeight, 52, zoomT);

      // При наближенні зміщуємо центр огляду камери до точки прицілювання
      const camX = this.artyAimPos.x * zoomT;
      const camZ = this.artyAimPos.y * zoomT;

      this.camera.position.set(camX, satHeight, camZ + 0.001);
      this.camera.up.set(0, 0, -1); // North (-Z) зверху екрана, South (+Z) знизу
      this.camera.lookAt(camX, 0, camZ);

      if (Math.abs(this.camera.fov - 70) > 0.1) {
        this.camera.fov = 70;
        this.camera.updateProjectionMatrix();
      }

      // Керування точкою прицілу artyAimPos:
      if (!snap.pointerLocked && snap.mouseNdc) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(snap.mouseNdc.x, snap.mouseNdc.y), this.camera);

        // Обчислюємо перетин променя з поверхнею з урахуванням висот рельєфу
        let currentH = 0;
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -currentH);
        const intersect = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(groundPlane, intersect)) {
          // Крок 1 уточнення по пагорбах
          currentH = this.arena.getHeightAt(intersect.x, intersect.z);
          groundPlane.constant = -currentH;
          if (raycaster.ray.intersectPlane(groundPlane, intersect)) {
            // Крок 2 уточнення на крутих схилах
            currentH = this.arena.getHeightAt(intersect.x, intersect.z);
            groundPlane.constant = -currentH;
            raycaster.ray.intersectPlane(groundPlane, intersect);
          }
          this.artyAimPos.set(intersect.x, intersect.z);
        }
      } else if (snap.pointerLocked || (snap.mouseDeltaX && snap.mouseDeltaX !== 0) || (snap.mouseDeltaY && snap.mouseDeltaY !== 0)) {
        const dx = snap.mouseDeltaX ?? 0;
        const dy = snap.mouseDeltaY ?? 0;
        if (dx !== 0 || dy !== 0) {
          const sens = 0.22 / Math.max(1, zoomStep);
          this.artyAimPos.x += dx * sens;
          this.artyAimPos.y += dy * sens;
        } else if (snap.pointerLocked) {
          let dYaw = snap.cameraYaw - this.lastInputYaw;
          let dPitch = snap.cameraPitch - this.lastInputPitch;
          while (dYaw < -Math.PI) dYaw += Math.PI * 2;
          while (dYaw > Math.PI) dYaw -= Math.PI * 2;
          this.artyAimPos.x += (dYaw * 50) / Math.max(1, zoomStep);
          this.artyAimPos.y -= (dPitch * 50) / Math.max(1, zoomStep);
        }
      }

      // Дозволяємо прицілювання по ВСІЙ відкритій карті від краю до краю (100% карти)!
      const aimLimit = WORLD_HALF_SIZE - 1;
      this.artyAimPos.x = Math.max(-aimLimit, Math.min(aimLimit, this.artyAimPos.x));
      this.artyAimPos.y = Math.max(-aimLimit, Math.min(aimLimit, this.artyAimPos.y));

      this.lastInputYaw = snap.cameraYaw;
      this.lastInputPitch = snap.cameraPitch;

      if (this.artyReticleMesh) {
        const groundY = this.arena.getHeightAt(this.artyAimPos.x, this.artyAimPos.y);
        this.artyReticleMesh.position.set(this.artyAimPos.x, groundY + 0.15, this.artyAimPos.y);
        this.artyReticleMesh.visible = true;
      }
    } else {
      this.camera.up.set(0, 1, 0); // Відновлюємо нормальний вектор вгору для звичайної 3D камери
      if (this.artyReticleMesh) {
        this.artyReticleMesh.visible = false;
      }
      this.lastInputYaw = snap.cameraYaw;
      this.lastInputPitch = snap.cameraPitch;

      if (snap.isSniper) {
        // Sniper Scope View: hide only the active turret, keep other turret visible
        const hasRear = this.playerRig.rearTurretPivot !== null;
        this.playerRig.frontTurretPivot.visible = isSlot2 && hasRear;
        if (this.playerRig.rearTurretPivot) {
          this.playerRig.rearTurretPivot.visible = !isSlot2;
        }

        const anchorPos = new THREE.Vector3();
        activeSniperAnchor.getWorldPosition(anchorPos);

        // Camera stands right at sniper anchor optic
        this.camera.position.copy(anchorPos);
        this.camera.lookAt(anchorPos.clone().add(this.cameraLookDir.clone().multiplyScalar(40)));

        // Optical Zoom FOV
        const targetFov = snap.sniperZoom === 4 ? 15 : 28;
        if (Math.abs(this.camera.fov - targetFov) > 0.1) {
          this.camera.fov = targetFov;
          this.camera.updateProjectionMatrix();
        }
      } else {
        // 3rd Person World of Tanks Cinematic View
        this.playerRig.frontTurretPivot.visible = true;
        if (this.playerRig.rearTurretPivot) {
          this.playerRig.rearTurretPivot.visible = true;
        }

        if (this.camera.fov !== 58) {
          this.camera.fov = 58;
          this.camera.updateProjectionMatrix();
        }

        const pivotWorldPos = new THREE.Vector3();
        activeTurretPivot.getWorldPosition(pivotWorldPos);

        const anchorPos = pivotWorldPos.clone().add(
          new THREE.Vector3(0, (isSlot2 && this.playerRig.rearTurretPivot) ? 1.15 : 1.55, 0)
        );

        // Desired distance behind tank
        let camDist = 8.0;
        if (this.playerTierId === 'tier5') {
          camDist = (isSlot2 && this.playerRig.rearTurretPivot) ? 6.8 : 9.5;
        }

        const desiredCamPos = anchorPos.clone()
          .sub(this.cameraLookDir.clone().multiplyScalar(camDist))
          .add(new THREE.Vector3(0, 0.88, 0));

        // Terrain collision clamp (never clip below ground)
        const minCamY = this.arena.getHeightAt(desiredCamPos.x, desiredCamPos.z) + 0.85;
        if (desiredCamPos.y < minCamY) {
          desiredCamPos.y = minCamY;
        }

        // Smooth camera interpolation
        this.camera.position.lerp(desiredCamPos, Math.min(1, 14 * dt));

        // Apply screen shake
        if (this.screenShakeIntensity > 0) {
          this.camera.position.x += (Math.random() - 0.5) * this.screenShakeIntensity;
          this.camera.position.y += (Math.random() - 0.5) * this.screenShakeIntensity;
          this.screenShakeIntensity = Math.max(0, this.screenShakeIntensity - dt * 2.5);
        }

        // Look along lookDir
        this.camera.lookAt(this.camera.position.clone().add(this.cameraLookDir.clone().multiplyScalar(40)));
      }
    }
  }

  // ==========================================================================
  // Turret Aiming & Dynamic Reticle Convergence
  // ==========================================================================

  private updateTurretAiming(snap: WotInputSnapshot, dt: number): void {
    if (!this.arena || !this.playerRig) return;

    const isSlot2 = this.activeWeaponSlot === 2;
    const isArtillery = isSlot2 && snap.isSniper;

    // Raycast from camera along lookDir to find 3D aim target
    const rayOrigin = this.camera.position.clone();
    const rayDir = this.cameraLookDir.clone();

    // Check intersection with terrain and enemies
    let closestDist = 160;
    let hitPoint = rayOrigin.clone().addScaledVector(rayDir, closestDist);
    let lockedEnemy: ActiveEnemy | null = null;

    if (isArtillery) {
      // 🛰️ Супутниковий режим артилерії: ціль точно в точці прицілу artyAimPos на землі
      const targetY = this.arena.getHeightAt(this.artyAimPos.x, this.artyAimPos.y);
      hitPoint = new THREE.Vector3(this.artyAimPos.x, targetY, this.artyAimPos.y);

      let bestDist = 6.5;
      for (const enemy of this.activeEnemies) {
        if (enemy.hp <= 0 || enemy.team !== 'enemies') continue;
        const d = Math.hypot(enemy.x - this.artyAimPos.x, enemy.z - this.artyAimPos.y);
        if (d < bestDist) {
          bestDist = d;
          lockedEnemy = enemy;
        }
      }
      closestDist = Math.hypot(this.playerX - this.artyAimPos.x, this.playerZ - this.artyAimPos.y);
    } else {
      // 1. Check against enemies
      for (const enemy of this.activeEnemies) {
        if (enemy.hp <= 0 || enemy.team !== 'enemies') continue;
        const enemyCenter = new THREE.Vector3(enemy.x, enemy.groundY + 1.2, enemy.z);
        const toCenter = enemyCenter.clone().sub(rayOrigin);
        const proj = toCenter.dot(rayDir);
        if (proj > 2 && proj < closestDist) {
          const perpDist = toCenter.clone().sub(rayDir.clone().multiplyScalar(proj)).length();
          if (perpDist < enemy.rig.halfWidth * 1.35) {
            closestDist = proj;
            hitPoint = rayOrigin.clone().addScaledVector(rayDir, proj);
            lockedEnemy = enemy;
          }
        }
      }

      // 2. Raymarch terrain if no enemy hit closer
      if (!lockedEnemy) {
        for (let d = 8; d < closestDist; d += 2.5) {
          const testP = rayOrigin.clone().addScaledVector(rayDir, d);
          const terrY = this.arena.getHeightAt(testP.x, testP.z);
          if (testP.y <= terrY) {
            closestDist = d;
            hitPoint = testP;
            break;
          }
        }
      }
    }

    this.aimDistanceMeters = Math.max(6, Math.round(closestDist));

    if (lockedEnemy) {
      this.targetEnemyName = lockedEnemy.spec.name;
      this.targetEnemyHp = lockedEnemy.hp;
      this.targetEnemyMaxHp = lockedEnemy.maxHp;
    } else {
      this.targetEnemyName = null;
      this.targetEnemyHp = 0;
      this.targetEnemyMaxHp = 0;
    }

    // Active Turret & Gun selection
    const activeTurretPivot = (isSlot2 && this.playerRig.rearTurretPivot) ? this.playerRig.rearTurretPivot : this.playerRig.frontTurretPivot;
    const activeGunPivot = (isSlot2 && this.playerRig.rearGunPivot) ? this.playerRig.rearGunPivot : this.playerRig.frontGunPivot;
    const activeMuzzle = (isSlot2 && this.playerRig.rearMuzzle) ? this.playerRig.rearMuzzle : this.playerRig.frontMuzzle;

    // Rotate Turret towards hitPoint in Hull local space
    const hullGroup = this.playerRig.hullGroup;
    const localHit = hullGroup.worldToLocal(hitPoint.clone());
    const localPivot = activeTurretPivot.position;

    const desiredLocalYaw = Math.atan2(localHit.x - localPivot.x, localHit.z - localPivot.z);

    let yawDiff = desiredLocalYaw - activeTurretPivot.rotation.y;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

    const turnSpeed = this.playerStats.turretTurnSpeed;
    const yawStep = Math.sign(yawDiff) * Math.min(Math.abs(yawDiff), turnSpeed * dt);
    activeTurretPivot.rotation.y += yawStep;
    this.playerTurretYaw = this.playerHullYaw + activeTurretPivot.rotation.y;

    // Vertical Gun Pitch
    const distXZ = Math.hypot(localHit.x - localPivot.x, localHit.z - localPivot.z);
    const dy = localHit.y - (localPivot.y + activeGunPivot.position.y);
    const desiredPitch = -Math.atan2(dy, Math.max(0.1, distXZ));

    // Clamp elevation [-0.42 (up) .. +0.18 (down)]
    const clampedPitch = Math.max(-0.42, Math.min(0.18, desiredPitch));
    let pitchDiff = clampedPitch - activeGunPivot.rotation.x;
    const pitchStep = Math.sign(pitchDiff) * Math.min(Math.abs(pitchDiff), 2.8 * dt);
    activeGunPivot.rotation.x += pitchStep;
    this.playerGunPitch = activeGunPivot.rotation.x;

    // Dynamic Reticle Convergence: project actual barrel aim point onto screen
    if (isArtillery) {
      const proj = hitPoint.clone().project(this.camera);
      const dxPx = (proj.x * window.innerWidth) / 2;
      const dyPx = (-proj.y * window.innerHeight) / 2;
      this.callbacks.onTurretAimUpdate?.({
        dxPx: Math.round(dxPx),
        dyPx: Math.round(dyPx),
        converged: true
      });
    } else {
      const muzzlePos = new THREE.Vector3();
      activeMuzzle.getWorldPosition(muzzlePos);

      const barrelDir = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(activeGunPivot.getWorldQuaternion(new THREE.Quaternion()))
        .normalize();

      const barrelAimPoint = muzzlePos.clone().addScaledVector(barrelDir, this.aimDistanceMeters);
      const proj = barrelAimPoint.clone().project(this.camera);

      const dxPx = (proj.x * window.innerWidth) / 2;
      const dyPx = (-proj.y * window.innerHeight) / 2;
      const distPx = Math.hypot(dxPx, dyPx);

      this.callbacks.onTurretAimUpdate?.({
        dxPx: Math.round(dxPx),
        dyPx: Math.round(dyPx),
        converged: distPx < 16
      });
    }
  }

  // ==========================================================================
  // Player Firing
  // ==========================================================================

  private handlePlayerFiring(): void {
    if (!this.playerRig || !this.arena) return;

    const isSlot2 = this.activeWeaponSlot === 2;
    const weapon = (isSlot2 && this.playerStats.secondaryWeapon) ? this.playerStats.secondaryWeapon : this.playerStats.primaryWeapon;

    if (isSlot2) {
      if (this.secondaryReloadLeft > 0 || this.artyInterShotCooldown > 0 || this.artyShotsLeft <= 0) return;

      this.artyShotsLeft--;
      if (this.artyShotsLeft <= 0) {
        this.artyShotsLeft = 0;
        this.secondaryReloadLeft = 10.0; // Рівно 10.0 секунд перезарядки барабану на 2 снаряди
        this.artyInterShotCooldown = 0;
        this.artyAutoReloadTimer = 0;
      } else {
        this.artyInterShotCooldown = 0.5; // Пауза 0.5с між 1 і 2 пострілом
        this.secondaryReloadLeft = 0; // Не блокуємо другий постріл!
        this.artyAutoReloadTimer = 10.0; // Якщо 2-й постріл не зроблено, батарея перезарядиться через 10с
      }
      this.playerRearRecoil = 1.0;
      this.screenShakeIntensity = 0.55;
    } else {
      if (this.primaryReloadLeft > 0) return;
      this.primaryReloadLeft = weapon.reloadSec;
      this.playerFrontRecoil = 1.0;
    }

    const activeMuzzle = (isSlot2 && this.playerRig.rearMuzzle) ? this.playerRig.rearMuzzle : this.playerRig.frontMuzzle;
    const activeGunPivot = (isSlot2 && this.playerRig.rearGunPivot) ? this.playerRig.rearGunPivot : this.playerRig.frontGunPivot;

    const muzzlePos = new THREE.Vector3();
    activeMuzzle.getWorldPosition(muzzlePos);

    const barrelDir = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(activeGunPivot.getWorldQuaternion(new THREE.Quaternion()))
      .normalize();

    // Damage multiplier from Damage Boost pickup
    const damageMult = this.damageBoostTimer > 0 ? 1.5 : 1.0;
    const damage = Math.round(weapon.damage * damageMult);

    if (isSlot2) {
      // 🛰️ Артилерійська стрільба з балістичною дугою у вказану точку карти
      let target3D: THREE.Vector3;
      if (this.wasSniper) {
        target3D = new THREE.Vector3(
          this.artyAimPos.x,
          this.arena.getHeightAt(this.artyAimPos.x, this.artyAimPos.y),
          this.artyAimPos.y
        );
      } else {
        // Розраховуємо точку падіння не за нахилом ствола (який обмежений),
        // а за напрямком погляду камери cameraLookDir на поверхню землі/рельєфу на будь-яку дистанцію аж до краю карти!
        const camPos = this.camera.position;
        const camDir = this.cameraLookDir.clone().normalize();
        const aimLimit = WORLD_HALF_SIZE - 1;

        let targetX = this.playerX + camDir.x * 60;
        let targetZ = this.playerZ + camDir.z * 60;

        if (camDir.y < -0.01) {
          // Промінь камери дивиться в землю/вниз
          const t = -camPos.y / camDir.y;
          if (t > 0) {
            targetX = camPos.x + camDir.x * t;
            targetZ = camPos.z + camDir.z * t;
          }
        } else {
          // Погляд у горизонт або вгору — беремо далеку дистанцію погляду
          const dist = 140;
          targetX = this.playerX + camDir.x * dist;
          targetZ = this.playerZ + camDir.z * dist;
        }

        // Якщо зафіксовано ворога під прицілом і дистанція валідна:
        if (this.targetEnemyName && this.aimDistanceMeters > 0 && this.aimDistanceMeters < 180) {
          targetX = muzzlePos.x + camDir.x * this.aimDistanceMeters;
          targetZ = muzzlePos.z + camDir.z * this.aimDistanceMeters;
        }

        targetX = Math.max(-aimLimit, Math.min(aimLimit, targetX));
        targetZ = Math.max(-aimLimit, Math.min(aimLimit, targetZ));
        target3D = new THREE.Vector3(targetX, this.arena.getHeightAt(targetX, targetZ), targetZ);
      }

      if (weapon.dispersionDeg > 0) {
        const spread = (Math.random() - 0.5) * 1.5;
        target3D.x += spread;
        target3D.z += (Math.random() - 0.5) * 1.5;
      }

      const dx = target3D.x - muzzlePos.x;
      const dy = target3D.y - muzzlePos.y;
      const dz = target3D.z - muzzlePos.z;
      const horizDist = Math.hypot(dx, dz);
      const flightTime = Math.min(2.1, Math.max(0.85, horizDist * 0.009 + 0.65));
      const g = 45.0;
      const vel = new THREE.Vector3(
        dx / flightTime,
        (dy + 0.5 * g * flightTime * flightTime) / flightTime,
        dz / flightTime
      );

      // Спалах та звук артилерії
      this.battleParticles.spawnMuzzleFlash(muzzlePos, vel.clone().normalize(), 'mini_artillery');
      this.audio.playShoot('mini_artillery');

      const mesh = createProjectileMesh('mini_artillery', false);
      mesh.position.copy(muzzlePos);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), vel.clone().normalize());
      this.battleScene.add(mesh);

      this.projectiles.push({
        mesh,
        pos: muzzlePos.clone(),
        vel,
        team: 'allies',
        fromPlayer: true,
        damage,
        style: 'mini_artillery',
        aoeRadius: weapon.aoeRadius,
        chainCount: weapon.chainCount ?? 0,
        chainRange: weapon.chainRange ?? 0,
        gravity: g,
        life: 0,
        maxLife: 3.5
      });
      return;
    }

    // Для звичайної прямої наводки (слот 1)
    if (weapon.dispersionDeg > 0) {
      const dispRad = THREE.MathUtils.degToRad(weapon.dispersionDeg);
      barrelDir.x += (Math.random() - 0.5) * dispRad;
      barrelDir.y += (Math.random() - 0.5) * dispRad;
      barrelDir.normalize();
    }

    // Muzzle flash VFX & Sound
    this.battleParticles.spawnMuzzleFlash(muzzlePos, barrelDir, weapon.projectileStyle);
    this.audio.playShoot(weapon.projectileStyle);

    // Create Projectile Entity
    const mesh = createProjectileMesh(weapon.projectileStyle, false);
    mesh.position.copy(muzzlePos);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), barrelDir);
    this.battleScene.add(mesh);

    const vel = barrelDir.clone().multiplyScalar(weapon.projectileSpeed);
    const gravity = weapon.projectileStyle === 'mini_artillery' ? 9.8 : 0;

    this.projectiles.push({
      mesh,
      pos: muzzlePos.clone(),
      vel,
      team: 'allies',
      fromPlayer: true,
      damage,
      style: weapon.projectileStyle,
      aoeRadius: weapon.aoeRadius,
      chainCount: weapon.chainCount ?? 0,
      chainRange: weapon.chainRange ?? 0,
      gravity,
      life: 0,
      maxLife: 3.5
    });
  }

  // ==========================================================================
  // Smart Tactical Enemy & Bot AI
  // ==========================================================================

  private hasLineOfSight(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number): boolean {
    if (!this.arena) return true;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const dist = Math.hypot(dx, dz);
    if (dist < 2.5) return true;

    const steps = Math.min(24, Math.max(6, Math.floor(dist / 2.8)));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = x1 + dx * t;
      const pz = z1 + dz * t;
      const py = y1 + (y2 - y1) * t;

      const groundY = this.arena.getHeightAt(px, pz);
      if (py < groundY - 0.25) {
        return false;
      }

      for (const obs of this.arena.obstacles) {
        if (Math.hypot(px - obs.x, pz - obs.z) < obs.radius * 0.95) {
          return false;
        }
      }
    }
    return true;
  }

  private findBotTarget(bot: ActiveEnemy): {
    x: number;
    z: number;
    groundY: number;
    dist: number;
    vx: number;
    vz: number;
    hp: number;
    maxHp: number;
    hasLos: boolean;
  } | null {
    interface Candidate {
      x: number;
      z: number;
      groundY: number;
      dist: number;
      vx: number;
      vz: number;
      hp: number;
      maxHp: number;
      hasLos: boolean;
      score: number;
    }

    const candidates: Candidate[] = [];
    const botEyeY = bot.groundY + bot.rig.height * 0.8;

    // 1. Check Player if bot is enemy
    if (bot.team === 'enemies' && this.playerHp > 0) {
      const dist = Math.hypot(this.playerX - bot.x, this.playerZ - bot.z);
      const playerSpeed = this.playerSpeedKmh / 3.6;
      const pVx = Math.sin(this.playerHullYaw) * playerSpeed;
      const pVz = Math.cos(this.playerHullYaw) * playerSpeed;
      const hasLos = this.hasLineOfSight(bot.x, botEyeY, bot.z, this.playerX, this.playerGroundY + 1.2, this.playerZ);

      let score = dist;
      if (!hasLos) score += 55;
      if (this.playerHp < this.playerMaxHp * 0.35) score -= 35; // Finish off low HP player
      if (bot.lastAttackerIsPlayer && performance.now() / 1000 - bot.lastHitTime < 4) score -= 25; // Retaliation
      if (Math.hypot(this.playerX, this.playerZ) <= 12) score -= 45; // Defend base

      candidates.push({
        x: this.playerX,
        z: this.playerZ,
        groundY: this.playerGroundY,
        dist,
        vx: pVx,
        vz: pVz,
        hp: this.playerHp,
        maxHp: this.playerMaxHp,
        hasLos,
        score
      });
    }

    // 2. Check opposing bots
    for (const other of this.activeEnemies) {
      if (other.hp <= 0 || other.team === bot.team) continue;
      const dist = Math.hypot(other.x - bot.x, other.z - bot.z);
      const otherEyeY = other.groundY + other.rig.height * 0.8;
      const hasLos = this.hasLineOfSight(bot.x, botEyeY, bot.z, other.x, otherEyeY, other.z);

      let score = dist;
      if (!hasLos) score += 55;
      if (other.hp < other.maxHp * 0.35) score -= 35; // Finish off weakened bot
      if (Math.hypot(other.x, other.z) <= 12) score -= 45; // Defend base

      candidates.push({
        x: other.x,
        z: other.z,
        groundY: other.groundY,
        dist,
        vx: other.vx,
        vz: other.vz,
        hp: other.hp,
        maxHp: other.maxHp,
        hasLos,
        score
      });
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.score - b.score);
    return candidates[0];
  }

  private updateEnemies(dt: number, timeSec: number): void {
    if (!this.arena) return;

    for (const enemy of this.activeEnemies) {
      if (enemy.hp <= 0) continue;

      const prevX = enemy.x;
      const prevZ = enemy.z;

      // Update reload & evasion
      if (enemy.reloadLeft > 0) {
        enemy.reloadLeft -= dt;
      }
      if (enemy.evasionTimer > 0) {
        enemy.evasionTimer -= dt;
      }

      const target = this.findBotTarget(enemy);
      const isLowHp = enemy.hp < enemy.maxHp * 0.28;
      const isBossOrHeavy = enemy.spec.isBoss || enemy.spec.tierId === 'tier4' || enemy.spec.tierId === 'tier5';
      const isLightScout = enemy.spec.tierId === 'tier1' || enemy.spec.tierId === 'tier2';

      // Periodic AI Decision timer (0.8-1.5s)
      enemy.aiTimer -= dt;
      if (enemy.aiTimer <= 0) {
        enemy.aiTimer = 0.8 + Math.random() * 0.7;

        // Base Defense Priority in Team Battle
        const opposingSide = enemy.team === 'allies' ? 'enemies' : 'allies';
        const baseThreatened = this.currentMode === 'team_battle' &&
          this.captureProgress > 10 &&
          this.captureOwnerProgressTeam === opposingSide;

        if (baseThreatened && (!target || Math.hypot(target.x, target.z) > 16)) {
          // Rush central base (0, 0) to decap!
          enemy.targetPos.set(
            (Math.random() - 0.5) * 10,
            0,
            (Math.random() - 0.5) * 10
          );
        } else if (this.currentMode === 'team_battle' && (!target || target.dist > 55)) {
          // Patrol toward central capture base when no combatant nearby
          enemy.targetPos.set(
            (Math.random() - 0.5) * 14,
            0,
            (Math.random() - 0.5) * 14
          );
        } else if (target) {
          const distToTarget = target.dist;

          if (isLowHp) {
            // Tactical retreat: back away to cover / allies while keeping distance
            const awayDir = new THREE.Vector2(enemy.x - target.x, enemy.z - target.z).normalize();
            enemy.targetPos.set(
              enemy.x + awayDir.x * 22 + (Math.random() - 0.5) * 10,
              0,
              enemy.z + awayDir.y * 22 + (Math.random() - 0.5) * 10
            );
          } else if (isLightScout) {
            // Fast circling / flanking around target
            const angle = Math.atan2(enemy.x - target.x, enemy.z - target.z) + 0.65 * enemy.strafeDir;
            const orbitDist = 20 + Math.random() * 6;
            enemy.targetPos.set(
              target.x + Math.sin(angle) * orbitDist,
              0,
              target.z + Math.cos(angle) * orbitDist
            );
          } else if (isBossOrHeavy) {
            // Heavy assault: push within 22-26m, maintaining front armor presence
            if (distToTarget > 28) {
              enemy.targetPos.set(
                target.x + (Math.random() - 0.5) * 8,
                0,
                target.z + (Math.random() - 0.5) * 8
              );
            } else if (distToTarget < 16) {
              const awayDir = new THREE.Vector2(enemy.x - target.x, enemy.z - target.z).normalize();
              enemy.targetPos.set(
                enemy.x + awayDir.x * 12,
                0,
                enemy.z + awayDir.y * 12
              );
            } else {
              // Tactical "ромбування" hull angling
              const angle = Math.atan2(enemy.x - target.x, enemy.z - target.z) + 0.4 * enemy.strafeDir;
              enemy.targetPos.set(
                target.x + Math.sin(angle) * 22,
                0,
                target.z + Math.cos(angle) * 22
              );
            }
          } else {
            // Standard / Medium / Sniper: maintain 28-38m line of sight
            if (distToTarget > 36) {
              enemy.targetPos.set(
                target.x + (Math.random() - 0.5) * 12,
                0,
                target.z + (Math.random() - 0.5) * 12
              );
            } else if (distToTarget < 18) {
              const awayDir = new THREE.Vector2(enemy.x - target.x, enemy.z - target.z).normalize();
              enemy.targetPos.set(
                enemy.x + awayDir.x * 14 + (Math.random() - 0.5) * 6,
                0,
                enemy.z + awayDir.y * 14 + (Math.random() - 0.5) * 6
              );
            } else {
              const angle = Math.atan2(enemy.x - target.x, enemy.z - target.z) + 0.45 * enemy.strafeDir;
              enemy.targetPos.set(
                target.x + Math.sin(angle) * 28,
                0,
                target.z + Math.cos(angle) * 28
              );
            }
          }

          // Evasive zigzagging if under fire
          if (enemy.evasionTimer > 0) {
            const sideVector = new THREE.Vector2(
              -(enemy.targetPos.z - enemy.z),
              enemy.targetPos.x - enemy.x
            ).normalize();
            enemy.targetPos.x += sideVector.x * 8 * enemy.strafeDir;
            enemy.targetPos.z += sideVector.y * 8 * enemy.strafeDir;
          }
        }
      }

      // Handle Unstuck Reversing
      if (enemy.reverseTimer > 0) {
        enemy.reverseTimer -= dt;
        const fwdX = Math.sin(enemy.hullYaw);
        const fwdZ = Math.cos(enemy.hullYaw);
        const spd = enemy.spec.speed * 0.75;
        const nx = enemy.x - fwdX * spd * dt;
        const nz = enemy.z - fwdZ * spd * dt;
        const tankRadius = enemy.rig.halfWidth + 0.35;

        enemy.hullYaw += enemy.strafeDir * 2.2 * dt;
        if (!this.checkObstacleCollision(nx, nz, tankRadius) && !this.checkTankCollision(nx, nz, tankRadius, enemy.id)) {
          const enemyClamp = WORLD_HALF_SIZE - 9;
          enemy.x = THREE.MathUtils.clamp(nx, -enemyClamp, enemyClamp);
          enemy.z = THREE.MathUtils.clamp(nz, -enemyClamp, enemyClamp);
        }
      } else {
        // Navigate towards targetPos
        const dx = enemy.targetPos.x - enemy.x;
        const dz = enemy.targetPos.z - enemy.z;
        const desiredYaw = Math.atan2(dx, dz);

        let yawDiff = desiredYaw - enemy.hullYaw;
        while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

        const turnStep = Math.sign(yawDiff) * Math.min(Math.abs(yawDiff), 2.5 * dt);
        enemy.hullYaw += turnStep;

        // Move forward if roughly facing target
        if (Math.abs(yawDiff) < 0.95) {
          const fwdX = Math.sin(enemy.hullYaw);
          const fwdZ = Math.cos(enemy.hullYaw);
          const spd = enemy.spec.speed * (enemy.evasionTimer > 0 ? 1.05 : 0.92);
          const nx = enemy.x + fwdX * spd * dt;
          const nz = enemy.z + fwdZ * spd * dt;
          const tankRadius = enemy.rig.halfWidth + 0.35;

          if (!this.checkObstacleCollision(nx, nz, tankRadius) && !this.checkTankCollision(nx, nz, tankRadius, enemy.id)) {
            const enemyClamp = WORLD_HALF_SIZE - 9;
            enemy.x = THREE.MathUtils.clamp(nx, -enemyClamp, enemyClamp);
            enemy.z = THREE.MathUtils.clamp(nz, -enemyClamp, enemyClamp);
            enemy.stuckTimer = Math.max(0, enemy.stuckTimer - dt * 2);
          } else {
            // Collision detected - increment stuck counter
            enemy.stuckTimer += dt;
            if (enemy.stuckTimer > 0.4) {
              // Initiate smart unstuck maneuver
              enemy.reverseTimer = 0.75 + Math.random() * 0.4;
              enemy.stuckTimer = 0;
              enemy.strafeDir = -enemy.strafeDir;
              enemy.aiTimer = 0.1;
            } else {
              enemy.hullYaw += enemy.strafeDir * 2.0 * dt;
            }
          }
        }
      }

      // Record actual velocity for target lead calculation
      enemy.vx = (enemy.x - prevX) / Math.max(0.001, dt);
      enemy.vz = (enemy.z - prevZ) / Math.max(0.001, dt);

      // Conformance to terrain
      enemy.groundY = this.arena.getHeightAt(enemy.x, enemy.z);
      enemy.rig.root.position.set(enemy.x, enemy.groundY, enemy.z);

      const norm = this.arena.getNormalAt(enemy.x, enemy.z);
      const qY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), enemy.hullYaw);
      const qSlp = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), norm);
      enemy.rig.root.quaternion.copy(qSlp.multiply(qY));

      // Aim Turret & Gun with Lead Prediction
      if (target) {
        const spec = TANK_SPECS[enemy.spec.tierId];
        const projSpeed = spec.primaryWeapon.projectileSpeed;
        const flightTime = Math.min(1.35, target.dist / Math.max(10, projSpeed));

        // Predictive ballistic lead point
        const leadX = target.x + target.vx * flightTime;
        const leadZ = target.z + target.vz * flightTime;
        const leadY = this.arena.getHeightAt(leadX, leadZ) + 1.05;

        const muzzlePos = new THREE.Vector3();
        enemy.rig.frontMuzzle.getWorldPosition(muzzlePos);
        const leadLos = this.hasLineOfSight(muzzlePos.x, muzzlePos.y, muzzlePos.z, leadX, leadY, leadZ);

        const aimTarget = leadLos
          ? new THREE.Vector3(leadX, leadY, leadZ)
          : new THREE.Vector3(target.x, target.groundY + 1.05, target.z);

        const localTarget = enemy.rig.hullGroup.worldToLocal(aimTarget);
        const localPivot = enemy.rig.frontTurretPivot.position;

        const desiredLocalYaw = Math.atan2(localTarget.x - localPivot.x, localTarget.z - localPivot.z);
        let tDiff = desiredLocalYaw - enemy.rig.frontTurretPivot.rotation.y;
        while (tDiff < -Math.PI) tDiff += Math.PI * 2;
        while (tDiff > Math.PI) tDiff -= Math.PI * 2;

        // Snappy turret tracking
        enemy.rig.frontTurretPivot.rotation.y += Math.sign(tDiff) * Math.min(Math.abs(tDiff), 3.2 * dt);
        enemy.turretYaw = enemy.hullYaw + enemy.rig.frontTurretPivot.rotation.y;

        const distXZ = Math.hypot(localTarget.x - localPivot.x, localTarget.z - localPivot.z);
        const dy = localTarget.y - (localPivot.y + enemy.rig.frontGunPivot.position.y);
        const desiredPitch = -Math.atan2(dy, Math.max(0.5, distXZ));
        const clampedPitch = THREE.MathUtils.clamp(desiredPitch, -0.42, 0.22);
        const pDiff = clampedPitch - enemy.rig.frontGunPivot.rotation.x;
        enemy.rig.frontGunPivot.rotation.x += Math.sign(pDiff) * Math.min(Math.abs(pDiff), 3.0 * dt);
        enemy.gunPitch = enemy.rig.frontGunPivot.rotation.x;

        // Smart Firing check: aimed + range + reloaded + clear line of sight
        const isAimed = Math.abs(tDiff) < 0.22 && Math.abs(pDiff) < 0.22;
        const canHit = target.hasLos || leadLos;

        if (isAimed && target.dist < 78 && enemy.reloadLeft <= 0 && canHit) {
          this.handleEnemyFiring(enemy, leadLos ? leadX : undefined, leadLos ? leadY : undefined, leadLos ? leadZ : undefined);
        }
      } else {
        // Smoothly center turret forward if no target
        const tDiff = -enemy.rig.frontTurretPivot.rotation.y;
        enemy.rig.frontTurretPivot.rotation.y += Math.sign(tDiff) * Math.min(Math.abs(tDiff), 2.2 * dt);
        enemy.turretYaw = enemy.hullYaw + enemy.rig.frontTurretPivot.rotation.y;
      }
    }
  }

  private handleEnemyFiring(enemy: ActiveEnemy, leadX?: number, leadY?: number, leadZ?: number): void {
    enemy.reloadLeft = enemy.spec.reloadSec * (0.88 + Math.random() * 0.24);
    enemy.frontRecoil = 1.0;

    const muzzle = enemy.rig.frontMuzzle;
    const muzzlePos = new THREE.Vector3();
    muzzle.getWorldPosition(muzzlePos);

    let barrelDir: THREE.Vector3;
    if (leadX !== undefined && leadY !== undefined && leadZ !== undefined) {
      barrelDir = new THREE.Vector3(leadX - muzzlePos.x, leadY - muzzlePos.y, leadZ - muzzlePos.z).normalize();
    } else {
      barrelDir = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(enemy.rig.frontGunPivot.getWorldQuaternion(new THREE.Quaternion()))
        .normalize();
    }

    // Precise yet natural dispersion
    const disp = 0.022;
    barrelDir.x += (Math.random() - 0.5) * disp;
    barrelDir.y += (Math.random() - 0.5) * (disp * 0.7);
    barrelDir.normalize();

    const spec = TANK_SPECS[enemy.spec.tierId];
    const style = spec.primaryWeapon.projectileStyle;

    this.battleParticles.spawnMuzzleFlash(muzzlePos, barrelDir, style);
    this.audio.playShoot(style);

    const mesh = createProjectileMesh(style, enemy.team === 'enemies');
    mesh.position.copy(muzzlePos);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), barrelDir);
    this.battleScene.add(mesh);

    const vel = barrelDir.clone().multiplyScalar(spec.primaryWeapon.projectileSpeed * 0.95);

    this.projectiles.push({
      mesh,
      pos: muzzlePos.clone(),
      vel,
      team: enemy.team,
      fromPlayer: false,
      ownerEnemyId: enemy.id,
      damage: enemy.spec.damage,
      style,
      aoeRadius: spec.primaryWeapon.aoeRadius,
      chainCount: 0,
      chainRange: 0,
      gravity: 0,
      life: 0,
      maxLife: 3.5
    });
  }

  // ==========================================================================
  // Projectile Update & Hit Resolution
  // ==========================================================================

  private updateProjectiles(dt: number): void {
    if (!this.arena) return;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        this.battleScene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      // Ballistic gravity
      if (p.gravity > 0) {
        p.vel.y -= p.gravity * dt;
      }

      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), p.vel.clone().normalize());

      let collided = false;

      // 1. Terrain collision check
      const groundY = this.arena.getHeightAt(p.pos.x, p.pos.z);
      if (p.pos.y <= groundY) {
        p.pos.y = groundY;
        this.resolveProjectileImpact(p, p.pos, null);
        this.battleScene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      // 2. Obstacle collision
      for (const obs of this.arena.obstacles) {
        const obsGroundY = this.arena.getHeightAt(obs.x, obs.z);
        if (p.pos.y >= obsGroundY && p.pos.y <= obsGroundY + obs.height) {
          const d = Math.hypot(p.pos.x - obs.x, p.pos.z - obs.z);
          if (d <= obs.radius) {
            this.resolveProjectileImpact(p, p.pos, null);
            this.battleScene.remove(p.mesh);
            this.projectiles.splice(i, 1);
            collided = true;
            break;
          }
        }
      }
      if (collided) continue;

      // 3. Explosive Barrels collision
      for (const b of this.barrels) {
        if (!b.alive) continue;
        if (p.pos.y >= b.groundY && p.pos.y <= b.groundY + 1.3) {
          const d = Math.hypot(p.pos.x - b.x, p.pos.z - b.z);
          if (d <= b.radius + 0.2) {
            this.detonateBarrel(b);
            this.resolveProjectileImpact(p, p.pos, null);
            this.battleScene.remove(p.mesh);
            this.projectiles.splice(i, 1);
            collided = true;
            break;
          }
        }
      }
      if (collided) continue;

      // 4. Hit Player (if projectile from enemy team)
      if (p.team === 'enemies') {
        const playerCenter = new THREE.Vector3(this.playerX, this.playerGroundY + 1.1, this.playerZ);
        const dist = p.pos.distanceTo(playerCenter);
        if (dist <= (this.playerRig?.halfWidth ?? 1.2) + 0.4) {
          this.handlePlayerHit(p);
          this.battleScene.remove(p.mesh);
          this.projectiles.splice(i, 1);
          continue;
        }
      }

      // 5. Hit opposing bots (allies hit enemies; enemies hit allies)
      for (const enemy of this.activeEnemies) {
        if (enemy.hp <= 0 || enemy.team === p.team) continue;
        const enemyCenter = new THREE.Vector3(enemy.x, enemy.groundY + 1.1, enemy.z);
        const dist = p.pos.distanceTo(enemyCenter);
        if (dist <= enemy.rig.halfWidth + 0.4) {
          this.resolveProjectileImpact(p, p.pos, enemy);
          this.battleScene.remove(p.mesh);
          this.projectiles.splice(i, 1);
          collided = true;
          break;
        }
      }
      if (collided) continue;
    }
  }

  private resolveProjectileImpact(p: ActiveProjectile, hitPos: THREE.Vector3, directTarget: ActiveEnemy | null): void {
    this.battleParticles.spawnImpact(hitPos, p.style);
    this.audio.playHit();

    // 1. Direct Hit Damage
    if (directTarget && directTarget.hp > 0 && directTarget.team !== p.team) {
      this.applyDamageToEnemy(directTarget, p.damage, hitPos, false, p.fromPlayer);
    }

    // 2. Area of Effect (AoE) Damage
    if (p.aoeRadius > 0) {
      for (const enemy of this.activeEnemies) {
        if (enemy === directTarget || enemy.hp <= 0 || enemy.team === p.team) continue;
        const d = Math.hypot(enemy.x - hitPos.x, enemy.z - hitPos.z);
        if (d <= p.aoeRadius) {
          const falloff = 1 - d / p.aoeRadius;
          const aoeDmg = Math.round(p.damage * Math.max(0.35, falloff));
          this.applyDamageToEnemy(enemy, aoeDmg, new THREE.Vector3(enemy.x, enemy.groundY + 1.0, enemy.z), false, p.fromPlayer);
        }
      }
    }

    // 3. Tesla Electric Chain Lightning Feature
    if (p.style === 'electric' && p.chainCount > 0 && p.chainRange > 0) {
      this.resolveElectricChain(hitPos, directTarget, p.damage, p.chainCount, p.chainRange, p.team, p.fromPlayer);
    }
  }

  private resolveElectricChain(
    originPos: THREE.Vector3,
    excludeEnemy: ActiveEnemy | null,
    baseDmg: number,
    chainCount: number,
    chainRange: number,
    attackerTeam: TeamSide = 'allies',
    fromPlayer = true
  ): void {
    let hitsRemaining = chainCount;
    let prevPos = originPos.clone();

    // Find closest opposing bots within chainRange
    const candidates = this.activeEnemies
      .filter((e) => e !== excludeEnemy && e.hp > 0 && e.team !== attackerTeam)
      .map((e) => ({
        enemy: e,
        dist: originPos.distanceTo(new THREE.Vector3(e.x, e.groundY + 1.0, e.z))
      }))
      .filter((c) => c.dist <= chainRange)
      .sort((a, b) => a.dist - b.dist);

    for (const cand of candidates) {
      if (hitsRemaining <= 0) break;

      const targetPos = new THREE.Vector3(cand.enemy.x, cand.enemy.groundY + 1.1, cand.enemy.z);
      this.battleParticles.spawnElectricArc(prevPos, targetPos);
      this.audio.playElectricArc();

      const chainDmg = Math.round(baseDmg * 0.55);
      this.applyDamageToEnemy(cand.enemy, chainDmg, targetPos, true, fromPlayer);

      prevPos = targetPos;
      hitsRemaining--;
    }
  }

  private applyDamageToEnemy(
    enemy: ActiveEnemy,
    amount: number,
    hitPos: THREE.Vector3,
    isElectric = false,
    fromPlayer = true
  ): void {
    if (enemy.hp <= 0) return;

    enemy.hp = Math.max(0, enemy.hp - amount);
    enemy.lastHitTime = performance.now() / 1000;
    enemy.lastAttackerIsPlayer = fromPlayer;
    enemy.evasionTimer = 2.4;
    if (Math.random() < 0.6) {
      enemy.strafeDir = -enemy.strafeDir;
    }
    enemy.aiTimer = Math.min(enemy.aiTimer, 0.2);

    if (fromPlayer && enemy.team === 'enemies') {
      this.totalDamageDealt += amount;
      this.score += amount * 2;
    }

    // Floating text
    const proj = hitPos.clone().project(this.camera);
    const screenX = ((proj.x + 1) / 2) * window.innerWidth;
    const screenY = ((-proj.y + 1) / 2) * window.innerHeight;

    const textLabel = isElectric ? `⚡ -${amount}` : `-${amount}`;
    const textColor = enemy.team === 'allies'
      ? '#f87171'
      : isElectric
        ? '#ef4444'
        : amount > 150
          ? '#f59e0b'
          : '#facc15';

    this.callbacks.onFloatingText?.({
      x: Math.round(screenX),
      y: Math.round(screenY),
      text: textLabel,
      color: textColor,
      big: amount > 140
    });

    // Check Bot Destroyed
    if (enemy.hp === 0) {
      this.handleEnemyDestroyed(enemy, hitPos);
    }
  }

  private handleEnemyDestroyed(enemy: ActiveEnemy, deathPos: THREE.Vector3): void {
    // Heavy explosion VFX & sound
    this.battleParticles.spawnExplosion(deathPos, enemy.spec.isBoss ? 1.9 : 1.25);
    this.audio.playExplosion(enemy.spec.isBoss);

    if (enemy.team === 'enemies') {
      this.killsInRun++;

      const rewardCoins = enemy.spec.rewardCoins;
      this.coinsEarned += rewardCoins;
      this.score += enemy.spec.scorePoints;

      // Floating rewards text
      const proj = deathPos.clone().project(this.camera);
      const screenX = ((proj.x + 1) / 2) * window.innerWidth;
      const screenY = ((-proj.y + 1) / 2) * window.innerHeight;

      this.callbacks.onFloatingText?.({
        x: Math.round(screenX),
        y: Math.round(screenY - 32),
        text: `+${rewardCoins} 🪙`,
        color: '#fbbf24',
        big: true
      });

      // Chance to drop power-up pickup (40% for regular, 100% for boss)
      const dropChance = enemy.spec.isBoss ? 1.0 : 0.38;
      if (Math.random() < dropChance) {
        const kinds: PowerUpKind[] = ['repair', 'damage', 'speed', 'shield'];
        const chosenKind = kinds[Math.floor(Math.random() * kinds.length)];
        this.spawnPickup(enemy.x, enemy.z, chosenKind);
      }
    }

    // Remove rig from scene and active list
    this.battleScene.remove(enemy.rig.root);
    const idx = this.activeEnemies.indexOf(enemy);
    if (idx !== -1) {
      this.activeEnemies.splice(idx, 1);
    }

    // Duel Victory Condition
    if (this.currentMode === 'duel' && this.duelOpponent === enemy) {
      this.handleDuelVictory();
      return;
    }

    // Team Battle Victory Condition (all 5 enemies destroyed)
    if (this.currentMode === 'team_battle' && this.inBattle) {
      const anyEnemyAlive = this.activeEnemies.some((e) => e.team === 'enemies' && e.hp > 0);
      if (!anyEnemyAlive) {
        this.handleTeamBattleVictory();
        return;
      }
    }

    // Refill next wave enemy
    if (this.currentMode === 'waves') {
      this.fillWaveSpawns();
    }
  }

  private handlePlayerHit(p: ActiveProjectile): void {
    // Shield absorb
    if (this.shieldTimer > 0) {
      this.shieldTimer = Math.max(0, this.shieldTimer - 2.5);
      this.battleParticles.spawnImpact(p.pos, 'electric');
      this.audio.playHit();

      this.callbacks.onFloatingText?.({
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.55,
        text: '🛡️ ЩИТ ПОГЛИНУВ УДАР!',
        color: '#38bdf8',
        big: true
      });
      return;
    }

    this.playerHp = Math.max(0, this.playerHp - p.damage);
    this.screenShakeIntensity = Math.min(1.2, this.screenShakeIntensity + 0.45);
    this.audio.playHit();
    this.battleParticles.spawnImpact(p.pos, p.style);

    this.callbacks.onFloatingText?.({
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.58,
      text: `-${p.damage}`,
      color: '#ef4444',
      big: true
    });

    if (this.playerHp === 0) {
      this.handlePlayerDefeat();
    }
  }

  // ==========================================================================
  // Repair Kit & Detonations
  // ==========================================================================

  private handleRepairKit(): void {
    if (this.repairCooldownLeft > 0 || this.playerHp >= this.playerMaxHp) return;

    const healAmount = Math.round(this.playerMaxHp * 0.35);
    this.playerHp = Math.min(this.playerMaxHp, this.playerHp + healAmount);
    this.repairCooldownLeft = 18.0;

    this.audio.playRepair();
    this.battleParticles.spawnRepairEffect(this.playerRig!.root.position);

    this.callbacks.onFloatingText?.({
      x: window.innerWidth / 2,
      y: window.innerHeight * 0.62,
      text: `+${healAmount} HP 💚`,
      color: '#22c55e',
      big: true
    });
  }

  private detonateBarrel(b: ActiveBarrel): void {
    b.alive = false;
    this.battleScene.remove(b.mesh);

    const pos = new THREE.Vector3(b.x, b.groundY + 0.6, b.z);
    this.battleParticles.spawnExplosion(pos, 1.45);
    this.audio.playExplosion(true);

    // Damage enemies around barrel
    const blastRadius = 7.5;
    const barrelDamage = 260;

    for (const enemy of this.activeEnemies) {
      if (enemy.hp <= 0) continue;
      const d = Math.hypot(enemy.x - b.x, enemy.z - b.z);
      if (d <= blastRadius) {
        const falloff = 1 - d / blastRadius;
        const dmg = Math.round(barrelDamage * Math.max(0.4, falloff));
        this.applyDamageToEnemy(enemy, dmg, new THREE.Vector3(enemy.x, enemy.groundY + 1.0, enemy.z));
      }
    }
  }

  // ==========================================================================
  // Pickups
  // ==========================================================================

  private spawnPickup(x: number, z: number, kind: PowerUpKind): void {
    if (!this.arena) return;

    const group = createPickupMesh(kind);
    const groundY = this.arena.getHeightAt(x, z);
    group.position.set(x, groundY, z);
    this.battleScene.add(group);

    this.pickups.push({
      group,
      kind,
      x,
      z,
      groundY,
      life: 0
    });

    this.audio.playPowerUpSpawn();
  }

  private updatePickups(dt: number): void {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pu = this.pickups[i];
      pu.life += dt;

      // Gentle floating bob & rotation
      pu.group.rotation.y += dt * 1.8;
      pu.group.position.y = pu.groundY + Math.sin(pu.life * 4) * 0.12;

      // Despawn after 24s
      if (pu.life > 24) {
        this.battleScene.remove(pu.group);
        this.pickups.splice(i, 1);
        continue;
      }

      // Check player collection
      const dist = Math.hypot(this.playerX - pu.x, this.playerZ - pu.z);
      if (dist < 2.4) {
        this.applyPickupBuff(pu.kind);
        this.battleScene.remove(pu.group);
        this.pickups.splice(i, 1);
      }
    }
  }

  private applyPickupBuff(kind: PowerUpKind): void {
    this.audio.playPowerUpPickup();

    if (kind === 'repair') {
      const heal = Math.round(this.playerMaxHp * 0.4);
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + heal);
      this.battleParticles.spawnRepairEffect(this.playerRig!.root.position);
      this.callbacks.onFloatingText?.({
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.6,
        text: `+${heal} HP РЕМОНТ! 💚`,
        color: '#22c55e',
        big: true
      });
    } else if (kind === 'damage') {
      this.damageBoostTimer = 15.0;
      this.callbacks.onFloatingText?.({
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.6,
        text: '🔥 ПОДВІЙНИЙ УРОН (15с)!',
        color: '#ef4444',
        big: true
      });
    } else if (kind === 'speed') {
      this.speedBoostTimer = 15.0;
      this.callbacks.onFloatingText?.({
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.6,
        text: '⚡ ТУРБО-ПРИСКОРЕННЯ (15с)!',
        color: '#eab308',
        big: true
      });
    } else if (kind === 'shield') {
      this.shieldTimer = 14.0;
      this.playerRig!.shieldMesh.visible = true;
      this.callbacks.onFloatingText?.({
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.6,
        text: '🛡️ ЕНЕРГЕТИЧНИЙ ЩИТ (14с)!',
        color: '#38bdf8',
        big: true
      });
    }
  }

  // ==========================================================================
  // Wave Progression & Battle Conclusions
  // ==========================================================================

  private checkWaveProgress(): void {
    if (this.activeEnemies.length === 0 && this.waveQueue.length === 0) {
      // Wave Completed!
      const waveBonusCoins = 50 + this.waveNumber * 25;
      this.coinsEarned += waveBonusCoins;

      // Heal player +20% HP
      const heal = Math.round(this.playerMaxHp * 0.2);
      this.playerHp = Math.min(this.playerMaxHp, this.playerHp + heal);
      this.battleParticles.spawnRepairEffect(this.playerRig!.root.position);

      this.audio.playStageStart();

      this.callbacks.onFloatingText?.({
        x: window.innerWidth / 2,
        y: window.innerHeight * 0.5,
        text: `ХВИЛЯ ${this.waveNumber} ПРОЙДЕНА! +${waveBonusCoins} 🪙`,
        color: '#22c55e',
        big: true
      });

      // Advance to next wave
      this.initWaveMode(this.waveNumber + 1);
    }
  }

  private handleDuelVictory(): void {
    this.inBattle = false;
    this.input.setGameplayActive(false);

    const bonus = 280 + this.storage.getData().duelWins * 60;
    this.coinsEarned += bonus;

    const summary: BattleSummary = {
      victory: true,
      mode: 'duel',
      waveReached: 1,
      kills: this.killsInRun,
      damageDealt: this.totalDamageDealt,
      coinsEarned: this.coinsEarned,
      score: this.score,
      isNewBestWave: false
    };

    this.callbacks.onBattleEnd?.(summary);
  }

  private updateTeamBattleBase(dt: number): void {
    if (!this.inBattle || this.currentMode !== 'team_battle') return;

    const baseRadius = 13;
    let alliesInZone = 0;
    let enemiesInZone = 0;

    if (this.playerHp > 0 && Math.hypot(this.playerX, this.playerZ) <= baseRadius) {
      alliesInZone++;
    }

    for (const bot of this.activeEnemies) {
      if (bot.hp <= 0) continue;
      if (Math.hypot(bot.x, bot.z) <= baseRadius) {
        if (bot.team === 'allies') {
          alliesInZone++;
        } else {
          enemiesInZone++;
        }
      }
    }

    let isGrowing = false;

    if (alliesInZone > 0 && enemiesInZone > 0) {
      this.captureTeam = 'contested';
    } else if (alliesInZone > 0) {
      if (this.captureOwnerProgressTeam === 'enemies' && this.captureProgress > 0) {
        this.captureProgress = 0;
      }
      this.captureOwnerProgressTeam = 'allies';
      this.captureTeam = 'allies';
      const rate = alliesInZone >= 2 ? 20 : 12;
      this.captureProgress = Math.min(100, this.captureProgress + rate * dt);
      isGrowing = this.captureProgress < 100;
    } else if (enemiesInZone > 0) {
      if (this.captureOwnerProgressTeam === 'allies' && this.captureProgress > 0) {
        this.captureProgress = 0;
      }
      this.captureOwnerProgressTeam = 'enemies';
      this.captureTeam = 'enemies';
      const rate = enemiesInZone >= 2 ? 20 : 12;
      this.captureProgress = Math.min(100, this.captureProgress + rate * dt);
      isGrowing = this.captureProgress < 100;
    } else if (this.captureProgress > 0) {
      this.captureProgress = Math.max(0, this.captureProgress - 8 * dt);
      if (this.captureProgress === 0) {
        this.captureTeam = null;
        this.captureOwnerProgressTeam = null;
      } else {
        this.captureTeam = this.captureOwnerProgressTeam;
      }
    } else {
      this.captureTeam = null;
      this.captureOwnerProgressTeam = null;
    }

    this.captureBaseVisual?.update(dt, this.captureTeam, this.captureProgress);

    if ((this.captureTeam === 'allies' || this.captureTeam === 'enemies') && isGrowing) {
      this.baseAlarmTimer -= dt;
      if (this.baseAlarmTimer <= 0) {
        this.baseAlarmTimer = 1.8;
        this.audio.playBaseAlarm(this.captureTeam === 'enemies');
      }
    } else {
      this.baseAlarmTimer = Math.max(0, this.baseAlarmTimer - dt);
    }

    // Check base capture win/loss
    if (this.captureProgress >= 100) {
      if (this.captureTeam === 'allies') {
        this.handleTeamBattleVictory();
      } else if (this.captureTeam === 'enemies') {
        this.handlePlayerDefeat();
      }
    }
  }

  private handleTeamBattleVictory(): void {
    if (!this.inBattle) return;
    this.inBattle = false;
    this.input.setGameplayActive(false);

    const bonus = 220 + this.storage.getData().teamBattleWins * 40;
    this.coinsEarned += bonus;
    this.score += 1500;

    const summary: BattleSummary = {
      victory: true,
      mode: 'team_battle',
      waveReached: 1,
      kills: this.killsInRun,
      damageDealt: this.totalDamageDealt,
      coinsEarned: this.coinsEarned,
      score: this.score,
      isNewBestWave: false
    };

    this.callbacks.onBattleEnd?.(summary);
  }

  private handlePlayerDefeat(): void {
    this.inBattle = false;
    this.input.setGameplayActive(false);

    this.battleParticles.spawnExplosion(this.playerRig!.root.position, 1.85);

    const currentBest = this.storage.getData().bestWave;
    const isNewBest = this.currentMode === 'waves' && this.waveNumber > currentBest;

    const summary: BattleSummary = {
      victory: false,
      mode: this.currentMode,
      waveReached: this.waveNumber,
      kills: this.killsInRun,
      damageDealt: this.totalDamageDealt,
      coinsEarned: this.coinsEarned,
      score: this.score,
      isNewBestWave: isNewBest
    };

    this.callbacks.onBattleEnd?.(summary);
  }

  // ==========================================================================
  // HUD Dispatchers & Plate Projections
  // ==========================================================================

  private dispatchHudState(snap: WotInputSnapshot): void {
    const mapDef = MAP_DEFINITIONS[this.currentMapId];
    const data = this.storage.getData();

    const enemiesLeft = this.currentMode === 'waves'
      ? this.waveQueue.length + this.activeEnemies.length
      : this.activeEnemies.filter((e) => e.team === 'enemies' && e.hp > 0).length;

    // Minimap entities compilation
    const minimapEntities: MinimapEntity[] = [];

    // Central Base (Team Battle mode)
    if (this.currentMode === 'team_battle') {
      minimapEntities.push({
        kind: 'base',
        x: 0,
        z: 0,
        captureState: this.captureTeam
      });
    }

    // Player
    minimapEntities.push({
      kind: 'player',
      x: this.playerX,
      z: this.playerZ,
      yaw: this.playerHullYaw
    });

    // Allies, Enemies & Boss
    for (const enemy of this.activeEnemies) {
      if (enemy.hp <= 0) continue;
      minimapEntities.push({
        kind: enemy.team === 'allies' ? 'ally' : enemy.spec.isBoss ? 'boss' : 'enemy',
        x: enemy.x,
        z: enemy.z,
        yaw: enemy.hullYaw
      });
    }

    // Pickups
    for (const pu of this.pickups) {
      minimapEntities.push({
        kind: 'pickup',
        x: pu.x,
        z: pu.z
      });
    }

    // Boss Bar data
    let bossName: string | null = null;
    let bossHp = 0;
    let bossMaxHp = 0;

    if (this.currentMode === 'duel' && this.duelOpponent) {
      bossName = this.duelOpponent.spec.name;
      bossHp = this.duelOpponent.hp;
      bossMaxHp = this.duelOpponent.maxHp;
    } else {
      const activeBoss = this.activeEnemies.find((e) => e.spec.isBoss && e.hp > 0);
      if (activeBoss) {
        bossName = activeBoss.spec.name;
        bossHp = activeBoss.hp;
        bossMaxHp = activeBoss.maxHp;
      }
    }

    const hud: HudState = {
      mode: this.currentMode,
      mapId: this.currentMapId,
      mapName: mapDef.name,
      waveNumber: this.waveNumber,
      enemiesRemaining: enemiesLeft,
      totalKillsInRun: this.killsInRun,
      score: this.score,
      bestWave: data.bestWave,
      coins: data.coins,
      coinsEarnedInRun: this.coinsEarned,
      playerHp: this.playerHp,
      playerMaxHp: this.playerMaxHp,
      speedKmh: this.playerSpeedKmh,
      activeWeaponSlot: this.activeWeaponSlot,
      hasSecondaryWeapon: this.playerStats.secondaryWeapon !== null,
      primaryWeaponName: this.playerStats.primaryWeapon.name,
      secondaryWeaponName: this.playerStats.secondaryWeapon?.name ?? null,
      primaryReloadLeft: Number(this.primaryReloadLeft.toFixed(2)),
      primaryReloadTotal: this.playerStats.primaryWeapon.reloadSec,
      secondaryReloadLeft: Number(this.secondaryReloadLeft.toFixed(2)),
      secondaryReloadTotal: this.playerStats.secondaryWeapon?.reloadSec ?? 0,
      repairCooldownLeft: Number(this.repairCooldownLeft.toFixed(1)),
      repairCooldownTotal: 18.0,
      isSniper: snap.isSniper,
      isArtilleryMode: this.activeWeaponSlot === 2,
      artyZoomStep: snap.artyZoomStep || 1,
      artyShotsLeft: this.artyShotsLeft,
      artyShotsMax: this.artyShotsMax,
      artyAimX: this.artyAimPos.x,
      artyAimZ: this.artyAimPos.y,
      sniperZoom: snap.sniperZoom,
      aimDistanceMeters: this.aimDistanceMeters,
      targetEnemyName: this.targetEnemyName,
      targetEnemyHp: this.targetEnemyHp,
      targetEnemyMaxHp: this.targetEnemyMaxHp,
      bossName,
      bossHp,
      bossMaxHp,
      damageBoostTimer: Number(this.damageBoostTimer.toFixed(1)),
      shieldTimer: Number(this.shieldTimer.toFixed(1)),
      testDriveActive: false,
      worldHalfSize: WORLD_HALF_SIZE,
      cameraYaw: snap.cameraYaw,
      hullYaw: this.playerHullYaw,
      turretYaw: this.playerTurretYaw,
      minimapEntities,
      teamBattle: this.buildTeamBattleHudState()
    };

    this.callbacks.onHudUpdate?.(hud);
  }

  private buildTeamBattleHudState(): TeamBattleHudState | null {
    if (this.currentMode !== 'team_battle') return null;

    const alliesRoster: TeamRosterEntry[] = this.teamAlliesRoster.map((entry) => ({
      tier: entry.tier,
      alive: entry.isPlayer
        ? this.playerHp > 0
        : this.activeEnemies.some((e) => e.id === entry.id && e.hp > 0),
      isPlayer: entry.isPlayer
    }));

    const enemiesRoster: TeamRosterEntry[] = this.teamEnemiesRoster.map((entry) => ({
      tier: entry.tier,
      alive: this.activeEnemies.some((e) => e.id === entry.id && e.hp > 0)
    }));

    return {
      alliesAlive: alliesRoster.filter((r) => r.alive).length,
      enemiesAlive: enemiesRoster.filter((r) => r.alive).length,
      alliesRoster,
      enemiesRoster,
      captureProgress: Math.round(this.captureProgress),
      captureTeam: this.captureTeam
    };
  }

  private dispatchEnemyPlates(): void {
    const plates: EnemyPlateScreenItem[] = [];
    const camPos = this.camera.position;
    const halfW = window.innerWidth / 2;
    const halfH = window.innerHeight / 2;

    for (const enemy of this.activeEnemies) {
      if (enemy.hp <= 0) continue;

      const enemy3D = new THREE.Vector3(enemy.x, enemy.groundY + enemy.rig.height + 0.45, enemy.z);
      const toEnemy = enemy3D.clone().sub(camPos);

      const isArtilleryMode = this.activeWeaponSlot === 2 && this.wasSniper;
      const maxDist = isArtilleryMode ? 450 : 160;
      const lookDir = isArtilleryMode ? new THREE.Vector3(0, -1, 0) : this.cameraLookDir;

      // Discard enemies behind camera or too far
      if (toEnemy.dot(lookDir) <= 1.0 || toEnemy.length() > maxDist) {
        continue;
      }

      const proj = enemy3D.clone().project(this.camera);

      // Must be within visible frustum NDC [-1.1 .. 1.1]
      if (proj.z < 1.0 && proj.x >= -1.1 && proj.x <= 1.1 && proj.y >= -1.1 && proj.y <= 1.1) {
        const screenX = (proj.x * halfW) + halfW;
        const screenY = (-proj.y * halfH) + halfH;
        const roman = TANK_SPECS[enemy.spec.tierId]?.romanTier ?? 'I';

        plates.push({
          id: enemy.id,
          romanTier: roman,
          name: enemy.spec.name,
          hp: enemy.hp,
          maxHp: enemy.maxHp,
          hpPercent: enemy.maxHp > 0 ? (enemy.hp / enemy.maxHp) * 100 : 0,
          isBoss: enemy.spec.isBoss,
          isAlly: enemy.team === 'allies',
          screenX: Math.round(screenX),
          screenY: Math.round(screenY)
        });
      }
    }

    this.callbacks.onEnemyPlatesUpdate?.(plates);
  }

  // ==========================================================================
  // Helper Collisions & Cleanups
  // ==========================================================================

  private checkObstacleCollision(x: number, z: number, tankRadius: number): boolean {
    if (!this.arena) return false;

    for (const obs of this.arena.obstacles) {
      const d = Math.hypot(x - obs.x, z - obs.z);
      if (d < obs.radius + tankRadius) {
        return true;
      }
    }
    return false;
  }

  private checkTankCollision(x: number, z: number, tankRadius: number, selfId: number): boolean {
    if (this.playerHp > 0) {
      const playerRadius = this.playerRig?.halfWidth ?? 1.2;
      if (Math.hypot(x - this.playerX, z - this.playerZ) < playerRadius + tankRadius) {
        return true;
      }
    }

    for (const other of this.activeEnemies) {
      if (other.id === selfId || other.hp <= 0) continue;
      if (Math.hypot(x - other.x, z - other.z) < other.rig.halfWidth + tankRadius) {
        return true;
      }
    }

    return false;
  }

  private cleanBattleScene(): void {
    this.battleParticles.clear();

    for (const p of this.projectiles) {
      this.battleScene.remove(p.mesh);
    }
    this.projectiles = [];

    for (const pu of this.pickups) {
      this.battleScene.remove(pu.group);
    }
    this.pickups = [];

    for (const b of this.barrels) {
      this.battleScene.remove(b.mesh);
    }
    this.barrels = [];

    for (const enemy of this.activeEnemies) {
      this.battleScene.remove(enemy.rig.root);
    }
    this.activeEnemies = [];
    this.waveQueue = [];
    this.duelOpponent = null;

    if (this.captureBaseVisual) {
      this.battleScene.remove(this.captureBaseVisual.group);
      this.captureBaseVisual = null;
    }
    this.captureProgress = 0;
    this.captureTeam = null;
    this.captureOwnerProgressTeam = null;
    this.baseAlarmTimer = 0;
    this.teamAlliesRoster = [];
    this.teamEnemiesRoster = [];

    if (this.playerRig) {
      this.battleScene.remove(this.playerRig.root);
      this.playerRig = null;
    }

    if (this.arena) {
      this.battleScene.remove(this.arena.group);
      this.arena = null;
    }

    if (this.arenaLights) {
      this.battleScene.remove(this.arenaLights);
      this.arenaLights = null;
    }

    if (this.artyReticleMesh) {
      this.battleScene.remove(this.artyReticleMesh);
      this.artyReticleMesh = null;
    }
  }

  private createArtilleryReticleMesh(): THREE.Group {
    const group = new THREE.Group();

    // 1. Outer tactical ring
    const outerGeo = new THREE.RingGeometry(2.3, 2.65, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const outerRing = new THREE.Mesh(outerGeo, ringMat);
    outerRing.rotation.x = -Math.PI / 2;
    group.add(outerRing);

    // 2. Inner dashed tactical ring
    const innerGeo = new THREE.RingGeometry(1.15, 1.35, 28);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const innerRing = new THREE.Mesh(innerGeo, innerMat);
    innerRing.rotation.x = -Math.PI / 2;
    group.add(innerRing);

    // 3. Center bullseye dot
    const centerGeo = new THREE.CircleGeometry(0.32, 16);
    const centerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const centerDot = new THREE.Mesh(centerGeo, centerMat);
    centerDot.rotation.x = -Math.PI / 2;
    group.add(centerDot);

    // 4. Crosshair indicator ticks (4 cardinal blades)
    const tickGeo = new THREE.PlaneGeometry(0.18, 1.2);
    const tickMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });

    const northTick = new THREE.Mesh(tickGeo, tickMat);
    northTick.rotation.x = -Math.PI / 2;
    northTick.position.set(0, 0, -2.1);
    group.add(northTick);

    const southTick = new THREE.Mesh(tickGeo, tickMat);
    southTick.rotation.x = -Math.PI / 2;
    southTick.position.set(0, 0, 2.1);
    group.add(southTick);

    const eastTick = new THREE.Mesh(tickGeo, tickMat);
    eastTick.rotation.x = -Math.PI / 2;
    eastTick.rotation.z = Math.PI / 2;
    eastTick.position.set(2.1, 0, 0);
    group.add(eastTick);

    const westTick = new THREE.Mesh(tickGeo, tickMat);
    westTick.rotation.x = -Math.PI / 2;
    westTick.rotation.z = Math.PI / 2;
    westTick.position.set(-2.1, 0, 0);
    group.add(westTick);

    return group;
  }
}
