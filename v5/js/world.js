// 世界をつくる: 大陸 → 町 → 国 → 人物 → 前の時代の歴史 → 最初の事件
(function (G) {
  const World = {
    create(seed) {
      seed = String(seed || Math.floor(Math.random() * 1e9));
      G.S = {
        v: G.CFG.VERSION, seed, day: 0, nextId: 1, rngState: null,
        nations: {}, cities: {}, chars: {}, armies: {}, battles: {}, wars: {}, incidents: {},
        rel: {}, log: [], fx: [], cd: {}, chronicle: [], stats: { wars: 0, battles: 0, captured: 0, deaths: 0 },
        goddess: { power: 120, faith: { human: 50, demon: 50 }, plans: [], pending: [], acts: 0, history: [] },
        settings: { autoCam: true, autoPause: false }
      };
      G.rng = new G.RNG(seed + '/history');
      World.buildMap();
      const rng = G.rng, W = G.Map.W;
      // 人族と魔族の住む側を決める(大陸を1本の線で分ける)
      const ang = rng.range(0, Math.PI * 2), ax = Math.cos(ang), ay = Math.sin(ang);
      let cxs = 0, cys = 0, cn = 0;
      for (let i = 0; i < W.w * W.h; i++) if (W.comp[i] === W.mainComp) { cxs += i % W.w; cys += (i / W.w) | 0; cn++; }
      const mx = cxs / cn, my = cys / cn;
      const side = (x, y) => ((x - mx) * ax + (y - my) * ay) < 0 ? 'human' : 'demon';
      G.S.axis = { ax, ay, mx, my };
      // 町の候補
      const cand = [];
      for (let y = 4; y < W.h - 4; y++) for (let x = 4; x < W.w - 4; x++) {
        const i = y * W.w + x;
        if (W.comp[i] !== W.mainComp || G.TERRAIN[W.t[i]].water || W.t[i] === G.T.MOUNTAIN || W.t[i] === G.T.SNOW) continue;
        cand.push(i);
      }
      const suit = (i, race) => {
        const x = i % W.w, y = (i / W.w) | 0; let s = 0;
        for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) {
          if (!G.Map.inside(x + xx, y + yy)) continue;
          const t = G.TERRAIN[W.t[(y + yy) * W.w + x + xx]];
          if (t.water) { s += 0.2; continue; }
          s += t.food * 0.6 + ((G.RACES[race].like[t.key] || 1) - 1) * 1.2;
        }
        return s;
      };
      const sites = [];
      const place = (race, gap, n) => {
        for (let k = 0; k < n; k++) {
          let best = -1, bs = -1e9;
          for (let t = 0; t < 600; t++) {
            const i = rng.pick(cand), x = i % W.w, y = (i / W.w) | 0;
            if (race && side(x, y) !== race) continue;
            let md = 999; for (const s of sites) md = Math.min(md, Math.hypot(s.x - x, s.y - y));
            if (md < gap) continue;
            const sc = suit(i, race || side(x, y)) + Math.min(md, 30) * 0.6 + rng.next() * 4;
            if (sc > bs) { bs = sc; best = i; }
          }
          if (best < 0) continue;
          sites.push({ x: best % W.w, y: (best / W.w) | 0, race: race || side(best % W.w, (best / W.w) | 0), cap: !!race });
        }
      };
      place('human', 22, G.CFG.HUMAN_NATIONS);
      place('demon', 22, G.CFG.DEMON_NATIONS);
      // 首都のまわりに町を順番に置く(どの国も同じくらいの数になるように)
      const capsList = sites.slice();
      for (let round = 0; round < G.CFG.CITIES_PER_NATION - 1; round++) {
        for (const cs of rng.shuffle(capsList.slice())) {
          let best = -1, bs = -1e9;
          for (let t = 0; t < 500; t++) {
            const i = rng.pick(cand), x = i % W.w, y = (i / W.w) | 0;
            const dCap = Math.hypot(cs.x - x, cs.y - y);
            if (dCap < 7 || dCap > 26) continue;
            let md = 999; for (const s2 of sites) md = Math.min(md, Math.hypot(s2.x - x, s2.y - y));
            if (md < 8) continue;
            // ほかの首都より自分の首都に近いこと
            if (capsList.some(o => o !== cs && Math.hypot(o.x - x, o.y - y) < dCap)) continue;
            const sc = suit(i, cs.race) - dCap * 0.25 + Math.min(md, 16) * 0.4 + rng.next() * 3;
            if (sc > bs) { bs = sc; best = i; }
          }
          if (best >= 0) sites.push({ x: best % W.w, y: (best / W.w) | 0, race: cs.race, cap: false, owner: cs });
        }
      }
      // 国
      const caps = sites.filter(s => s.cap), usedName = new Set();
      const uname = (race) => { for (let t = 0; t < 50; t++) { const n = G.Names.place(rng, race); if (!usedName.has(n)) { usedName.add(n); return n; } } return G.Names.place(rng, race) + '二'; };
      const colors = { human: rng.shuffle(G.NATION_COLORS.human.slice()), demon: rng.shuffle(G.NATION_COLORS.demon.slice()) };
      caps.forEach((s, k) => {
        const id = G.newId('n'), core = uname(s.race), nm = G.Names.nation(rng, s.race, core);
        G.S.nations[id] = {
          id, alive: true, name: nm.name, short: nm.short, form: nm.name.slice(nm.short.length), race: s.race, color: colors[s.race].pop(),
          capital: null, cities: [], ruler: null, treasury: rng.int(300, 600), tech: rng.int(1, 2), stability: rng.int(55, 80),
          sect: rng.pick(G.FAITH[s.race].sects), weary: 0, founded: G.CFG.START_YEAR - rng.int(80, 400), parent: null, arms: 0, armsUntil: 0
        };
        s.nation = id;
      });
      // 町
      sites.forEach((s, k) => {
        const id = G.newId('c');
        G.S.cities[id] = {
          id, ri: k, name: uname(s.race), x: s.x, y: s.y, owner: null, race: s.race,
          pop: s.cap ? rng.int(9000, 15000) : rng.int(1500, 6000), walls: s.cap ? 80 : rng.int(25, 55), garrison: 0,
          faith: rng.int(40, 70), temple: s.cap ? 1 : (rng.chance(0.3) ? 1 : 0), unrest: rng.int(5, 25), prosper: rng.int(40, 70),
          plague: 0, famine: 0, burn: 0, harvest: 0, ward: 0, siege: null, founded: 0
        };
        s.city = id;
        if (s.cap) { const n = G.N(s.nation); n.capital = id; G.C(id).owner = n.id; }
      });
      World.regions();
      for (const s2 of sites) if (!s2.cap) { const c = G.C(s2.city); c.owner = s2.owner.nation; c.race = s2.race; }
      World.refresh();
      for (const c of G.cities()) c.garrison = Math.round(c.pop * 0.05);
      // 国どうしの関係
      const ns = G.nations();
      for (const a of ns) for (const b of ns) {
        if (a.id >= b.id) continue;
        const r = G.rel(a.id, b.id);
        r.border = World.borders(a, b);
        if (a.race === b.race) { r.opinion = rng.int(-25, 45); r.tension = r.border ? rng.int(5, 30) : 0; if (rng.chance(0.25) && r.opinion > 20) r.state = 'alliance'; }
        else { r.opinion = rng.int(-70, -25); r.tension = r.border ? rng.int(25, 50) : rng.int(5, 15); }
      }
      // 人物
      for (const n of ns) World.court(n);
      World.prehistory();
      // 軍(各国に1つ)
      for (const n of ns) G.War.raise(n, G.C(n.capital), { quiet: true, size: 0.9 });
      World.opening();
      G.S.rngState = G.rng.getState();
      return G.S;
    },
    buildMap() {
      G.Map.build(G.S.seed);
      const W = G.Map.W;
      W.owner = new Array(W.w * W.h).fill(null);
    },
    regions() {
      const list = G.cities().slice().sort((a, b) => a.ri - b.ri).map(c => ({ id: c.ri, x: c.x, y: c.y }));
      G.Map.computeRegions(list);
      G.S.cityByRi = G.cities().slice().sort((a, b) => a.ri - b.ri).map(c => c.id);
      for (const c of G.cities()) { const inf = G.Map.W.cityInfo[c.ri]; c.food = Math.round(inf.food); c.tiles = inf.tiles; c.coastal = inf.coastal; }
    },
    // 町の持ち主が変わったら呼ぶ
    refresh() {
      const S = G.S, W = G.Map.W;
      for (const n of G.vals(S.nations)) n.cities = [];
      for (const c of G.cities()) { const n = G.N(c.owner); if (n) n.cities.push(c.id); }
      for (let i = 0; i < W.w * W.h; i++) { const r = W.region[i]; W.owner[i] = r >= 0 ? G.C(S.cityByRi[r]).owner : null; }
      G.emit('territory');
    },
    neighborsOfCity(c) { return (G.Map.W.cityAdj[c.ri] || []).map(ri => G.C(G.S.cityByRi[ri])); },
    borders(a, b) {
      for (const cid of a.cities) for (const o of World.neighborsOfCity(G.C(cid))) if (o.owner === b.id) return true;
      return false;
    },
    // 王家と宮廷
    court(n) {
      const rng = G.rng, P = G.People, cap = n.capital;
      const old = rng.chance(0.3);
      const r = P.make({ race: n.race, nation: n.id, role: 'ruler', age: n.race === 'demon' ? rng.int(60, 150) : (old ? rng.int(58, 70) : rng.int(32, 52)), city: cap, ambition: rng.int(35, 90) });
      n.ruler = r.id; n.house = r.house;
      if (rng.chance(0.75)) {
        const sp = P.make({ race: n.race, nation: n.id, role: 'noble', sex: r.sex === 'm' ? 'f' : 'm', age: G.ageOf(r) - rng.int(-4, 8), city: cap });
        P.marry(r, sp);
        const kids = rng.int(1, 3);
        for (let k = 0; k < kids; k++) {
          const maxAge = Math.max(1, Math.min(G.ageOf(r), G.ageOf(sp)) - G.RACES[n.race].adult);
          const c = P.make({ race: n.race, nation: n.id, role: 'heir', age: rng.int(Math.max(1, maxAge - 18), maxAge), city: cap, house: r.house });
          P.family(r, c); P.family(sp, c);
        }
        const ks = r.children.map(id => G.P(id));
        for (const a of ks) for (const b of ks) if (a !== b) G.setRel(a, b, 'sibling', rng.int(-10, 60));
      }
      for (let k = 0; k < 2; k++) { const g = P.make({ race: n.race, nation: n.id, role: 'general', age: rng.int(28, n.race === 'demon' ? 120 : 55), city: rng.pick(n.cities), martial: rng.int(50, 88) }); G.setRel(g, r, 'loyal', rng.int(10, 70)); }
      P.make({ race: n.race, nation: n.id, role: 'priest', age: rng.int(40, 66), city: cap, piety: rng.int(72, 98) });
      if (rng.chance(0.6)) { const nb = P.make({ race: n.race, nation: n.id, role: 'noble', age: rng.int(30, 55), city: rng.pick(n.cities), ambition: rng.int(60, 95), traits: [rng.pick(['ambitious', 'cunning', 'proud'])] }); G.setRel(nb, r, 'rival', rng.int(-40, 5)); }
      P.make({ race: n.race, nation: n.id, role: 'knight', age: rng.int(17, 23), city: rng.pick(n.cities), martial: rng.int(55, 90), traits: [rng.pick(['brave', 'just', 'vengeful', 'family'])] });
    },
    // 前の時代の歴史(ゲームが始まる前の出来事)
    prehistory() {
      const rng = G.rng, ns = G.nations(), Y0 = G.CFG.START_YEAR;
      const pairs = [];
      for (const a of ns) for (const b of ns) if (a.id < b.id && G.rel(a.id, b.id).border) pairs.push([a, b]);
      const cross = pairs.filter(([a, b]) => a.race !== b.race);
      const events = [];
      // 大きな戦争
      if (cross.length) {
        const [a, b] = rng.pick(cross), y = Y0 - rng.int(12, 30);
        const winner = rng.chance(0.5) ? a : b, loser = winner === a ? b : a;
        events.push({ y, t: `${G.nname(a)}と${G.nname(b)}が大戦争。${G.nname(winner)}が勝ち、${G.nname(loser)}は国境の土地を失った。` });
        G.rel(a.id, b.id).opinion -= 20;
        // その戦争で親を亡くした人がいる
        for (const p of G.chars().filter(p => p.nation === loser.id && G.ageOf(p) > 20 && rng.chance(0.4))) {
          G.remember(p, `${y}年の戦争で、父を${G.nname(winner)}の兵に殺された。`, 'revenge', { nation: winner.id });
          p.hate = p.hate || {}; p.hate[winner.id] = 35;
          if (!p.traits.includes('vengeful') && rng.chance(0.4)) p.traits[1] = 'vengeful';
        }
        for (const p of G.chars().filter(p => p.nation === winner.id && p.role === 'general' && G.ageOf(p) > 35)) G.remember(p, `${y}年の戦争で${G.nname(loser)}の軍を破った。`, 'glory', { nation: loser.id });
      }
      // 人族と魔族の、昔の出会い(まれに)
      const hr = ns.filter(n => n.race === 'human').map(n => G.P(n.ruler)), dr = ns.filter(n => n.race === 'demon').map(n => G.P(n.ruler));
      if (rng.chance(0.45)) {
        const h = rng.pick(hr), d = rng.pick(dr);
        G.setRel(h, d, 'friend', rng.int(35, 70), 'friend');
        const y = G.Y() - Math.min(G.ageOf(h), 40) + rng.int(8, 14);
        G.remember(h, `若いころ、国境の森で迷い、魔族の${d.name}に命を救われた。`, 'debt', { who: d.id });
        G.remember(d, `若いころ、人族の${h.name}を助け、一晩語り明かした。`, 'friend', { who: h.id });
        events.push({ y, t: `のちの${G.pname(h)}と${G.pname(d)}が、国境の森でひそかに出会っていた(ほとんど知られていない)。` });
      }
      // 同じ種族どうしの争い
      const same = pairs.filter(([a, b]) => a.race === b.race);
      if (same.length && rng.chance(0.7)) {
        const [a, b] = rng.pick(same), y = Y0 - rng.int(4, 15);
        events.push({ y, t: `${G.nname(a)}と${G.nname(b)}が国境の町をめぐって争った。いまも恨みが残っている。` });
        G.rel(a.id, b.id).opinion -= 25; G.rel(a.id, b.id).tension += 15;
      }
      // 宗派
      const sp = ns.filter(n => n.race === 'human');
      if (sp.length >= 2 && sp[0].sect !== sp[1].sect) events.push({ y: Y0 - rng.int(30, 90), t: `${G.FAITH.human.name}が「${sp[0].sect}」と「${sp[1].sect}」に分かれた。` });
      events.push({ y: Y0 - rng.int(200, 400), t: '女神アステリアが、人族と魔族をこの大陸に生んだ(と、両方の教えは伝える)。' });
      for (const n of ns) events.push({ y: n.founded, t: `${G.nname(n)}が建国された。` });
      events.sort((a, b) => a.y - b.y);
      for (const e of events) G.S.chronicle.push({ y: e.y, t: e.t, k: 'past' });
    },
    // 最初の事件: 1つの国境紛争(人族と魔族)。ここから世界が動き出す
    opening() {
      const rng = G.rng, ns = G.nations();
      const pairs = [];
      for (const a of ns) for (const b of ns) if (a.id < b.id && a.race !== b.race && G.rel(a.id, b.id).border) pairs.push([a, b]);
      if (!pairs.length) return;
      pairs.sort((p, q) => G.rel(q[0].id, q[1].id).tension - G.rel(p[0].id, p[1].id).tension);
      const [h0, d0] = pairs[0], h = h0.race === 'human' ? h0 : d0, d = h === h0 ? d0 : h0;
      const r = G.rel(h.id, d.id); r.tension = 62; r.opinion = Math.min(r.opinion, -45);
      // 国境の町
      let town = null, bd = 1e9;
      for (const cid of h.cities) { const c = G.C(cid); for (const o of World.neighborsOfCity(c)) if (o.owner === d.id) { const dd = G.dist(c, G.C(d.capital)); if (dd < bd) { bd = dd; town = c; } } }
      town = town || G.C(h.capital);
      G.Story.event('border_clash', { a: d.id, b: h.id, city: town.id, opening: true });
    }
  };
  G.World = World;
})(globalThis.GD = globalThis.GD || {});
