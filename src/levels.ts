import { type BarrelSpawn, type BiomeId, type BossId, type BossSpec, type EnemyKind, SubTile, type StageDefinition } from './types';

export type { StageDefinition };

export const ARENA_HALF = 18;

export const BASE_SUB_COORDS: ReadonlyArray<readonly [number, number]> = [
  [17, 34],
  [18, 34],
  [17, 35],
  [18, 35]
];

export const BASE_WALL_COORDS: ReadonlyArray<readonly [number, number]> = [
  [16, 33],
  [16, 34],
  [16, 35],
  [17, 33],
  [18, 33],
  [19, 33],
  [19, 34],
  [19, 35]
];

export const TOTAL_CAMPAIGN_STAGES = 16;

function buildWave(counts: { basic: number; fast: number; power: number; armor: number }): EnemyKind[] {
  const list: EnemyKind[] = [];
  const total = counts.basic + counts.fast + counts.power + counts.armor;
  const rem = { ...counts };
  const order: EnemyKind[] = ['basic', 'fast', 'power', 'armor'];
  let idx = 0;
  while (list.length < total) {
    const kind = order[idx % order.length];
    if (rem[kind] > 0) {
      list.push(kind);
      rem[kind]--;
    }
    idx++;
  }
  return list;
}

const CAMPAIGN_STAGES: StageDefinition[] = [
  // =================== БІОМ 1: INDUSTRIAL (Промзона) ===================
  {
    id: 1,
    name: 'Вхід до Промзони',
    biome: 'industrial',
    layout: [
      '..................',
      '..##..........##..',
      '..##..##..##..##..',
      '......##..##......',
      '..##..........##..',
      '..#B..##..##..B#..',
      '......##..##......',
      '.@##..........##@.',
      '.@##..##..##..##@.',
      '......#@..@#......',
      '..##..#@..@#..##..',
      '..##..........##..',
      '......B#..#B......',
      '.@##..##..##..##@.',
      '.@##..........##@.',
      '......##..##......',
      '..................',
      '..................'
    ],
    enemies: buildWave({ basic: 10, fast: 4, power: 2, armor: 0 })
  },
  {
    id: 2,
    name: 'Складальний цех',
    biome: 'industrial',
    layout: [
      '..................',
      '..#@...#..#...@#..',
      '..#@...#..#...@#..',
      '......##..##......',
      '.##............##.',
      '.##..@##..##@..##.',
      '.....@##..##@.....',
      '..##..........##..',
      '..##..B....B..##..',
      '..##..........##..',
      '.....@##..##@.....',
      '.##..@##..##@..##.',
      '.##............##.',
      '......##..##......',
      '..#@...#..#...@#..',
      '..#@..........@#..',
      '..................',
      '..................'
    ],
    enemies: buildWave({ basic: 8, fast: 6, power: 3, armor: 1 })
  },
  {
    id: 3,
    name: 'Залізничний термінал',
    biome: 'industrial',
    layout: [
      '..................',
      '..##..#....#..##..',
      '..##..#....#..##..',
      '......##..##......',
      '.@##..B....B..##@.',
      '.@##..##..##..##@.',
      '......@#..#@......',
      '..##..........##..',
      '..##..##..##..##..',
      '......##..##......',
      '..##..........##..',
      '......@#..#@......',
      '.@##..##..##..##@.',
      '.@##..B....B..##@.',
      '......##..##......',
      '..##..#....#..##..',
      '..................',
      '..................'
    ],
    enemies: buildWave({ basic: 6, fast: 7, power: 4, armor: 3 })
  },
  {
    id: 4,
    name: 'Бронедепо: «Мамонт»',
    biome: 'industrial',
    layout: [
      '..................',
      '..##..........##..',
      '..##..##..##..##..',
      '......##..##......',
      '.@##...B..B...##@.',
      '.@##..........##@.',
      '......##..##......',
      '..##..@#..#@..##..',
      '..##..........##..',
      '..##..@#..#@..##..',
      '......##..##......',
      '.@##..........##@.',
      '.@##...B..B...##@.',
      '......##..##......',
      '..##..##..##..##..',
      '..##..........##..',
      '..................',
      '..................'
    ],
    enemies: buildWave({ basic: 3, fast: 3, power: 2, armor: 2 }),
    boss: {
      id: 'mammoth',
      name: 'Бронепоїзд «Мамонт»',
      maxHp: 900,
      speed: 3.1,
      contactDamage: 35,
      rewardCoins: 220,
      points: 2500
    }
  },

  // =================== БІОМ 2: DESERT (Пустельний каньйон) ===================
  {
    id: 5,
    name: 'Каньйон червоних скель',
    biome: 'desert',
    layout: [
      '..................',
      '..#....%..%....#..',
      '..##...%..%...##..',
      '......##..##......',
      '.##............##.',
      '.##..~~....~~..##.',
      '.....~~....~~.....',
      '..##...#..#...##..',
      '..##...B..B...##..',
      '..##...#..#...##..',
      '.....~~....~~.....',
      '.##..~~....~~..##.',
      '.##............##.',
      '......##..##......',
      '..##...%..%...##..',
      '..#....%..%....#..',
      '..................',
      '..................'
    ],
    enemies: buildWave({ basic: 6, fast: 6, power: 4, armor: 2 })
  },
  {
    id: 6,
    name: 'Пустельний оазис',
    biome: 'desert',
    layout: [
      '..................',
      '..%....%..%....%..',
      '..%%..~~..~~..%%..',
      '......~~..~~......',
      '.##...%%..%%...##.',
      '.##............##.',
      '.....@##..##@.....',
      '..B..@##..##@..B..',
      '......%%..%%......',
      '..B..@##..##@..B..',
      '.....@##..##@.....',
      '.##............##.',
      '.##...%%..%%...##.',
      '......~~..~~......',
      '..%%..~~..~~..%%..',
      '..%....%..%....%..',
      '..................',
      '..................'
    ],
    enemies: buildWave({ basic: 5, fast: 7, power: 5, armor: 3 })
  },
  {
    id: 7,
    name: 'Нафтовий термінал',
    biome: 'desert',
    layout: [
      '..................',
      '..#@...B..B...@#..',
      '..#@..........@#..',
      '......##..##......',
      '.##...##..##...##.',
      '.##...B....B...##.',
      '.....@#....#@.....',
      '..##.@#....#@.##..',
      '..##..........##..',
      '..##.@#....#@.##..',
      '.....@#....#@.....',
      '.##...B....B...##.',
      '.##...##..##...##.',
      '......##..##......',
      '..#@..........@#..',
      '..#@...B..B...@#..',
      '..................',
      '..................'
    ],
    enemies: buildWave({ basic: 4, fast: 7, power: 6, armor: 5 })
  },
  {
    id: 8,
    name: 'Цитадель пісків: «Мортирник»',
    biome: 'desert',
    layout: [
      '..................',
      '..##...%..%...##..',
      '..##...%..%...##..',
      '......##..##......',
      '.@##...B..B...##@.',
      '.@##..~~..~~..##@.',
      '......~~..~~......',
      '..##..@#..#@..##..',
      '..##..........##..',
      '..##..@#..#@..##..',
      '......~~..~~......',
      '.@##..~~..~~..##@.',
      '.@##...B..B...##@.',
      '......##..##......',
      '..##...%..%...##..',
      '..##...%..%...##..',
      '..................',
      '..................'
    ],
    enemies: buildWave({ basic: 2, fast: 4, power: 3, armor: 3 }),
    boss: {
      id: 'artillery',
      name: 'Пустельний «Мортирник»',
      maxHp: 1350,
      speed: 3.4,
      contactDamage: 40,
      rewardCoins: 320,
      points: 4000
    }
  },

  // =================== БІОМ 3: ARCTIC (Арктична база) ===================
  {
    id: 9,
    name: 'Крижаний перевал',
    biome: 'arctic',
    layout: [
      '..................',
      '..==...#..#...==..',
      '..==...#..#...==..',
      '......==..==......',
      '.##...==..==...##.',
      '.##............##.',
      '.....@##..##@.....',
      '..==.@##..##@.==..',
      '..==...B..B...==..',
      '..==.@##..##@.==..',
      '.....@##..##@.....',
      '.##............##.',
      '.##...==..==...##.',
      '......==..==......',
      '..==...#..#...==..',
      '..==...#..#...==..',
      '..................',
      '..................'
    ],
    enemies: buildWave({ basic: 4, fast: 8, power: 4, armor: 4 })
  },
  {
    id: 10,
    name: 'Замерзла тундра',
    biome: 'arctic',
    layout: [
      '..................',
      '..%....=..=....%..',
      '..%%...=..=...%%..',
      '......==..==......',
      '.==............==.',
      '.==...##..##...==.',
      '......##..##......',
      '..##...%..%...##..',
      '..##...B..B...##..',
      '..##...%..%...##..',
      '......##..##......',
      '.==...##..##...==.',
      '.==............==.',
      '......==..==......',
      '..%%...=..=...%%..',
      '..%....=..=....%..',
      '..................',
      '..................'
    ],
    enemies: buildWave({ basic: 3, fast: 8, power: 6, armor: 5 })
  },
  {
    id: 11,
    name: 'Секретна шахта льодовика',
    biome: 'arctic',
    layout: [
      '..................',
      '..=@...B..B...@=..',
      '..=@..........@=..',
      '......==..==......',
      '.==...#@..@#...==.',
      '.==............==.',
      '.....@##..##@.....',
      '..##.@##..##@.##..',
      '..##..==..==..##..',
      '..##.@##..##@.##..',
      '.....@##..##@.....',
      '.==............==.',
      '.==...#@..@#...==.',
      '......==..==......',
      '..=@..........@=..',
      '..=@...B..B...@=..',
      '..................',
      '..................'
    ],
    enemies: buildWave({ basic: 2, fast: 8, power: 7, armor: 7 })
  },
  {
    id: 12,
    name: 'Полярна фортеця: «Левіафан»',
    biome: 'arctic',
    layout: [
      '..................',
      '..==...=..=...==..',
      '..==...=..=...==..',
      '......==..==......',
      '.@##...B..B...##@.',
      '.@##..........##@.',
      '......==..==......',
      '..##..@=..=@..##..',
      '..##..==..==..##..',
      '..##..@=..=@..##..',
      '......==..==......',
      '.@##..........##@.',
      '.@##...B..B...##@.',
      '......==..==......',
      '..==...=..=...==..',
      '..==...=..=...==..',
      '..................',
      '..................'
    ],
    enemies: buildWave({ basic: 2, fast: 4, power: 4, armor: 4 }),
    boss: {
      id: 'cryo',
      name: 'Крижаний «Левіафан»',
      maxHp: 1850,
      speed: 3.8,
      contactDamage: 45,
      rewardCoins: 450,
      points: 6000
    }
  },

  // =================== БІОМ 4: VOLCANIC (Вулканічна фортеця) ===================
  {
    id: 13,
    name: 'Розпечені скелі',
    biome: 'volcanic',
    layout: [
      '..................',
      '..#....B..B....#..',
      '..##...~..~...##..',
      '......~~..~~......',
      '.##...~~..~~...##.',
      '.##...B....B...##.',
      '.....@##..##@.....',
      '..B..@##..##@..B..',
      '......~~..~~......',
      '..B..@##..##@..B..',
      '.....@##..##@.....',
      '.##...B....B...##.',
      '.##...~~..~~...##.',
      '......~~..~~......',
      '..##...~..~...##..',
      '..#....B..B....#..',
      '..................',
      '..................'
    ],
    enemies: buildWave({ basic: 3, fast: 7, power: 6, armor: 6 })
  },
  {
    id: 14,
    name: 'Лавові розломи',
    biome: 'volcanic',
    layout: [
      '..................',
      '..@~...B..B...~@..',
      '..@~..........~@..',
      '......~~..~~......',
      '.##...~~..~~...##.',
      '.##...B....B...##.',
      '.....@##..##@.....',
      '..##.@##..##@.##..',
      '..B....~..~....B..',
      '..##.@##..##@.##..',
      '.....@##..##@.....',
      '.##...B....B...##.',
      '.##...~~..~~...##.',
      '......~~..~~......',
      '..@~..........~@..',
      '..@~...B..B...~@..',
      '..................',
      '..................'
    ],
    enemies: buildWave({ basic: 2, fast: 8, power: 7, armor: 7 })
  },
  {
    id: 15,
    name: 'Вулканічні копальні',
    biome: 'volcanic',
    layout: [
      '..................',
      '..#@...B..B...@#..',
      '..#@...~..~...@#..',
      '......~~..~~......',
      '.@##...B..B...##@.',
      '.@##..~~..~~..##@.',
      '......~~..~~......',
      '..B...@#..#@...B..',
      '......@#..#@......',
      '..B...@#..#@...B..',
      '......~~..~~......',
      '.@##..~~..~~..##@.',
      '.@##...B..B...##@.',
      '......~~..~~......',
      '..#@...~..~...@#..',
      '..#@...B..B...@#..',
      '..................',
      '..................'
    ],
    enemies: buildWave({ basic: 1, fast: 8, power: 8, armor: 9 })
  },
  {
    id: 16,
    name: 'Жерло Імператора: «Інферно»',
    biome: 'volcanic',
    layout: [
      '..................',
      '..@~...B..B...~@..',
      '..@~...~..~...~@..',
      '......~~..~~......',
      '.@##...B..B...##@.',
      '.@##..@#..#@..##@.',
      '......@#..#@......',
      '..B....~..~....B..',
      '..##...B..B...##..',
      '..B....~..~....B..',
      '......@#..#@......',
      '.@##..@#..#@..##@.',
      '.@##...B..B...##@.',
      '......~~..~~......',
      '..@~...~..~...~@..',
      '..@~...B..B...~@..',
      '..................',
      '..................'
    ],
    enemies: buildWave({ basic: 2, fast: 4, power: 5, armor: 5 }),
    boss: {
      id: 'inferno',
      name: 'Вулканічний «Імператор»',
      maxHp: 2500,
      speed: 4.1,
      contactDamage: 55,
      rewardCoins: 650,
      points: 10000
    }
  }
];

export function getStageInfo(stageNum: number): StageDefinition {
  const clampedNum = Math.max(1, stageNum);
  const index = (clampedNum - 1) % CAMPAIGN_STAGES.length;
  const cycle = Math.floor((clampedNum - 1) / CAMPAIGN_STAGES.length);
  const template = CAMPAIGN_STAGES[index];

  if (cycle === 0) {
    return {
      id: clampedNum,
      name: template.name,
      biome: template.biome,
      layout: [...template.layout],
      enemies: [...template.enemies],
      boss: template.boss ? { ...template.boss } : undefined
    };
  }

  // NG+ cycles: scale enemy composition and boss stats
  const cycleMult = 1 + cycle * 0.35;
  const enemies = template.enemies.map((kind) => {
    // Progressively upgrade some basic tanks to armor/power in higher cycles
    if (kind === 'basic' && cycle >= 2) return 'armor' as EnemyKind;
    if (kind === 'fast' && cycle >= 3) return 'power' as EnemyKind;
    return kind;
  });

  const boss: BossSpec | undefined = template.boss
    ? {
        ...template.boss,
        maxHp: Math.round(template.boss.maxHp * cycleMult),
        speed: Number((template.boss.speed + cycle * 0.15).toFixed(2)),
        contactDamage: Math.round(template.boss.contactDamage * cycleMult),
        rewardCoins: Math.round(template.boss.rewardCoins * (1 + cycle * 0.2)),
        points: Math.round(template.boss.points * (1 + cycle * 0.5))
      }
    : undefined;

  return {
    id: clampedNum,
    name: `${template.name} +${cycle}`,
    biome: template.biome,
    layout: [...template.layout],
    enemies,
    boss
  };
}

const HORDE_BIOMES: BiomeId[] = ['industrial', 'desert', 'arctic', 'volcanic'];

const BOSS_ROTATION: BossSpec[] = [
  { id: 'mammoth', name: 'Ординський «Мамонт»', maxHp: 1000, speed: 3.2, contactDamage: 38, rewardCoins: 250, points: 3000 },
  { id: 'artillery', name: 'Ординський «Мортирник»', maxHp: 1500, speed: 3.5, contactDamage: 44, rewardCoins: 360, points: 4500 },
  { id: 'cryo', name: 'Ординський «Левіафан»', maxHp: 2100, speed: 3.9, contactDamage: 50, rewardCoins: 500, points: 6500 },
  { id: 'inferno', name: 'Ординський «Імператор»', maxHp: 2800, speed: 4.2, contactDamage: 60, rewardCoins: 750, points: 11000 }
];

export function getHordeStageDefinition(waveNum: number): StageDefinition {
  const wave = Math.max(1, waveNum);
  const biomeIndex = (wave - 1) % HORDE_BIOMES.length;
  const biome = HORDE_BIOMES[biomeIndex];

  // Pick an arena layout from campaign matching or cycling
  const layoutTemplate = CAMPAIGN_STAGES[(wave - 1) % CAMPAIGN_STAGES.length];

  const isBossWave = wave % 5 === 0;
  const tier = Math.floor(wave / 5);

  let boss: BossSpec | undefined;
  let enemies: EnemyKind[];

  if (isBossWave) {
    const bossIndex = (Math.floor(wave / 5) - 1) % BOSS_ROTATION.length;
    const baseBoss = BOSS_ROTATION[bossIndex];
    const bossScale = 1 + tier * 0.25;

    boss = {
      id: baseBoss.id,
      name: `${baseBoss.name} (Хвиля ${wave})`,
      maxHp: Math.round(baseBoss.maxHp * bossScale),
      speed: Number(Math.min(4.8, baseBoss.speed + tier * 0.1).toFixed(2)),
      contactDamage: Math.round(baseBoss.contactDamage * (1 + tier * 0.15)),
      rewardCoins: Math.round(baseBoss.rewardCoins * (1 + tier * 0.2)),
      points: Math.round(baseBoss.points * bossScale)
    };

    // Boss waves have intense support minions
    const minionCount = Math.min(22, 10 + tier * 2);
    const armorCount = Math.min(8, 2 + Math.floor(tier * 1.5));
    const powerCount = Math.min(8, 2 + tier);
    const fastCount = Math.min(6, 3 + Math.floor(tier * 0.5));
    const basicCount = Math.max(2, minionCount - armorCount - powerCount - fastCount);

    enemies = buildWave({
      basic: basicCount,
      fast: fastCount,
      power: powerCount,
      armor: armorCount
    });
  } else {
    // Normal horde wave scaling
    const count = Math.min(32, 14 + Math.floor(wave * 1.4));
    const armor = Math.min(10, Math.floor(wave * 0.45));
    const power = Math.min(10, Math.floor(wave * 0.4));
    const fast = Math.min(8, 3 + Math.floor(wave * 0.3));
    const basic = Math.max(2, count - armor - power - fast);

    enemies = buildWave({
      basic,
      fast,
      power,
      armor
    });
  }

  return {
    id: wave,
    name: isBossWave ? `Хвиля ${wave} [БОС]` : `Хвиля ${wave}`,
    biome,
    layout: [...layoutTemplate.layout],
    enemies,
    boss
  };
}

export function buildSubGrid(stage: StageDefinition): { grid: SubTile[][]; barrels: BarrelSpawn[] } {
  const grid: SubTile[][] = Array.from({ length: 36 }, () =>
    Array.from({ length: 36 }, () => SubTile.Empty)
  );
  const barrels: BarrelSpawn[] = [];

  const fillMacro = (col: number, row: number, tile: SubTile) => {
    const sx = col * 2;
    const sz = row * 2;
    grid[sz][sx] = tile;
    grid[sz][sx + 1] = tile;
    grid[sz + 1][sx] = tile;
    grid[sz + 1][sx + 1] = tile;
  };

  for (let row = 0; row < 18; row++) {
    const line = stage.layout[row] || '..................';
    for (let col = 0; col < 18; col++) {
      const ch = line[col] || '.';
      switch (ch) {
        case '#':
          fillMacro(col, row, SubTile.Brick);
          break;
        case '@':
          fillMacro(col, row, SubTile.Steel);
          break;
        case '~':
          fillMacro(col, row, SubTile.Water);
          break;
        case '%':
          fillMacro(col, row, SubTile.Forest);
          break;
        case '=':
          fillMacro(col, row, SubTile.Ice);
          break;
        case 'B':
          fillMacro(col, row, SubTile.Empty);
          barrels.push({ x: -17 + col * 2, z: -17 + row * 2 });
          break;
        default:
          fillMacro(col, row, SubTile.Empty);
          break;
      }
    }
  }

  // Clear enemy spawns:
  // col 1 row 0..1
  fillMacro(1, 0, SubTile.Empty);
  fillMacro(1, 1, SubTile.Empty);

  // col 8..9 row 0..2 (Boss & central enemy spawn)
  for (let r = 0; r <= 2; r++) {
    fillMacro(8, r, SubTile.Empty);
    fillMacro(9, r, SubTile.Empty);
  }

  // col 16 row 0..1
  fillMacro(16, 0, SubTile.Empty);
  fillMacro(16, 1, SubTile.Empty);

  // Clear player spawn:
  // col 6..7 row 16..17 (around world coordinates -4, 16.5)
  for (let r = 16; r <= 17; r++) {
    fillMacro(6, r, SubTile.Empty);
    fillMacro(7, r, SubTile.Empty);
  }

  // Clear macro tiles containing the base
  fillMacro(8, 17, SubTile.Empty);
  fillMacro(9, 17, SubTile.Empty);

  // Filter barrels out of enemy spawns, player spawn, and around Headquarters
  const filteredBarrels = barrels.filter((b) => {
    // Top enemy spawns: z <= -13
    if (b.z <= -13 && ((b.x >= -17 && b.x <= -13) || (b.x >= -3 && b.x <= 3) || (b.x >= 13 && b.x <= 17))) {
      return false;
    }
    // Player spawn: col 6..7 -> x around -5..-3, z >= 13
    if (b.x >= -7 && b.x <= -1 && b.z >= 13) {
      return false;
    }
    // Headquarters area: x around -3..3, z >= 13
    if (b.x >= -3 && b.x <= 3 && b.z >= 13) {
      return false;
    }
    return true;
  });

  // Headquarters Base tiles
  for (const [sx, sz] of BASE_SUB_COORDS) {
    grid[sz][sx] = SubTile.Base;
  }

  // Protective Brick ring around Headquarters Base
  for (const [sx, sz] of BASE_WALL_COORDS) {
    grid[sz][sx] = SubTile.Brick;
  }

  return { grid, barrels: filteredBarrels };
}
