// 時間の流れ: 世界の誕生と、1日・1か月・1年ごとの処理
(function (G) {
  const W = G.World;
  const DPM = () => G.CFG.DAYS_PER_MONTH;

  const Sim = {
    makeCity(x, y, owner, race, pop, name) {
      const S = W.S;
      const c = {
        id: S.cities.length, name, x, y, owner, pop, races: {}, religion: G.RACES[race].religion,
        level: 0, buildings: {}, unrest: 20, sat: 80, faith: 0.1, mods: {}, founded: W.year(), cap: pop, famine: false, conquered: 0
      };
      c.races[race] = 1;
      c.level = G.cityLevelOf(pop);
      S.cities.push(c);
      return c;
    },

    newWorld(seed) {
      seed = String(seed);
      const rng = new G.RNG(seed + '/sim');
      W.rng = rng;
      const S = W.S = {
        version: G.CFG.VERSION, seed, rng: null, day: 0, startYear: rng.int(380, 820), nextId: 1,
        nations: {}, cities: [], chars: {}, dead: {}, relations: {}, wars: {}, armies: {}, battles: {},
        religions: JSON.parse(JSON.stringify(G.BASE_RELIGIONS)), ruins: [], log: [], history: [], stats: [],
        goddess: { power: 40, max: 100, awareness: 0, used: 0, rebels: [], faithPop: 0, total: 0, level: 1, income: 0 },
        flags: {}, warCount: {}
      };
      W.fx = [];
      G.Map.build(seed);
      // 8か国の種族
      // 人族陣営5か国・魔族陣営3か国。魔族は大陸の片側に集める
      const caps = G.Map.placeSites(rng, G.CFG.NATIONS, null);
      const ang = rng.range(0, Math.PI * 2), ax = Math.cos(ang), ay = Math.sin(ang);
      const order = caps.map((p, i) => ({ i, v: p.x * ax + p.y * ay })).sort((a, b) => a.v - b.v);
      const races = new Array(caps.length);
      const dSide = rng.shuffle(['demon', 'demon', 'dragon']), hSide = rng.shuffle(['human', 'human', 'elf', 'dwarf', 'beast']);
      order.forEach((o, k) => { races[o.i] = k < 3 ? dSide[k] : hSide[k - 3]; });
      const others = G.Map.placeSites(rng, G.CFG.CITIES - G.CFG.NATIONS, null, caps);
      const usedNames = new Set();
      const uniqName = race => { for (let i = 0; i < 30; i++) { const n = G.Names.place(rng, race); if (!usedNames.has(n)) { usedNames.add(n); return n; } } return G.Names.place(rng, race) + '2'; };
      caps.forEach((p, i) => Sim.makeCity(p.x, p.y, null, races[i], 100, uniqName(races[i])));
      // ほかの都市は、いちばん近い首都の国のものにする
      const capCities = S.cities.slice();
      for (const p of others) {
        let best = 0, bd = Infinity;
        capCities.forEach((c, i) => { const d = Math.hypot(c.x - p.x, c.y - p.y) * (races[i] === 'dragon' ? 1.6 : 1); if (d < bd) { bd = d; best = i; } });
        const c = Sim.makeCity(p.x, p.y, null, races[best], 100, uniqName(races[best]));
        c._n = best;
        if (rng.chance(0.3)) { const same = G.SIDES[G.Factions.sideOfRace(races[best])].races.filter(r => r !== 'dragon' && r !== races[best]); if (same.length) { const r2 = rng.pick(same); c.races[r2] = (c.races[r2] || 0) + 0.2; c.races[races[best]] -= 0.2; } }
      }
      G.Map.computeRegions(S.cities);
      // 国を作る
      const nations = races.map((race, i) => {
        const mine = S.cities.filter((c, j) => j === i || c._n === i);
        return G.Nations.create({ race, cities: mine, founded: S.startYear - rng.int(30, 290) });
      });
      nations.forEach((n, i) => { n.capital = i; });
      for (const c of S.cities) {
        delete c._n;
        c.founded = W.nation(c.owner).founded - rng.int(0, 60);
        const K = G.Population.capacity(c);
        c.pop = Math.round(K * rng.range(0.4, 0.68) * (W.nation(c.owner).capital === c.id ? 1.25 : 1));
        c.cap = K;
        c.level = G.cityLevelOf(c.pop);
        c.religion = W.nation(c.owner).religion;
        c.faith = W.S.religions[c.religion].goddess ? 0.6 : 0.12;
        // 最初からある建物
        c.buildings = { house: rng.int(0, c.level + 1), farm: rng.int(0, 2), market: c.level >= 1 ? rng.int(0, 1) : 0, wall: c.level >= 2 ? rng.int(0, 1) : 0, temple: c.level >= 1 ? rng.int(0, 1) : 0 };
      }
      // 人物
      for (const n of nations) Sim.makeCourt(n);
      // 遺跡
      const MW = G.Map.W;
      const types = rng.shuffle(Object.keys(G.RUINS).concat(rng.pick(Object.keys(G.RUINS))));
      for (const type of types) {
        for (let t = 0; t < 300; t++) {
          const x = rng.int(4, MW.w - 5), y = rng.int(4, MW.h - 5), i = G.Map.idx(x, y);
          if (MW.comp[i] !== MW.mainComp) continue;
          if (S.cities.some(c => Math.hypot(c.x - x, c.y - y) < 5) || S.ruins.some(r => Math.hypot(r.x - x, r.y - y) < 10)) continue;
          S.ruins.push({ x, y, type, found: 0 });
          break;
        }
      }
      // 国どうしの最初の関係
      for (const n of nations) for (const m of nations) if (n.id < m.id) { const r = W.rel(n.id, m.id); r.v = G.Diplomacy.relationBase(n, m) + rng.gauss(0, 10); }
      G.History.prehistory();
      for (const n of nations) for (const m of nations) if (n.id < m.id) { const r = W.rel(n.id, m.id); r.v -= (r.grudge || 0) * 0.6; }
      for (const n of nations) { n.manpower = W.nationPop(n.id) * 0.05; n.res.food = W.nationPop(n.id) * 0.2; }
      G.Factions.setup();
      if (G.Story) G.Story.setup();
      W.dirtyTerritory = true;
      W.log('goddess', '女神の目覚め', `${S.startYear}年。人族は${G.Factions.nationsOf('h').length}つの国、魔族は${G.Factions.nationsOf('d').length}つの国。女神は今日も、愛しい世界の争いを見下ろしている。`, { imp: 1 });
      Sim.sample();
      return S;
    },

    // 王家と家臣を作る
    makeCourt(n) {
      const rng = W.rng, C = G.Chars, R = G.RACES[n.race];
      const fam = G.Names.family(rng, n.race);
      const span = R.life[0] - R.adult;
      const ruler = C.create({ race: n.race, nation: n.id, role: 'ruler', royal: true, family: fam, born: -rng.int(R.adult + 6, R.adult + Math.floor(span * 0.6)) * 12 - rng.int(0, 11) });
      G.Family.crown(n, ruler, '即位');
      n.rulerSince = W.S.startYear - rng.int(1, Math.min(30, C.age(ruler) - R.adult + 1));
      if (rng.chance(0.85)) {
        const sp = C.create({ race: n.race, sex: ruler.sex === 'm' ? 'f' : 'm', nation: n.id, role: 'noble', royal: true, family: fam, born: ruler.born + rng.int(-60, 60) });
        G.Family.marry(ruler, sp, false);
        const kids = rng.int(1, 3);
        const mother = ruler.sex === 'f' ? ruler : sp, father = ruler.sex === 'm' ? ruler : sp;
        for (let k = 0; k < kids; k++) {
          const b = Math.max(mother.born + R.fertile[0] * 12 + rng.int(0, 60), -(R.adult + 10) * 12) + k * rng.int(14, 40);
          if (b > W.month()) break;
          const kid = C.create({ race: n.race, nation: n.id, role: 'heir', royal: true, father: father.id, mother: mother.id, born: b, family: fam, useFamily: true });
          kid.name = `${kid.given}・${fam}`;
        }
      }
      const n2 = G.CFG.START_CHARS_PER_NATION - W.charsOf(n.id).length;
      const roles = ['general', 'general', 'mage', 'priest', 'merchant', 'noble'];
      for (let k = 0; k < Math.max(2, n2); k++) C.spawnNotable(n.id, roles[k % roles.length]);
    },

    stepDay() {
      const S = W.S;
      S.day++;
      G.Armies.daily();
      G.Battle.detect();
      G.Battle.daily();
      if (S.day % DPM() === 0) Sim.monthly();
    },

    monthly() {
      const S = W.S, moy = W.monthOfYear();
      G.Population.monthly();
      G.Economy.monthly();
      G.Diplomacy.monthlyWars();
      G.Factions.monthly();
      if (G.Story) G.Story.monthly();
      for (const n of W.aliveNations()) G.Armies.warAI(n);
      G.Armies.monsterAI();
      G.NationAI.monthlyRevolts();
      G.Events.monthly();
      G.Faith.monthly();
      // 1年に1回の処理を、国や人物ごとに月をずらして行う(重くならないように)
      for (const n of W.aliveNations()) {
        if (n.id % 12 !== moy) continue;
        G.NationAI.yearly(n);
        G.Diplomacy.yearly(n);
      }
      for (const c of Object.values(S.chars)) {
        if (!c.alive || ((c.born % 12) + 12) % 12 !== moy) continue;
        G.Chars.yearly(c);
        if (!c.alive) continue;
        G.Family.tryMarriage(c);
        G.Family.tryBirth(c);
      }
      if (moy === 0) Sim.yearly();
      Sim.closeReport();
    },

    yearly() {
      const S = W.S;
      G.Events.yearly();
      G.Faith.yearly();
      // 終わった戦争は40件まで残す
      const ended = Object.values(S.wars).filter(w => w.ended).sort((a, b) => a.endDay - b.endDay);
      for (const w of ended.slice(0, Math.max(0, ended.length - 40))) delete S.wars[w.id];
      Sim.sample();
    },

    // 今月の報告をまとめて、来月の報告を始める
    closeReport() {
      const S = W.S, F = G.Factions; if (!S.report) return;
      const r = S.report;
      r.month = W.month() - 1; r.endH = F.power('h'); r.endD = F.power('d'); r.bal = F.balance();
      r.cities = [F.citiesOf('h').length, F.citiesOf('d').length];
      r.events = S.log.filter(e => e.d > S.day - G.CFG.DAYS_PER_MONTH && e.imp >= 2).slice(-6).map(e => ({ title: e.title, text: e.text, type: e.type, x: e.x, y: e.y }));
      r.balBefore = S.lastReport ? S.lastReport.bal : r.bal;
      S.lastReport = r;
      S.report = F.newReport();
      S.report.startH = r.endH; S.report.startD = r.endD;
    },
    sample() {
      const S = W.S;
      const per = {};
      for (const n of W.aliveNations()) per[n.id] = Math.round(W.nationPop(n.id));
      S.stats.push({ y: W.year(), pop: Math.round(W.worldPop()), nations: W.aliveNations().length, wars: Object.values(S.wars).filter(w => !w.ended).length, chars: Object.keys(S.chars).length, per });
      if (S.stats.length > 400) S.stats.shift();
    }
  };
  G.Sim = Sim;
})(globalThis.GD = globalThis.GD || {});
