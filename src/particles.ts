import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh | THREE.Group;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  shrink: boolean;
  minY: number;
  bounces?: boolean;
}

interface ShockRing {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  maxScale: number;
}

interface TreadMark {
  group: THREE.Group;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
}

interface ScorchCrater {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  initOpacity: number;
}

interface MuzzleFlashEffect {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
}

interface RailgunBeam {
  group: THREE.Group;
  mat: THREE.MeshBasicMaterial;
  coreMat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
}

interface ElectricArc {
  line: THREE.Line;
  geo: THREE.BufferGeometry;
  mat: THREE.LineBasicMaterial;
  life: number;
  maxLife: number;
  baseOpacity: number;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private rings: ShockRing[] = [];
  private treadMarks: TreadMark[] = [];
  private scorchCraters: ScorchCrater[] = [];
  private muzzleFlashes: MuzzleFlashEffect[] = [];
  private railgunBeams: RailgunBeam[] = [];
  private electricArcs: ElectricArc[] = [];

  // Shared reusable geometries (zero memory leaks)
  private boxGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
  private debrisGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  private sparkGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
  private trailGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  private smokeGeo = new THREE.DodecahedronGeometry(0.22, 0);
  private ringGeo: THREE.RingGeometry;
  private treadPlaneGeo: THREE.PlaneGeometry;
  private craterGeo: THREE.CircleGeometry;
  private flashOctaGeo = new THREE.OctahedronGeometry(0.32, 0);
  private sphereGeo = new THREE.SphereGeometry(0.28, 8, 8);
  private plusHGeo = new THREE.BoxGeometry(0.22, 0.06, 0.05);
  private plusVGeo = new THREE.BoxGeometry(0.06, 0.22, 0.05);

  // Shared reusable materials
  private brickDebrisMat = new THREE.MeshStandardMaterial({ color: 0xc25432, roughness: 0.9 });
  private sparkMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  private electricSparkMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
  private metalDebrisMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.4 });
  private repairMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });

  private fireMats = [
    new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    new THREE.MeshBasicMaterial({ color: 0xf97316 }),
    new THREE.MeshBasicMaterial({ color: 0xef4444 }),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95 })
  ];

  private electricMats = [
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
    new THREE.MeshBasicMaterial({ color: 0x67e8f9 }),
    new THREE.MeshBasicMaterial({ color: 0xa855f7 }),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  ];

  private smokeMats = [
    new THREE.MeshBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.7 }),
    new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.65 }),
    new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.75 })
  ];

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.ringGeo = new THREE.RingGeometry(0.25, 0.48, 24);
    this.ringGeo.rotateX(-Math.PI / 2);

    this.treadPlaneGeo = new THREE.PlaneGeometry(0.28, 0.44);
    this.treadPlaneGeo.rotateX(-Math.PI / 2);

    this.craterGeo = new THREE.CircleGeometry(1.0, 20);
    this.craterGeo.rotateX(-Math.PI / 2);
  }

  /**
   * Spawns muzzle flash at gun tip. Supports both 3D Vector3 with styles and legacy (x, z, colorHex).
   */
  spawnMuzzleFlash(
    posOrX: THREE.Vector3 | number,
    dirOrZ: THREE.Vector3 | number = 0,
    styleOrColor: 'ap' | 'heavy' | 'he' | 'electric' | 'mini_artillery' | string | number = 'ap'
  ): void {
    if (typeof posOrX === 'number') {
      // Legacy signature: (x: number, z: number, colorHex?: number)
      const x = posOrX;
      const z = typeof dirOrZ === 'number' ? dirOrZ : 0;
      const colorHex = typeof styleOrColor === 'number' ? styleOrColor : 0xfef08a;

      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.95
      });
      const mesh = new THREE.Mesh(this.flashOctaGeo, mat);
      mesh.position.set(x, 0.76, z);
      this.scene.add(mesh);

      this.muzzleFlashes.push({
        mesh,
        mat,
        life: 0,
        maxLife: 0.09,
        startScale: 0.6,
        endScale: 1.5
      });
      return;
    }

    const pos = posOrX;
    const dir = dirOrZ instanceof THREE.Vector3 ? dirOrZ.clone().normalize() : new THREE.Vector3(0, 0, 1);
    const style = typeof styleOrColor === 'string' ? styleOrColor : 'ap';

    if (style === 'electric') {
      // Dazzling electric plasma sphere + electric sparks
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.95
      });
      const mesh = new THREE.Mesh(this.sphereGeo, mat);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      this.muzzleFlashes.push({
        mesh,
        mat,
        life: 0,
        maxLife: 0.1,
        startScale: 0.5,
        endScale: 1.8
      });

      // Scatter outward electric sparks
      for (let i = 0; i < 8; i++) {
        const sparkMesh = new THREE.Mesh(this.sparkGeo, this.electricSparkMat);
        sparkMesh.position.copy(pos);
        const spread = new THREE.Vector3(
          (Math.random() - 0.5) * 0.7,
          (Math.random() - 0.5) * 0.7,
          (Math.random() - 0.5) * 0.7
        );
        const vel = dir.clone().multiplyScalar(4.5 + Math.random() * 3.5).add(spread);
        this.scene.add(sparkMesh);
        this.particles.push({
          mesh: sparkMesh,
          vel,
          rotVel: new THREE.Vector3(8, 8, 8),
          life: 0,
          maxLife: 0.18 + Math.random() * 0.08,
          gravity: 4,
          shrink: true,
          minY: pos.y - 1.0
        });
      }
      return;
    }

    if (style === 'mini_artillery') {
      // Compact quick orange flash with small smoke puff
      const mat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.95
      });
      const mesh = new THREE.Mesh(this.flashOctaGeo, mat);
      mesh.position.copy(pos);
      mesh.scale.setScalar(0.7);
      this.scene.add(mesh);

      this.muzzleFlashes.push({
        mesh,
        mat,
        life: 0,
        maxLife: 0.07,
        startScale: 0.5,
        endScale: 1.1
      });

      // 3 small rising smoke puffs
      for (let i = 0; i < 3; i++) {
        const sMesh = new THREE.Mesh(this.smokeGeo, this.smokeMats[i % this.smokeMats.length]);
        sMesh.position.copy(pos).addScaledVector(dir, 0.2 + i * 0.1);
        this.scene.add(sMesh);
        this.particles.push({
          mesh: sMesh,
          vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.9 + Math.random() * 0.5, (Math.random() - 0.5) * 0.4),
          rotVel: new THREE.Vector3(Math.random() * 3, Math.random() * 3, Math.random() * 3),
          life: 0,
          maxLife: 0.35 + Math.random() * 0.15,
          gravity: -0.8,
          shrink: true,
          minY: pos.y - 0.5
        });
      }
      return;
    }

    // Standard AP / Heavy / HE muzzle flash
    const isHeavy = style === 'heavy' || style === 'he';
    const flashColor = isHeavy ? 0xf97316 : 0xfef08a;

    const flashMat = new THREE.MeshBasicMaterial({
      color: flashColor,
      transparent: true,
      opacity: 0.95
    });
    const flashMesh = new THREE.Mesh(this.flashOctaGeo, flashMat);
    flashMesh.position.copy(pos);
    this.scene.add(flashMesh);

    this.muzzleFlashes.push({
      mesh: flashMesh,
      mat: flashMat,
      life: 0,
      maxLife: isHeavy ? 0.12 : 0.08,
      startScale: isHeavy ? 1.0 : 0.6,
      endScale: isHeavy ? 2.2 : 1.4
    });

    // Expanding smoke ring along firing direction
    const ringMat = new THREE.MeshBasicMaterial({
      color: isHeavy ? 0x94a3b8 : 0xfde047,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const ringMesh = new THREE.Mesh(this.ringGeo, ringMat);
    ringMesh.position.copy(pos).addScaledVector(dir, 0.2);
    // Orient ring perpendicular to dir
    ringMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.scene.add(ringMesh);

    this.rings.push({
      mesh: ringMesh,
      mat: ringMat,
      life: 0,
      maxLife: isHeavy ? 0.32 : 0.22,
      maxScale: isHeavy ? 3.2 : 2.0
    });

    // High-speed fire sparks shooting along barrel direction
    const sparkCount = isHeavy ? 6 : 4;
    for (let i = 0; i < sparkCount; i++) {
      const sMesh = new THREE.Mesh(this.sparkGeo, this.sparkMat);
      sMesh.position.copy(pos);
      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.6
      );
      const vel = dir.clone().multiplyScalar(5.5 + Math.random() * 4.0).add(spread);
      this.scene.add(sMesh);
      this.particles.push({
        mesh: sMesh,
        vel,
        rotVel: new THREE.Vector3(6, 6, 6),
        life: 0,
        maxLife: 0.15 + Math.random() * 0.1,
        gravity: 8,
        shrink: true,
        minY: pos.y - 0.5
      });
    }
  }

  /**
   * Spawns projectile impact VFX depending on style.
   */
  spawnImpact(pos: THREE.Vector3, style: 'ap' | 'heavy' | 'he' | 'electric' | 'mini_artillery' | string = 'ap'): void {
    if (style === 'electric') {
      // Dazzling electric discharge: cyan-white sparks + mini jittering lightning arcs
      for (let i = 0; i < 14; i++) {
        const mesh = new THREE.Mesh(this.sparkGeo, i % 2 === 0 ? this.electricSparkMat : this.sparkMat);
        mesh.position.copy(pos);
        const angle = Math.random() * Math.PI * 2;
        const elev = (Math.random() - 0.2) * Math.PI * 0.5;
        const spd = 3.5 + Math.random() * 5.0;
        const vel = new THREE.Vector3(
          Math.cos(angle) * Math.cos(elev) * spd,
          Math.sin(elev) * spd + 1.5,
          Math.sin(angle) * Math.cos(elev) * spd
        );
        this.scene.add(mesh);
        this.particles.push({
          mesh,
          vel,
          rotVel: new THREE.Vector3(12, 12, 12),
          life: 0,
          maxLife: 0.22 + Math.random() * 0.12,
          gravity: 6,
          shrink: true,
          minY: pos.y
        });
      }

      // 2 mini electric crackle branches around hit point
      for (let i = 0; i < 2; i++) {
        const target = pos.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 1.6,
          (Math.random() - 0.2) * 1.2,
          (Math.random() - 0.5) * 1.6
        ));
        this.spawnElectricArc(pos, target);
      }
      return;
    }

    if (style === 'he' || style === 'mini_artillery') {
      // Explosive dirt / blast wave
      const isMini = style === 'mini_artillery';
      const count = isMini ? 8 : 14;
      for (let i = 0; i < count; i++) {
        const mat = i % 2 === 0 ? this.brickDebrisMat : this.fireMats[i % this.fireMats.length];
        const mesh = new THREE.Mesh(this.boxGeo, mat);
        mesh.scale.setScalar(isMini ? 0.7 : 1.0);
        mesh.position.copy(pos);
        const angle = Math.random() * Math.PI * 2;
        const spd = (isMini ? 2.5 : 3.5) + Math.random() * (isMini ? 3.0 : 4.5);
        this.scene.add(mesh);
        this.particles.push({
          mesh,
          vel: new THREE.Vector3(Math.cos(angle) * spd, 3.2 + Math.random() * 3.5, Math.sin(angle) * spd),
          rotVel: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
          life: 0,
          maxLife: 0.4 + Math.random() * 0.2,
          gravity: 14,
          shrink: true,
          minY: pos.y,
          bounces: true
        });
      }

      // Small shockwave
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(this.ringGeo, ringMat);
      ringMesh.position.set(pos.x, pos.y + 0.05, pos.z);
      this.scene.add(ringMesh);
      this.rings.push({
        mesh: ringMesh,
        mat: ringMat,
        life: 0,
        maxLife: isMini ? 0.2 : 0.3,
        maxScale: isMini ? 2.2 : 3.5
      });

      this.spawnCrater(pos, isMini ? 0.8 : 1.2);
      return;
    }

    // Default 'ap' / 'heavy' ricochet armor sparks
    const isHeavy = style === 'heavy';
    const sparkCount = isHeavy ? 14 : 9;
    for (let i = 0; i < sparkCount; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, this.sparkMat);
      mesh.position.copy(pos);
      const angle = Math.random() * Math.PI * 2;
      const spd = 3.5 + Math.random() * 5.5;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * spd, 2.5 + Math.random() * 4.0, Math.sin(angle) * spd),
        rotVel: new THREE.Vector3(6, 6, 6),
        life: 0,
        maxLife: 0.24 + Math.random() * 0.12,
        gravity: 12,
        shrink: true,
        minY: pos.y,
        bounces: true
      });
    }

    // 2-3 tiny metal flecks
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(this.debrisGeo, this.metalDebrisMat);
      mesh.position.copy(pos);
      const angle = Math.random() * Math.PI * 2;
      const spd = 2.0 + Math.random() * 3.0;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * spd, 3.0 + Math.random() * 2.5, Math.sin(angle) * spd),
        rotVel: new THREE.Vector3(10, 10, 10),
        life: 0,
        maxLife: 0.35 + Math.random() * 0.15,
        gravity: 16,
        shrink: true,
        minY: pos.y,
        bounces: true
      });
    }
  }

  /**
   * Spawns broken 3D Tesla electric lightning arc between two points.
   * Flickers dynamically and disappears in ~0.28s.
   */
  spawnElectricArc(from: THREE.Vector3, to: THREE.Vector3): void {
    const disp = to.clone().sub(from);
    const dist = disp.length();
    if (dist < 0.05) return;

    // Subdivide into zigzag segments
    const segments = Math.max(6, Math.min(16, Math.floor(dist * 4)));
    const points: THREE.Vector3[] = [];
    points.push(from.clone());

    // Create perpendicular vectors for random jitter
    const norm = disp.clone().normalize();
    const up = Math.abs(norm.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const perp1 = new THREE.Vector3().crossVectors(norm, up).normalize();
    const perp2 = new THREE.Vector3().crossVectors(norm, perp1).normalize();

    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      // Parabolic envelope: jitter is zero at ends and maximum at center
      const envelope = Math.sin(t * Math.PI);
      const jitterMax = Math.min(0.7, dist * 0.18) * envelope;
      const j1 = (Math.random() - 0.5) * 2 * jitterMax;
      const j2 = (Math.random() - 0.5) * 2 * jitterMax;

      const p = from.clone().lerp(to, t)
        .addScaledVector(perp1, j1)
        .addScaledVector(perp2, j2);
      points.push(p);
    }
    points.push(to.clone());

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 1.0,
      linewidth: 2
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);

    this.electricArcs.push({
      line,
      geo,
      mat,
      life: 0,
      maxLife: 0.28,
      baseOpacity: 1.0
    });
  }

  /**
   * Powerful explosion with fire core, shockwave, thick black smoke, and flying debris.
   * Supports both 3D Vector3 and legacy (x, z, big).
   */
  spawnExplosion(
    posOrX: THREE.Vector3 | number,
    scaleOrZ = 1.0,
    isElectricOrBig: boolean = false
  ): void {
    let pos: THREE.Vector3;
    let scale = 1.0;
    let isElectric = false;

    if (typeof posOrX === 'number') {
      // Legacy signature: (x: number, z: number, big = false)
      pos = new THREE.Vector3(posOrX, 0.6, typeof scaleOrZ === 'number' ? scaleOrZ : 0);
      scale = isElectricOrBig ? 1.6 : 1.0;
      isElectric = false;
    } else {
      pos = posOrX;
      scale = typeof scaleOrZ === 'number' ? scaleOrZ : 1.0;
      isElectric = isElectricOrBig;
    }

    const count = Math.floor(22 * scale);
    const materials = isElectric ? this.electricMats : this.fireMats;

    // 1. Fiery or Plasma core debris particles
    for (let i = 0; i < count; i++) {
      const mat = materials[i % materials.length];
      const mesh = new THREE.Mesh(this.boxGeo, mat);
      const pScale = (0.9 + Math.random() * 0.8) * scale;
      mesh.scale.setScalar(pScale);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.6 * scale,
        pos.y + (Math.random() - 0.5) * 0.4 * scale,
        pos.z + (Math.random() - 0.5) * 0.6 * scale
      );

      const angle = Math.random() * Math.PI * 2;
      const spd = (2.5 + Math.random() * 5.5) * scale;

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          Math.cos(angle) * spd,
          (3.5 + Math.random() * 5.5) * scale,
          Math.sin(angle) * spd
        ),
        rotVel: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
        life: 0,
        maxLife: (0.45 + Math.random() * 0.3) * Math.min(1.4, scale),
        gravity: 12,
        shrink: true,
        minY: pos.y - 0.2,
        bounces: true
      });
    }

    // 2. Thick rising black / dark smoke clouds
    const smokeCount = Math.floor(10 * scale);
    for (let i = 0; i < smokeCount; i++) {
      const mat = this.smokeMats[i % this.smokeMats.length];
      const mesh = new THREE.Mesh(this.smokeGeo, mat);
      const sScale = (1.0 + Math.random() * 1.2) * scale;
      mesh.scale.setScalar(sScale);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.8 * scale,
        pos.y + 0.3 + Math.random() * 0.4,
        pos.z + (Math.random() - 0.5) * 0.8 * scale
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 1.5 * scale,
          1.8 + Math.random() * 2.2,
          (Math.random() - 0.5) * 1.5 * scale
        ),
        rotVel: new THREE.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4),
        life: 0,
        maxLife: (0.8 + Math.random() * 0.5) * Math.min(1.5, scale),
        gravity: -1.2, // Floats smoothly upwards
        shrink: true,
        minY: pos.y
      });
    }

    // 3. Shrapnel / metal debris with high gravity and bouncing
    const metalCount = Math.floor(6 * scale);
    for (let i = 0; i < metalCount; i++) {
      const mesh = new THREE.Mesh(this.debrisGeo, this.metalDebrisMat);
      mesh.position.copy(pos);
      const angle = Math.random() * Math.PI * 2;
      const spd = (3.0 + Math.random() * 5.0) * scale;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          Math.cos(angle) * spd,
          (4.5 + Math.random() * 4.5) * scale,
          Math.sin(angle) * spd
        ),
        rotVel: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12),
        life: 0,
        maxLife: 0.6 + Math.random() * 0.3,
        gravity: 18,
        shrink: false,
        minY: pos.y,
        bounces: true
      });
    }

    // 4. Expanding shockwave ring
    const ringMat = new THREE.MeshBasicMaterial({
      color: isElectric ? 0x38bdf8 : (scale > 1.2 ? 0xf43f5e : 0xfbbf24),
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(this.ringGeo, ringMat);
    ringMesh.position.set(pos.x, pos.y + 0.06, pos.z);
    this.scene.add(ringMesh);

    this.rings.push({
      mesh: ringMesh,
      mat: ringMat,
      life: 0,
      maxLife: (scale > 1.2 ? 0.52 : 0.36),
      maxScale: (scale > 1.2 ? 6.5 : 4.0) * scale
    });

    // 5. Electric crackles if electric explosion
    if (isElectric) {
      for (let i = 0; i < 4; i++) {
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 3.5 * scale,
          (Math.random() - 0.2) * 2.5 * scale,
          (Math.random() - 0.5) * 3.5 * scale
        );
        this.spawnElectricArc(pos, pos.clone().add(offset));
      }
    }

    // 6. Leave scorch crater on ground
    this.spawnCrater(pos, 1.3 * scale);
  }

  /**
   * Spawns paired left and right track marks on ground with terrain height and normal support.
   * Memory pooled up to 160 marks for stable 60 FPS.
   */
  spawnTrackMark(
    posOrX: THREE.Vector3 | number,
    yawOrZ: number,
    trackHalfWidthOrAngle = 0.85,
    groundNormal?: THREE.Vector3
  ): void {
    let pos: THREE.Vector3;
    let yaw: number;
    let trackHalfWidth = 0.85;

    if (posOrX instanceof THREE.Vector3) {
      pos = posOrX;
      yaw = yawOrZ;
      trackHalfWidth = trackHalfWidthOrAngle;
    } else {
      // Legacy signature: spawnTreadMark(x, z, hullAngleY)
      pos = new THREE.Vector3(posOrX, 0.0, yawOrZ);
      yaw = trackHalfWidthOrAngle;
      trackHalfWidth = 0.64;
    }

    // Limit pool to max 160 tread marks
    if (this.treadMarks.length >= 160) {
      const oldest = this.treadMarks.shift();
      if (oldest) {
        this.scene.remove(oldest.group);
        oldest.mat.dispose();
      }
    }

    const group = new THREE.Group();
    group.position.set(pos.x, pos.y + 0.04, pos.z);

    if (groundNormal) {
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), groundNormal);
      group.rotateY(yaw);
    } else {
      group.rotation.y = yaw;
    }

    const mat = new THREE.MeshBasicMaterial({
      color: 0x05070e,
      transparent: true,
      opacity: 0.42,
      depthWrite: false
    });

    const leftMesh = new THREE.Mesh(this.treadPlaneGeo, mat);
    leftMesh.position.set(-trackHalfWidth, 0, 0);

    const rightMesh = new THREE.Mesh(this.treadPlaneGeo, mat);
    rightMesh.position.set(trackHalfWidth, 0, 0);

    group.add(leftMesh, rightMesh);
    this.scene.add(group);

    this.treadMarks.push({
      group,
      mat,
      life: 0,
      maxLife: 4.5
    });
  }

  /** Backward-compatible alias for spawnTrackMark */
  spawnTreadMark(x: number, z: number, hullAngleY: number): void {
    this.spawnTrackMark(x, z, hullAngleY);
  }

  /**
   * Spawns dark scorch crater on ground. Pooled up to 40 craters.
   */
  spawnCrater(posOrX: THREE.Vector3 | number, radiusOrZ = 1.4, maybeBig?: boolean): void {
    let pos: THREE.Vector3;
    let radius = 1.4;

    if (posOrX instanceof THREE.Vector3) {
      pos = posOrX;
      radius = radiusOrZ;
    } else {
      // Legacy signature: spawnScorchCrater(x, z, big = false)
      const isBig = maybeBig !== undefined ? maybeBig : (radiusOrZ > 1.2);
      pos = new THREE.Vector3(posOrX, 0.0, radiusOrZ);
      radius = isBig ? 1.6 : 0.95;
    }

    // Limit pool to max 40 craters
    if (this.scorchCraters.length >= 40) {
      const oldest = this.scorchCraters.shift();
      if (oldest) {
        this.scene.remove(oldest.mesh);
        oldest.mat.dispose();
      }
    }

    const initOpacity = radius > 1.3 ? 0.72 : 0.54;
    const mat = new THREE.MeshBasicMaterial({
      color: 0x06080e,
      transparent: true,
      opacity: initOpacity,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(this.craterGeo, mat);
    mesh.scale.set(radius, 1, radius);
    mesh.position.set(pos.x, pos.y + 0.02, pos.z);
    this.scene.add(mesh);

    this.scorchCraters.push({
      mesh,
      mat,
      life: 0,
      maxLife: 10.0,
      initOpacity
    });
  }

  /** Backward-compatible alias for spawnCrater */
  spawnScorchCrater(x: number, z: number, big = false): void {
    this.spawnCrater(x, z, big);
  }

  /**
   * Green repair nanobots / fireflies floating around tank during Repair Kit action!
   */
  spawnRepairEffect(pos: THREE.Vector3): void {
    for (let i = 0; i < 7; i++) {
      const group = new THREE.Group();
      const hBar = new THREE.Mesh(this.plusHGeo, this.repairMat);
      const vBar = new THREE.Mesh(this.plusVGeo, this.repairMat);
      group.add(hBar, vBar);

      group.position.set(
        pos.x + (Math.random() - 0.5) * 1.6,
        pos.y + 0.3 + Math.random() * 0.6,
        pos.z + (Math.random() - 0.5) * 1.6
      );
      group.scale.setScalar(0.7 + Math.random() * 0.4);

      this.scene.add(group);
      this.particles.push({
        mesh: group,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          1.6 + Math.random() * 1.2,
          (Math.random() - 0.5) * 0.8
        ),
        rotVel: new THREE.Vector3(0, 3 + Math.random() * 4, 0),
        life: 0,
        maxLife: 0.65 + Math.random() * 0.25,
        gravity: -0.5, // Floats upwards
        shrink: true,
        minY: pos.y
      });
    }
  }

  /**
   * Backward-compatible brick debris VFX.
   */
  spawnBrickDebris(x: number, z: number, y = 0.55): void {
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(this.boxGeo, this.brickDebrisMat);
      mesh.position.set(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4);
      const angle = Math.random() * Math.PI * 2;
      const spd = 2.2 + Math.random() * 3.8;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * spd, 4.2 + Math.random() * 3.5, Math.sin(angle) * spd),
        rotVel: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
        life: 0,
        maxLife: 0.52 + Math.random() * 0.2,
        gravity: 16,
        shrink: true,
        minY: y - 0.4,
        bounces: true
      });
    }
  }

  /**
   * Backward-compatible sparks VFX.
   */
  spawnSparks(x: number, z: number, y = 0.72): void {
    for (let i = 0; i < 7; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, this.sparkMat);
      mesh.position.set(x, y, z);
      const angle = Math.random() * Math.PI * 2;
      const spd = 3.5 + Math.random() * 4.5;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * spd, 2.5 + Math.random() * 3, Math.sin(angle) * spd),
        rotVel: new THREE.Vector3(6, 6, 6),
        life: 0,
        maxLife: 0.24 + Math.random() * 0.12,
        gravity: 12,
        shrink: true,
        minY: y - 0.6,
        bounces: true
      });
    }
  }

  /**
   * Backward-compatible projectile smoke/fire trail.
   */
  spawnProjectileTrail(x: number, z: number, colorHex = 0xf97316, y = 0.72): void {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.8
    });
    const mesh = new THREE.Mesh(this.trailGeo, mat);
    mesh.position.set(x + (Math.random() - 0.5) * 0.08, y, z + (Math.random() - 0.5) * 0.08);
    this.scene.add(mesh);

    this.particles.push({
      mesh,
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4),
      rotVel: new THREE.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4),
      life: 0,
      maxLife: 0.24,
      gravity: -1.2,
      shrink: true,
      minY: y - 0.5
    });
  }

  /**
   * Backward-compatible Railgun energy beam.
   */
  spawnRailgunBeam(x1: number, z1: number, x2: number, z2: number, y1 = 0.76, y2 = 0.76): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.1) return;

    const group = new THREE.Group();
    group.position.set((x1 + x2) * 0.5, (y1 + y2) * 0.5, (z1 + z2) * 0.5);
    group.lookAt(x2, y2, z2);

    const beamGeo = new THREE.CylinderGeometry(0.14, 0.14, len, 8);
    beamGeo.rotateX(Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });
    const beamMesh = new THREE.Mesh(beamGeo, mat);
    group.add(beamMesh);

    const coreGeo = new THREE.CylinderGeometry(0.06, 0.06, len, 8);
    coreGeo.rotateX(Math.PI / 2);

    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      depthWrite: false
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    this.scene.add(group);

    this.railgunBeams.push({
      group,
      mat,
      coreMat,
      life: 0,
      maxLife: 0.26
    });
  }

  /**
   * Updates all active particles, shock rings, track marks, craters, flashes, and electric arcs.
   */
  update(dt: number): void {
    // 1. Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }

      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);

      if (p.mesh.position.y < p.minY) {
        p.mesh.position.y = p.minY;
        if (p.bounces) {
          p.vel.y *= -0.35;
          p.vel.x *= 0.65;
          p.vel.z *= 0.65;
        }
      }

      p.mesh.rotation.x += p.rotVel.x * dt;
      p.mesh.rotation.y += p.rotVel.y * dt;

      if (p.shrink) {
        const s = Math.max(0.05, 1 - p.life / p.maxLife);
        p.mesh.scale.setScalar(s);
      }
    }

    // 2. Shock rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += dt;
      if (r.life >= r.maxLife) {
        this.scene.remove(r.mesh);
        r.mat.dispose();
        this.rings.splice(i, 1);
        continue;
      }
      const t = r.life / r.maxLife;
      const sc = 1 + t * r.maxScale;
      r.mesh.scale.setScalar(sc);
      r.mat.opacity = 0.85 * (1 - t);
    }

    // 3. Track marks
    for (let i = this.treadMarks.length - 1; i >= 0; i--) {
      const t = this.treadMarks[i];
      t.life += dt;
      if (t.life >= t.maxLife) {
        this.scene.remove(t.group);
        t.mat.dispose();
        this.treadMarks.splice(i, 1);
        continue;
      }
      t.mat.opacity = 0.42 * (1 - t.life / t.maxLife);
    }

    // 4. Scorch craters
    for (let i = this.scorchCraters.length - 1; i >= 0; i--) {
      const c = this.scorchCraters[i];
      c.life += dt;
      if (c.life >= c.maxLife) {
        this.scene.remove(c.mesh);
        c.mat.dispose();
        this.scorchCraters.splice(i, 1);
        continue;
      }
      c.mat.opacity = c.initOpacity * (1 - c.life / c.maxLife);
    }

    // 5. Muzzle flashes
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      const f = this.muzzleFlashes[i];
      f.life += dt;
      if (f.life >= f.maxLife) {
        this.scene.remove(f.mesh);
        f.mat.dispose();
        this.muzzleFlashes.splice(i, 1);
        continue;
      }
      const t = f.life / f.maxLife;
      const s = f.startScale + t * (f.endScale - f.startScale);
      f.mesh.scale.setScalar(s);
      f.mat.opacity = 0.95 * (1 - t);
    }

    // 6. Railgun beams
    for (let i = this.railgunBeams.length - 1; i >= 0; i--) {
      const b = this.railgunBeams[i];
      b.life += dt;
      if (b.life >= b.maxLife) {
        this.scene.remove(b.group);
        b.mat.dispose();
        b.coreMat.dispose();
        b.group.traverse(obj => {
          if (obj instanceof THREE.Mesh) obj.geometry.dispose();
        });
        this.railgunBeams.splice(i, 1);
        continue;
      }
      const t = b.life / b.maxLife;
      b.group.scale.x = 1.0 + t * 0.8;
      b.group.scale.y = 1.0 + t * 0.8;
      b.mat.opacity = 0.95 * (1 - t);
      b.coreMat.opacity = 1.0 * (1 - t);
    }

    // 7. Electric arcs
    for (let i = this.electricArcs.length - 1; i >= 0; i--) {
      const a = this.electricArcs[i];
      a.life += dt;
      if (a.life >= a.maxLife) {
        this.scene.remove(a.line);
        a.geo.dispose();
        a.mat.dispose();
        this.electricArcs.splice(i, 1);
        continue;
      }
      // High-frequency Tesla flicker
      const t = a.life / a.maxLife;
      const flicker = 0.6 + Math.random() * 0.4;
      a.mat.opacity = a.baseOpacity * (1 - t) * flicker;
    }
  }

  /**
   * Cleans up all active particles, track marks, craters, flashes, and electric arcs.
   */
  clear(): void {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
    }
    this.particles = [];

    for (const r of this.rings) {
      this.scene.remove(r.mesh);
      r.mat.dispose();
    }
    this.rings = [];

    for (const t of this.treadMarks) {
      this.scene.remove(t.group);
      t.mat.dispose();
    }
    this.treadMarks = [];

    for (const c of this.scorchCraters) {
      this.scene.remove(c.mesh);
      c.mat.dispose();
    }
    this.scorchCraters = [];

    for (const f of this.muzzleFlashes) {
      this.scene.remove(f.mesh);
      f.mat.dispose();
    }
    this.muzzleFlashes = [];

    for (const b of this.railgunBeams) {
      this.scene.remove(b.group);
      b.mat.dispose();
      b.coreMat.dispose();
      b.group.traverse(obj => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      });
    }
    this.railgunBeams = [];

    for (const a of this.electricArcs) {
      this.scene.remove(a.line);
      a.geo.dispose();
      a.mat.dispose();
    }
    this.electricArcs = [];
  }
}
