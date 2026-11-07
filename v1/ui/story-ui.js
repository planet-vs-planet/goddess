// 物語の画面: オープニング・物語の場面・使命・エンディング
(function (G) {
  const W = G.World;
  const $ = s => document.querySelector(s);
  const esc = s => G.esc(s);

  // 物語で使う絵(ChatGPTで新しく作った絵があればそれを、なければ前の絵を使う)
  function art(key) {
    const S = G.STORY_ART || {}, A = G.ART || { events: {}, portraits: {} };
    if (S[key]) return S[key];
    const fb = {
      goddess_light: A.title, goddess_dark: A.title,
      scene_peace: A.events.capital_city, scene_war: A.events.fire_city, scene_goddess: A.events.pillar,
      scene_lord: A.events.cursed_castle, scene_truth: A.events.vortex, scene_duel: A.events.burning_fortress,
      aide: A.portraits.demon_a, hero: A.portraits.hero, lord: A.portraits.demon_d || A.portraits.demon_b
    }[key];
    return fb || '';
  }
  const SPEAKERS = {
    goddess: { name: '女神', face: 'goddess_light' },
    goddess_dark: { name: '女神(裏の顔)', face: 'goddess_dark' },
    aide: { name: '影の側近 ノクス', face: 'aide' },
    narr: null
  };

  // オープニング(指示書②)
  const OPENING = [
    { bg: 'scene_peace', who: 'narr', text: 'かつて、この世界には人族しかいなかった。' },
    { bg: 'scene_peace', who: 'narr', text: '人族は王国を築き、畑をたがやし、平和に暮らしていた。' },
    { bg: 'scene_war', who: 'narr', text: 'ある日、「魔族」と呼ばれる者たちがあらわれた。' },
    { bg: 'scene_war', who: 'narr', text: '魔族は人族の国々を襲い、世界は戦乱に包まれた。人族は滅びの淵に立たされた。' },
    { bg: 'scene_goddess', who: 'narr', text: 'そのとき、人族の前に女神があらわれた。' },
    { bg: 'scene_goddess', who: 'goddess', text: '「恐れることはありません。私があなたたちを守りましょう」' },
    { bg: 'scene_goddess', who: 'narr', text: '女神は奇跡を与え、勇者を生み、魔族と戦う力を授けた。人族は女神を救世主としてあがめた。' },
    { bg: 'scene_lord', who: 'narr', text: '一方、魔族を率いる魔王もまた、なぞの存在から力を授かっていた。' },
    { bg: 'scene_lord', who: 'narr', text: '長い年月が過ぎても、人族と魔族の戦争は終わらなかった。' },
    { bg: 'dark', who: 'narr', text: '人族を救った女神。魔王に力を与えた、なぞの存在。その正体は――' },
    { bg: 'goddess_dark', who: 'goddess_dark', text: '「どちらも、私よ」', flash: true },
    { bg: 'scene_truth', who: 'narr', text: '魔族を生み出したのも女神。魔王に力を与えたのも女神。人族に奇跡を与えたのも女神。すべては、女神が仕組んだことだった。' },
    { bg: 'scene_truth', who: 'goddess_dark', text: '「人族を滅ぼしたいわけじゃないの。魔族を勝たせたいわけでもない」' },
    { bg: 'scene_truth', who: 'goddess_dark', text: '「戦いがつづけば、人はおそれ、祈る。その祈りが、私の力になるの」' },
    { bg: 'goddess_dark', who: 'goddess_dark', text: '「さあ、愛しき世界よ。今日も祈りなさい」' },
    { bg: 'goddess_dark', who: 'goddess_dark', text: '「人族には希望を。魔族には憎しみを」' },
    { bg: 'goddess_dark', who: 'goddess_dark', text: '「勝者はいらない。敗者もいらない」' },
    { bg: 'goddess_dark', who: 'goddess_dark', text: '「この戦争がつづく限り、私は永遠に存在できるのだから」' },
    { bg: 'dark', who: 'narr', text: 'あなたは、この女神です。', big: true }
  ];

  const SUI = {
    art, OPENING,
    queue: null, i: 0, done: null,
    play(lines, done) {
      SUI.queue = lines; SUI.i = 0; SUI.done = done;
      G.UI.setSpeed(0);
      $('#scene').classList.add('open');
      SUI.show();
    },
    show() {
      const l = SUI.queue[SUI.i];
      const bg = $('#sc-bg');
      if (l.bg === 'dark') { bg.style.backgroundImage = 'none'; bg.className = 'sc-bg dark'; }
      else { bg.style.backgroundImage = `url("${art(l.bg)}")`; bg.className = 'sc-bg' + (l.bg.startsWith('goddess') ? ' portrait' : ''); }
      if (l.flash) { const s = $('#scene'); s.classList.remove('flash'); void s.offsetWidth; s.classList.add('flash'); }
      const sp = SPEAKERS[l.who];
      $('#sc-who').style.display = sp ? 'flex' : 'none';
      if (sp) { $('#sc-face').src = art(sp.face); $('#sc-name').textContent = sp.name; $('#sc-who').className = 'sc-who ' + l.who; }
      const t = $('#sc-text');
      t.className = 'sc-text' + (l.big ? ' big' : '') + (sp ? '' : ' narr');
      t.textContent = l.text;
      $('#sc-next').textContent = SUI.i === SUI.queue.length - 1 ? (l.end || 'つづける ▶') : '次へ ▶';
    },
    next() {
      if (!SUI.queue) return;
      SUI.i++;
      if (SUI.i >= SUI.queue.length) return SUI.close();
      SUI.show();
    },
    close() {
      $('#scene').classList.remove('open');
      const d = SUI.done; SUI.queue = null; SUI.done = null;
      if (d) d();
    },
    init() {
      $('#sc-next').addEventListener('click', SUI.next);
      $('#sc-skip').addEventListener('click', SUI.close);
      $('#scene').addEventListener('click', e => { if (e.target.closest('.sc-box')) return; SUI.next(); });
      document.addEventListener('keydown', e => { if (SUI.queue && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); SUI.next(); } });
    },

    // 物語の段階の場面
    playBeat(key) {
      const b = G.Story.BEATS.find(x => x.key === key); if (!b) return;
      const lord = G.Story.lord(), hero = G.Story.hero();
      const lines = [{ bg: b.scene.bg, who: 'narr', text: `――${b.title}――` }, { bg: b.scene.bg, who: 'narr', text: b.text(lord, hero) }];
      b.scene.lines.forEach((t, i) => lines.push({ bg: b.scene.bg, who: b.scene.who === 'goddess_dark' ? 'goddess_dark' : (i % 2 === 0 ? 'aide' : 'goddess_dark'), text: t }));
      SUI.play(lines);
    },

    // 使命(指示書④)
    mission(done) {
      G.UI.setSpeed(0);
      $('#mission-card').innerHTML = `<img class="mc-face" src="${art('goddess_dark')}" alt="">
        <div class="mc-label">女神の使命</div>
        <p>人族には、希望を与えよ。</p><p>魔族には、力を与えよ。</p><p>両者を争わせ、信仰を集めつづけよ。</p><p class="em">決して、この戦争を終わらせてはならない。</p>
        <div class="mc-goal">勝利: 人魔大戦を100年つづける<br>敗北: どちらかが滅びる/和平が結ばれる/神殺しの同盟に倒される</div>
        <button class="primary" id="mc-ok">使命を受け入れる</button>`;
      $('#mission').classList.add('open');
      $('#mc-ok').onclick = () => { $('#mission').classList.remove('open'); if (done) done(); };
    },

    // エンディング
    ending(key) {
      const S = W.S, e = G.Story.ENDINGS[key]; if (!e) return;
      G.UI.setSpeed(0);
      const g = S.goddess, cnt = g.counts || {};
      const text = typeof e.text === 'function' ? e.text({ hero: S.ended.hero, lord: S.ended.lord }) : e.text;
      $('#mission-card').innerHTML = `<div class="end-img" style="background-image:url('${art(e.bg)}')"></div>
        <div class="mc-label ${e.lose ? 'bad' : 'good'}">${e.sub}</div><h2>${esc(e.title)}</h2><p class="end-text">${esc(text)}</p>
        <div class="end-stats"><span>戦争 <b>${G.Factions.warYears()}年</b></span><span>集めた信仰 <b>${G.fmt(g.total)}</b></span><span>神の奇跡 <b>${cnt.miracle || 0}回</b></span><span>邪神の囁き <b>${cnt.whisper || 0}回</b></span><span>運命の操作 <b>${cnt.fate || 0}回</b></span></div>
        <div class="end-btns">${S.ended.final ? '' : '<button id="end-cont">このまま世界を見守る</button>'}<button class="primary" id="end-new">新しい世界でもう一度</button></div>`;
      $('#mission').classList.add('open');
      const c = $('#end-cont'); if (c) c.onclick = () => $('#mission').classList.remove('open');
      $('#end-new').onclick = () => { $('#mission').classList.remove('open'); G.Main.showTitle(); };
    },

    // 毎回の画面更新で、物語の場面がたまっていたら見せる
    check() {
      const S = W.S; if (!S || !S.story || SUI.queue || G.Tut.active) return;
      if (S.story.pending) { const k = S.story.pending; S.story.pending = null; G.UI.setSpeed(0); SUI.playBeat(k); return; }
      if (S.story.pendingEnd) { const k = S.story.pendingEnd; S.story.pendingEnd = null; SUI.ending(k); }
    }
  };
  G.StoryUI = SUI;
})(globalThis.GD = globalThis.GD || {});
