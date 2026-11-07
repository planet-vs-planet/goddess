// ChatGPTの絵を画面のどこに使うかを決める
(function (G) {
  const W = G.World;
  const ART = () => G.ART || null;
  const h = id => { let x = (id * 2654435761) >>> 0; x ^= x >>> 15; return x >>> 0; };

  // 種族・役職・性別ごとの顔の候補
  const POOL = {
    human: {
      ruler: { m: ['king', 'emperor', 'sage_king'], f: ['queen', 'queen_b'] },
      general: { m: ['general', 'soldier', 'assassin'], f: ['queen_b', 'merchant'] },
      hero: { m: ['hero', 'human_b'], f: ['queen_b', 'priest'] },
      mage: { m: ['mage', 'scholar'], f: ['priest', 'mage'] },
      priest: { m: ['pontiff', 'scholar'], f: ['priest'] },
      merchant: { m: ['bard', 'craftsman'], f: ['merchant'] },
      other: { m: ['human_a', 'human_b', 'bard', 'scholar', 'farmer', 'craftsman', 'soldier'], f: ['queen_b', 'priest', 'merchant'] }
    },
    elf: { all: ['elf_a', 'elf_b', 'elf_shrine'] },
    dwarf: { all: ['dwarf_a', 'dwarf_b'] },
    beast: { all: ['beast_a', 'beast_b'] },
    demon: { all: ['demon_a', 'demon_c', 'demon_d', 'demon_e', 'demon_f', 'demon_b'] },
    dragon: { all: ['dragon_a', 'dragon_c', 'dragon_d', 'dragon_e', 'dragon_f', 'dragon_g', 'dragon_h'] }
  };

  // 出来事の題名 → 絵
  const EVENT_RULES = [
    [/陥落|滅亡|壊滅|処刑/, 'fire_city'], [/人魔大戦|勃発|内乱|内戦/, 'burning_fortress'], [/戦い|終結|奇襲|援軍|戦死|寝返り|出陣|割譲/, 'cursed_castle'],
    [/ドラゴン|竜/, 'dragon'], [/魔物|封印/, 'dragon'], [/悪魔|魔力汚染/, 'vortex'],
    [/恋|結婚/, 'lovers'], [/遺跡|古代|禁断|石碑|王の墓|遺物|武器の発見|技術/, 'altar'],
    [/神への反逆|結社|神を否定/, 'cursed_castle'], [/宗教|改宗/, 'altar'],
    [/神託|天使|女神の目覚め|世界の創造/, 'pillar'], [/加護|英雄|世界樹|覚醒|帰還/, 'holy'], [/天災/, 'meteor'],
    [/地震|火山/, 'volcanic_sky_city'], [/洪水/, 'underwater_ruins'], [/寒波/, 'frozen_kingdom'], [/干ばつ/, 'desert_land'],
    [/疫病/, 'cursed_castle'], [/暗殺|クーデター|革命|簒奪|裏切り|失踪/, 'cursed_castle'],
    [/王位|即位|建国|大都市|都市に成長|遷都/, 'capital_city'], [/独立|再興|建設|反乱/, 'old_town'], [/豊作/, 'holy'], [/戦の奇跡/, 'holy']
  ];

  const Art = {
    has() { return !!ART(); },
    portraitKey(c) {
      const pool = POOL[c.race] || POOL.human;
      let list;
      if (pool.all) list = pool.all;
      else {
        const role = c.role === 'ruler' ? 'ruler' : c.role === 'general' ? 'general' : c.role === 'hero' ? 'hero' : c.role === 'mage' ? 'mage' : c.role === 'priest' ? 'priest' : c.role === 'merchant' ? 'merchant' : 'other';
        list = pool[role][c.sex] || pool.other[c.sex];
        if (G.Personality.has(c, 'cunning') && c.sex === 'm' && role === 'other') list = ['assassin'].concat(list);
      }
      return list[h(c.id) % list.length];
    },
    // 顔の<img>(なければドット絵)
    face(c, cls) {
      const a = ART();
      if (!a) return `<img class="${cls || 'face'}" src="${G.Sprites.portrait(c)}" alt="">`;
      const k = Art.portraitKey(c);
      const flip = (h(c.id) >> 3) & 1;
      return `<img class="${cls || 'face'} art${flip ? ' flip' : ''}${c.alive ? '' : ' dead'}" src="${a.portraits[k]}" alt="">`;
    },
    eventKey(e) {
      for (const [re, k] of EVENT_RULES) if (re.test(e.title)) return k;
      return { war: 'burning_fortress', politics: 'capital_city', nation: 'capital_city', person: 'old_town', disaster: 'tornado', goddess: 'pillar', miracle: 'holy', religion: 'altar', discovery: 'altar' }[e.type] || null;
    },
    eventImage(e) { const a = ART(); if (!a) return null; const k = Art.eventKey(e); return k ? a.events[k] : null; },
    unitImage(army) {
      const a = ART(); if (!a) return null;
      if (army.nation === -1) return a.events.dragon;
      const n = W.nation(army.nation);
      if (n && n.race === 'dragon') return a.units.dragon;
      let best = null, bv = -1;
      const cnt = {};
      for (const k in army.troops) { const cl = G.UNIT_BY_KEY[k].cls; cnt[cl] = (cnt[cl] || 0) + army.troops[k]; }
      for (const cl in cnt) if (cnt[cl] > bv) { bv = cnt[cl]; best = cl; }
      const map = { inf: 'inf', rng: 'rng', cav: 'cav', mag: 'mag', mon: 'mon', sie: 'inf' };
      return a.units[map[best] || 'inf'];
    },
    terrainImage(key) {
      const a = ART(); if (!a) return null;
      const map = { deep: 'sea', sea: 'sea', shallow: 'sea', coast: 'sea', lake: 'lake', river: 'lake', grass: 'grass', forest: 'forest', deepforest: 'forest', mountain: 'mountain', snow: 'snow', desert: 'desert', swamp: 'swamp' };
      return a.terrain[map[key]];
    },
    powerIcon(key) {
      const a = ART();
      if (!a || !a.powers[key]) return `<span class="pico pico-${key}"></span>`;
      return `<img class="pico art" src="${a.powers[key]}" alt="">`;
    }
  };
  G.Art = Art;
})(globalThis.GD = globalThis.GD || {});
