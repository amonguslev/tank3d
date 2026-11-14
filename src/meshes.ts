import * as THREE from 'three';
import type { BiomeId, BossId, EnemyKind, PowerUpKind, TankClassId } from './types';

// ============================================================================
// Biome Textures & Generators
// ============================================================================

function makeBrickTexture(biome: BiomeId = 'industrial'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  let mortarColor = '#47362e';
  let brickColors = ['#b44c2e', '#c45635', '#a34125', '#cf613e'];
  let topHighlight = 'rgba(255, 210, 180, 0.22)';
  let botShadow = 'rgba(25, 10, 5, 0.32)';

  if (biome === 'desert') {
    mortarColor = '#5a3e20';
    brickColors = ['#d49b54', '#e2b172', '#c48942', '#b87a32'];
    topHighlight = 'rgba(254, 243, 199, 0.28)';
    botShadow = 'rgba(69, 44, 18, 0.36)';
  } else if (biome === 'arctic') {
    mortarColor = '#1e293b';
    brickColors = ['#38bdf8', '#7dd3fc', '#0284c7', '#60a5fa'];
    topHighlight = 'rgba(255, 255, 255, 0.4)';
    botShadow = 'rgba(15, 23, 42, 0.42)';
  } else if (biome === 'volcanic') {
    mortarColor = '#1f0c0c';
    brickColors = ['#450a0a', '#7f1d1d', '#991b1b', '#2e0707'];
    topHighlight = 'rgba(249, 115, 22, 0.32)';
    botShadow = 'rgba(0, 0, 0, 0.55)';
  }

  // Mortar background
  ctx.fillStyle = mortarColor;
  ctx.fillRect(0, 0, 128, 128);

  const rows = 4;
  const rowH = 128 / rows;

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : 32;
    for (let c = -1; c < 3; c++) {
      const bx = c * 64 + offset + 3;
      const by = r * rowH + 3;
      const bw = 58;
      const bh = rowH - 6;

      ctx.fillStyle = brickColors[(r + c + 4) % brickColors.length];
      ctx.fillRect(bx, by, bw, bh);

      // Top highlight
      ctx.fillStyle = topHighlight;
      ctx.fillRect(bx, by, bw, 4);

      // Bottom shadow
      ctx.fillStyle = botShadow;
      ctx.fillRect(bx, by + bh - 4, bw, 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSteelTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8b9bb0';
  ctx.fillRect(0, 0, 128, 128);

  // Bevel edges
  ctx.fillStyle = '#dce6f2';
  ctx.fillRect(0, 0, 128, 10);
  ctx.fillRect(0, 0, 10, 128);

  ctx.fillStyle = '#4b596b';
  ctx.fillRect(0, 118, 128, 10);
  ctx.fillRect(118, 0, 10, 128);

  // Inner plate
  ctx.fillStyle = '#a6b6ca';
  ctx.fillRect(14, 14, 100, 100);

  // Corner rivets
  ctx.fillStyle = '#536275';
  for (const [rx, ry] of [
    [24, 24],
    [104, 24],
    [24, 104],
    [104, 104]
  ]) {
    ctx.beginPath();
    ctx.arc(rx, ry, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFloorTexture(biome: BiomeId = 'industrial'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  let bgColor = '#131924';
  let borderCol = '#1c2536';
  let lineCol = 'rgba(56, 189, 248, 0.06)';

  if (biome === 'desert') {
    bgColor = '#3b2f20';
    borderCol = '#4a3b29';
    lineCol = 'rgba(217, 119, 6, 0.12)';
  } else if (biome === 'arctic') {
    bgColor = '#1e293b';
    borderCol = '#334155';
    lineCol = 'rgba(186, 230, 253, 0.1)';
  } else if (biome === 'volcanic') {
    bgColor = '#1a1114';
    borderCol = '#2d151c';
    lineCol = 'rgba(249, 115, 22, 0.16)';
  }

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = borderCol;
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 252, 252);

  ctx.strokeStyle = lineCol;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(128, 0);
  ctx.lineTo(128, 256);
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.stroke();

  // Subtle corner cross accents
  ctx.strokeRect(60, 60, 8, 8);
  ctx.strokeRect(188, 60, 8, 8);
  ctx.strokeRect(60, 188, 8, 8);
  ctx.strokeRect(188, 188, 8, 8);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // 18x18 repeat for the 36x36 arena
  tex.repeat.set(18, 18);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeIceTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, '#7dd3fc');
  grad.addColorStop(0.5, '#bae6fd');
  grad.addColorStop(1, '#38bdf8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(16, 96);
  ctx.lineTo(96, 16);
  ctx.moveTo(48, 112);
  ctx.lineTo(112, 48);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ============================================================================
// Shared Assets & Factory
// ============================================================================

export class SharedAssets {
  readonly brickGeo = new THREE.BoxGeometry(0.98, 1.15, 0.98);
  readonly steelGeo = new THREE.BoxGeometry(0.98, 1.32, 0.98);
  readonly waterGeo = new THREE.BoxGeometry(1.0, 0.18, 1.0);
  readonly iceGeo = new THREE.BoxGeometry(1.0, 0.06, 1.0);
  readonly bulletGeo = new THREE.SphereGeometry(0.2, 10, 10);

  readonly brickMat: THREE.MeshStandardMaterial;
  readonly steelMat: THREE.MeshStandardMaterial;
  readonly waterMat: THREE.MeshStandardMaterial;
  readonly iceMat: THREE.MeshStandardMaterial;
  readonly forestMat: THREE.MeshStandardMaterial;
  readonly forestDarkMat: THREE.MeshStandardMaterial;
  readonly floorMat: THREE.MeshStandardMaterial;
  readonly borderMat: THREE.MeshStandardMaterial;
  readonly playerBulletMat: THREE.MeshStandardMaterial;
  readonly enemyBulletMat: THREE.MeshStandardMaterial;

  private floorTextures: Record<BiomeId, THREE.CanvasTexture>;
  private brickTextures: Record<BiomeId, THREE.CanvasTexture>;

  constructor() {
    this.floorTextures = {
      industrial: makeFloorTexture('industrial'),
      desert: makeFloorTexture('desert'),
      arctic: makeFloorTexture('arctic'),
      volcanic: makeFloorTexture('volcanic')
    };

    this.brickTextures = {
      industrial: makeBrickTexture('industrial'),
      desert: makeBrickTexture('desert'),
      arctic: makeBrickTexture('arctic'),
      volcanic: makeBrickTexture('volcanic')
    };

    this.brickMat = new THREE.MeshStandardMaterial({
      map: this.brickTextures.industrial,
      roughness: 0.85,
      metalness: 0.05
    });

    this.steelMat = new THREE.MeshStandardMaterial({
      map: makeSteelTexture(),
      roughness: 0.32,
      metalness: 0.72
    });

    this.waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.86
    });

    this.iceMat = new THREE.MeshStandardMaterial({
      map: makeIceTexture(),
      roughness: 0.12,
      metalness: 0.25
    });

    this.forestMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.78,
      metalness: 0.02
    });

    this.forestDarkMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.82,
      metalness: 0.02
    });

    this.floorMat = new THREE.MeshStandardMaterial({
      map: this.floorTextures.industrial,
      roughness: 0.9,
      metalness: 0.08
    });

    this.borderMat = new THREE.MeshStandardMaterial({
      color: 0x263244,
      roughness: 0.55,
      metalness: 0.45
    });

    this.playerBulletMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfbbf24,
      emissiveIntensity: 0.9,
      roughness: 0.2
    });

    this.enemyBulletMat = new THREE.MeshStandardMaterial({
      color: 0xfecdd3,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.85,
      roughness: 0.2
    });

    this.applyBiome('industrial');
  }

  applyBiome(biome: BiomeId): void {
    // Floor texture
    this.floorMat.map = this.floorTextures[biome];
    this.floorMat.needsUpdate = true;

    // Brick texture
    this.brickMat.map = this.brickTextures[biome];
    this.brickMat.needsUpdate = true;

    // Border and water materials
    switch (biome) {
      case 'industrial':
        this.borderMat.color.setHex(0x263244);
        this.waterMat.color.setHex(0x0284c7);
        this.waterMat.emissive.setHex(0x0369a1);
        this.waterMat.emissiveIntensity = 0.35;
        this.waterMat.roughness = 0.2;
        this.waterMat.metalness = 0.1;
        this.waterMat.opacity = 0.86;
        break;

      case 'desert': // Sand canyon & turquoise oasis
        this.borderMat.color.setHex(0x5c4033);
        this.waterMat.color.setHex(0x06b6d4);
        this.waterMat.emissive.setHex(0x0891b2);
        this.waterMat.emissiveIntensity = 0.4;
        this.waterMat.roughness = 0.18;
        this.waterMat.metalness = 0.1;
        this.waterMat.opacity = 0.88;
        break;

      case 'arctic': // Snowy dark slate & dark ice water
        this.borderMat.color.setHex(0x334155);
        this.waterMat.color.setHex(0x0f172a);
        this.waterMat.emissive.setHex(0x1e3a8a);
        this.waterMat.emissiveIntensity = 0.3;
        this.waterMat.roughness = 0.15;
        this.waterMat.metalness = 0.2;
        this.waterMat.opacity = 0.9;
        break;

      case 'volcanic': // Basalt & red-hot glowing orange-red lava!
        this.borderMat.color.setHex(0x261215);
        this.waterMat.color.setHex(0xf97316);
        this.waterMat.emissive.setHex(0xdc2626);
        this.waterMat.emissiveIntensity = 0.95;
        this.waterMat.roughness = 0.4;
        this.waterMat.metalness = 0.05;
        this.waterMat.opacity = 0.96;
        break;
    }
  }

  createForestClump(biome: BiomeId = 'industrial'): THREE.Group {
    const g = new THREE.Group();

    if (biome === 'desert') {
      // Desert Cactus / succulent bush
      const cactusMat = new THREE.MeshStandardMaterial({
        color: 0x65a30d,
        roughness: 0.8,
        metalness: 0.05
      });
      const spineMat = new THREE.MeshStandardMaterial({
        color: 0xca8a04,
        roughness: 0.6
      });

      // Central stem
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 1.25, 8), cactusMat);
      stem.position.set(0, 0.65, 0);
      g.add(stem);

      // Left arm
      const armL1 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.18), cactusMat);
      armL1.position.set(-0.28, 0.65, 0);
      const armL2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.45, 8), cactusMat);
      armL2.position.set(-0.44, 0.88, 0);
      g.add(armL1, armL2);

      // Right arm
      const armR1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.18), cactusMat);
      armR1.position.set(0.26, 0.5, 0);
      const armR2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.42, 8), cactusMat);
      armR2.position.set(0.4, 0.72, 0);
      g.add(armR1, armR2);

      // Top blossom
      const flower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), spineMat);
      flower.position.set(0, 1.32, 0);
      g.add(flower);
      return g;
    }

    if (biome === 'arctic') {
      // Snowy pine tree
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
      const pineMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.7 });
      const snowMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.55, 8), trunkMat);
      trunk.position.set(0, 0.28, 0);
      g.add(trunk);

      // Bottom tier
      const tier1 = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.6, 7), pineMat);
      tier1.position.set(0, 0.75, 0);
      const snow1 = new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.22, 7), snowMat);
      snow1.position.set(0, 0.65, 0);
      g.add(tier1, snow1);

      // Middle tier
      const tier2 = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.55, 7), pineMat);
      tier2.position.set(0, 1.12, 0);
      const snow2 = new THREE.Mesh(new THREE.ConeGeometry(0.51, 0.2, 7), snowMat);
      snow2.position.set(0, 1.05, 0);
      g.add(tier2, snow2);

      // Top snowy spire
      const tier3 = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.45, 7), snowMat);
      tier3.position.set(0, 1.48, 0);
      g.add(tier3);
      return g;
    }

    if (biome === 'volcanic') {
      // Dark jagged obsidian crystal cluster with glowing embers
      const obsidianMat = new THREE.MeshStandardMaterial({
        color: 0x18181b,
        roughness: 0.35,
        metalness: 0.65
      });
      const emberMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xdc2626,
        emissiveIntensity: 0.85,
        roughness: 0.3
      });

      const spire1 = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.35, 5), obsidianMat);
      spire1.position.set(0, 0.68, 0);
      spire1.rotation.y = 0.4;
      g.add(spire1);

      const spire2 = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.95, 5), obsidianMat);
      spire2.position.set(0.26, 0.48, 0.18);
      spire2.rotation.z = -0.22;
      spire2.rotation.y = 1.1;
      g.add(spire2);

      const spire3 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.75, 5), obsidianMat);
      spire3.position.set(-0.24, 0.38, -0.16);
      spire3.rotation.x = 0.25;
      g.add(spire3);

      const glowingTip = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), emberMat);
      glowingTip.position.set(0, 1.25, 0);
      g.add(glowingTip);
      return g;
    }

    // Default Industrial: lush green crown
    const main = new THREE.Mesh(new THREE.DodecahedronGeometry(0.54, 0), this.forestMat);
    main.position.set(0, 1.15, 0);
    g.add(main);

    const sub = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38, 0), this.forestDarkMat);
    sub.position.set(0.2, 0.92, 0.18);
    g.add(sub);

    return g;
  }

  createBaseMesh(destroyed = false): THREE.Group {
    const group = new THREE.Group();

    // Armored base platform (2x2 units)
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.22, 1.85),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.6 })
    );
    pad.position.y = 0.11;
    pad.receiveShadow = true;
    group.add(pad);

    if (destroyed) {
      const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.95 });
      for (let i = 0; i < 6; i++) {
        const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), rubbleMat);
        const angle = (i / 6) * Math.PI * 2;
        chunk.position.set(Math.cos(angle) * 0.42, 0.28, Math.sin(angle) * 0.42);
        chunk.rotation.set(i, i * 0.7, 0);
        group.add(chunk);
      }
      return group;
    }

    // Golden Shield / Trident Emblem (Ukrainian Tryzub-inspired 3D crest!)
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.75
    });

    // Center spire
    const center = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.35, 0.26), goldMat);
    center.position.set(0, 0.88, 0);
    center.castShadow = true;
    group.add(center);

    // Base crossbar
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.24, 0.26), goldMat);
    bar.position.set(0, 0.45, 0);
    bar.castShadow = true;
    group.add(bar);

    // Left & Right prongs
    const leftProng = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.95, 0.26), goldMat);
    leftProng.position.set(-0.46, 0.85, 0);
    leftProng.castShadow = true;
    group.add(leftProng);

    const rightProng = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.95, 0.26), goldMat);
    rightProng.position.set(0.46, 0.85, 0);
    rightProng.castShadow = true;
    group.add(rightProng);

    // Subtle warm aura light
    const light = new THREE.PointLight(0xfbbf24, 1.5, 5.5);
    light.position.set(0, 1.5, 0);
    group.add(light);

    return group;
  }

  createPowerUpMesh(kind: PowerUpKind): THREE.Group {
    const group = new THREE.Group();

    const colorMap: Record<PowerUpKind, number> = {
      star: 0xfbbf24,
      shield: 0x38bdf8,
      clock: 0xa855f7,
      shovel: 0x94a3b8,
      grenade: 0xf43f5e,
      life: 0x22c55e,
      repair: 0x10b981
    };
    const col = colorMap[kind];

    const baseMat = new THREE.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.5
    });

    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.2, 16), baseMat);
    ring.position.y = 0.25;
    group.add(ring);

    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: col,
      emissiveIntensity: 0.25,
      roughness: 0.2
    });

    if (kind === 'star') {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.46, 0), whiteMat);
      star.position.y = 0.75;
      group.add(star);
    } else if (kind === 'shield') {
      const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(0.44, 1), whiteMat);
      dome.position.y = 0.72;
      group.add(dome);
    } else if (kind === 'clock') {
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 16), whiteMat);
      face.rotation.x = Math.PI / 2;
      face.position.y = 0.75;
      group.add(face);
    } else if (kind === 'shovel') {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.58, 0.58), this.steelMat);
      block.position.y = 0.72;
      group.add(block);
    } else if (kind === 'grenade') {
      const bomb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), whiteMat);
      bomb.position.y = 0.72;
      group.add(bomb);
    } else if (kind === 'repair') {
      // Green-white repair medkit with embossed cross
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.38, 0.42), baseMat);
      box.position.y = 0.72;
      const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.44), whiteMat);
      const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.44), whiteMat);
      cross1.position.y = 0.72;
      cross2.position.y = 0.72;
      group.add(box, cross1, cross2);
    } else {
      // Extra life mini tank crest
      const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.22, 0.22), whiteMat);
      const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.66, 0.22), whiteMat);
      cross1.position.y = 0.75;
      cross2.position.y = 0.75;
      group.add(cross1, cross2);
    }

    return group;
  }

  createBarrelMesh(): THREE.Group {
    const group = new THREE.Group();

    // Red explosive drum
    const redMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x991b1b,
      emissiveIntensity: 0.2,
      roughness: 0.35,
      metalness: 0.4
    });

    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 1.15, 20), redMat);
    drum.position.y = 0.575;
    drum.castShadow = true;
    drum.receiveShadow = true;
    group.add(drum);

    // Hazard yellow/black warning rings
    const hazardMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xca8a04,
      emissiveIntensity: 0.3,
      roughness: 0.3,
      metalness: 0.2
    });
    const darkBandMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.5,
      metalness: 0.5
    });

    const rimGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.1, 20);
    const topRim = new THREE.Mesh(rimGeo, darkBandMat);
    topRim.position.y = 1.02;
    const botRim = new THREE.Mesh(rimGeo, darkBandMat);
    botRim.position.y = 0.13;
    group.add(topRim, botRim);

    // Center caution belt
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.595, 0.595, 0.22, 20), hazardMat);
    belt.position.y = 0.575;
    group.add(belt);

    // Cap on top
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), darkBandMat);
    cap.position.set(0.22, 1.18, 0);
    group.add(cap);

    return group;
  }

  createCoinMesh(): THREE.Group {
    const group = new THREE.Group();

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.45,
      roughness: 0.18,
      metalness: 0.88
    });

    // Upright shiny coin
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24), goldMat);
    coin.rotation.x = Math.PI / 2;
    coin.position.y = 0.48;
    coin.castShadow = true;
    group.add(coin);

    // Outer embossed rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.04, 8, 24), goldMat);
    rim.position.y = 0.48;
    group.add(rim);

    // Star crest in center
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), goldMat);
    star.position.y = 0.48;
    group.add(star);

    return group;
  }

  createAimReticle(): THREE.Group {
    const group = new THREE.Group();
    group.position.y = 0.06;

    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    // Outer dashed/smooth ring
    const ringGeo = new THREE.RingGeometry(0.52, 0.62, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, reticleMat);
    group.add(ring);

    // Center precision dot
    const dotGeo = new THREE.CircleGeometry(0.08, 16);
    dotGeo.rotateX(-Math.PI / 2);
    const dot = new THREE.Mesh(dotGeo, reticleMat);
    group.add(dot);

    // 4 crosshair tick marks
    const tickMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    for (let i = 0; i < 4; i++) {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.22), tickMat);
      tick.rotateX(-Math.PI / 2);
      const angle = (i * Math.PI) / 2;
      tick.position.set(Math.cos(angle) * 0.72, 0, Math.sin(angle) * 0.72);
      tick.rotation.y = -angle;
      group.add(tick);
    }

    return group;
  }

  createTelegraphZone(radius: number): { group: THREE.Group; fillMat: THREE.MeshBasicMaterial } {
    const group = new THREE.Group();
    group.position.y = 0.04;

    // Solid red boundary ring
    const ringGeo = new THREE.RingGeometry(Math.max(0.1, radius - 0.08), radius, 36);
    ringGeo.rotateX(-Math.PI / 2);
    const borderMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, borderMat);
    group.add(ring);

    // Semi-transparent danger fill
    const circleGeo = new THREE.CircleGeometry(Math.max(0.1, radius - 0.08), 36);
    circleGeo.rotateX(-Math.PI / 2);
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const fill = new THREE.Mesh(circleGeo, fillMat);
    group.add(fill);

    return { group, fillMat };
  }
}

// ============================================================================
// Tank Visual Interface & 3D Constructor
// ============================================================================

export interface TankVisual {
  root: THREE.Group;
  hullGroup: THREE.Group;    // Rotates with hull angle
  turretPivot: THREE.Group;  // Rotates independently with aim/turret angle
  recoilGroup: THREE.Group;
  hullMat: THREE.MeshStandardMaterial;
  turretMat: THREE.MeshStandardMaterial;
  twinBarrel: THREE.Object3D;
  shieldMesh: THREE.Mesh;
}

export function createTankVisual(options: {
  isPlayer: boolean;
  playerClass?: TankClassId;
  enemyKind?: EnemyKind;
  bossId?: BossId;
  isBonus?: boolean;
}): TankVisual {
  const root = new THREE.Group();
  const hullGroup = new THREE.Group();
  const turretPivot = new THREE.Group();

  root.add(hullGroup);
  root.add(turretPivot);

  // Common materials
  const treadMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
    metalness: 0.3
  });

  const ribMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.7
  });

  const isBoss = !!options.bossId;
  const playerClass: TankClassId = options.playerClass || 'allrounder';

  // --------------------------------------------------------------------------
  // Colors & Configuration
  // --------------------------------------------------------------------------
  let hullColor = 0xf59e0b;
  let turretColor = 0xfbbf24;
  let hullWidth = 1.05;
  let barrelLen = 0.95;

  if (options.isPlayer) {
    switch (playerClass) {
      case 'apc':
        hullColor = 0x06b6d4;
        turretColor = 0x22d3ee;
        hullWidth = 1.02;
        barrelLen = 0.88;
        break;
      case 'rocket':
        hullColor = 0xf97316;
        turretColor = 0xfb923c;
        hullWidth = 1.08;
        barrelLen = 0.72;
        break;
      case 'railgun':
        hullColor = 0x4338ca;
        turretColor = 0x6366f1;
        hullWidth = 1.12;
        barrelLen = 1.48;
        break;
      default: // 'allrounder'
        hullColor = 0xf59e0b;
        turretColor = 0xfbbf24;
        break;
    }
  } else if (isBoss) {
    switch (options.bossId) {
      case 'mammoth':
        hullColor = 0x475569;
        turretColor = 0xb45309;
        break;
      case 'artillery':
        hullColor = 0xd97706;
        turretColor = 0x92400e;
        barrelLen = 1.45;
        break;
      case 'cryo':
        hullColor = 0x0284c7;
        turretColor = 0xbae6fd;
        break;
      case 'inferno':
        hullColor = 0x18181b;
        turretColor = 0xef4444;
        break;
    }
    hullWidth = 1.25;
  } else {
    // Normal Enemies
    switch (options.enemyKind) {
      case 'fast':
        hullColor = 0x06b6d4;
        turretColor = 0x67e8f9;
        hullWidth = 0.92;
        barrelLen = 0.88;
        break;
      case 'power':
        hullColor = 0xea580c;
        turretColor = 0xfb923c;
        barrelLen = 1.18;
        break;
      case 'armor':
        hullColor = 0x16a34a;
        turretColor = 0x4ade80;
        hullWidth = 1.18;
        barrelLen = 1.05;
        break;
      default: // 'basic'
        hullColor = 0x64748b;
        turretColor = 0x94a3b8;
        break;
    }
  }

  const hullMat = new THREE.MeshStandardMaterial({
    color: hullColor,
    roughness: 0.38,
    metalness: 0.42
  });

  const turretMat = new THREE.MeshStandardMaterial({
    color: turretColor,
    roughness: 0.32,
    metalness: 0.48
  });

  // --------------------------------------------------------------------------
  // Recoil Group (pointing along -Z)
  // --------------------------------------------------------------------------
  const recoilGroup = new THREE.Group();
  recoilGroup.position.set(0, 0.74, -0.35);
  turretPivot.add(recoilGroup);

  let twinBarrel: THREE.Object3D;

  // --------------------------------------------------------------------------
  // HULL & CHASSIS BUILD
  // --------------------------------------------------------------------------
  if (options.isPlayer && playerClass === 'apc') {
    // Wheeled APC Chassis (3 wheels on left, 3 on right)
    const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.18, 16);
    wheelGeo.rotateZ(Math.PI / 2);

    const hubGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.2, 12);
    hubGeo.rotateZ(Math.PI / 2);

    const zOffsets = [-0.52, 0, 0.52];
    for (const z of zOffsets) {
      // Left wheel
      const wheelL = new THREE.Mesh(wheelGeo, treadMat);
      wheelL.position.set(-0.64, 0.24, z);
      const hubL = new THREE.Mesh(hubGeo, ribMat);
      hubL.position.set(-0.64, 0.24, z);
      wheelL.castShadow = true;
      hullGroup.add(wheelL, hubL);

      // Right wheel
      const wheelR = new THREE.Mesh(wheelGeo, treadMat);
      wheelR.position.set(0.64, 0.24, z);
      const hubR = new THREE.Mesh(hubGeo, ribMat);
      hubR.position.set(0.64, 0.24, z);
      wheelR.castShadow = true;
      hullGroup.add(wheelR, hubR);
    }

    // APC Main sloped hull
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, 0.42, 1.52), hullMat);
    mainHull.position.set(0, 0.42, 0);
    mainHull.castShadow = true;
    mainHull.receiveShadow = true;
    hullGroup.add(mainHull);

    // Front sloped glacis
    const glacis = new THREE.Mesh(new THREE.BoxGeometry(hullWidth * 0.94, 0.24, 0.4), hullMat);
    glacis.position.set(0, 0.38, -0.72);
    glacis.rotation.x = 0.45;
    hullGroup.add(glacis);

  } else {
    // Continuous Track Chassis
    const treadWidth = isBoss ? 0.38 : 0.32;
    const treadGeo = new THREE.BoxGeometry(treadWidth, 0.42, 1.66);

    const leftTread = new THREE.Mesh(treadGeo, treadMat);
    leftTread.position.set(-0.64, 0.21, 0);
    leftTread.castShadow = true;
    hullGroup.add(leftTread);

    const rightTread = new THREE.Mesh(treadGeo, treadMat);
    rightTread.position.set(0.64, 0.21, 0);
    rightTread.castShadow = true;
    hullGroup.add(rightTread);

    // Tread Ribs
    const ribGeo = new THREE.BoxGeometry(treadWidth + 0.03, 0.06, 0.12);
    for (let i = -3; i <= 3; i++) {
      const rL = new THREE.Mesh(ribGeo, ribMat);
      rL.position.set(-0.64, 0.43, i * 0.22);
      const rR = new THREE.Mesh(ribGeo, ribMat);
      rR.position.set(0.64, 0.43, i * 0.22);
      hullGroup.add(rL, rR);
    }

    // Main Hull Box
    const hull = new THREE.Mesh(new THREE.BoxGeometry(hullWidth, 0.44, 1.48), hullMat);
    hull.position.set(0, 0.38, 0.03);
    hull.castShadow = true;
    hull.receiveShadow = true;
    hullGroup.add(hull);

    // Engine exhaust covers on back
    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const exL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.2), exhaustMat);
    exL.position.set(-0.35, 0.46, 0.72);
    const exR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.2), exhaustMat);
    exR.position.set(0.35, 0.46, 0.72);
    hullGroup.add(exL, exR);
  }

  // --------------------------------------------------------------------------
  // BOSS SPECIAL DETAILS (Reactor core & heavy armor)
  // --------------------------------------------------------------------------
  if (isBoss) {
    let reactorColor = 0xf59e0b;
    if (options.bossId === 'artillery') reactorColor = 0xf97316;
    if (options.bossId === 'cryo') reactorColor = 0x38bdf8;
    if (options.bossId === 'inferno') reactorColor = 0xdc2626;

    const reactorMat = new THREE.MeshStandardMaterial({
      color: reactorColor,
      emissive: reactorColor,
      emissiveIntensity: 0.95,
      roughness: 0.2
    });

    const reactor = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.48, 16), reactorMat);
    reactor.rotation.x = Math.PI / 2;
    reactor.position.set(0, 0.48, 0.65);
    hullGroup.add(reactor);

    // Side armor skirts
    const skirtGeo = new THREE.BoxGeometry(0.08, 0.34, 1.58);
    const skirtL = new THREE.Mesh(skirtGeo, hullMat);
    skirtL.position.set(-0.84, 0.28, 0);
    const skirtR = new THREE.Mesh(skirtGeo, hullMat);
    skirtR.position.set(0.84, 0.28, 0);
    hullGroup.add(skirtL, skirtR);
  }

  // --------------------------------------------------------------------------
  // TURRET & WEAPONS BUILD
  // --------------------------------------------------------------------------
  const barrelGeo = new THREE.CylinderGeometry(0.095, 0.11, barrelLen, 12);
  barrelGeo.rotateX(Math.PI / 2);

  if (options.isPlayer && playerClass === 'apc') {
    // APC Low-profile Turret
    const turret = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.32, 0.8), turretMat);
    turret.position.set(0, 0.72, 0.05);
    turret.castShadow = true;
    turretPivot.add(turret);

    // Twin rapid-fire thin barrels
    const apcBarrelGeo = new THREE.CylinderGeometry(0.055, 0.065, barrelLen, 10);
    apcBarrelGeo.rotateX(Math.PI / 2);

    const barrel1 = new THREE.Mesh(apcBarrelGeo, turretMat);
    barrel1.position.set(-0.1, 0, -barrelLen * 0.45);
    const barrel2 = new THREE.Mesh(apcBarrelGeo, turretMat);
    barrel2.position.set(0.1, 0, -barrelLen * 0.45);
    recoilGroup.add(barrel1, barrel2);

    // Twin upgrade booster barrel
    twinBarrel = new THREE.Mesh(apcBarrelGeo, turretMat);
    twinBarrel.position.set(0, 0.12, -barrelLen * 0.45);
    twinBarrel.visible = false;
    recoilGroup.add(twinBarrel);

  } else if (options.isPlayer && playerClass === 'rocket') {
    // Rocket Launcher Turret
    const turret = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.36, 0.88), turretMat);
    turret.position.set(0, 0.74, 0.05);
    turret.castShadow = true;
    turretPivot.add(turret);

    // Left and Right missile pods
    const podGeo = new THREE.BoxGeometry(0.34, 0.3, 0.68);
    const podMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const podL = new THREE.Mesh(podGeo, podMat);
    podL.position.set(-0.56, 0.82, -0.05);
    const podR = new THREE.Mesh(podGeo, podMat);
    podR.position.set(0.56, 0.82, -0.05);
    turretPivot.add(podL, podR);

    // Center rocket barrel / launcher tube
    const rocketTubeGeo = new THREE.CylinderGeometry(0.14, 0.16, barrelLen, 12);
    rocketTubeGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(rocketTubeGeo, turretMat);
    barrel.position.set(0, 0, -barrelLen * 0.45);
    recoilGroup.add(barrel);

    // Secondary volley launcher
    twinBarrel = new THREE.Mesh(rocketTubeGeo, turretMat);
    twinBarrel.position.set(0, 0.15, -barrelLen * 0.45);
    twinBarrel.visible = false;
    recoilGroup.add(twinBarrel);

  } else if (options.isPlayer && playerClass === 'railgun') {
    // Railgun Sniper Turret
    const turret = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.38, 0.94), turretMat);
    turret.position.set(0, 0.74, 0.05);
    turret.castShadow = true;
    turretPivot.add(turret);

    // Long sniper barrel
    const railBarrel = new THREE.Mesh(barrelGeo, turretMat);
    railBarrel.position.set(0, 0, -barrelLen * 0.45);
    recoilGroup.add(railBarrel);

    // Glowing cyan electromagnetic rail conductors
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.92,
      roughness: 0.2
    });
    const railGeo = new THREE.BoxGeometry(0.04, 0.08, barrelLen * 0.9);
    const railL = new THREE.Mesh(railGeo, railMat);
    railL.position.set(-0.12, 0, -barrelLen * 0.45);
    const railR = new THREE.Mesh(railGeo, railMat);
    railR.position.set(0.12, 0, -barrelLen * 0.45);
    recoilGroup.add(railL, railR);

    // Twin upgrade amplifier
    const twinGroup = new THREE.Group();
    const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, barrelLen * 0.9), railMat);
    railTop.position.set(0, 0.12, -barrelLen * 0.45);
    twinGroup.add(railTop);
    twinGroup.visible = false;
    recoilGroup.add(twinGroup);
    twinBarrel = twinGroup;

  } else if (isBoss) {
    // Giant Boss Turret
    const turret = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.44, 1.02), turretMat);
    turret.position.set(0, 0.76, 0.05);
    turret.castShadow = true;
    turretPivot.add(turret);

    // Heavy Boss Cannon(s)
    if (options.bossId === 'mammoth') {
      // Twin siege cannons
      const b1 = new THREE.Mesh(barrelGeo, turretMat);
      b1.position.set(-0.2, 0, -barrelLen * 0.45);
      const b2 = new THREE.Mesh(barrelGeo, turretMat);
      b2.position.set(0.2, 0, -barrelLen * 0.45);
      recoilGroup.add(b1, b2);
    } else {
      // Massive heavy caliber cannon
      const heavyBarrelGeo = new THREE.CylinderGeometry(0.14, 0.17, barrelLen, 14);
      heavyBarrelGeo.rotateX(Math.PI / 2);
      const barrel = new THREE.Mesh(heavyBarrelGeo, turretMat);
      barrel.position.set(0, 0, -barrelLen * 0.45);
      recoilGroup.add(barrel);

      const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.24), hullMat);
      muzzle.position.set(0, 0, -barrelLen * 0.92);
      recoilGroup.add(muzzle);
    }

    const dummyTwin = new THREE.Object3D();
    dummyTwin.visible = false;
    recoilGroup.add(dummyTwin);
    twinBarrel = dummyTwin;

  } else {
    // Default Player All-Rounder & Standard Enemies
    const turret = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.38, 0.88), turretMat);
    turret.position.set(0, 0.74, 0.05);
    turret.castShadow = true;
    turretPivot.add(turret);

    // Commander Hatch
    const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 12), hullMat);
    hatch.position.set(0, 0.96, 0.08);
    turretPivot.add(hatch);

    // Gun Barrel
    const barrel = new THREE.Mesh(barrelGeo, turretMat);
    barrel.position.set(0, 0, -barrelLen * 0.45);
    barrel.castShadow = true;
    recoilGroup.add(barrel);

    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.18), hullMat);
    muzzle.position.set(0, 0, -barrelLen * 0.9);
    recoilGroup.add(muzzle);

    // Twin upgrade secondary barrel (hidden until player has >=2 stars)
    const twinMesh = new THREE.Mesh(barrelGeo, turretMat);
    twinMesh.position.set(0.18, 0, -barrelLen * 0.45);
    twinMesh.visible = false;
    recoilGroup.add(twinMesh);
    twinBarrel = twinMesh;
  }

  // --------------------------------------------------------------------------
  // Boss Scale
  // --------------------------------------------------------------------------
  if (isBoss) {
    root.scale.set(1.85, 1.85, 1.85);
  }

  // --------------------------------------------------------------------------
  // Energy Shield Bubble
  // --------------------------------------------------------------------------
  const shieldMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.22, 1),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.55
    })
  );
  shieldMesh.position.set(0, 0.6, 0);
  shieldMesh.visible = false;
  root.add(shieldMesh);

  return {
    root,
    hullGroup,
    turretPivot,
    recoilGroup,
    hullMat,
    turretMat,
    twinBarrel,
    shieldMesh
  };
}
