// 画面の流れ: タイトル → オープニング → (毎月)出来事 → 3択 → 演出 → 戦い → 結果 → 次の月
(function (G) {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const Game = G.Game;
  const imgOf = k => { if (!k) return ''; const p = /^(scene_|goddess_|ev_|face_)/.test(k) ? `assets/img/${k}.jpg` : k; return (G.IMG && G.IMG[p]) || p; };
  const CAT = { miracle: { t: '神の奇跡', c: 'miracle' }, whisper: { t: '邪神の囁き', c: 'whisper' }, fate: { t: '運命の操作', c: 'fate' }, none: { t: '何もしない', c: 'none' } };

  const OPENING = [
    { img: 'scene_peace', who: 'narr', text: 'かつて、この世界には人族しかいなかった。人族は王国を築き、平和に暮らしていた。' },
    { img: 'scene_war', who: 'narr', text: 'ある日、「魔族」と呼ばれる者たちがあらわれた。魔族は人族の国々を襲い、世界は戦乱に包まれた。' },
    { img: 'ev_pillar', who: 'narr', text: 'そのとき、人族の前に女神があらわれた。' },
    { img: 'goddess_light', who: 'goddess', text: '恐れることはありません。私があなたたちを守りましょう。' },
    { img: 'ev_holy', who: 'narr', text: '女神は奇跡を与え、勇者を生んだ。人族は女神を、救いの神とあがめた。' },
    { img: 'ev_cursed_castle', who: 'narr', text: '一方、魔族を率いる魔王もまた、なぞの声から力を授かっていた。戦争は、何十年たっても終わらなかった。' },
    { img: 'dark', who: 'narr', text: '人族を救った女神。魔王に力を与えた、なぞの声。その正体は――' },
    { img: 'goddess_dark', who: 'goddess_dark', text: 'どちらも、私よ。', flash: true, bgm: 'dark' },
    { img: 'goddess_dark', who: 'goddess_dark', text: '戦いがつづけば、人はおそれ、祈る。その祈りが、私の力になるの。' },
    { img: 'goddess_dark', who: 'goddess_dark', text: '人族には希望を。魔族には憎しみを。勝者はいらない。敗者もいらない。' },
    { img: 'goddess_dark', who: 'goddess_dark', text: 'この戦争がつづく限り、私は永遠に存在できるのだから。' },
    { img: 'dark', who: 'narr', text: 'あなたは、この女神です。人族と魔族を裏からあやつり、戦争を5年つづけてください。', big: true }
  ];

  // ---- セリフを順番に見せて、声で読む ----
  const Talk = {
    lines: null, i: 0, done: null, box: null, typing: null,
    play(lines, box, done) {
      Talk.lines = lines; Talk.i = 0; Talk.done = done; Talk.box = box;
      Talk.show();
    },
    show() {
      const l = Talk.lines[Talk.i], box = Talk.box, c = G.CHARS[l.who] || G.CHARS.narr;
      const face = box.querySelector('.t-face'), name = box.querySelector('.t-name'), text = box.querySelector('.t-text');
      if (face) { if (c.face) { face.src = c.face; face.style.display = ''; face.className = 't-face ' + l.who; } else face.style.display = 'none'; }
      if (name) { name.textContent = c.name; name.style.color = c.color; name.style.display = c.name ? '' : 'none'; }
      const full = l.who === 'narr' ? l.text : `「${l.text}」`;
      text.className = 't-text' + (l.who === 'narr' ? ' narr' : '') + (l.big ? ' big' : '');
      clearInterval(Talk.typing); let n = 0; text.textContent = '';
      Talk.typing = setInterval(() => { n += 2; text.textContent = full.slice(0, n); if (n >= full.length) clearInterval(Talk.typing); }, 28);
      Talk.full = full;
      box.classList.add('talking');
      if (l.img && Talk.onImg) Talk.onImg(l);
      G.Voice.say(l.who, l.text, () => { if (UI.auto && Talk.lines && Talk.lines[Talk.i] === l) setTimeout(() => { if (Talk.lines && Talk.lines[Talk.i] === l) Talk.next(); }, 700); });
    },
    next() {
      if (!Talk.lines) return;
      const text = Talk.box.querySelector('.t-text');
      if (text.textContent.length < Talk.full.length) { clearInterval(Talk.typing); text.textContent = Talk.full; return; }
      G.BGM.sfx('click');
      Talk.i++;
      if (Talk.i >= Talk.lines.length) { const d = Talk.done; Talk.lines = null; Talk.box.classList.remove('talking'); G.Voice.stop(); if (d) d(); return; }
      Talk.show();
    }
  };

  const UI = {
    auto: false, phase: 'title',
    init() {
      $('#card').addEventListener('click', e => { if (e.target.closest('button')) return; if (UI.phase === 'talk') Talk.next(); });
      $('#scene').addEventListener('click', e => { if (e.target.closest('button')) return; Talk.next(); });
      $('#sc-next').addEventListener('click', () => Talk.next());
      $('#sc-skip').addEventListener('click', () => { if (Talk.lines) { Talk.i = Talk.lines.length - 1; Talk.full = ''; Talk.next(); } });
      document.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { if (Talk.lines) { e.preventDefault(); Talk.next(); } else if (UI.phase === 'result') { e.preventDefault(); UI.nextMonth(); } }
        if (UI.phase === 'choose' && /^[1-3]$/.test(e.key)) { const b = document.querySelectorAll('#choices .choice')[+e.key - 1]; if (b && !b.disabled) b.click(); }
      });
      $('#btn-new').addEventListener('click', () => UI.newGame());
      $('#btn-cont').addEventListener('click', () => { G.BGM.start(); if (Game.load()) UI.startPlay(true); });
      $('#btn-settings').addEventListener('click', () => $('#settings').classList.toggle('open'));
      $('#set-music').addEventListener('change', e => G.BGM.setMusic(e.target.checked));
      $('#set-voice').addEventListener('change', e => { G.Voice.on = e.target.checked; if (!e.target.checked) G.Voice.stop(); });
      $('#set-sfx').addEventListener('change', e => { G.BGM.sfxOn = e.target.checked; });
      $('#set-auto').addEventListener('change', e => { UI.auto = e.target.checked; });
      $('#btn-title').addEventListener('click', () => { $('#settings').classList.remove('open'); UI.title(); });
      $('#btn-help').addEventListener('click', () => { $('#settings').classList.remove('open'); $('#help').classList.add('open'); });
      $('#help-close').addEventListener('click', () => $('#help').classList.remove('open'));
      G.Field.onPrayer = () => { const el = $('#faith-n'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); if (Math.random() < 0.3) G.BGM.sfx('coin'); };
      Talk.onImg = l => { if ($('#scene').classList.contains('open')) UI.sceneImg(l.img, l.flash); if (l.bgm) G.BGM.play(l.bgm); };
      UI.title();
    },
    title() {
      UI.phase = 'title';
      $('#title').classList.add('open');
      $('#btn-cont').disabled = !Game.hasSave();
      G.Voice.stop();
    },
    newGame() {
      G.BGM.start(); G.BGM.play('title');
      Game.newGame();
      $('#title').classList.remove('open');
      UI.scene(OPENING, () => UI.startPlay(false));
    },
    startPlay(loaded) {
      $('#title').classList.remove('open');
      G.Field.setState(Game.S, true);
      UI.refresh();
      if (Game.S.ended) return UI.ending(Game.S.ended);
      UI.monthStart();
    },

    // ---- 物語の場面(画面いっぱい) ----
    scene(lines, done) {
      UI.phase = 'scene';
      $('#scene').classList.add('open');
      Talk.play(lines, $('#scene'), () => { $('#scene').classList.remove('open'); if (done) done(); });
    },
    sceneImg(k, flash) {
      const bg = $('#sc-bg');
      if (k === 'dark') { bg.style.backgroundImage = 'none'; bg.className = 'sc-bg'; }
      else { bg.style.backgroundImage = `url("${imgOf(k)}")`; bg.className = 'sc-bg' + (/^goddess/.test(k) ? ' contain' : ''); }
      if (flash) { const s = $('#scene'); s.classList.remove('flash'); void s.offsetWidth; s.classList.add('flash'); G.BGM.sfx('boom'); }
    },

    // ---- 1か月 ----
    monthStart() {
      const S = Game.S;
      G.BGM.play(S.revoltOn ? 'dark' : 'field');
      UI.refresh();
      const ev = Game.pickEvent();
      UI.ev = ev;
      $('#card').className = 'card';
      $('#choices').innerHTML = '';
      $('#month-label').textContent = Game.dateText();
      $('#ev-img').style.backgroundImage = ev.img ? `url("${imgOf(ev.img)}")` : 'none';
      UI.phase = 'talk';
      $('#card-hint').textContent = 'クリックで次へ';
      Talk.play(ev.lines, $('#card'), () => UI.showChoices(ev));
    },
    chips(c) {
      const out = [];
      if (c.cost) out.push(`<span class="chip cost">信仰 -${c.cost}</span>`);
      if (c.faith) out.push(`<span class="chip faith">信仰 +${c.faith}</span>`);
      if (c.h > 0) out.push(`<span class="chip h">人族 ${'▲'.repeat(c.h >= 40 ? 3 : c.h >= 20 ? 2 : 1)}</span>`);
      if (c.h < 0) out.push(`<span class="chip h neg">人族 ${'▼'.repeat(c.h <= -25 ? 2 : 1)}</span>`);
      if (c.d > 0) out.push(`<span class="chip d">魔族 ${'▲'.repeat(c.d >= 40 ? 3 : c.d >= 20 ? 2 : 1)}</span>`);
      if (c.d < 0) out.push(`<span class="chip d neg">魔族 ${'▼'.repeat(c.d <= -25 ? 2 : 1)}</span>`);
      if (c.f) out.push(`<span class="chip">前線 ${c.f > 0 ? '→' : '←'}</span>`);
      if (c.sus > 0) out.push(`<span class="chip sus">疑念 +${c.sus}</span>`);
      if (c.sus < 0) out.push(`<span class="chip good">疑念 ${c.sus}</span>`);
      if (c.warn) out.push(`<span class="chip warn">${esc(c.warn)}</span>`);
      return out.join('');
    },
    showChoices(ev) {
      UI.phase = 'choose';
      $('#card-hint').textContent = 'どうする? えらんでください';
      const h = ev.choices.map((c, i) => {
        const why = Game.canChoose(c), cat = CAT[c.cat || 'none'];
        return `<button class="choice ${cat.c}${why ? ' locked' : ''}" data-i="${i}" ${why ? 'disabled' : ''}>
          <span class="c-cat">${cat.t}</span><span class="c-label">${i + 1}. ${esc(c.label)}${c.hint ? `<em>${esc(c.hint)}</em>` : ''}</span>
          <span class="c-chips">${UI.chips(c)}</span>${why ? `<span class="c-why">${esc(why)}</span>` : ''}</button>`;
      }).join('');
      $('#choices').innerHTML = h;
      $('#card').classList.add('choosing');
      document.querySelectorAll('#choices .choice').forEach(b => b.addEventListener('click', () => UI.pick(ev, ev.choices[+b.dataset.i])));
    },
    pick(ev, c) {
      if (UI.phase !== 'choose') return;
      UI.phase = 'react';
      G.BGM.sfx('click');
      $('#choices').innerHTML = '';
      $('#card').classList.remove('choosing');
      const res = Game.choose(ev, c);
      if (c.fx) G.Field.effect(c.fx);
      if (c.cat === 'whisper' || c.cat === 'fate') UI.mask();
      G.Field.setState(Game.S);
      // 力の変化を戦場に浮かべる
      const dh = Math.round(res.after.h - res.before.h), dd = Math.round(res.after.d - res.before.d);
      if (dh) G.Field.float(`人族 ${dh > 0 ? '+' : ''}${dh}`, 330, 300, dh > 0 ? '#9cc4ff' : '#7a8aa8', 30);
      if (dd) G.Field.float(`魔族 ${dd > 0 ? '+' : ''}${dd}`, 950, 300, dd > 0 ? '#ff9aa8' : '#a87a80', 30);
      UI.refresh();
      const reply = c.reply || [];
      const after = () => UI.battle();
      if (reply.length) { UI.phase = 'talk'; $('#card-hint').textContent = 'クリックで次へ'; Talk.play(reply, $('#card'), after); }
      else after();
    },
    mask() { const b = $('#gface'); b.classList.remove('reveal'); void b.offsetWidth; b.classList.add('reveal'); },
    battle() {
      UI.phase = 'battle';
      const S = Game.S;
      $('#card').className = 'card battle';
      $('#card-hint').textContent = '';
      G.BGM.play(S.revoltOn ? 'dark' : 'battle');
      const r = Game.battle();
      UI.lastR = r;
      const ms = S.revoltOn ? 2200 : 4800;
      G.Field.battle(r, ms);
      G.Field.setState(S);
      $('#card .t-face').style.display = 'none'; $('#card .t-name').style.display = 'none';
      $('#card .t-text').className = 't-text narr';
      $('#card .t-text').textContent = S.revoltOn ? '神殺しの同盟が、天へとのぼってくる……' : '戦いがはじまった! 人族の祈りの光が、女神のもとへ集まっていく……';
      // 信仰の数字をだんだん増やす
      const f0 = S.faith - r.faith; let k = 0;
      const tick = setInterval(() => { k++; $('#faith-n').textContent = Math.round(f0 + r.faith * Math.min(1, k / 40)); if (k >= 40) clearInterval(tick); }, ms / 44);
      setTimeout(() => UI.result(r), ms + 200);
    },
    result(r) {
      UI.phase = 'result';
      const S = Game.S;
      UI.refresh();
      G.BGM.play(S.revoltOn ? 'dark' : 'field');
      const df = Math.round(r.f1 - r.f0);
      const z = Game.zone(S.f);
      let h = `<div class="res-title">${Game.dateText(S.month - 1)} の結果</div><div class="res-grid">`;
      if (!S.revoltOn) {
        h += `<div><small>前線</small><b class="${df > 0 ? 'h' : df < 0 ? 'd' : ''}">${df === 0 ? '動かず' : df > 0 ? `人族が ${df} 前進` : `魔族が ${-df} 前進`}</b></div>`;
        h += `<div><small>戦況</small><b class="z-${z.k}">${z.t}</b></div>`;
        h += `<div><small>戦死者</small><b>人族 ${r.lossH} / 魔族 ${r.lossD}</b></div>`;
      } else h += `<div><small>神殺しの同盟</small><b class="z-far">${Math.round(Math.max(0, S.revolt))} / 100</b></div>`;
      h += `<div><small>集まった祈り</small><b class="faith">信仰 +${r.faith}</b></div></div>`;
      if (r.news.length) h += `<div class="news">${r.news.map(n => `<span>${esc(n)}</span>`).join('')}</div>`;
      h += `<div class="advice"><img src="${G.CHARS.nox.face}" alt=""><span>${esc(UI.advice())}</span></div>`;
      h += `<button id="btn-next" class="primary">次の月へ ▶</button>`;
      $('#card').className = 'card result';
      $('#card .t-text').innerHTML = h;
      $('#card .t-text').className = 't-text res';
      $('#btn-next').addEventListener('click', UI.nextMonth);
      Game.save();
    },
    advice() {
      const S = Game.S;
      if (S.revoltOn) return '神殺しの同盟がせまっています! 神罰か、記憶の書きかえで止めましょう。';
      if (S.peaceProg >= 1) return '和平が一歩進んでいます。次に和平の話が来たら、必ず止めてください!';
      if (S.f > 45) return '人族が勝ちすぎです! 魔族に力を与えるか、天災で止めましょう。';
      if (S.f > 25) return '人族がやや有利です。そろそろ魔族を助けてもいいころです。';
      if (S.f < -45) return '人族が滅びそうです! 神の奇跡で人族を救いましょう。';
      if (S.f < -25) return '魔族がやや有利です。人族は必死に祈っていて、信仰がよく集まります。';
      if (S.sus > 60) return '疑念が高まっています。邪神の囁きはひかえめに。疑念が100になると反逆されます。';
      if (S.faith > 120) return '信仰がたっぷりあります。大きな介入もできます。';
      return '前線は金色の帯の中。女神さまの望みどおりです。';
    },
    nextMonth() {
      if (UI.phase !== 'result') return;
      const S = Game.S, r = UI.lastR;
      if (S.ended) return UI.ending(S.ended);
      if (r && r.revoltEnd) return UI.scene([{ img: 'goddess_dark', who: 'narr', text: '神殺しの同盟は消えた。人族と魔族は何もおぼえていない。そしてふたたび、剣を向けあった。' }, { img: 'goddess_dark', who: 'goddess_dark', text: 'おかえりなさい、愛しい世界。' }], () => { G.Field.setState(S); UI.monthStart(); });
      const beat = Game.nextBeat();
      if (beat) { G.BGM.play('dark'); return UI.scene([{ img: beat.img, who: 'narr', text: `―― ${beat.title} ――`, big: true }].concat(beat.lines.map(l => Object.assign({ img: beat.img }, l))), () => UI.monthStart()); }
      UI.monthStart();
    },
    ending(key) {
      const e = G.ENDINGS[key], S = Game.S;
      G.BGM.play(e.win ? 'ending' : 'dark');
      UI.scene(e.lines.map(l => Object.assign({ img: e.img }, l)), () => {
        const c = S.counts;
        $('#end-card').innerHTML = `<div class="end-img" style="background-image:url('${imgOf(e.img)}')"></div><div class="end-sub ${e.win ? 'good' : 'bad'}">${e.sub}</div><h2>${esc(e.title)}</h2>
          <div class="end-stats"><span>${Game.dateText(Math.max(0, S.month - 1))}まで</span><span>集めた信仰 <b>${Math.round(S.total)}</b></span><span>神の奇跡 <b>${c.miracle}</b></span><span>邪神の囁き <b>${c.whisper}</b></span><span>運命の操作 <b>${c.fate}</b></span></div>
          <div class="end-btns">${e.win ? '<button id="end-cont">このまま続ける</button>' : ''}<button class="primary" id="end-new">もう一度はじめから</button></div>`;
        $('#ending').classList.add('open');
        const ec = $('#end-cont'); if (ec) ec.onclick = () => { $('#ending').classList.remove('open'); S.ended = null; UI.monthStart(); };
        $('#end-new').onclick = () => { $('#ending').classList.remove('open'); try { localStorage.removeItem('goddess2-save'); } catch (err) { } UI.title(); };
      });
    },

    refresh() {
      const S = Game.S; if (!S) return;
      $('#faith-n').textContent = Math.round(S.faith);
      $('#faith-bar').style.width = Math.min(100, S.faith / 2) + '%';
      $('#sus-n').textContent = Math.round(S.sus);
      $('#sus-bar').style.width = S.sus + '%';
      $('#gface').classList.toggle('slipping', S.sus >= 75 || S.revoltOn);
      $('#date').textContent = Game.dateText();
      const left = Game.GOAL_MONTHS - S.month;
      $('#goal').textContent = left > 0 ? `勝利まで あと${Math.floor(left / 12) ? Math.floor(left / 12) + '年' : ''}${left % 12 ? left % 12 + 'か月' : ''}` : '5年達成!';
      // 前線ゲージ
      const pct = (S.f + 100) / 2;
      $('#fg-mark').style.left = pct + '%';
      const z = Game.zone(S.f);
      $('#fg-label').textContent = z.t; $('#fg-label').className = 'fg-label z-' + z.k;
      $('#peace-warn').classList.toggle('on', S.peaceProg >= 1 && !S.revoltOn);
      $('#revolt-warn').classList.toggle('on', !!S.revoltOn);
      $('#revolt-warn').textContent = `神殺しの同盟 ${Math.round(Math.max(0, S.revolt))}/100`;
    }
  };
  G.UI = UI; G.Talk = Talk;
})(globalThis.G2 = globalThis.G2 || {});
