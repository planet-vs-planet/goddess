// 国家AI: 建物を建てる・人材を集める・新しい村を作る・反乱への対応
(function (G) {
  const W = G.World, C = G.Chars;

  const PRIORITY = {
    expansion: { farm: 3, house: 3, barracks: 3, wall: 1, market: 1, smithy: 2, school: 1, temple: 1, port: 1 },
    economy: { market: 4, house: 3, farm: 3, school: 3, port: 3, smithy: 1, temple: 1, wall: 1, barracks: 1 },
    military: { barracks: 4, smithy: 4, wall: 3, farm: 2, house: 2, market: 1, school: 1, temple: 1, port: 1 },
    religion: { temple: 5, school: 2, farm: 2, house: 2, market: 2, wall: 1, barracks: 1, smithy: 1, port: 1 },
    peace: { farm: 3, market: 3, house: 3, school: 3, temple: 2, port: 2, wall: 1, smithy: 1, barracks: 1 },
    domination: { barracks: 4, wall: 3, smithy: 3, farm: 2, house: 2, temple: 1, market: 1, school: 1, port: 1 }
  };

  const AI = {
    yearly(n) {
      if (!n.alive) return;
      const rng = W.rng;
      const cities = W.citiesOf(n.id);
      // 建物
      let builds = 0;
      const pri = PRIORITY[n.goal];
      for (let k = 0; k < 4 && builds < 3; k++) {
        const opts = [];
        for (const c of cities) for (const key in G.BUILDINGS) {
          const b = G.BUILDINGS[key];
          if ((c.buildings[key] || 0) >= b.max || c.level < b.minLv) continue;
          if (key === 'port' && !G.Map.W.cityInfo[c.id].coastal) continue;
          if (n.res.gold < b.cost.gold || n.res.wood < b.cost.wood || n.res.ore < b.cost.ore) continue;
          let w = pri[key] * (1 + c.pop / 8000) / (1 + (c.buildings[key] || 0));
          if (key === 'farm' && c.famine) w *= 4;
          if (key === 'wall' && W.warsOf(n.id).length) w *= 2.5;
          if (key === 'temple' && c.unrest > 50) w *= 2;
          opts.push({ w, v: { c, key } });
        }
        const pick = rng.weighted(opts);
        if (!pick) break;
        const b = G.BUILDINGS[pick.key];
        n.res.gold -= b.cost.gold; n.res.wood -= b.cost.wood; n.res.ore -= b.cost.ore;
        pick.c.buildings[pick.key] = (pick.c.buildings[pick.key] || 0) + 1;
        builds++;
      }
      // 人材
      const people = W.charsOf(n.id);
      if (people.length < 6 || (people.length < 10 && rng.chance(0.25))) {
        const have = r => people.some(c => c.role === r);
        const role = !have('general') ? 'general' : !have('priest') ? 'priest' : !have('mage') ? 'mage' : rng.pick(['general', 'merchant', 'mage', 'noble', 'general']);
        if (Object.keys(W.S.chars).length < G.CFG.MAX_ALIVE_CHARS) {
          const c = C.spawnNotable(n.id, role);
          if (role === 'general' || role === 'mage') W.log('person', `新たな${G.ROLES[role]}`, `${n.name}で${c.name}が${G.ROLES[role]}として頭角を現した。`, { n: [n.id], c: [c.id], imp: 0 });
        }
      }
      // 新しい村をつくる
      if (W.S.cities.length < 30 && rng.chance(n.goal === 'expansion' || n.goal === 'economy' ? 0.07 : 0.035)) AI.foundVillage(n, cities);
      // 方針が変わることもある
      const ruler = W.liveChar(n.ruler);
      if (ruler && rng.chance(0.04)) {
        const P = G.Personality;
        let g = n.goal;
        if (P.has(ruler, 'ambitious') || P.has(ruler, 'cruel')) g = rng.pick(['expansion', 'military', 'domination']);
        else if (P.has(ruler, 'gentle') || P.has(ruler, 'wise')) g = rng.pick(['peace', 'economy']);
        else if (ruler.st.fai > 70) g = 'religion';
        if (g !== n.goal) { n.goal = g; W.log('politics', '国の方針転換', `${n.name}は${ruler.name}のもとで「${G.GOALS[g].name}」を目指すようになった。`, { n: [n.id], c: [ruler.id], imp: 1 }); }
      }
    },

    foundVillage(n, cities) {
      const MW = G.Map.W, rng = W.rng;
      const big = cities.filter(c => c.pop > 3500 && MW.cityInfo[c.id].tiles > 380);
      if (!big.length) return;
      const src = rng.pick(big);
      let best = -1, bs = -Infinity;
      for (let t = 0; t < 300; t++) {
        const x = rng.int(src.x - 16, src.x + 16), y = rng.int(src.y - 16, src.y + 16);
        if (!G.Map.inside(x, y)) continue;
        const i = G.Map.idx(x, y);
        if (MW.region[i] !== src.id || !G.Map.isLand(i)) continue;
        let md = Infinity; for (const c of W.S.cities) md = Math.min(md, Math.hypot(c.x - x, c.y - y));
        if (md < 10) continue;
        const ter = G.TERRAIN[MW.t[i]];
        const s = ter.food * 3 + Math.min(md, 18) * 0.4 + (MW.river[i] ? 2 : 0) + rng.next();
        if (s > bs) { bs = s; best = i; }
      }
      if (best < 0) return;
      const x = best % MW.w, y = (best / MW.w) | 0;
      const pop = Math.min(src.pop * 0.12, 600);
      src.pop -= pop;
      const c = G.Sim.makeCity(x, y, n.id, n.race, pop, G.Names.place(rng, n.race));
      c.religion = n.religion;
      G.Map.computeRegions(W.S.cities);
      W.dirtyTerritory = true;
      W.log('nation', `${c.name}の建設`, `${n.name}の人々が${src.name}から移り住み、新しい村「${c.name}」を作った。`, { n: [n.id], x, y, imp: 1 });
    },

    // 反乱(1か月ごと)
    monthlyRevolts() {
      const rng = W.rng;
      for (const c of W.S.cities) {
        if (c.owner == null || c.unrest < 85) continue;
        if (!rng.chance(0.02)) continue;
        const n = W.nation(c.owner);
        if (!n || !n.alive) continue;
        if (W.citiesOf(n.id).length <= 1 || c.id === n.capital) {
          // 国の中心での反乱 → 革命(王の交代)
          const cands = W.charsOf(n.id).filter(x => C.isAdult(x) && x.id !== n.ruler);
          const leader = cands.sort((a, b) => (b.st.amb + b.st.cha) - (a.st.amb + a.st.cha))[0] || C.spawnNotable(n.id, 'rebel');
          const old = W.liveChar(n.ruler);
          W.log('politics', `${n.name}の革命`, `不満が爆発し、${c.name}で革命が起きた。${old ? old.name + 'は王座を追われ、' : ''}${leader.name}が新しい指導者になった。`, { n: [n.id], c: [leader.id], x: c.x, y: c.y, imp: 3 });
          if (old) { old.role = 'exile'; old.exileOf = n.id; old.nation = null; C.relAdd(old, leader, 'h', 70, '仇敵'); }
          G.Family.crown(n, leader, '革命');
          n.stability = 45; c.unrest = 35;
          W.effect('revolt', c.x, c.y);
          continue;
        }
        G.Nations.independence(c, '反乱');
      }
    }
  };
  G.NationAI = AI;
})(globalThis.GD = globalThis.GD || {});
