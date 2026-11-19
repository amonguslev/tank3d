export type Direction = 'up' | 'down' | 'left' | 'right';

export interface MoveVector {
  x: number;
  z: number;
}

export interface TouchAimVector {
  x: number;
  z: number;
}

export interface MouseNdc {
  x: number;
  y: number;
}

export interface WotInputSnapshot {
  throttle: number; // -1 (назад S) .. +1 (вперед W)
  steer: number; // -1 (вправо D) .. +1 (вліво A); steer > 0 = поворот вліво (A), steer < 0 = поворот вправо (D)
  cameraYaw: number; // кут камери по горизонталі в радіанах
  cameraPitch: number; // кут нахилу камери по вертикалі в радіанах (обмежений: -0.35 .. +0.55)
  isSniper: boolean; // чи увімкнений снайперський приціл
  sniperZoom: 2 | 4; // кратність зуму в снайперському режимі
  firing: boolean; // чи затиснутий вогонь (ЛКМ або Пробіл або сенсорна кнопка)
  weaponSlotRequest: 1 | 2 | null; // одноразовий запит перемикання гармати (Digit1, Digit2, Q)
  repairRequest: boolean; // одноразовий запит ремкомплекту (Digit3, R, F)
  pauseRequest: boolean; // одноразовий запит паузи (Escape, P)
  pointerLocked: boolean; // чи захоплений курсор Pointer Lock
  touchMode: boolean; // чи активний сенсорний режим
  mouseNdc?: { x: number; y: number } | null;
}

export class InputManager {
  // Callbacks
  onPauseToggle: (() => void) | null = null;
  onCameraToggle: (() => void) | null = null;
  onAnyInteraction: (() => void) | null = null;

  // State flags
  private gameplayActive = false;
  private pointerLocked = false;
  private touchDetected = false;
  private touchOverride: boolean | null = null;

  // World of Tanks Camera & Aim angles
  private cameraYaw = 0; // Horizontal orbit angle in radians
  private cameraPitch = 0.18; // Vertical tilt angle (min -0.35, max +0.55)
  private isSniper = false;
  private sniperZoom: 2 | 4 = 2;

  // Active weapon & single-shot requests
  private currentWeaponSlot: 1 | 2 = 1;
  private weaponSlotRequest: 1 | 2 | null = null;
  private repairRequest = false;
  private pauseRequest = false;

  // Keyboard keys
  private keysPressed: Set<string> = new Set();
  private keyFire = false;

  // Mouse controls
  private canvas: HTMLCanvasElement | null = null;
  private mouseFire = false;
  private isMouseDown = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private mouseNdc: MouseNdc | null = null;
  private mouseAimActive = false;

  // Touch analog move stick
  private moveStickZone: HTMLElement | null = null;
  private moveStickBase: HTMLElement | null = null;
  private moveStickKnob: HTMLElement | null = null;
  private movePointerId: number | null = null;
  private touchThrottle = 0;
  private touchSteer = 0;

  // Touch look rotation
  private touchLookZone: HTMLElement | null = null;
  private lookPointerId: number | null = null;
  private lastLookX = 0;
  private lastLookY = 0;

  // Touch UI fire button
  private touchFire = false;

  // Legacy fire queue & quick tap support
  private fireQueued = false;
  private autoAimTap = false;

  constructor() {
    this.detectTouchSupport();
    this.resolveDomElements();
    this.bindEvents();
  }

  private detectTouchSupport(): void {
    if (typeof window !== 'undefined') {
      if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
        this.touchDetected = true;
      }
    }
  }

  private resolveDomElements(): void {
    if (typeof document === 'undefined') return;

    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;

    // Left analog stick elements
    this.moveStickZone =
      document.getElementById('stick-move-zone') ||
      document.querySelector('.left-stick-zone');
    this.moveStickBase =
      document.getElementById('stick-move-base') ||
      document.getElementById('move-stick-base') ||
      document.getElementById('dpad-base');
    this.moveStickKnob =
      document.getElementById('stick-move-knob') ||
      document.getElementById('move-stick-knob') ||
      document.getElementById('dpad-knob');

    // Right look zone
    this.touchLookZone =
      document.getElementById('touch-look-zone') ||
      document.getElementById('aim-stick-base') ||
      document.querySelector('.right-stick-zone');
  }

  private bindEvents(): void {
    this.bindKeyboard();
    this.bindMouse();
    this.bindPointerLock();
    this.bindTouchControls();
  }

  // --- Keyboard handlers ---
  private bindKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      this.onAnyInteraction?.();

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (!e.repeat) {
          this.pauseRequest = true;
          this.onPauseToggle?.();
        }
        return;
      }

      if (e.code === 'KeyC') {
        if (!e.repeat) this.onCameraToggle?.();
        return;
      }

      // Sniper scope toggle (Shift)
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (!e.repeat) {
          e.preventDefault();
          this.toggleSniperMode();
        }
        return;
      }

      // Weapon slot selection (1 = Main Gun, 2 = Rear Mini-Artillery, Q = Alternate)
      if (e.code === 'Digit1') {
        this.weaponSlotRequest = 1;
        this.currentWeaponSlot = 1;
        return;
      }
      if (e.code === 'Digit2') {
        this.weaponSlotRequest = 2;
        this.currentWeaponSlot = 2;
        return;
      }
      if (e.code === 'KeyQ') {
        if (!e.repeat) {
          const nextSlot: 1 | 2 = this.currentWeaponSlot === 1 ? 2 : 1;
          this.weaponSlotRequest = nextSlot;
          this.currentWeaponSlot = nextSlot;
        }
        return;
      }

      // Repair kit request (3, R, F)
      if (e.code === 'Digit3' || e.code === 'KeyR' || e.code === 'KeyF') {
        if (!e.repeat) {
          this.repairRequest = true;
        }
        return;
      }

      // Fire trigger (Space, Enter, Z)
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyZ') {
        e.preventDefault();
        this.keyFire = true;
        if (!e.repeat) this.fireQueued = true;
        return;
      }

      // Driving controls (WASD & Arrows)
      if (
        e.code === 'KeyW' ||
        e.code === 'KeyS' ||
        e.code === 'KeyA' ||
        e.code === 'KeyD' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        e.preventDefault();
        this.keysPressed.add(e.code);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyZ') {
        this.keyFire = false;
        return;
      }
      this.keysPressed.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.reset();
    });
  }

  // --- Mouse & Pointer Lock handlers ---
  private bindMouse(): void {
    const canvas = this.getCanvas();

    const updateNdc = (clientX: number, clientY: number) => {
      const c = this.getCanvas();
      if (!c) return;
      const rect = c.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      this.mouseNdc = { x: ndcX, y: ndcY };
      this.mouseAimActive = true;
    };

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
        updateNdc(e.clientX, e.clientY);

        // When pointer is locked: movementX / movementY control camera angles
        if (this.pointerLocked) {
          const sens = this.isSniper ? 0.0022 / this.sniperZoom : 0.0022;
          this.cameraYaw -= e.movementX * sens;
          this.cameraPitch = Math.max(
            -0.35,
            Math.min(0.55, this.cameraPitch - e.movementY * sens)
          );
        } else if (this.isMouseDown && this.gameplayActive) {
          // Fallback camera rotation if pointer lock is not engaged
          const dx = e.clientX - this.lastMouseX;
          const dy = e.clientY - this.lastMouseY;
          this.lastMouseX = e.clientX;
          this.lastMouseY = e.clientY;

          const sens = this.isSniper ? 0.0022 / this.sniperZoom : 0.0022;
          this.cameraYaw -= dx * sens;
          this.cameraPitch = Math.max(
            -0.35,
            Math.min(0.55, this.cameraPitch - dy * sens)
          );
        }
      }
    });

    if (canvas) {
      canvas.addEventListener('pointerdown', (e) => {
        this.onAnyInteraction?.();
        if (e.pointerType === 'mouse') {
          updateNdc(e.clientX, e.clientY);
          this.isMouseDown = true;
          this.lastMouseX = e.clientX;
          this.lastMouseY = e.clientY;

          // Request pointer lock on click during gameplay
          if (this.gameplayActive) {
            this.requestPointerLockSafe();
          }

          if (e.button === 0) {
            // Left click: Fire
            this.mouseFire = true;
            this.fireQueued = true;
          } else if (e.button === 2) {
            // Right click: Sniper toggle
            e.preventDefault();
            this.toggleSniperMode();
          }
        }
      });
    }

    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 0) {
          this.mouseFire = false;
        }
        this.isMouseDown = false;
      }
    });

    // Prevent default context menu during battle
    window.addEventListener('contextmenu', (e) => {
      if (this.gameplayActive || this.pointerLocked) {
        e.preventDefault();
      }
    });

    // Mouse wheel: WoT authentic sniper zoom in / zoom out
    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.gameplayActive) return;
        e.preventDefault();

        if (e.deltaY < 0) {
          // Wheel Up: enter sniper mode (x2 -> x4)
          if (!this.isSniper) {
            this.isSniper = true;
            this.sniperZoom = 2;
          } else if (this.sniperZoom === 2) {
            this.sniperZoom = 4;
          }
        } else if (e.deltaY > 0) {
          // Wheel Down: reduce zoom (x4 -> x2 -> exit sniper)
          if (this.isSniper && this.sniperZoom === 4) {
            this.sniperZoom = 2;
          } else if (this.isSniper && this.sniperZoom === 2) {
            this.isSniper = false;
          }
        }
      },
      { passive: false }
    );
  }

  private bindPointerLock(): void {
    const handlePointerLockChange = () => {
      const canvas = this.getCanvas();
      this.pointerLocked = !!canvas && document.pointerLockElement === canvas;
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('mozpointerlockchange', handlePointerLockChange);
    document.addEventListener('webkitpointerlockchange', handlePointerLockChange);
  }

  private requestPointerLockSafe(): void {
    const canvas = this.getCanvas();
    if (!canvas) return;
    if (this.isTouchActive()) return;

    try {
      if (document.pointerLockElement !== canvas) {
        const req = canvas.requestPointerLock();
        if (req && typeof (req as Promise<void>).catch === 'function') {
          (req as Promise<void>).catch(() => {});
        }
      }
    } catch {
      // Safe fallback
    }
  }

  // --- Touch Controls for WoT Blitz style mobile gameplay ---
  private bindTouchControls(): void {
    this.resolveDomElements();

    // 1. Left Move Stick
    const base = this.moveStickBase;
    if (base) {
      const handleMove = (clientX: number, clientY: number) => {
        const rect = base.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = clientX - cx;
        const dy = clientY - cy;
        const dist = Math.hypot(dx, dy);
        const maxRadius = rect.width * 0.4;

        if (dist < 6) {
          this.touchThrottle = 0;
          this.touchSteer = 0;
          if (this.moveStickKnob) {
            this.moveStickKnob.style.transform = 'translate(0px, 0px)';
          }
          return;
        }

        const clampedDist = Math.min(dist, maxRadius);
        const intensity = clampedDist / maxRadius;
        const nx = dx / dist;
        const ny = dy / dist;

        // Invert Y for throttle: dragging forward (up) is positive throttle
        // Invert X for steer: dragging left (A) is positive steer > 0, right is negative steer < 0
        this.touchThrottle = -ny * intensity;
        this.touchSteer = -nx * intensity;

        if (this.moveStickKnob) {
          const kx = nx * clampedDist;
          const ky = ny * clampedDist;
          this.moveStickKnob.style.transform = `translate(${kx.toFixed(1)}px, ${ky.toFixed(1)}px)`;
        }
      };

      base.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'mouse') {
          this.touchDetected = true;
          this.mouseAimActive = false;
        }
        e.preventDefault();
        this.onAnyInteraction?.();
        this.movePointerId = e.pointerId;

        try {
          base.setPointerCapture(e.pointerId);
        } catch {
          // Safe fallback
        }
        handleMove(e.clientX, e.clientY);
      });

      base.addEventListener('pointermove', (e) => {
        if (e.pointerId !== this.movePointerId) return;
        e.preventDefault();
        handleMove(e.clientX, e.clientY);
      });

      const releaseMove = (e: PointerEvent) => {
        if (e.pointerId !== this.movePointerId) return;
        this.movePointerId = null;
        this.touchThrottle = 0;
        this.touchSteer = 0;
        if (this.moveStickKnob) {
          this.moveStickKnob.style.transform = 'translate(0px, 0px)';
        }
      };

      base.addEventListener('pointerup', releaseMove);
      base.addEventListener('pointercancel', releaseMove);
    }

    // 2. Right Look Touch Zone (free finger dragging rotates camera yaw & pitch)
    const setupLookZone = (element: HTMLElement | null) => {
      if (!element) return;

      element.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        this.touchDetected = true;
        this.mouseAimActive = false;
        this.onAnyInteraction?.();

        if (this.lookPointerId === null) {
          this.lookPointerId = e.pointerId;
          this.lastLookX = e.clientX;
          this.lastLookY = e.clientY;
          try {
            element.setPointerCapture(e.pointerId);
          } catch {
            // Safe fallback
          }
        }
      });

      element.addEventListener('pointermove', (e) => {
        if (e.pointerId !== this.lookPointerId) return;
        const dx = e.clientX - this.lastLookX;
        const dy = e.clientY - this.lastLookY;
        this.lastLookX = e.clientX;
        this.lastLookY = e.clientY;

        const sens = this.isSniper ? 0.005 / this.sniperZoom : 0.005;
        this.cameraYaw -= dx * sens;
        this.cameraPitch = Math.max(
          -0.35,
          Math.min(0.55, this.cameraPitch - dy * sens)
        );
      });

      const releaseLook = (e: PointerEvent) => {
        if (e.pointerId === this.lookPointerId) {
          this.lookPointerId = null;
        }
      };

      element.addEventListener('pointerup', releaseLook);
      element.addEventListener('pointercancel', releaseLook);
    };

    if (this.touchLookZone) {
      setupLookZone(this.touchLookZone);
    }

    // Window fallback for touch look on right half of screen when not touching buttons
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') {
        this.touchDetected = true;
        this.mouseAimActive = false;

        // If touch starts on right half of screen, outside left stick
        if (
          e.clientX > window.innerWidth * 0.45 &&
          this.lookPointerId === null &&
          this.gameplayActive
        ) {
          const target = e.target as HTMLElement | null;
          if (target && !target.closest('button, .hud, .modal-title, .panel')) {
            this.lookPointerId = e.pointerId;
            this.lastLookX = e.clientX;
            this.lastLookY = e.clientY;
          }
        }
      }
    });
  }

  private toggleSniperMode(): void {
    this.isSniper = !this.isSniper;
    if (this.isSniper && !this.sniperZoom) {
      this.sniperZoom = 2;
    }
  }

  private getCanvas(): HTMLCanvasElement | null {
    if (!this.canvas && typeof document !== 'undefined') {
      this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    }
    return this.canvas;
  }

  // --- Public Methods ---

  /**
   * Consumes and returns current World of Tanks control snapshot.
   * Automatically clears single-shot request flags.
   */
  consumeSnapshot(): WotInputSnapshot {
    // 1. Calculate throttle (-1..+1)
    let throttle = 0;
    if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) throttle += 1;
    if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) throttle -= 1;
    if (Math.abs(this.touchThrottle) > 0.05) {
      throttle = this.touchThrottle;
    }

    // 2. Calculate steer (-1..+1)
    // steer > 0 = turn left (KeyA), steer < 0 = turn right (KeyD)
    let steer = 0;
    if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) steer += 1;
    if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) steer -= 1;
    if (Math.abs(this.touchSteer) > 0.05) {
      steer = this.touchSteer;
    }

    const snapshot: WotInputSnapshot = {
      throttle: Math.max(-1, Math.min(1, throttle)),
      steer: Math.max(-1, Math.min(1, steer)),
      cameraYaw: this.cameraYaw,
      cameraPitch: this.cameraPitch,
      isSniper: this.isSniper,
      sniperZoom: this.sniperZoom,
      firing: this.isFiring(),
      weaponSlotRequest: this.weaponSlotRequest,
      repairRequest: this.repairRequest,
      pauseRequest: this.pauseRequest,
      pointerLocked: this.pointerLocked,
      touchMode: this.isTouchActive(),
      mouseNdc: this.mouseNdc ? { ...this.mouseNdc } : null
    };

    // Reset single-shot flags
    this.weaponSlotRequest = null;
    this.repairRequest = false;
    this.pauseRequest = false;
    this.fireQueued = false;
    this.autoAimTap = false;

    return snapshot;
  }

  /**
   * Activates or deactivates gameplay mode.
   * When deactivated, releases pointer lock and resets keys.
   */
  setGameplayActive(active: boolean): void {
    this.gameplayActive = active;
    if (!active) {
      this.reset();
      if (typeof document !== 'undefined' && document.pointerLockElement) {
        try {
          document.exitPointerLock?.();
        } catch {
          // Safe fallback
        }
      }
    }
  }

  /**
   * Manually override or reset camera angles (in radians).
   */
  resetCameraAngles(yaw = 0, pitch = 0.18): void {
    this.cameraYaw = yaw;
    this.cameraPitch = Math.max(-0.35, Math.min(0.55, pitch));
  }

  /**
   * Cycles mobile touch sniper mode: 3rd person -> Zoom x2 -> Zoom x4 -> 3rd person.
   */
  toggleSniperTouch(): void {
    if (!this.isSniper) {
      this.isSniper = true;
      this.sniperZoom = 2;
    } else if (this.sniperZoom === 2) {
      this.sniperZoom = 4;
    } else {
      this.isSniper = false;
      this.sniperZoom = 2;
    }
  }

  /**
   * UI touch button fire triggers.
   */
  triggerFireStart(): void {
    this.onAnyInteraction?.();
    this.touchFire = true;
    this.fireQueued = true;
  }

  triggerFireEnd(): void {
    this.touchFire = false;
  }

  /**
   * One-time weapon slot request from UI buttons.
   */
  requestWeaponSlot(slot: 1 | 2): void {
    this.weaponSlotRequest = slot;
    this.currentWeaponSlot = slot;
  }

  /**
   * Updates internal weapon slot tracker (for KeyQ alternating toggle).
   */
  setCurrentWeaponSlot(slot: 1 | 2): void {
    this.currentWeaponSlot = slot;
  }

  /**
   * Request repair kit usage.
   */
  requestRepair(): void {
    this.repairRequest = true;
  }

  /**
   * Configure touch override (true, false, or null for auto-detect).
   */
  setTouchOverride(enabled: boolean | null): void {
    this.touchOverride = enabled;
  }

  isTouchActive(): boolean {
    if (this.touchOverride !== null) return this.touchOverride;
    return this.touchDetected;
  }

  isFiring(): boolean {
    return this.keyFire || this.mouseFire || this.touchFire || this.fireQueued;
  }

  // --- Backward Compatibility Helpers ---

  getMoveVector(): MoveVector {
    let dx = 0;
    let dz = 0;

    if (this.keysPressed.has('ArrowRight') || this.keysPressed.has('KeyD')) dx += 1;
    if (this.keysPressed.has('ArrowLeft') || this.keysPressed.has('KeyA')) dx -= 1;
    if (this.keysPressed.has('ArrowDown') || this.keysPressed.has('KeyS')) dz += 1;
    if (this.keysPressed.has('ArrowUp') || this.keysPressed.has('KeyW')) dz -= 1;

    if (Math.abs(this.touchThrottle) > 0.05 || Math.abs(this.touchSteer) > 0.05) {
      dx = -this.touchSteer;
      dz = -this.touchThrottle;
    }

    if (dx !== 0 && dz !== 0) {
      dx *= Math.SQRT1_2;
      dz *= Math.SQRT1_2;
    }

    return { x: dx, z: dz };
  }

  getMouseNdc(): MouseNdc | null {
    return this.mouseNdc;
  }

  isMouseAimActive(): boolean {
    return this.mouseAimActive;
  }

  getTouchAimVector(): TouchAimVector | null {
    if (this.lookPointerId !== null) {
      return {
        x: Math.sin(-this.cameraYaw),
        z: -Math.cos(this.cameraYaw)
      };
    }
    return null;
  }

  isFireHeld(): boolean {
    return this.isFiring();
  }

  consumeAutoAimTap(): boolean {
    if (this.autoAimTap) {
      this.autoAimTap = false;
      return true;
    }
    return false;
  }

  consumeFire(): boolean {
    if (this.fireQueued) {
      this.fireQueued = false;
      return true;
    }
    return this.isFiring();
  }

  getDirection(): Direction | null {
    const mv = this.getMoveVector();
    const lenSq = mv.x * mv.x + mv.z * mv.z;
    if (lenSq < 0.08) return null;

    if (Math.abs(mv.x) > Math.abs(mv.z)) {
      return mv.x > 0 ? 'right' : 'left';
    } else {
      return mv.z > 0 ? 'down' : 'up';
    }
  }

  reset(): void {
    this.keysPressed.clear();
    this.keyFire = false;
    this.mouseFire = false;
    this.isMouseDown = false;
    this.fireQueued = false;
    this.autoAimTap = false;
    this.touchFire = false;

    this.touchThrottle = 0;
    this.touchSteer = 0;
    this.movePointerId = null;
    this.lookPointerId = null;

    if (this.moveStickKnob) {
      this.moveStickKnob.style.transform = 'translate(0px, 0px)';
    }
  }
}
