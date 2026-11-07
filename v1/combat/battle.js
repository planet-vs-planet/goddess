// 戦闘の計算: 兵の数だけでなく、指揮官・士気・補給・地形・季節・相性・技術・魔法で決まる
(function (G) {
  const W = G.World, C = G.Chars, P = G.Personality;

  function classShares(armies) {
    const s = {}; let tot = 0;
    for (const a of armies) for (const k in a.troops) { const u = G.UNIT_BY_KEY[k]; s[u.cls] = (s[u.cls] || 0) + a.troops[k]; tot += a.troops[k]; }
    for (const k in s) s[k] /= tot || 1;
    return s;
  }

  const B = {
    armyPower(a, enemies, estimate) {
      const n = W.nation(a.nation);
      const eShares = enemies ? classShares(enemies) : null;
      let p = 0;
      for (const k in a.troops) {
        const u = G.UNIT_BY_KEY[k], cnt = a.troops[k];
        let m = 1;
        if (eShares) { const adv = G.CLASS_ADV[u.cls] || {}; for (const cl in adv) m += (adv[cl] - 1) * (eShares[cl] || 0); }
        p += cnt * (u.atk * 0.6 + u.def * 0.4) * m;
      }
      const cmd = W.liveChar(a.cmd);
      if (cmd) {
        p *= 1 + (cmd.st.war - 50) / 120 + (cmd.st.int - 50) / 260;
        if (cmd.role === 'hero') p *= 1.12;
        if (cmd.blessed) p *= 1.12;
        if (cmd.item) p *= 1.1;
      } else p *= 0.85;
      if (estimate) return p * (n ? 1 + n.tech * 0.04 : 1);
      p *= (0.35 + 0.65 * a.morale) * (0.5 + 0.5 * a.supply);
      if (n) p *= 1 + n.tech * 0.04;
      if (n && G.RACES[n.race].magic > 1.2) p *= 1 + (G.RACES[n.race].magic - 1) * 0.15;
      if (n && G.Factions && n.side === 'h') { const al = G.Factions.nationsOf('h').map(x => x.race); if (al.includes('elf')) p *= 1.04; if (al.includes('dwarf')) p *= 1.04; }
      const season = W.season();
      if (season === '冬' && n && n.race !== 'dwarf' && n.race !== 'dragon') p *= 0.88;
      if (a.buff && a.buff.until > W.S.day) p *= a.buff.mult;
      if (G.Factions && a.nation !== -1) for (const b of G.Factions.buffsOf(G.Factions.side(a.nation))) p *= b.mult;
      return p;
    },

    // 近くの敵どうしで戦闘を始める
    detect() {
      const S = W.S;
      const list = Object.values(S.armies);
      for (let i = 0; i < list.length; i++) {
        const a = list[i]; if (a.battle) continue;
        for (let j = 0; j < list.length; j++) {
          const b = list[j]; if (i === j || a.battle && a.battle === b.battle) continue;
          if (!W.atWar(a.nation, b.nation)) continue;
          if (Math.abs(a.x - b.x) > 1.4 || Math.abs(a.y - b.y) > 1.4) continue;
          if (b.battle) { // すでに戦っている所へ援軍
            const bt = S.battles[b.battle];
            if (!bt) continue;
            const side = bt.a.includes(b.id) ? 'b' : 'a';
            bt[side].push(a.id); a.battle = bt.id; a.state = 'battle';
            if (W.rng.chance(0.5)) W.log('war', '援軍の到着', `${W.nationName(a.nation)}の援軍が${bt.name}に到着した。`, { n: [a.nation], x: bt.x, y: bt.y, imp: 1 });
            break;
          }
          if (a.battle) break;
          B.start(a, b);
          break;
        }
      }
    },

    start(a, b) {
      const S = W.S;
      const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      const ri = G.Map.W.region[G.Map.idx(x | 0, y | 0)];
      const place = ri >= 0 ? S.cities[ri].name : '荒野';
      const bt = { id: W.newId(), name: `${place}の戦い`, a: [a.id], b: [b.id], x, y, start: S.day, initA: a.total, initB: b.total, lossA: 0, lossB: 0, owner: ri >= 0 ? S.cities[ri].owner : null };
      S.battles[bt.id] = bt;
      a.battle = b.battle = bt.id; a.state = b.state = 'battle';
      // 奇襲
      const ca = W.liveChar(a.cmd);
      if (ca && (P.has(ca, 'cunning') || ca.st.int > 75) && W.rng.chance(0.3)) {
        bt.surprise = 'a';
        W.log('war', '奇襲の成功', `${ca.name}率いる${W.nationName(a.nation)}軍が奇襲をしかけた!`, { n: [a.nation, b.nation], c: [ca.id], x, y, imp: 1 });
      }
      W.effect('clash', x, y);
    },

    daily() {
      const S = W.S, rng = W.rng;
      for (const id in S.battles) {
        const bt = S.battles[id];
        const A = bt.a.map(i => S.armies[i]).filter(Boolean), Bs = bt.b.map(i => S.armies[i]).filter(Boolean);
        bt.a = A.map(x => x.id); bt.b = Bs.map(x => x.id);
        if (!A.length || !Bs.length) { B.finish(bt, A.length ? 'a' : 'b'); continue; }
        const ter = G.Map.terrainAt(bt.x, bt.y);
        const ownerA = A[0].nation === bt.owner, ownerB = Bs[0].nation === bt.owner;
        let pA = A.reduce((s, x) => s + B.armyPower(x, Bs), 0) * (ownerA ? 1 + ter.def : 1);
        let pB = Bs.reduce((s, x) => s + B.armyPower(x, A), 0) * (ownerB ? 1 + ter.def : 1);
        if (S.day - bt.start < 2) { if (bt.surprise === 'a') pA *= 1.45; if (bt.surprise === 'b') pB *= 1.45; }
        const lossB = pA * 0.028 * rng.range(0.8, 1.2), lossA = pB * 0.028 * rng.range(0.8, 1.2);
        B.applyLoss(A, lossA, bt, 'a'); B.applyLoss(Bs, lossB, bt, 'b');
        const totA = A.reduce((s, x) => s + x.total, 0), totB = Bs.reduce((s, x) => s + x.total, 0);
        const morA = A.reduce((s, x) => s + x.morale * x.total, 0) / Math.max(1, totA);
        const morB = Bs.reduce((s, x) => s + x.morale * x.total, 0) / Math.max(1, totB);
        // 指揮官の戦死
        for (const [side, list, mor] of [['a', A, morA], ['b', Bs, morB]]) {
          for (const ar of list) {
            const c = W.liveChar(ar.cmd);
            if (c && rng.chance((P.has(c, 'brave') ? 0.004 : 0.002) * (mor < 0.5 ? 2 : 1))) {
              const enemy = (side === 'a' ? Bs : A)[0];
              const en = W.nation(enemy.nation);
              W.log('war', '指揮官の戦死', `${bt.name}で、${W.nationName(ar.nation)}の${c.name}が戦死した。`, { n: [ar.nation], c: [c.id], x: bt.x, y: bt.y, imp: c.role === 'ruler' ? 3 : 2, memory: false });
              C.kill(c, `${bt.name}で戦死`, { charId: enemy.cmd, race: en ? en.race : null });
              ar.morale = Math.max(0, ar.morale - 0.25);
            }
          }
        }
        const endA = morA < 0.22 || totA < bt.initA * 0.22, endB = morB < 0.22 || totB < bt.initB * 0.22;
        if (endA || endB || S.day - bt.start > 40) {
          let win = endA && !endB ? 'b' : endB && !endA ? 'a' : (totA * morA > totB * morB ? 'a' : 'b');
          B.finish(bt, win);
        }
      }
    },

    applyLoss(list, loss, bt, side) {
      const tot = list.reduce((s, x) => s + x.total, 0);
      if (tot <= 0) return;
      for (const a of list) {
        const share = loss * (a.total / tot);
        let killed = 0;
        for (const k in a.troops) {
          const u = G.UNIT_BY_KEY[k];
          const l = Math.min(a.troops[k], share * (a.troops[k] / a.total) / Math.max(0.6, u.def));
          a.troops[k] -= l; killed += l;
          if (a.troops[k] < 1) delete a.troops[k];
        }
        G.Armies.recount(a);
        a.morale = Math.max(0, a.morale - killed / Math.max(1, a.start) * 1.15);
        if (side === 'a') bt.lossA += killed; else bt.lossB += killed;
        G.Armies.casualties(a, killed);
      }
    },

    finish(bt, win) {
      const S = W.S;
      delete S.battles[bt.id];
      const winners = bt[win].map(i => S.armies[i]).filter(Boolean);
      const losers = bt[win === 'a' ? 'b' : 'a'].map(i => S.armies[i]).filter(Boolean);
      for (const a of winners) { a.battle = null; a.state = 'idle'; a.morale = Math.min(1, a.morale + 0.15); const c = W.liveChar(a.cmd); if (c) { c.fame += 6; c.kills++; } }
      const wn = winners[0] ? winners[0].nation : null, ln = losers[0] ? losers[0].nation : null;
      // 寝返り
      for (const a of losers) {
        a.battle = null;
        const c = W.liveChar(a.cmd);
        if (c && wn != null && wn !== -1 && a.nation !== -1 && P.treachery(c) > 0.62 && W.rng.chance(0.18)) {
          const from = a.nation;
          a.nation = wn; c.nation = wn; c.st.loy = 40; a.morale = 0.6; a.state = 'idle';
          W.log('war', '将軍の寝返り', `敗れた${W.nationName(from)}の${c.name}は、軍ごと${W.nationName(wn)}に寝返った。`, { n: [from, wn], c: [c.id], x: bt.x, y: bt.y, imp: 2 });
          continue;
        }
        if (a.total < 60) { G.Armies.remove(a); continue; }
        G.Armies.sendHome(a, true);
      }
      const lossW = win === 'a' ? bt.lossA : bt.lossB, lossL = win === 'a' ? bt.lossB : bt.lossA;
      if (G.Factions && wn != null && wn !== -1 && lossW + lossL > 40) G.Factions.onBattle(G.Factions.side(wn), lossW, lossL);
      const big = bt.initA + bt.initB > 3000;
      // 戦争の点数
      for (const wid in S.wars) {
        const w = S.wars[wid]; if (w.ended) continue;
        const inA = wn != null && w.att.includes(wn), inD = wn != null && w.def.includes(wn);
        if ((inA && w.def.includes(ln)) || (inD && w.att.includes(ln))) {
          if (inA) w.attScore += big ? 10 : 6; else w.defScore += big ? 10 : 6;
          w.battles++;
          if (w.att.includes(wn)) { w.defLoss += lossL; w.attLoss += lossW; } else { w.attLoss += lossL; w.defLoss += lossW; }
        }
      }
      if (lossW + lossL > 150) {
        W.log('war', bt.name, `${W.nationName(wn)}軍が${W.nationName(ln)}軍を破った。(損害 ${G.fmt(lossW)} 対 ${G.fmt(lossL)})`, { n: [wn, ln], x: bt.x, y: bt.y, imp: big ? 2 : 1, c: winners.map(a => a.cmd).filter(x => x != null) });
      }
      W.effect('victory', bt.x, bt.y, { color: wn != null && W.nation(wn) ? W.nation(wn).color : 0xffffff });
    }
  };
  G.Battle = B;
})(globalThis.GD = globalThis.GD || {});
