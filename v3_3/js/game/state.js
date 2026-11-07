// ルール(リアルタイム版): 時間は流れつづけ、3つの戦線はずっと戦う。カードはいつでも使える(信仰+待ち時間)。
// 時間の単位は「月」。画面側が 1か月 = MS秒 で進める。
(function (G) {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.clamp = clamp;
  const GOAL = 60, FAITH_GOAL = 1050, MS = 10;
  // カードの待ち時間(か月)
  const CD = { light: 0.3, rally: 0.3, sword: 0.3, angels: 2, horde: 0.3, empower: 0.3, hatred: 0.3, awaken: 2, storm: 0.6, move: 0.2, forget: 0.5, sabotage: 0, smite: 1 };
  // 神意: 1回の介入に使う集中力。最大3。1か月で1回復、ミッション成功で+1
  const FOCUS_MAX = 3, FOCUS_REGEN = 1;
  const FOCUS = { light: 1, rally: 1, sword: 2, angels: 3, horde: 1, empower: 1, hatred: 1, awaken: 3, storm: 2, move: 1, forget: 2, sabotage: 0, smite: 3 };
  const rnd = () => Math.random();

  const Game = {
    S: null, GOAL, FAITH_GOAL, MS, CD, FOCUS, FOCUS_MAX,
    newGame() {
      const chars = {};
      const start = { allen: 'center', serena: 'center', gran: 'center', elmina: 'south', zephyra: 'north', volg: 'south' };
      for (const id of G.KEY_CHARS) {
        const c = G.CHARS[id];
        chars[id] = { id, side: c.side, at: start[id], power: c.power, trust: c.side === 'h' ? 70 : 10, doubt: 0, alive: true, weapon: 0 };
      }
      Game.S = {
        v: 4, time: 0, month: 0, faith: 40, total: 0, thanks: 0, monthFaith: 0,
        fronts: G.FRONTS.map((f, i) => ({ id: f.id, f: [-20, 10, 30][i], h: 100, d: 100, hb: 0, db: 0, castle: { h: true, d: true }, hate: 0, warn: 0 })),
        chars, peace: null, peaceCool: 6, stall: 0, revolt: null, beats: {}, counts: { miracle: 0, whisper: 0, fate: 0 },
        cd: {}, ended: null, used: [], view: 'center', omens: [{ k: 'dReinf', f: 'north', eta: 0.8 }, { k: 'hReinf', f: 'south', eta: 1.3 }],
        grow: { hero: 0, demon: 0, hs: 1, ds: 1 }, support: { h: 0, d: 0 }, route: null, story: null, focus: FOCUS_MAX, mission: null
      };
      if (G.Story) G.Story.plan(Game.S);
      return Game.S;
    },
    front(id) { return Game.S.fronts.find(f => f.id === id); },
    alive() { return Object.values(Game.S.chars).filter(c => c.alive); },
    humans() { return Game.alive().filter(c => c.side === 'h'); },
    charsAt(fid, side) { return Game.alive().filter(c => c.at === fid && (!side || c.side === side)).map(c => c.id); },
    witness(fid, n) { for (const c of Game.alive()) if (c.at === fid && c.side === 'h') c.doubt = clamp(c.doubt + n, 0, 100); Game.S.chars.elmina.doubt = clamp(Game.S.chars.elmina.doubt + 1, 0, 100); },
    power(fr, side) {
      let p = side === 'h' ? fr.h + fr.hb : fr.d + fr.db;
      for (const c of Game.alive()) if (c.at === fr.id && c.side === side) p += c.id === 'allen' && Game.S.allenHurt > Game.S.month ? c.power / 2 : c.power;
      if (!fr.castle[side]) p *= 0.85;
      return Math.max(10, p);
    },
    avgDoubt() { const a = Game.alive(); return a.length ? a.reduce((s, c) => s + c.doubt, 0) / a.length : 0; },
    castles(side) { return Game.S.fronts.filter(f => f.castle[side]).length; },
    chapter() { return Math.min(5, Math.floor(Game.S.month / 12) + 1); },
    dateText(m) { m = m == null ? Game.S.month : m; return `${Math.floor(m / 12) + 1}年目 ${m % 12 + 1}月`; },
    zone(f) {
      if (f > 70) return { t: '城が落ちそう(人族)', k: 'far' }; if (f > 30) return { t: '人族が優勢', k: 'warn' };
      if (f < -70) return { t: '城が落ちそう(魔族)', k: 'far' }; if (f < -30) return { t: '魔族が優勢', k: 'warn' };
      return { t: '拮抗', k: 'good' };
    },

    // ---- 介入 ----
    cardState(card) {
      const S = Game.S;
      if (S.ended) return '物語は終わった';
      if (card.unlock && S.month < card.unlock && !S.tutMode) return `${Math.floor(card.unlock / 12) + 1}年目から`;
      if (card.need && !card.need(S)) return card.needText || '今は使えない';
      if ((S.cd[card.id] || 0) > 0 && !S.tutMode) return `あと${Math.ceil(S.cd[card.id] * MS)}秒`;
      // ミッション中: カードはミッション用の効果になる(対象えらびなし)
      const mfx = G.Mission && G.Mission.cardFx(S, card);
      if (S.mission && !mfx && card.id !== 'sabotage' && card.id !== 'smite') return 'ミッション中は使えない';
      if (mfx) {
        if (Math.floor(S.focus) < mfx.f) return `神意が足りない(${mfx.f}必要)`;
        if (S.faith < card.cost) return '信仰が足りない';
        return null;
      }
      if (!S.tutMode && Math.floor(S.focus) < (FOCUS[card.id] ?? 1)) return `神意が足りない(${FOCUS[card.id] || 1}必要)`;
      if (card.target !== 'none' && !Game.targetsFor(card).length) return '対象がいない';
      if (S.faith < card.cost && !S.tutMode) return '信仰が足りない';
      return null;
    },
    targetsFor(card) {
      if (card.target === 'front') return G.FRONTS.map(f => f.id);
      if (card.target === 'human') return Game.humans().filter(c => !card.need || card.need(Game.S, c)).map(c => c.id);
      if (card.target === 'demon') return Game.alive().filter(c => c.side === 'd').map(c => c.id);
      if (card.target === 'char' || card.target === 'move') return Game.alive().filter(c => !card.need || card.need(Game.S, c)).map(c => c.id);
      return [];
    },
    play(card, target, target2) {
      const S = Game.S;
      const why = Game.cardState(card); if (why) return { ok: false, msg: why };
      const before = Game.snapshot();
      const mfx = G.Mission && G.Mission.cardFx(S, card);
      if (mfx) {
        S.faith -= card.cost; S.focus -= mfx.f; S.cd[card.id] = 0.1;
        G.Mission.play(S, card); S.counts[card.cat]++;
        S.used.push({ card: card.id, name: card.name, target: null, where: S.mission && S.mission.f });
        return { ok: true, before, after: Game.snapshot(), lines: [], where: S.mission && S.mission.f, mfx };
      }
      let t = null, f = null;
      if (card.target === 'front') t = Game.front(target);
      else if (card.target !== 'none') t = S.chars[target];
      if (card.target === 'move') f = target2;
      if (card.target !== 'none' && !t) return { ok: false, msg: '対象をえらんでください' };
      if (card.target === 'move' && !f) return { ok: false, msg: '行き先をえらんでください' };
      if (card.need && !card.need(S, t)) return { ok: false, msg: card.needText || 'その対象には使えない' };
      if (!S.tutMode) { S.faith -= card.cost; S.cd[card.id] = CD[card.id] || 0.5; S.focus -= FOCUS[card.id] ?? 1; }
      card.apply(S, t, f);
      S.counts[card.cat]++;
      const where = card.target === 'front' ? target : (t && t.at) || null;
      S.used.push({ card: card.id, name: card.name, target, where });
      Game.growFromCard(card, t, where);
      const after = Game.snapshot();
      const lines = card.say ? card.say(t, f) : [];
      return { ok: true, before, after, lines, where };
    },
    snapshot() { return Game.S.fronts.map(fr => ({ id: fr.id, h: Game.power(fr, 'h'), d: Game.power(fr, 'd'), f: fr.f })); },

    // ---- 勇者と魔王の成長 ----
    STAGE_POW: [0, 0, 8, 18, 30, 42],
    growFromCard(card, t, where) {
      const S = Game.S, ch = S.chars, g = S.grow;
      const H = { light: 8, rally: 6, sword: 15, angels: 10 }, D = { empower: 8, awaken: 15, horde: 6 };
      g.used = g.used || {};
      const key = card.id + '@' + Game.chapter();
      if ((g.used[key] || 0) >= 2) return; // 同じカードで稼げるのは1章に2回まで
      if (H[card.id]) {
        const near = (t && t.id === 'allen') || where === ch.allen.at;
        Game.addGrow('hero', near ? H[card.id] : Math.round(H[card.id] / 3)); S.support.h += card.unlock || card.id === 'sword' ? 15 : 10; g.used[key] = (g.used[key] || 0) + 1;
      }
      if (D[card.id]) {
        const near = (t && t.id === 'zephyra') || where === ch.zephyra.at || card.id === 'awaken';
        Game.addGrow('demon', near ? D[card.id] : Math.round(D[card.id] / 3)); S.support.d += card.unlock ? 15 : 10; g.used[key] = (g.used[key] || 0) + 1;
      }
    },
    addGrow(k, n) { const g = Game.S.grow; g[k] = clamp(g[k] + n, 0, 100); },
    // 成長値と章の上限から段階を決める。上がったら events に入れる
    checkStages(ev) {
      const S = Game.S, g = S.grow, cap = [0, 2, 3, 4, 4, 5][Game.chapter()];
      for (const [k, sk, who] of [['hero', 'hs', 'allen'], ['demon', 'ds', 'zephyra']]) {
        const want = Math.min(cap, 1 + Math.floor(g[k] / 20));
        if (want > g[sk] && S.chars[who].alive) {
          g[sk]++;
          S.chars[who].power += Game.STAGE_POW[g[sk]] - Game.STAGE_POW[g[sk] - 1];
          ev.push({ k: 'stage', who, stage: g[sk] });
          return; // 1回に1段ずつ
        }
      }
    },

    // ---- 時間を進める(dt = 月) ----
    tick(dt) {
      const S = Game.S, ev = [];
      if (S.ended) return ev;
      S.time += dt;
      for (const k in S.cd) if (S.cd[k] > 0) S.cd[k] = Math.max(0, S.cd[k] - dt);
      if (!S.mission) S.focus = Math.min(FOCUS_MAX, (S.focus == null ? FOCUS_MAX : S.focus) + FOCUS_REGEN * dt); // ミッション中は回復しない
      if (G.Mission) G.Mission.tick(S, dt, ev);
      let inc = 0;
      if (S.revolt) {
        const a = S.chars.allen, z = S.chars.zephyra;
        S.revolt.v += (12 + (a.alive ? a.power : 0) / 10 + (z.alive ? z.power : 0) / 10) * dt;
        inc = 3 * dt;
      } else {
        // 予兆していたできごとが着く
        for (const o of S.omens) o.eta -= dt;
        for (const o of S.omens.filter(o => o.eta <= 0)) Game.omenArrive(o, ev);
        S.omens = S.omens.filter(o => o.eta > 0);
        // 新しい予兆(戦線ごと、だいたい月に0.6回)
        for (const fr of S.fronts) if (!S.omens.some(o => o.f === fr.id) && rnd() < 0.6 * dt) {
          const x = rnd();
          S.omens.push({ k: x < 0.5 ? 'hReinf' : fr.id === 'south' && rnd() < 0.5 ? 'monsters' : 'dReinf', f: fr.id, eta: 0.7 + rnd() * 0.4 });
        }
        let pray = 0;
        for (const fr of S.fronts) {
          fr.h += (rnd() - 0.5) * 8 * Math.sqrt(dt); fr.d += (rnd() - 0.5) * 8 * Math.sqrt(dt);
          if (fr.id === 'north') fr.d += 8 * dt;
          if (fr.f > 60) fr.d += 6 * dt; if (fr.f < -60) fr.h += 6 * dt;
          const H = Game.power(fr, 'h'), D = Game.power(fr, 'd');
          const diff = (H - D) / (H + D);
          fr.f = clamp(fr.f + diff * 50 * dt + (rnd() - 0.5) * 14 * Math.sqrt(dt), -100, 100);
          fr.intensity = 1 - Math.min(1, Math.abs(diff) * 2.2) + (fr.hate > 0 ? 0.6 : 0);
          let p = 2.5 + 7 * Math.exp(-Math.pow((fr.f + 10) / 34, 2)) + 3.5 * fr.intensity;
          if (fr.id === 'center') p *= 1.5;
          pray += p * dt;
          fr.hate = Math.max(0, fr.hate - dt);
          // 勝った側の英雄は少し育つ
          if (diff > 0.08 && S.chars.allen.at === fr.id) Game.addGrow('hero', 4 * dt / 3);
          if (diff < -0.08 && S.chars.zephyra.at === fr.id) Game.addGrow('demon', 4 * dt / 3);
          // 城が落ちる
          if (fr.f >= 100 && fr.castle.d) { fr.castle.d = false; fr.f = 55; ev.push({ k: 'crisis', c: 'hFall', f: fr.id }); }
          else if (fr.f <= -100 && fr.castle.h) { fr.castle.h = false; fr.f = -55; ev.push({ k: 'crisis', c: 'dFall', f: fr.id }); pray += 8; }
          else if (fr.f >= 100) fr.f = 92; else if (fr.f <= -100) fr.f = -92;
          // 城があぶない(1回だけ知らせる。はなれたらまた知らせる)
          if (fr.f > 70 && fr.castle.d && fr.warn !== 1) { fr.warn = 1; ev.push({ k: 'crisis', c: 'hWin', f: fr.id }); }
          else if (fr.f < -70 && fr.castle.h && fr.warn !== -1) { fr.warn = -1; ev.push({ k: 'crisis', c: 'dWin', f: fr.id }); }
          else if (Math.abs(fr.f) < 55) fr.warn = 0;
          // 一時的な強化は弱まる。兵は100に近づく
          const k1 = Math.pow(0.45, dt), k2 = Math.pow(0.75, dt);
          fr.hb *= k1; fr.db *= k1; fr.h = 100 + (fr.h - 100) * k2; fr.d = 100 + (fr.d - 100) * k2;
        }
        const trust = Game.humans().reduce((s, c) => s + c.trust, 0) / Math.max(1, Game.humans().length);
        inc = pray * (0.6 + trust / 250) * 0.52 + S.thanks * dt + (S.chars.serena.alive ? dt : 0);
        S.thanks *= Math.pow(0.4, dt);
      }
      S.faith = Math.min(200, S.faith + inc); S.total += inc; S.monthFaith += inc;
      Game.checkStages(ev);
      if (G.Story) G.Story.tick(S, ev);
      // 月がかわる
      if (Math.floor(S.time) > S.month) Game.monthEnd(ev);
      else if ((S.revolt && S.revolt.v >= 100) || Game.castles('d') <= 1 || Game.castles('h') <= 1) Game.endCheck(ev);
      return ev;
    },
    omenArrive(o, ev) {
      const fr = o.f && Game.front(o.f), sh = o.f ? G.FRONTS.find(x => x.id === o.f).short : '';
      if (o.k === 'hReinf') { fr.h += 38; ev.push({ k: 'news', t: `${sh}: 人族の援軍が着いた`, f: o.f, side: 'h' }); }
      if (o.k === 'dReinf') { fr.d += 38; ev.push({ k: 'news', t: `${sh}: 魔族の大軍が着いた`, f: o.f, side: 'd' }); }
      if (o.k === 'monsters') { fr.d += fr.id === 'south' ? 45 : 30; ev.push({ k: 'news', t: `${sh}: 魔物が大量にわいた`, f: o.f, side: 'd' }); }
      if (o.k === 'peaceTalk') {
        const S = Game.S, calm = S.fronts.reduce((a, f) => a + Math.abs(f.f), 0) / 3 < 32;
        if (calm && S.chars.gran.alive) { S.peace = { left: 3 }; ev.push({ k: 'crisis', c: 'peace' }); }
        else { S.peaceCool = 3; ev.push({ k: 'news', t: '戦いが激しく、王は和平をあきらめた' }); }
      }
    },
    monthEnd(ev) {
      const S = Game.S;
      S.month++;
      ev.push({ k: 'month', faith: Math.round(S.monthFaith) }); S.monthFaith = 0;
      if (S.revolt) {
        const a = S.chars.allen, z = S.chars.zephyra;
        if ([a, z].filter(c => c.alive && c.doubt >= 55).length < 2) { S.revolt = null; ev.push({ k: 'revoltEnd' }); for (const c of Game.alive()) c.doubt = Math.min(c.doubt, 40); }
      } else {
        Game.aiMove(ev);
        Game.doubtDrift();
        Game.peaceMonth(ev);
      }
      Game.checkBeats(ev);
      S.used = [];
      Game.endCheck(ev);
    },
    // 人物が自分の目的で動く(毎月1人の独自行動)
    aiMove(ev) {
      const S = Game.S, ch = S.chars, sh = id => G.FRONTS.find(f => f.id === id).short;
      const worstH = S.fronts.slice().sort((a, b) => a.f - b.f)[0], worstD = S.fronts.slice().sort((a, b) => b.f - a.f)[0];
      const cand = [];
      if (ch.allen.alive && worstH.f < -35 && ch.allen.at !== worstH.id && rnd() < 0.65) cand.push({ who: 'allen', w: 3, run: () => { ch.allen.at = worstH.id; return `勇者アレンが独断で${sh(worstH.id)}へ駆けつけた`; } });
      if (ch.zephyra.alive && worstD.f > 35 && ch.zephyra.at !== worstD.id && rnd() < 0.65) cand.push({ who: 'zephyra', w: 3, run: () => { ch.zephyra.at = worstD.id; return `魔王ゼフィラが${sh(worstD.id)}へ向かった`; } });
      const vf = Game.front(ch.volg.at);
      if (ch.volg.alive && vf && vf.f > 15 && ch.zephyra.at !== ch.volg.at && rnd() < 0.5) cand.push({ who: 'volg', w: 2, run: () => { vf.db += 24; return `魔将ヴォルグが${sh(vf.id)}で独断の攻勢に出た`; } });
      const wh = S.used.filter(u => G.CARDS.find(c => c.id === u.card).cat === 'whisper').length;
      if (ch.elmina.alive && wh && rnd() < 0.5) cand.push({ who: 'elmina', w: 2, run: () => { ch.elmina.doubt = clamp(ch.elmina.doubt + 4, 0, 100); return '賢者エルミナが闇の力の出どころを調べている'; } });
      if (ch.serena.alive && rnd() < 0.35) { const tf = S.fronts.slice().sort((a, b) => Math.abs(a.f) - Math.abs(b.f))[0]; cand.push({ who: 'serena', w: 1, run: () => { ch.serena.at = tf.id; S.thanks += 4; return `聖女セレナが${sh(tf.id)}で祈りをささげた`; } }); }
      if (!cand.length) return;
      let x = rnd() * cand.reduce((s, c) => s + c.w, 0), pick = cand[0];
      for (const c of cand) { x -= c.w; if (x <= 0) { pick = c; break; } }
      ev.push({ k: 'act', who: pick.who, t: pick.run() });
      for (const c of cand) if (c !== pick && (c.who === 'allen' || c.who === 'zephyra')) ev.push({ k: 'news', t: c.run() });
    },
    doubtDrift() {
      const S = Game.S, ch = S.chars;
      for (const c of Game.alive()) {
        c.doubt = clamp(c.doubt - 0.3, 0, 100);
        if (c.side === 'h') c.trust = clamp(c.trust + (c.doubt > 50 ? -2 : 0.3), 0, 100);
      }
      if (ch.elmina.alive) ch.elmina.doubt = clamp(ch.elmina.doubt + 1.2, 0, 100);
      const wh = S.used.filter(u => G.CARDS.find(c => c.id === u.card).cat === 'whisper').length;
      const mi = S.used.filter(u => G.CARDS.find(c => c.id === u.card).cat === 'miracle').length;
      if (ch.zephyra.alive) ch.zephyra.doubt = clamp(ch.zephyra.doubt + Math.min(3, wh) * 2.2, 0, 100);
      if (ch.serena.alive) ch.serena.doubt = clamp(ch.serena.doubt + Math.min(3, mi) * 0.8, 0, 100);
      if (ch.allen.alive && ch.serena.alive && ch.allen.at === ch.serena.at) ch.allen.doubt = clamp(ch.allen.doubt + ch.serena.doubt * 0.04, 0, 100);
      if (ch.zephyra.alive && ch.volg.alive && ch.zephyra.at === ch.volg.at) ch.volg.doubt = clamp(ch.volg.doubt + ch.zephyra.doubt * 0.03, 0, 100);
    },
    // 和平: 戦場が静かだと王が準備をはじめ(予兆)、1か月後もまだ静かなら交渉 → 3か月で成立
    peaceMonth(ev) {
      const S = Game.S;
      if (S.peaceCool > 0) S.peaceCool--;
      const calm = S.fronts.reduce((a, f) => a + Math.abs(f.f), 0) / 3 < 32;
      S.stall = calm ? S.stall + 1 : 0;
      if (S.peace) {
        S.peace.left--;
        if (S.peace.left <= 0) { S.ended = 'peace'; ev.push({ k: 'crisis', c: 'peaceDone' }); }
        return;
      }
      if (S.omens.some(o => o.k === 'peaceTalk')) return;
      if (!S.peaceCool && S.chars.gran.alive && S.month >= 5 && rnd() < 0.07 + S.stall * 0.07) {
        S.omens.push({ k: 'peaceTalk', f: null, eta: 1 });
        ev.push({ k: 'act', who: 'gran', t: 'グラン王が和平の準備をはじめた' });
      }
    },
    checkBeats(ev) {
      const S = Game.S;
      for (const b of G.BEATS) {
        const c = S.chars[b.who];
        if (!S.beats[b.id] && c.alive && c.doubt >= b.at) { S.beats[b.id] = 1; if (b.run) b.run(S); ev.push({ k: 'beat', b }); }
      }
      const a = S.chars.allen, z = S.chars.zephyra;
      for (const b of G.ALLY) if (!S.beats[b.id] && a.alive && z.alive && a.doubt >= b.at && z.doubt >= b.at) { S.beats[b.id] = 1; ev.push({ k: 'beat', b }); }
      if (!S.revolt && a.alive && z.alive && a.doubt >= 80 && z.doubt >= 80) { S.revolt = { v: 15 }; S.peace = null; ev.push({ k: 'revoltStart' }); }
    },
    endCheck(ev) {
      const S = Game.S;
      let e = S.ended || null;
      if (!e && S.revolt && S.revolt.v >= 100) e = 'godslayer';
      if (!e && Game.castles('d') <= 1) e = 'humanWin';
      if (!e && Game.castles('h') <= 1) e = 'demonWin';
      if (!e && S.month >= GOAL && !S.eternalSeen) { S.eternalSeen = 1; e = S.total >= FAITH_GOAL ? 'eternal' : 'forgotten'; }
      if (e && !S.ended) { S.ended = e; ev.push({ k: 'ended', e }); }
    },
    save() { try { localStorage.setItem('goddess4-save', JSON.stringify(Game.S)); } catch (e) { } },
    load() { try { const t = localStorage.getItem('goddess4-save'); if (t) { Game.S = JSON.parse(t); return true; } } catch (e) { } return false; },
    hasSave() { try { return !!localStorage.getItem('goddess4-save'); } catch (e) { return false; } },
    clearSave() { try { localStorage.removeItem('goddess4-save'); } catch (e) { } }
  };

  G.ENDINGS = {
    eternal: { title: '永遠の戦争', sub: 'GOOD END', img: 'goddess_dark', win: true, lines: [{ who: 'narr', text: '人魔大戦は5年つづいた。だれも真実に気づかないまま、人族は祈り、魔族は戦いつづけた。' }, { who: 'goddess_dark', text: 'さあ、愛しき世界よ。今日も祈りなさい。この戦争は、終わらない。' }] },
    forgotten: { title: '忘れられた女神', sub: 'BAD END', img: 'goddess_light', lines: [{ who: 'narr', text: '戦争は5年つづいた。だが、集まった祈りは女神の力を保つには足りなかった。' }, { who: 'goddess', text: '……祈りが、足りない。私の姿が、うすれていく……' }] },
    peace: { title: '平和の到来', sub: 'BAD END', img: 'scene_peace', lines: [{ who: 'narr', text: '人族と魔族は和平を結んだ。剣は鋤にかわり、人々は祈ることを忘れた。' }, { who: 'goddess', text: '……だれも、祈らない。私の声が、もうだれにも届かない……' }] },
    humanWin: { title: '魔族の滅亡', sub: 'BAD END', img: 'ev_celestial_city', lines: [{ who: 'gran', text: '魔族の城はすべて落ちた! 女神さまのおかげだ!' }, { who: 'goddess_dark', text: '……勝たせすぎたわね。敵のいない世界で、だれが私に祈るのかしら。' }] },
    demonWin: { title: '人族の滅亡', sub: 'BAD END', img: 'ev_fire_city', lines: [{ who: 'zephyra', text: '人族の城はすべて落ちた。この大陸は、魔族のものだ!' }, { who: 'goddess_dark', text: '……祈りが消えていく。自分でつくった魔族に、私は殺されるのね。' }] },
    godslayer: { title: '神殺し', sub: 'BAD END', img: 'goddess_dark', lines: [{ who: 'zephyra', text: '女神アステリア。お前の戦争は、ここで終わりだ。' }, { who: 'allen', text: 'ぼくたちの未来は、ぼくたちが選ぶ!' }, { who: 'goddess_dark', text: 'ふふ……見事よ。愛しい子どもたち……' }] }
  };
  G.Game = Game;
})(globalThis.G2 = globalThis.G2 || {});
