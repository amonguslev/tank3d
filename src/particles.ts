import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  rotVel: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  shrink: boolean;
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

interface MuzzleFlash {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
}

interface RailgunBeam {
  group: THREE.Group;
  mat: THREE.MeshBasicMaterial;
  coreMat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private rings: ShockRing[] = [];
  private treadMarks: TreadMark[] = [];
  private scorchCraters: ScorchCrater[] = [];
  private muzzleFlashes: MuzzleFlash[] = [];
  private railgunBeams: RailgunBeam[] = [];

  private boxGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
  private sparkGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  private trailGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
  private ringGeo: THREE.RingGeometry;
  private treadPlaneGeo: THREE.PlaneGeometry;

  private brickDebrisMat = new THREE.MeshStandardMaterial({ color: 0xc25432, roughness: 0.9 });
  private sparkMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  private fireMats = [
    new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    new THREE.MeshBasicMaterial({ color: 0xf97316 }),
    new THREE.MeshBasicMaterial({ color: 0xef4444 }),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95 })
  ];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.ringGeo = new THREE.RingGeometry(0.25, 0.45, 24);
    this.ringGeo.rotateX(-Math.PI / 2);

    this.treadPlaneGeo = new THREE.PlaneGeometry(0.28, 0.42);
    this.treadPlaneGeo.rotateX(-Math.PI / 2);
  }

  spawnBrickDebris(x: number, z: number): void {
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(this.boxGeo, this.brickDebrisMat);
      mesh.position.set(x + (Math.random() - 0.5) * 0.4, 0.55, z + (Math.random() - 0.5) * 0.4);
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
        shrink: true
      });
    }
  }

  spawnSparks(x: number, z: number): void {
    for (let i = 0; i < 7; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, this.sparkMat);
      mesh.position.set(x, 0.72, z);
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
        shrink: true
      });
    }
  }

  spawnExplosion(x: number, z: number, big = false): void {
    const count = big ? 26 : 16;
    for (let i = 0; i < count; i++) {
      const mat = this.fireMats[i % this.fireMats.length];
      const mesh = new THREE.Mesh(this.boxGeo, mat);
      const scale = big ? 1.55 : 1.1;
      mesh.scale.setScalar(scale);
      mesh.position.set(x + (Math.random() - 0.5) * 0.6, 0.6, z + (Math.random() - 0.5) * 0.6);

      const angle = Math.random() * Math.PI * 2;
      const spd = (big ? 3.5 : 2.2) + Math.random() * (big ? 6.5 : 4.5);

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * spd, 3.8 + Math.random() * 5.2, Math.sin(angle) * spd),
        rotVel: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
        life: 0,
        maxLife: (big ? 0.65 : 0.45) + Math.random() * 0.25,
        gravity: 11,
        shrink: true
      });
    }

    // Expanding shockwave ring
    const mat = new THREE.MeshBasicMaterial({
      color: big ? 0xf43f5e : 0xfbbf24,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(this.ringGeo, mat);
    ringMesh.position.set(x, 0.08, z);
    this.scene.add(ringMesh);
    this.rings.push({
      mesh: ringMesh,
      mat,
      life: 0,
      maxLife: big ? 0.5 : 0.34,
      maxScale: big ? 6.5 : 3.8
    });

    // Leave a dark burnt crater from explosions
    this.spawnScorchCrater(x, z, big);
  }

  spawnTreadMark(x: number, z: number, hullAngleY: number): void {
    // Limit to max 120 tread marks to ensure stable 60 FPS
    if (this.treadMarks.length >= 120) {
      const oldest = this.treadMarks.shift();
      if (oldest) {
        this.scene.remove(oldest.group);
        oldest.mat.dispose();
      }
    }

    const group = new THREE.Group();
    group.position.set(x, 0.025, z);
    group.rotation.y = hullAngleY;

    const mat = new THREE.MeshBasicMaterial({
      color: 0x05070f,
      transparent: true,
      opacity: 0.38,
      depthWrite: false
    });

    // Left and Right tread prints
    const leftMesh = new THREE.Mesh(this.treadPlaneGeo, mat);
    leftMesh.position.set(-0.64, 0, 0);

    const rightMesh = new THREE.Mesh(this.treadPlaneGeo, mat);
    rightMesh.position.set(0.64, 0, 0);

    group.add(leftMesh, rightMesh);
    this.scene.add(group);

    this.treadMarks.push({
      group,
      mat,
      life: 0,
      maxLife: 4.0 // Fades smoothly over 4s
    });
  }

  spawnScorchCrater(x: number, z: number, big = false): void {
    // Limit to max 30 craters
    if (this.scorchCraters.length >= 30) {
      const oldest = this.scorchCraters.shift();
      if (oldest) {
        this.scene.remove(oldest.mesh);
        oldest.mesh.geometry.dispose();
        oldest.mat.dispose();
      }
    }

    const radius = big ? 1.6 : 0.95;
    const geo = new THREE.CircleGeometry(radius, 16);
    geo.rotateX(-Math.PI / 2);

    const initOpacity = big ? 0.72 : 0.54;
    const mat = new THREE.MeshBasicMaterial({
      color: 0x06080e,
      transparent: true,
      opacity: initOpacity,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.02, z);
    this.scene.add(mesh);

    this.scorchCraters.push({
      mesh,
      mat,
      life: 0,
      maxLife: 10.0, // Fades smoothly over 10s
      initOpacity
    });
  }

  spawnMuzzleFlash(x: number, z: number, colorHex = 0xfef08a): void {
    const geo = new THREE.OctahedronGeometry(0.32, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.95
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.76, z);
    this.scene.add(mesh);

    this.muzzleFlashes.push({
      mesh,
      mat,
      life: 0,
      maxLife: 0.09
    });
  }

  spawnProjectileTrail(x: number, z: number, colorHex = 0xf97316): void {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.8
    });
    const mesh = new THREE.Mesh(this.trailGeo, mat);
    mesh.position.set(x + (Math.random() - 0.5) * 0.08, 0.72, z + (Math.random() - 0.5) * 0.08);
    this.scene.add(mesh);

    this.particles.push({
      mesh,
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4),
      rotVel: new THREE.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4),
      life: 0,
      maxLife: 0.24,
      gravity: -1.2, // Floats gently up
      shrink: true
    });
  }

  spawnRailgunBeam(x1: number, z1: number, x2: number, z2: number): void {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.1) return;

    const group = new THREE.Group();
    group.position.set((x1 + x2) * 0.5, 0.76, (z1 + z2) * 0.5);

    // Rotate towards target (x2, 0.76, z2)
    group.lookAt(x2, 0.76, z2);

    // Outer cyan glow beam
    const beamGeo = new THREE.CylinderGeometry(0.14, 0.14, len, 8);
    beamGeo.rotateX(Math.PI / 2); // align with Z axis

    const mat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });
    const beamMesh = new THREE.Mesh(beamGeo, mat);
    group.add(beamMesh);

    // Inner bright white energy core
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

  update(dt: number): void {
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
      if (p.mesh.position.y < 0.12) {
        p.mesh.position.y = 0.12;
        p.vel.y *= -0.35;
        p.vel.x *= 0.7;
        p.vel.z *= 0.7;
      }

      p.mesh.rotation.x += p.rotVel.x * dt;
      p.mesh.rotation.y += p.rotVel.y * dt;

      if (p.shrink) {
        const s = Math.max(0.05, 1 - p.life / p.maxLife);
        p.mesh.scale.setScalar(s);
      }
    }

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

    for (let i = this.treadMarks.length - 1; i >= 0; i--) {
      const t = this.treadMarks[i];
      t.life += dt;
      if (t.life >= t.maxLife) {
        this.scene.remove(t.group);
        t.mat.dispose();
        this.treadMarks.splice(i, 1);
        continue;
      }
      t.mat.opacity = 0.38 * (1 - t.life / t.maxLife);
    }

    for (let i = this.scorchCraters.length - 1; i >= 0; i--) {
      const c = this.scorchCraters[i];
      c.life += dt;
      if (c.life >= c.maxLife) {
        this.scene.remove(c.mesh);
        c.mesh.geometry.dispose();
        c.mat.dispose();
        this.scorchCraters.splice(i, 1);
        continue;
      }
      c.mat.opacity = c.initOpacity * (1 - c.life / c.maxLife);
    }

    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      const f = this.muzzleFlashes[i];
      f.life += dt;
      if (f.life >= f.maxLife) {
        this.scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        f.mat.dispose();
        this.muzzleFlashes.splice(i, 1);
        continue;
      }
      const t = f.life / f.maxLife;
      f.mesh.scale.setScalar(0.6 + t * 0.9);
      f.mat.opacity = 0.95 * (1 - t);
    }

    for (let i = this.railgunBeams.length - 1; i >= 0; i--) {
      const b = this.railgunBeams[i];
      b.life += dt;
      if (b.life >= b.maxLife) {
        this.scene.remove(b.group);
        b.mat.dispose();
        b.coreMat.dispose();
        b.group.traverse(obj => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
          }
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
  }

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
      c.mesh.geometry.dispose();
      c.mat.dispose();
    }
    this.scorchCraters = [];

    for (const f of this.muzzleFlashes) {
      this.scene.remove(f.mesh);
      f.mesh.geometry.dispose();
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
  }
}
