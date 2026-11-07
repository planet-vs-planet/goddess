// 物語の進行: 5章。章ごとに、たくさんある話の中からランダムにえらんで並べる(遊ぶたびに変わる)
// 第3章の終わりに、女神がどちらを多く助けたかでルート(hero/demon/balance)が決まり、第4・5章が変わる
(function (G) {
  const rnd = () => Math.random();
  const pick = a => a[Math.floor(rnd() * a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const ROUTE_NAME = { hero: '勇者のルート', demon: '魔王のルート', balance: '均衡のルート' };

  const Story = {
    ROUTE_NAME,
    // 新しいゲームの台本をつくる
    plan(S) {
      const q = [];
      for (const ch of G.STORY.chapters) {
        const base = (ch.no - 1) * 12;
        q.push({ t: base + (ch.no === 1 ? 0.25 : 0.1), kind: 'intro', ch: ch.no });
        const items = [];
        // 章ごとに「人族・魔族・秘密」から2つをえらぶ(ミッションのあいだに休みができるように)
        for (const kind of shuffle(['human', 'demon', 'secret']).slice(0, 2)) items.push({ kind, ch: ch.no, id: pick(ch[kind]).id });
        // 起きる時期をばらばらに(1.5〜10.5か月目)
        const slots = shuffle(items).map((it, i, arr) => Object.assign(it, { t: base + 1.5 + (9 * (i + rnd() * 0.8)) / arr.length }));
        q.push(...slots);
        q.push({ t: base + 11, kind: 'climax', ch: ch.no, n: Math.floor(rnd() * 2) });
      }
      q.sort((a, b) => a.t - b.t);
      S.story = { q, done: 0, seen: [] };
    },
    chapter(no) { return G.STORY.chapters.find(c => c.no === no); },
    // 台本の1つ分の中身(ルートで変わるものはここで決まる)
    get(S, it) {
      const ch = Story.chapter(it.ch), route = S.route || 'balance';
      if (it.kind === 'intro') return { title: `第${ch.no}章 ${ch.title}`, lines: Array.isArray(ch.intro) ? ch.intro : ch.intro[route], intro: true, ch: ch.no };
      if (it.kind === 'climax') { const list = Array.isArray(ch.climax) ? ch.climax : ch.climax[route]; return list[it.n % list.length]; }
      return ch[it.kind].find(e => e.id === it.id);
    },
    tick(S, ev) {
      const st = S.story; if (!st || S.revolt) return;
      const busy = !!S.mission || S.time < (S.missionRest || 0); // ミッションのあとは少し休み
      // 第3章の終わりにルートが決まる
      if (!S.route && S.time >= 36) {
        const d = S.support.h - S.support.d;
        S.route = d >= 25 ? 'hero' : d <= -25 ? 'demon' : 'balance';
        st.route = S.route;
        ev.push({ k: 'route', route: S.route });
      }
      const it = st.q[st.done];
      if (it && S.time >= it.t && !busy) {
        st.done++;
        const e = Story.get(S, it);
        if (!e) return;
        let front = e.front;
        if (!front || front === 'any' || !G.FRONTS.some(f => f.id === front)) front = S.view || 'center';
        // 画面がそのまま使える形にする(kind=種類, at=戦線)
        ev.push({ k: 'story', it, front, e: Object.assign({}, e, { kind: it.kind, at: front }) });
      }
    },
    // 効果をかける。choice = えらんだ選択肢の番号(なければ null)
    apply(S, eff, front) {
      if (!eff) return;
      const fr = G.Game.front(front) || G.Game.front('center');
      for (const k in eff) {
        const v = eff[k];
        if (k === 'hero') { G.Game.addGrow('hero', v); S.support.h += Math.max(0, v); }
        else if (k === 'demon') { G.Game.addGrow('demon', v); S.support.d += Math.max(0, v); }
        else if (k === 'h') fr.hb += v * 2.5;
        else if (k === 'd') fr.db += v * 2.5;
        else if (k === 'faith') { S.faith = Math.max(0, Math.min(200, S.faith + v)); if (v > 0) S.total += v; }
        else if (k.startsWith('doubt_')) { const c = S.chars[k.slice(6)]; if (c && c.alive) c.doubt = Math.max(0, Math.min(100, c.doubt + v)); }
      }
    },
    resolve(S, ev, choice) {
      Story.apply(S, ev.e.effect, ev.front);
      if (choice != null && ev.e.choice && ev.e.choice[choice]) Story.apply(S, ev.e.choice[choice].effect, ev.front);
      S.story.seen.push(ev.e.id || ev.it.kind + ev.it.ch);
    },
    // 場面の背景の絵
    image(e) {
      const p = a => a[Math.floor(rnd() * a.length)];
      if (e.kind === 'intro') return p(['scene_war', 'ev_burning_fortress', 'ev_capital_city']);
      if (e.kind === 'secret') return p(['ev_crest_altar', 'ev_vortex', 'ev_altar']);
      if (e.kind === 'demon') return p(['ev_crest_zephyra', 'ev_cursed_castle', 'assets/img/bg_' + (e.at || 'south') + '.jpg']);
      if (e.kind === 'climax') return (S => S && S.route === 'balance' && e.lines.some(l => l[0] === 'zephyra') && e.lines.some(l => l[0] === 'allen'))(G.Game.S) ? 'ev_alliance' : p(['ev_pillar', 'ev_burning_fortress', 'ev_holy']);
      return p(['ev_holy', 'assets/img/bg_' + (e.at || 'center') + '.jpg']);
    },
    // 成長の場面(段階ごとに2種類からランダム)
    stage(who, stage) {
      const list = (G.STORY.stages[who] || []).filter(s => s.stage === stage);
      return list.length ? pick(list) : null;
    },
    ending(key, route) {
      const e = G.STORY.endings[key];
      if (!e) return null;
      return Array.isArray(e) ? e : e[route || 'balance'] || e.balance;
    }
  };
  G.Story = Story;
})(globalThis.G2 = globalThis.G2 || {});
