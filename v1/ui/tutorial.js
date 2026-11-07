// チュートリアル: 影の側近ノクスが、実際にボタンを押させながら教える
(function (G) {
  const W = G.World;
  const $ = s => document.querySelector(s);
  const F = () => G.Factions;

  // wait: 'next'(次へボタン) / 'menu:miracle'(メニューを開く) / 'use:bless_army'(介入を使う) / 'use:any' / 'month'(月が終わる)
  const STEPS = [
    { el: null, text: 'お目覚めですか、女神さま。影の側近、ノクスでございます。今日も世界の戦争をご覧になりましょう。', wait: 'next', show: 0 },
    { el: '#mapwrap', text: 'これが女神さまの世界、ひとつの大陸です。いま、人族と魔族が戦争をしています。', wait: 'next', show: 1 },
    { el: '#warbar', text: '地図の上のバーが戦況です。左の青が「人族」。人間・エルフ・ドワーフ・獣人の国々で、女神さまを救世主と信じています。右の赤が「魔族」。魔族と竜の国々で、魔王に従っています。', wait: 'next', show: 1 },
    { el: '.wb-track', text: 'まんなかの金色の帯が、女神さまにとってちょうどいい範囲です。どちらかが勝ちすぎて帯からはみ出すと、戦争が終わりに近づいてしまいます。', wait: 'next', show: 1 },
    { el: '#t-faith-box', text: 'これが「信仰」。人族の祈りです。女神さまの力の源で、介入に使います。人族がこわがっているときほど、祈りはたくさん集まります。', wait: 'next', show: 2 },
    { el: '#btn-miracle', text: 'まずは人族に希望を与えましょう。「神の奇跡」を押してください。(チュートリアル中は信仰を使いません)', wait: 'menu:miracle', show: 4 },
    { el: '[data-key="bless_army"]', text: '「光の加護」を選んでください。人族の全軍が強くなります。', wait: 'use:bless_army', show: 4 },
    { el: '#warbar', text: 'ごらんください、人族の戦力が上がりました。人々は「慈悲深い女神さまが助けてくださった」と涙を流しています。', wait: 'next', show: 4, after: 'h' },
    { el: '#btn-whisper', text: 'では次に、魔族にも力を。「邪神の囁き」を押してください。', wait: 'menu:whisper', show: 5 },
    { el: '[data-key="empower_lord"]', text: '「魔王への力」を。魔王の夢の中で、ささやいてさしあげましょう。', wait: 'use:empower_lord', show: 5 },
    { el: '#warbar', text: '魔族も強くなりました。まさか同じ女神さまの仕業だとは、だれも思いません。', wait: 'next', show: 5, after: 'd' },
    { el: '#t-aware-box', text: 'ただし、魔族に力を与えると「疑念」が少し増えます。疑念が高くなると、女神さまの正体に気づく者が出てきます。ご注意を。', wait: 'next', show: 5 },
    { el: '#btn-next', text: 'それでは時間を進めましょう。「次の月へ」を押すと、1か月のあいだ両軍が動き、戦います。', wait: 'month', show: 6 },
    { el: '#right', text: '1か月がたちました。右に「今月の報告」が出ています。戦いの結果、信仰がどれだけ増えたか、そして私からの助言です。', wait: 'next', show: 7 },
    { el: '#log', text: '下には世界のニュースが流れます。押すと、その場所へ地図が動きます。', wait: 'next', show: 7 },
    { el: '#warbar', text: '大切なことを申し上げます。人族が勝ちすぎれば魔族が滅び、魔族が勝ちすぎれば人族が滅びます。和平が結ばれても戦争は終わります。どれも、祈りが消えてしまう結末です。', wait: 'next', show: 7 },
    { el: '#interventions', text: '「運命の操作」では、和平をこわしたり、天災を起こしたり、人々の記憶を書きかえたりできます。介入は1か月に1回。次の一手は、女神さまご自身でお選びください。', wait: 'use:any', show: 9, skipLabel: '今月は何もしない' }
  ];

  const T = {
    active: false, i: 0,
    start() {
      const S = W.S; if (!S) return;
      T.active = true; T.i = 0; S.tutorial = true;
      document.body.classList.add('tut');
      $('#coach').classList.add('on');
      $('#coach-face').src = G.StoryUI.art('aide');
      G.UI.setSpeed(0);
      T.show();
    },
    show() {
      const st = STEPS[T.i];
      T.reveal(st.show);
      $('#coach-text').textContent = st.text;
      const nx = $('#coach-next');
      nx.style.display = (st.wait === 'next' || st.skipLabel) ? '' : 'none';
      nx.textContent = st.skipLabel || (T.i === STEPS.length - 1 ? '終わる' : '次へ');
      T.place();
    },
    // 説明する場所を明るくする
    place() {
      const st = STEPS[T.i]; if (!st) return;
      const spot = $('#coach-spot'), bub = $('#coach-bubble');
      const el = st.el ? document.querySelector(st.el) : null;
      if (!el || !el.offsetParent && el.id !== 'mapwrap') {
        spot.style.display = 'none';
        bub.style.left = '50%'; bub.style.top = '40%'; bub.style.transform = 'translate(-50%,-50%)';
        return;
      }
      const r = el.getBoundingClientRect(), pad = 6;
      spot.style.display = 'block';
      Object.assign(spot.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
      const bw = Math.min(420, window.innerWidth - 24), bh = bub.offsetHeight || 150;
      let left = r.left + r.width / 2 - bw / 2, top = r.bottom + 14;
      if (top + bh > window.innerHeight - 8) top = r.top - bh - 14;
      if (top < 8) top = Math.min(window.innerHeight - bh - 8, r.bottom + 14);
      if (r.height > window.innerHeight * 0.5) top = r.top + 40;
      left = G.clamp(left, 12, window.innerWidth - bw - 12);
      Object.assign(bub.style, { left: left + 'px', top: top + 'px', width: bw + 'px', transform: 'none' });
    },
    reveal(n) {
      document.querySelectorAll('[data-tut]').forEach(e => e.classList.toggle('tut-hide', T.active && +e.dataset.tut > n));
    },
    next() {
      if (!T.active) return;
      T.i++;
      if (T.i >= STEPS.length) return T.finish();
      T.show();
    },
    // ゲームの中で何かが起きたら呼ばれる
    notify(ev) {
      if (!T.active) return;
      const st = STEPS[T.i];
      if (st.wait === ev || (st.wait === 'use:any' && ev.startsWith('use:'))) setTimeout(T.next, ev.startsWith('use:') ? 500 : 50);
    },
    finish(skipped) {
      const S = W.S;
      T.active = false; if (S) S.tutorial = false;
      if (S) { S.goddess.usedMonth = -1; S.flags.tutorialDone = true; }
      document.body.classList.remove('tut');
      $('#coach').classList.remove('on');
      T.reveal(99);
      G.UI.closeMenu();
      G.StoryUI.mission(() => { G.UI.toast('人族と魔族のバランスを見ながら、介入をえらびましょう'); });
    },
    init() {
      $('#coach-next').addEventListener('click', () => {
        const st = STEPS[T.i];
        if (st.skipLabel && st.wait !== 'next') return T.finish();
        T.next();
      });
      $('#coach-skip').addEventListener('click', () => T.finish(true));
      window.addEventListener('resize', () => T.active && T.place());
      setInterval(() => T.active && T.place(), 500);
    }
  };
  G.Tut = T;
})(globalThis.GD = globalThis.GD || {});
