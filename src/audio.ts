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
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

  playShoot(style?: 'cannon' | 'apc' | 'rocket' | 'railgun' | 'power' | boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const s = typeof style === 'boolean' ? (style ? 'power' : 'cannon') : (style || 'cannon');

    if (s === 'apc') {
      // Snappy rapid-fire autocannon shot
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.055);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.065);

      this.playNoiseBurst(0.035, 1400, 0.09);
      return;
    }

    if (s === 'rocket') {
      // Whooshing rocket thrust launch
      this.playNoiseBurst(0.2, 750, 0.22);
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

    if (s === 'railgun') {
      // High-voltage electromagnetic discharge
      this.playNoiseBurst(0.12, 2800, 0.28);
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(1400, now);
      osc1.frequency.exponentialRampToValueAtTime(90, now + 0.26);

      gain1.gain.setValueAtTime(0.22, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.27);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.28);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(220, now);
      osc2.frequency.linearRampToValueAtTime(45, now + 0.28);
      gain2.gain.setValueAtTime(0.2, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now);
      osc2.stop(now + 0.29);
      return;
    }

    // Default cannon or power cannon
    const isPower = s === 'power';
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isPower ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(isPower ? 520 : 420, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.12);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
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

  playRepair(): void {
    // Warm restorative chord (C5 -> E5 -> G5 -> C6)
    this.playArpeggio([523.25, 659.25, 783.99, 1046.5], 0.07, 'triangle', 0.14);
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

  playMortarWhistle(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // High whistling descent of incoming artillery shell
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
    // Classic Battle City inspired heroic synth intro fanfare
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

  private playNoiseBurst(duration: number, filterFreq: number, volume: number): void {
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
    filter.type = 'lowpass';
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
