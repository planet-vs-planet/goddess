// 戦争: 軍の編成・行軍・補給・会戦・包囲・援軍・占領・撤退
(function (G) {
  const DEMON_ARMY = ['黒牙', '紅蓮', '夜鴉', '骨牙', '嵐爪', '月蝕', '影喰', '灰燼', '鉄角', '血月'];
  const HUMAN_ARMY = ['騎士団', '軍団', '近衛軍', '辺境軍', '聖騎士団', '義勇軍'];
  const War = {
    raise(n, city, opt) {
      opt = opt || {};
      const rng = G.rng;
      const pool = G.sum(n.cities, id => G.C(id).pop);
      let men = Math.round(G.clamp(n.treasury * 9, 900, 7000) * (opt.size || 1));
      men = Math.min(men, Math.round(pool * 0.06));
      if (men < 400) return null;
      n.treasury = Math.max(0, n.treasury - men / 11);
      const free = G.chars().filter(p => p.nation === n.id && ['general', 'hero'].includes(p.role) && !p.armyId && G.ageOf(p) >= G.RACES[p.race].adult);
      let cmd = free.sort((a, b) => (b.martial + b.fame) - (a.martial + a.fame))[0];
      if (!cmd) { const r = G.People.ruler(n); if (r && !r.armyId && G.hasTrait(r, 'brave') && G.ageOf(r) < 60) cmd = r; }
      if (!cmd) cmd = G.People.promote(n, 'general');
      const id = G.newId('a');
      const a = G.S.armies[id] = {
        id, nation: n.id, color: n.color, name: War.armyName(n, city, cmd), cmd: cmd.id, men, max: men,
        q: G.RACES[n.race].power * (1 + n.tech * 0.08) * (n.arms > G.S.day ? 1.2 : 1),
        morale: 75, supply: 100, x: city.x, y: city.y, path: null, pi: 0, goal: null, hunt: null, mission: 'idle', state: 'idle',
        battle: null, blessed: 0, storm: 0, lost: 0, revel: 0, home: city.id, kills: 0, born: G.S.day,
        comp: War.comp(n.race, rng)
      };
      cmd.armyId = id;
      if (!opt.quiet) G.news(`${G.nname(n)}が${city.name}で${a.name}(${G.fmt(men)}人)を編成した。指揮官は${G.pname(cmd)}。`, { k: 'war', at: city });
      return a;
    },
    comp(race, rng) {
      if (race === 'human') return { inf: rng.int(40, 55), rng: rng.int(15, 25), cav: rng.int(12, 22), mag: rng.int(3, 8) };
      return { inf: rng.int(35, 50), rng: rng.int(5, 12), cav: rng.int(10, 20), mag: rng.int(8, 15) };
    },
    armyName(n, city, cmd) {
      const rng = G.rng;
      if (n.race === 'demon') return rng.pick(DEMON_ARMY) + '軍団';
      return city.name + rng.pick(HUMAN_ARMY);
    },
    disband(a, why) {
      const p = G.P(a.cmd); if (p) p.armyId = null;
      if (a.battle) { const b = G.B(a.battle); if (b) for (const s of b.s) s.armies = s.armies.filter(x => x !== a.id); }
      for (const c of G.cities()) if (c.siege) { c.siege.armies = c.siege.armies.filter(x => x !== a.id); if (!c.siege.armies.length) c.siege = null; }
      delete G.S.armies[a.id];
    },
    hostile(a, b) { return a.nation !== b.nation && G.atWar(a.nation, b.nation); },
    ownLand(a, x, y) {
      const W = G.Map.W, o = W.owner[(y | 0) * W.w + (x | 0)];
      return o === a.nation || (o && G.allied(o, a.nation));
    },
    nearestOwn(a) {
      const n = G.N(a.nation); if (!n) return null;
      let best = null, bd = 1e9;
      for (const cid of n.cities) { const c = G.C(cid); if (c.siege) continue; const d = G.dist(c, a); if (d < bd) { bd = d; best = c; } }
      return best || G.C(n.capital);
    },
    go(a, x, y, mission, goal) {
      const path = G.Map.findPath(a.x, a.y, x, y, 30000);
      if (!path) return false;
      a.path = path; a.pi = 0; a.mission = mission; a.goal = goal || null; a.state = mission === 'retreat' ? 'retreat' : 'march';
      return true;
    },
    goHome(a) {
      const c = War.nearestOwn(a);
      if (c) War.go(a, c.x, c.y, 'home', c.id); else War.disband(a, '帰る場所がない');
    },

    // ---- 毎日 ----
    daily() {
      const S = G.S;
      for (const a of G.armies()) War.move(a);
      War.meet();
      for (const b of G.vals(S.battles)) if (!b.over && !b.view) War.round(b);
      for (const c of G.cities()) if (c.siege) War.siegeDay(c);
      // 終わった会戦を片づける(しばらく絵を残す)
      for (const id in S.battles) { const b = S.battles[id]; if (b.over && S.day - b.over > 20) delete S.battles[id]; }
    },
    move(a) {
      if (a.state === 'battle' || a.state === 'siege') return;
      const own = War.ownLand(a, a.x, a.y);
      a.supply = G.clamp(a.supply + (own ? 4 : -1.6), 0, 100);
      if (a.supply < 20) { a.men *= 0.997; a.morale -= 0.4; }
      if (own && a.state === 'idle') { a.morale = Math.min(85, a.morale + 0.6); if (a.men < a.max) { const add = Math.min(a.max - a.men, a.max * 0.012); const n = G.N(a.nation); if (n && n.treasury > add / 20) { a.men += add; n.treasury -= add / 20; } } }
      if (!a.path || a.pi >= a.path.length) {
        if (a.state === 'march' || a.state === 'retreat') War.arrive(a);
        return;
      }
      let sp = 0.7 * (a.storm > G.S.day ? 0.3 : 1) * (a.lost > G.S.day ? 0.45 : 1) * (a.supply < 25 ? 0.8 : 1) * (a.state === 'retreat' ? 1.15 : 1);
      if (G.S.weather) for (const w of G.S.weather) if (w.until > G.S.day && Math.hypot(w.x - a.x, w.y - a.y) < w.r) sp *= 0.35;
      while (sp > 0 && a.pi < a.path.length) {
        const [tx, ty] = a.path[a.pi];
        const cost = G.TERRAIN[G.Map.W.t[ty * G.Map.W.w + tx]].move;
        const step = sp / Math.min(cost, 3.2);
        const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
        if (d <= step) { a.x = tx; a.y = ty; a.pi++; sp -= d * Math.min(cost, 3.2); }
        else { a.x += dx / d * step; a.y += dy / d * step; sp = 0; }
      }
      if (a.lost > G.S.day && G.rng.chance(0.05) && a.path) { a.pi = Math.max(0, a.pi - 3); }
      // 敵の町のとなりに着いた
      if (a.goal && a.mission === 'attack') { const c = G.C(a.goal); if (c && G.dist(a, c) < 1.3 && c.owner !== a.nation && G.atWar(a.nation, c.owner)) War.arrive(a); }
    },
    arrive(a) {
      const c = G.C(a.goal);
      a.path = null;
      if (a.mission === 'attack' && c) {
        if (c.owner === a.nation) { a.state = 'idle'; a.mission = 'idle'; return; }
        if (!G.atWar(a.nation, c.owner)) { War.goHome(a); return; }
        if (c.garrison < 60 && !c.siege) { War.capture(c, a); a.state = 'idle'; a.mission = 'idle'; return; }
        War.startSiege(c, a); return;
      }
      if (a.mission === 'relief' && c && c.siege) { a.state = 'idle'; return; } // 近くに来れば会戦になる
      a.state = 'idle'; a.mission = 'idle';
    },
    // 敵の軍どうしが出会うと会戦
    meet() {
      const list = G.armies();
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (!War.hostile(a, b)) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 1.6) continue;
        if (a.battle && b.battle) continue;
        if (a.battle) { War.join(G.B(a.battle), b); continue; }
        if (b.battle) { War.join(G.B(b.battle), a); continue; }
        War.startBattle(a, b);
      }
      // 近くの会戦へ援軍
      for (const b of G.vals(G.S.battles)) {
        if (b.over) continue;
        for (const a of list) {
          if (a.battle || a.state === 'retreat' || Math.hypot(a.x - b.x, a.y - b.y) > 4) continue;
          if (b.s.some(s => s.nation === a.nation || G.allied(s.nation, a.nation)) && b.s.some(s => G.atWar(s.nation, a.nation))) War.join(b, a, true);
        }
      }
    },
    side(a) { return { nation: a.nation, armies: [a.id], men0: a.men, cas: 0 }; },
    startBattle(a, b, opt) {
      opt = opt || {};
      const id = G.newId('b');
      const def = War.ownLand(b, b.x, b.y) ? 1 : 0;
      const bt = G.S.battles[id] = {
        id, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, s: [War.side(a), War.side(b)], def, start: G.S.day, round: 0, over: 0, winner: null,
        important: false, view: false, log: [], city: opt.city || null, weather: null, bless: [0, 0], name: ''
      };
      for (const x of [a, b]) { x.state = 'battle'; x.battle = id; x.path = null; }
      const place = War.placeName(bt.x, bt.y);
      bt.name = `${place}の戦い`;
      const men = a.men + b.men;
      const vip = [a, b].some(x => { const p = G.P(x.cmd); return p && (p.role === 'ruler' || p.role === 'hero' || p.fame > 50); });
      const capital = opt.city && G.N(G.C(opt.city).owner) && G.N(G.C(opt.city).owner).capital === opt.city;
      bt.important = men > 7500 || vip || capital || a.blessed > G.S.day || b.blessed > G.S.day;
      if (bt.important) bt.name = `${place}の会戦`;
      const w = G.Nations.warBetween(a.nation, b.nation);
      G.S.stats.battles++;
      if (w) w.battles++;
      const ca = G.P(a.cmd), cb = G.P(b.cmd);
      const line = `${bt.name}が始まった。${G.nname(G.N(a.nation))}の${a.name}(${G.fmt(a.men)})と${G.nname(G.N(b.nation))}の${b.name}(${G.fmt(b.men)})が激突。`;
      War.blog(bt, line);
      G.news(line, { k: 'war', at: bt, imp: bt.important ? 3 : 2, inc: w && w.inc });
      if (w && w.inc) G.Story.beat(G.I(w.inc), line, { at: bt, battle: id });
      G.fx('battle', bt.x, bt.y, { days: 12 });
      if (bt.important) G.emit('bigBattle', bt);
      return bt;
    },
    join(b, a, quiet) {
      if (!b || b.over) return;
      let si = b.s.findIndex(s => s.nation === a.nation || G.allied(s.nation, a.nation));
      if (si < 0) return;
      if (b.s[si].armies.includes(a.id)) return;
      b.s[si].armies.push(a.id); b.s[si].men0 += a.men;
      a.state = 'battle'; a.battle = b.id; a.path = null;
      const p = G.P(a.cmd);
      War.blog(b, `援軍！ ${a.name}(${G.fmt(a.men)})が${p ? G.pname(p) + 'に率いられて' : ''}戦場に到着した。`, 'reinforce');
      if (!quiet || b.important) G.news(`${b.name}に${G.nname(G.N(a.nation))}の援軍${a.name}が到着した。`, { k: 'war', at: b });
    },
    blog(b, t, kind) { b.log.push({ r: b.round, t, k: kind || 'info' }); G.emit('battleLog', { b, t, kind }); },
    placeName(x, y) {
      let best = null, bd = 1e9;
      for (const c of G.cities()) { const d = Math.hypot(c.x - x, c.y - y); if (d < bd) { bd = d; best = c; } }
      const t = G.TERRAIN[G.Map.W.t[(y | 0) * G.Map.W.w + (x | 0)]];
      if (!best) return t.name;
      if (bd < 2) return best.name;
      return best.name + (['forest', 'deepforest'].includes(t.key) ? 'の森' : t.key === 'mountain' ? '山地' : t.key === 'river' ? '川' : t.key === 'swamp' ? 'の沼' : t.key === 'desert' ? '砂漠' : '平原');
    },
    power(b, si) {
      const s = b.s[si];
      let p = 0;
      for (const id of s.armies) {
        const a = G.A(id); if (!a) continue;
        const c = G.P(a.cmd);
        let k = a.q * (0.35 + a.morale / 100) * (1 + (c ? (c.martial - 50) / 200 : -0.1));
        if (c && c.role === 'hero') k *= 1.25;
        if (a.blessed > G.S.day) k *= 1.35;
        if (a.revel > G.S.day) k *= 1.2;
        if (b.bless[si]) k *= 1 + b.bless[si];
        p += a.men * k;
      }
      if (si === 1 && b.def) { const t = G.TERRAIN[G.Map.W.t[(b.y | 0) * G.Map.W.w + (b.x | 0)]]; p *= 1 + t.def; }
      if (b.weather === 'rain') p *= si === b.rainHurts ? 0.8 : 1;
      if (b.weather === 'fog' && si === 0) p *= 0.88;
      return p;
    },
    menOf(s) { return G.sum(s.armies, id => (G.A(id) ? G.A(id).men : 0)); },
    morOf(s) { const l = s.armies.map(G.A).filter(Boolean); return l.length ? G.sum(l, a => a.morale * a.men) / Math.max(1, G.sum(l, a => a.men)) : 0; },
    // 1日ぶんの戦い
    round(b) {
      if (b.over) return;
      const rng = G.rng;
      b.round++;
      const p0 = War.power(b, 0), p1 = War.power(b, 1), tot = p0 + p1 + 1;
      const m0 = War.menOf(b.s[0]), m1 = War.menOf(b.s[1]);
      if (m0 < 1 || m1 < 1) { War.endBattle(b, m0 < 1 ? 1 : 0, 'rout'); return; }
      const cas1 = m1 * 0.085 * (p0 / tot) * 2 * rng.range(0.75, 1.25), cas0 = m0 * 0.085 * (p1 / tot) * 2 * rng.range(0.75, 1.25);
      War.hurt(b, 0, cas0, p1 / tot); War.hurt(b, 1, cas1, p0 / tot);
      b.s[0].cas += cas0; b.s[1].cas += cas1;
      War.story(b, p0 / tot);
      // どちらかが崩れたら終わり
      const mo0 = War.morOf(b.s[0]), mo1 = War.morOf(b.s[1]);
      const n0 = War.menOf(b.s[0]), n1 = War.menOf(b.s[1]);
      const broke0 = mo0 < 18 || n0 < b.s[0].men0 * 0.18, broke1 = mo1 < 18 || n1 < b.s[1].men0 * 0.18;
      if (broke0 || broke1) { War.endBattle(b, broke0 && broke1 ? (mo0 > mo1 ? 0 : 1) : (broke0 ? 1 : 0), 'rout'); return; }
      if (b.round >= 9) War.endBattle(b, p0 > p1 * 1.25 ? 0 : p1 > p0 * 1.25 ? 1 : null, 'stall');
    },
    hurt(b, si, cas, enemyShare) {
      const s = b.s[si], men = War.menOf(s);
      for (const id of s.armies) {
        const a = G.A(id); if (!a) continue;
        const share = a.men / Math.max(1, men);
        a.men = Math.max(0, a.men - cas * share);
        a.morale -= (cas / Math.max(1, men)) * 110 + (enemyShare > 0.62 ? 4 : 0) - (enemyShare < 0.4 ? 2 : 0);
        a.morale = G.clamp(a.morale, 0, 100);
        // 指揮官の危険
        const c = G.P(a.cmd);
        if (c && c.alive && G.rng.chance((enemyShare > 0.55 ? 0.022 : 0.006) * (G.hasTrait(c, 'brave') ? 1.6 : 1) * (c.role === 'hero' ? 0.6 : 1))) {
          if (c.blessed > G.S.day) { c.blessed = 0; War.blog(b, `${G.pname(c)}に矢が迫った——が、見えない光が矢をそらした。`, 'miracle'); G.remember(c, `${b.name}で、ありえない幸運に命を救われた。`, 'miracle'); c.piety = Math.min(100, c.piety + 12); continue; }
          const foe = b.s[1 - si];
          const killerArmy = G.A(foe.armies[0]), killer = killerArmy && G.P(killerArmy.cmd);
          War.blog(b, `${G.pname(c)}が討ち死にした！ ${a.name}に動揺が走る。`, 'death');
          a.morale -= 25;
          G.S.stats.deaths++;
          G.People.die(c, `${b.name}で戦死した`, { killerNation: foe.nation, killer: killer && killer.id });
          G.news(`${G.pname(c)}が${b.name}で戦死した。`, { k: 'war', at: b, imp: 3 });
          if (killer) { killer.fame += 15; G.remember(killer, `${b.name}で敵将${G.pname(c)}を討ち取った。`, 'glory', { who: c.id }); }
        }
      }
    },
    // 戦場の様子を言葉にする(数字だけで終わらせない)
    story(b, share0) {
      const rng = G.rng; if (!rng.chance(b.important ? 0.75 : 0.35)) return;
      const si = share0 > 0.5 ? 0 : 1, s = b.s[si], o = b.s[1 - si];
      const a = G.A(s.armies[0]), e = G.A(o.armies[0]); if (!a || !e) return;
      const c = G.P(a.cmd), ec = G.P(e.cmd);
      const lines = [];
      if (c && c.role === 'hero') lines.push(`英雄${c.name}が先頭に立ち、${e.name}の隊列を切り裂いた。`);
      if (c && G.hasTrait(c, 'cunning')) lines.push(`${G.pname(c)}は森に伏兵を置いていた。${e.name}の側面がくずれる。`);
      if (c && G.hasTrait(c, 'brave')) lines.push(`${G.pname(c)}がみずから突撃し、兵たちがそれに続いた。`);
      if (a.comp.cav > 17) lines.push(`${a.name}の騎兵が丘をかけおり、敵の弓兵を蹴散らした。`);
      if (a.comp.mag > 10) lines.push(`${a.name}の魔術師たちが炎の雨を降らせた。`);
      if (ec && G.hasTrait(ec, 'coward')) lines.push(`${G.pname(ec)}は後方に下がり、前線の兵たちは指揮を失った。`);
      lines.push(`${e.name}の前列が押しこまれ、じりじりと後退していく。`);
      lines.push(`日が暮れても戦いは続いた。${G.nname(G.N(o.nation))}の兵の顔に疲れが見える。`);
      if (b.weather === 'rain') lines.push('雨で地面がぬかるみ、騎兵が思うように動けない。');
      War.blog(b, rng.pick(lines), 'turn');
    },
    endBattle(b, winner, how) {
      if (b.over) return;
      b.over = G.S.day; b.winner = winner;
      const w = G.Nations.warBetween(b.s[0].nation, b.s[1].nation);
      const dead = Math.round(b.s[0].cas + b.s[1].cas);
      if (w) w.deaths += dead;
      if (winner == null) {
        const line = `${b.name}は決着がつかず、両軍は兵を引いた(死傷 ${G.fmt(dead)})。`;
        War.blog(b, line, 'end'); G.news(line, { k: 'war', at: b, inc: w && w.inc });
        if (w && w.inc) G.Story.beat(G.I(w.inc), line, { at: b });
        for (const s of b.s) for (const id of s.armies) { const a = G.A(id); if (a) { a.battle = null; a.state = 'idle'; if (s === b.s[0]) War.goHome(a); } }
        return;
      }
      const W = b.s[winner], L = b.s[1 - winner];
      const wa = G.A(W.armies[0]), la = G.A(L.armies[0]);
      const wc = wa && G.P(wa.cmd), lc = la && G.P(la.cmd);
      for (const id of W.armies) { const a = G.A(id); if (!a) continue; a.battle = null; a.state = 'idle'; a.morale = Math.min(95, a.morale + 15); a.kills += L.cas; const gc = G.C(a.goal); if (gc && ['attack', 'relief'].includes(a.mission) && gc.owner !== a.nation) War.go(a, gc.x, gc.y, 'attack', gc.id); }
      for (const id of L.armies) {
        const a = G.A(id); if (!a) continue;
        a.battle = null; a.men *= 0.88; a.morale = Math.max(10, a.morale - 10);
        if (a.men < 250) { War.disband(a, '壊滅'); continue; }
        War.retreat(a);
      }
      const wn = G.N(W.nation), ln = G.N(L.nation);
      let line = `${b.name}は${G.nname(wn)}の勝利に終わった。${la ? la.name : '敵軍'}は${how === 'rout' ? '総崩れになって' : ''}退却した。(死傷 ${G.fmt(dead)})`;
      if (b.city) { const c = G.C(b.city); line = `${c.name}の攻防は${G.nname(wn)}の勝利。` + (c.owner === W.nation ? '包囲は破られた。' : '城門が開くのは時間の問題だ。'); }
      War.blog(b, line, 'end');
      G.news(line, { k: 'war', at: b, imp: b.important ? 3 : 2, inc: w && w.inc });
      if (w && w.inc) G.Story.beat(G.I(w.inc), line, { at: b, battle: b.id });
      if (wc) { wc.fame += b.important ? 14 : 6; wc.conf = Math.min(100, wc.conf + 8); G.remember(wc, `${b.name}で${G.nname(ln)}軍を破った。`, 'glory', { nation: ln && ln.id }); }
      if (lc && lc.alive) { lc.fear += 10; G.remember(lc, `${b.name}で${G.nname(wn)}軍に敗れた。`, 'defeat', { nation: wn.id }); if (wc) G.addRel(lc, wc, 'rival', -20); }
      if (wn) wn.weary = Math.min(100, wn.weary + 1 + W.cas / 800);
      if (ln) ln.weary = Math.min(100, ln.weary + 4 + L.cas / 500);
      // 信仰: 戦いの恐れは祈りを生む
      G.Goddess.prayers(W.nation, 2); G.Goddess.prayers(L.nation, 4);
      G.Story.afterBattle(b, W, L);
      G.emit('battleEnd', b);
    },
    retreat(a) {
      const c = War.nearestOwn(a);
      a.morale = Math.max(a.morale, 20);
      if (c && War.go(a, c.x, c.y, 'retreat', c.id)) return;
      War.disband(a, '退路なし');
    },
    // ---- 包囲 ----
    startSiege(c, a) {
      if (c.siege) { if (!c.siege.armies.includes(a.id)) c.siege.armies.push(a.id); a.state = 'siege'; return; }
      c.siege = { armies: [a.id], start: G.S.day, by: a.nation, day: 0 };
      a.state = 'siege';
      const n = G.N(c.owner), w = G.Nations.warBetween(a.nation, c.owner);
      const line = `${a.name}が${G.nname(n)}の${c.name}を包囲した。`;
      G.news(line, { k: 'war', at: c, imp: n && n.capital === c.id ? 3 : 2, inc: w && w.inc });
      if (w && w.inc) G.Story.beat(G.I(w.inc), line, { at: c });
      if (n && n.capital === c.id) G.focus(c.x, c.y, `${c.name}包囲`, { k: 'siege' });
      G.fx('siege', c.x, c.y, { days: 9999, city: c.id });
    },
    siegeDay(c) {
      const sg = c.siege, list = sg.armies.map(G.A).filter(a => a && a.state === 'siege' && a.nation === sg.by);
      if (!list.length || !G.atWar(sg.by, c.owner)) { c.siege = null; for (const a of list) a.state = 'idle'; return; }
      sg.day++;
      const atk = G.sum(list, a => a.men * a.q * (0.4 + a.morale / 100));
      const def = c.garrison * (1 + c.walls / 55) * (c.ward > G.S.day ? 1.6 : 1) * G.RACES[c.race].power;
      c.walls = Math.max(0, c.walls - atk / (c.garrison + 1400) * 0.28);
      c.garrison = Math.max(0, c.garrison - atk * 0.0016);
      for (const a of list) { a.men *= 0.9975; a.supply = Math.max(0, a.supply - 0.9); if (a.supply < 15) a.morale -= 0.6; }
      const rng = G.rng;
      if (sg.day % 9 === 0 && rng.chance(0.6)) {
        const msg = rng.pick([`${c.name}の包囲${sg.day}日目。城壁にひびが入りはじめた。`, `${c.name}では食料が減り、人々が神殿に集まって祈っている。`, `${c.name}の守備兵が夜にうって出たが、押し返された。`, `包囲された${c.name}から、救援を求める使者が走った。`]);
        const w = G.Nations.warBetween(sg.by, c.owner); if (w && w.inc) G.Story.beat(G.I(w.inc), msg, { at: c, minor: true });
      }
      if (c.walls <= 6 || c.garrison < G.sum(list, a => a.men) * 0.06 || sg.day > 110) {
        if (atk > def * 0.9) War.capture(c, list[0]);
        else if (sg.day > 110) { for (const a of list) { a.morale -= 25; War.retreat(a); } c.siege = null; G.news(`${c.name}は長い包囲に耐えぬいた。敵軍は撤退した。`, { k: 'war', at: c, imp: 2 }); }
      }
    },
    capture(c, a) {
      const old = G.N(c.owner), n = G.N(a.nation);
      if (!old || !n) return;
      const w = G.Nations.warBetween(a.nation, old.id);
      c.siege = null; c.owner = n.id; c.garrison = Math.min(a.men * 0.12, 1500); a.men -= c.garrison;
      c.pop *= 0.88; c.unrest = c.race !== n.race ? 70 : 45; c.burn = 30; c.walls = Math.max(c.walls, 15);
      if (!c.home) c.home = old.id;
      c.lostY = G.Y();
      G.S.stats.captured++;
      if (w) w.taken.push(c.id);
      for (const s of G.armies()) if (s.nation === n.id && s.state === 'siege' && s.goal === c.id) { s.state = 'idle'; s.mission = 'idle'; }
      const wasCap = old.capital === c.id;
      const line = wasCap ? `${G.nname(old)}の首都${c.name}が陥落した！` : `${c.name}が${G.nname(n)}に占領された。`;
      G.news(line, { k: 'war', at: c, imp: wasCap ? 3 : 2, inc: w && w.inc });
      if (w && w.inc) G.Story.beat(G.I(w.inc), line, { at: c, captured: c.id });
      G.fx('fire', c.x, c.y, { days: 30 });
      G.focus(c.x, c.y, line, { k: 'capture' });
      G.World.refresh(); G.Nations.recomputeBorders();
      // 町にいた人々
      for (const p of G.chars()) {
        if (p.city !== c.id || p.armyId) continue;
        if (p.nation === old.id) {
          if (G.rng.chance(p.role === 'ruler' ? 0.35 : 0.2)) { G.People.die(p, `${c.name}の陥落で命を落とした`, { killerNation: n.id, killer: a.cmd }); }
          else p.city = old.capital !== c.id ? old.capital : null;
        }
      }
      const cmd = G.P(a.cmd); if (cmd) { cmd.fame += wasCap ? 25 : 8; G.remember(cmd, `${c.name}を攻め落とした。`, 'glory'); }
      G.Goddess.prayers(old.id, 6);
      if (wasCap) {
        const rest = old.cities.map(G.C).filter(x => x && x.owner === old.id);
        if (rest.length) { old.capital = rest.sort((x, y) => y.pop - x.pop)[0].id; G.news(`${G.nname(old)}は${G.C(old.capital).name}に都を移した。`, { k: 'politics', at: G.C(old.capital) }); old.stability -= 20; }
      }
      if (!old.cities.length) G.Nations.destroy(old, n, '最後の町を失った');
      G.Story.afterCapture(c, n, old, a);
    },

    // ---- 軍の考え(毎月・ひまなとき) ----
    plan() {
      for (const a of G.armies()) {
        if (['battle', 'siege', 'retreat'].includes(a.state)) continue;
        if (a.state === 'march' && a.mission !== 'home' && G.rng.chance(0.75)) continue;
        const n = G.N(a.nation); if (!n) { War.disband(a); continue; }
        if (a.men < a.max * 0.35 || a.morale < 25) { const c = War.nearestOwn(a); if (c && G.dist(a, c) > 1.5) War.go(a, c.x, c.y, 'home', c.id); continue; }
        const enemies = G.enemiesOf(n);
        if (!enemies.length) {
          // 平和: 国境の町か首都で待機。長い平和なら解散
          if (G.armies().filter(x => x.nation === n.id).length > 1 && n.weary < 5 && G.rng.chance(0.08)) { War.disband(a, '平和'); continue; }
          if (a.state === 'idle') {
            const tense = G.Nations.neighbors(n).filter(m => G.rel(n.id, m.id).tension > 55);
            const c = tense.length ? G.Nations.frontCity(n, tense) : G.C(n.capital);
            if (c && G.dist(a, c) > 2) War.go(a, c.x, c.y, 'home', c.id);
          }
          continue;
        }
        // 自分の町が包囲されていたら救援
        let relief = null, rd = 1e9;
        for (const cid of n.cities) { const c = G.C(cid); if (c.siege) { const d = G.dist(c, a); if (d < rd && d < 40) { rd = d; relief = c; } } }
        if (relief) { if (a.goal !== relief.id) { if (War.go(a, relief.x, relief.y, 'relief', relief.id)) G.news(`${a.name}が${relief.name}の救援に向かった。`, { k: 'war', at: a }); } continue; }
        // 近くの敵軍を迎えうつ
        let foe = null, fd = 1e9;
        for (const e of G.armies()) if (War.hostile(a, e)) { const near = n.cities.some(cid => G.dist(G.C(cid), e) < 9); const d = G.dist(a, e); if (near && d < fd && d < 25) { fd = d; foe = e; } }
        if (foe && a.men > foe.men * 0.6) { War.go(a, foe.x, foe.y, 'hunt', null); a.hunt = foe.id; continue; }
        // 敵の町を攻める
        let best = null, bs = -1e9;
        for (const e of enemies) for (const cid of e.cities) {
          const c = G.C(cid);
          const d = G.dist(a, c);
          let s = -d * 1.1 - c.garrison / 250 - c.walls * 0.08 + (c.home === n.id ? 18 : 0) + (e.capital === c.id && a.men > 5000 ? 8 : 0);
          if (G.World.neighborsOfCity(c).some(o => o.owner === n.id)) s += 12;
          if (c.siege && c.siege.by === n.id) s += 10;
          if (s > bs) { bs = s; best = c; }
        }
        if (best && a.goal !== best.id) War.go(a, best.x, best.y, 'attack', best.id);
      }
    }
  };
  G.fmt = n => { n = Math.round(n); return n >= 10000 ? (n / 10000).toFixed(1) + '万' : n.toLocaleString('ja-JP'); };
  G.War = War;
})(globalThis.GD = globalThis.GD || {});
