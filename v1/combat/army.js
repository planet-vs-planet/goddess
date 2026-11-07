// 軍隊: 編成・マップ上の移動・補給・包囲と占領・戦争中の判断
(function (G) {
  const W = G.World, C = G.Chars, P = G.Personality;

  const A = {
    recount(a) { let t = 0; for (const k in a.troops) t += a.troops[k]; a.total = t; },
    remove(a) {
      const S = W.S;
      if (a.battle && S.battles[a.battle]) { const bt = S.battles[a.battle]; bt.a = bt.a.filter(x => x !== a.id); bt.b = bt.b.filter(x => x !== a.id); }
      delete S.armies[a.id];
    },
    casualties(a, killed) { // 戦死した兵は故郷の人口から減る
      const c = W.S.cities[a.home];
      if (c && a.nation !== -1) c.pop = Math.max(30, c.pop - killed * 0.9);
    },
    // 軍を作る
    raise(n, city, size, target) {
      const rng = W.rng;
      size = Math.floor(size);
      if (size < 40) return null;
      const units = G.UNITS[n.race].filter(u => u.tech <= n.tech);
      const troops = {};
      let left = size;
      const weights = units.map(u => ({ u, w: 1 + u.tech * 0.6 + rng.next() }));
      const tw = weights.reduce((s, x) => s + x.w, 0);
      for (const { u, w } of weights) {
        let cnt = Math.floor(size * w / tw);
        if (u.cls === 'mon' && n.race === 'dragon') cnt = Math.floor(cnt * 0.15); // 古竜はごく少ない
        if (cnt > 0) { troops[u.key] = cnt; left -= cnt; }
      }
      troops[units[0].key] = (troops[units[0].key] || 0) + Math.max(0, left);
      n.manpower -= size; n.res.gold -= size * 0.35; n.res.ore -= size * 0.05;
      const a = {
        id: W.newId(), nation: n.id, x: city.x + 0.5, y: city.y + 0.5, troops, total: 0, start: 0,
        morale: 0.85 + rng.next() * 0.15, supply: 1, cmd: null, state: 'idle', path: null, pi: 0,
        target: target || null, home: city.id, siege: 0, battle: null, buff: null, born: W.S.day
      };
      A.recount(a); a.start = a.total;
      a.cmd = A.pickCommander(n);
      W.S.armies[a.id] = a;
      return a;
    },
    pickCommander(n) {
      const busy = new Set(Object.values(W.S.armies).map(a => a.cmd));
      const cands = W.charsOf(n.id).filter(c => !busy.has(c.id) && C.isAdult(c) && ['general', 'hero', 'noble', 'heir', 'ruler', 'mage'].includes(c.role) && C.age(c) < c.life * 0.85);
      cands.sort((a, b) => (b.st.war + (b.role === 'general' || b.role === 'hero' ? 25 : 0) - (b.role === 'ruler' && !P.has(b, 'brave') ? 40 : 0)) - (a.st.war + (a.role === 'general' || a.role === 'hero' ? 25 : 0) - (a.role === 'ruler' && !P.has(a, 'brave') ? 40 : 0)));
      if (cands.length && cands[0].st.war > 35) return cands[0].id;
      if (W.charsOf(n.id).length < G.CFG.MAX_ALIVE_CHARS / 8 && W.rng.chance(0.5)) {
        const g = C.spawnNotable(n.id, 'general');
        W.log('person', '新しい将軍', `${n.name}で、兵士あがりの${g.name}が将軍に取り立てられた。`, { n: [n.id], c: [g.id], imp: 1 });
        return g.id;
      }
      return cands.length ? cands[0].id : null;
    },
    setTarget(a, x, y, target) {
      const path = G.Map.findPath(a.x, a.y, x, y, 30000);
      if (!path) return false;
      a.path = path; a.pi = 0; a.target = target; a.state = 'march'; a.siege = 0;
      return true;
    },
    sendHome(a, retreat) {
      const c = W.S.cities[a.home];
      const n = W.nation(a.nation);
      let home = c && c.owner === a.nation ? c : (n ? W.capitalOf(n.id) : null);
      if (!home) { A.remove(a); return; }
      a.home = home.id;
      if (!A.setTarget(a, home.x, home.y, { type: 'home', id: home.id })) { A.remove(a); return; }
      a.state = retreat ? 'retreat' : 'march';
    },

    // 1日ごとの移動・補給・包囲
    daily() {
      const S = W.S, rng = W.rng, MW = G.Map.W;
      for (const id in S.armies) {
        const a = S.armies[id];
        if (a.battle) continue;
        const n = W.nation(a.nation);
        if (a.nation !== -1 && (!n || !n.alive)) { A.remove(a); continue; }
        // 補給
        const ri = MW.region[G.Map.idx(a.x | 0, a.y | 0)];
        const owner = ri >= 0 ? S.cities[ri].owner : null;
        const friendly = owner === a.nation || (owner != null && a.nation !== -1 && W.rel(owner, a.nation) && W.rel(owner, a.nation).alliance);
        if (a.nation === -1) a.supply = 1;
        else if (friendly) a.supply = Math.min(1, a.supply + 0.03);
        else a.supply = Math.max(0, a.supply - (S.day % 2 ? 0.012 : 0.006));
        if (a.supply < 0.3 && rng.chance(0.3)) {
          for (const k in a.troops) a.troops[k] *= 0.995;
          A.recount(a);
        }
        if (a.morale < 0.95 && a.state !== 'retreat') a.morale = Math.min(1, a.morale + 0.004);
        // 移動
        if (a.path && a.pi < a.path.length) {
          const R = n ? G.RACES[n.race] : { speed: 0.9 };
          let speed = 0.42 * R.speed;
          const cav = A.clsShare(a, 'cav'); speed *= 1 + cav * 0.3;
          let budget = speed;
          while (budget > 0 && a.pi < a.path.length) {
            const [tx, ty] = a.path[a.pi];
            const cost = G.Map.moveCost(G.Map.idx(tx, ty));
            const cx = tx + 0.5, cy = ty + 0.5;
            const d = Math.hypot(cx - a.x, cy - a.y);
            const step = budget / Math.min(cost, 3.5);
            if (step >= d) { a.x = cx; a.y = cy; a.pi++; budget -= d * Math.min(cost, 3.5); }
            else { a.x += (cx - a.x) / d * step; a.y += (cy - a.y) / d * step; budget = 0; }
          }
          if (a.pi >= a.path.length) { a.path = null; A.arrive(a); }
        } else if (a.state === 'siege') {
          A.siegeDay(a);
        }
      }
    },
    clsShare(a, cls) {
      let s = 0; for (const k in a.troops) if (G.UNIT_BY_KEY[k].cls === cls) s += a.troops[k];
      return a.total ? s / a.total : 0;
    },
    arrive(a) {
      const S = W.S;
      const t = a.target;
      if (!t) { a.state = 'idle'; return; }
      if (t.type === 'home') {
        const n = W.nation(a.nation);
        if (n && !W.enemiesOf(n.id).length) { // 平和なら解散
          n.manpower += a.total * 0.85;
          A.remove(a); return;
        }
        a.state = 'idle'; a.morale = Math.max(a.morale, 0.6); return;
      }
      if (t.type === 'city') {
        const c = S.cities[t.id];
        if (c && W.atWar(a.nation, c.owner)) { a.state = 'siege'; a.siege = a.siege || 0; return; }
      }
      a.state = 'idle';
    },
    garrison(c) {
      const n = W.nation(c.owner);
      const R = n ? G.RACES[n.race] : G.RACES.human;
      return c.pop * 0.045 * (1 + 0.55 * (c.buildings.wall || 0)) * R.power * (R.def || 1) * (n ? 1 + n.tech * 0.04 : 1) * (n && n.capital === c.id ? 1.4 : 1) * (1 + G.Map.terrainAt(c.x, c.y).def);
    },
    siegeDay(a) {
      const S = W.S, rng = W.rng;
      const c = S.cities[a.target.id];
      if (!c || !W.atWar(a.nation, c.owner)) { a.state = 'idle'; a.target = null; return; }
      // 近くに敵の軍がいたら包囲をやめて戦う(戦闘は自動で始まる)
      const g = A.garrison(c);
      const p = G.Battle.armyPower(a, null) * (1 + A.clsShare(a, 'sie') * 1.5);
      a.siege += G.clamp(p / Math.max(30, g) * 0.4, 0.03, 3);
      // 守備兵からの反撃
      const loss = g * 0.0025 * rng.range(0.5, 1.5);
      for (const k in a.troops) { a.troops[k] -= loss * (a.troops[k] / a.total); if (a.troops[k] < 1) delete a.troops[k]; }
      A.recount(a);
      if (a.total < 40) { A.remove(a); return; }
      if (a.siege >= 100) A.capture(a, c);
    },
    capture(a, c) {
      const S = W.S;
      const oldId = c.owner, old = W.nation(oldId);
      const wasCap = old && old.capital === c.id;
      if (a.nation === -1) { // 魔物は都市を荒らす
        c.pop *= 0.8; for (const k in c.buildings) if (W.rng.chance(0.5)) c.buildings[k] = Math.max(0, c.buildings[k] - 1);
        c.unrest = Math.min(100, c.unrest + 25);
        W.log('disaster', `${c.name}の壊滅`, `魔物の群れが${c.name}を襲い、多くの人々が命を落とした。`, { n: [oldId], x: c.x, y: c.y, imp: 2 });
        W.effect('destroy', c.x, c.y);
        a.siege = 0; a.state = 'idle'; a.target = null; a.loot = (a.loot || 0) + 1;
        for (const k in a.troops) a.troops[k] *= 0.7; A.recount(a);
        return;
      }
      if (G.Factions) G.Factions.onCapture(c, oldId, a.nation);
      c.pop *= 0.88; c.conquered = S.day; c.unrest = Math.min(100, c.unrest + 30);
      if (c.buildings.wall) c.buildings.wall--;
      G.Nations.giveCity(c, a.nation);
      for (const wid in S.wars) {
        const w = S.wars[wid]; if (w.ended) continue;
        if (w.att.includes(a.nation) && w.def.includes(oldId)) w.attScore += wasCap ? 30 : 15;
        if (w.def.includes(a.nation) && w.att.includes(oldId)) w.defScore += wasCap ? 30 : 15;
      }
      const cmd = W.liveChar(a.cmd);
      if (cmd) { cmd.fame += wasCap ? 25 : 10; C.remember(cmd, `${c.name}を攻め落とした`); }
      W.log('war', `${c.name}陥落`, `${W.nationName(a.nation)}軍${cmd ? '(' + cmd.name + ')' : ''}が${old ? old.name + 'の' : ''}${wasCap ? '首都' : ''}${c.name}を攻め落とした。`, { n: [a.nation, oldId], x: c.x, y: c.y, imp: wasCap ? 3 : 2, c: cmd ? [cmd.id] : [] });
      W.effect('capture', c.x, c.y, { color: W.nation(a.nation).color });
      // 王が首都で捕らえられる
      if (wasCap && old && old.alive) {
        const ruler = W.liveChar(old.ruler);
        if (ruler && W.rng.chance(0.25)) {
          const n = W.nation(a.nation);
          const winRuler = W.liveChar(n.ruler);
          if (winRuler && P.has(winRuler, 'cruel')) {
            W.log('war', '王の処刑', `捕らえられた${ruler.name}は${n.name}によって処刑された。`, { n: [old.id, n.id], c: [ruler.id], imp: 3, memory: false });
            C.kill(ruler, '処刑', { charId: winRuler.id, race: n.race });
          } else {
            W.log('war', '王の捕虜', `${old.name}の${ruler.name}が捕虜になったが、身代金と引きかえに解放された。`, { n: [old.id, n.id], c: [ruler.id], imp: 2 });
            old.res.gold -= 300; n.res.gold += 300; old.stability -= 10;
          }
        }
      }
      a.siege = 0; a.state = 'idle'; a.target = null; a.home = c.id;
    },

    // 戦争中の国の判断(1か月ごと)
    warAI(n) {
      const S = W.S, rng = W.rng;
      const enemies = W.enemiesOf(n.id);
      const myCities = W.citiesOf(n.id);
      if (!myCities.length) return;
      // 自分の領土にいる魔物
      const monsters = Object.values(S.armies).filter(a => a.nation === -1 && myCities.some(c => Math.hypot(c.x - a.x, c.y - a.y) < 22));
      if (!enemies.length && !monsters.length) return;
      const mine = Object.values(S.armies).filter(a => a.nation === n.id);
      const want = Math.min(4, 1 + Math.floor(myCities.length / 3));
      if (mine.length < want && n.manpower > 150 && n.res.gold > -100) {
        // 敵に近い都市から出陣
        const enemyCities = S.cities.filter(c => enemies.includes(c.owner));
        let base = W.capitalOf(n.id);
        let bd = Infinity;
        for (const c of myCities) {
          for (const e of enemyCities) { const d = W.distCities(c, e); if (d < bd) { bd = d; base = c; } }
          for (const m of monsters) { const d = Math.hypot(c.x - m.x, c.y - m.y); if (d < bd) { bd = d; base = c; } }
        }
        const size = n.manpower * (mine.length ? 0.45 : 0.6);
        const a = A.raise(n, base, size);
        if (a) {
          const cmd = W.liveChar(a.cmd);
          if (rng.chance(0.4)) W.log('war', '出陣', `${n.name}は${base.name}で${G.fmt(a.total)}人の軍を編成した${cmd ? '(指揮官: ' + cmd.name + ')' : ''}。`, { n: [n.id], c: cmd ? [cmd.id] : [], x: base.x, y: base.y, imp: 1 });
          mine.push(a);
        }
      }
      for (const a of mine) {
        if (a.battle || a.state === 'retreat') continue;
        if (a.state === 'siege' && a.target && W.atWar(a.nation, S.cities[a.target.id].owner)) continue;
        if (a.state === 'march' && a.target && a.target.type !== 'home' && rng.chance(0.7)) {
          if (a.target.type === 'city' && W.atWar(a.nation, S.cities[a.target.id].owner)) continue;
          if (a.target.type === 'army' && S.armies[a.target.id]) {
            const t = S.armies[a.target.id];
            if (Math.hypot(t.x - a.x, t.y - a.y) > 2) A.setTarget(a, t.x, t.y, a.target);
            continue;
          }
        }
        if (a.morale < 0.45 || a.total < a.start * 0.3) { A.sendHome(a); continue; }
        // 目標をえらぶ: 近くの敵軍 or 敵の都市
        const myP = G.Battle.armyPower(a, null, true);
        let best = null, bs = -Infinity;
        for (const e of Object.values(S.armies)) {
          if (!W.atWar(a.nation, e.nation)) continue;
          const d = Math.hypot(e.x - a.x, e.y - a.y);
          const inMine = myCities.some(c => Math.hypot(c.x - e.x, c.y - e.y) < 12);
          if (d > 40 && !inMine) continue;
          const ep = G.Battle.armyPower(e, null, true);
          if (ep > myP * 1.6) continue;
          const s = 60 - d + (inMine ? 40 : 0) + (e.nation === -1 ? 15 : 0);
          if (s > bs) { bs = s; best = { type: 'army', id: e.id, x: e.x, y: e.y }; }
        }
        for (const c of S.cities) {
          if (!enemies.includes(c.owner)) continue;
          const d = Math.hypot(c.x - a.x, c.y - a.y);
          const g = A.garrison(c);
          if (g > myP * 1.3) continue;
          const s = 45 - d * 0.8 - g / Math.max(1, myP) * 15 + (W.nation(c.owner).capital === c.id ? 6 : 0) + rng.next() * 6;
          if (s > bs) { bs = s; best = { type: 'city', id: c.id, x: c.x, y: c.y }; }
        }
        if (best) {
          if (!A.setTarget(a, best.x, best.y, { type: best.type, id: best.id })) a.state = 'idle';
        } else if (a.state === 'idle') A.sendHome(a);
      }
    },

    // 魔物の群れ(どの国にも属さない)
    spawnMonsters(x, y, size, title) {
      const a = {
        id: W.newId(), nation: -1, x: x + 0.5, y: y + 0.5, troops: { m_hrd: Math.floor(size) }, total: 0, start: 0,
        morale: 1, supply: 1, cmd: null, state: 'idle', path: null, pi: 0, target: null, home: null, siege: 0, battle: null, buff: null, born: W.S.day, label: title || '魔物の群れ'
      };
      A.recount(a); a.start = a.total;
      W.S.armies[a.id] = a;
      return a;
    },
    monsterAI() {
      const S = W.S;
      for (const a of Object.values(S.armies)) {
        if (a.nation !== -1 || a.battle) continue;
        if (S.day - a.born > 360 * 1.5 || (a.loot || 0) >= 2 || a.total < 60) { // 時間がたつと散っていく
          W.log('disaster', `${a.label}の消滅`, `${a.label}は散り散りになり、姿を消した。`, { x: a.x, y: a.y, imp: 1 });
          A.remove(a); continue;
        }
        if (a.state === 'siege' || (a.path && a.pi < a.path.length)) continue;
        let best = null, bd = Infinity;
        for (const c of S.cities) { const d = Math.hypot(c.x - a.x, c.y - a.y); if (d < bd && d > 0.8) { bd = d; best = c; } }
        if (best) A.setTarget(a, best.x, best.y, { type: 'city', id: best.id });
      }
    }
  };
  G.Armies = A;
})(globalThis.GD = globalThis.GD || {});
