import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { SoundEngine } from './audio';
import {
  CAMO_ORDER,
  CAMO_SPECS,
  computeTankStats,
  getUpgradeCost,
  MAP_DEFINITIONS,
  MAP_ORDER,
  MAX_UPGRADE_LEVEL,
  TANK_SPECS,
  TANK_TIER_ORDER
} from './classes';
import {
  TankGame3D,
  type EnemyPlateScreenItem,
  type TankGameCallbacks,
  type TurretAimScreenOffset
} from './game';
import { InputManager } from './input';
import { StorageManager } from './storage';
import type {
  BattleSummary,
  FloatingTextItem,
  GameModeKind,
  HudState,
  MapBiomeId,
  TankCamoId,
  TankTierId,
  TankUpgradeLevels
} from './types';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type ScreenMode = 'hangar' | 'battle' | 'pause' | 'result';

// ============================================================================
// Core Singletons
// ============================================================================

const storage = new StorageManager();
const sound = new SoundEngine(storage.getData().muted);
const input = new InputManager();

// Unlock Web Audio on first user interaction anywhere
input.onAnyInteraction = () => {
  sound.unlock();
};

// ============================================================================
// DOM References
// ============================================================================

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

// Overlays
const enemyPlatesContainer = document.getElementById('enemy-plates') as HTMLElement;
const floatingTextsContainer = document.getElementById('floating-texts') as HTMLElement;

// Reticles & Aim Overlays
const arcadeReticleEl = document.getElementById('arcade-reticle') as HTMLElement;
const turretAimRingEl = document.getElementById('turret-aim-ring') as HTMLElement;
const reticleReloadTextEl = document.getElementById('reticle-reload-text') as HTMLElement;
const targetInfoEl = document.getElementById('target-info') as HTMLElement;
const targetNameEl = document.getElementById('target-name') as HTMLElement;
const targetHpFillEl = document.getElementById('target-hp-fill') as HTMLElement;
const targetHpTextEl = document.getElementById('target-hp-text') as HTMLElement;

// Sniper Overlay
const sniperOverlayEl = document.getElementById('sniper-overlay') as HTMLElement;
const sniperDistanceEl = document.getElementById('sniper-distance') as HTMLElement;
const sniperZoomLabelEl = document.getElementById('sniper-zoom-label') as HTMLElement;
const sniperWeaponLabelEl = document.getElementById('sniper-weapon-label') as HTMLElement;
const sniperReloadFillEl = document.getElementById('sniper-reload-fill') as HTMLElement;
const sniperReloadTextEl = document.getElementById('sniper-reload-text') as HTMLElement;

// Pointer Hint & Wave Banner
const pointerHintEl = document.getElementById('pointer-hint') as HTMLElement;
const waveBannerEl = document.getElementById('wave-banner') as HTMLElement;
const waveBannerSubEl = document.getElementById('wave-banner-sub') as HTMLElement;
const waveBannerTitleEl = document.getElementById('wave-banner-title') as HTMLElement;

// Battle HUD
const battleHudEl = document.getElementById('battle-hud') as HTMLElement;
const hudModeTitleEl = document.getElementById('hud-mode-title') as HTMLElement;
const hudWaveBadgeEl = document.getElementById('hud-wave-badge') as HTMLElement;
const hudEnemiesLeftEl = document.getElementById('hud-enemies-left') as HTMLElement;
const bossBarEl = document.getElementById('boss-bar') as HTMLElement;
const bossNameEl = document.getElementById('boss-name') as HTMLElement;
const bossHpTextEl = document.getElementById('boss-hp-text') as HTMLElement;
const bossHpFillEl = document.getElementById('boss-hp-fill') as HTMLElement;
const teamBattleHudEl = document.getElementById('team-battle-hud') as HTMLElement;
const tbAlliesRosterEl = document.getElementById('tb-allies-roster') as HTMLElement;
const tbEnemiesRosterEl = document.getElementById('tb-enemies-roster') as HTMLElement;
const tbScoreEl = document.getElementById('tb-score') as HTMLElement;
const tbCaptureBarEl = document.getElementById('tb-capture-bar') as HTMLElement;
const tbCaptureFillEl = document.getElementById('tb-capture-fill') as HTMLElement;
const tbCaptureLabelEl = document.getElementById('tb-capture-label') as HTMLElement;
const hudKillsEl = document.getElementById('hud-kills') as HTMLElement;
const hudScoreEl = document.getElementById('hud-score') as HTMLElement;
const hudCoinsEl = document.getElementById('hud-coins') as HTMLElement;
const btnMuteHud = document.getElementById('btn-mute') as HTMLButtonElement;
const btnPauseHud = document.getElementById('btn-pause') as HTMLButtonElement;

// Tank Status Panel
const hudTankNameEl = document.getElementById('hud-tank-name') as HTMLElement;
const hudSpeedEl = document.getElementById('hud-speed') as HTMLElement;
const hudBuffsEl = document.getElementById('hud-buffs') as HTMLElement;
const playerHpTextEl = document.getElementById('player-hp-text') as HTMLElement;
const playerHpFillEl = document.getElementById('player-hp-fill') as HTMLElement;

// Action Bar (Weapons, Consumables)
const slotWeapon1El = document.getElementById('slot-weapon-1') as HTMLElement;
const slot1NameEl = document.getElementById('slot-1-name') as HTMLElement;
const slot1FillEl = document.getElementById('slot-1-fill') as HTMLElement;
const slot1TimerEl = document.getElementById('slot-1-timer') as HTMLElement;
const slotWeapon2El = document.getElementById('slot-weapon-2') as HTMLElement;
const slot2NameEl = document.getElementById('slot-2-name') as HTMLElement;
const slot2FillEl = document.getElementById('slot-2-fill') as HTMLElement;
const slot2TimerEl = document.getElementById('slot-2-timer') as HTMLElement;
const slotRepairEl = document.getElementById('slot-repair') as HTMLElement;
const slot3FillEl = document.getElementById('slot-3-fill') as HTMLElement;
const slot3TimerEl = document.getElementById('slot-3-timer') as HTMLElement;
const btnSniperHud = document.getElementById('btn-sniper-hud') as HTMLButtonElement;

// Minimap
const minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
const minimapCtx = minimapCanvas?.getContext('2d');

// Touch Controls
const touchControlsEl = document.getElementById('touch-controls') as HTMLElement;
const btnTouchFire = document.getElementById('btn-touch-fire') as HTMLButtonElement;
const btnTouchSniper = document.getElementById('btn-touch-sniper') as HTMLButtonElement;
const btnTouchW1 = document.getElementById('btn-touch-w1') as HTMLButtonElement;
const btnTouchW2 = document.getElementById('btn-touch-w2') as HTMLButtonElement;
const btnTouchRepair = document.getElementById('btn-touch-repair') as HTMLButtonElement;

// Hangar Screen
const hangarScreenEl = document.getElementById('hangar-screen') as HTMLElement;
const hangarOrbitZoneEl = document.getElementById('hangar-orbit-zone') as HTMLElement;
const offlineBadgeEl = document.getElementById('offline-badge') as HTMLElement;
const btnPlayWaves = document.getElementById('btn-play-waves') as HTMLButtonElement;
const btnPlayDuel = document.getElementById('btn-play-duel') as HTMLButtonElement;
const btnPlayTeam = document.getElementById('btn-play-team') as HTMLButtonElement;
const hangarCoinsEl = document.getElementById('hangar-coins') as HTMLElement;
const hangarBestWaveEl = document.getElementById('hangar-best-wave') as HTMLElement;
const hangarDuelWinsEl = document.getElementById('hangar-duel-wins') as HTMLElement;
const hangarTeamWinsEl = document.getElementById('hangar-team-wins') as HTMLElement | null;
const btnHangarMute = document.getElementById('btn-hangar-mute') as HTMLButtonElement;
const btnHangarTouch = document.getElementById('btn-hangar-touch') as HTMLButtonElement;
const btnInstall = document.getElementById('btn-install') as HTMLButtonElement;

const btnTestDrive = document.getElementById('btn-test-drive') as HTMLButtonElement;
const mapSelectorEl = document.getElementById('map-selector') as HTMLElement;

// Hangar Tank Card
const hangarTierBadgeEl = document.getElementById('hangar-tier-badge') as HTMLElement;
const hangarTankTitleEl = document.getElementById('hangar-tank-title') as HTMLElement;
const hangarTankClassEl = document.getElementById('hangar-tank-class') as HTMLElement;
const btnUnlockTank = document.getElementById('btn-unlock-tank') as HTMLButtonElement;
const hangarTankDescEl = document.getElementById('hangar-tank-desc') as HTMLElement;
const hangarWeaponsInfoEl = document.getElementById('hangar-weapons-info') as HTMLElement;
const upgradesListEl = document.getElementById('upgrades-list') as HTMLElement;
const camoSelectedNameEl = document.getElementById('camo-selected-name') as HTMLElement | null;
const camoGridEl = document.getElementById('camo-grid') as HTMLElement | null;
const tankCarouselEl = document.getElementById('tank-carousel') as HTMLElement;

// Pause Modal
const pauseModalEl = document.getElementById('pause-modal') as HTMLElement;
const btnResume = document.getElementById('btn-resume') as HTMLButtonElement;
const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;
const btnToHangar = document.getElementById('btn-to-hangar') as HTMLButtonElement;

// Result Modal
const resultModalEl = document.getElementById('result-modal') as HTMLElement;
const resultTitleEl = document.getElementById('result-title') as HTMLElement;
const resultSubtitleEl = document.getElementById('result-subtitle') as HTMLElement;
const resWaveEl = document.getElementById('res-wave') as HTMLElement;
const resKillsEl = document.getElementById('res-kills') as HTMLElement;
const resDamageEl = document.getElementById('res-damage') as HTMLElement;
const resCoinsEl = document.getElementById('res-coins') as HTMLElement;
const resScoreEl = document.getElementById('res-score') as HTMLElement;
const btnPlayAgain = document.getElementById('btn-play-again') as HTMLButtonElement;
const btnResultHangar = document.getElementById('btn-result-hangar') as HTMLButtonElement;

// ============================================================================
// State Variables
// ============================================================================

let currentScreen: ScreenMode = 'hangar';
let inspectedTank: TankTierId = storage.getData().selectedTank || 'tier1';
let activeBattleTank: TankTierId = storage.getData().selectedTank || 'tier1';
let lastBattleMode: GameModeKind = 'waves';
let waveBannerTimer: number | null = null;
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

// Enemy 2D Plate DOM Pool
const enemyPlatePool: HTMLElement[] = [];

// ============================================================================
// Game Initialization & Callbacks
// ============================================================================

const gameCallbacks: TankGameCallbacks = {
  onHudUpdate(hud: HudState) {
    updateBattleHud(hud);
  },
  onTurretAimUpdate(offset: TurretAimScreenOffset) {
    updateTurretAimRing(offset);
  },
  onEnemyPlatesUpdate(plates: EnemyPlateScreenItem[]) {
    updateEnemyPlates(plates);
  },
  onFloatingText(item: FloatingTextItem) {
    createFloatingText(item);
  },
  onWaveBanner(waveOrTitle: number | string, subtitle?: string) {
    const title = typeof waveOrTitle === 'number' ? `ХВИЛЯ ${waveOrTitle}` : waveOrTitle;
    showWaveBanner(title, subtitle ?? 'ПРИГОТУЙТЕСЯ ДО БОЮ');
  },
  onBattleEnd(summary: BattleSummary) {
    handleBattleEnd(summary);
  },
  onPauseChange(paused: boolean) {
    if (paused && currentScreen === 'battle') {
      setScreen('pause');
    } else if (!paused && currentScreen === 'pause') {
      setScreen('battle');
    }
  }
};

const game = new TankGame3D(canvas, sound, input, storage, gameCallbacks);

// Show initial Hangar with selected tank
game.showHangar(inspectedTank);

// ============================================================================
// Screen Navigation
// ============================================================================

function updatePointerHint(): void {
  if (currentScreen === 'battle' && !input.isTouchActive()) {
    const isLocked = document.pointerLockElement === canvas;
    pointerHintEl.classList.toggle('hidden', isLocked);
  } else {
    pointerHintEl.classList.add('hidden');
  }
}

document.addEventListener('pointerlockchange', updatePointerHint);

function setScreen(mode: ScreenMode): void {
  currentScreen = mode;

  hangarScreenEl.classList.toggle('hidden', mode !== 'hangar');
  battleHudEl.classList.toggle('hidden', mode !== 'battle');
  arcadeReticleEl.classList.toggle('hidden', mode !== 'battle');
  pauseModalEl.classList.toggle('hidden', mode !== 'pause');
  resultModalEl.classList.toggle('hidden', mode !== 'result');

  if (mode === 'hangar') {
    input.setGameplayActive(false);
    arcadeReticleEl.classList.add('hidden');
    targetInfoEl.classList.add('hidden');
    sniperOverlayEl.classList.add('hidden');
    touchControlsEl.classList.add('hidden');
    waveBannerEl.classList.add('hidden');
    teamBattleHudEl?.classList.add('hidden');
    clearEnemyPlates();
    updatePointerHint();
    renderHangar();
  } else if (mode === 'battle') {
    input.setGameplayActive(true);
    const isTouch = input.isTouchActive();
    touchControlsEl.classList.toggle('hidden', !isTouch);
    updatePointerHint();
  } else if (mode === 'pause') {
    input.setGameplayActive(false);
    updatePointerHint();
  } else if (mode === 'result') {
    input.setGameplayActive(false);
    arcadeReticleEl.classList.add('hidden');
    targetInfoEl.classList.add('hidden');
    sniperOverlayEl.classList.add('hidden');
    touchControlsEl.classList.add('hidden');
    teamBattleHudEl?.classList.add('hidden');
    clearEnemyPlates();
    updatePointerHint();
  }
}

// ============================================================================
// Hangar UI Rendering & Logic
// ============================================================================

function selectHangarTank(tierId: TankTierId): void {
  inspectedTank = tierId;
  game.setHangarTank(tierId, storage.getSelectedCamo(tierId));

  const data = storage.getData();
  if (data.unlockedTanks.includes(tierId) || data.testDriveEnabled) {
    storage.selectTank(tierId);
  }

  renderHangar();
  sound.playUiClick();
}

function renderHangar(): void {
  const data = storage.getData();
  const spec = TANK_SPECS[inspectedTank] ?? TANK_SPECS.tier1;
  const isUnlocked = data.unlockedTanks.includes(inspectedTank);
  const testDrive = data.testDriveEnabled;
  const isAvailable = isUnlocked || testDrive;
  const upgrades = data.tankUpgrades[inspectedTank] ?? { hp: 0, damage: 0, reload: 0, speed: 0 };
  const computed = computeTankStats(inspectedTank, upgrades);

  // 1. Top right records & balance
  hangarCoinsEl.textContent = data.coins.toLocaleString('uk-UA');
  hangarBestWaveEl.textContent = data.bestWave.toString();
  hangarDuelWinsEl.textContent = data.duelWins.toString();
  if (hangarTeamWinsEl) {
    hangarTeamWinsEl.textContent = (data.teamBattleWins ?? 0).toString();
  }

  // Mute button icon
  btnHangarMute.textContent = sound.isMuted() ? '🔇' : '🔊';
  btnMuteHud.textContent = sound.isMuted() ? '🔇' : '🔊';

  // Touch mode button indicator
  btnHangarTouch.classList.toggle('active', input.isTouchActive());

  // 2. Test Drive button state
  btnTestDrive.classList.toggle('active', testDrive);
  if (testDrive) {
    btnTestDrive.innerHTML = `
      <span class="test-drive-led"></span>
      <span class="test-drive-text">⚡ Тест-драйв: <strong>УВІМК — усі танки I–V доступні!</strong></span>
    `;
  } else {
    btnTestDrive.innerHTML = `
      <span class="test-drive-led"></span>
      <span class="test-drive-text">⚡ Тест-драйв: <strong>ВИМК (спробуй танк V рівня одразу!)</strong></span>
    `;
  }

  // 3. Map Selector
  mapSelectorEl.innerHTML = '';
  for (const mapId of MAP_ORDER) {
    const mapDef = MAP_DEFINITIONS[mapId];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'map-select-btn' + (data.selectedMap === mapId ? ' active' : '');
    btn.textContent = mapDef.name;
    btn.title = mapDef.subtitle;
    btn.addEventListener('click', () => {
      storage.selectMap(mapId);
      renderHangar();
      sound.playUiClick();
    });
    mapSelectorEl.appendChild(btn);
  }

  // 4. Tank Specification Card
  hangarTierBadgeEl.textContent = spec.romanTier;
  hangarTankTitleEl.textContent = spec.name;
  hangarTankClassEl.textContent = `${spec.classLabel} • Рівень ${spec.romanTier}`;
  hangarTankDescEl.textContent = spec.description;

  // Unlock button
  if (isAvailable) {
    btnUnlockTank.classList.add('hidden');
  } else {
    btnUnlockTank.classList.remove('hidden');
    btnUnlockTank.textContent = `Купити за 🪙 ${spec.unlockCost}`;
    btnUnlockTank.disabled = data.coins < spec.unlockCost;
    btnUnlockTank.onclick = () => {
      if (storage.unlockTank(inspectedTank, spec.unlockCost)) {
        storage.selectTank(inspectedTank);
        sound.playRepair();
        renderHangar();
      }
    };
  }

  // Weapons info
  hangarWeaponsInfoEl.innerHTML = `
    <div class="weapon-info-row">
      <span class="w-slot">[1]</span>
      <span class="w-name">${spec.primaryWeapon.name}</span>
      <span class="w-dmg">${computed.primaryWeapon.damage} Шкоди • ${computed.primaryWeapon.reloadSec}с</span>
    </div>
    ${
      spec.secondaryWeapon && computed.secondaryWeapon
        ? `
      <div class="weapon-info-row" style="color:#38bdf8;">
        <span class="w-slot">[2]</span>
        <span class="w-name">${spec.secondaryWeapon.name}</span>
        <span class="w-dmg">${computed.secondaryWeapon.damage} Шкоди • ${computed.secondaryWeapon.reloadSec}с</span>
      </div>
      `
        : ''
    }
  `;

  // Upgrades list (HP, Damage, Reload, Speed)
  const upgradeConfig: Array<{ key: keyof TankUpgradeLevels; label: string }> = [
    { key: 'hp', label: 'Міцність (HP)' },
    { key: 'damage', label: 'Шкода гармати' },
    { key: 'reload', label: 'Перезарядка' },
    { key: 'speed', label: 'Швидкість' }
  ];

  upgradesListEl.innerHTML = '';
  for (const stat of upgradeConfig) {
    const curLevel = upgrades[stat.key] ?? 0;
    const cost = getUpgradeCost(spec.tierNumber, curLevel);
    const isMax = curLevel >= MAX_UPGRADE_LEVEL;

    const row = document.createElement('div');
    row.className = 'upgrade-card-item';

    // Dots for levels
    let dotsHtml = '';
    for (let i = 0; i < MAX_UPGRADE_LEVEL; i++) {
      dotsHtml += `<div class="upgrade-dot ${i < curLevel ? 'filled' : ''}"></div>`;
    }

    row.innerHTML = `
      <div class="upgrade-meta">
        <span class="upgrade-name">${stat.label} (${curLevel}/${MAX_UPGRADE_LEVEL})</span>
        <div class="upgrade-level-dots">${dotsHtml}</div>
      </div>
      <button class="btn-upgrade-action" ${isMax || data.coins < cost ? 'disabled' : ''}>
        ${isMax ? 'МАКС' : `🪙 ${cost}`}
      </button>
    `;

    const btnUpgrade = row.querySelector('.btn-upgrade-action') as HTMLButtonElement;
    if (!isMax) {
      btnUpgrade.addEventListener('click', () => {
        if (storage.upgradeTankStat(inspectedTank, stat.key, cost)) {
          sound.playUiClick();
          renderHangar();
        }
      });
    }

    upgradesListEl.appendChild(row);
  }

  // 5. Camouflage & Tuning
  const activeCamoId = storage.getSelectedCamo(inspectedTank);
  const activeCamoSpec = CAMO_SPECS[activeCamoId] ?? CAMO_SPECS.default;
  if (camoSelectedNameEl) {
    camoSelectedNameEl.textContent = activeCamoSpec.name;
  }

  if (camoGridEl) {
    camoGridEl.innerHTML = '';
    for (const camoId of CAMO_ORDER) {
      const camo = CAMO_SPECS[camoId];
      if (!camo) continue;

      const isUnlocked = storage.isCamoUnlocked(camoId);
      const isActive = camoId === activeCamoId;
      const canAfford = data.coins >= camo.cost;

      const btn = document.createElement('button');
      btn.type = 'button';
      let classNames = 'camo-btn';
      if (isActive) {
        classNames += ' is-active';
      } else if (!isUnlocked) {
        classNames += ' is-locked';
        if (!canAfford) {
          classNames += ' is-cant-afford';
        }
      }
      btn.className = classNames;

      let statusHtml = '';
      if (isActive) {
        statusHtml = '<span class="camo-status">✓</span>';
        btn.title = `${camo.name} (Активний)`;
      } else if (isUnlocked) {
        statusHtml = '<span class="camo-status">Обрати</span>';
        btn.title = `Обрати ${camo.name}`;
      } else {
        statusHtml = `<span class="camo-status">🪙 ${camo.cost}</span>`;
        btn.title = canAfford
          ? `Розблокувати ${camo.name} за 🪙 ${camo.cost}`
          : `Недостатньо срібла (потрібно 🪙 ${camo.cost})`;
      }

      btn.innerHTML = `
        <div class="camo-swatch" style="background: ${camo.previewBg}"></div>
        <span class="camo-name">${camo.name}</span>
        ${statusHtml}
      `;

      btn.addEventListener('click', () => {
        if (isActive) return;

        if (isUnlocked) {
          storage.selectCamo(camo.id, inspectedTank);
          game.setHangarTank(inspectedTank, camo.id);
          sound.playUiClick();
          renderHangar();
        } else {
          if (canAfford) {
            if (storage.unlockCamo(camo.id, camo.cost, inspectedTank)) {
              sound.playRepair();
              game.setHangarTank(inspectedTank, camo.id);
              renderHangar();
            }
          }
        }
      });

      camoGridEl.appendChild(btn);
    }
  }

  // 6. Tank Carousel (5 WoT Tanks I..V)
  tankCarouselEl.innerHTML = '';
  for (const tierId of TANK_TIER_ORDER) {
    const tSpec = TANK_SPECS[tierId];
    const tUnlocked = data.unlockedTanks.includes(tierId);
    const tAvailable = tUnlocked || testDrive;
    const isSelected = tierId === inspectedTank;

    const slot = document.createElement('div');
    slot.className = 'tank-carousel-slot' + (isSelected ? ' active' : '') + (!tAvailable ? ' locked' : '');

    let statusText = '';
    if (testDrive) {
      statusText = '⚡ Тест-драйв';
    } else if (tUnlocked) {
      statusText = '✅ У гаражі';
    } else {
      statusText = `🔒 🪙 ${tSpec.unlockCost}`;
    }

    slot.innerHTML = `
      <div class="slot-top-row">
        <span class="slot-tier-tag">${tSpec.romanTier}</span>
        <span class="slot-tank-sub">${statusText}</span>
      </div>
      <div class="slot-tank-label">${tSpec.name}</div>
    `;

    slot.addEventListener('click', () => {
      selectHangarTank(tierId);
    });

    tankCarouselEl.appendChild(slot);
  }
}

// ============================================================================
// Hangar Orbit Controls (Pointer Drag)
// ============================================================================

let isOrbitDragging = false;
let lastOrbitX = 0;
let lastOrbitY = 0;

hangarOrbitZoneEl.addEventListener('pointerdown', (e) => {
  isOrbitDragging = true;
  lastOrbitX = e.clientX;
  lastOrbitY = e.clientY;
  try {
    hangarOrbitZoneEl.setPointerCapture(e.pointerId);
  } catch {
    // Safe fallback
  }
});

hangarOrbitZoneEl.addEventListener('pointermove', (e) => {
  if (!isOrbitDragging) return;
  const dx = e.clientX - lastOrbitX;
  const dy = e.clientY - lastOrbitY;
  lastOrbitX = e.clientX;
  lastOrbitY = e.clientY;

  game.orbitHangar(dx * 0.008, dy * 0.004);
});

const stopOrbitDragging = (e: PointerEvent) => {
  if (isOrbitDragging) {
    isOrbitDragging = false;
    try {
      hangarOrbitZoneEl.releasePointerCapture(e.pointerId);
    } catch {
      // Safe fallback
    }
  }
};

hangarOrbitZoneEl.addEventListener('pointerup', stopOrbitDragging);
hangarOrbitZoneEl.addEventListener('pointercancel', stopOrbitDragging);

// ============================================================================
// Battle Launching
// ============================================================================

function launchBattle(mode: GameModeKind): void {
  sound.unlock();
  sound.playStageStart();

  const data = storage.getData();
  let tankToPlay = inspectedTank;
  const isAvailable = data.unlockedTanks.includes(inspectedTank) || data.testDriveEnabled;

  if (!isAvailable) {
    // If player tapped start on locked tank without test drive, use selected active tank
    tankToPlay = data.selectedTank;
  } else {
    storage.selectTank(inspectedTank);
  }

  activeBattleTank = tankToPlay;
  lastBattleMode = mode;
  game.startBattle(mode, tankToPlay, data.selectedMap);
  setScreen('battle');
}

btnPlayWaves.addEventListener('click', () => launchBattle('waves'));
btnPlayDuel.addEventListener('click', () => launchBattle('duel'));
btnPlayTeam.addEventListener('click', () => launchBattle('team_battle'));

// Test drive toggle
btnTestDrive.addEventListener('click', () => {
  const enabled = storage.toggleTestDrive();
  if (enabled) {
    storage.selectTank(inspectedTank);
  }
  renderHangar();
  sound.playPowerUpSpawn();
});

// Sound mute toggle
function toggleMute(): void {
  const next = !sound.isMuted();
  sound.setMuted(next);
  storage.setMuted(next);
  btnHangarMute.textContent = next ? '🔇' : '🔊';
  btnMuteHud.textContent = next ? '🔇' : '🔊';
}

btnHangarMute.addEventListener('click', toggleMute);
btnMuteHud.addEventListener('click', toggleMute);

// Touch mode toggle
btnHangarTouch.addEventListener('click', () => {
  const current = input.isTouchActive();
  const next = !current;
  storage.setTouchEnabled(next);
  input.setTouchOverride(next);
  btnHangarTouch.classList.toggle('active', next);
  sound.playUiClick();
});

// ============================================================================
// Battle HUD Updates
// ============================================================================

function updateBattleHud(hud: HudState): void {
  if (currentScreen !== 'battle') return;

  // 1. Top status bar
  if (hud.mode === 'duel') {
    hudModeTitleEl.textContent = '⚔️ ДУЕЛЬ';
    hudWaveBadgeEl.textContent = 'БОС 1 НА 1';
  } else if (hud.mode === 'team_battle') {
    hudModeTitleEl.textContent = '⚔️ КОМАНДНИЙ БІЙ';
    hudWaveBadgeEl.textContent = '5 НА 5';
  } else {
    hudModeTitleEl.textContent = 'ХВИЛІ';
    hudWaveBadgeEl.textContent = `ХВИЛЯ ${hud.waveNumber}`;
  }
  hudEnemiesLeftEl.textContent = hud.enemiesRemaining.toString();
  hudKillsEl.textContent = hud.totalKillsInRun.toString();
  hudScoreEl.textContent = hud.score.toString();
  hudCoinsEl.textContent = `🪙 ${hud.coinsEarnedInRun}`;

  // 2. Boss Bar
  if (hud.bossName && hud.bossHp > 0) {
    bossBarEl.classList.remove('hidden');
    bossNameEl.textContent = hud.bossName;
    bossHpTextEl.textContent = `${Math.max(0, Math.round(hud.bossHp))} / ${hud.bossMaxHp}`;
    const bossPercent = Math.max(0, Math.min(100, (hud.bossHp / hud.bossMaxHp) * 100));
    bossHpFillEl.style.width = `${bossPercent.toFixed(1)}%`;
  } else {
    bossBarEl.classList.add('hidden');
  }

  // 2b. Team Battle 5v5 HUD
  if (hud.teamBattle && teamBattleHudEl) {
    teamBattleHudEl.classList.remove('hidden');

    if (tbScoreEl) {
      tbScoreEl.textContent = `${hud.teamBattle.alliesAlive} : ${hud.teamBattle.enemiesAlive}`;
    }

    const romanTiers = ['I', 'II', 'III', 'IV', 'V'];

    if (tbAlliesRosterEl) {
      tbAlliesRosterEl.innerHTML = '';
      for (const ally of hud.teamBattle.alliesRoster) {
        const pip = document.createElement('div');
        const roman = romanTiers[ally.tier - 1] ?? ally.tier.toString();
        pip.className = `tb-tank-pip ally${ally.alive ? '' : ' dead'}${ally.isPlayer ? ' is-player' : ''}`;
        pip.textContent = roman;
        pip.title = ally.isPlayer ? `Ти (Рівень ${roman})` : `Союзник (Рівень ${roman})`;
        tbAlliesRosterEl.appendChild(pip);
      }
    }

    if (tbEnemiesRosterEl) {
      tbEnemiesRosterEl.innerHTML = '';
      for (const enemy of hud.teamBattle.enemiesRoster) {
        const pip = document.createElement('div');
        const roman = romanTiers[enemy.tier - 1] ?? enemy.tier.toString();
        pip.className = `tb-tank-pip enemy${enemy.alive ? '' : ' dead'}`;
        pip.textContent = roman;
        pip.title = `Ворог (Рівень ${roman})`;
        tbEnemiesRosterEl.appendChild(pip);
      }
    }

    if (tbCaptureBarEl && tbCaptureFillEl && tbCaptureLabelEl) {
      const hasCapture = hud.teamBattle.captureProgress > 0 || hud.teamBattle.captureTeam !== null;
      if (hasCapture) {
        tbCaptureBarEl.classList.remove('hidden');
        const progress = Math.max(0, Math.min(100, hud.teamBattle.captureProgress));
        tbCaptureFillEl.style.width = `${progress.toFixed(1)}%`;

        tbCaptureBarEl.classList.remove('is-allies', 'is-enemies', 'is-contested');

        const pct = Math.round(progress);
        if (hud.teamBattle.captureTeam === 'contested') {
          tbCaptureBarEl.classList.add('is-contested');
          tbCaptureLabelEl.textContent = `⚔️ БОРОТЬБА ЗА БАЗУ: ${pct}%`;
        } else if (hud.teamBattle.captureTeam === 'allies') {
          tbCaptureBarEl.classList.add('is-allies');
          tbCaptureLabelEl.textContent = `🏳️ ЗАХОПЛЮЄМО БАЗУ: ${pct}%`;
        } else if (hud.teamBattle.captureTeam === 'enemies') {
          tbCaptureBarEl.classList.add('is-enemies');
          tbCaptureLabelEl.textContent = `🚨 ВОРОГ ЗАХОПЛЮЄ БАЗУ: ${pct}%`;
        } else {
          tbCaptureLabelEl.textContent = `🏳️ БАЗА: ${pct}%`;
        }
      } else {
        tbCaptureBarEl.classList.add('hidden');
      }
    }
  } else if (teamBattleHudEl) {
    teamBattleHudEl.classList.add('hidden');
  }

  // 3. Player Tank Panel
  const tankSpec = TANK_SPECS[activeBattleTank] ?? TANK_SPECS.tier1;
  hudTankNameEl.textContent = `⭐ ${tankSpec.name}`;
  hudSpeedEl.textContent = Math.round(Math.abs(hud.speedKmh)).toString();
  if (slot1NameEl) {
    slot1NameEl.textContent = tankSpec.primaryWeapon.shortName;
  }
  if (slot2NameEl) {
    slot2NameEl.textContent = tankSpec.secondaryWeapon?.shortName ?? 'Міні-арта';
  }

  const hpPercent = Math.max(0, Math.min(100, (hud.playerHp / hud.playerMaxHp) * 100));
  playerHpTextEl.textContent = `${Math.max(0, Math.round(hud.playerHp))} / ${hud.playerMaxHp}`;
  playerHpFillEl.style.width = `${hpPercent.toFixed(1)}%`;

  // Buff badges
  hudBuffsEl.innerHTML = '';
  if (hud.shieldTimer > 0) {
    const b = document.createElement('span');
    b.className = 'buff-badge shield';
    b.textContent = `🛡️ Щит ${Math.ceil(hud.shieldTimer)}с`;
    hudBuffsEl.appendChild(b);
  }
  if (hud.damageBoostTimer > 0) {
    const b = document.createElement('span');
    b.className = 'buff-badge damage';
    b.textContent = `⚡ Шкода x2 ${Math.ceil(hud.damageBoostTimer)}с`;
    hudBuffsEl.appendChild(b);
  }

  // 4. Weapon Action Slots
  // Slot 1
  slotWeapon1El.classList.toggle('active', hud.activeWeaponSlot === 1);
  if (hud.primaryReloadLeft > 0 && hud.primaryReloadTotal > 0) {
    const ratio = Math.max(0, Math.min(1, hud.primaryReloadLeft / hud.primaryReloadTotal));
    slot1FillEl.style.height = `${(ratio * 100).toFixed(1)}%`;
    slot1TimerEl.textContent = `${hud.primaryReloadLeft.toFixed(1)}с`;
  } else {
    slot1FillEl.style.height = '0%';
    slot1TimerEl.textContent = '';
  }

  // Slot 2 (Mini-Artillery on Tier 5)
  if (hud.hasSecondaryWeapon) {
    slotWeapon2El.classList.remove('hidden');
    btnTouchW2.classList.remove('hidden');
    slotWeapon2El.classList.toggle('active', hud.activeWeaponSlot === 2);

    if (hud.secondaryReloadLeft > 0 && hud.secondaryReloadTotal > 0) {
      const ratio = Math.max(0, Math.min(1, hud.secondaryReloadLeft / hud.secondaryReloadTotal));
      slot2FillEl.style.height = `${(ratio * 100).toFixed(1)}%`;
      slot2TimerEl.textContent = `${hud.secondaryReloadLeft.toFixed(1)}с`;
    } else {
      slot2FillEl.style.height = '0%';
      slot2TimerEl.textContent = '';
    }
  } else {
    slotWeapon2El.classList.add('hidden');
    btnTouchW2.classList.add('hidden');
  }

  // Slot 3 (Repair Kit)
  if (hud.repairCooldownLeft > 0 && hud.repairCooldownTotal > 0) {
    const ratio = Math.max(0, Math.min(1, hud.repairCooldownLeft / hud.repairCooldownTotal));
    slot3FillEl.style.height = `${(ratio * 100).toFixed(1)}%`;
    slot3TimerEl.textContent = `${Math.ceil(hud.repairCooldownLeft)}с`;
    slotRepairEl.classList.add('on-cooldown');
    btnTouchRepair.classList.add('disabled');
  } else {
    slot3FillEl.style.height = '0%';
    slot3TimerEl.textContent = '';
    slotRepairEl.classList.remove('on-cooldown');
    btnTouchRepair.classList.remove('disabled');
  }

  // Mobile weapon buttons sync
  btnTouchW1.classList.toggle('active', hud.activeWeaponSlot === 1);
  btnTouchW2.classList.toggle('active', hud.activeWeaponSlot === 2);

  // 5. Target Info Plate
  if (hud.targetEnemyName && hud.targetEnemyHp > 0) {
    targetInfoEl.classList.remove('hidden');
    targetNameEl.textContent = hud.targetEnemyName;
    targetHpTextEl.textContent = `${Math.max(0, Math.round(hud.targetEnemyHp))} / ${hud.targetEnemyMaxHp} HP`;
    const targetPercent = Math.max(0, Math.min(100, (hud.targetEnemyHp / hud.targetEnemyMaxHp) * 100));
    targetHpFillEl.style.width = `${targetPercent.toFixed(1)}%`;
  } else {
    targetInfoEl.classList.add('hidden');
  }

  // 6. Sniper Mode vs Arcade Mode
  const activeReloadLeft = hud.activeWeaponSlot === 1 ? hud.primaryReloadLeft : hud.secondaryReloadLeft;
  const activeReloadTotal = hud.activeWeaponSlot === 1 ? hud.primaryReloadTotal : hud.secondaryReloadTotal;

  if (hud.isSniper) {
    arcadeReticleEl.classList.add('hidden');
    sniperOverlayEl.classList.remove('hidden');

    sniperDistanceEl.textContent = `${Math.round(hud.aimDistanceMeters)} м`;
    sniperZoomLabelEl.textContent = `x${hud.sniperZoom}`;
    sniperWeaponLabelEl.textContent =
      hud.activeWeaponSlot === 1 ? hud.primaryWeaponName : (hud.secondaryWeaponName ?? 'Міні-арта');

    if (activeReloadLeft > 0 && activeReloadTotal > 0) {
      const readyRatio = 1 - Math.max(0, Math.min(1, activeReloadLeft / activeReloadTotal));
      sniperReloadFillEl.style.width = `${(readyRatio * 100).toFixed(1)}%`;
      sniperReloadTextEl.textContent = `ПЕРЕЗАРЯДКА ${activeReloadLeft.toFixed(1)}с`;
    } else {
      sniperReloadFillEl.style.width = '100%';
      sniperReloadTextEl.textContent = 'ГОТОВИЙ';
    }
  } else {
    sniperOverlayEl.classList.add('hidden');
    arcadeReticleEl.classList.remove('hidden');

    if (activeReloadLeft > 0) {
      reticleReloadTextEl.textContent = `${activeReloadLeft.toFixed(1)}с`;
      reticleReloadTextEl.style.color = '#ef4444';
    } else {
      reticleReloadTextEl.textContent = 'ГОТОВИЙ';
      reticleReloadTextEl.style.color = 'var(--wot-green)';
    }
  }

  // 7. Tactical WoT Minimap
  renderMinimap(hud);
}

// ============================================================================
// Reticle & Turret Aim Offset
// ============================================================================

function updateTurretAimRing(offset: TurretAimScreenOffset): void {
  if (currentScreen !== 'battle') return;
  // Offset in pixels relative to center crosshair
  const dx = offset.dxPx ?? (offset as { dx?: number }).dx ?? 0;
  const dy = offset.dyPx ?? (offset as { dy?: number }).dy ?? 0;
  // Notice: .turret-aim-ring already has margin-top: -27px; margin-left: -27px in CSS,
  // so translating by dx, dy keeps it exactly centered when dx=0, dy=0!
  turretAimRingEl.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
}

// ============================================================================
// 2D Enemy Markers in 3D (Plates Pooling)
// ============================================================================

function updateEnemyPlates(plates: EnemyPlateScreenItem[]): void {
  if (currentScreen !== 'battle' || plates.length === 0) {
    clearEnemyPlates();
    return;
  }

  for (let i = 0; i < plates.length; i++) {
    const p = plates[i];
    let el = enemyPlatePool[i];

    if (!el) {
      el = document.createElement('div');
      el.className = 'enemy-plate';
      el.innerHTML = `
        <div class="enemy-plate-header">
          <span class="enemy-plate-tier"></span>
          <span class="enemy-plate-name"></span>
        </div>
        <div class="enemy-plate-bar">
          <div class="enemy-plate-fill"></div>
        </div>
      `;
      enemyPlatesContainer.appendChild(el);
      enemyPlatePool.push(el);
    }

    el.style.display = '';
    el.classList.toggle('is-ally', Boolean(p.isAlly));

    const px = p.screenX ?? (p as { x?: number }).x ?? 0;
    const py = p.screenY ?? (p as { y?: number }).y ?? 0;
    el.style.transform = `translate(-50%, -100%) translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;

    const tierEl = el.querySelector('.enemy-plate-tier') as HTMLElement;
    const nameEl = el.querySelector('.enemy-plate-name') as HTMLElement;
    const fillEl = el.querySelector('.enemy-plate-fill') as HTMLElement;

    if (tierEl) tierEl.textContent = p.romanTier;
    if (nameEl) nameEl.textContent = p.name;

    const hpPercent = p.maxHp > 0 ? (p.hp / p.maxHp) * 100 : 0;
    if (fillEl) {
      fillEl.style.width = `${Math.max(0, Math.min(100, hpPercent)).toFixed(1)}%`;
    }
  }

  // Hide remaining unused plates in pool
  for (let i = plates.length; i < enemyPlatePool.length; i++) {
    enemyPlatePool[i].style.display = 'none';
  }
}

function clearEnemyPlates(): void {
  for (const el of enemyPlatePool) {
    el.style.display = 'none';
  }
}

// ============================================================================
// Floating Combat Text
// ============================================================================

function createFloatingText(item: FloatingTextItem): void {
  const el = document.createElement('div');
  el.className = 'floating-text' + (item.big ? ' crit' : '');
  el.textContent = item.text;
  el.style.left = `${item.x.toFixed(1)}px`;
  el.style.top = `${item.y.toFixed(1)}px`;
  if (item.color) {
    el.style.color = item.color;
  }
  floatingTextsContainer.appendChild(el);

  window.setTimeout(() => {
    el.remove();
  }, 950);
}

// ============================================================================
// Wave Announcement Banner
// ============================================================================

function showWaveBanner(title: string, sub: string): void {
  if (waveBannerTimer !== null) {
    window.clearTimeout(waveBannerTimer);
  }

  waveBannerTitleEl.textContent = title;
  waveBannerSubEl.textContent = sub;
  waveBannerEl.classList.remove('hidden');

  waveBannerTimer = window.setTimeout(() => {
    waveBannerEl.classList.add('hidden');
    waveBannerTimer = null;
  }, 2400);
}

// ============================================================================
// Tactical Radar Minimap Drawing (168x168)
// ============================================================================

function renderMinimap(hud: HudState): void {
  if (!minimapCtx) return;
  const ctx = minimapCtx;
  const w = 168;
  const h = 168;

  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = 'rgba(8, 12, 18, 0.94)';
  ctx.fillRect(0, 0, w, h);

  // Tactical Grid 3x3
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w / 3, 0);
  ctx.lineTo(w / 3, h);
  ctx.moveTo((w * 2) / 3, 0);
  ctx.lineTo((w * 2) / 3, h);
  ctx.moveTo(0, h / 3);
  ctx.lineTo(w, h / 3);
  ctx.moveTo(0, (h * 2) / 3);
  ctx.lineTo(w, (h * 2) / 3);
  ctx.stroke();

  const halfSize = Math.max(10, hud.worldHalfSize || 45);
  const cx = w / 2;
  const cy = h / 2;
  const scale = (w * 0.46) / halfSize;

  const toMapX = (worldX: number) => cx + worldX * scale;
  const toMapY = (worldZ: number) => cy + worldZ * scale;

  const playerEnt = Array.isArray(hud.minimapEntities)
    ? hud.minimapEntities.find((e) => e.kind === 'player')
    : undefined;
  const px = playerEnt ? toMapX(playerEnt.x) : cx;
  const py = playerEnt ? toMapY(playerEnt.z) : cy;

  // Camera field of view cone (semi-transparent green fan)
  const camAngle = Math.PI / 2 - hud.cameraYaw;
  ctx.fillStyle = 'rgba(0, 255, 133, 0.12)';
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.arc(px, py, 45, camAngle - 0.45, camAngle + 0.45);
  ctx.closePath();
  ctx.fill();

  // Draw minimap entities
  if (Array.isArray(hud.minimapEntities)) {
    for (const ent of hud.minimapEntities) {
      if (ent.kind === 'player') continue;
      const ex = toMapX(ent.x);
      const ey = toMapY(ent.z);

      if (ent.kind === 'enemy') {
        // Red Diamond
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(ex, ey - 4);
        ctx.lineTo(ex + 4, ey);
        ctx.lineTo(ex, ey + 4);
        ctx.lineTo(ex - 4, ey);
        ctx.closePath();
        ctx.fill();
      } else if (ent.kind === 'ally') {
        // Bright green/teal Diamond for allies
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.moveTo(ex, ey - 4);
        ctx.lineTo(ex + 4, ey);
        ctx.lineTo(ex, ey + 4);
        ctx.lineTo(ex - 4, ey);
        ctx.closePath();
        ctx.fill();
      } else if (ent.kind === 'base') {
        // Central capture base: dashed circle with 'B'
        let baseColor = '#e2e8f0'; // neutral white
        if (ent.captureState === 'allies') {
          baseColor = '#22c55e';
        } else if (ent.captureState === 'enemies') {
          baseColor = '#ef4444';
        } else if (ent.captureState === 'contested') {
          baseColor = '#f59e0b';
        }

        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ex, ey, 11, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = baseColor;
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('B', ex, ey);
      } else if (ent.kind === 'boss') {
        // Boss Diamond (Large gold-red)
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(ex, ey - 7);
        ctx.lineTo(ex + 7, ey);
        ctx.lineTo(ex, ey + 7);
        ctx.lineTo(ex - 7, ey);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (ent.kind === 'pickup') {
        // Green bonus dot
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(ex, ey, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Draw Player Marker (Arrow pointing in hull direction)
  const hullAngle = Math.PI - hud.hullYaw;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(hullAngle);

  ctx.fillStyle = '#00ff85';
  ctx.strokeStyle = '#052e16';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 5);
  ctx.lineTo(0, 2);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// ============================================================================
// Modals & Battle Completion
// ============================================================================

function handleBattleEnd(summary: BattleSummary): void {
  storage.recordBattleResult(summary);

  if (summary.mode === 'team_battle') {
    resultTitleEl.textContent = summary.victory ? 'ПЕРЕМОГА КОМАНДИ!' : 'ПОРАЗКА КОМАНДИ';
    resultSubtitleEl.textContent = summary.victory
      ? 'Ворожу команду розбито або їхню базу захоплено!'
      : 'Союзні сили знищено або ворог захопив базу.';
  } else if (summary.mode === 'duel') {
    resultTitleEl.textContent = summary.victory ? 'ПЕРЕМОГА!' : 'ПОРАЗКА!';
    resultSubtitleEl.textContent = summary.victory
      ? 'Чемпіона розгромлено! Блискуча дуельна перемога!'
      : 'Твій танк підбито ворожими снарядами.';
  } else {
    resultTitleEl.textContent = summary.victory ? 'ПЕРЕМОГА!' : 'ПОРАЗКА!';
    resultSubtitleEl.textContent = summary.victory
      ? 'Хвилю успішно відбито! Позиції збережено.'
      : 'Твій танк підбито ворожими снарядами.';
  }
  resultTitleEl.style.color = summary.victory ? 'var(--wot-gold)' : 'var(--wot-red)';

  resWaveEl.textContent = summary.mode === 'team_battle' ? '5v5' : summary.waveReached.toString();
  resKillsEl.textContent = summary.kills.toString();
  resDamageEl.textContent = summary.damageDealt.toString();
  resCoinsEl.textContent = `+${summary.coinsEarned} 🪙`;
  resScoreEl.textContent = summary.score.toString();

  btnPlayAgain.textContent =
    summary.mode === 'duel'
      ? '⚔️ Нова дуель'
      : summary.mode === 'team_battle'
        ? '⚔️ Новий командний бій'
        : '⚔️ Наступний бій';

  setScreen('result');

  if (summary.victory) {
    sound.playVictory();
  } else {
    sound.playGameOver();
  }
}

// Pause button & hotkey
function togglePause(): void {
  if (currentScreen === 'battle') {
    game.setPaused(true);
    setScreen('pause');
  } else if (currentScreen === 'pause') {
    game.setPaused(false);
    setScreen('battle');
  }
}

btnPauseHud.addEventListener('click', togglePause);
btnResume.addEventListener('click', () => {
  game.setPaused(false);
  setScreen('battle');
});

btnRestart.addEventListener('click', () => {
  game.restartCurrentBattle();
  setScreen('battle');
});

btnToHangar.addEventListener('click', () => {
  game.returnToHangar();
  setScreen('hangar');
});

// Result modal actions
btnPlayAgain.addEventListener('click', () => {
  launchBattle(lastBattleMode);
});

btnResultHangar.addEventListener('click', () => {
  game.returnToHangar();
  setScreen('hangar');
});

// ============================================================================
// Action Bar & Touch Controls Listeners
// ============================================================================

// Weapon slot 1
slotWeapon1El.addEventListener('click', () => {
  input.requestWeaponSlot(1);
  sound.playWeaponSwitch(1);
});
btnTouchW1.addEventListener('click', () => {
  input.requestWeaponSlot(1);
  sound.playWeaponSwitch(1);
});

// Weapon slot 2 (Mini-artillery)
slotWeapon2El.addEventListener('click', () => {
  input.requestWeaponSlot(2);
  sound.playWeaponSwitch(2);
});
btnTouchW2.addEventListener('click', () => {
  input.requestWeaponSlot(2);
  sound.playWeaponSwitch(2);
});

// Repair Kit
slotRepairEl.addEventListener('click', () => {
  input.requestRepair();
});
btnTouchRepair.addEventListener('click', () => {
  input.requestRepair();
});

// Sniper toggle buttons
btnSniperHud.addEventListener('click', () => {
  input.toggleSniperTouch();
});
btnTouchSniper.addEventListener('click', () => {
  input.toggleSniperTouch();
});

// Touch Fire Button (Hold to fire)
btnTouchFire.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  input.triggerFireStart();
  try {
    btnTouchFire.setPointerCapture(e.pointerId);
  } catch {
    // Safe fallback
  }
});

const releaseTouchFire = (e: PointerEvent) => {
  input.triggerFireEnd();
  try {
    btnTouchFire.releasePointerCapture(e.pointerId);
  } catch {
    // Safe fallback
  }
};

btnTouchFire.addEventListener('pointerup', releaseTouchFire);
btnTouchFire.addEventListener('pointercancel', releaseTouchFire);

// Global hotkeys (KeyM for Sound mute)
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && !e.repeat) {
    toggleMute();
  }
});

// Window resize
window.addEventListener('resize', () => {
  game.handleResize();
});

// ============================================================================
// PWA Installation & Service Worker Registration
// ============================================================================

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e as BeforeInstallPromptEvent;
  btnInstall.classList.remove('hidden');
});

btnInstall.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  try {
    await deferredInstallPrompt.prompt();
    const outcome = await deferredInstallPrompt.userChoice;
    if (outcome.outcome === 'accepted') {
      btnInstall.classList.add('hidden');
    }
  } catch {
    // Safe fallback
  }
  deferredInstallPrompt = null;
});

window.addEventListener('appinstalled', () => {
  btnInstall.classList.add('hidden');
  deferredInstallPrompt = null;
});

// Register Service Worker for offline PWA
registerSW({
  immediate: true,
  onOfflineReady() {
    if (offlineBadgeEl) {
      offlineBadgeEl.textContent = '⚡ Офлайн-режим готовий';
      offlineBadgeEl.classList.add('ready');
    }
  }
});

// Initial Hangar UI Render
renderHangar();
