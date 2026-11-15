import * as THREE from 'three';
import { TANK_SPECS } from './classes';
import type { PowerUpKind, ProjectileStyle, TankTierId } from './types';

// ============================================================================
// Types & Contracts
// ============================================================================

export interface TankVisualRig {
  root: THREE.Group;
  hullGroup: THREE.Group;
  frontTurretPivot: THREE.Group;
  frontGunPivot: THREE.Group;
  frontMuzzle: THREE.Object3D;
  frontSniperAnchor: THREE.Object3D;
  rearTurretPivot: THREE.Group | null;
  rearGunPivot: THREE.Group | null;
  rearMuzzle: THREE.Object3D | null;
  rearSniperAnchor: THREE.Object3D | null;
  shieldMesh: THREE.Mesh;
  halfLength: number;
  halfWidth: number;
  height: number;
  updateVisuals: (timeSec: number, frontRecoil: number, rearRecoil: number) => void;
}

// ============================================================================
// Shared Reusable Geometries & Helper Utilities
// ============================================================================

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
cylGeo.rotateX(Math.PI / 2); // default along Z if needed

function makeBox(
  w: number,
  h: number,
  d: number,
  material: THREE.Material | THREE.Material[],
  castShadow = true
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

function makeCylinder(
  rTop: number,
  rBot: number,
  length: number,
  radialSegments: number,
  material: THREE.Material,
  axis: 'x' | 'y' | 'z' = 'y',
  castShadow = true
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(rTop, rBot, length, radialSegments);
  if (axis === 'x') geo.rotateZ(-Math.PI / 2);
  else if (axis === 'z') geo.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

// Procedural textures for realistic armor & tread plates
function createHazardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = '#18181b';
  const stripeW = 16;
  for (let x = -32; x < 160; x += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + stripeW, 0);
    ctx.lineTo(x + stripeW - 14, 32);
    ctx.lineTo(x - 14, 32);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const sharedHazardTex = createHazardTexture();

// ============================================================================
// Tank Rig Builder (WoT Authentic Stylized Aesthetics)
// ============================================================================

export function createTankRig(
  tierId: TankTierId,
  options?: { isEnemy?: boolean; isBoss?: boolean; scaleOverride?: number }
): TankVisualRig {
  const isEnemy = !!options?.isEnemy;
  const isBoss = !!options?.isBoss;
  const scaleOverride = options?.scaleOverride ?? 1.0;

  const spec = TANK_SPECS[tierId];

  // Primary palette selection
  let hullBaseColor = spec.hullColor;
  let turretBaseColor = spec.turretColor;
  let accentBaseColor = spec.accentColor;
  let metalness = 0.45;
  let roughness = 0.6;

  if (isBoss) {
    hullBaseColor = 0x111317; // Obsidian Black
    turretBaseColor = 0x18181b;
    accentBaseColor = 0xf59e0b; // Flaming Gold
    metalness = 0.8;
    roughness = 0.35;
  } else if (isEnemy) {
    hullBaseColor = 0x450a0a; // Hostile Blood/Crimson Camo
    turretBaseColor = 0x3f1212;
    accentBaseColor = 0xef4444; // Warning Red
    metalness = 0.55;
    roughness = 0.5;
  }

  // Materials
  const hullMat = new THREE.MeshStandardMaterial({
    color: hullBaseColor,
    roughness,
    metalness
  });

  const turretMat = new THREE.MeshStandardMaterial({
    color: turretBaseColor,
    roughness: roughness * 0.95,
    metalness: Math.min(metalness + 0.05, 0.9)
  });

  const armorDarkMat = new THREE.MeshStandardMaterial({
    color: 0x1c1917,
    roughness: 0.8,
    metalness: 0.3
  });

  const metalTrimMat = new THREE.MeshStandardMaterial({
    color: isBoss ? 0xf59e0b : 0x71717a,
    roughness: 0.3,
    metalness: 0.85
  });

  const trackRubberMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.9,
    metalness: 0.1
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: isEnemy && !isBoss ? 0xff4444 : isBoss ? 0xffaa00 : 0xfffbeb,
    emissive: isEnemy && !isBoss ? 0xff0000 : isBoss ? 0xff8800 : 0xfef08a,
    emissiveIntensity: 1.8,
    roughness: 0.1,
    metalness: 0.1
  });

  const exhaustMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    roughness: 0.7,
    metalness: 0.6
  });

  const teslaActiveMats: THREE.MeshStandardMaterial[] = [];

  // Hierarchy Roots
  const root = new THREE.Group();
  root.name = `TankRig_${tierId}`;

  const hullGroup = new THREE.Group();
  hullGroup.name = 'HullGroup';
  root.add(hullGroup);

  const frontTurretPivot = new THREE.Group();
  frontTurretPivot.name = 'FrontTurretPivot';
  root.add(frontTurretPivot);

  const frontGunPivot = new THREE.Group();
  frontGunPivot.name = 'FrontGunPivot';
  frontTurretPivot.add(frontGunPivot);

  const frontMuzzle = new THREE.Object3D();
  frontMuzzle.name = 'FrontMuzzle';
  frontGunPivot.add(frontMuzzle);

  const frontSniperAnchor = new THREE.Object3D();
  frontSniperAnchor.name = 'FrontSniperAnchor';
  frontTurretPivot.add(frontSniperAnchor);

  let rearTurretPivot: THREE.Group | null = null;
  let rearGunPivot: THREE.Group | null = null;
  let rearMuzzle: THREE.Object3D | null = null;
  let rearSniperAnchor: THREE.Object3D | null = null;

  let frontGunMesh: THREE.Object3D = frontGunPivot;
  let rearGunMesh: THREE.Object3D | null = null;
  const frontGunInitialZ = 0;
  let rearGunInitialZ = 0;

  // Track Dimensions per Tier
  let hullLen = 3.3;
  let hullWid = 1.6;
  let hullH = 0.75;
  let trackWid = 0.36;
  let wheelRadius = 0.3;
  let wheelCount = 4;
  let turretBaseY = 0.95;
  let turretZ = 0.05;

  if (tierId === 'tier1') {
    hullLen = 3.2;
    hullWid = 1.5;
    hullH = 0.7;
    trackWid = 0.34;
    wheelRadius = 0.28;
    wheelCount = 4;
    turretBaseY = 0.9;
    turretZ = 0.1;
  } else if (tierId === 'tier2') {
    hullLen = 3.6;
    hullWid = 1.65;
    hullH = 0.78;
    trackWid = 0.38;
    wheelRadius = 0.32;
    wheelCount = 5;
    turretBaseY = 0.98;
    turretZ = 0.05;
  } else if (tierId === 'tier3') {
    hullLen = 4.1;
    hullWid = 1.85;
    hullH = 0.88;
    trackWid = 0.44;
    wheelRadius = 0.34;
    wheelCount = 6;
    turretBaseY = 1.08;
    turretZ = 0.0;
  } else if (tierId === 'tier4') {
    hullLen = 4.3;
    hullWid = 1.95;
    hullH = 0.82;
    trackWid = 0.46;
    wheelRadius = 0.33;
    wheelCount = 6;
    turretBaseY = 0.96;
    turretZ = 0.2;
  } else if (tierId === 'tier5') {
    // T-5 Electro-Leviathan: Extra long chassis (6.4 length), dual turrets!
    hullLen = 6.4;
    hullWid = 2.05;
    hullH = 0.95;
    trackWid = 0.5;
    wheelRadius = 0.34;
    wheelCount = 9;
    turretBaseY = 1.25;
    turretZ = 1.25; // Forward turret
  }

  // Position main front turret
  frontTurretPivot.position.set(0, turretBaseY, turretZ);

  // --------------------------------------------------------------------------
  // 1. Tracks & Suspension (Left & Right)
  // --------------------------------------------------------------------------
  const trackSpacing = hullWid / 2 + trackWid / 2;
  const wheelSpacingZ = (hullLen * 0.72) / Math.max(wheelCount - 1, 1);
  const startWheelZ = -((wheelCount - 1) * wheelSpacingZ) / 2;

  [-trackSpacing, trackSpacing].forEach((xPos, sideIdx) => {
    const isRight = sideIdx === 1;

    // Track outer band (box enclosure / tread track)
    const trackBand = makeBox(trackWid, wheelRadius * 2.1, hullLen * 0.95, trackRubberMat);
    trackBand.position.set(xPos, wheelRadius * 1.05, 0);
    hullGroup.add(trackBand);

    // Tread ribbing segments on top
    const ribCount = Math.floor(hullLen * 4);
    const ribStep = (hullLen * 0.9) / ribCount;
    for (let i = 0; i < ribCount; i++) {
      const rz = -hullLen * 0.45 + i * ribStep;
      const rib = makeBox(trackWid * 0.95, 0.035, 0.06, armorDarkMat, false);
      rib.position.set(xPos, wheelRadius * 2.12, rz);
      hullGroup.add(rib);
    }

    // Road wheels
    for (let w = 0; w < wheelCount; w++) {
      const wz = startWheelZ + w * wheelSpacingZ;
      const wheel = makeCylinder(wheelRadius * 0.9, wheelRadius * 0.9, trackWid * 0.85, 14, metalTrimMat, 'x');
      wheel.position.set(xPos, wheelRadius * 1.05, wz);
      hullGroup.add(wheel);

      // Wheel hubcap
      const hub = makeCylinder(wheelRadius * 0.45, wheelRadius * 0.45, trackWid * 0.95, 10, hullMat, 'x', false);
      hub.position.set(xPos, wheelRadius * 1.05, wz);
      hullGroup.add(hub);
    }

    // Front Idler & Rear Drive Sprocket (elevated for obstacle climbing)
    const idlerZ = hullLen * 0.42;
    const sprocketZ = -hullLen * 0.42;
    const elevatedY = wheelRadius * 1.25;

    const idler = makeCylinder(wheelRadius * 0.75, wheelRadius * 0.75, trackWid * 0.85, 14, metalTrimMat, 'x');
    idler.position.set(xPos, elevatedY, idlerZ);
    hullGroup.add(idler);

    const sprocket = makeCylinder(wheelRadius * 0.82, wheelRadius * 0.82, trackWid * 0.85, 12, metalTrimMat, 'x');
    sprocket.position.set(xPos, elevatedY, sprocketZ);
    hullGroup.add(sprocket);

    // Mudguard / Fender plate over the track
    const fenderL = hullLen * 0.98;
    const fender = makeBox(trackWid * 1.15, 0.06, fenderL, hullMat);
    fender.position.set(xPos, wheelRadius * 2.18, 0);
    hullGroup.add(fender);

    // Angled front mudflap
    const frontFlap = makeBox(trackWid * 1.1, 0.05, 0.35, hullMat);
    frontFlap.position.set(xPos, wheelRadius * 1.95, fenderL / 2 + 0.12);
    frontFlap.rotation.x = -Math.PI / 4;
    hullGroup.add(frontFlap);

    // Rear mudflap
    const rearFlap = makeBox(trackWid * 1.1, 0.05, 0.3, hullMat);
    rearFlap.position.set(xPos, wheelRadius * 1.95, -fenderL / 2 - 0.1);
    rearFlap.rotation.x = Math.PI / 4;
    hullGroup.add(rearFlap);

    // Heavy side skirts (armor screens) for Tier 3, 4, 5 & Bosses
    if (tierId === 'tier3' || tierId === 'tier4' || tierId === 'tier5' || isBoss) {
      const skirtH = wheelRadius * 1.35;
      const skirt = makeBox(0.06, skirtH, hullLen * 0.75, isBoss ? metalTrimMat : hullMat);
      skirt.position.set(xPos + (isRight ? 1 : -1) * (trackWid / 2 + 0.04), wheelRadius * 1.3, 0);
      hullGroup.add(skirt);
    }
  });

  // --------------------------------------------------------------------------
  // 2. Hull Main Body & Glacis Plates
  // --------------------------------------------------------------------------
  const hullBaseY = wheelRadius * 1.35;
  const mainHull = makeBox(hullWid, hullH, hullLen * 0.88, hullMat);
  mainHull.position.set(0, hullBaseY, 0);
  hullGroup.add(mainHull);

  // Sloped Front Glacis Plate (ВЛД - Верхня лобова деталь)
  const glacisL = hullH * 1.35;
  const glacisPlate = makeBox(hullWid * 0.98, 0.12, glacisL, hullMat);
  glacisPlate.position.set(0, hullBaseY + hullH * 0.15, hullLen * 0.44);
  glacisPlate.rotation.x = -Math.PI / 3.4;
  hullGroup.add(glacisPlate);

  // Lower Front Plate (НЛД)
  const lowerPlate = makeBox(hullWid * 0.96, 0.1, glacisL * 0.8, armorDarkMat);
  lowerPlate.position.set(0, hullBaseY - hullH * 0.28, hullLen * 0.45);
  lowerPlate.rotation.x = Math.PI / 3.2;
  hullGroup.add(lowerPlate);

  // Driver viewport hatch
  const driverHatch = makeBox(0.4, 0.08, 0.25, armorDarkMat);
  driverHatch.position.set(-0.25, hullBaseY + hullH / 2 + 0.04, hullLen * 0.32);
  hullGroup.add(driverHatch);

  const triplexGlass = makeBox(0.24, 0.04, 0.06, new THREE.MeshBasicMaterial({ color: 0x38bdf8 }));
  triplexGlass.position.set(-0.25, hullBaseY + hullH / 2 + 0.08, hullLen * 0.33);
  hullGroup.add(triplexGlass);

  // Dual Headlights with protective brackets (Front: +Z)
  [-hullWid * 0.38, hullWid * 0.38].forEach((lx) => {
    const bracket = makeBox(0.14, 0.12, 0.12, armorDarkMat);
    bracket.position.set(lx, hullBaseY + hullH * 0.42, hullLen * 0.43);
    hullGroup.add(bracket);

    const light = makeCylinder(0.07, 0.07, 0.05, 12, headlightMat, 'z');
    light.position.set(lx, hullBaseY + hullH * 0.42, hullLen * 0.49);
    hullGroup.add(light);
  });

  // Rear Engine Deck & Exhausts (Rear: -Z)
  const engineDeck = makeBox(hullWid * 0.82, 0.08, hullLen * 0.35, armorDarkMat);
  engineDeck.position.set(0, hullBaseY + hullH / 2 + 0.04, -hullLen * 0.24);
  hullGroup.add(engineDeck);

  // Ventilation louvers
  for (let l = 0; l < 5; l++) {
    const louver = makeBox(hullWid * 0.68, 0.03, 0.05, metalTrimMat, false);
    louver.position.set(0, hullBaseY + hullH / 2 + 0.08, -hullLen * 0.16 - l * 0.09);
    hullGroup.add(louver);
  }

  // Twin exhaust pipes at the rear (-Z)
  [-hullWid * 0.32, hullWid * 0.32].forEach((exX) => {
    const pipe = makeCylinder(0.08, 0.09, 0.45, 10, exhaustMat, 'y');
    pipe.position.set(exX, hullBaseY + hullH * 0.15, -hullLen * 0.45);
    pipe.rotation.x = Math.PI / 4;
    hullGroup.add(pipe);
  });

  // Cylindrical auxiliary fuel drums on the back rear
  if (tierId !== 'tier1') {
    [-hullWid * 0.3, hullWid * 0.3].forEach((fx) => {
      const barrel = makeCylinder(0.18, 0.18, 0.6, 12, hullMat, 'x');
      barrel.position.set(fx, hullBaseY + hullH * 0.25, -hullLen * 0.46);
      hullGroup.add(barrel);
    });
  }

  // --------------------------------------------------------------------------
  // Special Chassis Elements: Tier 5 Tesla Leviathan
  // --------------------------------------------------------------------------
  if (tierId === 'tier5') {
    // Glowing Tesla Conduit Rails along the full chassis length!
    const teslaRailMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: isEnemy ? 0xef4444 : 0x0284c7,
      emissiveIntensity: 1.6,
      roughness: 0.2,
      metalness: 0.1
    });
    teslaActiveMats.push(teslaRailMat);

    [-hullWid * 0.54, hullWid * 0.54].forEach((rx) => {
      // Long glass / plasma core
      const plasmaTube = makeCylinder(0.065, 0.065, hullLen * 0.78, 12, teslaRailMat, 'z');
      plasmaTube.position.set(rx, hullBaseY + hullH * 0.3, 0);
      hullGroup.add(plasmaTube);

      // Support clamps
      const clampCount = 8;
      const stepZ = (hullLen * 0.72) / clampCount;
      for (let c = 0; c <= clampCount; c++) {
        const cz = -hullLen * 0.36 + c * stepZ;
        const clamp = makeBox(0.16, 0.18, 0.08, metalTrimMat);
        clamp.position.set(rx, hullBaseY + hullH * 0.3, cz);
        hullGroup.add(clamp);
      }
    });

    // Elevated rear artillery barbette
    const barbette = makeCylinder(0.85, 0.92, 0.35, 18, armorDarkMat, 'y');
    barbette.position.set(0, hullBaseY + hullH / 2 + 0.12, -2.05);
    hullGroup.add(barbette);
  }

  // --------------------------------------------------------------------------
  // 3. Turrets & Weaponry Construction
  // --------------------------------------------------------------------------

  if (tierId === 'tier1') {
    // ------------------------------------------------------------------------
    // Tier 1: LT-1 "Blyskavka" — Compact Agile Scout
    // ------------------------------------------------------------------------
    const turretGeo = makeBox(1.1, 0.55, 1.25, turretMat);
    turretGeo.position.set(0, 0.28, 0);
    frontTurretPivot.add(turretGeo);

    // Commander cupola
    const cupola = makeCylinder(0.24, 0.26, 0.18, 12, turretMat, 'y');
    cupola.position.set(-0.25, 0.62, -0.15);
    frontTurretPivot.add(cupola);

    // Radio antenna on turret rear
    const antBase = makeBox(0.08, 0.08, 0.08, metalTrimMat);
    antBase.position.set(0.35, 0.58, -0.45);
    frontTurretPivot.add(antBase);
    const antenna = makeCylinder(0.015, 0.015, 1.1, 6, metalTrimMat, 'y');
    antenna.position.set(0.35, 1.15, -0.45);
    frontTurretPivot.add(antenna);

    // Gun Mantlet & 37mm rapid-fire barrel
    frontGunPivot.position.set(0, 0.28, 0.6);

    const gunGroup = new THREE.Group();
    frontGunPivot.add(gunGroup);
    frontGunMesh = gunGroup;

    const mantlet = makeBox(0.45, 0.35, 0.35, armorDarkMat);
    gunGroup.add(mantlet);

    // 37mm barrel (+Z forward)
    const barrelLen = 1.35;
    const barrel = makeCylinder(0.06, 0.07, barrelLen, 12, metalTrimMat, 'z');
    barrel.position.set(0, 0, barrelLen / 2 + 0.15);
    gunGroup.add(barrel);

    // Conical muzzle flash hider
    const muzzleCone = makeCylinder(0.09, 0.06, 0.18, 10, metalTrimMat, 'z');
    muzzleCone.position.set(0, 0, barrelLen + 0.22);
    gunGroup.add(muzzleCone);

    frontMuzzle.position.set(0, 0, barrelLen + 0.32);
    frontSniperAnchor.position.set(0, 0.42, 0.65);
  } else if (tierId === 'tier2') {
    // ------------------------------------------------------------------------
    // Tier 2: ST-2 "Kozak" — Medium Tank (T-34 / Sherman style)
    // ------------------------------------------------------------------------
    const turretBase = makeCylinder(0.72, 0.8, 0.65, 18, turretMat, 'y');
    turretBase.position.set(0, 0.32, 0.02);
    frontTurretPivot.add(turretBase);

    // Turret bustle (rear ammo compartment)
    const bustle = makeBox(0.9, 0.5, 0.7, turretMat);
    bustle.position.set(0, 0.32, -0.45);
    frontTurretPivot.add(bustle);

    // Commander cupola with periscopes
    const cupola = makeCylinder(0.28, 0.3, 0.22, 14, turretMat, 'y');
    cupola.position.set(-0.3, 0.72, -0.15);
    frontTurretPivot.add(cupola);

    // Infantry handrails on the turret flanks
    [-0.72, 0.72].forEach((hx) => {
      const rail = makeCylinder(0.02, 0.02, 0.8, 6, metalTrimMat, 'z');
      rail.position.set(hx, 0.35, 0);
      frontTurretPivot.add(rail);
    });

    // Gun Mantlet & 76mm rifled cannon with muzzle brake
    frontGunPivot.position.set(0, 0.32, 0.7);

    const gunGroup = new THREE.Group();
    frontGunPivot.add(gunGroup);
    frontGunMesh = gunGroup;

    const mantlet = makeCylinder(0.26, 0.28, 0.5, 12, armorDarkMat, 'x');
    gunGroup.add(mantlet);

    const barrelLen = 2.25;
    const barrel = makeCylinder(0.08, 0.095, barrelLen, 14, metalTrimMat, 'z');
    barrel.position.set(0, 0, barrelLen / 2 + 0.2);
    gunGroup.add(barrel);

    // Muzzle brake with side vents
    const brake = makeBox(0.22, 0.16, 0.28, armorDarkMat);
    brake.position.set(0, 0, barrelLen + 0.3);
    gunGroup.add(brake);

    frontMuzzle.position.set(0, 0, barrelLen + 0.45);
    frontSniperAnchor.position.set(0, 0.48, 0.75);
  } else if (tierId === 'tier3') {
    // ------------------------------------------------------------------------
    // Tier 3: TT-3 "Bastion" — Heavy Breakthrough Tank
    // ------------------------------------------------------------------------
    // Angular cast heavy turret (Pike-nose / King Tiger hybrid)
    const turretMain = makeBox(1.5, 0.72, 1.8, turretMat);
    turretMain.position.set(0, 0.36, -0.05);
    frontTurretPivot.add(turretMain);

    // Sloped turret cheeks
    [-0.78, 0.78].forEach((cx, idx) => {
      const cheek = makeBox(0.25, 0.65, 1.2, turretMat);
      cheek.position.set(cx, 0.36, 0.15);
      cheek.rotation.y = (idx === 0 ? 1 : -1) * 0.22;
      frontTurretPivot.add(cheek);

      // Spare track links strapped to the turret sides as extra armor
      const spareTrack = makeBox(0.08, 0.35, 0.7, trackRubberMat);
      spareTrack.position.set(cx + (idx === 0 ? -0.12 : 0.12), 0.36, 0);
      frontTurretPivot.add(spareTrack);
    });

    // Commander hatch & rangefinder
    const cupola = makeCylinder(0.32, 0.34, 0.24, 14, turretMat, 'y');
    cupola.position.set(-0.45, 0.82, -0.3);
    frontTurretPivot.add(cupola);

    // Heavy 100mm D-10 Gun with fume extractor & double-baffle muzzle brake
    frontGunPivot.position.set(0, 0.36, 0.85);

    const gunGroup = new THREE.Group();
    frontGunPivot.add(gunGroup);
    frontGunMesh = gunGroup;

    const mantlet = makeBox(0.68, 0.52, 0.4, armorDarkMat);
    gunGroup.add(mantlet);

    const barrelLen = 3.1;
    const barrel = makeCylinder(0.1, 0.125, barrelLen, 14, metalTrimMat, 'z');
    barrel.position.set(0, 0, barrelLen / 2 + 0.2);
    gunGroup.add(barrel);

    // Fume extractor (bore evacuator) bulge in the middle of barrel
    const evacuator = makeCylinder(0.16, 0.16, 0.55, 14, armorDarkMat, 'z');
    evacuator.position.set(0, 0, barrelLen * 0.6);
    gunGroup.add(evacuator);

    // Double-baffle massive muzzle brake
    const brake = makeBox(0.34, 0.24, 0.42, armorDarkMat);
    brake.position.set(0, 0, barrelLen + 0.38);
    gunGroup.add(brake);

    frontMuzzle.position.set(0, 0, barrelLen + 0.6);
    frontSniperAnchor.position.set(0, 0.55, 0.9);
  } else if (tierId === 'tier4') {
    // ------------------------------------------------------------------------
    // Tier 4: PT-4 "Hrim-Fuhas" — Tank Destroyer with 122mm Howitzer
    // ------------------------------------------------------------------------
    // Low profile wide sloped assault casemate / turret
    const casemate = makeBox(1.85, 0.75, 1.9, turretMat);
    casemate.position.set(0, 0.38, 0);
    frontTurretPivot.add(casemate);

    // Frontal reinforced sloped armor faceplate
    const faceplate = makeBox(1.7, 0.65, 0.15, turretMat);
    faceplate.position.set(0, 0.38, 0.95);
    faceplate.rotation.x = -Math.PI / 8;
    frontTurretPivot.add(faceplate);

    // Stereoscopic rangefinder ears on top sides
    [-0.85, 0.85].forEach((rx) => {
      const rangeEar = makeCylinder(0.12, 0.12, 0.25, 10, metalTrimMat, 'x');
      rangeEar.position.set(rx, 0.72, 0.2);
      frontTurretPivot.add(rangeEar);
    });

    // 122mm Howitzer: Thick stubby barrel with massive blast compensator
    frontGunPivot.position.set(0, 0.38, 0.95);

    const gunGroup = new THREE.Group();
    frontGunPivot.add(gunGroup);
    frontGunMesh = gunGroup;

    // "Pig's Head" (Saukopf) cast mantlet
    const mantlet = makeCylinder(0.38, 0.42, 0.5, 14, armorDarkMat, 'x');
    gunGroup.add(mantlet);

    const barrelLen = 2.1;
    const barrel = makeCylinder(0.16, 0.19, barrelLen, 16, metalTrimMat, 'z');
    barrel.position.set(0, 0, barrelLen / 2 + 0.25);
    gunGroup.add(barrel);

    // Massive slotted howitzer muzzle compensator
    const compensator = makeCylinder(0.26, 0.26, 0.52, 16, armorDarkMat, 'z');
    compensator.position.set(0, 0, barrelLen + 0.45);
    gunGroup.add(compensator);

    frontMuzzle.position.set(0, 0, barrelLen + 0.72);
    frontSniperAnchor.position.set(0, 0.5, 1.05);
  } else if (tierId === 'tier5') {
    // ------------------------------------------------------------------------
    // Tier 5: T-5 "Electro-Leviathan" — DUAL-TURRETED TESLA DREADNOUGHT
    // ------------------------------------------------------------------------

    // A) FRONT MAIN TURRET (Tesla 152mm Railgun)
    const frontTurretBase = makeBox(1.95, 0.85, 2.2, turretMat);
    frontTurretBase.position.set(0, 0.42, 0);
    frontTurretPivot.add(frontTurretBase);

    // Angular wedge armor plates
    [-0.95, 0.95].forEach((wx, widx) => {
      const wedge = makeBox(0.3, 0.75, 1.5, turretMat);
      wedge.position.set(wx, 0.42, 0.2);
      wedge.rotation.y = (widx === 0 ? 1 : -1) * 0.25;
      frontTurretPivot.add(wedge);
    });

    // Twin Electromagnetic Induction Coils on the turret flanks
    const coilMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: isEnemy ? 0xef4444 : 0x0284c7,
      emissiveIntensity: 1.8,
      roughness: 0.1,
      metalness: 0.8
    });
    teslaActiveMats.push(coilMat);

    [-1.08, 1.08].forEach((cx) => {
      const coilCore = makeCylinder(0.24, 0.24, 0.85, 14, coilMat, 'z');
      coilCore.position.set(cx, 0.45, 0.0);
      frontTurretPivot.add(coilCore);

      // Ring ribs on coil
      for (let r = 0; r < 4; r++) {
        const ring = makeCylinder(0.27, 0.27, 0.08, 12, metalTrimMat, 'z');
        ring.position.set(cx, 0.45, -0.3 + r * 0.2);
        frontTurretPivot.add(ring);
      }
    });

    // Front Gun Pivot & 152mm Tesla Cannon
    frontGunPivot.position.set(0, 0.45, 1.1);

    const gunGroup = new THREE.Group();
    frontGunPivot.add(gunGroup);
    frontGunMesh = gunGroup;

    const mantlet = makeBox(0.85, 0.65, 0.5, armorDarkMat);
    gunGroup.add(mantlet);

    const barrelLen = 3.6;
    const barrel = makeCylinder(0.14, 0.17, barrelLen, 16, metalTrimMat, 'z');
    barrel.position.set(0, 0, barrelLen / 2 + 0.25);
    gunGroup.add(barrel);

    // 3 Tesla Accelerator Rings along the barrel (+Z)
    for (let i = 1; i <= 3; i++) {
      const rz = (barrelLen * i) / 3.4;
      const accelRing = makeCylinder(0.26, 0.26, 0.14, 14, coilMat, 'z');
      accelRing.position.set(0, 0, rz);
      gunGroup.add(accelRing);

      const frame = makeBox(0.58, 0.58, 0.08, metalTrimMat);
      frame.position.set(0, 0, rz);
      gunGroup.add(frame);
    }

    // Quad plasma muzzle discharge electrode
    const muzzleDischarge = makeCylinder(0.22, 0.18, 0.35, 12, armorDarkMat, 'z');
    muzzleDischarge.position.set(0, 0, barrelLen + 0.35);
    gunGroup.add(muzzleDischarge);

    frontMuzzle.position.set(0, 0, barrelLen + 0.55);
    frontSniperAnchor.position.set(0, 0.65, 1.25);

    // B) REAR MINI-ARTILLERY TURRET ("Джміль" / Bumblebee Mini-Arty)
    rearTurretPivot = new THREE.Group();
    rearTurretPivot.name = 'RearTurretPivot';
    rearTurretPivot.position.set(0, 1.45, -2.05);
    // Face backward by default (+Math.PI), while its local +Z is the gun direction!
    rearTurretPivot.rotation.y = Math.PI;
    root.add(rearTurretPivot);

    const rearTurretDome = makeCylinder(0.55, 0.62, 0.45, 16, turretMat, 'y');
    rearTurretDome.position.set(0, 0.22, 0);
    rearTurretPivot.add(rearTurretDome);

    // Optical targeting pod
    const optPod = makeBox(0.22, 0.25, 0.3, armorDarkMat);
    optPod.position.set(0.38, 0.42, 0.1);
    rearTurretPivot.add(optPod);

    const lens = makeCylinder(0.06, 0.06, 0.04, 10, headlightMat, 'z');
    lens.position.set(0.38, 0.42, 0.26);
    rearTurretPivot.add(lens);

    rearGunPivot = new THREE.Group();
    rearGunPivot.name = 'RearGunPivot';
    rearGunPivot.position.set(0, 0.25, 0.4);
    rearTurretPivot.add(rearGunPivot);

    const rearGunSub = new THREE.Group();
    rearGunPivot.add(rearGunSub);
    rearGunMesh = rearGunSub;

    const rearMantlet = makeCylinder(0.18, 0.2, 0.35, 12, armorDarkMat, 'x');
    rearGunSub.add(rearMantlet);

    // Mini artillery quick-fire mortar/autocannon barrel (+Z in rear turret space)
    const rearBarrelLen = 1.15;
    const rearBarrel = makeCylinder(0.08, 0.09, rearBarrelLen, 12, metalTrimMat, 'z');
    rearBarrel.position.set(0, 0, rearBarrelLen / 2 + 0.1);
    rearGunSub.add(rearBarrel);

    // Muzzle brake
    const rearBrake = makeCylinder(0.12, 0.12, 0.18, 12, armorDarkMat, 'z');
    rearBrake.position.set(0, 0, rearBarrelLen + 0.18);
    rearGunSub.add(rearBrake);

    rearMuzzle = new THREE.Object3D();
    rearMuzzle.name = 'RearMuzzle';
    rearMuzzle.position.set(0, 0, rearBarrelLen + 0.28);
    rearGunSub.add(rearMuzzle);

    rearSniperAnchor = new THREE.Object3D();
    rearSniperAnchor.name = 'RearSniperAnchor';
    rearSniperAnchor.position.set(0, 0.45, 0.5);
    rearTurretPivot.add(rearSniperAnchor);
  }

  // --------------------------------------------------------------------------
  // 4. Forcefield Shield Sphere (Visible when active)
  // --------------------------------------------------------------------------
  const shieldRadius = Math.max(hullLen, hullWid) * 0.68;
  const shieldGeo = new THREE.IcosahedronGeometry(shieldRadius, 2);
  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.32,
    roughness: 0.1,
    metalness: 0.2,
    wireframe: true
  });
  const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
  shieldMesh.name = 'ShieldMesh';
  shieldMesh.position.set(0, hullH * 0.85, 0);
  shieldMesh.visible = false;
  root.add(shieldMesh);

  // Apply Scale Override if passed
  if (scaleOverride !== 1.0) {
    root.scale.setScalar(scaleOverride);
  }

  const halfLength = (hullLen / 2) * scaleOverride;
  const halfWidth = ((hullWid + trackWid * 2) / 2) * scaleOverride;
  const totalHeight = (turretBaseY + 1.2) * scaleOverride;

  // --------------------------------------------------------------------------
  // 5. Visual Updater (Recoil, Tesla Pulsing, Shield Animations)
  // --------------------------------------------------------------------------
  const updateVisuals = (timeSec: number, frontRecoil: number, rearRecoil: number) => {
    // Front barrel recoil along -Z
    if (frontGunMesh) {
      frontGunMesh.position.z = frontGunInitialZ - Math.max(0, Math.min(frontRecoil, 1)) * 0.38;
    }

    // Rear barrel recoil along -Z
    if (rearGunMesh) {
      rearGunMesh.position.z = rearGunInitialZ - Math.max(0, Math.min(rearRecoil, 1)) * 0.22;
    }

    // Tesla electromagnetic glowing pulse
    if (teslaActiveMats.length > 0) {
      const pulse = 1.2 + 0.6 * Math.sin(timeSec * 8);
      for (let i = 0; i < teslaActiveMats.length; i++) {
        teslaActiveMats[i].emissiveIntensity = pulse;
      }
    }

    // Shield subtle breathing and slow rotation
    if (shieldMesh.visible) {
      shieldMesh.rotation.y = timeSec * 0.35;
      shieldMesh.rotation.x = Math.sin(timeSec * 0.5) * 0.1;
      shieldMat.opacity = 0.28 + 0.12 * Math.sin(timeSec * 5);
    }
  };

  return {
    root,
    hullGroup,
    frontTurretPivot,
    frontGunPivot,
    frontMuzzle,
    frontSniperAnchor,
    rearTurretPivot,
    rearGunPivot,
    rearMuzzle,
    rearSniperAnchor,
    shieldMesh,
    halfLength,
    halfWidth,
    height: totalHeight,
    updateVisuals
  };
}

// ============================================================================
// Projectile Meshes Builder (AP, Heavy, HE, Electric Tesla, Mini-Artillery)
// ============================================================================

export function createProjectileMesh(style: ProjectileStyle, isEnemy = false): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `Projectile_${style}`;

  if (style === 'electric') {
    // Glowing plasma core sphere
    const coreGeo = new THREE.SphereGeometry(0.24, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: isEnemy ? 0xff4444 : 0xe0f2fe
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Electric arcs (crossed glowing toruses)
    const arcGeo = new THREE.TorusGeometry(0.38, 0.045, 8, 20);
    const arcMat = new THREE.MeshBasicMaterial({
      color: isEnemy ? 0xef4444 : 0x38bdf8,
      wireframe: true
    });

    const ring1 = new THREE.Mesh(arcGeo, arcMat);
    ring1.rotation.x = Math.PI / 4;
    group.add(ring1);

    const ring2 = new THREE.Mesh(arcGeo, arcMat);
    ring2.rotation.y = Math.PI / 3;
    ring2.rotation.z = Math.PI / 6;
    group.add(ring2);

    return group;
  }

  if (style === 'he') {
    // High Explosive shell: blunt orange warhead with glowing fuse ring
    const shellMat = new THREE.MeshStandardMaterial({
      color: isEnemy ? 0xb91c1c : 0xea580c,
      roughness: 0.3,
      metalness: 0.6
    });

    const body = makeCylinder(0.15, 0.15, 0.55, 14, shellMat, 'z');
    group.add(body);

    const head = makeCylinder(0.04, 0.15, 0.3, 14, shellMat, 'z');
    head.position.set(0, 0, 0.42);
    group.add(head);

    // Fuse ring
    const fuseMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const fuse = makeCylinder(0.155, 0.155, 0.08, 12, fuseMat, 'z');
    fuse.position.set(0, 0, 0.15);
    group.add(fuse);

    return group;
  }

  if (style === 'mini_artillery') {
    // Compact aerodynamic rocket / mortar bomb with stabilizing fins
    const bodyMat = new THREE.MeshStandardMaterial({
      color: isEnemy ? 0x991b1b : 0xd97706,
      roughness: 0.3,
      metalness: 0.7
    });

    const body = makeCylinder(0.08, 0.09, 0.45, 12, bodyMat, 'z');
    group.add(body);

    const tip = makeCylinder(0.02, 0.08, 0.2, 12, new THREE.MeshBasicMaterial({ color: 0xfbbf24 }), 'z');
    tip.position.set(0, 0, 0.32);
    group.add(tip);

    // 4 tail fins
    for (let f = 0; f < 4; f++) {
      const fin = makeBox(0.02, 0.14, 0.16, bodyMat);
      fin.position.set(0, 0, -0.2);
      fin.rotation.z = (f * Math.PI) / 2;
      group.add(fin);
    }

    return group;
  }

  // 'ap' (Armor Piercing) & 'heavy'
  const isHeavy = style === 'heavy';
  const radius = isHeavy ? 0.12 : 0.085;
  const length = isHeavy ? 0.85 : 0.65;

  const shellMat = new THREE.MeshStandardMaterial({
    color: isEnemy ? 0x991b1b : isHeavy ? 0x71717a : 0xca8a04,
    metalness: 0.85,
    roughness: 0.25
  });

  const body = makeCylinder(radius, radius, length * 0.65, 14, shellMat, 'z');
  group.add(body);

  const head = makeCylinder(0.01, radius, length * 0.35, 14, shellMat, 'z');
  head.position.set(0, 0, length * 0.5);
  group.add(head);

  // Tracer flare at the rear
  const tracerMat = new THREE.MeshBasicMaterial({
    color: isEnemy ? 0xff2222 : 0xff9900
  });
  const tracer = makeCylinder(radius * 0.85, radius * 0.85, 0.1, 10, tracerMat, 'z');
  tracer.position.set(0, 0, -length * 0.35);
  group.add(tracer);

  return group;
}

// ============================================================================
// 3D Hangar Environment (Authentic World of Tanks Style)
// ============================================================================

export function createHangarEnvironment(): THREE.Group {
  const hangar = new THREE.Group();
  hangar.name = 'HangarEnvironment';

  // 1. Central Rotating Steel Turntable / Podium (y = 0)
  const podiumRadius = 4.6;
  const podiumHeight = 0.35;

  const podiumMat = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    roughness: 0.5,
    metalness: 0.65
  });

  const podium = makeCylinder(podiumRadius, podiumRadius, podiumHeight, 48, podiumMat, 'y');
  podium.position.set(0, -podiumHeight / 2, 0);
  hangar.add(podium);

  // Outer safety ring with hazard yellow/black stripes
  const rimGeo = new THREE.CylinderGeometry(podiumRadius + 0.1, podiumRadius + 0.1, 0.08, 48, 1, true);
  const rimMat = new THREE.MeshBasicMaterial({
    map: sharedHazardTex,
    side: THREE.DoubleSide
  });
  const rimMesh = new THREE.Mesh(rimGeo, rimMat);
  rimMesh.position.set(0, 0.02, 0);
  hangar.add(rimMesh);

  // Steel deck plates on podium
  const deckRingGeo = new THREE.RingGeometry(1.2, podiumRadius * 0.95, 32);
  deckRingGeo.rotateX(-Math.PI / 2);
  const deckRingMat = new THREE.MeshStandardMaterial({
    color: 0x3f3f46,
    roughness: 0.7,
    metalness: 0.5
  });
  const deckRing = new THREE.Mesh(deckRingGeo, deckRingMat);
  deckRing.position.set(0, 0.01, 0);
  deckRing.receiveShadow = true;
  hangar.add(deckRing);

  // Central turntable drain/bearing plate
  const hubCap = makeCylinder(1.1, 1.1, 0.04, 24, podiumMat, 'y');
  hubCap.position.set(0, 0.02, 0);
  hangar.add(hubCap);

  // 2. Concrete Hangar Floor (Large 60x60 perimeter)
  const floorGeo = new THREE.PlaneGeometry(60, 60);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.85,
    metalness: 0.15
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(0, -0.01, 0);
  floor.receiveShadow = true;
  hangar.add(floor);

  // 3. Structural Columns & Overhead Steel Trusses (Placed safely at radius > 8)
  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.6,
    metalness: 0.7
  });

  const columnPositions = [
    [-11, -11],
    [11, -11],
    [-11, 11],
    [11, 11]
  ];

  columnPositions.forEach(([cx, cz]) => {
    // Vertical heavy I-beam column
    const col = makeBox(0.9, 10, 0.9, trussMat);
    col.position.set(cx, 5, cz);
    hangar.add(col);

    // Diagonal support brackets
    const bracket = makeBox(0.3, 3, 0.3, trussMat);
    bracket.position.set(cx * 0.88, 7.5, cz * 0.88);
    bracket.rotation.z = (cx > 0 ? -1 : 1) * 0.45;
    hangar.add(bracket);
  });

  // Overhead cross beams
  const beam1 = makeBox(24, 0.7, 0.7, trussMat);
  beam1.position.set(0, 9.5, -11);
  hangar.add(beam1);

  const beam2 = makeBox(24, 0.7, 0.7, trussMat);
  beam2.position.set(0, 9.5, 11);
  hangar.add(beam2);

  const crossBeam = makeBox(0.7, 0.7, 24, trussMat);
  crossBeam.position.set(0, 9.8, 0);
  hangar.add(crossBeam);

  // 4. Overhead Industrial Floodlights angled at turntable
  const spotMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.4,
    metalness: 0.8
  });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  [
    [-6, 9.2, -6],
    [6, 9.2, -6],
    [0, 9.5, 7]
  ].forEach(([sx, sy, sz]) => {
    const lampHouse = makeBox(0.8, 0.5, 0.8, spotMat);
    lampHouse.position.set(sx, sy, sz);
    lampHouse.lookAt(0, 0.5, 0);
    hangar.add(lampHouse);

    const bulb = makeBox(0.6, 0.05, 0.6, bulbMat);
    bulb.position.set(sx, sy - 0.2, sz);
    hangar.add(bulb);
  });

  // 5. Back Metal Blast Wall with Reinforced Gates (z = -15)
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.75,
    metalness: 0.45
  });
  const backWall = makeBox(36, 12, 1, wallMat);
  backWall.position.set(0, 6, -16);
  hangar.add(backWall);

  // Large industrial blast doors
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.55,
    metalness: 0.65
  });
  const blastDoorL = makeBox(6.5, 8.5, 0.4, doorMat);
  blastDoorL.position.set(-3.5, 4.25, -15.4);
  hangar.add(blastDoorL);

  const blastDoorR = makeBox(6.5, 8.5, 0.4, doorMat);
  blastDoorR.position.set(3.5, 4.25, -15.4);
  hangar.add(blastDoorR);

  // Yellow warning stripes on door threshold
  const doorThreshold = makeBox(14, 0.15, 0.6, rimMat);
  doorThreshold.position.set(0, 0.08, -15.2);
  hangar.add(doorThreshold);

  // 6. Perimeter Ammo Crates & Fuel Pallets (Safe radius r > 7.5)
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0x3f6212, // Army Olive Wood
    roughness: 0.85,
    metalness: 0.15
  });
  const palletWoodMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.9,
    metalness: 0.05
  });

  // Ammo crate stacks on the left
  const stackPositions = [
    [-8.5, 0.45, 2.5],
    [-8.5, 0.45, 3.8],
    [-8.5, 1.25, 3.15],
    [8.8, 0.45, -3.2],
    [8.8, 0.45, -4.5],
    [8.8, 1.25, -3.85]
  ];

  stackPositions.forEach(([ax, ay, az]) => {
    const crate = makeBox(1.1, 0.75, 0.9, crateMat);
    crate.position.set(ax, ay, az);
    hangar.add(crate);

    // Crate metal corner bracket
    const corner = makeBox(1.12, 0.1, 0.92, trussMat, false);
    corner.position.set(ax, ay, az);
    hangar.add(corner);
  });

  // Fuel barrels on wood pallets
  const pallet = makeBox(2.2, 0.18, 2.2, palletWoodMat);
  pallet.position.set(-7.5, 0.09, -6.5);
  hangar.add(pallet);

  const barrel1 = createExplosiveBarrelMesh();
  barrel1.position.set(-7.9, 0.2, -6.9);
  hangar.add(barrel1);

  const barrel2 = createExplosiveBarrelMesh();
  barrel2.position.set(-7.1, 0.2, -6.1);
  hangar.add(barrel2);

  return hangar;
}

// ============================================================================
// Explosive Barrel Mesh
// ============================================================================

export function createExplosiveBarrelMesh(): THREE.Group {
  const barrel = new THREE.Group();
  barrel.name = 'ExplosiveBarrel';

  const redPaintMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.45,
    metalness: 0.55
  });

  const blackRimMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.6,
    metalness: 0.8
  });

  // Main cylinder body (height 1.2, radius 0.42)
  const body = makeCylinder(0.42, 0.42, 1.15, 18, redPaintMat, 'y');
  body.position.set(0, 0.6, 0);
  barrel.add(body);

  // Black reinforcing steel ribs
  [-0.32, 0.0, 0.32].forEach((ry) => {
    const ring = makeCylinder(0.44, 0.44, 0.06, 18, blackRimMat, 'y', false);
    ring.position.set(0, 0.6 + ry, 0);
    barrel.add(ring);
  });

  // Yellow-black hazard band around center
  const hazardBand = makeCylinder(0.43, 0.43, 0.28, 18, new THREE.MeshBasicMaterial({ map: sharedHazardTex }), 'y', false);
  hazardBand.position.set(0, 0.6, 0);
  barrel.add(hazardBand);

  // Cap / bung on top lid
  const cap = makeCylinder(0.08, 0.08, 0.06, 10, blackRimMat, 'y');
  cap.position.set(0.18, 1.2, 0.08);
  barrel.add(cap);

  return barrel;
}

// ============================================================================
// Battlefield Power-Up Pickups
// ============================================================================

export function createPickupMesh(kind: PowerUpKind): THREE.Group {
  const group = new THREE.Group();
  group.name = `Pickup_${kind}`;

  // Ground holographic projection base disc
  const discMat = new THREE.MeshBasicMaterial({
    color: kind === 'repair' ? 0x22c55e : kind === 'damage' ? 0xef4444 : kind === 'speed' ? 0xeab308 : 0x38bdf8,
    wireframe: true
  });
  const baseDisc = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.85, 18), discMat);
  baseDisc.rotateX(-Math.PI / 2);
  baseDisc.position.set(0, 0.05, 0);
  group.add(baseDisc);

  const iconPivot = new THREE.Group();
  iconPivot.position.set(0, 0.85, 0);
  group.add(iconPivot);

  if (kind === 'repair') {
    // 3D Emerald Green Medkit with glowing White Cross
    const kitMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.35,
      metalness: 0.45
    });
    const medBox = makeBox(0.8, 0.6, 0.35, kitMat);
    iconPivot.add(medBox);

    // White Cross
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const crossV = makeBox(0.18, 0.42, 0.37, crossMat);
    iconPivot.add(crossV);
    const crossH = makeBox(0.42, 0.18, 0.37, crossMat);
    iconPivot.add(crossH);
  } else if (kind === 'damage') {
    // Double Crossed Heavy AP Shells with fiery red glow
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.8,
      metalness: 0.8,
      roughness: 0.2
    });

    [-1, 1].forEach((dir) => {
      const shellG = new THREE.Group();
      shellG.rotation.z = (dir * Math.PI) / 4;

      const body = makeCylinder(0.1, 0.1, 0.7, 12, shellMat, 'y');
      shellG.add(body);

      const tip = makeCylinder(0.01, 0.1, 0.28, 12, new THREE.MeshBasicMaterial({ color: 0xfde047 }), 'y');
      tip.position.set(0, 0.48, 0);
      shellG.add(tip);

      iconPivot.add(shellG);
    });
  } else if (kind === 'speed') {
    // Twin Golden Lightning Bolts / Turbo Blades
    const speedMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xca8a04,
      emissiveIntensity: 0.9,
      metalness: 0.6,
      roughness: 0.2
    });

    // Lightning bolt shape from stacked angled boxes
    const boltTop = makeBox(0.16, 0.42, 0.16, speedMat);
    boltTop.position.set(-0.08, 0.2, 0);
    boltTop.rotation.z = -0.35;
    iconPivot.add(boltTop);

    const boltMid = makeBox(0.35, 0.14, 0.16, speedMat);
    boltMid.position.set(0, 0.05, 0);
    iconPivot.add(boltMid);

    const boltBot = makeBox(0.16, 0.42, 0.16, speedMat);
    boltBot.position.set(0.08, -0.2, 0);
    boltBot.rotation.z = -0.35;
    iconPivot.add(boltBot);
  } else if (kind === 'shield') {
    // Brilliant Blue Gem / Energy Core surrounded by protective orbit ring
    const gemMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.2,
      roughness: 0.1,
      metalness: 0.5
    });

    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), gemMat);
    iconPivot.add(gem);

    const ringGeo = new THREE.TorusGeometry(0.65, 0.06, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.3,
      metalness: 0.8
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 3;
    iconPivot.add(ring);
  }

  return group;
}
