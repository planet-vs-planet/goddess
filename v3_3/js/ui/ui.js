// 画面: 介入カードをえらぶ → 対象をえらぶ → 戦場で結果が見える → 戦闘開始 → 3つの戦線の結果
(function (G) {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const Game = G.Game;
  const IMG = p => (G.IMG && G.IMG[p]) || p;
  const imgOf = k => { if (!k) return ''; const p = /^(scene_|goddess_|ev_|face_|bg_)/.test(k) ? `assets/img/${k}.jpg` : k; return IMG(p); };
  const L2 = a => ({ who: a[0], text: a[1] }); // 物語データの ["who","text"] → {who,text}
  const FR = id => G.FRONTS.find(f => f.id === id);
  const CAT = { miracle: { t: '神の奇跡', s: '人族に希望を' }, whisper: { t: '邪神の囁き', s: '魔族に力を' }, fate: { t: '運命の操作', s: '両者をあやつる' } };
  const TGT = { front: '戦線をえらぶ', human: '人族の人物をえらぶ', demon: '魔族の人物をえらぶ', char: '人物をえらぶ', move: '人物→戦線をえらぶ', none: 'すぐ使う' };

  // ---- 全画面の会話(オープニング・物語・エンディング) ----
  const Talk = {
    lines: null, i: 0, done: null,
    play(lines, done, choices) { Talk.vdone = {}; Talk.lines = lines; Talk.i = 0; Talk.done = done; Talk.choices = choices || null; $('#sc-choice').replaceChildren(); $('#scene').classList.remove('choosing'); $('#scene').classList.add('open'); Talk.show(); },
    show() {
      const l = Talk.lines[Talk.i], c = G.CHARS[l.who] || G.CHARS.narr, box = $('#scene');
      // 正体が明かされる瞬間に、女神が光から闇へ変わる動画をはさむ
      if (l.video && !Talk.vdone[Talk.i]) { Talk.vdone[Talk.i] = 1; Talk.waiting = true; G.Voice.stop(); return UI.playVideo(() => { Talk.waiting = false; Talk.show(); }); }
      const face = box.querySelector('.t-face'), name = box.querySelector('.t-name'), text = box.querySelector('.t-text');
      if (c.face) { face.src = IMG(c.face); face.style.display = ''; face.className = 't-face ' + l.who; } else face.style.display = 'none';
      name.textContent = c.name; name.style.color = c.color;
      text.textContent = l.who === 'narr' ? l.text : `「${l.text}」`;
      text.className = 't-text' + (l.who === 'narr' ? ' narr' : '') + (l.big ? ' big' : '');
      if (l.img) {
        const bg = $('#sc-bg');
        if (l.img === 'dark') { bg.style.backgroundImage = 'none'; bg.className = 'sc-bg'; }
        else { bg.style.backgroundImage = `url("${imgOf(l.img)}")`; bg.className = 'sc-bg' + (/^goddess/.test(l.img) ? ' contain' : ''); }
      }
      if (l.flash) { box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash'); G.BGM.sfx('boom'); }
      if (l.bgm) G.BGM.play(l.bgm);
      G.Voice.say(l.who, l.text);
    },
    next() {
      if (!Talk.lines || Talk.waiting) return;
      G.BGM.sfx('click');
      if (Talk.i + 1 >= Talk.lines.length && Talk.choices) return Talk.ask();
      Talk.i++;
      if (Talk.i >= Talk.lines.length) return Talk.close(null);
      Talk.show();
    },
    // 女神はどうする? の2択
    ask() {
      Talk.waiting = true; $('#scene').classList.add('choosing');
      const box = $('#sc-choice'); box.replaceChildren();
      const h = document.createElement('div'); h.className = 'q'; h.textContent = '女神は、どうする?'; box.appendChild(h);
      Talk.choices.forEach((c, i) => { const b = document.createElement('button'); b.className = 'primary'; b.textContent = c; b.onclick = e => { e.stopPropagation(); Talk.waiting = false; $('#scene').classList.remove('choosing'); Talk.close(i); }; box.appendChild(b); });
    },
    close(choice) { const d = Talk.done; Talk.lines = null; Talk.choices = null; G.Voice.stop(); $('#scene').classList.remove('open'); if (d) d(choice); },
    skip() { if (Talk.lines && !Talk.waiting) { Talk.i = Talk.lines.length - 1; Talk.next(); } }
  };

  // ---- 戦場の上の吹き出し(声が終わると自動で次へ) ----
  const Bubble = {
    q: [], busy: false, done: null,
    play(lines, done) { Bubble.q = lines.slice(); Bubble.done = done; Bubble.next(); },
    add(lines) { Bubble.q.push(...lines); if (!Bubble.busy) Bubble.next(); },
    next() {
      clearTimeout(Bubble.t);
      const b = $('#bubble');
      if (!Bubble.q.length) { b.classList.remove('on'); Bubble.busy = false; const d = Bubble.done; Bubble.done = null; if (d) d(); return; }
      Bubble.busy = true;
      const l = Bubble.q.shift(), c = G.CHARS[l.who] || G.CHARS.narr;
      b.querySelector('img').src = IMG(c.face || G.CHARS.nox.face);
      b.querySelector('b').textContent = c.name; b.querySelector('b').style.color = c.color;
      b.querySelector('p').textContent = l.who === 'narr' ? l.text : `「${l.text}」`;
      b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
      const wait = () => { Bubble.t = setTimeout(Bubble.next, 500); };
      if (G.Voice.on && G.Voice.has(l.who, l.text)) G.Voice.say(l.who, l.text, wait);
      else Bubble.t = setTimeout(Bubble.next, 1200 + l.text.length * 70);
    },
    skip() { G.Voice.stop(); Bubble.next(); }
  };

  const UI = {
    pick: null, phase: 'title', holds: new Set(), speed: 1, log: [], sceneQ: [], lastLive: 0,
    init() {
      $('#scene').addEventListener('click', e => { if (!e.target.closest('button')) Talk.next(); });
      $('#sc-next').addEventListener('click', Talk.next);
      $('#sc-skip').addEventListener('click', Talk.skip);
      $('#bubble').addEventListener('click', Bubble.skip);
      $('#btn-new').addEventListener('click', UI.newGame);
      $('#btn-cont').addEventListener('click', () => { G.BGM.start(); if (Game.load()) { UI.holds.add('user'); UI.start(); } });
      $('#btn-fight').addEventListener('click', UI.toggleTime);
      $('#btn-speed').addEventListener('click', () => { UI.speed = UI.speed === 1 ? 2 : UI.speed === 2 ? 0.5 : 1; UI.render(); });
      $('#btn-settings').addEventListener('click', () => $('#settings').classList.toggle('open'));
      $('#set-music').addEventListener('change', e => G.BGM.setMusic(e.target.checked));
      $('#set-voice').addEventListener('change', e => { G.Voice.on = e.target.checked; if (!e.target.checked) G.Voice.stop(); });
      $('#set-sfx').addEventListener('change', e => { G.BGM.sfxOn = e.target.checked; });
      $('#btn-title').addEventListener('click', () => { $('#settings').classList.remove('open'); UI.title(); });
      $('#btn-help').addEventListener('click', () => { $('#settings').classList.remove('open'); $('#help').classList.add('open'); UI.holds.add('help'); });
      $('#help-close').addEventListener('click', () => { $('#help').classList.remove('open'); UI.holds.delete('help'); });
      $('#cards').addEventListener('click', e => { const c = e.target.closest('.icard'); if (c && !c.classList.contains('locked')) UI.startPick(c.dataset.id); });
      $('#fronts').addEventListener('click', e => { const t = e.target.closest('.ftab'); if (t) UI.onFront(t.dataset.id); });
      $('#plist').addEventListener('click', e => { const t = e.target.closest('.pc'); if (t) UI.onChar(t.dataset.id); });
      $('#used').addEventListener('click', e => { if (e.target.closest('.cancel-pick')) UI.cancelPick(); });
      $('#policy').addEventListener('click', e => { const b = e.target.closest('.polb'); if (b && Game.S && G.Mission.setPolicy(Game.S, b.dataset.k)) { G.BGM.sfx('click'); UI.addLog(`神託: ${G.Mission.POLICY[b.dataset.k].name}(${G.Mission.POLICY[b.dataset.k].desc})`, 'story'); } });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') UI.cancelPick();
        if ((e.key === 'Enter' || e.key === ' ') && Talk.lines) { e.preventDefault(); Talk.next(); }
        else if (e.key === ' ' && UI.phase === 'play') { e.preventDefault(); UI.toggleTime(); }
      });
      G.Field.onPrayer = () => { const el = $('#faith-n'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); if (Math.random() < 0.15) G.BGM.sfx('coin'); };
      UI.title();
      let last = 0;
      const loop = ts => { const dt = Math.min(0.1, (ts - (last || ts)) / 1000); last = ts; UI.frame(dt, ts); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    },
    title() { UI.phase = 'title'; $('#title').classList.add('open'); $('#btn-cont').disabled = !Game.hasSave(); G.Voice.stop(); G.Field.running = false; },
    newGame() {
      G.BGM.start(); G.BGM.play('title');
      Game.newGame(); UI.log = []; UI.sceneQ = []; UI.holds = new Set(['tut']);
      $('#title').classList.remove('open');
      Talk.play(G.OPENING, () => { UI.start(); G.Tut.start(); });
    },
    // 最初の動画(女神が光から闇へ)。終わるか「とばす」で次へ
    playVideo(done) {
      const box = $('#intro-video'), v = box.querySelector('video');
      let fin = false; const end = () => { if (fin) return; fin = true; box.classList.add('fade'); setTimeout(() => { v.pause(); box.classList.remove('open', 'fade', 'in'); done(); }, 700); };
      v.src = IMG('assets/video/opening.mp4'); v.currentTime = 0; v.muted = !G.BGM.sfxOn;
      box.classList.add('open'); requestAnimationFrame(() => box.classList.add('in')); G.BGM.play(null);
      v.onended = end; v.onerror = end; box.querySelector('button').onclick = end;
      v.play().catch(() => { v.muted = true; v.play().catch(end); });
    },
    start() {
      $('#title').classList.remove('open');
      UI.phase = 'play';
      G.BGM.play(Game.S.revolt ? 'dark' : 'battle');
      if (G.Field.fit) G.Field.fit();
      G.Field.setState(Game.S, true);
      UI.render();
    },
    running() { return UI.phase === 'play' && !UI.holds.size && !UI.pick && !Talk.lines && !Game.S.ended; },
    toggleTime() {
      if (UI.phase !== 'play') return;
      if (UI.holds.has('user')) UI.holds.delete('user'); else UI.holds.add('user');
      G.Tut.notify('run');
      UI.render();
    },

    // ---- 毎フレーム: 時間を進めて、できごとを見せる ----
    frame(dt, ts) {
      const S = Game.S; if (!S || UI.phase !== 'play') return;
      const run = UI.running();
      G.Field.running = run;
      if (run) {
        const ev = Game.tick(dt / Game.MS * UI.speed);
        for (const e of ev) UI.onEvent(e);
        G.Field.setState(S);
      }
      if (!Talk.lines && UI.sceneQ.length) UI.nextScene();
      if (ts - UI.lastLive > 150) { UI.lastLive = ts; UI.live(); }
    },
    addLog(t, cls) { UI.log.unshift({ t, cls, d: Game.dateText() }); UI.log.length = Math.min(UI.log.length, 12); UI.renderLog(); },
    onEvent(e) {
      const S = Game.S;
      if (e.k === 'news') { UI.addLog(e.t, e.side); if (e.f === S.view) G.Field.float(e.t.replace(/^.*?: /, ''), e.side === 'h' ? 330 : 950, 250, e.side === 'h' ? '#9cc4ff' : '#ff9aa8', 24); }
      else if (e.k === 'act') { UI.addLog(e.t, 'act'); if (G.ACTS[e.who]) Bubble.add([G.ACTS[e.who]]); UI.render(); }
      else if (e.k === 'crisis') {
        Bubble.add(G.CRISIS[e.c](e.f)); UI.addLog({ hWin: '人族が城に迫っている', dWin: '魔族が城を包囲', hFall: '魔族の城が落ちた!', dFall: '人族の城が落ちた!', peace: '和平交渉がはじまった!', peaceDone: '和平が結ばれた' }[e.c] + (e.f ? `(${FR(e.f).short})` : ''), 'warn');
        if (e.c === 'hFall' || e.c === 'dFall') { if (e.f === S.view) G.Field.effect('storm'); }
        UI.render();
      }
      else if (e.k === 'month') { UI.addLog(`${Game.dateText()} になった ・ 先月の祈り +${e.faith}`, 'month'); Game.save(); UI.render(); }
      else if (e.k === 'stage') UI.sceneQ.push({ stage: e });
      else if (e.k === 'story') UI.sceneQ.push({ story: e });
      else if (e.k === 'beat') UI.sceneQ.push({ beat: e.b });
      else if (e.k === 'revoltStart') UI.sceneQ.push({ lines: G.REVOLT_LINES.map(l => Object.assign({ img: 'ev_alliance', bgm: 'dark' }, l)), after: () => G.BGM.play('dark') });
      else if (e.k === 'revoltEnd') UI.sceneQ.push({ lines: G.REVOLT_END.map(l => Object.assign({ img: 'goddess_dark' }, l)), after: () => G.BGM.play('battle') });
      else if (e.k === 'ended') UI.sceneQ.push({ end: e.e });
      else if (e.k === 'mission') {
        UI.addLog(`${e.t} ― ${e.msg}`, e.ok ? 'h' : 'warn');
        G.Field.float(e.res.t, 640, 200, e.ok ? '#ffe9a0' : '#ff7a8a', 44);
        G.Field.effect(e.ok ? 'light' : 'storm');
        G.BGM.sfx(e.ok ? 'light' : 'boom');
        Bubble.add([{ who: 'nox', text: `${e.res.t}。${e.msg}${e.ok ? '。神意が1回復しました' : ''}` }]);
        UI.render();
      }
      else if (e.k === 'mwarn') { UI.addLog(e.t, 'warn'); G.Field.float(e.t, 640, 230, e.hit ? '#ff7a8a' : '#ffcf5a', 28); if (e.hit) { G.Field.effect('storm'); } }
    },
    // 物語の場面を順番に(場面のあいだは時間が止まる)
    nextScene() {
      const S = Game.S, x = UI.sceneQ.shift();
      Bubble.q.length = 0; Bubble.skip();
      if (x.end) return UI.ending(x.end);
      if (x.story) {
        const ev = x.story, e = ev.e, img = G.Story.image(e);
        const first = { img, who: 'narr', text: `―― ${e.title} ――`, big: true, bgm: e.kind === 'demon' || e.kind === 'secret' ? 'dark' : 'title' };
        const lines = [first].concat(e.lines.map(a => Object.assign({ img }, L2(a))));
        UI.addLog(`物語: ${e.title}`, 'story');
        return Talk.play(lines, ch => {
          G.Story.resolve(S, ev, ch);
          const fl = G.Flags && G.Flags.fromChoice(S, e, ch);
          if (fl) UI.addLog({ zephyra_saw_ruin: '記憶: ゼフィラは滅びの夢を見た(次の反撃で先頭に立つ)', allen_saw_miracle: '記憶: アレンは女神の奇跡を見た', trusted_self: '記憶: 自分の力を信じた' }[fl] || '記憶が残った', 'story');
          const c = ch != null && e.choice && e.choice[ch];
          const done = () => {
            G.BGM.play(S.revolt ? 'dark' : 'battle');
            // 物語のつづきは戦場で: ミッションが始まる
            const m = G.Mission && G.Mission.start(S, ev, ch);
            if (m) { if (m.policyNote) UI.addLog(m.policyNote, 'story'); S.view = m.f; UI.addLog(`ミッション: ${m.goal}`, 'warn'); Bubble.add([{ who: 'nox', text: `${m.goal}。ミッション中はカードの効果が変わります。神意は回復しません。` }]); if (m.note) UI.addLog(m.note, 'story'); if (m.flagNote) UI.addLog(m.flagNote, 'story'); }
            else if (e.at) S.view = e.at;
            G.Field.setState(S, true); UI.render(); Game.save();
          };
          if (c && c.lines && c.lines.length) Talk.play(c.lines.map(a => Object.assign({ img }, L2(a))), done); else done();
        }, e.choice ? e.choice.map(c => c.label) : null);
      }
      if (x.stage) {
        const who = x.stage.who, st = x.stage.stage, list = (G.STORY && G.STORY.stages && G.STORY.stages[who]) || [];
        const opts = list.filter(o => o.stage === st), o = opts[Math.floor(Math.random() * opts.length)];
        const names = who === 'allen' ? ['', '見習い剣士', '希望の勇者', '聖剣の勇者', '暁の英雄', '神殺しの勇者'] : ['', '夢に導かれた魔王', '魔族の覇者', '覚醒魔王', '真なる魔王', '神殺しの魔王'];
        const img = who === 'allen' ? 'ev_holy' : 'ev_cursed_castle';
        const lines = [{ img, who: 'narr', text: `${G.CHARS[who].name} 覚醒 ―― 「${(o && o.name) || names[st]}」`, big: true, flash: true }]
          .concat(o ? o.lines.map(a => Object.assign({ img }, L2(a))) : [Object.assign({ img }, who === 'allen' ? { who: 'allen', text: 'みんなの想いが、ぼくに力をくれる!' } : { who: 'zephyra', text: 'この力……もう、だれにも負けない!' })]);
        UI.addLog(`${G.CHARS[who].short}が「${(o && o.name) || names[st]}」になった`, who === 'allen' ? 'h' : 'd');
        return Talk.play(lines, () => { S.view = S.chars[who].at; G.Field.setState(S, true); G.Field.effect(who === 'allen' ? 'light' : 'dark'); G.BGM.play('battle'); UI.render(); });
      }
      if (x.beat) { const b = x.beat; return Talk.play([{ img: b.img, who: 'narr', text: `―― ${b.title} ――`, big: true, bgm: 'dark' }].concat(b.lines.map(l => Object.assign({ img: b.img }, l))), () => { G.BGM.play('battle'); UI.render(); }); }
      if (x.lines) return Talk.play(x.lines, () => { if (x.after) x.after(); UI.render(); });
    },

    // ---- 画面を作りなおす(できごとのとき) ----
    render() {
      const S = Game.S; if (!S) return;
      // 戦線の札
      $('#fronts').innerHTML = S.fronts.map(fr => {
        const tg = UI.pick && UI.pick.want === 'front';
        return `<button class="ftab${S.view === fr.id ? ' on' : ''}${tg ? ' targetable' : ''}" data-id="${fr.id}">
          <span class="fn">${FR(fr.id).name}<small class="ftr">${FR(fr.id).trait}: ${FR(fr.id).traitDesc}</small></span>
          <span class="fg"><span class="fz"></span><span class="fm"></span></span>
          <span class="fs"></span><span class="fos"></span>
          <span class="fc">${Game.charsAt(fr.id).map(id => `<img src="${IMG(G.CHARS[id].face)}" class="${G.CHARS[id].side}" title="${G.CHARS[id].name}" alt="">`).join('')}</span></button>`;
      }).join('');
      // 人物
      $('#plist').innerHTML = G.KEY_CHARS.map(id => {
        const c = S.chars[id], d = G.CHARS[id];
        const tg = UI.pick && UI.pick.want === 'char' && UI.pick.targets.includes(id);
        const stage = id === 'allen' ? S.grow.hs : id === 'zephyra' ? S.grow.ds : 0;
        return `<button class="pc ${d.side}${c.alive ? '' : ' dead'}${tg ? ' targetable' : ''}" data-id="${id}" ${c.alive ? '' : 'disabled'}>
          <img src="${IMG(d.face)}" alt=""><span class="pi"><b style="color:${d.color}">${d.name}${stage ? ` <i class="stg">★${stage}</i>` : ''}</b>
          <small class="pw"></small>
          ${d.side === 'h' ? `<span class="pb t"><i></i><em>信頼</em></span>` : ''}
          <span class="pb d"><i></i><em>疑念</em></span></span></button>`;
      }).join('');
      // カード
      $('#cards').innerHTML = Object.keys(CAT).map(cat => `<div class="col ${cat}"><div class="ch"><b>${CAT[cat].t}</b><small>${CAT[cat].s}</small></div>` +
        G.CARDS.filter(c => c.cat === cat && (!c.needText || (c.need && c.need(S)) || c.id === 'forget')).map(c => {
          const on = UI.pick && UI.pick.card.id === c.id;
          const mf = G.Mission && G.Mission.cardFx(S, c);
          if (S.mission) return `<button class="icard mcard${mf ? '' : ' off'}" data-id="${c.id}" title="${esc(c.desc)}">
            <span class="cn">${c.name}</span><span class="cc">${mf ? `信仰${c.cost} 神意${mf.f}` : ''}</span>
            <span class="ct">${mf ? 'ミッション中の効果' : 'ミッション中は使えない'}</span><span class="cx">${mf ? `<i class="mx">${esc(mf.txt)}</i>` : ''}</span>
            <span class="cw"></span><span class="cdbar"></span></button>`;
          return `<button class="icard${on ? ' on' : ''}" data-id="${c.id}" title="${esc(c.desc)}">
            <span class="cn">${c.name}</span><span class="cc">${S.tutMode ? '無料' : `信仰${c.cost} 神意${Game.FOCUS[c.id] ?? 1}`}</span>
            <span class="ct">${TGT[c.target]}</span><span class="cx">${c.chips.map(x => x[0] === '!' ? `<i class="bad">${x.slice(1)}</i>` : `<i>${x}</i>`).join('')}</span>
            <span class="cw"></span><span class="cdbar"></span></button>`;
        }).join('') + '</div>').join('');
      $('#btn-speed').textContent = `速さ ×${UI.speed}`;
      const ph = $('#pick-hint');
      if (UI.pick) { ph.textContent = (UI.pick.want === 'front' ? (UI.pick.card.target === 'move' ? `${G.CHARS[UI.pick.who].short}をどの戦線へ? 上の札をクリック` : '「' + UI.pick.card.name + '」をどの戦線に? 上の札をクリック') : '「' + UI.pick.card.name + '」をだれに? 左の人物をクリック') + '(えらぶ間、時間は止まっています)'; ph.classList.add('on'); }
      else ph.classList.remove('on');
      UI.renderLog();
      UI.live();
    },
    renderLog() {
      const adv = UI.advice();
      $('#used').innerHTML = (UI.pick ? `<button class="cancel-pick link">えらぶのをやめる</button>` : '') + `<div class="adv">${esc(adv)}</div>` +
        (UI.log.map(l => `<div class="u ${l.cls || ''}">${esc(l.t)}</div>`).join('') || '<div class="u none">まだ何も起きていない</div>');
    },
    // ---- 数字やバーだけを軽く書きかえる(何回呼んでもクリックをじゃましない) ----
    live() {
      const S = Game.S; if (!S) return;
      $('#faith-n').textContent = Math.round(S.faith);
      $('#sus-n').textContent = Math.round(Game.avgDoubt());
      $('#sus-bar').style.width = Game.avgDoubt() + '%';
      const frac = S.time - Math.floor(S.time);
      $('#acts').innerHTML = `<span class="tbar"><i style="width:${frac * 100}%"></i></span>`;
      $('#gface').classList.toggle('slipping', !!S.revolt || Game.avgDoubt() > 55);
      $('#date').textContent = `第${Game.chapter()}章 ・ ${Game.dateText()}`;
      const left = Game.GOAL - S.month;
      $('#goal').innerHTML = (left > 0 ? `あと${Math.floor(left / 12) ? Math.floor(left / 12) + '年' : ''}${left % 12 ? left % 12 + 'か月' : ''}` : '5年達成!') + ` ・ 祈り <b class="${S.total >= Game.FAITH_GOAL ? 'ok' : ''}">${Math.round(S.total)}/${Game.FAITH_GOAL}</b>`;
      for (const el of $$('.ftab')) {
        const fr = Game.front(el.dataset.id), z = Game.zone(fr.f);
        el.querySelector('.fm').style.left = (fr.f + 100) / 2 + '%';
        const fs = el.querySelector('.fs'), t = z.t + (!fr.castle.h ? ' ・人族の城 陥落' : '') + (!fr.castle.d ? ' ・魔族の城 陥落' : '');
        if (fs.textContent !== t) { fs.textContent = t; fs.className = 'fs z-' + z.k; }
        el.classList.toggle('danger', z.k === 'far');
        const om = (S.omens || []).filter(o => o.f === fr.id).map(o => `${G.OMENS[o.k].icon} ${G.OMENS[o.k].t}(あと${Math.max(1, Math.ceil(o.eta * Game.MS / UI.speed))}秒)`).join(' / ');
        const fo = el.querySelector('.fos'); if (fo.textContent !== om) { fo.textContent = om; fo.className = 'fos' + (om ? ' on ' + (S.omens.find(o => o.f === fr.id) || {}).k : ''); }
      }
      // 神託の方針
      const pol = $('#policy'), PL = G.Mission && G.Mission.POLICY;
      if (pol && PL) {
        const html = S.mission ? '' : S.policy ? `<div class="pol on">神託「${PL[S.policy.k].name}」 のこり${Math.ceil(S.policy.left * Game.MS / UI.speed)}秒</div>`
          : `<div class="pol-h">神託の方針(次のミッションの準備)</div><div class="pols">${Object.keys(PL).map(k => `<button class="polb" data-k="${k}" title="${esc(PL[k].desc)}">${PL[k].name}</button>`).join('')}</div>`;
        if (pol.dataset.k !== html) { pol.innerHTML = html; pol.dataset.k = html; }
      }
      // 神意
      $('#focus').innerHTML = Array.from({ length: Game.FOCUS_MAX }, (_, i) => `<i class="${i < Math.floor(S.focus) ? 'on' : i < S.focus ? 'part' : ''}" style="--p:${Math.max(0, Math.min(1, S.focus - i)) * 100}%"></i>`).join('');
      // ミッション
      const M = S.mission, mb = $('#mission');
      mb.classList.toggle('on', !!M);
      if (M) {
        const d = G.Mission.DEF[M.type], A = d.a, B = d.b;
        const bar = (g) => { const v = Math.round(M[g.k]), mx = g.max || 100; return `<span class="mbar ${g.bad ? 'bad' : 'good'}${g.bad && v >= 70 ? ' hot' : ''}"><i style="width:${v / mx * 100}%"></i><em>${g.name} ${v}${g.max ? '/' + g.max + '秒' : ''}</em></span>`; };
        const nx = M.events.find(x => !x.done && x.t > M.t);
        const html = `<b>⚔ ${d.name}「${esc(M.title)}」</b><span class="mg">${esc(M.goal)}</span>${bar(A)}${bar(B)}
          <span class="mtime"><i style="width:${Math.max(0, 100 - M.t / G.Mission.LEN * 100)}%"></i><em>のこり ${Math.max(0, Math.ceil((G.Mission.LEN - M.t) / UI.speed))}秒${nx ? ` ・ ${Math.ceil((nx.t - M.t) / UI.speed)}秒後: ${esc(nx.msg)}` : ''}</em></span>`;
        if (mb.dataset.k !== html) { mb.innerHTML = html; mb.dataset.k = html; }
        for (const el of $$('.ftab')) el.classList.toggle('mission', el.dataset.id === M.f);
      } else for (const el of $$('.ftab.mission')) el.classList.remove('mission');
      const pt = S.omens && S.omens.find(o => o.k === 'peaceTalk');
      $('#peace-warn').textContent = S.peace ? `🕊 和平交渉中! あと${S.peace.left}か月で戦争が終わる →「和平の妨害」` : pt ? `🕊 王が和平の準備中(あと${Math.ceil(pt.eta * Game.MS / UI.speed)}秒)。戦場を激しくすれば止まる` : S.revolt ? `⚔ 神殺しの同盟 ${Math.round(S.revolt.v)}/100` : '';
      $('#peace-warn').classList.toggle('on', !!(S.peace || pt || S.revolt));
      for (const el of $$('.pc')) {
        const c = S.chars[el.dataset.id]; if (!c) continue;
        const pw = el.querySelector('.pw'), t = c.alive ? `${FR(c.at).short}にいる ・ 力${Math.round(c.power)}${c.weapon ? ' ・聖剣' : ''}` : 'たおれた';
        if (pw.textContent !== t) pw.textContent = t;
        const tb = el.querySelector('.pb.t i'); if (tb) tb.style.width = c.trust + '%';
        el.querySelector('.pb.d i').style.width = c.doubt + '%';
        el.querySelector('.pb.d em').textContent = '疑念 ' + Math.round(c.doubt);
        el.classList.toggle('doubting', c.doubt >= 50);
      }
      for (const el of $$('.icard')) {
        const c = G.CARDS.find(x => x.id === el.dataset.id), why = UI.phase === 'play' ? Game.cardState(c) : ' ';
        el.classList.toggle('locked', !!why);
        const cw = el.querySelector('.cw'), t = why && why !== ' ' ? why : '';
        if (cw.textContent !== t) cw.textContent = t;
        const cd = S.cd[c.id] || 0, max = Game.CD[c.id] || 1;
        el.querySelector('.cdbar').style.width = cd > 0 ? (cd / max * 100) + '%' : '0';
      }
      const paused = UI.holds.has('user');
      $('#btn-fight').textContent = Game.S.ended ? '物語は終わった' : paused ? '▶ 時間を動かす' : UI.pick ? '⏸ えらんでいます' : '⏸ 一時停止';
      $('#btn-fight').classList.toggle('paused', paused);
    },

    // ---- 介入の対象えらび(えらぶ間は時間が止まる) ----
    startPick(id) {
      if (UI.phase !== 'play') return;
      const card = G.CARDS.find(c => c.id === id);
      const why = Game.cardState(card); if (why) return;
      G.BGM.sfx('click');
      if (card.target === 'none' || (G.Mission && G.Mission.cardFx(Game.S, card))) { UI.pick = null; return UI.doPlay(card); }
      const want = card.target === 'front' ? 'front' : 'char';
      UI.pick = { card, want, targets: Game.targetsFor(card) };
      UI.render();
      G.Tut.notify('card:' + id);
    },
    cancelPick() { UI.pick = null; UI.render(); },
    onFront(id) {
      const S = Game.S;
      if (UI.pick && UI.pick.want === 'front') {
        const p = UI.pick; UI.pick = null;
        if (p.card.target === 'move') return UI.doPlay(p.card, p.who, id);
        return UI.doPlay(p.card, id);
      }
      if (UI.phase === 'play') { S.view = id; G.Field.setState(S); UI.render(); G.Tut.notify('view:' + id); }
    },
    onChar(id) {
      const S = Game.S;
      if (UI.pick && UI.pick.want === 'char') {
        if (!UI.pick.targets.includes(id)) return;
        if (UI.pick.card.target === 'move') { UI.pick.who = id; UI.pick.want = 'front'; UI.render(); return; }
        const p = UI.pick; UI.pick = null;
        return UI.doPlay(p.card, id);
      }
      if (UI.phase === 'play' && S.chars[id].alive) { S.view = S.chars[id].at; G.Field.setState(S); UI.render(); }
    },
    doPlay(card, target, target2) {
      const S = Game.S;
      const r = Game.play(card, target, target2);
      if (!r.ok) { UI.render(); return; }
      if (r.where && card.target !== 'move') S.view = r.where;
      if (card.target === 'move') S.view = target2;
      G.Field.setState(S);
      if (card.fx) G.Field.effect(card.fx);
      if (card.cat !== 'miracle') { const b = $('#gface'); b.classList.remove('reveal'); void b.offsetWidth; b.classList.add('reveal'); }
      const a = r.after.find(x => x.id === S.view), bf = r.before.find(x => x.id === S.view);
      if (a && bf) {
        const dh = Math.round(a.h - bf.h), dd = Math.round(a.d - bf.d);
        if (dh) G.Field.float(`人族の力 ${dh > 0 ? '+' : ''}${dh}`, 330, 300, dh > 0 ? '#9cc4ff' : '#8a9ab8', 30);
        if (dd) G.Field.float(`魔族の力 ${dd > 0 ? '+' : ''}${dd}`, 950, 300, dd > 0 ? '#ff9aa8' : '#a88a90', 30);
      }
      UI.addLog(`女神: ${card.name}${r.where ? '(' + FR(r.where).short + ')' : ''}`, card.cat);
      if (r.mfx) G.Field.float(r.mfx.txt.replace(/^.*?: /, ''), 640, 170, '#ffe9a0', 26);
      UI.render();
      Bubble.add(r.lines || []);
      G.Tut.notify('play:' + card.id + ':' + (card.target === 'front' ? target : ''));
      Game.save();
    },
    advice() {
      const S = Game.S; if (!S) return '';
      if (S.revolt) return 'ノクス: 神殺しの同盟です! 「記憶の改ざん」で勇者か魔王の疑念を下げるか、「神罰」で討ってください。';
      if (S.peace) return `ノクス: 和平交渉が進んでいます(あと${S.peace.left}か月)。「和平の妨害」で止めてください!`;
      const hi = S.fronts.slice().sort((a, b) => Math.abs(b.f) - Math.abs(a.f))[0];
      if (hi.f > 55) return `ノクス: ${FR(hi.id).name}で人族が勝ちすぎです。魔族に力を与えるか、天災で止めましょう。`;
      if (hi.f < -55) return `ノクス: ${FR(hi.id).name}で魔族が勝ちすぎです。人族を助けましょう。`;
      const dc = Game.alive().sort((a, b) => b.doubt - a.doubt)[0];
      if (dc && dc.doubt > 55) return `ノクス: ${G.CHARS[dc.id].name}の疑念が高まっています。記憶の改ざんを。`;
      return 'ノクス: 戦況は望みどおりです。札の「予兆」を見て、先回りしましょう。';
    },
    ending(key) {
      const S = Game.S, route = (S.story && S.story.route) || (S.support.h - S.support.d >= 25 ? 'hero' : S.support.h - S.support.d <= -25 ? 'demon' : 'balance');
      const e = G.ENDINGS[key];
      UI.phase = 'end'; G.Field.running = false;
      G.BGM.play(e.win ? 'ending' : 'dark');
      const se = G.STORY && G.STORY.endings && G.STORY.endings[key];
      const sl = se ? (Array.isArray(se) ? se : se[route] || se.balance) : null;
      const lines = sl && sl.length ? sl.map(a => Object.assign({ img: e.img }, L2(a))) : e.lines.map(l => Object.assign({ img: e.img }, l));
      Talk.play(lines, () => {
        const c = S.counts, rn = { hero: '勇者寄り', demon: '魔王寄り', balance: '均衡' }[route];
        $('#end-card').innerHTML = `<div class="end-img" style="background-image:url('${imgOf(e.img)}')"></div><div class="end-sub ${e.win ? 'good' : 'bad'}">${e.sub}</div><h2>${esc(e.title)}</h2>
          <div class="end-stats"><span>${Game.dateText(Math.max(0, S.month - 1))}まで</span><span>ルート <b>${rn}</b></span><span>集めた祈り <b>${Math.round(S.total)}</b></span><span>勇者 ★${S.grow.hs} / 魔王 ★${S.grow.ds}</span><span>見た物語 <b>${(S.story && S.story.seen.length) || 0}</b></span><span>奇跡 ${c.miracle} ・ 囁き ${c.whisper} ・ 運命 ${c.fate}</span></div>
          <div class="end-btns">${e.win ? '<button id="end-cont">このまま続ける</button>' : ''}<button class="primary" id="end-new">もう一度はじめから(物語が変わります)</button></div>`;
        $('#ending').classList.add('open');
        const ec = $('#end-cont'); if (ec) ec.onclick = () => { $('#ending').classList.remove('open'); S.ended = null; UI.phase = 'play'; UI.render(); };
        $('#end-new').onclick = () => { $('#ending').classList.remove('open'); Game.clearSave(); UI.title(); };
      });
    }
  };

  // ---- チュートリアル(ノクスが案内。実際にカードを使わせる) ----
  const STEPS = [
    { el: '#stage', key: 't0', wait: 'next' },
    { el: '#fronts', key: 't1', wait: 'next' },
    { el: '#people', key: 't2', wait: 'next' },
    { el: '[data-id="light"].icard', key: 't3', wait: 'card:light' },
    { el: '.ftab[data-id="center"]', key: 't4', wait: 'play:light:center' },
    { el: '[data-id="horde"].icard', key: 't5', wait: 'card:horde' },
    { el: '.ftab[data-id="south"]', key: 't5b', wait: 'play:horde:south' },
    { el: '#plist', key: 't6', wait: 'next' },
    { el: '#btn-fight', key: 't7', wait: 'run' },
    { el: '#stage', key: 't8', wait: 'next' }
  ];
  const T = {
    active: false, i: 0,
    start() { const S = Game.S; T.active = true; T.i = 0; S.tutMode = true; UI.holds.add('tut'); UI.holds.add('user'); $('#coach').classList.add('on'); UI.render(); T.show(); },
    show() {
      const st = STEPS[T.i], l = G.TUT_LINES[st.key];
      $('#coach-text').textContent = l.text;
      $('#coach-next').style.display = st.wait === 'next' ? '' : 'none';
      G.Voice.say(l.who, l.text);
      T.place();
    },
    place() {
      const st = STEPS[T.i]; if (!st) return;
      const el = document.querySelector(st.el), spot = $('#coach-spot'), bub = $('#coach-bubble');
      if (!el) return;
      const r = el.getBoundingClientRect(), pad = 6;
      Object.assign(spot.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
      const bw = Math.min(440, innerWidth - 24), bh = bub.offsetHeight || 150;
      let top = r.bottom + 12; if (top + bh > innerHeight - 8) top = r.top - bh - 12; if (top < 8) top = 8;
      if (r.height > innerHeight * 0.45) top = Math.min(innerHeight - bh - 8, r.top + 20);
      const left = G.clamp(r.left + r.width / 2 - bw / 2, 12, innerWidth - bw - 12);
      Object.assign(bub.style, { left: left + 'px', top: top + 'px', width: bw + 'px' });
    },
    notify(ev) {
      if (!T.active) return;
      const st = STEPS[T.i];
      if (st.wait === ev || (st.wait.startsWith('play:horde') && ev.startsWith('play:horde'))) setTimeout(T.next, ev.startsWith('play') ? 900 : 150);
    },
    next() { if (!T.active) return; T.i++; if (T.i >= STEPS.length) return T.finish(); T.show(); },
    finish() { const S = Game.S; T.active = false; S.tutMode = false; UI.holds.delete('tut'); UI.holds.delete('user'); $('#coach').classList.remove('on'); G.Voice.stop(); UI.render(); },
    init() {
      $('#coach-next').addEventListener('click', T.next);
      $('#coach-skip').addEventListener('click', T.finish);
      setInterval(() => T.active && T.place(), 300);
    }
  };
  G.Tut = T; G.UI = UI; G.Talk = Talk; G.Bubble = Bubble;
})(globalThis.G2 = globalThis.G2 || {});
