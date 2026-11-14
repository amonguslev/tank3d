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

export class InputManager {
  // Callbacks
  onPauseToggle: (() => void) | null = null;
  onCameraToggle: (() => void) | null = null;
  onAnyInteraction: (() => void) | null = null;

  // Keyboard movement
  private keysPressed: Set<string> = new Set();
  private keyFire = false;

  // Mouse aim & fire
  private canvas: HTMLCanvasElement | null = null;
  private mouseNdc: MouseNdc | null = null;
  private mouseAimActive = false;
  private mouseFire = false;

  // Virtual Analog Move Stick
  private moveStickBase: HTMLElement | null = null;
  private moveStickKnob: HTMLElement | null = null;
  private movePointerId: number | null = null;
  private touchMoveVector: MoveVector = { x: 0, z: 0 };

  // Virtual Brawl Stars Aim Stick
  private aimStickBase: HTMLElement | null = null;
  private aimStickKnob: HTMLElement | null = null;
  private aimPointerId: number | null = null;
  private touchAimVector: TouchAimVector | null = null;
  private aimStartTime = 0;
  private aimMaxDragDist = 0;
  private autoAimTap = false;

  // Legacy fire queue support
  private fireQueued = false;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    this.moveStickBase = document.getElementById('move-stick-base') || document.getElementById('dpad-base');
    this.moveStickKnob = document.getElementById('move-stick-knob') || document.getElementById('dpad-knob');
    this.aimStickBase = document.getElementById('aim-stick-base') || document.getElementById('btn-fire');
    this.aimStickKnob = document.getElementById('aim-stick-knob');

    this.bindKeyboard();
    this.bindMouseAim();
    this.bindMoveStick();
    this.bindAimStick();
  }

  /**
   * Returns normalized movement vector with length 0..1 (x right +1, z down +1 / up -1).
   * Prioritizes active touch analog stick; falls back to keyboard WASD / Arrows.
   */
  getMoveVector(): MoveVector {
    const touchMagSq = this.touchMoveVector.x * this.touchMoveVector.x + this.touchMoveVector.z * this.touchMoveVector.z;
    if (touchMagSq > 0.0025) {
      return { x: this.touchMoveVector.x, z: this.touchMoveVector.z };
    }

    let dx = 0;
    let dz = 0;

    if (this.keysPressed.has('ArrowRight') || this.keysPressed.has('KeyD')) dx += 1;
    if (this.keysPressed.has('ArrowLeft') || this.keysPressed.has('KeyA')) dx -= 1;
    if (this.keysPressed.has('ArrowDown') || this.keysPressed.has('KeyS')) dz += 1;
    if (this.keysPressed.has('ArrowUp') || this.keysPressed.has('KeyW')) dz -= 1;

    if (dx !== 0 && dz !== 0) {
      dx *= Math.SQRT1_2;
      dz *= Math.SQRT1_2;
    }

    return { x: dx, z: dz };
  }

  /**
   * Returns current mouse NDC coordinates (-1..+1) on the game canvas, or null if outside.
   */
  getMouseNdc(): MouseNdc | null {
    return this.mouseNdc;
  }

  /**
   * Returns true if mouse aiming is currently active on PC.
   * Resets to false whenever touch controls are used.
   */
  isMouseAimActive(): boolean {
    return this.mouseAimActive;
  }

  /**
   * Returns normalized 360° touch aim direction when right stick is dragged beyond 16px, or null otherwise.
   */
  getTouchAimVector(): TouchAimVector | null {
    return this.touchAimVector;
  }

  /**
   * Returns true if player is holding continuous fire:
   * - Left mouse button on canvas
   * - Space / Enter keys on keyboard
   * - Dragging right touch stick beyond 16px threshold
   */
  isFireHeld(): boolean {
    return this.keyFire || this.mouseFire || this.touchAimVector !== null;
  }

  /**
   * Single-shot trigger for Brawl Stars quick-tap auto-aim (released < 240ms without dragging > 18px).
   * Consumes and clears the flag on call.
   */
  consumeAutoAimTap(): boolean {
    if (this.autoAimTap) {
      this.autoAimTap = false;
      return true;
    }
    return false;
  }

  /**
   * Consumes a single shot request (queued or auto-tap) or returns true if fire is held.
   * Provides full backward compatibility with classic firing loop.
   */
  consumeFire(): boolean {
    if (this.consumeAutoAimTap()) {
      return true;
    }
    if (this.fireQueued) {
      this.fireQueued = false;
      return true;
    }
    return this.isFireHeld();
  }

  /**
   * Direction helper for backward compatibility with 4-way systems.
   */
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

  /**
   * Resets all active inputs and visual states (e.g. on pause, blur, or round transition).
   */
  reset(): void {
    this.keysPressed.clear();
    this.keyFire = false;
    this.mouseFire = false;
    this.fireQueued = false;
    this.autoAimTap = false;

    this.movePointerId = null;
    this.touchMoveVector = { x: 0, z: 0 };
    if (this.moveStickKnob) {
      this.moveStickKnob.style.transform = 'translate(0px, 0px)';
    }

    this.aimPointerId = null;
    this.touchAimVector = null;
    if (this.aimStickKnob) {
      this.aimStickKnob.style.transform = 'translate(0px, 0px)';
    }
    if (this.aimStickBase) {
      this.aimStickBase.classList.remove('active');
    }
  }

  // --- Keyboard handlers ---
  private bindKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      this.onAnyInteraction?.();

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (!e.repeat) this.onPauseToggle?.();
        return;
      }
      if (e.code === 'KeyC') {
        if (!e.repeat) this.onCameraToggle?.();
        return;
      }

      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyJ' || e.code === 'KeyZ') {
        e.preventDefault();
        this.keyFire = true;
        if (!e.repeat) this.fireQueued = true;
        return;
      }

      if (
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'KeyW' ||
        e.code === 'KeyS' ||
        e.code === 'KeyA' ||
        e.code === 'KeyD'
      ) {
        e.preventDefault();
        this.keysPressed.add(e.code);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyJ' || e.code === 'KeyZ') {
        this.keyFire = false;
        return;
      }
      this.keysPressed.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.reset();
    });
  }

  // --- PC Mouse Aim handlers ---
  private bindMouseAim(): void {
    const updateNdc = (clientX: number, clientY: number) => {
      const canvas = this.canvas || (document.getElementById('game-canvas') as HTMLCanvasElement | null);
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      this.mouseNdc = { x: ndcX, y: ndcY };
      this.mouseAimActive = true;
    };

    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
        updateNdc(e.clientX, e.clientY);
      }
    });

    const canvas = this.canvas || (document.getElementById('game-canvas') as HTMLCanvasElement | null);
    if (canvas) {
      canvas.addEventListener('pointerdown', (e) => {
        this.onAnyInteraction?.();
        if (e.pointerType === 'mouse' && e.button === 0) {
          updateNdc(e.clientX, e.clientY);
          this.mouseFire = true;
          this.fireQueued = true;
        }
      });
    }

    window.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' && e.button === 0) {
        this.mouseFire = false;
      }
    });
  }

  // --- Left Virtual Analog Move Stick ---
  private bindMoveStick(): void {
    const base = this.moveStickBase;
    if (!base) return;

    const handleMove = (clientX: number, clientY: number) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      const maxRadius = rect.width * 0.38;

      if (dist < 6) {
        this.touchMoveVector = { x: 0, z: 0 };
        if (this.moveStickKnob) this.moveStickKnob.style.transform = 'translate(0px, 0px)';
        return;
      }

      const clampedDist = Math.min(dist, maxRadius);
      const intensity = clampedDist / maxRadius;
      const nx = dx / dist;
      const nz = dy / dist;

      this.touchMoveVector = {
        x: nx * intensity,
        z: nz * intensity
      };

      if (this.moveStickKnob) {
        const kx = nx * clampedDist;
        const ky = nz * clampedDist;
        this.moveStickKnob.style.transform = `translate(${kx.toFixed(1)}px, ${ky.toFixed(1)}px)`;
      }
    };

    base.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onAnyInteraction?.();
      this.mouseAimActive = false; // Touch movement switches off mouse aim
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
      this.touchMoveVector = { x: 0, z: 0 };
      if (this.moveStickKnob) {
        this.moveStickKnob.style.transform = 'translate(0px, 0px)';
      }
    };

    base.addEventListener('pointerup', releaseMove);
    base.addEventListener('pointercancel', releaseMove);
  }

  // --- Right Virtual Brawl Stars Aim Stick ---
  private bindAimStick(): void {
    const base = this.aimStickBase;
    if (!base) return;

    const handleAimMove = (clientX: number, clientY: number) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy);

      if (dist > this.aimMaxDragDist) {
        this.aimMaxDragDist = dist;
      }

      const maxRadius = rect.width * 0.38;
      const clampedDist = Math.min(dist, maxRadius);

      if (this.aimStickKnob) {
        const kx = dist > 0 ? (dx / dist) * clampedDist : 0;
        const ky = dist > 0 ? (dy / dist) * clampedDist : 0;
        this.aimStickKnob.style.transform = `translate(${kx.toFixed(1)}px, ${ky.toFixed(1)}px)`;
      }

      // Beyond threshold 16px: continuous 360° aiming fire
      if (dist > 16) {
        this.touchAimVector = {
          x: dx / dist,
          z: dy / dist
        };
        base.classList.add('active');
      } else {
        this.touchAimVector = null;
        base.classList.remove('active');
      }
    };

    base.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onAnyInteraction?.();
      this.mouseAimActive = false; // Touch aiming switches off mouse aim
      this.aimPointerId = e.pointerId;
      this.aimStartTime = performance.now();
      this.aimMaxDragDist = 0;
      this.touchAimVector = null;

      try {
        base.setPointerCapture(e.pointerId);
      } catch {
        // Safe fallback
      }
      handleAimMove(e.clientX, e.clientY);
    });

    base.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.aimPointerId) return;
      e.preventDefault();
      handleAimMove(e.clientX, e.clientY);
    });

    const releaseAim = (e: PointerEvent) => {
      if (e.pointerId !== this.aimPointerId) return;

      const duration = performance.now() - this.aimStartTime;
      // Quick tap detection: released within 240ms without dragging beyond 18px
      if (duration < 240 && this.aimMaxDragDist < 18) {
        this.autoAimTap = true;
        this.fireQueued = true;
      }

      this.aimPointerId = null;
      this.touchAimVector = null;
      base.classList.remove('active');
      if (this.aimStickKnob) {
        this.aimStickKnob.style.transform = 'translate(0px, 0px)';
      }
    };

    base.addEventListener('pointerup', releaseAim);
    base.addEventListener('pointercancel', releaseAim);
  }
}
