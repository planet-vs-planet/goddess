// 人口: 都市の人口の増減・都市の成長・種族のまざり
(function (G) {
  const W = G.World;

  const Pop = {
    // 都市が養える人数
    capacity(c) {
      const info = G.Map.W.cityInfo[c.id];
      const n = W.nation(c.owner);
      const race = Pop.mainRace(c);
      const R = G.RACES[race];
      let like = 0, tot = 0;
      for (const k in info.counts) { like += info.counts[k] * (R.like[k] || 0.75); tot += info.counts[k]; }
      like = tot ? like / tot : 1;
      const b = c.buildings;
      let K = (info.food * 34 + info.tiles * 4) * like * (1 + 0.14 * (b.farm || 0) + 0.07 * (b.house || 0)) * (1 + (n ? n.tech : 1) * 0.035);
      if (info.coastal) K += 800 + (b.port ? 900 : 0);
      if (info.river) K += 700;
      K *= R.pop;
      const mods = c.mods || {};
      if (mods.drought > W.S.day) K *= 0.6;
      if (mods.harvest > W.S.day) K *= 1.35;
      if (mods.blight > W.S.day) K *= 0.7;
      return Math.max(120, K);
    },
    mainRace(c) {
      let best = null, bv = -1;
      for (const r in c.races) if (c.races[r] > bv) { bv = c.races[r]; best = r; }
      return best || 'human';
    },
    monthly() {
      const S = W.S;
      for (const c of S.cities) {
        const n = W.nation(c.owner);
        const K = Pop.capacity(c);
        c.cap = K;
        let g = 0;
        for (const r in c.races) g += c.races[r] * G.RACES[r].growth;
        let rate = 0.0032 * g * (n ? 0.65 + n.stability / 250 : 0.7);
        if (c.famine) rate = -0.012;
        let d = rate * c.pop * (1 - c.pop / K);
        if (c.famine) d = rate * c.pop;
        if (c.mods.plague > S.day) d -= c.pop * 0.006;
        if (c.pop > K * 1.05) d -= (c.pop - K) * 0.03;
        c.pop = Math.max(30, c.pop + d);
        // 都市の格が上がる
        const lv = G.cityLevelOf(c.pop);
        if (lv > c.level) {
          c.level = lv;
          if (lv >= 3) W.log('nation', `${c.name}が${G.CITY_LEVELS[lv].name}に成長`, `${n ? n.name + 'の' : ''}${c.name}の人口が${G.fmt(c.pop)}人をこえ、${G.CITY_LEVELS[lv].name}になった。`, { n: n ? [n.id] : [], x: c.x, y: c.y, imp: lv >= 4 ? 2 : 1 });
        } else if (lv < c.level) c.level = lv;
        // 支配している国の種族が少しずつ増える
        if (n && W.rng.chance(0.3)) {
          const r = n.race;
          if (!c.races[r]) c.races[r] = 0;
          const k = 0.004 * (r === 'dragon' ? 0.2 : 1);
          for (const x in c.races) c.races[x] *= (1 - k);
          c.races[r] += k;
          for (const x in c.races) if (c.races[x] < 0.01 && x !== r) delete c.races[x];
        }
      }
    }
  };
  G.Population = Pop;
})(globalThis.GD = globalThis.GD || {});
