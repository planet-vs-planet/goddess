// ゲームの基本データ(地形・種族・性格・兵種・宗教・建物)
(function (G) {
  // ---- 地形 ----
  // move: 移動の重さ(大きいほど遅い。Infinity=通れない) / food,wood,ore: 資源 / def: 守る側の有利
  G.T = { DEEP: 0, SEA: 1, SHALLOW: 2, LAKE: 3, RIVER: 4, GRASS: 5, FOREST: 6, DEEPFOREST: 7, MOUNTAIN: 8, SNOW: 9, DESERT: 10, SWAMP: 11, COAST: 12 };
  G.TERRAIN = [
    { key: 'deep', name: '深い海', water: true, move: Infinity, food: 0, wood: 0, ore: 0, def: 0 },
    { key: 'sea', name: '海', water: true, move: Infinity, food: 0, wood: 0, ore: 0, def: 0 },
    { key: 'shallow', name: '浅瀬', water: true, move: Infinity, food: 0, wood: 0, ore: 0, def: 0 },
    { key: 'lake', name: '湖', water: true, move: Infinity, food: 0, wood: 0, ore: 0, def: 0 },
    { key: 'river', name: '川', water: false, move: 2.2, food: 1.6, wood: 0.1, ore: 0, def: 0.15 },
    { key: 'grass', name: '草原', water: false, move: 1.0, food: 1.0, wood: 0.1, ore: 0.05, def: 0 },
    { key: 'forest', name: '森林', water: false, move: 1.6, food: 0.45, wood: 1.0, ore: 0.05, def: 0.15 },
    { key: 'deepforest', name: '深い森林', water: false, move: 2.3, food: 0.3, wood: 1.4, ore: 0.05, def: 0.3 },
    { key: 'mountain', name: '山岳', water: false, move: 3.2, food: 0.1, wood: 0.2, ore: 1.4, def: 0.5 },
    { key: 'snow', name: '雪原', water: false, move: 2.6, food: 0.08, wood: 0.05, ore: 0.4, def: 0.2 },
    { key: 'desert', name: '砂漠', water: false, move: 1.8, food: 0.08, wood: 0, ore: 0.35, def: 0 },
    { key: 'swamp', name: '沼地', water: false, move: 2.6, food: 0.35, wood: 0.4, ore: 0, def: 0.25 },
    { key: 'coast', name: '海岸', water: false, move: 1.1, food: 0.8, wood: 0.05, ore: 0, def: 0 }
  ];

  // ---- 種族 ----
  G.RACES = {
    human: {
      name: '人間', growth: 1.0, life: [50, 82], adult: 16, fertile: [17, 42],
      tech: 1.25, magic: 0.8, power: 1.0, speed: 1.0, pop: 1.0,
      like: { grass: 1.3, river: 1.4, coast: 1.2, forest: 0.8 }, religion: 'goddess',
      desc: '人口が増えやすく、技術と文化の発展が得意。寿命は短い。'
    },
    demon: {
      name: '魔族', growth: 0.75, life: [90, 170], adult: 20, fertile: [22, 90],
      tech: 0.95, magic: 1.5, power: 1.35, speed: 1.0, pop: 0.8,
      like: { swamp: 1.5, deepforest: 1.2, mountain: 1.0, desert: 1.0, grass: 0.9 }, religion: 'demonlord',
      desc: '魔法と戦闘に優れ、魔獣を使役する。独自の社会制度を持つ。'
    },
    elf: {
      name: 'エルフ', growth: 0.45, life: [260, 520], adult: 30, fertile: [40, 220],
      tech: 1.0, magic: 1.35, power: 0.95, speed: 1.1, pop: 0.6,
      like: { forest: 1.7, deepforest: 1.8, river: 1.1 }, religion: 'spirit',
      desc: '長寿で森と共に生きる。弓と魔法が得意だが人口は増えにくい。'
    },
    dwarf: {
      name: 'ドワーフ', growth: 0.7, life: [140, 250], adult: 25, fertile: [30, 120],
      tech: 1.2, magic: 0.7, power: 1.15, speed: 0.85, pop: 0.75, def: 1.4,
      like: { mountain: 2.0, snow: 1.2, grass: 0.7 }, religion: 'forge',
      desc: '鉱業と鍛冶の達人。守りが固く、山岳で栄える。'
    },
    beast: {
      name: '獣人', growth: 1.1, life: [45, 75], adult: 14, fertile: [15, 38],
      tech: 0.85, magic: 0.7, power: 1.25, speed: 1.35, pop: 0.95,
      like: { grass: 1.2, forest: 1.3, desert: 1.0, swamp: 0.8 }, religion: 'ancestor',
      desc: '身体能力が高く、狩りと素早い移動が得意。部族社会を作る。'
    },
    dragon: {
      name: '竜族', growth: 0.18, life: [600, 1200], adult: 80, fertile: [100, 800],
      tech: 0.8, magic: 1.6, power: 4.0, speed: 1.3, pop: 0.12,
      like: { mountain: 1.6, snow: 1.5, desert: 1.0 }, religion: 'dragongod',
      desc: '人口はごく少ないが、一体一体が圧倒的に強い。'
    }
  };
  G.RACE_KEYS = Object.keys(G.RACES);

  // 種族どうしの基本の仲(-50〜+50)
  G.RACE_AFFINITY = {
    human: { human: 10, demon: -35, elf: 10, dwarf: 15, beast: -5, dragon: -15 },
    demon: { human: -35, demon: 15, elf: -25, dwarf: -10, beast: 5, dragon: 5 },
    elf: { human: 10, demon: -25, elf: 20, dwarf: -10, beast: 10, dragon: 0 },
    dwarf: { human: 15, demon: -10, elf: -10, dwarf: 20, beast: 0, dragon: -20 },
    beast: { human: -5, demon: 5, elf: 10, dwarf: 0, beast: 15, dragon: 0 },
    dragon: { human: -15, demon: 5, elf: 0, dwarf: -20, beast: 0, dragon: 25 }
  };

  // ---- 性格 ----
  G.TRAITS = {
    brave: { name: '勇敢', opp: 'coward' },
    coward: { name: '臆病', opp: 'brave' },
    ambitious: { name: '野心家' },
    gentle: { name: '温厚', opp: 'cruel' },
    cruel: { name: '残虐', opp: 'gentle' },
    just: { name: '正義感が強い', opp: 'cunning' },
    cunning: { name: '狡猾', opp: 'just' },
    greedy: { name: '強欲' },
    wise: { name: '賢明' },
    curious: { name: '好奇心旺盛' }
  };
  G.TRAIT_KEYS = Object.keys(G.TRAITS);

  // ---- 国家の方針 ----
  G.GOALS = {
    expansion: { name: '領土拡大', war: 0.35, build: 0.8 },
    economy: { name: '経済発展', war: -0.15, build: 1.3 },
    military: { name: '軍事強化', war: 0.25, build: 0.9 },
    religion: { name: '布教', war: 0.05, build: 1.0 },
    peace: { name: '平和外交', war: -0.4, build: 1.1 },
    domination: { name: '他種族支配', war: 0.3, build: 0.8 }
  };

  // ---- 宗教 ----
  G.BASE_RELIGIONS = {
    goddess: { name: '女神教', goddess: true, color: '#e8d48b' },
    demonlord: { name: '魔王信仰', goddess: false, color: '#9a5bd1' },
    ancient: { name: '古き神々', goddess: false, color: '#9fa3a8' },
    spirit: { name: '精霊信仰', goddess: false, color: '#7ccf8a' },
    forge: { name: '鉄と炎の神', goddess: false, color: '#d98a4e' },
    ancestor: { name: '大地の祖霊', goddess: false, color: '#c9a86a' },
    dragongod: { name: '竜神信仰', goddess: false, color: '#d65a5a' }
  };

  // ---- 兵種 ----
  // cls: inf=歩兵 cav=騎兵 rng=弓 mag=魔法 mon=魔獣 sie=攻城 / atk,def: 1人あたりの強さ / tech: 必要な技術Lv
  G.UNITS = {
    human: [
      { key: 'h_inf', name: '歩兵', cls: 'inf', atk: 1.0, def: 1.1, tech: 0 },
      { key: 'h_arc', name: '弓兵', cls: 'rng', atk: 1.1, def: 0.7, tech: 0 },
      { key: 'h_kni', name: '騎士', cls: 'cav', atk: 1.6, def: 1.4, tech: 2 },
      { key: 'h_mag', name: '魔法使い', cls: 'mag', atk: 2.0, def: 0.6, tech: 3 },
      { key: 'h_pal', name: '聖騎士', cls: 'cav', atk: 2.2, def: 2.0, tech: 5 }
    ],
    demon: [
      { key: 'd_sol', name: '魔族兵', cls: 'inf', atk: 1.3, def: 1.1, tech: 0 },
      { key: 'd_hvy', name: '重装魔族', cls: 'inf', atk: 1.5, def: 1.9, tech: 2 },
      { key: 'd_mag', name: '魔術師', cls: 'mag', atk: 2.3, def: 0.7, tech: 1 },
      { key: 'd_bst', name: '魔獣', cls: 'mon', atk: 2.6, def: 1.8, tech: 2 },
      { key: 'd_eli', name: '魔王直属兵', cls: 'inf', atk: 2.6, def: 2.2, tech: 5 }
    ],
    elf: [
      { key: 'e_arc', name: '森林弓兵', cls: 'rng', atk: 1.6, def: 0.8, tech: 0 },
      { key: 'e_spi', name: '精霊使い', cls: 'mag', atk: 2.1, def: 0.9, tech: 2 },
      { key: 'e_cav', name: '森林騎兵', cls: 'cav', atk: 1.6, def: 1.2, tech: 1 }
    ],
    dwarf: [
      { key: 'w_hvy', name: '重装兵', cls: 'inf', atk: 1.2, def: 2.1, tech: 0 },
      { key: 'w_war', name: '鉱山戦士', cls: 'inf', atk: 1.7, def: 1.5, tech: 1 },
      { key: 'w_sie', name: '攻城兵器', cls: 'sie', atk: 2.8, def: 0.8, tech: 3 }
    ],
    beast: [
      { key: 'b_war', name: '獣人戦士', cls: 'inf', atk: 1.5, def: 1.1, tech: 0 },
      { key: 'b_hun', name: '狩人', cls: 'rng', atk: 1.3, def: 0.9, tech: 0 },
      { key: 'b_cav', name: '高速騎兵', cls: 'cav', atk: 1.7, def: 1.1, tech: 1 }
    ],
    dragon: [
      { key: 'r_rid', name: '竜騎兵', cls: 'cav', atk: 3.5, def: 3.0, tech: 0 },
      { key: 'r_mag', name: '竜族魔法使い', cls: 'mag', atk: 4.0, def: 2.0, tech: 1 },
      { key: 'r_eld', name: '古竜', cls: 'mon', atk: 9.0, def: 8.0, tech: 3 }
    ],
    monster: [
      { key: 'm_hrd', name: '魔物の群れ', cls: 'mon', atk: 1.3, def: 1.0, tech: 0 }
    ]
  };
  G.UNIT_BY_KEY = {};
  for (const r in G.UNITS) for (const u of G.UNITS[r]) G.UNIT_BY_KEY[u.key] = u;
  // 相性: 攻める側のcls → 守る側のcls への倍率
  G.CLASS_ADV = {
    inf: { cav: 1.2 }, cav: { rng: 1.35, mag: 1.3 }, rng: { inf: 1.2, mon: 1.1 },
    mag: { inf: 1.25, mon: 1.2, sie: 1.2 }, mon: { inf: 1.15, rng: 1.1 }, sie: {}
  };

  // ---- 建物 ----
  G.BUILDINGS = {
    house: { name: '住宅', cost: { gold: 40, wood: 30, ore: 0 }, minLv: 0, max: 8 },
    farm: { name: '農場', cost: { gold: 50, wood: 25, ore: 0 }, minLv: 0, max: 6 },
    market: { name: '商店', cost: { gold: 80, wood: 30, ore: 5 }, minLv: 1, max: 5 },
    smithy: { name: '鍛冶場', cost: { gold: 90, wood: 20, ore: 40 }, minLv: 1, max: 3 },
    school: { name: '学校', cost: { gold: 120, wood: 40, ore: 10 }, minLv: 2, max: 3 },
    wall: { name: '城壁', cost: { gold: 140, wood: 20, ore: 80 }, minLv: 2, max: 3 },
    barracks: { name: '兵舎', cost: { gold: 100, wood: 50, ore: 30 }, minLv: 1, max: 3 },
    temple: { name: '神殿', cost: { gold: 110, wood: 30, ore: 30 }, minLv: 1, max: 2 },
    port: { name: '港', cost: { gold: 120, wood: 80, ore: 10 }, minLv: 2, max: 1 }
  };

  G.CITY_LEVELS = [
    { name: '村', min: 0 }, { name: '集落', min: 600 }, { name: '町', min: 1800 },
    { name: '都市', min: 5000 }, { name: '大都市', min: 12000 }
  ];
  G.cityLevelOf = function (pop) {
    let lv = 0;
    for (let i = 0; i < G.CITY_LEVELS.length; i++) if (pop >= G.CITY_LEVELS[i].min) lv = i;
    return lv;
  };

  G.ROLES = {
    ruler: '国王', heir: '王族', general: '将軍', hero: '英雄', mage: '魔法使い', merchant: '商人',
    priest: '宗教指導者', noble: '貴族', exile: '亡命者', wanderer: '放浪者', commoner: '平民', rebel: '反逆者'
  };

  // 国の色(重ならないように)
  G.NATION_COLORS = [
    0xc0392b, 0x2e6fd8, 0x27a35a, 0xd4a017, 0x8e44ad, 0x16a3a3, 0xd35400, 0xc2185b,
    0x5d7d2b, 0x6d4c9f, 0xb08d57, 0x1f5f8b, 0xa63d40, 0x3a8f7c, 0xc06c84, 0x7f8c8d,
    0x9c6b2f, 0x4e6e9e, 0xb5651d, 0x58508d
  ];
})(globalThis.GD = globalThis.GD || {});
