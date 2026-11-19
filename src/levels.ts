import * as THREE from 'three';
import { MAP_DEFINITIONS, TANK_SPECS } from './classes';
import type { MapBiomeId, TankTierId } from './types';

// ============================================================================
// 1. КОНСТАНТИ МАСШТАБУ КАРТИ WORLD OF TANKS
// ============================================================================
export const WORLD_HALF_SIZE = 95; // Відкрита танкова арена 190×190 метрів

// ============================================================================
// 2. ІНТЕРФЕЙСИ КАРТИ, ПЕРЕШКОД ТА ХВИЛЬ
// ============================================================================
export interface MapObstacle {
  id: number;
  kind: 'rock' | 'building' | 'bunker';
  x: number;
  z: number;
  radius: number; // Радіус колізії в площині XZ для танків та снарядів
  height: number; // Висота перешкоди над поверхнею землі
}

export interface MapBush {
  x: number;
  z: number;
  radius: number;
}

export interface BarrelSpawnPoint {
  x: number;
  z: number;
}

export interface BuiltMapArena {
  group: THREE.Group;
  obstacles: MapObstacle[];
  bushes: MapBush[];
  barrelSpawns: BarrelSpawnPoint[];
  playerSpawn: { x: number; z: number; yaw: number };
  duelEnemySpawn: { x: number; z: number; yaw: number };
  waveSpawnPoints: Array<{ x: number; z: number }>;
  getHeightAt: (x: number, z: number) => number;
  getNormalAt: (x: number, z: number) => THREE.Vector3;
}

export interface EnemyWaveUnitSpec {
  tierId: TankTierId;
  isBoss: boolean;
  name: string;
  hp: number;
  damage: number;
  reloadSec: number;
  speed: number;
  scale: number;
  rewardCoins: number;
  scorePoints: number;
}

// ============================================================================
// 3. МАТЕМАТИЧНИЙ 3D-РЕЛЬЄФ ТА ОБЧИСЛЕННЯ НОРМАЛЕЙ
// ============================================================================

/**
 * Плавна функція демпфування висоти біля точок спавну гравця та суперника,
 * щоб забезпечити рівний майданчик для старту та комфортної їзди.
 */
function getSpawnFlatFactor(x: number, z: number): number {
  // Спавн гравця: (0, 52)
  const dPlayer = Math.hypot(x - 0, z - 52);
  const wPlayer = Math.min(1, Math.max(0, (dPlayer - 7) / 11));
  const smoothPlayer = wPlayer * wPlayer * (3 - 2 * wPlayer);

  // Спавн дуельного ворога: (0, -52)
  const dDuel = Math.hypot(x - 0, z - (-52));
  const wDuel = Math.min(1, Math.max(0, (dDuel - 7) / 11));
  const smoothDuel = wDuel * wDuel * (3 - 2 * wDuel);

  return smoothPlayer * smoothDuel;
}

/**
 * Створює детерміновану математичну функцію висоти для обраного біому.
 * Максимальна висота пагорбів ~3.8 м, м'які схили (~15-20°),
 * пласка зона на базах і плавний підйом скель по периметру арени.
 */
function createTerrainHeightFunction(mapId: MapBiomeId): (x: number, z: number) => number {
  return (x: number, z: number): number => {
    let raw = 0;

    if (mapId === 'hills') {
      // Малинівські пагорби: широкі плавні гряди, тераси для стрільби "від башти"
      raw = Math.sin(x * 0.036) * 1.65 + Math.cos(z * 0.031) * 1.45;
      raw += Math.sin((x + z) * 0.046) * 0.85;
      raw += Math.cos(x * 0.082 - z * 0.064) * 0.35;
    } else if (mapId === 'desert') {
      // Піщаний каньйон: подовгасті бархани та дюни з м'якими гребенями
      raw = Math.sin((x * 0.82 + z * 0.58) * 0.033) * 2.05;
      raw += Math.cos((x * 0.52 - z * 0.78) * 0.043) * 1.25;
      raw += Math.sin(z * 0.078) * 0.42;
    } else if (mapId === 'arctic') {
      // Полярний рубіж: крижані хвилі тундри та замерзлі висоти
      raw = Math.sin(x * 0.044) * 1.7 + Math.cos(z * 0.037) * 1.4;
      raw += Math.sin((x * 0.65 - z) * 0.052) * 0.9;
      raw += Math.cos((x + z) * 0.076) * 0.32;
    } else if (mapId === 'volcano') {
      // Вулканічна Долина: базальтові хребти, каньйони та розломи
      raw = Math.sin(x * 0.045) * 2.1 + Math.cos(z * 0.04) * 1.75;
      raw += Math.sin((x * 0.7 + z * 0.7) * 0.052) * 1.05;
      raw += Math.cos((x - z) * 0.065) * 0.45;
    } else {
      // Хіммельсдорф (city): Замковий пагорб на сході/північному сході (x > 22..25)
      // до 4.5-5м заввишки, широкі тераси та рівні проспекти в центрі й на заході для перестрілок
      raw = Math.sin(x * 0.022) * 0.28 + Math.cos(z * 0.022) * 0.24;
      if (x > 20) {
        const hillT = Math.min(1, (x - 20) / 42);
        const castleRidge = 4.2 + Math.sin(z * 0.04) * 0.75;
        raw += hillT * hillT * castleRidge;
      }
      if (x > 22 && z < -8) {
        const northEastRidge = Math.min(1, ((x - 22) + (-8 - z)) / 45);
        raw += northEastRidge * 0.95;
      }
    }

    // Згладжуємо рельєф біля стартових майданчиків
    const spawnDamping = getSpawnFlatFactor(x, z);
    let height = raw * spawnDamping;

    // Скелястий підйом по периметру арени (починаючи з 82 м до краю 95 м)
    const edgeDist = Math.max(Math.abs(x), Math.abs(z));
    if (edgeDist > 82) {
      const t = Math.min(1.4, (edgeDist - 82) / (WORLD_HALF_SIZE - 82));
      height += t * t * 6.2;
    }

    return height;
  };
}

/**
 * Обчислення нормалі рельєфу методом скінченних різниць (dx = 0.6, dz = 0.6).
 * Забезпечує плавний і реалістичний нахил корпусу танка по схилах пагорбів.
 */
function createTerrainNormalFunction(
  getHeightAt: (x: number, z: number) => number
): (x: number, z: number) => THREE.Vector3 {
  const dx = 0.6;
  const dz = 0.6;
  return (x: number, z: number): THREE.Vector3 => {
    const hL = getHeightAt(x - dx, z);
    const hR = getHeightAt(x + dx, z);
    const hD = getHeightAt(x, z - dz);
    const hU = getHeightAt(x, z + dz);

    const nx = -(hR - hL) / (2 * dx);
    const ny = 1.0;
    const nz = -(hU - hD) / (2 * dz);

    return new THREE.Vector3(nx, ny, nz).normalize();
  };
}

/**
 * Розраховує вертексний колір залежно від висоти Y, нахилу (slope) та біому.
 */
function computeVertexColor(
  mapId: MapBiomeId,
  x: number,
  y: number,
  z: number,
  slope: number,
  targetColor: THREE.Color
): void {
  if (mapId === 'hills') {
    // Соковита трава в низинах, тераси та скелясті вершини пагорбів
    if (y > 4.5 || slope > 0.27) {
      targetColor.setHex(0x57534e).lerp(new THREE.Color(0x3f3f46), Math.min(1, (y - 4.5) * 0.25));
    } else if (slope > 0.16) {
      targetColor.setHex(0x6b5335); // Глинистий схил
    } else if (y > 2.0) {
      targetColor.setHex(0x4d7c0f); // Освітлена верхівка пагорба
    } else if (y < -0.4) {
      targetColor.setHex(0x166534); // Темна соковита низина
    } else {
      targetColor.setHex(0x2e7d32); // Смарагдова рівнинна трава
    }
  } else if (mapId === 'desert') {
    // Золоті піщані дюни, світлі гребені та червонуватий камінь каньйону
    if (y > 4.5 || slope > 0.27) {
      targetColor.setHex(0x9a3412).lerp(new THREE.Color(0x78350f), Math.min(1, (y - 4.5) * 0.25));
    } else if (slope > 0.16) {
      targetColor.setHex(0xc2410c); // Темніший відсип дюни
    } else if (y > 1.8) {
      targetColor.setHex(0xfbbf24); // Сонячний піщаний бархан
    } else {
      targetColor.setHex(0xd97706); // Теплий бурштиновий пісок
    }
  } else if (mapId === 'arctic') {
    // Полярні засніжені простори, блакитний лід та темний граніт
    if (y > 4.6 || slope > 0.28) {
      targetColor.setHex(0x334155).lerp(new THREE.Color(0x1e293b), Math.min(1, (y - 4.6) * 0.25));
    } else if (slope > 0.16) {
      targetColor.setHex(0x60a5fa); // Крижаний схил
    } else if (y > 2.0) {
      targetColor.setHex(0xffffff); // Сліпучий чистий сніг
    } else {
      targetColor.setHex(0xe2e8f0); // Замерзла тундра
    }
  } else if (mapId === 'volcano') {
    // Вулканічна Долина: чорний базальт, попіл та розпечена магма
    if (y < -0.2) {
      // Гаряча магма в низинах і розломах
      const magmaFactor = Math.min(1, Math.max(0, (-0.2 - y) * 1.4));
      targetColor.setHex(0xdc2626).lerp(new THREE.Color(0xfbbf24), magmaFactor);
    } else if (y > 4.2 || slope > 0.26) {
      // Гострі темні базальтові піки з багряним відблиском
      targetColor.setHex(0x18181b).lerp(new THREE.Color(0x450a0a), Math.min(1, (y - 4.2) * 0.35));
    } else if (slope > 0.15) {
      // Обгорілі схили
      targetColor.setHex(0x292524);
    } else if (y > 1.8) {
      // Попелясті висоти
      targetColor.setHex(0x3f3f46);
    } else {
      // Застигла лавова кора
      targetColor.setHex(0x27272a);
    }
  } else {
    // Хіммельсдорф: міська бруківка, асфальтні проспекти, сквери та Замкова гора
    if (y > 3.2 || slope > 0.22) {
      // Гранітний камінь Замкової гори та крутих схилів
      targetColor.setHex(0x475569).lerp(new THREE.Color(0x334155), Math.min(1, (y - 3.2) * 0.35));
    } else {
      // Міська сітка проспектів, площ та бульварів
      const isRoad = Math.abs(Math.sin(x * 0.12)) < 0.25 || Math.abs(Math.sin(z * 0.12)) < 0.25;
      const isSquare = Math.hypot(x, z) < 18;
      const isPark = (Math.sin(x * 0.16 + 0.4) * Math.cos(z * 0.16 + 0.4)) > 0.32;

      if (isRoad) {
        // Темний асфальт
        targetColor.setHex(0x27272a);
      } else if (isSquare) {
        // Центральна брукована площа
        targetColor.setHex(0x3f3f46);
      } else if (isPark) {
        // Приглушена міська трава скверів та газонів
        targetColor.setHex(0x1b4332);
      } else {
        // Бруковані тротуари та пішохідні провулки
        targetColor.setHex(0x52525b);
      }
    }
  }
}

// ============================================================================
// 4. ТАКТИЧНІ УРОЖИЩА, УКРИТТЯ ТА КУЩІ
// ============================================================================

interface RawObstacleDef {
  kind: 'rock' | 'building' | 'bunker';
  x: number;
  z: number;
  radius: number;
  height: number;
}

const BASE_OBSTACLE_LOCATIONS: Array<{ x: number; z: number; radius: number; height: number }> = [
  // Західний фланг (укриття біля скель)
  { x: -46, z: -32, radius: 4.2, height: 4.8 },
  { x: -48, z: 0, radius: 4.6, height: 5.2 },
  { x: -45, z: 32, radius: 4.0, height: 4.5 },
  { x: -60, z: -16, radius: 3.8, height: 4.2 },
  { x: -60, z: 18, radius: 3.8, height: 4.2 },

  // Східний фланг (укриття для снайперів)
  { x: 46, z: -32, radius: 4.2, height: 4.8 },
  { x: 48, z: 0, radius: 4.6, height: 5.2 },
  { x: 45, z: 32, radius: 4.0, height: 4.5 },
  { x: 60, z: -16, radius: 3.8, height: 4.2 },
  { x: 60, z: 18, radius: 3.8, height: 4.2 },

  // Центральна долина та передові рубежі (безпечна відстань від баз!)
  { x: -18, z: -20, radius: 3.6, height: 3.8 },
  { x: 18, z: -20, radius: 3.6, height: 3.8 },
  { x: -20, z: 18, radius: 3.6, height: 3.8 },
  { x: 20, z: 18, radius: 3.6, height: 3.8 },
  { x: -12, z: -2, radius: 3.2, height: 3.5 },
  { x: 14, z: 2, radius: 3.2, height: 3.5 },
  { x: 0, z: -24, radius: 3.8, height: 4.0 },
  { x: 0, z: 24, radius: 3.8, height: 4.0 },

  // Проміжні пагорбні позиції
  { x: -34, z: -46, radius: 3.9, height: 4.3 },
  { x: 34, z: -46, radius: 3.9, height: 4.3 },
  { x: -34, z: 46, radius: 3.9, height: 4.3 },
  { x: 34, z: 46, radius: 3.9, height: 4.3 },
  { x: -30, z: -10, radius: 3.5, height: 3.9 },
  { x: 30, z: -10, radius: 3.5, height: 3.9 },
  { x: -28, z: 30, radius: 3.5, height: 3.9 },
  { x: 28, z: 30, radius: 3.5, height: 3.9 }
];

const RAW_BUSH_COORDS: Array<{ x: number; z: number; radius: number }> = [
  // Засідки на передовій
  { x: -10, z: 36, radius: 2.6 },
  { x: 10, z: 36, radius: 2.6 },
  { x: -10, z: -36, radius: 2.6 },
  { x: 10, z: -36, radius: 2.6 },
  { x: -26, z: 12, radius: 2.8 },
  { x: 26, z: 12, radius: 2.8 },
  { x: -26, z: -12, radius: 2.8 },
  { x: 26, z: -12, radius: 2.8 },
  { x: -40, z: 18, radius: 2.7 },
  { x: 40, z: 18, radius: 2.7 },
  { x: -40, z: -18, radius: 2.7 },
  { x: 40, z: -18, radius: 2.7 },
  { x: -38, z: 0, radius: 2.9 },
  { x: 38, z: 0, radius: 2.9 },
  { x: -16, z: 0, radius: 2.5 },
  { x: 16, z: 0, radius: 2.5 },
  { x: 0, z: 10, radius: 2.6 },
  { x: 0, z: -10, radius: 2.6 },

  // Флангові лісосмуги
  { x: -52, z: 22, radius: 3.0 },
  { x: -52, z: -22, radius: 3.0 },
  { x: 52, z: 22, radius: 3.0 },
  { x: 52, z: -22, radius: 3.0 },
  { x: -54, z: 38, radius: 2.8 },
  { x: 54, z: 38, radius: 2.8 },
  { x: -54, z: -38, radius: 2.8 },
  { x: 54, z: -38, radius: 2.8 },
  { x: -22, z: 42, radius: 2.7 },
  { x: 22, z: 42, radius: 2.7 },
  { x: -22, z: -42, radius: 2.7 },
  { x: 22, z: -42, radius: 2.7 },
  { x: -36, z: 32, radius: 2.8 },
  { x: 36, z: 32, radius: 2.8 },
  { x: -36, z: -32, radius: 2.8 },
  { x: 36, z: -32, radius: 2.8 },
  { x: -6, z: 22, radius: 2.5 },
  { x: 6, z: 22, radius: 2.5 },
  { x: -6, z: -22, radius: 2.5 },
  { x: 6, z: -22, radius: 2.5 }
];

const RAW_BARREL_SPAWNS: BarrelSpawnPoint[] = [
  { x: -20, z: -14 },
  { x: 20, z: -14 },
  { x: -20, z: 14 },
  { x: 20, z: 14 },
  { x: -32, z: 24 },
  { x: 32, z: 24 },
  { x: -32, z: -24 },
  { x: 32, z: -24 },
  { x: -42, z: -2 },
  { x: 42, z: -2 },
  { x: 0, z: 14 },
  { x: 0, z: -14 },
  { x: -14, z: 28 },
  { x: 14, z: -28 }
];

// ============================================================================
// 5. ПОБУДОВА 3D-КАРТИ WOT (buildWoTMapArena)
// ============================================================================

export function buildWoTMapArena(mapId: MapBiomeId): BuiltMapArena {
  const arenaGroup = new THREE.Group();
  arenaGroup.name = `WoT_Arena_${mapId}`;

  const getHeightAt = createTerrainHeightFunction(mapId);
  const getNormalAt = createTerrainNormalFunction(getHeightAt);

  // --------------------------------------------------------------------------
  // 5.1. Рельєфна сітка землі PlaneGeometry(220, 220, 110, 110)
  // --------------------------------------------------------------------------
  const terrainGeo = new THREE.PlaneGeometry(220, 220, 110, 110);
  terrainGeo.rotateX(-Math.PI / 2); // Повертаємо у площину XZ (+Y вгору)

  const posAttr = terrainGeo.attributes.position;
  const vertCount = posAttr.count;
  const colorBuffer = new Float32Array(vertCount * 3);
  const tempColor = new THREE.Color();

  for (let i = 0; i < vertCount; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = getHeightAt(vx, vz);
    posAttr.setY(i, vy);

    const normal = getNormalAt(vx, vz);
    const slope = 1.0 - normal.y; // 0 для плаского, >0 для схилу

    computeVertexColor(mapId, vx, vy, vz, slope, tempColor);
    colorBuffer[i * 3] = tempColor.r;
    colorBuffer[i * 3 + 1] = tempColor.g;
    colorBuffer[i * 3 + 2] = tempColor.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colorBuffer, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.08,
    flatShading: false
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.name = 'Terrain';
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = false;
  arenaGroup.add(terrainMesh);

  // --------------------------------------------------------------------------
  // 5.2. Тактичні укриття (скелі, будиночки або ДОТи)
  // --------------------------------------------------------------------------
  const obstacles: MapObstacle[] = [];
  const obstaclesGroup = new THREE.Group();
  obstaclesGroup.name = 'Obstacles';

  // Матеріали для об'єктів залежно від біому
  const stoneColor =
    mapId === 'hills'
      ? 0x64748b
      : mapId === 'desert'
        ? 0xb45309
        : mapId === 'volcano'
          ? 0x1c1917
          : mapId === 'city'
            ? 0x374151
            : 0x475569;
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: stoneColor,
    roughness: mapId === 'volcano' ? 0.75 : 0.92,
    metalness: mapId === 'volcano' ? 0.25 : 0.05,
    flatShading: true
  });

  const houseWallMat = new THREE.MeshStandardMaterial({
    color: 0x994d38, // Червона цегла / глина
    roughness: 0.85
  });
  const houseRoofMat = new THREE.MeshStandardMaterial({
    color: 0x3b2318, // Темна черепиця
    roughness: 0.75
  });

  // Спеціальні матеріали для вечірнього Хіммельсдорфа
  const cityWallMat1 = new THREE.MeshStandardMaterial({
    color: 0x4b5563, // Темно-сіра міська цегла
    roughness: 0.88
  });
  const cityWallMat2 = new THREE.MeshStandardMaterial({
    color: 0x374151, // Графітовий фасад
    roughness: 0.82
  });
  const cityRoofMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937, // Темна шиферна покрівля
    roughness: 0.7
  });
  const cityCorniceMat = new THREE.MeshStandardMaterial({
    color: 0x6b7280, // Світліший карниз
    roughness: 0.75
  });
  const cityWindowMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a // Тепле світло у вікнах вечірнього міста
  });
  const hedgehogMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1f2937, // Протитанкові загородження («їжаки»)
    roughness: 0.45,
    metalness: 0.8
  });
  const barricadeBrickMat = new THREE.MeshStandardMaterial({
    color: 0x78350f, // Зруйнована цегляна стіна
    roughness: 0.95
  });

  const bunkerConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x52525b, // Міцний залізобетон
    roughness: 0.9,
    metalness: 0.15
  });
  const bunkerSlitMat = new THREE.MeshBasicMaterial({ color: 0x09090b });

  BASE_OBSTACLE_LOCATIONS.forEach((loc, idx) => {
    // Чергуємо типи перешкод:
    // hills: 65% скелі, 35% сільські будиночки
    // desert/arctic: 60% скелі, 40% бетонні бункери/ДОТи
    // city: 65% міські будівлі з вікнами, барикади/їжаки та скелі на Замковій горі
    let kind: 'rock' | 'building' | 'bunker';
    if (mapId === 'city') {
      if (loc.x > 25 && idx % 2 === 0) {
        kind = 'rock'; // Гранітні скелі на Замковому пагорбі
      } else if (idx % 3 === 1) {
        kind = 'bunker'; // Протитанкові барикади та їжаки
      } else {
        kind = 'building'; // Міські будівлі
      }
    } else if (mapId === 'hills') {
      kind = idx % 3 === 1 ? 'building' : 'rock';
    } else {
      kind = idx % 3 === 1 ? 'bunker' : 'rock';
    }

    const groundY = getHeightAt(loc.x, loc.z);
    const obsId = idx + 1;

    obstacles.push({
      id: obsId,
      kind,
      x: loc.x,
      z: loc.z,
      radius: loc.radius,
      height: loc.height
    });

    if (kind === 'rock') {
      // Масивний валун з гранями
      const rockGeo = new THREE.DodecahedronGeometry(loc.radius * 1.05, 0);
      const rockMesh = new THREE.Mesh(rockGeo, rockMaterial);
      rockMesh.scale.set(1.0, 1.25, 0.92);
      rockMesh.position.set(loc.x, groundY + loc.height * 0.35, loc.z);
      rockMesh.rotation.set((idx * 0.4) % 3, (idx * 0.8) % 3, (idx * 0.3) % 3);
      rockMesh.castShadow = true;
      rockMesh.receiveShadow = true;
      obstaclesGroup.add(rockMesh);
    } else if (kind === 'building') {
      const bGroup = new THREE.Group();
      bGroup.position.set(loc.x, groundY, loc.z);
      bGroup.rotation.y = (idx * 0.7) % (Math.PI * 2);

      if (mapId === 'city') {
        // Міська багатоповерхова будівля Хіммельсдорфа з теплими сяючими вікнами
        const wallMat = idx % 2 === 0 ? cityWallMat1 : cityWallMat2;
        const bWidth = loc.radius * 1.7;
        const bHeight = loc.height * 0.85;
        const bDepth = loc.radius * 1.5;

        const wallGeo = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
        const wallMesh = new THREE.Mesh(wallGeo, wallMat);
        wallMesh.position.y = bHeight / 2;
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        bGroup.add(wallMesh);

        // Карниз
        const corniceGeo = new THREE.BoxGeometry(bWidth * 1.06, loc.height * 0.08, bDepth * 1.06);
        const corniceMesh = new THREE.Mesh(corniceGeo, cityCorniceMat);
        corniceMesh.position.y = bHeight;
        corniceMesh.castShadow = true;
        bGroup.add(corniceMesh);

        // Дах
        const roofGeo = new THREE.ConeGeometry(loc.radius * 1.25, loc.height * 0.45, 4);
        const roofMesh = new THREE.Mesh(roofGeo, cityRoofMat);
        roofMesh.position.y = bHeight + (loc.height * 0.45) / 2;
        roofMesh.rotation.y = Math.PI / 4;
        roofMesh.castShadow = true;
        bGroup.add(roofMesh);

        // Вікна, що світяться у сутінках
        const winW = loc.radius * 0.22;
        const winH = loc.height * 0.16;
        const winGeo = new THREE.BoxGeometry(winW, winH, 0.08);

        const xOffsets = [-bWidth * 0.28, 0, bWidth * 0.28];
        const yOffsets = [bHeight * 0.32, bHeight * 0.68];

        for (const wx of xOffsets) {
          for (const wy of yOffsets) {
            const winFront = new THREE.Mesh(winGeo, cityWindowMat);
            winFront.position.set(wx, wy, bDepth / 2 + 0.04);
            bGroup.add(winFront);

            const winBack = new THREE.Mesh(winGeo, cityWindowMat);
            winBack.position.set(wx, wy, -bDepth / 2 - 0.04);
            bGroup.add(winBack);
          }
        }

        const winSideGeo = new THREE.BoxGeometry(0.08, winH, winW);
        const zOffsets = [-bDepth * 0.24, bDepth * 0.24];
        for (const wz of zOffsets) {
          for (const wy of yOffsets) {
            const winRight = new THREE.Mesh(winSideGeo, cityWindowMat);
            winRight.position.set(bWidth / 2 + 0.04, wy, wz);
            bGroup.add(winRight);

            const winLeft = new THREE.Mesh(winSideGeo, cityWindowMat);
            winLeft.position.set(-bWidth / 2 - 0.04, wy, wz);
            bGroup.add(winLeft);
          }
        }
      } else {
        // Сільський будиночок / руїни
        const wallGeo = new THREE.BoxGeometry(loc.radius * 1.6, loc.height * 0.65, loc.radius * 1.4);
        const wallMesh = new THREE.Mesh(wallGeo, houseWallMat);
        wallMesh.position.y = (loc.height * 0.65) / 2;
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        bGroup.add(wallMesh);

        const roofGeo = new THREE.ConeGeometry(loc.radius * 1.25, loc.height * 0.5, 4);
        const roofMesh = new THREE.Mesh(roofGeo, houseRoofMat);
        roofMesh.position.y = loc.height * 0.65 + (loc.height * 0.5) / 2;
        roofMesh.rotation.y = Math.PI / 4;
        roofMesh.castShadow = true;
        bGroup.add(roofMesh);
      }

      obstaclesGroup.add(bGroup);
    } else {
      if (mapId === 'city') {
        // Міська протитанкова барикада та сталеві протитанкові «їжаки»
        const barricadeGroup = new THREE.Group();
        barricadeGroup.position.set(loc.x, groundY, loc.z);
        barricadeGroup.rotation.y = (idx * 0.75) % (Math.PI * 2);

        const wallGeo = new THREE.BoxGeometry(loc.radius * 1.7, loc.height * 0.52, loc.radius * 0.65);
        const wallMesh = new THREE.Mesh(wallGeo, barricadeBrickMat);
        wallMesh.position.y = (loc.height * 0.52) / 2;
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        barricadeGroup.add(wallMesh);

        const beamGeo = new THREE.BoxGeometry(0.32, loc.height * 0.72, 0.32);
        const beam1 = new THREE.Mesh(beamGeo, hedgehogMetalMat);
        beam1.position.set(0, loc.height * 0.52, 0);
        beam1.rotation.set(0.65, 0.2, 0.4);
        beam1.castShadow = true;
        barricadeGroup.add(beam1);

        const beam2 = new THREE.Mesh(beamGeo, hedgehogMetalMat);
        beam2.position.set(0, loc.height * 0.52, 0);
        beam2.rotation.set(-0.65, 0.5, -0.3);
        beam2.castShadow = true;
        barricadeGroup.add(beam2);

        const beam3 = new THREE.Mesh(beamGeo, hedgehogMetalMat);
        beam3.position.set(0, loc.height * 0.52, 0);
        beam3.rotation.set(0.1, -0.65, 0.8);
        beam3.castShadow = true;
        barricadeGroup.add(beam3);

        obstaclesGroup.add(barricadeGroup);
      } else {
        // Бетонний ДОТ / бункер
        const bunkerGroup = new THREE.Group();
        bunkerGroup.position.set(loc.x, groundY, loc.z);
        bunkerGroup.rotation.y = (idx * 0.6) % (Math.PI * 2);

        const baseGeo = new THREE.CylinderGeometry(
          loc.radius * 0.95,
          loc.radius * 1.15,
          loc.height * 0.75,
          6
        );
        const baseMesh = new THREE.Mesh(baseGeo, bunkerConcreteMat);
        baseMesh.position.y = (loc.height * 0.75) / 2;
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        bunkerGroup.add(baseMesh);

        const cupolaGeo = new THREE.CylinderGeometry(
          loc.radius * 0.45,
          loc.radius * 0.52,
          loc.height * 0.35,
          8
        );
        const cupolaMesh = new THREE.Mesh(cupolaGeo, bunkerConcreteMat);
        cupolaMesh.position.y = loc.height * 0.75 + (loc.height * 0.35) / 2;
        cupolaMesh.castShadow = true;
        bunkerGroup.add(cupolaMesh);

        const slitGeo = new THREE.BoxGeometry(loc.radius * 0.9, loc.height * 0.12, loc.radius * 0.3);
        const slitMesh = new THREE.Mesh(slitGeo, bunkerSlitMat);
        slitMesh.position.set(0, loc.height * 0.5, loc.radius * 0.85);
        bunkerGroup.add(slitMesh);

        obstaclesGroup.add(bunkerGroup);
      }
    }
  });

  // --------------------------------------------------------------------------
  // 5.3. Скеляста огорожа вздовж периметра карти (±WORLD_HALF_SIZE)
  // --------------------------------------------------------------------------
  const perimeterRockMat = new THREE.MeshStandardMaterial({
    color: stoneColor,
    roughness: 0.95,
    flatShading: true
  });
  const perimeterGroup = new THREE.Group();
  perimeterGroup.name = 'PerimeterCliffs';

  const edgeCount = 18;
  for (let i = 0; i < edgeCount; i++) {
    const fraction = (i / edgeCount) * 2 - 1; // -1..1
    const pos = fraction * (WORLD_HALF_SIZE - 4);
    const borderPoints = [
      { x: pos, z: -(WORLD_HALF_SIZE - 2) },
      { x: pos, z: WORLD_HALF_SIZE - 2 },
      { x: -(WORLD_HALF_SIZE - 2), z: pos },
      { x: WORLD_HALF_SIZE - 2, z: pos }
    ];

    for (const pt of borderPoints) {
      const gy = getHeightAt(pt.x, pt.z);
      const cliffGeo = new THREE.DodecahedronGeometry(5.5, 0);
      const cliffMesh = new THREE.Mesh(cliffGeo, perimeterRockMat);
      cliffMesh.scale.set(1.1, 1.6, 1.1);
      cliffMesh.position.set(pt.x, gy + 2.5, pt.z);
      cliffMesh.rotation.set((i * 0.5) % 3, (i * 0.9) % 3, 0);
      cliffMesh.castShadow = true;
      perimeterGroup.add(cliffMesh);
    }
  }
  arenaGroup.add(perimeterGroup);
  arenaGroup.add(obstaclesGroup);

  // --------------------------------------------------------------------------
  // 5.4. Вуличні ліхтарі Хіммельсдорфа (Street Lights)
  // --------------------------------------------------------------------------
  if (mapId === 'city') {
    const streetLightsGroup = new THREE.Group();
    streetLightsGroup.name = 'StreetLights';

    const lampPoleMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.85,
      roughness: 0.35
    });
    const lampGlowMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a // Тепла бурштинова лампа, що сяє у нічному місті
    });

    const streetLightCoords: Array<{ x: number; z: number }> = [
      // Центральний проспект (північ-південь)
      { x: -14, z: -35 },
      { x: 14, z: -35 },
      { x: -14, z: -15 },
      { x: 14, z: -15 },
      { x: -14, z: 15 },
      { x: 14, z: 15 },
      { x: -14, z: 35 },
      { x: 14, z: 35 },
      // Поперечні бульвари (захід-схід)
      { x: -35, z: -14 },
      { x: -35, z: 14 },
      { x: 35, z: -14 },
      { x: 35, z: 14 },
      // Центральна площа
      { x: -8, z: 0 },
      { x: 8, z: 0 },
      { x: 0, z: -8 },
      { x: 0, z: 8 },
      // Підходи до Замкової гори
      { x: 26, z: -30 },
      { x: 26, z: 30 }
    ];

    for (const pos of streetLightCoords) {
      const gy = getHeightAt(pos.x, pos.z);
      const lightPost = new THREE.Group();
      lightPost.position.set(pos.x, gy, pos.z);

      // Стовп ліхтаря
      const poleGeo = new THREE.CylinderGeometry(0.12, 0.22, 4.4, 8);
      const poleMesh = new THREE.Mesh(poleGeo, lampPoleMat);
      poleMesh.position.y = 2.2;
      poleMesh.castShadow = true;
      lightPost.add(poleMesh);

      // Верхній декоративний кронштейн
      const topGeo = new THREE.BoxGeometry(0.65, 0.15, 0.65);
      const topMesh = new THREE.Mesh(topGeo, lampPoleMat);
      topMesh.position.y = 4.4;
      lightPost.add(topMesh);

      // Лампа з теплим світлом
      const lanternGeo = new THREE.CylinderGeometry(0.28, 0.18, 0.45, 6);
      const lanternMesh = new THREE.Mesh(lanternGeo, lampGlowMat);
      lanternMesh.position.y = 4.15;
      lightPost.add(lanternMesh);

      streetLightsGroup.add(lightPost);
    }

    arenaGroup.add(streetLightsGroup);
  }

  // --------------------------------------------------------------------------
  // 5.5. Пишні напівпрозорі кущі WoT та декоративні дерева
  // --------------------------------------------------------------------------
  const bushes: MapBush[] = [];
  const vegetationGroup = new THREE.Group();
  vegetationGroup.name = 'Vegetation';

  const bushColor =
    mapId === 'hills'
      ? 0x2e6f28
      : mapId === 'desert'
        ? 0x937c48
        : mapId === 'volcano'
          ? 0x3f3f46
          : mapId === 'city'
            ? 0x2d4a22
            : 0x334e44;
  const bushMat = new THREE.MeshStandardMaterial({
    color: bushColor,
    roughness: 0.92,
    transparent: true,
    opacity: 0.88,
    depthWrite: true,
    flatShading: true
  });

  const treeTrunkMat = new THREE.MeshStandardMaterial({
    color: mapId === 'volcano' ? 0x18181b : mapId === 'city' ? 0x292524 : 0x4a3525,
    roughness: 0.9
  });
  const treeFoliageMat = new THREE.MeshStandardMaterial({
    color:
      mapId === 'hills'
        ? 0x1f5e20
        : mapId === 'desert'
          ? 0x826d3b
          : mapId === 'volcano'
            ? 0x27272a
            : mapId === 'city'
              ? 0x243e1d
              : 0x213a30,
    roughness: 0.95,
    flatShading: true
  });

  RAW_BUSH_COORDS.forEach((bCoord, idx) => {
    bushes.push({
      x: bCoord.x,
      z: bCoord.z,
      radius: bCoord.radius
    });

    const gy = getHeightAt(bCoord.x, bCoord.z);
    const bMeshGroup = new THREE.Group();
    bMeshGroup.position.set(bCoord.x, gy, bCoord.z);

    // Пишний об'єм куща з 3 перекритих сфер/ікосаедрів
    const sphereGeo1 = new THREE.IcosahedronGeometry(bCoord.radius * 0.75, 1);
    const sphereMesh1 = new THREE.Mesh(sphereGeo1, bushMat);
    sphereMesh1.position.set(0, bCoord.radius * 0.55, 0);
    bMeshGroup.add(sphereMesh1);

    const sphereGeo2 = new THREE.IcosahedronGeometry(bCoord.radius * 0.55, 1);
    const sphereMesh2 = new THREE.Mesh(sphereGeo2, bushMat);
    sphereMesh2.position.set(bCoord.radius * 0.35, bCoord.radius * 0.45, bCoord.radius * 0.2);
    bMeshGroup.add(sphereMesh2);

    const sphereGeo3 = new THREE.IcosahedronGeometry(bCoord.radius * 0.52, 1);
    const sphereMesh3 = new THREE.Mesh(sphereGeo3, bushMat);
    sphereMesh3.position.set(-bCoord.radius * 0.3, bCoord.radius * 0.48, -bCoord.radius * 0.25);
    bMeshGroup.add(sphereMesh3);

    vegetationGroup.add(bMeshGroup);

    // Додаємо дерево біля кожного 4-го куща для WoT-атмосфери лісосмуг
    if (idx % 4 === 0) {
      const treeGroup = new THREE.Group();
      const treeX = bCoord.x + (idx % 2 === 0 ? 3.5 : -3.5);
      const treeZ = bCoord.z + (idx % 3 === 0 ? 3.0 : -3.0);
      const treeGy = getHeightAt(treeX, treeZ);
      treeGroup.position.set(treeX, treeGy, treeZ);

      const trunkGeo = new THREE.CylinderGeometry(0.3, 0.42, 3.8, 6);
      const trunkMesh = new THREE.Mesh(trunkGeo, treeTrunkMat);
      trunkMesh.position.y = 1.9;
      trunkMesh.castShadow = true;
      treeGroup.add(trunkMesh);

      const leavesGeo1 = new THREE.ConeGeometry(2.1, 3.2, 6);
      const leavesMesh1 = new THREE.Mesh(leavesGeo1, treeFoliageMat);
      leavesMesh1.position.y = 4.2;
      leavesMesh1.castShadow = true;
      treeGroup.add(leavesMesh1);

      const leavesGeo2 = new THREE.ConeGeometry(1.6, 2.6, 6);
      const leavesMesh2 = new THREE.Mesh(leavesGeo2, treeFoliageMat);
      leavesMesh2.position.y = 5.6;
      leavesMesh2.castShadow = true;
      treeGroup.add(leavesMesh2);

      vegetationGroup.add(treeGroup);
    }
  });

  arenaGroup.add(vegetationGroup);

  // --------------------------------------------------------------------------
  // 5.5. Точки спавну: Гравець, Дуель, Хвилі та Бочки
  // --------------------------------------------------------------------------
  const playerSpawn = { x: 0, z: 52, yaw: Math.PI }; // Дивиться на північ (-Z) у центр арени
  const duelEnemySpawn = { x: 0, z: -52, yaw: 0 };  // Дивиться на південь (+Z) у бік гравця

  const waveSpawnPoints: Array<{ x: number; z: number }> = [
    { x: -58, z: -62 }, // Північний Захід
    { x: 0, z: -68 },   // Північ
    { x: 58, z: -62 },  // Північний Схід
    { x: 68, z: 0 },    // Схід
    { x: 58, z: 62 },   // Південний Схід
    { x: -58, z: 62 },  // Південний Захід
    { x: -68, z: 0 },   // Захід
    { x: 26, z: -50 }   // Північний центр
  ];

  return {
    group: arenaGroup,
    obstacles,
    bushes,
    barrelSpawns: [...RAW_BARREL_SPAWNS],
    playerSpawn,
    duelEnemySpawn,
    waveSpawnPoints,
    getHeightAt,
    getNormalAt
  };
}

// ============================================================================
// 6. ГЕНЕРАТОР НЕСКІНЧЕННИХ ХВИЛЬ (generateWaveEnemies)
// ============================================================================

function createWaveUnit(
  tierId: TankTierId,
  waveNumber: number,
  customName?: string
): EnemyWaveUnitSpec {
  const spec = TANK_SPECS[tierId];
  const waveBonus = 1 + waveNumber * 0.035;

  return {
    tierId,
    isBoss: false,
    name: customName ?? spec.name,
    hp: Math.round(spec.baseHp * (0.8 + waveNumber * 0.03)),
    damage: Math.round(spec.primaryWeapon.damage * (0.8 + waveNumber * 0.025)),
    reloadSec: Number(Math.max(0.85, spec.primaryWeapon.reloadSec * (1.05 - waveNumber * 0.01)).toFixed(2)),
    speed: Number((spec.baseSpeed * 0.9).toFixed(2)),
    scale: 1.0,
    rewardCoins: Math.round(25 * spec.tierNumber + waveNumber * 4),
    scorePoints: Math.round(160 * spec.tierNumber + waveNumber * 30)
  };
}

export function generateWaveEnemies(waveNumber: number): EnemyWaveUnitSpec[] {
  const wave = Math.max(1, waveNumber);

  // Хвиля 1: 3 ворожих легких танки (tier1) для комфортного знайомства
  if (wave === 1) {
    return [
      createWaveUnit('tier1', 1, 'ЛТ-1 «Розвідник»'),
      createWaveUnit('tier1', 1, 'ЛТ-1 «Патрульний»'),
      createWaveUnit('tier1', 1, 'ЛТ-1 «Стрілець»')
    ];
  }

  const isBossWave = wave % 5 === 0;

  if (isBossWave) {
    // ------------------------------------------------------------------------
    // БОС ХВИЛІ (кожна 5-та хвиля)
    // ------------------------------------------------------------------------
    let bossTier: TankTierId = 'tier3';
    let bossName = 'Панцер-Колос';

    if (wave === 5) {
      bossTier = 'tier3';
      bossName = 'Важкий «Панцер-Колос»';
    } else if (wave === 10) {
      bossTier = 'tier4';
      bossName = 'Пустельний «Молох-Руйнівник»';
    } else if (wave === 15) {
      bossTier = 'tier4';
      bossName = 'Полярний «Кріо-Титан»';
    } else if (wave === 20) {
      bossTier = 'tier5';
      bossName = 'Двогарматний «Генерал Левіафан»';
    } else {
      bossTier = 'tier5';
      bossName = `Володар Арени «Омега-Мк${Math.floor(wave / 5)}»`;
    }

    const bossBaseSpec = TANK_SPECS[bossTier];
    const bossUnit: EnemyWaveUnitSpec = {
      tierId: bossTier,
      isBoss: true,
      name: bossName,
      hp: Math.round(bossBaseSpec.baseHp * 2.6 + wave * 140),
      damage: Math.round(bossBaseSpec.primaryWeapon.damage * 1.35 + wave * 4),
      reloadSec: Number(Math.max(1.1, bossBaseSpec.primaryWeapon.reloadSec * 0.9).toFixed(2)),
      speed: Number((bossBaseSpec.baseSpeed * 0.88).toFixed(2)),
      scale: 1.45,
      rewardCoins: Math.round(320 + wave * 55),
      scorePoints: Math.round(3500 + wave * 500)
    };

    // Свита боса (3-6 танків підтримки)
    const escortCount = Math.min(6, 2 + Math.floor(wave / 5));
    const escortTiers: TankTierId[] = wave >= 15 ? ['tier3', 'tier4'] : wave >= 10 ? ['tier2', 'tier3'] : ['tier1', 'tier2'];
    const escortList: EnemyWaveUnitSpec[] = [];

    for (let i = 0; i < escortCount; i++) {
      const escortTier = escortTiers[i % escortTiers.length];
      escortList.push(createWaveUnit(escortTier, wave, `Охоронець «${TANK_SPECS[escortTier].name}»`));
    }

    return [bossUnit, ...escortList];
  }

  // --------------------------------------------------------------------------
  // ЗВИЧАЙНІ ХВИЛІ: поступове збільшення ворогів (від 4 до 12) і сильніші танки
  // --------------------------------------------------------------------------
  const enemyCount = Math.min(12, 3 + Math.floor(wave * 0.75));
  const enemies: EnemyWaveUnitSpec[] = [];

  // Доступні рівні техніки залежно від номера хвилі
  const pool: TankTierId[] = ['tier1'];
  if (wave >= 2) pool.push('tier2');
  if (wave >= 3) pool.push('tier2', 'tier3');
  if (wave >= 4) pool.push('tier3', 'tier4');
  if (wave >= 6) pool.push('tier4', 'tier5');

  for (let i = 0; i < enemyCount; i++) {
    // Розподіл рівнів: попереду легкі/середні, далі важчі
    const tierIdx = Math.floor((i / enemyCount) * pool.length);
    const chosenTier = pool[Math.min(pool.length - 1, tierIdx)];
    enemies.push(createWaveUnit(chosenTier, wave));
  }

  return enemies;
}

// ============================================================================
// 7. ЧЕМПІОН ДЛЯ РЕЖИМУ «БИТВА 1 НА 1» (generateDuelOpponent)
// ============================================================================

const DUEL_TITLES: Record<TankTierId, string[]> = {
  tier1: ['Ас «Блискавичний Шершень»', 'Розвідник «Сокіл»', 'Снайпер «Привид»'],
  tier2: ['Ветеран «Штурмовик»', 'Командир «Беркут»', 'Майстер бою «Козак»'],
  tier3: ['Танковий Ас «Бастіон»', 'Барон «Залізна Цитадель»', 'Майор «Грім»'],
  tier4: ['Винищувач «Кат Каньйону»', 'Громовержець «Молот»', 'Майстер «Фугас»'],
  tier5: ['Генерал «Електро-Левіафан»', 'Архітектор «Тесла-Шторм»', 'Кібер-Командор «Омега»']
};

export function generateDuelOpponent(
  playerTierId: TankTierId,
  duelWins: number
): EnemyWaveUnitSpec {
  const spec = TANK_SPECS[playerTierId];
  const titles = DUEL_TITLES[playerTierId];
  const title = titles[duelWins % titles.length];
  const rankLabel = duelWins > 0 ? ` [Ранг ${duelWins + 1}]` : '';
  const fullName = `${title}${rankLabel}`;

  // Підвищене HP для напруженої й цікавої дуелі 1 на 1
  const hpBonus = 1.55 + Math.min(0.85, duelWins * 0.07);
  const dmgBonus = 1.05 + Math.min(0.35, duelWins * 0.025);
  const reloadReduction = Math.min(0.18, duelWins * 0.015);

  return {
    tierId: playerTierId,
    isBoss: false,
    name: fullName,
    hp: Math.round(spec.baseHp * hpBonus),
    damage: Math.round(spec.primaryWeapon.damage * dmgBonus),
    reloadSec: Number(Math.max(0.75, spec.primaryWeapon.reloadSec * (0.95 - reloadReduction)).toFixed(2)),
    speed: Number((spec.baseSpeed * 0.98).toFixed(2)),
    scale: 1.12,
    rewardCoins: Math.round(180 + spec.tierNumber * 65 + duelWins * 35),
    scorePoints: Math.round(1200 + spec.tierNumber * 450 + duelWins * 220)
  };
}
