// 外交: 関係の変化・条約・宣戦布告・和平
(function (G) {
  const W = G.World, P = G.Personality;

  function sideNames(ids) { return ids.map(id => W.nationName(id)).join('・'); }

  const D = {
    relationBase(n, m) {
      let b = (G.RACE_AFFINITY[n.race] || {})[m.race] || 0;
      const rn = W.S.religions[n.religion], rm = W.S.religions[m.religion];
      if (n.religion === m.religion) b += 12; else b -= 8;
      if (rn && rm && ((rn.goddess && rm.anti) || (rn.anti && rm.goddess))) b -= 15;
      if (W.neighbors(n.id).includes(m.id)) b -= 8;
      const rl = W.liveChar(n.ruler);
      if (rl) {
        if (P.has(rl, 'gentle')) b += 8;
        if (P.has(rl, 'cruel')) b -= 8;
        if (P.has(rl, 'wise')) b += 4;
        b += (rl.raceAtt[m.race] || 0) * 0.35;
        const ml = W.liveChar(m.ruler);
        if (ml) { const r = rl.rel[ml.id]; if (r) b += r.a * 0.2 - r.h * 0.3; }
      }
      if (n.goal === 'peace') b += 10;
      if (n.goal === 'domination' && n.race !== m.race) b -= 15;
      const r = W.rel(n.id, m.id);
      if (r.trade) b += 5; if (r.alliance) b += 8; if (r.marriage) b += 6;
      b -= (r.grudge || 0) * 0.4;
      return b;
    },

    yearly(n) {
      const rng = W.rng;
      if (!n.alive) return;
      const others = W.aliveNations().filter(m => m.id !== n.id);
      const nb = W.neighbors(n.id);
      for (const m of others) {
        const r = W.rel(n.id, m.id);
        if (W.atWar(n.id, m.id)) { r.v = Math.max(-100, r.v - 3); continue; }
        const base = D.relationBase(n, m);
        r.v = G.clamp(r.v + (base - r.v) * 0.09 + rng.gauss(0, 3), -100, 100);
        r.grudge = Math.max(0, (r.grudge || 0) - 1.5);
        // 条約
        if (!r.trade && r.v > 15 && rng.chance(0.3)) { r.trade = true; W.log('politics', '貿易協定', `${n.name}と${m.name}が貿易協定を結んだ。`, { n: [n.id, m.id], imp: 1 }); }
        if (r.trade && r.v < -15) { r.trade = false; W.log('politics', '貿易の停止', `${n.name}と${m.name}の貿易が止まった。`, { n: [n.id, m.id], imp: 1 }); }
        if (!r.nap && r.v > 5 && nb.includes(m.id) && rng.chance(0.25)) { r.nap = true; W.log('politics', '不可侵条約', `${n.name}と${m.name}が不可侵条約を結んだ。`, { n: [n.id, m.id], imp: 1 }); }
        if (r.nap && r.v < -25) { r.nap = false; W.log('politics', '不可侵条約の破棄', `${n.name}は${m.name}との不可侵条約を破棄した。`, { n: [n.id, m.id], imp: 1 }); }
        if (!r.alliance && r.v > 48 && rng.chance(0.3)) {
          r.alliance = true;
          W.log('politics', '同盟の締結', `${n.name}と${m.name}が同盟を結んだ。`, { n: [n.id, m.id], imp: 2 });
        }
        if (r.alliance && r.v < 15) { r.alliance = false; W.log('politics', '同盟の解消', `${n.name}と${m.name}の同盟が解消された。`, { n: [n.id, m.id], imp: 2 }); }
      }
      D.considerWar(n, others, nb);
    },

    sidePower(ids) { return ids.reduce((s, id) => s + G.Nations.power(id), 0); },
    alliesOf(id) {
      return W.aliveNations().filter(m => m.id !== id && W.rel(id, m.id).alliance).map(m => m.id);
    },

    considerWar(n, others, nb) {
      const rng = W.rng;
      if (n.stability < 22 || W.warsOf(n.id).filter(w => w.att.includes(n.id) || w.def.includes(n.id)).length >= 2) return;
      const ruler = W.liveChar(n.ruler);
      const myP = G.Nations.power(n.id) + D.alliesOf(n.id).reduce((s, id) => s + G.Nations.power(id) * 0.5, 0);
      let best = null, bestD = 0;
      for (const m of others) {
        if (!nb.includes(m.id)) continue;
        const r = W.rel(n.id, m.id);
        if (r.alliance || r.truce > W.S.day || W.atWar(n.id, m.id)) continue;
        const theirP = G.Nations.power(m.id) + D.alliesOf(m.id).reduce((s, id) => s + G.Nations.power(id) * 0.6, 0);
        const ratio = myP / Math.max(1, theirP);
        let d = -r.v / 100 * 0.7 + G.GOALS[n.goal].war + P.warlike(ruler) + G.clamp((ratio - 1) * 0.3, -0.5, 0.45) - n.weariness / 90 + (r.grudge || 0) / 120;
        if (r.nap) d -= 0.25;
        if (n.goal === 'domination' && m.race !== n.race) d += 0.15;
        if (n.goal === 'religion' && m.religion !== n.religion) d += 0.1;
        if (ratio < 0.6) d -= 0.4;
        if (d > bestD) { bestD = d; best = m; }
      }
      if (best && bestD > 0.3 && rng.chance((bestD - 0.3) * 0.55)) {
        const r = W.rel(n.id, best.id);
        let cause = '領土拡大';
        if ((n.race === 'human' && best.race === 'demon') || (n.race === 'demon' && best.race === 'human')) cause = '人魔の宿怨';
        else if (n.goal === 'domination' && best.race !== n.race) cause = '他種族の支配';
        else if (n.goal === 'religion' && best.religion !== n.religion) cause = '聖戦';
        else if ((r.grudge || 0) > 25) cause = '過去の戦争への復讐';
        else if (ruler && P.has(ruler, 'greedy')) cause = '豊かな土地をねらって';
        D.startWar([n.id], [best.id], cause);
      }
    },

    startWar(att, def, cause, silent) {
      const S = W.S;
      // 同盟国が参戦
      const defAllies = [], attAllies = [];
      for (const d of def) for (const a of D.alliesOf(d)) {
        if (att.includes(a) || def.includes(a) || defAllies.includes(a)) continue;
        if (W.rng.chance(0.7) && !att.some(x => W.rel(x, a).alliance)) defAllies.push(a);
      }
      for (const a0 of att) for (const a of D.alliesOf(a0)) {
        if (att.includes(a) || def.includes(a) || defAllies.includes(a) || attAllies.includes(a)) continue;
        if (W.rng.chance(0.35) && !def.some(x => W.rel(x, a).alliance)) attAllies.push(a);
      }
      att = att.concat(attAllies); def = def.concat(defAllies);
      const a0 = W.nation(att[0]), d0 = W.nation(def[0]);
      let name;
      const rk = [a0.race, d0.race].sort().join('|');
      S.warCount[rk] = (S.warCount[rk] || 0) + 1;
      const kanji = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
      if (rk === 'demon|human') name = `第${kanji[Math.min(9, S.warCount[rk] - 1)]}次人魔大戦`;
      else if (cause === '王位継承争い' || cause === '反乱の鎮圧') name = `${d0.short}・${a0.short}の内乱`;
      else name = `${a0.short}・${d0.short}戦争`;
      const w = { id: W.newId(), name, att, def, cause, start: S.day, attScore: 0, defScore: 0, battles: 0, attLoss: 0, defLoss: 0, ended: false };
      S.wars[w.id] = w;
      for (const a of att) for (const d of def) {
        const r = W.rel(a, d);
        r.v = Math.min(r.v, -40); r.trade = false; r.nap = false; r.alliance = false;
      }
      const cap = W.capitalOf(def[0]);
      W.log('war', `${name}の勃発`, `${sideNames(att)}が「${cause}」を理由に${sideNames(def)}へ宣戦布告した。${defAllies.length ? sideNames(defAllies) + 'が同盟国として参戦した。' : ''}${attAllies.length ? sideNames(attAllies) + 'も攻める側に加わった。' : ''}`, { n: att.concat(def), x: cap && cap.x, y: cap && cap.y, imp: 3 });
      return w;
    },

    endWar(w, reason, winnerId) {
      if (w.ended) return;
      const S = W.S;
      w.ended = true; w.endDay = S.day;
      let result;
      if (winnerId != null && w.att.includes(winnerId)) result = 'att';
      else if (winnerId != null && w.def.includes(winnerId)) result = 'def';
      else result = w.attScore - w.defScore > 25 ? 'att' : (w.defScore - w.attScore > 25 ? 'def' : 'draw');
      w.result = result;
      const truceDays = 360 * W.rng.int(8, 15);
      for (const a of w.att) for (const d of w.def) {
        const r = W.rel(a, d); r.truce = S.day + truceDays; r.v = Math.max(r.v, -25); r.grudge = (r.grudge || 0) + 30;
      }
      for (const id of w.att.concat(w.def)) {
        const n = W.nation(id); if (!n) continue;
        if ((result === 'att' && w.att.includes(id)) || (result === 'def' && w.def.includes(id))) n.warsWon++;
        else if (result !== 'draw') n.warsLost++;
      }
      // 戦場から軍を引きあげる
      for (const aid in S.armies) {
        const a = S.armies[aid];
        if (w.att.includes(a.nation) || w.def.includes(a.nation)) if (!W.enemiesOf(a.nation).length) G.Armies.sendHome(a);
      }
      const txt = result === 'draw' ? '決着がつかないまま和平が結ばれた。' : `${sideNames(result === 'att' ? w.att : w.def)}の勝利に終わった。`;
      W.log('war', `${w.name}の終結`, `${reason ? reason + '、' : ''}${Math.max(1, Math.round((S.day - w.start) / 360))}年続いた${w.name}は${txt}(戦死者 約${G.fmt(w.attLoss + w.defLoss)}人)`, { n: w.att.concat(w.def), imp: 3 });
    },

    monthlyWars() {
      const S = W.S, rng = W.rng;
      for (const id in S.wars) {
        const w = S.wars[id];
        if (w.ended) continue;
        w.att = w.att.filter(x => W.nation(x) && W.nation(x).alive);
        w.def = w.def.filter(x => W.nation(x) && W.nation(x).alive);
        if (!w.att.length || !w.def.length) { D.endWar(w, '相手がいなくなったため'); continue; }
        const months = (S.day - w.start) / 30;
        for (const nid of w.att.concat(w.def)) { const n = W.nation(nid); n.weariness = Math.min(100, n.weariness + 1.1); }
        if (months < 8) continue;
        const diff = w.attScore - w.defScore;
        const wear = (W.nation(w.att[0]).weariness + W.nation(w.def[0]).weariness) / 2;
        const p = 0.02 + Math.abs(diff) * 0.0016 + wear / 2600 + (months > 60 ? 0.03 : 0);
        if (rng.chance(p)) {
          // 勝った側は追加で都市をもらうことがある(領土割譲)
          if (Math.abs(diff) > 45) {
            const winner = diff > 0 ? w.att[0] : w.def[0], loser = diff > 0 ? w.def[0] : w.att[0];
            const lc = W.citiesOf(loser).filter(c => c.id !== W.nation(loser).capital && G.Map.W.cityAdj[c.id].some(j => W.S.cities[j].owner === winner));
            if (lc.length) {
              const c = rng.pick(lc);
              G.Nations.giveCity(c, winner);
              c.conquered = S.day;
              W.log('war', '領土の割譲', `和平の条件として、${W.nationName(loser)}は${c.name}を${W.nationName(winner)}にゆずった。`, { n: [winner, loser], x: c.x, y: c.y, imp: 2 });
            }
          }
          D.endWar(w, '和平交渉がまとまり');
        }
      }
    }
  };
  G.Diplomacy = D;
})(globalThis.GD = globalThis.GD || {});
