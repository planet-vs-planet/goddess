// 物語: 疑念が高まると、少しずつ女神の正体が明らかになる。最後は勇者と魔王が反旗をひるがえす
(function (G) {
  const W = G.World, C = G.Chars;
  const F = () => G.Factions;

  // 物語の段階(疑念の高さで進む)
  const BEATS = [
    {
      at: 22, key: 'crest', title: '魔王の紋章',
      text: lord => `戦場で${lord ? lord.name : '魔王'}と剣を交えた騎士が、魔王の額に「光の輪」の紋章を見た。それは女神教の神殿にきざまれているものと、まったく同じ形だった。`,
      scene: { bg: 'scene_lord', who: 'aide', lines: ['「女神さま、見られました。魔王の額の紋章を……」', '「ふふ。騎士ひとりの見まちがいよ。だれも信じないわ」'] }
    },
    {
      at: 45, key: 'evidence', title: '女神の痕跡',
      text: () => '人族の学者が、魔族の祭壇から古い祈りの書を見つけた。そこには女神教とまったく同じ祈りの言葉が書かれていた。「魔族の神と女神は、同じなのではないか?」',
      scene: { bg: 'scene_truth', who: 'aide', lines: ['「学者たちが、魔族の祭壇と女神教の祈りが同じだと気づきはじめています」', '「少しやりすぎたかしら。でも、まだ大丈夫。人は信じたいものを信じるの」'] }
    },
    {
      at: 68, key: 'doubt', title: '勇者と魔王の疑い',
      text: (lord, hero) => `${hero ? '勇者' + hero.name : '人族の勇者'}と${lord ? '魔王' + lord.name : '魔王'}は、戦場でにらみ合いながら、同じことを考えていた。「この戦争は、だれのためのものなのか」`,
      scene: { bg: 'scene_duel', who: 'aide', lines: ['「勇者と魔王が……戦いの手を止めました。たがいに何かを話しています」', '「……面白くないわね」'] }
    },
    {
      at: 88, key: 'truth', title: '真実の露見',
      text: (lord, hero) => `ついに真実が明らかになった。魔族を生んだのも、魔王に力を与えたのも、人族に奇跡を与えたのも、すべて女神だった。${hero ? hero.name : '勇者'}と${lord ? lord.name : '魔王'}は手を結び、「神殺しの同盟」をつくった。`,
      scene: { bg: 'scene_truth', who: 'goddess_dark', lines: ['「……気づいてしまったのね、愛しい子どもたち」', '「いいわ。ならば、私に剣を向けてごらんなさい」'] }
    }
  ];

  const ENDINGS = {
    peace: { title: '平和の到来', sub: 'BAD END', bg: 'scene_peace', text: '人族と魔族は和平を結んだ。剣は鋤にかわり、人々は祈ることを忘れた。祈りを失った女神は、だれにも気づかれないまま、静かに消えていった。', lose: true },
    humanWin: { title: '魔族の滅亡', sub: 'BAD END', bg: 'scene_peace', text: '人族は魔族をほろぼした。「女神さまのおかげだ!」人々は最初は祈ったが、敵のいない世界で、祈りはしだいに細くなっていった。戦争のない世界に、女神の居場所はなかった。', lose: true },
    demonWin: { title: '人族の滅亡', sub: 'BAD END', bg: 'scene_war', text: '人族は魔族にほろぼされた。女神に祈る者は、もうどこにもいない。祈りを失った女神は、自分がつくった魔族とともに、からっぽの世界にとり残された。', lose: true },
    godslayer: { title: '神殺し', sub: 'BAD END', bg: 'scene_truth', text: (s) => `${s.hero || '勇者'}と${s.lord || '魔王'}がひきいる神殺しの同盟は、天にいたる塔をのぼりつめ、女神の玉座に剣をつき立てた。「もう、だれにも操られない」――人族と魔族は、はじめて自分たちの手で未来をえらんだ。`, lose: true },
    eternal: { title: '永遠の戦争', sub: 'GOOD END', bg: 'scene_goddess', text: '人魔大戦は100年つづいた。人族は女神に祈りつづけ、魔族は戦いつづけた。だれも真実に気づかない。「さあ、愛しき世界よ。今日も祈りなさい」女神は微笑んだ。これからも、この戦争は終わらない。', lose: false }
  };

  const St = {
    BEATS, ENDINGS,
    setup() {
      const S = W.S;
      S.story = { beat: 0, hero: null, lord: null, seen: {} };
      S.revolt = { active: false, v: 0 };
      // 最初の勇者
      const hn = F().nationsOf('h').sort((a, b) => W.nationPop(b.id) - W.nationPop(a.id))[0];
      if (hn) {
        const h = C.spawnNotable(hn.id, 'hero');
        h.st.war = Math.min(100, h.st.war + 18); h.st.cha = Math.min(100, h.st.cha + 12); h.st.fai = Math.min(100, h.st.fai + 25); h.fame += 30;
        if (!h.traits.includes('brave') && !h.traits.includes('coward')) h.traits[0] = 'brave';
        if (h.traits.includes('coward')) h.traits = h.traits.filter(t => t !== 'coward').concat('brave');
        C.remember(h, '女神の神殿で勇者に選ばれた');
        S.story.hero = h.id;
      }
      St.refreshLord();
    },
    setHero(id) { if (W.S.story) W.S.story.hero = id; },
    setLord(id) { if (W.S.story) W.S.story.lord = id; },
    hero() { return W.S.story ? W.liveChar(W.S.story.hero) : null; },
    lord() { return W.S.story ? W.liveChar(W.S.story.lord) : null; },
    refreshLord() {
      const dn = F().nationsOf('d').sort((a, b) => W.nationPop(b.id) - W.nationPop(a.id))[0];
      if (dn && dn.ruler != null && (!St.lord() || St.lord().nation == null || F().side(St.lord().nation) !== 'd')) W.S.story.lord = dn.ruler;
    },
    refreshHero() {
      const S = W.S;
      if (St.hero()) return;
      const cand = Object.values(S.chars).filter(c => c.alive && c.role === 'hero' && F().side(c.nation) === 'h').sort((a, b) => b.fame - a.fame)[0];
      if (cand) { S.story.hero = cand.id; return; }
      // 勇者がいなくなったら、しばらくして新しい勇者が現れる
      if (W.rng.chance(0.04)) {
        const n = F().nationsOf('h')[0]; if (!n) return;
        const h = G.Events.makeHero(n, false);
        S.story.hero = h.id;
        W.log('person', '新たな勇者', `倒れた勇者のあとを継ぎ、${n.name}の${h.name}が勇者として立ち上がった。`, { n: [n.id], c: [h.id], imp: 2 });
      }
    },

    monthly() {
      const S = W.S, g = S.goddess;
      if (!S.story || (S.ended && S.ended.final)) return;
      St.refreshLord(); St.refreshHero();
      // 疑念で物語が進む
      const next = BEATS[S.story.beat];
      if (next && g.awareness >= next.at) {
        S.story.beat++;
        const lord = St.lord(), hero = St.hero();
        W.log('goddess', next.title, next.text(lord, hero), { c: [lord && lord.id, hero && hero.id].filter(x => x != null), imp: 3 });
        if (lord) C.remember(lord, next.title);
        if (hero) C.remember(hero, next.title);
        S.story.pending = next.key; // 画面で場面を見せる
        if (next.key === 'truth') St.startRevolt();
      }
      if (S.revolt.active) St.revoltMonthly();
    },

    startRevolt() {
      const S = W.S;
      S.revolt = { active: true, v: 10, start: S.day };
      // 戦争がとまる(和平ではなく、共通の敵ができた)
      for (const n of W.aliveNations()) n.weariness = 0;
      for (const a of Object.values(S.armies)) if (a.nation !== -1) G.Armies.sendHome(a);
      W.log('goddess', '神殺しの同盟', '人族と魔族は戦いをやめ、天に住む女神をたおすために手を結んだ。同盟の力が満ちると、女神は倒される。疑念を下げるか、同盟の中心を討つしかない。', { imp: 3 });
    },
    // 同盟の力: 毎月増える。記憶の改ざん・神罰で減らせる
    revoltMonthly() {
      const S = W.S, r = S.revolt, g = S.goddess;
      const hero = St.hero(), lord = St.lord();
      let d = 2.2 + (hero ? 1.2 : 0) + (lord ? 1.2 : 0) + (g.awareness - 60) / 20;
      r.v = G.clamp(r.v + d, 0, 100);
      // 同盟のあいだは軍が戦わない
      for (const a of Object.values(S.armies)) if (a.nation !== -1 && a.target && a.target.type !== 'home') G.Armies.sendHome(a);
      if (r.v >= 100) { F().endGame('godslayer'); return; }
      if (r.v <= 0 || g.awareness < 50) {
        r.active = false; r.v = 0;
        S.story.beat = Math.min(S.story.beat, 2);
        g.awareness = Math.min(g.awareness, 40);
        W.log('goddess', '同盟の崩壊', '神殺しの同盟は、たがいへの疑いからくずれ去った。人族と魔族は、ふたたび剣を向けあった。世界はまた、女神の手の中にもどった。', { imp: 3 });
        F().syncWar();
      }
    },
    onPower(p) {
      const S = W.S;
      // 邪神の囁きを使いすぎると、表の顔が保てなくなる(画面で裏の顔が見える)
      S.story.lastCat = p.cat;
    },
    onLevel() { },
    onEnd(key) {
      const S = W.S;
      const hero = St.hero(), lord = St.lord();
      S.ended.hero = hero ? hero.name : null; S.ended.lord = lord ? lord.name : null;
      const e = ENDINGS[key];
      W.log('goddess', `${e.sub}「${e.title}」`, typeof e.text === 'function' ? e.text({ hero: S.ended.hero, lord: S.ended.lord }) : e.text, { imp: 3 });
      S.story.pendingEnd = key;
    },
    // 神罰: 同盟の中心人物を討つ(運命の操作の一つとして、反逆中だけ使える)
    smite() {
      const S = W.S;
      const t = St.hero() || St.lord();
      if (!t) return false;
      C.kill(t, '神罰', null);
      S.revolt.v = Math.max(0, S.revolt.v - 35);
      S.goddess.awareness = Math.min(100, S.goddess.awareness + 4);
      W.log('goddess', '神罰', `天から光の柱が落ち、${t.name}をつらぬいた。同盟は大きくゆらいだ。しかし、その光景を見た人々は、女神が敵であることをいっそう確信した。`, { c: [t.id], imp: 3, memory: false });
      return true;
    }
  };
  G.Story = St;

  // 反逆のあいだだけ使える「神罰」を運命の操作に加える
  G.Powers.list.push({
    key: 'smite', cat: 'fate', name: '神罰', cost: 50, lv: 1, sus: 4,
    desc: '神殺しの同盟の中心(勇者か魔王)を天の光で討つ。同盟の力が大きく下がる。',
    need: () => !!(W.S.revolt && W.S.revolt.active), needText: '神殺しの同盟ができてから使える',
    apply() { return St.smite(); }
  });
})(globalThis.GD = globalThis.GD || {});
