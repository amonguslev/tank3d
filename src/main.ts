import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { SoundEngine } from './audio';
import {
  computeBaseMaxHp,
  getBaseUpgradeCost,
  getUpgradeCost,
  MAX_UPGRADE_LEVEL,
  TANK_CLASS_ORDER,
  TANK_CLASSES
} from './classes';
import { TankGame3D } from './game';
import { InputManager } from './input';
import { getStageInfo } from './levels';
import { StorageManager } from './storage';
import type {
  CameraMode,
  FloatingTextItem,
  GameModeKind,
  HudState,
  RadarIndicator,
  StageKills,
  TankClassId,
  TankUpgradeLevels
} from './types';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Singletons
const storage = new StorageManager();
const sound = new SoundEngine(storage.getData().muted);
const input = new InputManager();

input.onAnyInteraction = () => {
  sound.unlock();
};

// ============================================================================
// DOM Elements
// ============================================================================

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const radarLayerEl = document.getElementById('radar-layer')!;
const floatingLayerEl = document.getElementById('floating-layer')!;

// HUD
const hudEl = document.getElementById('hud')!;
const hudStageLabel = document.getElementById('hud-stage-label')!;
const hudStage = document.getElementById('hud-stage')!;
const hudEnemies = document.getElementById('hud-enemies')!;
const hudLives = document.getElementById('hud-lives')!;
const hudCoins = document.getElementById('hud-coins')!;
const hudScore = document.getElementById('hud-score')!;
const hudBest = document.getElementById('hud-best')!;
const hudStars = document.getElementById('hud-stars')!;

// Health cards
const hudPlayerHpText = document.getElementById('hud-player-hp-text')!;
const hudPlayerHpFill = document.getElementById('hud-player-hp-fill')!;
const hudBaseCard = document.getElementById('hud-base-card')!;
const hudBaseHpText = document.getElementById('hud-base-hp-text')!;
const hudBaseHpFill = document.getElementById('hud-base-hp-fill')!;

// Boss Bar
const bossBarEl = document.getElementById('boss-bar')!;
const bossNameEl = document.getElementById('boss-name')!;
const bossHpTextEl = document.getElementById('boss-hp-text')!;
const bossHpFillEl = document.getElementById('boss-hp-fill')!;

// Buffs & Stage Banner
const buffsBarEl = document.getElementById('buffs-bar')!;
const stageBannerEl = document.getElementById('stage-banner')!;
const stageBannerSub = document.getElementById('stage-banner-sub')!;
const stageBannerTitle = document.getElementById('stage-banner-title')!;
const stageBannerName = document.getElementById('stage-banner-name')!;

// Screens
const menuScreen = document.getElementById('menu-screen')!;
const pauseScreen = document.getElementById('pause-screen')!;
const victoryScreen = document.getElementById('victory-screen')!;
const gameoverScreen = document.getElementById('gameover-screen')!;
const hangarScreen = document.getElementById('hangar-screen')!;
const touchControlsEl = document.getElementById('touch-controls')!;

// Main Menu Elements
const btnModeCampaign = document.getElementById('btn-mode-campaign') as HTMLButtonElement;
const btnModeHorde = document.getElementById('btn-mode-horde') as HTMLButtonElement;
const campaignStageBox = document.getElementById('campaign-stage-box')!;
const hordeInfoBox = document.getElementById('horde-info-box')!;
const menuSelectedStage = document.getElementById('menu-selected-stage')!;
const btnStagePrev = document.getElementById('btn-stage-prev') as HTMLButtonElement;
const btnStageNext = document.getElementById('btn-stage-next') as HTMLButtonElement;
const menuBestScore = document.getElementById('menu-best-score')!;
const menuBestHorde = document.getElementById('menu-best-horde')!;
const menuTotalKills = document.getElementById('menu-total-kills')!;
const menuMaxStage = document.getElementById('menu-max-stage')!;
const menuCoins = document.getElementById('menu-coins')!;
const menuCurrentTank = document.getElementById('menu-current-tank')!;
const btnOpenHangar = document.getElementById('btn-open-hangar')!;
const btnStart = document.getElementById('btn-start')!;
const btnInstall = document.getElementById('btn-install')!;
const offlineBadge = document.getElementById('offline-badge')!;
const btnMenuSound = document.getElementById('btn-menu-sound')!;

// HUD Action Buttons
const btnCamera = document.getElementById('btn-camera')!;
const btnTouchToggle = document.getElementById('btn-touch-toggle')!;
const btnSound = document.getElementById('btn-sound')!;
const btnPause = document.getElementById('btn-pause')!;
const btnResume = document.getElementById('btn-resume')!;
const btnPauseCamera = document.getElementById('btn-pause-camera')!;
const btnRestart = document.getElementById('btn-restart')!;
const btnQuit = document.getElementById('btn-quit')!;

// Victory & Game Over Elements
const victoryTitle = document.getElementById('victory-title')!;
const victoryBreakdown = document.getElementById('victory-breakdown')!;
const victoryCoinsEarned = document.getElementById('victory-coins-earned')!;
const victoryTotalScore = document.getElementById('victory-total-score')!;
const btnNextStage = document.getElementById('btn-next-stage')!;
const btnVictoryHangar = document.getElementById('btn-victory-hangar')!;

const gameoverReason = document.getElementById('gameover-reason')!;
const gameoverScore = document.getElementById('gameover-score')!;
const gameoverBest = document.getElementById('gameover-best')!;
const gameoverCoinsEarned = document.getElementById('gameover-coins-earned')!;
const newRecordBadge = document.getElementById('new-record-badge')!;
const btnRetry = document.getElementById('btn-retry')!;
const btnGameoverHangar = document.getElementById('btn-gameover-hangar')!;
const btnGameoverMenu = document.getElementById('btn-gameover-menu')!;

// Hangar Elements
const btnCloseHangar = document.getElementById('btn-close-hangar')!;
const hangarCoins = document.getElementById('hangar-coins')!;
const hangarClassTabs = document.getElementById('hangar-class-tabs')!;
const hangarTankName = document.getElementById('hangar-tank-name')!;
const hangarTankSub = document.getElementById('hangar-tank-sub')!;
const hangarTankDesc = document.getElementById('hangar-tank-desc')!;
const btnHangarAction = document.getElementById('btn-hangar-action') as HTMLButtonElement;
const hangarUpgradesList = document.getElementById('hangar-upgrades-list')!;
const hangarBaseInfo = document.getElementById('hangar-base-info')!;
const btnUpgradeBase = document.getElementById('btn-upgrade-base') as HTMLButtonElement;

// ============================================================================
// State
// ============================================================================

let currentMode: GameModeKind = 'campaign';
let selectedStage = storage.getData().unlockedStage;
let activeStage = 1;
let previewClass: TankClassId = storage.getData().selectedClass;
let bannerTimeout: number | null = null;

// Touch detection
const isCoarsePointer =
  window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
let showTouchControls =
  storage.getData().touchEnabled !== null ? Boolean(storage.getData().touchEnabled) : isCoarsePointer;

function cameraLabel(mode: CameraMode): string {
  switch (mode) {
    case 'angled':
      return '📷 Камера: Класична 3D';
    case 'top':
      return '📷 Камера: Вид зверху';
    case 'follow':
      return '📷 Камера: За танком';
  }
}

function syncSoundUi(): void {
  const muted = sound.isMuted();
  btnSound.textContent = muted ? '🔇' : '🔊';
  btnMenuSound.textContent = muted ? '🔇 Звук: Вимк' : '🔊 Звук: Увімк';
}

function syncTouchVisibility(inGameplay: boolean): void {
  touchControlsEl.classList.toggle('hidden', !(inGameplay && showTouchControls));
}

// ============================================================================
// Menu UI Refresh
// ============================================================================

function refreshMenuUi(): void {
  const save = storage.getData();
  if (selectedStage > save.unlockedStage) {
    selectedStage = save.unlockedStage;
  }

  menuCoins.textContent = `🪙 ${save.coins.toLocaleString('uk-UA')}`;
  menuBestScore.textContent = save.bestScore.toLocaleString('uk-UA');
  menuBestHorde.textContent = save.bestHordeWave.toLocaleString('uk-UA');
  menuTotalKills.textContent = save.totalKills.toLocaleString('uk-UA');
  menuMaxStage.textContent = String(save.unlockedStage);

  const spec = TANK_CLASSES[save.selectedClass] ?? TANK_CLASSES.allrounder;
  menuCurrentTank.textContent = spec.name;

  const info = getStageInfo(selectedStage);
  menuSelectedStage.textContent = `Рівень ${selectedStage} — ${info.name}`;
  btnStagePrev.disabled = selectedStage <= 1;
  btnStageNext.disabled = selectedStage >= save.unlockedStage;

  btnPauseCamera.textContent = cameraLabel(save.cameraMode);
  syncSoundUi();
}

function setGameMode(mode: GameModeKind): void {
  currentMode = mode;
  btnModeCampaign.classList.toggle('active', mode === 'campaign');
  btnModeHorde.classList.toggle('active', mode === 'horde');
  campaignStageBox.classList.toggle('hidden', mode === 'horde');
  hordeInfoBox.classList.toggle('hidden', mode === 'campaign');
}

// ============================================================================
// HUD Updates
// ============================================================================

function updateHud(state: HudState): void {
  activeStage = state.stageOrWave;
  hudStageLabel.textContent = state.mode === 'horde' ? 'ХВИЛЯ' : 'РІВЕНЬ';
  hudStage.textContent = String(state.stageOrWave);
  hudEnemies.textContent = String(state.enemiesRemaining);
  hudLives.textContent = `❤️ ${state.lives}`;
  hudCoins.textContent = `🪙 ${state.coins.toLocaleString('uk-UA')}`;
  hudScore.textContent = state.score.toLocaleString('uk-UA');
  hudBest.textContent = state.bestScore.toLocaleString('uk-UA');
  hudStars.textContent = '★ '.repeat(state.stars) + '☆ '.repeat(3 - state.stars);

  // Player Tank HP
  hudPlayerHpText.textContent = `${state.playerHp} / ${state.playerMaxHp}`;
  const pPct = Math.max(0, Math.min(100, (state.playerHp / state.playerMaxHp) * 100));
  hudPlayerHpFill.style.width = `${pPct}%`;

  // HQ Base HP
  hudBaseHpText.textContent = `${state.baseHp} / ${state.baseMaxHp}`;
  const bPct = Math.max(0, Math.min(100, (state.baseHp / state.baseMaxHp) * 100));
  hudBaseHpFill.style.width = `${bPct}%`;
  hudBaseCard.classList.toggle('critical', bPct <= 30);

  // Boss Health Bar
  if (state.bossName && state.bossHp > 0) {
    bossNameEl.textContent = `БОС: ${state.bossName}`;
    bossHpTextEl.textContent = `${state.bossHp} / ${state.bossMaxHp}`;
    const bossPct = Math.max(0, Math.min(100, (state.bossHp / state.bossMaxHp) * 100));
    bossHpFillEl.style.width = `${bossPct}%`;
    bossBarEl.classList.remove('hidden');
  } else {
    bossBarEl.classList.add('hidden');
  }

  // Active Buffs
  const pills: string[] = [];
  if (state.shieldTimer > 0) {
    pills.push(`<span class="buff-pill">🛡️ Щит: ${Math.ceil(state.shieldTimer)}с</span>`);
  }
  if (state.freezeTimer > 0) {
    pills.push(`<span class="buff-pill">⏱️ Заморозка: ${Math.ceil(state.freezeTimer)}с</span>`);
  }
  if (state.shovelTimer > 0) {
    pills.push(`<span class="buff-pill">🧱 Сталевий штаб: ${Math.ceil(state.shovelTimer)}с</span>`);
  }

  if (pills.length > 0) {
    buffsBarEl.innerHTML = pills.join('');
    buffsBarEl.classList.remove('hidden');
  } else {
    buffsBarEl.classList.add('hidden');
  }
}

function showStageIntro(stageOrWave: number, name: string): void {
  stageBannerSub.textContent = currentMode === 'horde' ? 'НЕСКІНЧЕННА ОРДА' : 'ПРИГОТУЙТЕСЬ ДО БОЮ';
  stageBannerTitle.textContent = currentMode === 'horde' ? `ХВИЛЯ ${stageOrWave}` : `РІВЕНЬ ${stageOrWave}`;
  stageBannerName.textContent = name;
  stageBannerEl.classList.remove('hidden');

  if (bannerTimeout) window.clearTimeout(bannerTimeout);
  bannerTimeout = window.setTimeout(() => {
    stageBannerEl.classList.add('hidden');
  }, 2000);
}

// ============================================================================
// Radar & Floating Numbers Layers
// ============================================================================

function renderRadar(indicators: RadarIndicator[]): void {
  radarLayerEl.innerHTML = '';
  for (const ind of indicators) {
    const marker = document.createElement('div');
    marker.className = `radar-marker ${ind.kind}${ind.urgent ? ' urgent' : ''}`;
    marker.style.left = `${ind.x}px`;
    marker.style.top = `${ind.y}px`;

    const icon = document.createElement('span');
    icon.className = 'radar-icon';
    icon.textContent = ind.kind === 'base' ? '🦅' : ind.kind === 'boss' ? '☠️' : '•';
    marker.appendChild(icon);

    const arrow = document.createElement('div');
    arrow.className = 'radar-arrow';
    arrow.style.transform = `rotate(${ind.angleRad}rad)`;
    marker.appendChild(arrow);

    radarLayerEl.appendChild(marker);
  }
}

function addFloatingText(item: FloatingTextItem): void {
  const el = document.createElement('div');
  el.className = `floating-text${item.big ? ' big' : ''}`;
  el.style.left = `${item.x}px`;
  el.style.top = `${item.y}px`;
  el.style.color = item.color;
  el.textContent = item.text;
  floatingLayerEl.appendChild(el);

  window.setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 900);
}

// ============================================================================
// 3D Hangar Logic
// ============================================================================

function refreshHangarUi(): void {
  const save = storage.getData();
  hangarCoins.textContent = `🪙 ${save.coins.toLocaleString('uk-UA')}`;

  const spec = TANK_CLASSES[previewClass] ?? TANK_CLASSES.allrounder;
  hangarTankName.textContent = spec.name;
  hangarTankSub.textContent = spec.subtitle;
  hangarTankDesc.textContent = spec.description;

  // Render Class Tabs
  hangarClassTabs.innerHTML = '';
  for (const cid of TANK_CLASS_ORDER) {
    const tabSpec = TANK_CLASSES[cid];
    const isUnlocked = save.unlockedClasses.includes(cid);
    const isSelected = save.selectedClass === cid;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `hangar-class-tab${cid === previewClass ? ' active' : ''}`;
    tab.innerHTML = `${isSelected ? '⭐ ' : !isUnlocked ? '🔒 ' : ''}${tabSpec.name.split(' ')[0]}`;
    tab.addEventListener('click', () => {
      sound.unlock();
      sound.playUiClick();
      previewClass = cid;
      game.showHangarPreview(previewClass);
      refreshHangarUi();
    });
    hangarClassTabs.appendChild(tab);
  }

  // Action Button (Unlock / Select / Selected)
  const isUnlocked = save.unlockedClasses.includes(previewClass);
  const isSelected = save.selectedClass === previewClass;

  if (!isUnlocked) {
    btnHangarAction.className = 'hangar-action-btn';
    btnHangarAction.disabled = save.coins < spec.unlockCost;
    btnHangarAction.textContent = `🔓 Відкрити за ${spec.unlockCost} 🪙`;
    btnHangarAction.onclick = () => {
      sound.unlock();
      if (storage.unlockClass(previewClass, spec.unlockCost)) {
        storage.selectClass(previewClass);
        sound.playPowerUpPickup();
        refreshHangarUi();
        refreshMenuUi();
      }
    };
  } else if (isSelected) {
    btnHangarAction.className = 'hangar-action-btn selected';
    btnHangarAction.disabled = true;
    btnHangarAction.textContent = '✓ Обрано';
    btnHangarAction.onclick = null;
  } else {
    btnHangarAction.className = 'hangar-action-btn';
    btnHangarAction.disabled = false;
    btnHangarAction.textContent = 'Обрати';
    btnHangarAction.onclick = () => {
      sound.unlock();
      sound.playUiClick();
      storage.selectClass(previewClass);
      refreshHangarUi();
      refreshMenuUi();
    };
  }

  // Upgrades List
  const upgrades = save.tankUpgrades[previewClass] ?? { armor: 0, damage: 0, fireRate: 0, speed: 0 };
  const statDefs: { key: keyof TankUpgradeLevels; label: string }[] = [
    { key: 'armor', label: 'Броня (HP)' },
    { key: 'damage', label: 'Вогнева міць' },
    { key: 'fireRate', label: 'Скорострільність' },
    { key: 'speed', label: 'Швидкість ходу' }
  ];

  hangarUpgradesList.innerHTML = '';
  for (const st of statDefs) {
    const lvl = upgrades[st.key] ?? 0;
    const cost = getUpgradeCost(lvl);
    const row = document.createElement('div');
    row.className = 'upgrade-row';

    let pipsHtml = '';
    for (let p = 0; p < MAX_UPGRADE_LEVEL; p++) {
      pipsHtml += `<div class="upgrade-pip${p < lvl ? ' filled' : ''}"></div>`;
    }

    const btnText = lvl >= MAX_UPGRADE_LEVEL ? 'МАКС' : `+1 • ${cost} 🪙`;
    const disabled = lvl >= MAX_UPGRADE_LEVEL || save.coins < cost;

    row.innerHTML = `
      <div class="upgrade-stat-info">
        <span class="upgrade-stat-name">${st.label} (Рів. ${lvl})</span>
        <div class="upgrade-pips">${pipsHtml}</div>
      </div>
      <button class="upgrade-btn" type="button" ${disabled ? 'disabled' : ''}>${btnText}</button>
    `;

    const upBtn = row.querySelector('.upgrade-btn') as HTMLButtonElement;
    upBtn.addEventListener('click', () => {
      sound.unlock();
      if (storage.upgradeTankStat(previewClass, st.key, cost)) {
        sound.playPowerUpPickup();
        refreshHangarUi();
        refreshMenuUi();
      }
    });

    hangarUpgradesList.appendChild(row);
  }

  // Base Fortification
  const baseLvl = save.baseHpLevel ?? 0;
  const baseCost = getBaseUpgradeCost(baseLvl);
  const baseHp = computeBaseMaxHp(baseLvl);
  hangarBaseInfo.textContent = `Рівень ${baseLvl} / ${MAX_UPGRADE_LEVEL} (${baseHp} HP)`;

  if (baseLvl >= MAX_UPGRADE_LEVEL) {
    btnUpgradeBase.textContent = 'МАКС';
    btnUpgradeBase.disabled = true;
    btnUpgradeBase.onclick = null;
  } else {
    btnUpgradeBase.textContent = `Укріпити • ${baseCost} 🪙`;
    btnUpgradeBase.disabled = save.coins < baseCost;
    btnUpgradeBase.onclick = () => {
      sound.unlock();
      if (storage.upgradeBaseHp(baseCost)) {
        sound.playRepair();
        refreshHangarUi();
        refreshMenuUi();
      }
    };
  }
}

function openHangar(): void {
  sound.unlock();
  sound.playUiClick();
  menuScreen.classList.add('hidden');
  victoryScreen.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  hudEl.classList.add('hidden');
  syncTouchVisibility(false);

  previewClass = storage.getData().selectedClass;
  hangarScreen.classList.remove('hidden');
  game.showHangarPreview(previewClass);
  refreshHangarUi();
}

function closeHangar(): void {
  sound.unlock();
  sound.playUiClick();
  hangarScreen.classList.add('hidden');
  refreshMenuUi();
  menuScreen.classList.remove('hidden');
  game.showMenuPreview(selectedStage);
}

// ============================================================================
// Initialize 3D Engine & Callbacks
// ============================================================================

const game = new TankGame3D(canvas, input, sound, storage, {
  onHudUpdate: updateHud,
  onStageIntro: showStageIntro,
  onRadarUpdate: renderRadar,
  onFloatingText: addFloatingText,
  onPauseChanged: (paused) => {
    pauseScreen.classList.toggle('hidden', !paused);
    syncTouchVisibility(!paused);
  },
  onStageVictory: (stage, kills: StageKills, totalScore, coinsEarned) => {
    syncTouchVisibility(false);
    buffsBarEl.classList.add('hidden');
    bossBarEl.classList.add('hidden');
    radarLayerEl.innerHTML = '';

    victoryTitle.textContent = `РІВЕНЬ ${stage} ПРОЙДЕНО!`;
    victoryTotalScore.textContent = totalScore.toLocaleString('uk-UA');
    victoryCoinsEarned.textContent = `+${coinsEarned} 🪙`;

    const rows = [
      { label: 'Звичайні танки (100)', count: kills.basic, pts: kills.basic * 100 },
      { label: 'Швидкі БТР (200)', count: kills.fast, pts: kills.fast * 200 },
      { label: 'Стрільці (300)', count: kills.power, pts: kills.power * 300 },
      { label: 'Важкі броньовані (400)', count: kills.armor, pts: kills.armor * 400 },
      ...(kills.boss > 0 ? [{ label: '☠️ БОС', count: kills.boss, pts: kills.boss * 2500 }] : [])
    ];

    victoryBreakdown.innerHTML = rows
      .map(
        (r) => `
      <div class="breakdown-row">
        <span>${r.label} × ${r.count}</span>
        <strong>+${r.pts}</strong>
      </div>`
      )
      .join('');

    victoryScreen.classList.remove('hidden');
  },
  onGameOver: (reason, score, bestScore, isNewRecord, coinsEarned) => {
    syncTouchVisibility(false);
    buffsBarEl.classList.add('hidden');
    bossBarEl.classList.add('hidden');
    radarLayerEl.innerHTML = '';

    gameoverReason.textContent = reason;
    gameoverScore.textContent = score.toLocaleString('uk-UA');
    gameoverBest.textContent = bestScore.toLocaleString('uk-UA');
    gameoverCoinsEarned.textContent = `+${coinsEarned} 🪙`;
    newRecordBadge.classList.toggle('hidden', !isNewRecord);

    gameoverScreen.classList.remove('hidden');
  }
});

// ============================================================================
// UI Event Handlers
// ============================================================================

refreshMenuUi();
game.showMenuPreview(selectedStage);

// Mode switcher
btnModeCampaign.addEventListener('click', () => {
  sound.unlock();
  sound.playUiClick();
  setGameMode('campaign');
});

btnModeHorde.addEventListener('click', () => {
  sound.unlock();
  sound.playUiClick();
  setGameMode('horde');
});

// Campaign Stage Selector
btnStagePrev.addEventListener('click', () => {
  sound.unlock();
  sound.playUiClick();
  if (selectedStage > 1) {
    selectedStage -= 1;
    refreshMenuUi();
    game.showMenuPreview(selectedStage);
  }
});

btnStageNext.addEventListener('click', () => {
  sound.unlock();
  sound.playUiClick();
  if (selectedStage < storage.getData().unlockedStage) {
    selectedStage += 1;
    refreshMenuUi();
    game.showMenuPreview(selectedStage);
  }
});

// Sound toggles
const toggleSound = () => {
  const next = !sound.isMuted();
  sound.setMuted(next);
  storage.setMuted(next);
  if (!next) {
    sound.unlock();
    sound.playUiClick();
  }
  syncSoundUi();
};

btnSound.addEventListener('click', toggleSound);
btnMenuSound.addEventListener('click', toggleSound);

// Camera toggles
const cycleCamera = () => {
  const mode = game.cycleCameraMode();
  btnPauseCamera.textContent = cameraLabel(mode);
};
btnCamera.addEventListener('click', cycleCamera);
btnPauseCamera.addEventListener('click', cycleCamera);

// Touch Toggle
btnTouchToggle.addEventListener('click', () => {
  sound.playUiClick();
  showTouchControls = !showTouchControls;
  storage.setTouchEnabled(showTouchControls);
  syncTouchVisibility(pauseScreen.classList.contains('hidden'));
});

// Pause controls
btnPause.addEventListener('click', () => {
  sound.playUiClick();
  game.setPaused(true);
});

btnResume.addEventListener('click', () => {
  sound.playUiClick();
  game.setPaused(false);
});

btnRestart.addEventListener('click', () => {
  sound.playUiClick();
  pauseScreen.classList.add('hidden');
  syncTouchVisibility(true);
  if (currentMode === 'horde') {
    game.startHordeRun();
  } else {
    game.startStage(activeStage);
  }
});

const returnToMenu = () => {
  sound.playUiClick();
  pauseScreen.classList.add('hidden');
  victoryScreen.classList.add('hidden');
  gameoverScreen.classList.add('hidden');
  hangarScreen.classList.add('hidden');
  hudEl.classList.add('hidden');
  buffsBarEl.classList.add('hidden');
  bossBarEl.classList.add('hidden');
  stageBannerEl.classList.add('hidden');
  radarLayerEl.innerHTML = '';
  syncTouchVisibility(false);

  selectedStage = storage.getData().unlockedStage;
  refreshMenuUi();
  menuScreen.classList.remove('hidden');
  game.showMenuPreview(selectedStage);
};

btnQuit.addEventListener('click', returnToMenu);
btnGameoverMenu.addEventListener('click', returnToMenu);

// Start game
btnStart.addEventListener('click', () => {
  sound.unlock();
  sound.playUiClick();
  menuScreen.classList.add('hidden');
  hudEl.classList.remove('hidden');
  syncTouchVisibility(true);

  if (currentMode === 'horde') {
    game.startHordeRun();
  } else {
    game.startCampaignRun(selectedStage);
  }
});

// Next Stage & Retry
btnNextStage.addEventListener('click', () => {
  sound.playUiClick();
  victoryScreen.classList.add('hidden');
  syncTouchVisibility(true);
  game.startStage(activeStage + 1);
});

btnRetry.addEventListener('click', () => {
  sound.playUiClick();
  gameoverScreen.classList.add('hidden');
  syncTouchVisibility(true);
  if (currentMode === 'horde') {
    game.startHordeRun();
  } else {
    game.startCampaignRun(activeStage);
  }
});

// Hangar buttons
btnOpenHangar.addEventListener('click', openHangar);
btnVictoryHangar.addEventListener('click', openHangar);
btnGameoverHangar.addEventListener('click', openHangar);
btnCloseHangar.addEventListener('click', closeHangar);

// ============================================================================
// PWA Install Prompt Handling & SW Registration
// ============================================================================

let deferredPrompt: BeforeInstallPromptEvent | null = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  btnInstall.classList.remove('hidden');
});

btnInstall.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  sound.playUiClick();
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  if (choice.outcome === 'accepted') {
    btnInstall.classList.add('hidden');
  }
  deferredPrompt = null;
});

window.addEventListener('appinstalled', () => {
  btnInstall.classList.add('hidden');
  deferredPrompt = null;
});

registerSW({
  immediate: true,
  onOfflineReady() {
    offlineBadge.textContent = '✓ Готово до гри офлайн';
  }
});
