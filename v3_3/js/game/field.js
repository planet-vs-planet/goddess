// 横から見た戦場(canvas)。左が人族の城、右が魔族の城。前線が左右に動く綱引き。
(function (G) {
  const W = 1280;
  let H = 600, GROUND = 470;
  const XL = 190, XR = 1090; // 前線が動く範囲(人族の城の前〜魔族の城の前)
  const img = {};
  const parts = [];   // 火花・祈りの光など
  const floats = [];  // 浮かぶ文字
  let cv, g, t0 = 0, last = 0;
  let front = 0, frontTarget = 0, mode = 'idle', modeT = 0, flash = 0, shake = 0, fx = null, fxT = 0;
  let armyH = [], armyD = [];
  let darkGoddess = 0;

  function load(key, src) { const i = new Image(); i.src = (G.IMG && G.IMG[src]) || src; img[key] = i; }
  const fx2x = f => XL + (f + 100) / 200 * (XR - XL);

  // 軍隊の絵(armies.png: 人間/魔族/エルフ/ドワーフ/獣人/竜) の旗を陣営の色にぬる
  function armyCanvas(idx, color) {
    const a = img.armies; if (!a || !a.complete || !a.naturalWidth) return null;
    const fw = a.naturalWidth / 6, c = document.createElement('canvas');
    c.width = fw; c.height = a.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(a, idx * fw, 0, fw, a.naturalHeight, 0, 0, fw, a.naturalHeight);
    const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
    for (let i = 0; i < p.length; i += 4) if (p[i] > 240 && p[i + 1] < 20 && p[i + 2] > 240) { p[i] = color[0]; p[i + 1] = color[1]; p[i + 2] = color[2]; }
    x.putImageData(d, 0, 0);
    return c;
  }
  // Google Flowで描いた絵をまとめた1枚(chars.png)の中の位置
  const AT = {"goddess_light":[0,0,301,480],"goddess_dark":[305,0,336,480],"nox":[645,0,137,480],"serena":[786,0,277,480],"gran":[1067,0,268,480],"elmina":[1339,0,268,480],"volg":[1611,0,277,480],"u_knight":[0,484,98,170],"u_spear":[102,484,131,170],"u_archer":[237,484,87,170],"u_cavalry":[328,484,84,170],"u_orc":[416,484,144,170],"u_skeleton":[564,484,125,170],"u_imp":[693,484,150,170],"u_wolf":[847,484,177,170]};
  const atlasOk = () => img.atlas && img.atlas.complete && img.atlas.naturalWidth;
  function drawAt(key, x, yFoot, h) { const r = AT[key]; const w = r[2] / r[3] * h; g.drawImage(img.atlas, r[0], r[1], r[2], r[3], x - w / 2, yFoot - h, w, h); return w; }
  const UNITS = { h: ['u_knight', 'u_spear', 'u_archer', 'u_cavalry'], d: ['u_orc', 'u_skeleton', 'u_imp', 'u_wolf'] };
  let sprites = null;
  function makeSprites() {
    if (sprites) return sprites;
    const blue = [70, 130, 230], red = [210, 50, 70];
    const s = { h: [0, 2, 3, 4].map(i => armyCanvas(i, blue)), d: [1, 1, 5].map(i => armyCanvas(i, red)) };
    if (s.h.some(x => !x)) return null;
    sprites = s; return s;
  }
  // 部隊の数を力に合わせて決める
  function layout(side, power) {
    const n = G.clamp(Math.round(power / 16), 3, 11);
    const arr = side === 'h' ? armyH : armyD;
    while (arr.length < n) arr.push({ k: Math.floor(Math.random() * 4), row: arr.length % 3, col: Math.floor(arr.length / 3), jit: Math.random() * 6, a: 0, hp: 1 });
    while (arr.length > n) arr.pop();
  }

  const Field = {
    init(canvas) {
      cv = canvas; g = cv.getContext('2d');
      const fit = () => { const r = cv.parentElement.getBoundingClientRect(); if (r.width > 50 && r.height > 50) { H = Math.round(G.clamp(W * r.height / r.width, 420, 760)); } else H = 600; GROUND = H - 130; cv.width = W; cv.height = H; };
      fit(); window.addEventListener('resize', fit); Field.fit = fit;
      if (window.ResizeObserver) new ResizeObserver(() => fit()).observe(cv.parentElement);
      load('armies', 'assets/img/armies.png'); load('cities', 'assets/img/cities.png');
      load('face_light', 'assets/img/face_light.jpg'); load('face_dark', 'assets/img/face_dark.jpg');
      for (const id of G.KEY_CHARS) load(id, G.CHARS[id].face);
      for (const f of G.FRONTS) if (f.bg) load('bg_' + f.id, f.bg);
      load('atlas', 'assets/img/chars.webp');
      load('st_allen', 'assets/img/stand_allen.webp'); load('castle_h', 'assets/img/castle_h.webp'); load('castle_d', 'assets/img/castle_d.webp'); load('st_zephyra', 'assets/img/stand_zephyra.webp');
      requestAnimationFrame(Field.loop);
    },
    // 見る戦線をえらぶ
    setState(S, instant) {
      const fr = G.Game.front(S.view);
      if (Field.viewId !== S.view) { instant = true; Field.viewId = S.view; armyH.length = 0; armyD.length = 0; parts.length = 0; }
      Field.cfg = G.FRONTS.find(f => f.id === S.view);
      Field.fr = fr;
      frontTarget = fr.f; if (instant) front = fr.f;
      layout('h', G.Game.power(fr, 'h')); layout('d', G.Game.power(fr, 'd'));
    },
    // 介入の演出
    effect(kind) {
      fx = kind; fxT = 0;
      if (kind === 'dark') darkGoddess = 1;
      if (kind === 'storm') { shake = 18; flash = 0.7; }
      if (kind === 'light') flash = 0.5;
      G.BGM.sfx(kind);
    },
    // 1か月の戦い(ms のあいだ激しくぶつかる)
    battle(res, ms, faith) {
      mode = 'battle'; modeT = 0; Field.battleMs = ms;
      Field.r = res; front = res.f0; frontTarget = Math.max(-100, Math.min(100, res.f1));
      Field.faithLeft = faith;
    },
    float(text, x, y, color, size) { floats.push({ text, x, y, color, size: size || 26, t: 0 }); },

    loop(ts) {
      const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts; t0 += dt;
      Field.update(dt); Field.draw();
      requestAnimationFrame(Field.loop);
    },
    update(dt) {
      modeT += dt * 1000; fxT += dt;
      const fighting = mode === 'battle' || Field.running;
      const speed = 3;
      front += (frontTarget - front) * Math.min(1, dt * speed);
      flash = Math.max(0, flash - dt * 1.2); shake = Math.max(0, shake - dt * 40);
      darkGoddess = Math.max(0, darkGoddess - dt * 0.35);
      const fxX = fx2x(front);
      if (fighting) {
        // 火花
        if (Math.random() < 0.7) {
          parts.push({ k: 'spark', x: fxX + (Math.random() - 0.5) * 60, y: GROUND - 20 - Math.random() * 90, vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 200, life: 0.5, t: 0, c: Math.random() < 0.5 ? '#ffd27a' : '#ff7a4a' });
          if (Math.random() < 0.08) G.BGM.sfx('clash');
        }
        if (Math.random() < 0.06 && Field.r) {
          const side = Math.random() < 0.5 ? 'h' : 'd';
          const n = Math.round(10 + Math.random() * 60);
          Field.float('-' + n, fxX + (side === 'h' ? -60 : 60) + (Math.random() - 0.5) * 50, GROUND - 60, side === 'h' ? '#9cc4ff' : '#ff9aa8', 20);
        }
        // 祈りの光: 人族の軍から女神へ
        if ((Field.running || Field.faithLeft > 0) && Math.random() < 0.3) {
          parts.push({ k: 'prayer', x: XL - 60 + Math.random() * (fxX - XL + 40), y: GROUND - 30 - Math.random() * 60, tx: W / 2, ty: 60, life: 1.6, t: 0 });
        }
        if (mode === 'battle' && modeT > Field.battleMs) { mode = 'idle'; }
      } else if (Math.random() < 0.05) {
        parts.push({ k: 'spark', x: fxX + (Math.random() - 0.5) * 40, y: GROUND - 30 - Math.random() * 50, vx: (Math.random() - 0.5) * 100, vy: -Math.random() * 100, life: 0.4, t: 0, c: '#ffd27a' });
      }
      // 介入の演出の粒
      if (fx && fxT < 1.8) {
        if (fx === 'light') for (let i = 0; i < 3; i++) parts.push({ k: 'mote', x: XL + Math.random() * (fxX - XL), y: 90 + Math.random() * 40, vx: 0, vy: 160 + Math.random() * 80, life: 1.4, t: 0, c: '#fff2b0' });
        if (fx === 'dark') for (let i = 0; i < 3; i++) parts.push({ k: 'smoke', x: fxX + Math.random() * (XR - fxX + 80), y: GROUND - Math.random() * 140, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, life: 1.8, t: 0 });
        if (fx === 'fate' && Math.random() < 0.5) parts.push({ k: 'thread', x: W / 2, y: 70, tx: Math.random() < 0.5 ? fx2x(front) - 120 - Math.random() * 200 : fx2x(front) + 120 + Math.random() * 200, ty: GROUND - 60, life: 1.2, t: 0 });
        if (fx === 'storm' && Math.random() < 0.2) { parts.push({ k: 'bolt', x: 200 + Math.random() * 880, y: 0, life: 0.25, t: 0, seed: Math.random() }); flash = Math.max(flash, 0.35); }
      } else if (fxT >= 1.8) fx = null;
      for (const p of parts) {
        p.t += dt;
        if (p.k === 'prayer' || p.k === 'thread') continue;
        p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; if (p.k === 'spark') p.vy += 400 * dt;
      }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t > parts[i].life) {
        if (parts[i].k === 'prayer' && Field.onPrayer) Field.onPrayer();
        parts.splice(i, 1);
      }
      for (const f of floats) { f.t += dt; f.y -= 30 * dt; }
      for (let i = floats.length - 1; i >= 0; i--) if (floats[i].t > 1.6) floats.splice(i, 1);
      if (parts.length > 500) parts.splice(0, parts.length - 500);
    },

    draw() {
      const fX = fx2x(front);
      g.save();
      if (shake) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      // 空: 左は夜明けの青、右は血の赤。前線で色が分かれる
      const sky = g.createLinearGradient(0, 0, W, 0);
      const k = G.clamp(fX / W, 0.05, 0.95);
      const cf = Field.cfg || G.FRONTS[1];
      sky.addColorStop(0, cf.sky[0]); sky.addColorStop(Math.max(0, k - 0.12), cf.sky[0]);
      sky.addColorStop(k, '#4a3050'); sky.addColorStop(Math.min(1, k + 0.12), cf.sky[1]); sky.addColorStop(1, '#2a0a14');
      g.fillStyle = sky; g.fillRect(-20, -20, W + 40, H + 40);
      const bgi = img['bg_' + cf.id], hasBg = bgi && bgi.complete && bgi.naturalWidth;
      if (hasBg) {
        // 背景の絵(横幅いっぱい・下を地面にあわせる)
        const r = Math.max(W / bgi.naturalWidth, (GROUND + 40) / bgi.naturalHeight), bw = bgi.naturalWidth * r, bh = bgi.naturalHeight * r;
        g.drawImage(bgi, (W - bw) / 2, GROUND + 40 - bh, bw, bh);
        // 前線より右は赤く、左は青く少しだけ染める
        const tint = g.createLinearGradient(0, 0, W, 0);
        tint.addColorStop(0, 'rgba(40,80,160,.18)'); tint.addColorStop(k, 'rgba(60,30,80,.12)'); tint.addColorStop(1, 'rgba(160,20,40,.25)');
        g.fillStyle = tint; g.fillRect(0, 0, W, H);
      }
      const vg = g.createLinearGradient(0, 0, 0, GROUND); vg.addColorStop(0, 'rgba(5,5,15,.55)'); vg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = vg; g.fillRect(0, 0, W, GROUND);
      // 星
      g.fillStyle = 'rgba(255,255,255,.6)';
      if (!hasBg) for (let i = 0; i < 60; i++) { const x = (i * 137.5) % W, y = (i * 53.7) % 220; if ((i + Math.floor(t0 * 2)) % 7) g.fillRect(x, y, 1.5, 1.5); }
      // 天の女神(うすく)
      const fl = img.face_light, fd = img.face_dark;
      if (atlasOk()) {
        g.save(); g.globalAlpha = 0.28; drawAt('goddess_light', W / 2, 200, 190);
        if (darkGoddess > 0) { g.globalAlpha = 0.6 * darkGoddess; drawAt('goddess_dark', W / 2, 200, 190); }
        g.restore();
      } else if (fl && fl.complete) {
        g.save(); g.globalAlpha = 0.22; g.beginPath(); g.arc(W / 2, 92, 74, 0, Math.PI * 2); g.clip();
        g.drawImage(fl, W / 2 - 74, 18, 148, 148);
        if (fd && fd.complete && darkGoddess > 0) { g.globalAlpha = 0.5 * darkGoddess; g.drawImage(fd, W / 2 - 74, 18, 148, 148); }
        g.restore();
        g.strokeStyle = darkGoddess > 0.1 ? 'rgba(220,60,110,.5)' : 'rgba(242,210,122,.35)'; g.lineWidth = 2;
        g.beginPath(); g.arc(W / 2, 92, 78 + Math.sin(t0 * 2) * 2, 0, Math.PI * 2); g.stroke();
      }
      // 遠くの山
      if (!hasBg) for (const [col, amp, base, freq] of [['#1b2236', 40, 360, 0.006], ['#151a28', 30, 400, 0.011]]) {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, GROUND);
        for (let x = 0; x <= W; x += 10) g.lineTo(x, base - Math.abs(Math.sin(x * freq + base) * amp) - Math.sin(x * freq * 3.1) * amp * 0.3);
        g.lineTo(W, GROUND); g.fill();
      }
      if (cf.forest && !hasBg) { g.fillStyle = '#0f2418'; for (let x = 0; x < W; x += 34) { const h = 60 + ((x * 7) % 50); g.beginPath(); g.moveTo(x, GROUND - 10); g.lineTo(x + 17, GROUND - 10 - h); g.lineTo(x + 34, GROUND - 10); g.fill(); } }
      if (cf.snow) { g.fillStyle = 'rgba(230,240,255,.8)'; for (let i = 0; i < 70; i++) { const x = (i * 97 + t0 * 30 * (1 + i % 3)) % W, y = (i * 61 + t0 * 50 * (1 + i % 2)) % GROUND; g.fillRect(x, y, 2, 2); } }
      // 地面: 人族の土地は緑、魔族の土地は焦げた赤
      const gr = g.createLinearGradient(0, 0, W, 0);
      gr.addColorStop(0, cf.ground[0]); gr.addColorStop(Math.max(0, k - 0.02), cf.ground[0]); gr.addColorStop(Math.min(1, k + 0.02), cf.ground[1]); gr.addColorStop(1, '#2e1414');
      if (hasBg) {
        const gv = g.createLinearGradient(0, GROUND - 60, 0, H); gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(0.35, 'rgba(10,8,14,.45)'); gv.addColorStop(1, 'rgba(10,8,14,.85)');
        g.fillStyle = gv; g.fillRect(0, GROUND - 60, W, H - GROUND + 60);
      } else { g.fillStyle = gr; g.fillRect(0, GROUND - 20, W, H - GROUND + 20); }
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, GROUND + 50, W, H);
      // ちょうどいい範囲(金色の帯)
      const z0 = fx2x(-30), z1 = fx2x(30);
      g.fillStyle = 'rgba(242,210,122,.08)'; g.fillRect(z0, GROUND - 20, z1 - z0, H);
      g.strokeStyle = 'rgba(242,210,122,.35)'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(z0, GROUND - 20); g.lineTo(z0, H); g.moveTo(z1, GROUND - 20); g.lineTo(z1, H); g.stroke(); g.setLineDash([]);
      // 城
      // 城(Google Flowの絵)。落ちると灰色になる
      const frc = Field.fr || { castle: { h: true, d: true } };
      for (const [side, key, x] of [['h', 'castle_h', 95], ['d', 'castle_d', W - 95]]) {
        const im = img[key]; if (!im || !im.complete || !im.naturalWidth) continue;
        const ch = Math.min(250, GROUND * 0.6), cw = im.naturalWidth / im.naturalHeight * ch;
        g.save(); if (!frc.castle[side]) g.filter = 'grayscale(1) brightness(0.4)';
        g.drawImage(im, x - cw / 2, GROUND + 30 - ch, cw, ch); g.restore();
      }
      const frc2 = Field.fr || { castle: { h: true, d: true } };
      for (const [side, x] of [['h', 100], ['d', W - 100]]) if (!frc2.castle[side] && Math.random() < 0.6) parts.push({ k: 'spark', x: x + (Math.random() - 0.5) * 160, y: GROUND - 40 - Math.random() * 120, vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 60, life: 0.9, t: 0, c: Math.random() < 0.5 ? '#ff8a3a' : '#ffcf5a' });
      g.font = 'bold 18px "DotGothic16", sans-serif'; g.textAlign = 'center';
      g.fillStyle = '#9cc4ff'; g.fillText(frc2.castle.h ? '人族の城' : '人族の城(陥落)', 100, GROUND + 40);
      g.fillStyle = '#ff9aa8'; g.fillText(frc2.castle.d ? '魔族の城' : '魔族の城(陥落)', W - 100, GROUND + 40);
      // 軍隊
      const sp = makeSprites();
      const bob = mode === 'battle' || Field.running ? 1 : 0.25;
      const drawArmy = (arr, side) => {
        const list = arr.slice().sort((a, b) => a.row - b.row);
        for (const u of list) {
          const dir = side === 'h' ? -1 : 1;
          const x = fX + dir * (40 + u.col * 62 + u.row * 22 + u.jit) + Math.sin(t0 * (bob > 0.5 ? 9 : 2) + u.jit) * 6 * bob * -dir;
          const y = GROUND - 8 + u.row * 22;
          if (x < 150 && side === 'h') continue; if (x > W - 150 && side === 'd') continue;
          const s = sp ? sp[side][u.k % sp[side].length] : null;
          const size = 96 + u.row * 6;
          if (atlasOk()) {
            const key = UNITS[side][u.k % 4];
            drawAt(key, x, y, key === 'u_cavalry' ? size * 1.15 : key === 'u_wolf' ? size * 0.75 : size * 0.95);
          } else if (s) {
            g.save(); g.translate(x, y);
            if (side === 'd') g.scale(-1, 1);
            g.drawImage(s, -size / 2, -size, size, size);
            g.restore();
          } else { g.fillStyle = side === 'h' ? '#6b9be0' : '#c9506a'; g.fillRect(x - 20, y - 40, 40, 40); }
        }
      };
      drawArmy(armyH, 'h'); drawArmy(armyD, 'd');
      // 前線
      g.strokeStyle = 'rgba(255,240,200,.75)'; g.lineWidth = 3; g.setLineDash([10, 8]);
      g.beginPath(); g.moveTo(fX, GROUND - 170); g.lineTo(fX, H); g.stroke(); g.setLineDash([]);
      // 勇者と魔王(大きな顔のメダル)
      const S = G.Game.S;
      // 勇者と魔王は全身の立ち絵で大きく
      const stand = (key, x, name, col) => {
        const im = img['st_' + key], ch = G.Game.S.chars[key];
        const h = Math.min(250, GROUND * 0.55), w = im.naturalWidth / im.naturalHeight * h, y = GROUND + 14 + Math.sin(t0 * 2.5 + x) * 2;
        g.save();
        if (ch && ch.doubt >= 50) { g.shadowColor = `rgba(255,80,140,${0.6 + 0.3 * Math.sin(t0 * 5)})`; g.shadowBlur = 26; }
        else { g.shadowColor = key === 'allen' ? 'rgba(150,200,255,.7)' : 'rgba(200,80,255,.7)'; g.shadowBlur = 16; }
        g.drawImage(im, x - w / 2, y - h, w, h); g.restore();
        g.font = 'bold 15px "DotGothic16", sans-serif'; g.fillStyle = '#000a'; g.fillRect(x - 46, y - h - 26, 92, 22);
        g.fillStyle = col; g.fillText(name, x, y - h - 10);
      };
      const medal = (key, x, name, col, i) => {
        const si = img['st_' + key]; if (si && si.complete && si.naturalWidth) return stand(key, x, name, col);
        if (atlasOk() && AT[key]) {
          const ch = G.Game.S.chars[key], h = Math.min(200, GROUND * 0.45), y = GROUND + 10 + Math.sin(t0 * 2.5 + x) * 2;
          g.save(); if (ch && ch.doubt >= 50) { g.shadowColor = `rgba(255,80,140,${0.6 + 0.3 * Math.sin(t0 * 5)})`; g.shadowBlur = 24; } else { g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 10; }
          drawAt(key, x, y, h); g.restore();
          g.font = 'bold 14px "DotGothic16", sans-serif'; g.fillStyle = '#000a'; g.fillRect(x - 44, y - h - 24, 88, 20); g.fillStyle = col; g.fillText(name, x, y - h - 9);
          return;
        }
        const im = img[key]; const y = GROUND - 210 - (i % 2) * 40 + Math.sin(t0 * 3 + x) * 3;
        const ch = G.Game.S.chars[key];
        if (ch && ch.doubt >= 50) { g.strokeStyle = `rgba(255,80,140,${0.4 + 0.3 * Math.sin(t0 * 5)})`; g.lineWidth = 8; g.beginPath(); g.arc(x, y, 46, 0, Math.PI * 2); g.stroke(); }
        g.save(); g.beginPath(); g.arc(x, y, 40, 0, Math.PI * 2); g.closePath();
        g.fillStyle = '#000'; g.fill(); g.clip();
        if (im && im.complete) g.drawImage(im, x - 40, y - 40, 80, 80);
        g.restore();
        g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.arc(x, y, 40, 0, Math.PI * 2); g.stroke();
        g.font = 'bold 15px "DotGothic16", sans-serif'; g.fillStyle = '#000a'; g.fillRect(x - 46, y + 44, 92, 22);
        g.fillStyle = col; g.fillText(name, x, y + 60);
      };
      if (S && Field.fr) {
        const hs = G.Game.charsAt(Field.fr.id, 'h'), ds = G.Game.charsAt(Field.fr.id, 'd');
        hs.forEach((id, i) => medal(id, Math.max(130 + i * 10, fX - 95 - i * 100), G.CHARS[id].short, G.CHARS[id].color, i));
        ds.forEach((id, i) => medal(id, Math.min(W - 130 - i * 10, fX + 95 + i * 100), G.CHARS[id].short, G.CHARS[id].color, i));
      }
      // ミッションの敵(精鋭部隊/聖騎士団)を大きく描く
      const M = S && S.mission;
      if (M && Field.fr && M.f === Field.fr.id && (M.type === 'defend' || M.type === 'counter') && atlasOk()) {
        const enemyD = M.type === 'defend', bx = enemyD ? Math.min(W - 170, fX + 150) : Math.max(170, fX - 150), by = GROUND + 20;
        const bh = 210 + Math.sin(t0 * 4) * 6;
        g.save(); g.shadowColor = enemyD ? 'rgba(255,40,60,.9)' : 'rgba(80,160,255,.9)'; g.shadowBlur = 30 + Math.sin(t0 * 6) * 10;
        g.translate(bx, 0); if (!enemyD) g.scale(-1, 1); drawAt(enemyD ? 'u_orc' : 'u_cavalry', 0, by, bh); g.restore();
        const hp = Math.max(0, Math.min(100, M.type === 'defend' ? M.gate : 100 - M.ready));
        g.fillStyle = '#000b'; g.fillRect(bx - 80, by - bh - 42, 160, 34);
        g.font = 'bold 14px "DotGothic16", sans-serif'; g.fillStyle = enemyD ? '#ff9aa8' : '#9cc4ff'; g.fillText(enemyD ? '魔族の精鋭部隊' : '人族の聖騎士団', bx, by - bh - 26);
        g.fillStyle = '#333'; g.fillRect(bx - 70, by - bh - 20, 140, 8); g.fillStyle = enemyD ? '#ff5a6a' : '#5a9aff'; g.fillRect(bx - 70, by - bh - 20, 140 * hp / 100, 8);
        // 押してくる矢印
        g.fillStyle = `rgba(255,255,255,${0.5 + 0.3 * Math.sin(t0 * 8)})`; g.font = 'bold 40px sans-serif'; g.fillText(enemyD ? '◀◀' : '▶▶', fX + (enemyD ? 60 : -60), GROUND - 180);
      }
      if (M && Field.fr && M.f === Field.fr.id && M.type === 'cover') {
        g.font = 'bold 22px "DotGothic16", sans-serif'; g.fillStyle = `rgba(255,120,170,${0.7 + 0.3 * Math.sin(t0 * 5)})`;
        g.fillText(`🔍 ${G.CHARS[M.who].short}が調査中…`, Math.max(160, fX - 200), GROUND - 260);
      }
      // 粒
      for (const p of parts) {
        const a = 1 - p.t / p.life;
        if (p.k === 'spark') { g.fillStyle = p.c; g.globalAlpha = a; g.fillRect(p.x, p.y, 4, 4); }
        if (p.k === 'mote') { g.fillStyle = p.c; g.globalAlpha = a; g.beginPath(); g.arc(p.x, p.y, 3, 0, 7); g.fill(); }
        if (p.k === 'smoke') { g.fillStyle = `rgba(120,40,160,${0.25 * a})`; g.beginPath(); g.arc(p.x, p.y, 26 + p.t * 20, 0, 7); g.fill(); }
        if (p.k === 'prayer') { const q = p.t / p.life, e = q * q; const x = p.x + (p.tx - p.x) * e, y = p.y + (p.ty - p.y) * e - Math.sin(q * Math.PI) * 60; g.globalAlpha = 0.9; g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); g.globalAlpha = 0.3; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
        if (p.k === 'thread') { const q = Math.min(1, p.t / p.life * 1.5); g.strokeStyle = `rgba(242,210,122,${0.8 * (1 - p.t / p.life)})`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo((p.x + p.tx) / 2, p.y + 40, p.x + (p.tx - p.x) * q, p.y + (p.ty - p.y) * q); g.stroke(); }
        if (p.k === 'bolt') { g.strokeStyle = `rgba(230,230,255,${a})`; g.lineWidth = 4; g.beginPath(); let x = p.x, y = 0; g.moveTo(x, y); for (let i = 0; i < 8; i++) { x += (Math.sin(p.seed * 99 + i * 7) * 40); y += GROUND / 8; g.lineTo(x, y); } g.stroke(); }
        g.globalAlpha = 1;
      }
      // 光の柱(神の奇跡)
      if (fx === 'light' && fxT < 1.8) {
        const a = Math.sin(Math.min(1, fxT / 1.8) * Math.PI);
        const x0 = Math.max(150, fX - 260);
        const lg = g.createLinearGradient(x0, 0, x0 + 200, 0); lg.addColorStop(0, 'rgba(255,240,180,0)'); lg.addColorStop(0.5, `rgba(255,240,180,${0.45 * a})`); lg.addColorStop(1, 'rgba(255,240,180,0)');
        g.fillStyle = lg; g.fillRect(x0, 0, 200, GROUND + 40);
      }
      for (const f of floats) { g.globalAlpha = 1 - f.t / 1.6; g.font = `bold ${f.size}px "DotGothic16", sans-serif`; g.fillStyle = '#000'; g.fillText(f.text, f.x + 2, f.y + 2); g.fillStyle = f.color; g.fillText(f.text, f.x, f.y); g.globalAlpha = 1; }
      if (flash) { g.fillStyle = `rgba(255,255,255,${flash * 0.5})`; g.fillRect(0, 0, W, H); }
      g.restore();
    },
    frontX: f => fx2x(f) / W
  };
  G.Field = Field;
})(globalThis.G2 = globalThis.G2 || {});
