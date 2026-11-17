export class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean;
  private lastMoveTick = 0;

  constructor(initialMuted = false) {
    this.muted = initialMuted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  unlock(): void {
    this.ensureContext();
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /**
   * World of Tanks style tank shots with support for electric & mini-artillery weaponry.
   */
  playShoot(style?: 'ap' | 'heavy' | 'he' | 'electric' | 'mini_artillery' | 'cannon' | 'apc' | 'rocket' | 'railgun' | 'power' | string | boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Normalize legacy boolean or string parameters
    let s = 'ap';
    if (typeof style === 'boolean') {
      s = style ? 'heavy' : 'ap';
    } else if (typeof style === 'string' && style.length > 0) {
      s = style;
    }

    if (s === 'electric' || s === 'railgun') {
      // High-voltage electro-gun: bass punch + Tesla lightning discharge crackle & spark FM
      this.playNoiseBurst(0.24, 3400, 0.22, 'highpass');
      this.playNoiseBurst(0.18, 1600, 0.16, 'bandpass');

      // Heavy sub-bass foundation
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(320, now);
      subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.22);
      subGain.gain.setValueAtTime(0.26, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.25);

      // Sizzling Tesla discharge carrier
      const teslaOsc = ctx.createOscillator();
      const teslaGain = ctx.createGain();
      teslaOsc.type = 'sawtooth';
      teslaOsc.frequency.setValueAtTime(1450, now);
      teslaOsc.frequency.exponentialRampToValueAtTime(120, now + 0.26);

      teslaGain.gain.setValueAtTime(0.24, now);
      teslaGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      teslaOsc.connect(teslaGain);
      teslaGain.connect(ctx.destination);
      teslaOsc.start(now);
      teslaOsc.stop(now + 0.27);
      return;
    }

    if (s === 'mini_artillery' || s === 'apc') {
      // Snappy, springy artillery pop ("тук-тук-тук"), pleasant for rapid fire (every 0.22s)
      this.playNoiseBurst(0.04, 850, 0.08);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.06);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
      return;
    }

    if (s === 'heavy') {
      // Deep bass roar of large-caliber heavy tank gun (152mm TT)
      this.playNoiseBurst(0.44, 380, 0.35);

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(175, now);
      osc1.frequency.exponentialRampToValueAtTime(26, now + 0.38);
      gain1.gain.setValueAtTime(0.32, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.42);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(95, now);
      osc2.frequency.linearRampToValueAtTime(32, now + 0.4);
      gain2.gain.setValueAtTime(0.3, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now);
      osc2.stop(now + 0.43);
      return;
    }

    if (s === 'he') {
      // Loud high-explosive shot with low hollow rumble
      this.playNoiseBurst(0.36, 620, 0.28);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.28);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
      return;
    }

    if (s === 'rocket') {
      // Whooshing rocket thrust launch
      this.playNoiseBurst(0.22, 750, 0.2);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.22);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.23);
      return;
    }

    // Default 'ap' / 'cannon' / 'power'
    // Crisp powerful tank shot with metallic breech echo
    this.playNoiseBurst(0.16, 1150, 0.2);

    // Muzzle blast punch
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = s === 'power' ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(460, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.14);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);

    // Metallic breech ring
    const breechOsc = ctx.createOscillator();
    const breechGain = ctx.createGain();
    breechOsc.type = 'triangle';
    breechOsc.frequency.setValueAtTime(920, now + 0.02);
    breechOsc.frequency.exponentialRampToValueAtTime(320, now + 0.1);
    breechGain.gain.setValueAtTime(0.08, now + 0.02);
    breechGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    breechOsc.connect(breechGain);
    breechGain.connect(ctx.destination);
    breechOsc.start(now + 0.02);
    breechOsc.stop(now + 0.12);
  }

  /**
   * Short electric arc crackle upon electric projectile impact.
   */
  playElectricArc(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // High frequency electric crackle
    this.playNoiseBurst(0.09, 3600, 0.18, 'highpass');

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.08);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Lens optical click when entering/exiting WoT sniper scope.
   */
  playSniperToggle(entering: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';

    if (entering) {
      // Rising high-tech optical zoom chirp
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(1540, now + 0.05);
    } else {
      // Descending lens shutter release
      osc.frequency.setValueAtTime(1350, now);
      osc.frequency.exponentialRampToValueAtTime(540, now + 0.05);
    }

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Mechanical turret selection clank.
   * Slot 1 = Main Turret (lower mechanical clank).
   * Slot 2 = Rear Mini-Artillery (higher snappy latch).
   */
  playWeaponSwitch(slot: 1 | 2): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = slot === 1 ? 'square' : 'triangle';

    if (slot === 1) {
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.065);
      gain.gain.setValueAtTime(0.12, now);
    } else {
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(920, now + 0.055);
      gain.gain.setValueAtTime(0.1, now);
    }

    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  /**
   * Signature quiet World of Tanks reload completion bell chime.
   */
  playReloadReady(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Resonant metallic bell ping (A6 = 1760 Hz with subtle harmonic)
    const fundamental = 1760;
    const freqs = [fundamental, fundamental * 2.04];
    const gains = [0.11, 0.04];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(gains[idx], now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.55);
    });
  }

  /**
   * General projectile impact sound.
   */
  playHit(): void {
    this.playArmorHit();
  }

  playArmorHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.linearRampToValueAtTime(220, now + 0.09);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playBrickHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    this.playNoiseBurst(0.06, 850, 0.16);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.07);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  playSteelHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.08);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playExplosion(big = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = big ? 0.55 : 0.3;

    this.playNoiseBurst(dur, big ? 420 : 620, big ? 0.32 : 0.22);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(big ? 140 : 180, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + dur);
    gain.gain.setValueAtTime(big ? 0.28 : 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  playRepair(): void {
    // Warm restorative chord (C5 -> E5 -> G5 -> C6)
    this.playArpeggio([523.25, 659.25, 783.99, 1046.5], 0.07, 'triangle', 0.14);
  }

  playCoinPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Pleasant double coin chime: B5 (987.77 Hz) -> E6 (1318.51 Hz)
    const notes = [
      { f: 987.77, t: 0.0, d: 0.09 },
      { f: 1318.51, t: 0.08, d: 0.22 }
    ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.f, now + n.t);

      gain.gain.setValueAtTime(0.16, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.01);
    }
  }

  playBossAlert(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Ominous low siren alarm: two descending saw pulses
    for (const offset of [0, 0.26]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now + offset);
      osc.frequency.exponentialRampToValueAtTime(75, now + offset + 0.22);

      gain.gain.setValueAtTime(0.24, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.25);
    }
  }

  /**
   * Base capture siren alarm (higher sharp pulses for enemy capture, calmer tones for ally capture)
   */
  playBaseAlarm(isEnemy: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const pulseLen = 0.16;
    const gap = 0.22;

    for (const offset of [0, gap]) {
      const t = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (isEnemy) {
        // High, sharper alarm for hostile capture (sawtooth 580 Hz -> 440 Hz)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(580, t);
        osc.frequency.exponentialRampToValueAtTime(440, t + pulseLen);
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + pulseLen);
      } else {
        // Calmer, uplifting tone for ally capture (triangle 440 Hz -> 554 Hz)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.exponentialRampToValueAtTime(554, t + pulseLen);
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + pulseLen);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + pulseLen + 0.02);
    }
  }

  playPowerUpSpawn(): void {
    this.playArpeggio([523.25, 659.25, 783.99, 1046.5], 0.055, 'sine', 0.12);
  }

  playPowerUpPickup(isExtraLife = false): void {
    if (isExtraLife) {
      this.playArpeggio([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.075, 'triangle', 0.18);
    } else {
      this.playArpeggio([440, 554.37, 659.25, 880], 0.06, 'square', 0.13);
    }
  }

  playStageStart(): void {
    // Battle City inspired heroic synth intro fanfare
    const notes = [
      { f: 261.63, d: 0.11, t: 0.0 },
      { f: 293.66, d: 0.11, t: 0.13 },
      { f: 329.63, d: 0.18, t: 0.26 },
      { f: 261.63, d: 0.11, t: 0.48 },
      { f: 329.63, d: 0.11, t: 0.61 },
      { f: 392.0, d: 0.28, t: 0.74 },
      { f: 523.25, d: 0.35, t: 1.06 }
    ];
    const ctx = this.ensureContext();
    if (!ctx) return;
    const base = ctx.currentTime + 0.02;
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(n.f, base + n.t);
      gain.gain.setValueAtTime(0.11, base + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, base + n.t + n.d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(base + n.t);
      osc.stop(base + n.t + n.d + 0.01);
    }
  }

  playVictory(): void {
    this.playArpeggio([392, 493.88, 587.33, 783.99, 987.77], 0.09, 'square', 0.14);
  }

  playGameOver(): void {
    this.playArpeggio([392, 349.23, 329.63, 293.66, 220], 0.13, 'sawtooth', 0.14);
  }

  playUiClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  playMoveTick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastMoveTick < 0.09) return;
    this.lastMoveTick = now;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(72, now);
    osc.frequency.linearRampToValueAtTime(55, now + 0.04);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  playMortarWhistle(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1850, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.34);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  private playArpeggio(freqs: number[], step: number, type: OscillatorType, vol: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const base = ctx.currentTime;
    freqs.forEach((f, idx) => {
      const t = base + idx * step;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + step * 1.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + step * 1.4);
    });
  }

  private playNoiseBurst(
    duration: number,
    filterFreq: number,
    volume: number,
    filterType: BiquadFilterType = 'lowpass'
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const sampleCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / sampleCount, 1.4);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + duration);
  }
}
