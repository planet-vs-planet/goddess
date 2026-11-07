// 画面: 場面を見る → 介入を人物へドラッグ(またはタップ→タップ) → 物語が分かれる → 次の場面 → エンディング
(function (G) {
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const IMG = p => (G.IMG && G.IMG[p]) || p;
  const imgOf = k => { if (!k) return ''; const p = /^(scene_|goddess_|ev_|face_|bg_)/.test(k) ? `assets/img/${k}.jpg` : k; return IMG(p); };
  const L2 = a => Array.isArray(a) ? { who: a[0], text: a[1] } : a;
  const E = G.Engine;
  const CH = id => G.CHARS[id] || G.SAGA.people && G.SAGA.people[id] || { name: id, color: '#ddd' };

  // ---- 会話(全画面) ----
  const Talk = {
    lines: null, i: 0, done: null,
    play(lines, done) { Talk.vdone = {}; Talk.lines = lines.map(L2); Talk.i = 0; Talk.done = done; $('#scene').classList.add('open'); Talk.show(); },
    show() {
      const l = Talk.lines[Talk.i], c = CH(l.who), box = $('#scene');
      if (l.video && !Talk.vdone[Talk.i]) { Talk.vdone[Talk.i] = 1; Talk.waiting = true; G.Voice.stop(); return UI.playVideo(() => { Talk.waiting = false; Talk.show(); }); }
      const face = box.querySelector('.t-face');
      if (c.face) { face.src = IMG(c.face); face.style.display = ''; } else face.style.display = 'none';
      box.querySelector('.t-name').textContent = c.name || ''; box.querySelector('.t-name').style.color = c.color || '#fff';
      const tx = box.querySelector('.t-text');
      tx.textContent = l.who === 'narr' ? l.text : `「${l.text}」`; tx.className = 't-text' + (l.who === 'narr' ? ' narr' : '') + (l.big ? ' big' : '');
      if (l.img) { const bg = $('#sc-bg'); if (l.img === 'dark') bg.style.backgroundImage = 'none'; else bg.style.backgroundImage = `url("${imgOf(l.img)}")`; bg.className = 'sc-bg' + (/^goddess/.test(l.img) ? ' contain' : ''); }
      if (l.flash) { box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash'); G.BGM.sfx('boom'); }
      if (l.bgm) G.BGM.play(l.bgm);
      G.Voice.say(l.who, l.text);
    },
    next() { if (!Talk.lines || Talk.waiting) return; G.BGM.sfx('click'); Talk.i++; if (Talk.i >= Talk.lines.length) { const d = Talk.done; Talk.lines = null; G.Voice.stop(); $('#scene').classList.remove('open'); if (d) d(); return; } Talk.show(); },
    skip() { if (Talk.lines && !Talk.waiting) { Talk.i = Talk.lines.length - 1; Talk.next(); } }
  };

  // ---- 戦争の様子(背景の軍勢・城)。ダメージなどの計算はなく、見せるだけ ----
  const War = {
    img: {}, on: false, t: 0,
    init() {
      War.cv = $('#war'); War.g = War.cv.getContext('2d');
      for (const k of ['castle_h', 'castle_d']) War.load(k, `assets/img/${k}.webp`);
      for (const p of ['assets/img/st_u_knight.webp', 'assets/img/st_u_spear.webp', 'assets/img/st_u_archer.webp', 'assets/img/st_u_cavalry.webp', 'assets/img/st_u_orc.webp', 'assets/img/st_u_skeleton.webp', 'assets/img/st_u_imp.webp', 'assets/img/st_u_wolf.webp']) War.load(p.slice(14, -5), p);
      const fit = () => { War.cv.width = innerWidth; War.cv.height = innerHeight; };
      fit(); addEventListener('resize', fit);
      War.units = [];
      for (let i = 0; i < 22; i++) { const h = i % 2 === 0; War.units.push({ h, k: h ? ['u_knight', 'u_spear', 'u_archer', 'u_cavalry'][i % 4] : ['u_orc', 'u_skeleton', 'u_imp', 'u_wolf'][i % 4], x: Math.random(), row: Math.random(), ph: Math.random() * 6 }); }
      requestAnimationFrame(War.loop);
    },
    load(k, p) { const i = new Image(); i.src = IMG(p); War.img[k] = i; },
    loop(ts) {
      const g = War.g, W = War.cv.width, H = War.cv.height; War.t = ts / 1000;
      g.clearRect(0, 0, W, H);
      if (War.on) {
        const ground = H - 120, ch = Math.min(220, H * 0.3);
        for (const [k, x, flip] of [['castle_h', W * 0.06, false], ['castle_d', W * 0.94, false]]) { const im = War.img[k]; if (im && im.complete && im.naturalWidth) { const w = im.naturalWidth / im.naturalHeight * ch; g.globalAlpha = 0.9; g.drawImage(im, x - w / 2, ground - ch + 10, w, ch); g.globalAlpha = 1; } }
        // 軍勢がぶつかりあう(遠景、小さめ・半透明)
        const mid = W / 2 + Math.sin(War.t * 0.3) * W * 0.04;
        for (const u of War.units.slice().sort((a, b) => a.row - b.row)) {
          const im = War.img[u.k]; if (!im || !im.complete || !im.naturalWidth) continue;
          const sz = 46 + u.row * 26, y = ground - 40 + u.row * 34;
          const base = u.h ? mid - 30 - u.x * W * 0.32 : mid + 30 + u.x * W * 0.32;
          const x = base + Math.sin(War.t * 2.2 + u.ph) * 10 * (u.h ? 1 : -1);
          const w = im.naturalWidth / im.naturalHeight * sz;
          g.save(); g.globalAlpha = 0.55 + u.row * 0.25; g.translate(x, 0); if (!u.h) g.scale(-1, 1); g.drawImage(im, -w / 2, y - sz, w, sz); g.restore();
        }
        // 火花
        for (let i = 0; i < 6; i++) { const a = (War.t * 3 + i * 1.7) % 1; g.fillStyle = `rgba(255,${180 + i * 10},90,${1 - a})`; g.fillRect(mid + Math.sin(i * 9 + War.t) * 40, ground - 60 - a * 60, 3, 3); }
      }
      requestAnimationFrame(War.loop);
    }
  };

  const UI = {
    sel: null, drag: null,
    init() {
      War.init();
      $('#scene').addEventListener('click', e => { if (!e.target.closest('button')) Talk.next(); });
      $('#sc-next').addEventListener('click', Talk.next);
      $('#sc-skip').addEventListener('click', Talk.skip);
      $('#btn-new').addEventListener('click', UI.newGame);
      $('#btn-cont').addEventListener('click', () => { G.BGM.start(); if (E.load()) { $('#title').classList.remove('open'); UI.showScene(); } });
      $('#btn-set').addEventListener('click', () => $('#settings').classList.toggle('open'));
      $('#set-music').addEventListener('change', e => G.BGM.setMusic(e.target.checked));
      $('#set-voice').addEventListener('change', e => { G.Voice.on = e.target.checked; if (!e.target.checked) G.Voice.stop(); });
      $('#btn-title').addEventListener('click', () => { $('#settings').classList.remove('open'); UI.title(); });
      $('#btn-log').addEventListener('click', UI.showLog);
      $('#logview').addEventListener('click', e => { if (e.target.id === 'logview' || e.target.closest('.close')) $('#logview').classList.remove('open'); });
      document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && Talk.lines) { e.preventDefault(); Talk.next(); } if (e.key === 'Escape') UI.clearSel(); });
      // ドラッグ(マウスも指も)
      $('#tray').addEventListener('pointerdown', UI.down);
      addEventListener('pointermove', UI.move);
      addEventListener('pointerup', UI.up);
      $('#cast').addEventListener('click', e => { const p = e.target.closest('.person'); if (p && UI.sel) UI.use(UI.sel, p.dataset.id); });
      UI.title();
    },
    title() {
      $('#title').classList.add('open'); $('#btn-cont').disabled = !E.hasSave(); G.Voice.stop();
      const n = E.seenEndings().length; $('#end-count').textContent = n ? `見つけたエンディング ${n} / ${G.SAGA.endings.length}` : '';
    },
    newGame() {
      G.BGM.start(); G.BGM.play('title');
      E.newGame(); E.save();
      $('#title').classList.remove('open');
      Talk.play(G.OPENING, () => UI.chapterCard(() => UI.showScene()));
    },
    playVideo(done) {
      const box = $('#intro-video'), v = box.querySelector('video');
      let fin = false; const end = () => { if (fin) return; fin = true; box.classList.add('fade'); setTimeout(() => { v.pause(); box.classList.remove('open', 'fade', 'in'); done(); }, 700); };
      v.src = IMG('assets/video/opening.mp4'); v.currentTime = 0;
      box.classList.add('open'); requestAnimationFrame(() => box.classList.add('in')); G.BGM.play(null);
      v.onended = end; v.onerror = end; box.querySelector('button').onclick = end;
      v.play().catch(() => { v.muted = true; v.play().catch(end); });
    },
    // 章のはじまり(その章の最初の場面のときだけ)
    chapterCard(done) {
      const S = E.S, ch = (G.SAGA.chapters || []).find(c => c.no === S.ch);
      if (!ch || UI.lastCh === S.ch) return done();
      UI.lastCh = S.ch;
      const lines = [{ img: 'dark', who: 'narr', text: `第${ch.no}章　${ch.title}`, big: true, bgm: 'title' }].concat((ch.intro || []).map(a => Object.assign({ img: ch.img || 'scene_war' }, L2(a))));
      Talk.play(lines, done);
    },
    // ---- 場面 ----
    showScene() {
      const S = E.S;
      if (S.ended) return UI.ending();
      const sc = E.scene(S.scene), pl = G.PLACES[sc.place] || G.PLACES.center;
      $('#bg').style.backgroundImage = `url("${IMG(pl.bg)}")`;
      War.on = !!pl.war;
      $('#chap').textContent = `第${sc.chapter}章 ・ ${pl.name}`;
      $('#stitle').textContent = sc.title;
      $('#sit-text').textContent = sc.situation || '';
      $('#sit-ask').textContent = '女神さま、だれに、何をしますか?(介入を人物へドラッグ)';
      $('#gface').classList.remove('dark');
      G.BGM.play(pl.war ? 'battle' : 'field');
      // 人物
      $('#cast').innerHTML = sc.cast.map(id => { const c = CH(id), st = c.stand || 'assets/img/st_u_knight.webp'; return `<div class="person" data-id="${id}"><img src="${IMG(st)}" alt=""><span class="nm" style="color:${c.color || '#fff'}">${esc(c.name)}</span></div>`; }).join('');
      // 介入(7つ。この場面で使えるのは光る)
      $('#tray').innerHTML = Object.keys(G.ACTS).map(k => { const a = G.ACTS[k], on = sc.acts.includes(k); return `<button class="act ${a.face === 'dark' ? 'dark' : ''} ${on ? 'on' : 'off'}" data-k="${k}" title="${esc(a.desc)}"><span class="ic">${a.icon}</span><span class="an">${a.name}</span><span class="ad">${on ? esc(a.desc) : 'この場面では使えない'}</span></button>`; }).join('');
      UI.clearSel();
      // 場面のはじまりの会話
      // 前にしたことが返ってくる(echo)
      const echo = (sc.echo || []).filter(x => S.flags.includes(x.if)).slice(0, 2).flatMap(x => x.lines);
      const intro = (sc.intro || []).concat(echo);
      if (intro.length && UI.introShown !== sc.id) { UI.introShown = sc.id; Talk.play(intro.map(a => Object.assign({ img: pl.bg }, L2(a)))); }
    },
    clearSel() { UI.sel = null; document.querySelectorAll('.act.sel').forEach(x => x.classList.remove('sel')); document.querySelectorAll('.person').forEach(p => p.classList.remove('can', 'over')); $('#hint').classList.remove('on'); },
    pick(k) {
      UI.clearSel(); UI.sel = k;
      const b = document.querySelector(`.act[data-k="${k}"]`); if (b) b.classList.add('sel');
      document.querySelectorAll('.person').forEach(p => p.classList.add('can'));
      $('#hint').textContent = `「${G.ACTS[k].name}」をだれに? 人物へドラッグするか、人物をタップ`; $('#hint').classList.add('on');
    },
    down(e) {
      const b = e.target.closest('.act'); if (!b || !b.classList.contains('on') || Talk.lines) return;
      e.preventDefault(); G.BGM.start();
      UI.pick(b.dataset.k);
      UI.drag = { k: b.dataset.k, x: e.clientX, y: e.clientY, moved: false };
      const gh = $('#ghost'); gh.textContent = G.ACTS[b.dataset.k].icon; gh.className = G.ACTS[b.dataset.k].face === 'dark' ? 'dark' : '';
    },
    move(e) {
      const d = UI.drag; if (!d) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) d.moved = true;
      if (!d.moved) return;
      const gh = $('#ghost'); gh.style.display = 'flex'; gh.style.left = e.clientX + 'px'; gh.style.top = e.clientY + 'px';
      const p = UI.personAt(e.clientX, e.clientY);
      document.querySelectorAll('.person').forEach(x => x.classList.toggle('over', x === p));
    },
    up(e) {
      const d = UI.drag; if (!d) return; UI.drag = null;
      $('#ghost').style.display = 'none';
      if (!d.moved) return; // タップ: 選んだ状態のまま(次に人物をタップ)
      const p = UI.personAt(e.clientX, e.clientY);
      if (p) UI.use(d.k, p.dataset.id); else UI.clearSel();
    },
    personAt(x, y) { for (const p of document.querySelectorAll('.person')) { const r = p.getBoundingClientRect(); if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return p; } return null; },
    // ---- 介入する ----
    use(k, who) {
      const S = E.S, sc = E.scene(S.scene), a = G.ACTS[k];
      const b = E.branch(sc, k, who);
      if (!b) return UI.clearSel();
      UI.clearSel();
      const app = $('#app'); app.classList.remove('flash-light', 'flash-dark'); void app.offsetWidth; app.classList.add(a.face === 'dark' ? 'flash-dark' : 'flash-light');
      $('#gface').classList.toggle('dark', a.face === 'dark');
      G.BGM.sfx(a.face === 'dark' ? 'dark' : 'light');
      const before = S.flags.slice();
      const r = E.act(k, who);
      E.save();
      const pl = G.PLACES[sc.place] || G.PLACES.center;
      const lines = (b.lines && b.lines.length ? b.lines : [['narr', b.result]]).map(x => Object.assign({ img: b.img || pl.bg }, L2(x)));
      const head = { img: b.img || pl.bg, who: a.face === 'dark' ? 'goddess_dark' : 'goddess', text: b.goddess || UI.goddessLine(k, who), bgm: a.face === 'dark' ? 'dark' : 'title' };
      setTimeout(() => Talk.play([head].concat(lines), () => UI.fateCard(k, who, b, before, () => r.newChapter ? UI.chapterCard(() => UI.showScene()) : UI.showScene())), 500);
    },
    goddessLine(k, who) {
      const n = CH(who).short || CH(who).name;
      return { bless: `${n}に、私の祝福を。`, curse: `${n}……あなたには、少し重い荷を背負ってもらうわ。`, dream: `眠りなさい、${n}。夢を見せてあげる。`, trial: `${n}、この試練を越えてごらんなさい。`, meet: `${n}。あなたに、会わせたい人がいるの。`, miracle: `見なさい。これが女神の奇跡よ。`, whisper: `${n}……聞こえる? 私の声が。` }[k];
    },
    // 運命が変わった、のカード
    fateCard(k, who, b, before, done) {
      const S = E.S, c = CH(who), a = G.ACTS[k];
      const newFlags = S.flags.filter(f => !before.includes(f)).map(f => (G.SAGA.flags.find(x => x.id === f) || {}).desc).filter(Boolean);
      $('#fate-card').innerHTML = `<h3>運命が動いた</h3><div class="who">${c.face ? `<img src="${IMG(c.face)}" alt="">` : ''}<span>${esc(c.name)} に <b style="color:${a.face === 'dark' ? 'var(--dark)' : 'var(--gold)'}">${a.icon} ${a.name}</b></span></div>
        <div class="res">${esc(b.result)}</div>${newFlags.length ? `<div class="mem">${newFlags.map(t => `<span>記憶: ${esc(t)}</span>`).join('')}</div>` : ''}<button class="primary" id="fate-next">${S.ended ? '結末へ ▶' : '次の場面へ ▶'}</button>`;
      $('#fate').classList.add('open');
      $('#fate-next').onclick = () => { $('#fate').classList.remove('open'); done(); };
    },
    timeline() {
      return `<div class="tl">${E.S.log.map(l => { const c = CH(l.target), a = G.ACTS[l.act]; return `<div><b>第${l.ch}章「${esc(l.title)}」</b> ${esc(c.name)}に${a.icon}${a.name}<small>${esc(l.result)}</small></div>`; }).join('') || '<div>まだ何もしていない</div>'}</div>`;
    },
    showLog() { $('#log-card').innerHTML = `<h3>運命の記録</h3>${UI.timeline()}<button class="close">閉じる</button>`; $('#logview').classList.add('open'); },
    // ---- 結末 ----
    ending() {
      const S = E.S, e = G.SAGA.endings.find(x => x.id === S.ended) || G.SAGA.endings[0];
      E.addEnding(e.id);
      War.on = false;
      const img = e.img || (e.dark ? 'goddess_dark' : 'ev_holy');
      const lines = (e.lines && e.lines.length ? e.lines : [['narr', e.summary]]).map(x => Object.assign({ img }, L2(x)));
      G.BGM.play(e.dark ? 'dark' : 'ending');
      Talk.play([{ img, who: 'narr', text: `―― ${e.title} ――`, big: true }].concat(lines), () => UI.endMovie(e, img, () => {
        const n = E.seenEndings().length, tot = G.SAGA.endings.length;
        $('#end-card').innerHTML = `<div class="end-sub">ENDING ${n} / ${tot}</div><h2>${esc(e.title)}</h2><p class="sum">${esc(e.summary)}</p><h3 style="color:var(--gold)">女神がしたこと</h3>${UI.timeline()}
          <div class="btns"><button id="end-copy">結果をコピー(SNS用)</button><button class="primary" id="end-new">別の運命をためす</button></div>`;
        $('#ending').classList.add('open');
        $('#end-copy').onclick = () => {
          const t = `GODDESS 運命の書\nエンディング「${e.title}」(${n}/${tot})\n` + S.log.map(l => `第${l.ch}章 ${CH(l.target).short || CH(l.target).name}に${G.ACTS[l.act].name}`).join(' → ');
          try { navigator.clipboard.writeText(t); $('#end-copy').textContent = 'コピーしました'; } catch (err) { }
        };
        $('#end-new').onclick = () => { $('#ending').classList.remove('open'); E.clearSave(); UI.lastCh = 0; UI.title(); };
      }));
    },
    // ---- エンディングムービー(背景がゆっくり動き、光の粒が舞い、女神がしたことがスタッフロールのように流れる) ----
    endMovie(e, img, done) {
      const box = $('#endmovie'), S = E.S, n = E.seenEndings().length, tot = G.SAGA.endings.length;
      box.querySelector('.em-bg').style.backgroundImage = `url("${imgOf(img)}")`;
      box.querySelector('.em-title').innerHTML = `<small>ENDING ${n} / ${tot}</small>${esc(e.title)}`;
      const cast = [...new Set(S.log.map(l => l.target))].map(id => CH(id));
      box.querySelector('.em-inner').innerHTML =
        `<h4>女神がつむいだ運命</h4>` + S.log.map(l => `<p><b>第${l.ch}章「${esc(l.title)}」</b>${esc(CH(l.target).name)}に ${G.ACTS[l.act].icon}${G.ACTS[l.act].name}</p>`).join('') +
        `<h4>運命を動かされた人々</h4>` + cast.map(c => `<p>${esc(c.name)}</p>`).join('') +
        `<h4>女神</h4><p>アステリア ―― あなた</p><h4>物語</h4><p>${esc(e.summary)}</p><div class="fin">FIN</div>`;
      box.style.setProperty('--dur', Math.max(18, 10 + S.log.length * 1.6) + 's');
      box.classList.remove('play'); box.classList.add('open'); void box.offsetWidth; box.classList.add('play');
      // 光の粒
      const cv = box.querySelector('.em-fx'), g = cv.getContext('2d'); let run = true;
      const fit = () => { cv.width = innerWidth; cv.height = innerHeight; }; fit();
      const col = e.dark ? [255, 110, 170] : [255, 220, 140];
      const ps = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: 1 + Math.random() * 2.6, v: .02 + Math.random() * .05, w: Math.random() * 6.28 }));
      let last = performance.now();
      const tick = t => { if (!run) return; const dt = Math.min(.05, (t - last) / 1000); last = t; g.clearRect(0, 0, cv.width, cv.height);
        for (const p of ps) { p.y -= p.v * dt; p.w += dt; if (p.y < -.05) { p.y = 1.05; p.x = Math.random(); } const a = .35 + .35 * Math.sin(p.w * 2);
          g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`; g.shadowColor = `rgba(${col[0]},${col[1]},${col[2]},1)`; g.shadowBlur = 8;
          g.beginPath(); g.arc(p.x * cv.width + Math.sin(p.w) * 12, p.y * cv.height, p.r, 0, 6.28); g.fill(); }
        requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
      G.BGM.play(e.dark ? 'dark' : 'ending');
      let fin = false;
      const end = () => { if (fin) return; fin = true; run = false; box.classList.remove('open', 'play'); box.onclick = null; done(); };
      box.querySelector('.em-inner').onanimationend = () => setTimeout(end, 1500);
      box.querySelector('.em-skip').onclick = ev => { ev.stopPropagation(); end(); };
    }
  };
  G.UI = UI; G.Talk = Talk; G.War = War;
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', UI.init); else UI.init();
})(globalThis.G2 = globalThis.G2 || {});
