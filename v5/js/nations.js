// 国: 町の暮らし・国の考え(戦争・和平・同盟)・王位継承・分裂・滅亡
(function (G) {
  const NA = {
    neighbors(n) { return G.nations().filter(m => m.id !== n.id && G.rel(n.id, m.id).border); },
    strength(n) {
      let s = 0;
      for (const a of G.armies()) if (a.nation === n.id) s += a.men * a.q;
      for (const cid of n.cities) s += G.C(cid).garrison * 0.5;
      return s;
    },
    lost(n, m) { return G.cities().filter(c => c.home === n.id && c.owner === m.id).length; },
    // 君主が m へ攻めこみたい気持ち(0〜100くらい)
    warDesire(n, m) {
      const r = G.People.ruler(n); if (!r || !m.alive) return -99;
      const rel = G.rel(n.id, m.id);
      if (rel.state === 'alliance') return -60 + G.infSum(r, 'war', m.id);
      let v = (r.ambition - 50) * 0.45 + rel.tension * 0.5 - rel.opinion * 0.35;
      for (const t of r.traits) v += G.TRAITS[t].war || 0;
      v += n.race !== m.race ? 8 : -6;
      const s = NA.strength(n) / (NA.strength(m) + 1);
      v += G.clamp((s - 1) * 22, -30, 22);
      const rr = G.People.ruler(m);
      if (rr) { const pr = r.rel[rr.id]; if (pr) v -= pr.v * (G.REL[pr.k] && G.REL[pr.k].good ? 0.55 : 0.35); }
      if (r.hate && r.hate[m.id]) v += r.hate[m.id] * 0.6;
      v += NA.lost(n, m) * 8; // うばわれた町を取りもどしたい
      v += G.infSum(r, 'war', m.id) - G.infSum(r, 'peace', m.id) + G.infSum(r, 'conf') * 0.4 - G.infSum(r, 'fear', m.id);
      v += (r.conf - 50) * 0.3 - r.fear * 0.35;
      v -= n.weary * 0.5;
      v -= G.enemiesOf(n).length * 28;
      if (n.stability < 55) v -= (55 - n.stability) * 0.5;
      if (rel.state === 'truce' && rel.truce > G.S.day) v -= 35;
      if (n.arms > G.S.day) v += 6;
      // 大きくなりすぎた国は満足する(異種族の町を多く抱えるほど)
      v -= Math.max(0, n.cities.length - 6) * 6 + n.cities.filter(id => G.C(id).race !== n.race).length * 4;
      // 同じ種族の国が異種族に攻められて負けていたら、助けに入りたい
      if (n.race !== m.race) for (const x of G.nations()) if (x !== n && x.race === n.race && G.atWar(x.id, m.id) && G.Nations.lost(x, m) > 0) v += 14 + G.Nations.lost(x, m) * 4;
      return Math.round(v);
    },
    peaceDesire(n, m) {
      const r = G.People.ruler(n); if (!r) return 80;
      const rel = G.rel(n.id, m.id), war = NA.warBetween(n.id, m.id);
      let v = n.weary * 0.75 + NA.lost(n, m) * 10 + (rel.opinion * 0.2);
      if (G.hasTrait(r, 'peaceful') || G.hasTrait(r, 'gentle')) v += 16;
      if (G.hasTrait(r, 'cruel') || G.hasTrait(r, 'proud')) v -= 10;
      v -= (r.ambition - 50) * 0.3 + (r.hate && r.hate[m.id] ? r.hate[m.id] * 0.4 : 0);
      v += G.infSum(r, 'peace', m.id) - G.infSum(r, 'war', m.id);
      const s = NA.strength(n) / (NA.strength(m) + 1);
      if (s < 0.6) v += 18; if (s > 1.6) v -= 14;
      if (war) { v += Math.min(35, (G.S.day - war.start) / 360 * 6); v += war.taken.filter(id => G.C(id) && G.C(id).owner === n.id).length * 15; }
      if (G.cities().some(c => c.home === n.id && c.owner === n.id && c.siege)) v += 6;
      const pr = G.People.ruler(m) && r.rel[G.People.ruler(m).id];
      if (pr && pr.v > 30) v += 15;
      return Math.round(v);
    },
    warBetween(a, b) { return G.vals(G.S.wars).find(w => !w.end && ((w.a.includes(a) && w.b.includes(b)) || (w.a.includes(b) && w.b.includes(a)))); },

    // ---- 毎月 ----
    monthly() {
      const rng = G.rng;
      // 町の暮らし
      for (const c of G.cities()) {
        const n = G.N(c.owner); if (!n) continue;
        const R = G.RACES[c.race], cap = (1800 + c.food * 95) * (n.capital === c.id ? 1.5 : 1) * (1 + n.tech * 0.08);
        let g = c.pop * 0.0045 * R.grow * (1 - c.pop / cap);
        if (c.harvest > 0) { g += c.pop * 0.003; c.harvest--; }
        if (c.plague > 0) { g -= c.pop * 0.03; c.plague--; c.unrest += 3; c.faith += 2.5; if (!c.plague) G.news(`${c.name}の疫病がおさまった。`, { k: 'disaster', at: c }); }
        if (c.famine > 0) { g -= c.pop * 0.012; c.famine--; c.unrest += 3; c.faith += 1; }
        if (c.siege) { g -= c.pop * 0.01; c.faith += 2; c.unrest += 1; }
        c.pop = Math.max(200, c.pop + g);
        c.burn = Math.max(0, c.burn - 1);
        n.treasury += c.pop * 0.0028 * (c.prosper / 60) * (1 - c.unrest / 220);
        c.prosper += ((c.harvest ? 70 : 55) - (G.enemiesOf(n).length ? 8 : 0) - c.prosper) * 0.08;
        const foreign = c.race !== n.race ? 5.2 : 0;
        const occupied = c.home && c.home !== c.owner ? 1.6 : 0;
        c.unrest += n.weary * 0.025 + foreign + occupied - c.temple * 1.2 - (c.garrison / Math.max(1, c.pop)) * 18 - (c.ward > G.S.day ? 2 : 0);
        c.unrest += (8 - c.unrest) * 0.06;
        c.unrest = G.clamp(c.unrest, 0, 100);
        // 信仰: 不安なときほど祈る。平和でも、神殿と文化がある限りゼロにはならない
        const base = 28 + c.temple * 16 + (n.sectZeal || 0);
        const fear = (G.enemiesOf(n).length ? 0.6 : 0) + (c.siege ? 2.5 : 0) + (c.plague ? 1.5 : 0);
        c.faith += (base - c.faith) * 0.025 + fear;
        c.faith = G.clamp(c.faith, 5, 100);
        const maxG = Math.round(c.pop * 0.055 * (0.6 + c.walls / 200) * (c.race !== n.race ? 0.6 : 1));
        c.garrison += (maxG - c.garrison) * 0.08;
        c.walls = Math.min(n.capital === c.id ? 90 : 65, c.walls + 1.5);
      }
      NA.fixRulers();
      for (const n of G.nations()) NA.decide(n);
      NA.drift();
    },
    drift() {
      const ns = G.nations();
      for (const a of ns) for (const b of ns) {
        if (a.id >= b.id) continue;
        const r = G.rel(a.id, b.id);
        const base = a.race === b.race ? 8 : -32;
        r.opinion += (base - r.opinion) * 0.015;
        if (r.state === 'war') r.tension = Math.min(100, r.tension + 2);
        else {
          // 国境の緊張: 人族と魔族のあいだには、いつも摩擦がある
          let target = !r.border ? 5 : a.race !== b.race ? 48 : 24;
          if (r.state === 'truce' && r.truce > G.S.day) target *= 0.45;
          if (r.state === 'alliance') target = 0;
          if (r.opinion < -40) target += 10;
          const ra = G.People.ruler(a), rb = G.People.ruler(b), pr = ra && rb && ra.rel[rb.id];
          if (pr && pr.v > 30) target -= 20;
          r.tension += (target - r.tension) * 0.04;
        }
        if (r.state === 'truce' && r.truce <= G.S.day) { r.state = 'peace'; G.news(`${G.nname(a)}と${G.nname(b)}の休戦期間が終わった。`, { k: 'politics' }); }
        if (r.state === 'alliance' && r.opinion < -5) { r.state = 'peace'; G.Story.event('alliance_broken', { a: a.id, b: b.id }); }
        r.opinion = G.clamp(r.opinion, -100, 100); r.tension = G.clamp(r.tension, 0, 100);
      }
    },
    decide(n) {
      const rng = G.rng, r = G.People.ruler(n);
      const enemies = G.enemiesOf(n);
      n.weary = G.clamp(n.weary + (enemies.length ? 2.2 : -3), 0, 100);
      const avgUnrest = n.cities.length ? G.sum(n.cities, id => G.C(id).unrest) / n.cities.length : 0;
      n.stability += ((60 + (r ? (r.diplomacy - 50) * 0.3 : -20)) - n.weary * 0.25 - avgUnrest * 0.3 - Math.max(0, n.cities.length - 6) * 2.5 - n.stability) * 0.1;
      n.stability = G.clamp(n.stability, 0, 100);
      // 軍を集める
      const myArmies = G.armies().filter(a => a.nation === n.id);
      const threat = NA.neighbors(n).some(m => G.rel(n.id, m.id).tension > 60);
      const cap = 1 + Math.floor(n.cities.length / 3) + (n.arms > G.S.day ? 1 : 0);
      if ((enemies.length || threat) && myArmies.length < cap && n.treasury > 140) {
        const base = enemies.length ? NA.frontCity(n, enemies) : G.C(n.capital);
        if (base) G.War.raise(n, base);
      }
      for (const a of myArmies) n.treasury -= a.men * 0.008;
      n.treasury = Math.max(0, n.treasury);
      if (!r) return;
      // 宣戦
      if (!enemies.length || (enemies.length < 2 && rng.chance(0.15))) {
        let best = null, bv = -999;
        for (const m of NA.neighbors(n)) { if (G.atWar(n.id, m.id)) continue; const v = NA.warDesire(n, m); if (v > bv) { bv = v; best = m; } }
        if (best && bv > 55 && rng.chance(0.3 + (bv - 55) / 80)) NA.declareWar(n, best, NA.warReason(n, best));
      }
      // 和平
      for (const m of enemies) {
        const w = NA.warBetween(n.id, m.id); if (!w || G.S.day - w.start < 240) continue;
        const a = NA.peaceDesire(n, m), b = NA.peaceDesire(m, n);
        if ((a > 50 && b > 50) || (a > 78 && b > 30) || (b > 78 && a > 30)) { NA.makePeace(w, a > b ? n : m); break; }
      }
      // 同盟
      if (rng.chance(0.08)) {
        for (const m of G.nations()) {
          if (m === n || G.rel(n.id, m.id).state !== 'peace') continue;
          const common = G.enemiesOf(n).filter(e => G.enemiesOf(m).includes(e) || NA.neighbors(m).includes(e));
          const rr = G.People.ruler(m), pr = rr && r.rel[rr.id];
          const op = G.rel(n.id, m.id).opinion + (pr ? pr.v * 0.5 : 0);
          const need = n.race === m.race ? 30 : 55;
          if (common.length && op > need && G.People.ruler(m)) { NA.ally(n, m, common[0]); break; }
        }
      }
      // 神殿
      if (n.treasury > 420 && rng.chance(r.piety / 400)) {
        const c = n.cities.map(G.C).find(c => !c.temple);
        if (c) { c.temple = 1; n.treasury -= 200; G.news(`${G.nname(n)}が${c.name}に女神の神殿を建てた。`, { k: 'faith', at: c }); G.fx('temple', c.x, c.y, { days: 40 }); }
      }
    },
    frontCity(n, enemies) {
      let best = null, bd = 1e9;
      for (const cid of n.cities) { const c = G.C(cid); for (const e of enemies) for (const ec of e.cities) { const d = G.dist(c, G.C(ec)); if (d < bd) { bd = d; best = c; } } }
      return best;
    },
    warReason(n, m) {
      const r = G.People.ruler(n);
      if (r && r.hate && r.hate[m.id] > 30) return '復讐';
      if (NA.lost(n, m)) return '失った土地の奪還';
      if (G.infSum(r, 'war', m.id) > 15) return '女神の啓示';
      if (G.rel(n.id, m.id).tension > 70) return '国境での衝突';
      if (r && r.ambition > 70) return '領土の拡大';
      return n.race !== m.race ? '異種族との積年の対立' : '国境の争い';
    },
    declareWar(n, m, reason, opt) {
      opt = opt || {};
      const r = G.rel(n.id, m.id);
      if (r.state === 'war') return null;
      const wasTruce = r.state === 'truce' && r.truce > G.S.day;
      r.state = 'war'; r.tension = 90; r.opinion = Math.min(r.opinion, -30);
      const w = { id: G.newId('w'), a: [n.id], b: [m.id], start: G.S.day, end: 0, reason, battles: 0, deaths: 0, taken: [], name: NA.warName(n, m), inc: null };
      G.S.wars[w.id] = w; G.S.stats.wars++;
      // 同盟国も参戦
      for (const x of G.nations()) {
        if (x === n || x === m) continue;
        if (G.allied(x.id, m.id) && !G.allied(x.id, n.id) && G.rng.chance(0.75)) { G.rel(x.id, n.id).state = 'war'; w.b.push(x.id); }
        else if (G.allied(x.id, n.id) && !G.allied(x.id, m.id) && G.rng.chance(0.55)) { G.rel(x.id, m.id).state = 'war'; w.a.push(x.id); }
      }
      // 参戦国どうしは全部戦争に
      for (const a of w.a) for (const b of w.b) { const rr = G.rel(a, b); if (rr.state !== 'war') { rr.state = 'war'; } }
      const inc = G.Story.event('war', { war: w.id, a: n.id, b: m.id, reason, truceBroken: wasTruce, cause: opt.cause || null });
      w.inc = inc ? inc.id : null;
      const rr = G.People.ruler(n);
      if (rr) G.remember(rr, `${G.nname(m)}に宣戦した(${reason})。`, 'war', { nation: m.id });
      const mr = G.People.ruler(m);
      if (mr) { G.remember(mr, `${G.nname(n)}に攻めこまれた。`, 'war', { nation: n.id }); if (rr) G.addRel(mr, rr, 'enemy', -25); }
      return w;
    },
    warName(n, m) {
      const used = G.vals(G.S.wars).filter(w => (w.a.includes(n.id) || w.b.includes(n.id)) && (w.a.includes(m.id) || w.b.includes(m.id))).length;
      const K = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
      const kan = k => k < 10 ? K[k] : k < 20 ? '十' + K[k - 10] : K[Math.floor(k / 10)] + '十' + K[k % 10];
      const nth = used ? `第${kan(used + 1)}次` : '';
      if (n.race !== m.race) return `${nth}${n.race === 'human' ? n.short : m.short}・${n.race === 'human' ? m.short : n.short}戦争`;
      return `${nth}${n.short}・${m.short}戦争`;
    },
    makePeace(w, asker) {
      w.end = G.S.day;
      const years = G.rng.int(7, 14);
      for (const a of w.a) for (const b of w.b) { const r = G.rel(a, b); r.state = 'truce'; r.truce = G.S.day + years * 360; r.tension = 25; r.opinion = Math.min(100, r.opinion + 10); }
      // 戦っていた軍は帰る
      for (const a of G.armies()) if (w.a.includes(a.nation) || w.b.includes(a.nation)) { G.War.goHome(a); }
      for (const b of G.vals(G.S.battles)) if (!b.over && (w.a.includes(b.s[0].nation) || w.b.includes(b.s[0].nation))) G.War.endBattle(b, null, 'truce');
      for (const c of G.cities()) if (c.siege && (w.a.includes(c.owner) || w.b.includes(c.owner))) c.siege = null;
      const taken = w.taken.map(G.C).filter(c => c && c.owner !== c.home);
      G.Story.event('peace', { war: w.id, asker: asker.id, years, taken: taken.map(c => c.id) });
      for (const id of w.a.concat(w.b)) { const n = G.N(id); if (n) n.weary = Math.max(0, n.weary - 30); }
    },
    ally(n, m, enemy) {
      const r = G.rel(n.id, m.id); r.state = 'alliance'; r.opinion = Math.max(r.opinion, 40);
      G.Story.event('alliance', { a: n.id, b: m.id, enemy: enemy ? enemy.id : null });
      // いま戦っている相手に、同盟国も参戦
      if (enemy) {
        const w = NA.warBetween(n.id, enemy.id);
        if (w && !G.atWar(m.id, enemy.id)) { G.rel(m.id, enemy.id).state = 'war'; (w.a.includes(n.id) ? w.a : w.b).push(m.id); }
      }
    },
    // ---- 王位継承 ----
    succession(n, cause, opt) {
      const old = G.P(n.ruler), rng = G.rng;
      let heirs = G.People.heirs(n);
      const adult = heirs.filter(p => G.ageOf(p) >= G.RACES[p.race].adult);
      let next = adult[0] || heirs[0] || null;
      let regent = false;
      if (!next) {
        // 王家が絶えた: 最も力のある将軍・貴族が王に
        const cand = G.chars().filter(p => p.nation === n.id && ['general', 'noble', 'hero', 'priest'].includes(p.role)).sort((a, b) => (b.ambition + b.martial + b.fame) - (a.ambition + a.martial + a.fame));
        next = cand[0];
        if (!next) { NA.destroy(n, null, '王家が絶えた'); return; }
        G.Story.event('new_dynasty', { nation: n.id, ruler: next.id, old: old ? old.id : null, cause });
      } else if (G.ageOf(next) < G.RACES[next.race].adult) regent = true;
      // 争いになるか: 2人目の王族か、野心のある実力者
      let rival = null;
      if (adult.length >= 2) { const b = adult[1]; const rr = b.rel[next.id]; if (b.ambition > 62 && (!rr || rr.v < 25)) rival = b; }
      if (!rival) { const pl = G.chars().filter(p => p.nation === n.id && p !== next && p.plot > 55 && G.ageOf(p) >= G.RACES[p.race].adult); if (pl.length) rival = pl.sort((a, b) => b.plot - a.plot)[0]; }
      if (!rival && regent) { const nb = G.chars().filter(p => p.nation === n.id && ['general', 'noble'].includes(p.role) && p.ambition > 70); if (nb.length) rival = nb[0]; }
      NA.crown(n, next, old, cause);
      if (rival) G.Story.event('succession', { nation: n.id, heir: next.id, rival: rival.id, regent, old: old ? old.id : null, cause });
    },
    crown(n, p, old, cause) {
      if (old && old.alive && old.id !== p.id) { old.role = 'exile'; G.People.updateTitle(old); }
      n.ruler = p.id; p.role = 'ruler'; p.nation = n.id; p.city = n.capital; G.People.updateTitle(p);
      p.plot = 0;
      if (old && !old.alive) G.remember(p, `${G.pname(old)}の死により、${G.nname(n)}の君主となった。`, 'crown');
      else G.remember(p, `${G.nname(n)}の君主となった。`, 'crown');
      // 新しい君主の気持ちが国の関係を変える
      for (const m of G.nations()) {
        if (m === n) continue;
        const mr = G.People.ruler(m); if (!mr) continue;
        const pr = p.rel[mr.id]; if (pr) G.rel(n.id, m.id).opinion += pr.v * 0.3;
        if (p.hate && p.hate[m.id]) G.rel(n.id, m.id).opinion -= p.hate[m.id] * 0.4;
      }
      for (const q of G.chars()) if (q.nation === n.id && q !== p && ['general', 'noble', 'knight'].includes(q.role)) { if (!q.rel[p.id]) G.setRel(q, p, 'loyal', G.rng.int(5, 50)); }
      G.emit('crown', { n, p });
    },
    // ---- 分裂(内乱) ----
    split(n, leader, why) {
      const rng = G.rng;
      if (n.cities.length < 2) return null;
      const base = G.C(leader.city) && G.C(leader.city).owner === n.id && leader.city !== n.capital ? G.C(leader.city) : n.cities.map(G.C).filter(c => c.id !== n.capital).sort((a, b) => G.dist(b, G.C(n.capital)) - G.dist(a, G.C(n.capital)))[0];
      if (!base) return null;
      const want = Math.max(1, Math.floor(n.cities.length / 2));
      const take = [base.id], q = [base];
      while (q.length && take.length < want) {
        const c = q.shift();
        for (const o of G.World.neighborsOfCity(c)) if (o.owner === n.id && o.id !== n.capital && !take.includes(o.id)) { take.push(o.id); q.push(o); if (take.length >= want) break; }
      }
      const core = base.name.replace(/(ガルド|ブルク|ハイム)$/, '') || base.name;
      const nm = G.Names.nation(rng, n.race, core); nm.name = NA.uniqueName(nm.name, n.race, core);
      const id = G.newId('n');
      const nn = G.S.nations[id] = {
        id, alive: true, name: nm.name, short: nm.short, form: nm.name.slice(nm.short.length), race: n.race, color: NA.shade(n.color, rng.chance(0.5) ? 0.35 : -0.3),
        capital: base.id, cities: [], ruler: null, treasury: n.treasury * 0.4, tech: n.tech, stability: 45, sect: rng.chance(0.5) ? n.sect : rng.pick(G.FAITH[n.race].sects),
        weary: 0, founded: G.Y(), parent: n.id, arms: 0, armsUntil: 0
      };
      n.treasury *= 0.6;
      for (const cid of take) { const c = G.C(cid); c.owner = id; c.home = id; c.unrest = 30; }
      G.World.refresh();
      leader.nation = id; leader.city = base.id; NA.crown(nn, leader, null, '分裂');
      // 味方につく人々
      for (const p of G.chars()) {
        if (p.nation !== n.id || p === leader || p.role === 'ruler') continue;
        const r = p.rel[leader.id], toKing = p.rel[n.ruler];
        const sup = (r ? r.v : 0) - (toKing ? toKing.v : 0) + (take.includes(p.city) ? 30 : -10) + (p.plot > 30 ? 25 : 0);
        if (sup > 20) { p.nation = id; G.remember(p, `${G.pname(leader)}の側についた。`, 'politics', { who: leader.id }); }
      }
      // 軍も分かれる
      for (const a of G.armies()) if (a.nation === n.id && ((G.P(a.cmd) && G.P(a.cmd).nation === id) || take.some(cid => G.dist(G.C(cid), a) < 6))) { a.nation = id; a.color = nn.color; }
      for (const m of G.nations()) if (m !== nn && m !== n) { const r0 = G.rel(n.id, m.id), r1 = G.rel(id, m.id); r1.opinion = r0.opinion * 0.6; r1.tension = r0.tension * 0.6; r1.state = r0.state === 'war' ? 'war' : 'peace'; r1.border = G.World.borders(nn, m); }
      const r = G.rel(n.id, id); r.border = true; r.opinion = -60;
      G.Nations.recomputeBorders();
      return nn;
    },
    // 生きている国と同じ名前にならないように
    uniqueName(name, race, core) {
      const used = new Set(G.nations().map(n => n.name));
      if (!used.has(name)) return name;
      const forms = race === 'demon' ? ['魔王国', '魔導帝国', '魔族連邦', '夜王国', '新魔王国'] : ['王国', '帝国', '公国', '神聖王国', '新王国', '連合王国'];
      for (const f of forms) if (!used.has((core || name) + f)) return (core || name) + f;
      return '新' + name;
    },
    // 君主のデータがずれていたら直す(安全のため)
    fixRulers() {
      for (const n of G.nations()) {
        const r = G.P(n.ruler);
        if (r && r.alive && r.nation === n.id) { if (r.role !== 'ruler') { r.role = 'ruler'; G.People.updateTitle(r); } continue; }
        NA.succession(n, '不在');
      }
    },
    shade(hex, k) {
      const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
      const f = v => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k));
      return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join('');
    },
    recomputeBorders() {
      const ns = G.nations();
      for (const a of ns) for (const b of ns) if (a.id < b.id) G.rel(a.id, b.id).border = G.World.borders(a, b);
    },
    destroy(n, by, why) {
      if (!n.alive) return;
      n.alive = false; n.fell = G.S.day;
      for (const a of G.armies()) if (a.nation === n.id) G.War.disband(a, '国の滅亡');
      for (const w of G.vals(G.S.wars)) if (!w.end && (w.a.includes(n.id) || w.b.includes(n.id))) {
        w.a = w.a.filter(x => x !== n.id); w.b = w.b.filter(x => x !== n.id);
        if (!w.a.length || !w.b.length) { w.end = G.S.day; G.Story.closeWar(w, by ? `${G.Y() - G.CFG.START_YEAR - Math.floor(w.start / 360)}年の戦いの末、${G.nname(by)}が${G.nname(n)}を滅ぼした。死傷${G.fmt(w.deaths)}人。` : `${G.nname(n)}の滅亡で戦争は終わった。`); }
      }
      for (const k in G.S.rel) { const [a, b] = k.split('|'); if (a === n.id || b === n.id) G.S.rel[k].state = 'peace'; }
      // 生き残った王族は亡命する
      const kin = G.chars().filter(p => p.nation === n.id);
      const refuge = G.nations().filter(m => m.race === n.race && (!by || m.id !== by.id));
      for (const p of kin) {
        if (['ruler', 'heir'].includes(p.role) && refuge.length) {
          const to = refuge.sort((a, b) => G.rel(n.id, b.id).opinion - G.rel(n.id, a.id).opinion)[0];
          p.role = 'exile'; p.exileOf = n.id; p.nation = to.id; p.city = to.capital; G.People.updateTitle(p);
          G.remember(p, `${G.nname(n)}が滅び、${G.nname(to)}へ逃れた。`, 'grief', { nation: by ? by.id : null });
          if (by) { p.hate = p.hate || {}; p.hate[by.id] = (p.hate[by.id] || 0) + 60; }
        } else if (by && G.rng.chance(0.5) && p.race === by.race) { p.nation = by.id; G.remember(p, `${G.nname(by)}に仕えることになった。`, 'politics'); }
        else if (refuge.length) { p.nation = G.rng.pick(refuge).id; }
        else p.nation = null;
      }
      G.Story.event('fall', { nation: n.id, by: by ? by.id : null, why });
      NA.recomputeBorders();
    }
  };
  G.Nations = NA;
})(globalThis.GD = globalThis.GD || {});
