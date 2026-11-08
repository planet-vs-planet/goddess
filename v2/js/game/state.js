// ゲームのルール: 前線・人族と魔族の力・信仰・疑念・1か月の戦い・終わり方
(function (G) {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.clamp = clamp;
  const GOAL_MONTHS = 60; // 5年つづけば勝ち

  const Game = {
    S: null, GOAL_MONTHS,
    newGame() {
      Game.S = {
        v: 1, month: 0, year0: 1000,
        f: -42,            // 前線(-100=人族の城, +100=魔族の城)
        h: 100, d: 112,    // 人族と魔族の力
        faith: 45, sus: 0, total: 0,
        peaceProg: 0, peaceBlock: 0, monthsSincePeace: 0,
        thanks: 0, clashBonus: 0, revolt: 0, revoltOn: false,
        beat: 0, tut: 0, flags: {}, seen: {},
        alive: { allen: true, serena: true },
        counts: { miracle: 0, whisper: 0, fate: 0, none: 0 },
        last: null, ended: null, history: []
      };
      return Game.S;
    },
    dateText(m) { const S = Game.S; m = m == null ? S.month : m; return `人魔大戦 ${Math.floor(m / 12) + 1}年目 ${m % 12 + 1}月`; },
    zone(f) {
      if (f > 60) return { t: '人族が圧倒', k: 'far' }; if (f > 30) return { t: '人族が優勢', k: 'warn' };
      if (f < -60) return { t: '魔族が圧倒', k: 'far' }; if (f < -30) return { t: '魔族が優勢', k: 'warn' };
      return { t: '拮抗(ちょうどいい)', k: 'good' };
    },

    // 今月の出来事をえらぶ
    pickEvent() {
      const S = Game.S;
      if (S.tut < G.TUTORIAL.length) return G.TUTORIAL[S.tut];
      if (S.revoltOn) return G.REVOLT_EVENTS[0];
      const cands = G.EVENTS.filter(e => (!e.once || !S.seen[e.id]) && e.when(S) && S.lastEvent !== e.id);
      const w = cands.map(e => typeof e.weight === 'function' ? e.weight(S) : (e.weight || 1));
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < cands.length; i++) { r -= w[i]; if (r <= 0) return cands[i]; }
      return cands[0] || G.EVENTS.find(e => e.id === 'stalemate');
    },
    canChoose(c) {
      const S = Game.S;
      if ((c.cost || 0) > S.faith) return `信仰が足りない(${c.cost}必要)`;
      return null;
    },
    // 選んだ結果を反映。戦場の演出のために前後の値を返す
    choose(ev, c) {
      const S = Game.S;
      const before = { h: S.h, d: S.d, f: S.f, faith: S.faith, sus: S.sus };
      S.faith -= c.cost || 0;
      S.h = Math.max(20, S.h + (c.h || 0)); S.d = Math.max(20, S.d + (c.d || 0));
      S.f = clamp(S.f + (c.f || 0), -100, 100);
      S.faith += c.faith || 0;
      S.sus = clamp(S.sus + (c.sus || 0), 0, 100);
      if (c.run) c.run(S);
      S.counts[c.cat || 'none']++;
      S.seen[ev.id] = 1; S.lastEvent = ev.id;
      if (ev.id === 'peace') S.monthsSincePeace = 0;
      if (S.tut < G.TUTORIAL.length) S.tut++;
      S.last = { ev: ev.id, choice: c.label, cat: c.cat };
      return { before, after: { h: S.h, d: S.d, f: S.f, faith: S.faith, sus: S.sus } };
    },

    // 1か月の戦い。前線がどれだけ動き、信仰がどれだけ集まったか
    battle() {
      const S = Game.S;
      const r = { f0: S.f, news: [] };
      if (S.revoltOn) {
        // 同盟のあいだは戦わず、同盟の力がたまる
        S.revolt += 18 + Math.max(0, S.sus - 90) * 0.5;
        r.f1 = S.f; r.faith = Math.round(2 + Math.random() * 3); r.revolt = S.revolt;
        S.faith += r.faith; S.month++;
        r.news.push(S.revolt < 0 ? '神殺しの同盟は消えた' : `神殺しの同盟の力 ${Math.round(Math.max(0, S.revolt))}/100`);
        Game.endCheck(r);
        return r;
      }
      // 世界のうごき(放っておいても戦況は変わる)
      const drift = [
        { p: 0.18, t: '人族の国々から援軍が到着した', h: 18 },
        { p: 0.18, t: '魔族の地の底から新たな軍勢がわき出た', d: 18 },
        { p: 0.08, t: '人族の王たちが仲間割れをはじめた', h: -15 },
        { p: 0.08, t: '魔族の将軍どうしが争いはじめた', d: -15 },
        { p: 0.06, t: '冬の寒さで両軍とも動けない', h: -5, d: -5, calm: 1 }
      ];
      let calm = 0;
      for (const x of drift) if (Math.random() < x.p) { S.h += x.h || 0; S.d += x.d || 0; calm += x.calm || 0; r.news.push(x.t); }
      // 押されている側は必死に戦う
      if (S.f > 55) S.d += 8; if (S.f < -55) S.h += 8;
      // 竜王の加勢
      if (S.flags.dragon === 'd') S.d += 3; if (S.flags.dragon === 'h') S.h += 3;
      const diff = (S.h - S.d) / (S.h + S.d);
      const shift = diff * 48 + (Math.random() - 0.5) * 16;
      S.f = clamp(S.f + shift * (calm ? 0.4 : 1), -100, 100);
      const intensity = 1 - Math.min(1, Math.abs(diff) * 2.2);
      // 祈り: 人族が少し押されているときが最大。勝ちすぎると祈りを忘れる
      let faith = 3 + 13 * Math.exp(-Math.pow((S.f + 12) / 38, 2)) + 7 * intensity + (S.clashBonus ? 10 : 0) + S.thanks;
      if (S.f > 50) faith *= 0.5;
      if (S.sus > 60) faith *= 0.85;
      faith = Math.max(0, Math.round(faith));
      S.faith = Math.min(220, S.faith + faith); S.total += faith;
      r.f1 = S.f; r.faith = faith; r.intensity = intensity + (S.clashBonus ? 0.5 : 0); r.diff = diff;
      r.lossH = Math.round((200 + 600 * r.intensity) * (S.d / (S.h + S.d)) * (0.8 + Math.random() * 0.4));
      r.lossD = Math.round((200 + 600 * r.intensity) * (S.h / (S.h + S.d)) * (0.8 + Math.random() * 0.4));
      // 力は少しずつ元にもどる(介入の効果はずっとはつづかない)
      S.h = 100 + (S.h - 100) * 0.72; S.d = 100 + (S.d - 100) * 0.72;
      S.clashBonus = 0; S.thanks = Math.max(0, S.thanks * 0.5 - 0.2);
      if (S.peaceBlock > 0) S.peaceBlock--;
      S.monthsSincePeace++;
      S.month++;
      S.sus = Math.max(0, S.sus - 0.6);
      Game.endCheck(r);
      return r;
    },
    // 物語の段階(疑念で進む)
    nextBeat() {
      const S = Game.S, b = G.BEATS[S.beat];
      if (b && S.sus >= b.at) { S.beat++; if (b.revolt) { S.revoltOn = true; S.revolt = 10; } return b; }
      return null;
    },
    endCheck(r) {
      const S = Game.S;
      if (S.revoltOn && S.revolt < 0) { S.revoltOn = false; S.revolt = 0; S.sus = 45; S.beat = 2; r.revoltEnd = true; }
      let e = null;
      if (S.revoltOn && S.revolt >= 100) e = 'godslayer';
      else if (S.f >= 100) e = 'humanWin';
      else if (S.f <= -100) e = 'demonWin';
      else if (S.peaceProg >= 2) e = 'peace';
      else if (S.month >= GOAL_MONTHS && !S.flags.eternal) { S.flags.eternal = 1; e = 'eternal'; }
      if (e) S.ended = e;
      r.ended = e;
    },
    save() { try { localStorage.setItem('goddess2-save', JSON.stringify(Game.S)); } catch (e) { } },
    load() { try { const t = localStorage.getItem('goddess2-save'); if (t) { Game.S = JSON.parse(t); return true; } } catch (e) { } return false; },
    hasSave() { try { return !!localStorage.getItem('goddess2-save'); } catch (e) { return false; } }
  };

  G.ENDINGS = {
    eternal: { title: '永遠の戦争', sub: 'GOOD END', img: 'goddess_dark', win: true, lines: [{ who: 'narr', text: '人魔大戦は5年つづいた。だれも真実に気づかないまま、人族は祈り、魔族は戦いつづけた。' }, { who: 'goddess_dark', text: 'さあ、愛しき世界よ。今日も祈りなさい。この戦争は、終わらない。' }] },
    peace: { title: '平和の到来', sub: 'BAD END', img: 'scene_peace', lines: [{ who: 'narr', text: '人族と魔族は和平を結んだ。剣は鋤にかわり、人々は祈ることを忘れた。' }, { who: 'goddess', text: '……だれも、祈らない。私の声が、もうだれにも届かない……' }, { who: 'narr', text: '女神は、だれにも気づかれないまま、静かに消えていった。' }] },
    humanWin: { title: '魔族の滅亡', sub: 'BAD END', img: 'ev_celestial_city', lines: [{ who: 'gran', text: '魔族は滅んだ! 女神さまのおかげだ!' }, { who: 'narr', text: '人々は最初こそ祈ったが、敵のいない世界で、祈りはしだいに細くなっていった。' }, { who: 'goddess_dark', text: '……勝たせすぎたわね。戦争のない世界に、私の居場所はないのに。' }] },
    demonWin: { title: '人族の滅亡', sub: 'BAD END', img: 'ev_fire_city', lines: [{ who: 'zephyra', text: '人族は滅んだ。この大陸は、魔族のものだ!' }, { who: 'narr', text: '女神に祈る者は、もうどこにもいない。' }, { who: 'goddess_dark', text: '……祈りが、消えていく。自分でつくった魔族に、私は殺されるのね。' }] },
    godslayer: { title: '神殺し', sub: 'BAD END', img: 'goddess_dark', lines: [{ who: 'narr', text: '神殺しの同盟は、天にいたる塔をのぼりつめた。' }, { who: 'zephyra', text: '女神アステリア。お前の戦争は、ここで終わりだ。' }, { who: 'goddess_dark', text: 'ふふ……見事よ。愛しい子どもたち……' }, { who: 'narr', text: '人族と魔族は、はじめて自分たちの手で、未来を選んだ。' }] }
  };
  G.Game = Game;
})(globalThis.G2 = globalThis.G2 || {});
