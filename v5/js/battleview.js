// 重要な戦いを、横から見る戦場の画面で見る。女神は戦場に直接手を出せる。
(function (G) {
  const FACE = { archer: 1, cavalry: 1, knight: 1, spear: 1, imp: -1, orc: -1, skeleton: -1, wolf: -1 };
  const KINDS = { human: { inf: ['spear', 'knight'], rng: ['archer'], cav: ['cavalry'], mag: ['knight'] }, demon: { inf: ['orc', 'skeleton'], rng: ['imp'], cav: ['wolf'], mag: ['imp'] } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const BV = {
    b: null, cv: null, g: null, men: [], fx: [], timer: null, side: 0, logN: 0, fast: false, imgs: {},
    open(id) {
      const b = G.B(id); if (!b) return;
      BV.resume = G.UI.speed || 0; G.UI.setSpeed(0);
      BV.b = b; b.view = true; BV.logN = 0; BV.fx = []; BV.side = 0; BV.fast = false;
      const el = document.getElementById('battle');
      el.classList.remove('hidden');
      el.innerHTML = `<div class="bv-top"><div class="bv-side" id="bv-s0"></div><div class="bv-title" id="bv-title"></div><div class="bv-side r" id="bv-s1"></div></div><canvas id="bv-cv"></canvas>
        <div class="bv-bottom"><div class="bv-log" id="bv-log"></div><div class="bv-pw"><div style="font-size:11px;color:var(--gold)">女神の力 ― 味方する側</div><div class="seg" id="bv-sidesel"></div><div class="pgrid" id="bv-pw"></div><div class="seg"><button id="bv-fast">はやく</button><button id="bv-close">地図にもどる</button></div></div></div>`;
      BV.cv = document.getElementById('bv-cv'); BV.g = BV.cv.getContext('2d');
      BV.resize(); window.addEventListener('resize', BV.resize);
      BV.load(() => { BV.build(); BV.panel(); });
      document.getElementById('bv-close').onclick = BV.close;
      document.getElementById('bv-fast').onclick = e => { BV.fast = !BV.fast; e.target.classList.toggle('on', BV.fast); BV.tick(true); };
      G.BGM.play('battle');
      BV.tick(true);
      BV.raf = requestAnimationFrame(BV.draw);
    },
    close() {
      clearTimeout(BV.timer); cancelAnimationFrame(BV.raf);
      if (BV.b) BV.b.view = false;
      document.getElementById('battle').classList.add('hidden');
      document.getElementById('battle').innerHTML = '';
      window.removeEventListener('resize', BV.resize);
      if (BV.b) { G.UI.select({ type: BV.b.over ? 'incident' : 'battle', id: BV.b.over ? (G.Nations.warBetween(BV.b.s[0].nation, BV.b.s[1].nation) || {}).inc || BV.b.id : BV.b.id }); }
      BV.b = null; G.BGM.play('field');
      if (BV.resume) { G.UI.setSpeed(BV.resume); G.UI.toast('時間を進めています'); } BV.resume = 0;
    },
    load(done) {
      const list = ['archer', 'cavalry', 'imp', 'knight', 'orc', 'skeleton', 'spear', 'wolf'].map(k => [k, G.src(`assets/unit/st_u_${k}.webp`)]).concat([['castle_h', 'assets/unit/castle_h.webp'], ['castle_d', 'assets/unit/castle_d.webp'], ['bg_north', 'assets/unit/bg_north.jpg'], ['bg_center', 'assets/unit/bg_center.jpg'], ['bg_south', 'assets/unit/bg_south.jpg']].map(([k, p]) => [k, G.src(p)]));
      let left = list.length;
      for (const [k, src] of list) { if (BV.imgs[k]) { if (--left === 0) done(); continue; } const im = new Image(); im.onload = im.onerror = () => { BV.imgs[k] = im; if (--left === 0) done(); }; im.src = src; }
    },
    resize() {
      if (!BV.cv) return;
      const r = BV.cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
      BV.cv.width = r.width * d; BV.cv.height = r.height * d; BV.W = r.width; BV.H = r.height; BV.d = d;
      BV.place();
    },
    // 兵を並べる(1人の絵 ≒ 120人)
    build() {
      const b = BV.b; BV.men = [];
      b.s.forEach((s, si) => {
        const n = G.N(s.nation), race = n ? n.race : 'human';
        const total = Math.round(G.clamp(s.men0 / 140, 8, 46));
        const a0 = G.A(s.armies[0]), comp = a0 ? a0.comp : { inf: 50, rng: 20, cav: 20, mag: 10 };
        const pool = [];
        for (const k of ['cav', 'inf', 'mag', 'rng']) { const c = Math.round(total * comp[k] / 100); for (let i = 0; i < c; i++) pool.push(BV.pick(KINDS[race][k], i)); }
        while (pool.length < total) pool.push(KINDS[race].inf[0]);
        pool.forEach((kind, i) => BV.men.push({ si, kind, i, n: pool.length, alive: true, hit: 0, die: 0, ox: Math.random(), oy: Math.random(), ranged: kind === 'archer' || kind === 'imp' }));
      });
      BV.place();
    },
    pick(arr, i) { return arr[i % arr.length]; },
    place() {
      if (!BV.men.length) return;
      const W = BV.W, H = BV.H;
      for (const m of BV.men) {
        const rows = 4, col = Math.floor(m.i / rows), row = m.i % rows;
        const depth = m.ranged ? 3.2 : m.kind === 'cavalry' || m.kind === 'wolf' ? 0.6 : 1.5;
        m.bx = (m.si === 0 ? -1 : 1) * (60 + col * 26 + depth * 42 + m.ox * 14);
        m.by = H * 0.66 + row * (H * 0.065) + m.oy * 8;
      }
    },
    // 戦いを1日ずつ進める
    tick(first) {
      clearTimeout(BV.timer);
      const b = BV.b; if (!b) return;
      if (!first && !b.over) {
        const before = [G.War.menOf(b.s[0]), G.War.menOf(b.s[1])];
        G.War.round(b);
        const after = [G.War.menOf(b.s[0]), G.War.menOf(b.s[1])];
        for (const si of [0, 1]) BV.kill(si, (before[si] - after[si]) / Math.max(1, b.s[si].men0));
        BV.fx.push({ t: performance.now(), type: 'clash' });
        G.BGM.sfx('clash');
      }
      BV.panel();
      if (b.over) { BV.end(); return; }
      BV.timer = setTimeout(() => BV.tick(), BV.fast ? 700 : 1700);
    },
    kill(si, frac) {
      const alive = BV.men.filter(m => m.si === si && m.alive);
      const total = BV.men.filter(m => m.si === si).length;
      let k = Math.round(frac * total + Math.random() * 0.6);
      alive.sort((a, b) => Math.abs(a.bx) - Math.abs(b.bx));
      for (const m of alive) { if (k-- <= 0) break; m.alive = false; m.die = performance.now(); }
      for (const m of alive.slice(0, 6)) m.hit = performance.now();
    },
    panel() {
      const b = BV.b; if (!b) return;
      document.getElementById('bv-title').innerHTML = `${esc(b.name)}<br><small style="font-size:12px;color:#ddd">${b.over ? '決着' : b.round + '日目'}${b.weather === 'rain' ? ' ・ 雨' : b.weather === 'fog' ? ' ・ 霧' : ''}</small>`;
      b.s.forEach((s, si) => {
        const n = G.N(s.nation), a = G.A(s.armies[0]), c = a && G.P(a.cmd);
        const mo = G.War.morOf(s);
        document.getElementById('bv-s' + si).innerHTML = `${c ? `<img src="${G.src(`assets/face/${c.face}.jpg`)}" alt="">` : ''}<div><b style="color:${n ? n.color : '#fff'}">${n ? esc(n.short) : ''} ${a ? esc(a.name) : ''}</b><small>${c ? esc(G.pname(c)) : '指揮官なし'} ・ 兵${G.fmt(G.War.menOf(s))}</small><div class="bar"><i style="width:${mo}%;background:${mo > 40 ? '' : '#ff6a5a'}"></i></div><small>士気 ${mo > 70 ? '高い' : mo > 45 ? 'ふつう' : mo > 25 ? '低い' : '崩れかけ'}</small></div>`;
      });
      const log = document.getElementById('bv-log');
      for (; BV.logN < b.log.length; BV.logN++) { const l = b.log[BV.logN]; const d = document.createElement('div'); d.className = l.k; d.textContent = l.t; log.appendChild(d); }
      log.scrollTop = log.scrollHeight;
      // ボタンは最初に1回だけ作り、あとは中身だけ変える(戦いが進んでも押せるように)
      const ss = document.getElementById('bv-sidesel');
      if (!ss.children.length) {
        ss.innerHTML = b.s.map((s, si) => `<button data-side="${si}">${esc(G.nname(G.N(s.nation)))}</button>`).join('');
        ss.querySelectorAll('button').forEach(x => x.onclick = () => { BV.side = +x.dataset.side; BV.panel(); });
      }
      ss.querySelectorAll('button').forEach(x => x.classList.toggle('on', +x.dataset.side === BV.side));
      const P = [['bless', '✦', '加護', 16], ['weather', '☂', '天候を変える', 12], ['revel', '✧', '啓示', 14], ['meteor', '☄', '星を落とす', 26], ['hero', '✶', '英雄の覚醒', 30]];
      const pwEl = document.getElementById('bv-pw');
      if (!pwEl.children.length) {
        pwEl.innerHTML = P.map(([k, ic, nm, c]) => `<button class="pbtn" data-bp="${k}"><span class="ic">${ic}</span><span>${nm}</span><span class="c">${c}</span></button>`).join('');
        pwEl.querySelectorAll('[data-bp]').forEach(x => x.onclick = () => {
          const bb = BV.b; if (!bb || bb.over) return;
          const r = G.Goddess.battlePower(bb, x.dataset.bp, BV.side);
          if (!r.ok) { G.UI.toast(r.text); return; }
          BV.fx.push({ t: performance.now(), type: x.dataset.bp, side: BV.side });
          G.BGM.sfx(x.dataset.bp === 'meteor' ? 'boom' : x.dataset.bp === 'weather' ? 'storm' : 'light');
          if (x.dataset.bp === 'meteor') BV.kill(1 - BV.side, 0.18);
          G.UI.toast(`✦ ${r.text || '女神の力が戦場に届いた'}`);
          BV.panel(); G.UI.renderTop();
        });
      }
      const pw = G.S.goddess.power;
      pwEl.querySelectorAll('[data-bp]').forEach(x => { const c = P.find(q => q[0] === x.dataset.bp)[3]; const dis = pw < c || b.over; x.classList.toggle('dis', dis); x.disabled = dis; });
    },
    end() {
      const b = BV.b;
      const msg = b.winner == null ? '両軍は兵を引いた。決着はつかなかった。' : `${G.nname(G.N(b.s[b.winner].nation))}の勝利！`;
      for (const m of BV.men) if (b.winner != null && m.si !== b.winner && m.alive) m.flee = performance.now();
      G.UI.banner(msg);
      document.getElementById('bv-close').classList.add('on');
      document.getElementById('bv-close').textContent = '地図にもどる ▶';
    },
    draw(now) {
      BV.raf = requestAnimationFrame(BV.draw);
      const b = BV.b, g = BV.g; if (!b || !g) return;
      const W = BV.W, H = BV.H, T = now / 1000;
      g.setTransform(BV.d, 0, 0, BV.d, 0, 0);
      // 背景
      const t = G.TERRAIN[G.Map.W.t[(b.y | 0) * G.Map.W.w + (b.x | 0)]].key;
      const bg = BV.imgs[['forest', 'deepforest', 'mountain', 'snow'].includes(t) ? 'bg_north' : ['swamp', 'desert'].includes(t) ? 'bg_south' : 'bg_center'];
      if (bg && bg.naturalWidth) { const s = Math.max(W / bg.width, H / bg.height); g.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s); }
      else { g.fillStyle = '#2a3a28'; g.fillRect(0, 0, W, H); }
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, W, H);
      // 町を攻めているなら城
      if (b.city) { const c = G.C(b.city), n = c && G.N(c.owner); const im = BV.imgs[n && n.race === 'demon' ? 'castle_d' : 'castle_h']; if (im && im.naturalWidth) { const h = H * 0.5, w = h * im.width / im.height; g.drawImage(im, W - w - 10, H * 0.18, w, h); } }
      // 前線: 強いほうが押す
      const p0 = G.War.power(b, 0), p1 = G.War.power(b, 1), share = p0 / (p0 + p1 + 1);
      const front = W / 2 + (share - 0.5) * W * 0.35;
      const sc = H / 900;
      // 兵
      const list = BV.men.slice().sort((a, b2) => a.by - b2.by);
      for (const m of list) {
        const im = BV.imgs[m.kind]; if (!im || !im.naturalWidth) continue;
        const dir = m.si === 0 ? 1 : -1;
        let x = front + m.bx * sc * 1.6 + Math.sin(T * 7 + m.i) * 2, y = m.by;
        if (!b.over && !m.ranged) x += dir * Math.max(0, Math.sin(T * 3 + m.i * 0.7)) * 10;
        let a = 1;
        if (!m.alive) { const k = Math.min(1, (now - m.die) / 900); a = 1 - k; y += k * 18; if (a <= 0) continue; }
        if (m.flee) { x -= dir * (now - m.flee) / 6; a = Math.max(0, 1 - (now - m.flee) / 2500); }
        const h = 120 * sc * (m.kind === 'wolf' || m.kind === 'cavalry' ? 1.05 : 1), w = h * im.width / im.height;
        g.save(); g.globalAlpha = a; g.translate(x, y);
        if (FACE[m.kind] !== dir) g.scale(-1, 1);
        if (now - m.hit < 250) g.filter = 'brightness(2.2)';
        if (b.bless[m.si]) { g.shadowColor = '#ffe9a0'; g.shadowBlur = 14; }
        g.drawImage(im, -w / 2, -h, w, h);
        g.restore();
        // 矢・魔法
        if (m.ranged && m.alive && !b.over && (Math.floor(T * 1.3 + m.i) % 3 === 0)) {
          const k = (T * 1.3 + m.i) % 1, tx = front - dir * 60 * sc, sx = x + dir * 20;
          g.strokeStyle = m.kind === 'imp' ? `rgba(220,110,255,${1 - k})` : `rgba(255,240,200,${1 - k})`; g.lineWidth = 2;
          const cx = sx + (tx - sx) * k, cy = y - h * 0.6 - Math.sin(k * Math.PI) * 80 * sc;
          g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - dir * 12, cy + 3); g.stroke();
        }
      }
      // 土ぼこりと火花
      if (!b.over) for (let i = 0; i < 18; i++) { const k = (T * 0.8 + i * 0.13) % 1; g.fillStyle = `rgba(200,180,140,${0.25 * (1 - k)})`; g.beginPath(); g.arc(front + Math.sin(i * 3.1) * 70, H * 0.68 - k * 60, 10 + k * 30, 0, 7); g.fill(); }
      // 天気
      if (b.weather === 'rain') { g.strokeStyle = 'rgba(190,210,240,0.45)'; g.lineWidth = 1; for (let i = 0; i < 160; i++) { const x = (i * 47.3 + T * 300) % W, y = (i * 91.7 + T * 900) % H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 5, y + 16); g.stroke(); } g.fillStyle = 'rgba(30,40,60,0.25)'; g.fillRect(0, 0, W, H); }
      if (b.weather === 'fog') { g.fillStyle = 'rgba(210,215,225,0.38)'; g.fillRect(0, 0, W, H); }
      // 女神の力
      BV.fx = BV.fx.filter(f => now - f.t < 2600);
      for (const f of BV.fx) {
        const k = G.clamp((now - f.t) / 2600, 0, 1), sx = f.side === 0 ? front - W * 0.2 : front + W * 0.2;
        if (f.type === 'bless' || f.type === 'hero') { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, `rgba(255,240,180,${0.6 * (1 - k)})`); gr.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = gr; g.fillRect(sx - W * 0.18, 0, W * 0.36, H); }
        if (f.type === 'meteor') { const tx = f.side === 0 ? front + W * 0.18 : front - W * 0.18; if (k < 0.3) { const q = k / 0.3; g.fillStyle = '#fff2c0'; g.beginPath(); g.arc(tx + (1 - q) * 300, H * 0.6 * q - 50, 18, 0, 7); g.fill(); } else { const q = (k - 0.3) / 0.7; g.fillStyle = `rgba(255,170,70,${1 - q})`; g.beginPath(); g.arc(tx, H * 0.62, 30 + q * 220, 0, 7); g.fill(); } }
        if (f.type === 'revel') { g.strokeStyle = `rgba(255,230,140,${1 - k})`; g.lineWidth = 4; g.beginPath(); g.arc(sx, H * 0.4, 30 + k * 160, 0, 7); g.stroke(); }
        if (f.type === 'clash') { g.fillStyle = `rgba(255,220,120,${0.5 * (1 - k * 3)})`; if (k < 0.33) { g.beginPath(); g.arc(front, H * 0.62, 40 + k * 200, 0, 7); g.fill(); } }
      }
    }
  };
  G.BattleView = BV;
})(globalThis.GD = globalThis.GD || {});
