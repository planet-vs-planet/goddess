// 横から見た戦場(canvas)。左が人族の城、右が魔族の城。前線が左右に動く綱引き。
(function (G) {
  const W = 1280, H = 600;
  const GROUND = 470;
  const XL = 190, XR = 1090; // 前線が動く範囲(人族の城の前〜魔族の城の前)
  const img = {};
  const parts = [];   // 火花・祈りの光など
  const floats = [];  // 浮かぶ文字
  let cv, g, t0 = 0, last = 0;
  let front = 0, frontTarget = 0, mode = 'idle', modeT = 0, flash = 0, shake = 0, fx = null, fxT = 0;
  let armyH = [], armyD = [];
  let darkGoddess = 0;

  function load(key, src) { const i = new Image(); i.src = src; img[key] = i; }
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
    while (arr.length < n) arr.push({ k: Math.floor(Math.random() * (side === 'h' ? 4 : 3)), row: arr.length % 3, col: Math.floor(arr.length / 3), jit: Math.random() * 6, a: 0, hp: 1 });
    while (arr.length > n) arr.pop();
  }

  const Field = {
    init(canvas) {
      cv = canvas; g = cv.getContext('2d');
      cv.width = W; cv.height = H;
      load('armies', 'assets/img/armies.png'); load('cities', 'assets/img/cities.png');
      load('face_light', 'assets/img/face_light.jpg'); load('face_dark', 'assets/img/face_dark.jpg');
      load('allen', G.CHARS.allen.face); load('zephyra', G.CHARS.zephyra.face);
      requestAnimationFrame(Field.loop);
    },
    setState(S, instant) {
      frontTarget = S.f; if (instant) front = S.f;
      layout('h', S.h); layout('d', S.d);
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
    battle(r, ms) {
      mode = 'battle'; modeT = 0; Field.battleMs = ms;
      Field.r = r; frontTarget = r.f1;
      Field.faithLeft = r.faith;
    },
    float(text, x, y, color, size) { floats.push({ text, x, y, color, size: size || 26, t: 0 }); },

    loop(ts) {
      const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts; t0 += dt;
      Field.update(dt); Field.draw();
      requestAnimationFrame(Field.loop);
    },
    update(dt) {
      modeT += dt * 1000; fxT += dt;
      const speed = mode === 'battle' ? 0.9 : 3;
      front += (frontTarget - front) * Math.min(1, dt * speed);
      flash = Math.max(0, flash - dt * 1.2); shake = Math.max(0, shake - dt * 40);
      darkGoddess = Math.max(0, darkGoddess - dt * 0.35);
      const fxX = fx2x(front);
      if (mode === 'battle') {
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
        if (Field.faithLeft > 0 && Math.random() < 0.35) {
          parts.push({ k: 'prayer', x: XL - 60 + Math.random() * (fxX - XL + 40), y: GROUND - 30 - Math.random() * 60, tx: W / 2, ty: 60, life: 1.6, t: 0 });
        }
        if (modeT > Field.battleMs) { mode = 'idle'; }
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
      sky.addColorStop(0, '#22406e'); sky.addColorStop(Math.max(0, k - 0.12), '#2c4d7a');
      sky.addColorStop(k, '#4a3050'); sky.addColorStop(Math.min(1, k + 0.12), '#6a2030'); sky.addColorStop(1, '#3a0d18');
      g.fillStyle = sky; g.fillRect(-20, -20, W + 40, H + 40);
      const vg = g.createLinearGradient(0, 0, 0, GROUND); vg.addColorStop(0, 'rgba(5,5,15,.55)'); vg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = vg; g.fillRect(0, 0, W, GROUND);
      // 星
      g.fillStyle = 'rgba(255,255,255,.6)';
      for (let i = 0; i < 60; i++) { const x = (i * 137.5) % W, y = (i * 53.7) % 220; if ((i + Math.floor(t0 * 2)) % 7) g.fillRect(x, y, 1.5, 1.5); }
      // 天の女神(うすく)
      const fl = img.face_light, fd = img.face_dark;
      if (fl && fl.complete) {
        g.save(); g.globalAlpha = 0.22; g.beginPath(); g.arc(W / 2, 92, 74, 0, Math.PI * 2); g.clip();
        g.drawImage(fl, W / 2 - 74, 18, 148, 148);
        if (fd && fd.complete && darkGoddess > 0) { g.globalAlpha = 0.5 * darkGoddess; g.drawImage(fd, W / 2 - 74, 18, 148, 148); }
        g.restore();
        g.strokeStyle = darkGoddess > 0.1 ? 'rgba(220,60,110,.5)' : 'rgba(242,210,122,.35)'; g.lineWidth = 2;
        g.beginPath(); g.arc(W / 2, 92, 78 + Math.sin(t0 * 2) * 2, 0, Math.PI * 2); g.stroke();
      }
      // 遠くの山
      for (const [col, amp, base, freq] of [['#1b2236', 40, 360, 0.006], ['#151a28', 30, 400, 0.011]]) {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, GROUND);
        for (let x = 0; x <= W; x += 10) g.lineTo(x, base - Math.abs(Math.sin(x * freq + base) * amp) - Math.sin(x * freq * 3.1) * amp * 0.3);
        g.lineTo(W, GROUND); g.fill();
      }
      // 地面: 人族の土地は緑、魔族の土地は焦げた赤
      const gr = g.createLinearGradient(0, 0, W, 0);
      gr.addColorStop(0, '#2f4a26'); gr.addColorStop(Math.max(0, k - 0.02), '#3a5428'); gr.addColorStop(Math.min(1, k + 0.02), '#4a2622'); gr.addColorStop(1, '#2e1414');
      g.fillStyle = gr; g.fillRect(0, GROUND - 20, W, H - GROUND + 20);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, GROUND + 50, W, H);
      // ちょうどいい範囲(金色の帯)
      const z0 = fx2x(-30), z1 = fx2x(30);
      g.fillStyle = 'rgba(242,210,122,.08)'; g.fillRect(z0, GROUND - 20, z1 - z0, H);
      g.strokeStyle = 'rgba(242,210,122,.35)'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(z0, GROUND - 20); g.lineTo(z0, H); g.moveTo(z1, GROUND - 20); g.lineTo(z1, H); g.stroke(); g.setLineDash([]);
      // 城
      const ci = img.cities;
      if (ci && ci.complete && ci.naturalWidth) {
        const cw = ci.naturalWidth / 5, ch = ci.naturalHeight;
        g.drawImage(ci, 4 * cw, 0, cw, ch, -30, GROUND - 210, 270, 210);
        g.save(); g.filter = 'sepia(1) hue-rotate(-45deg) saturate(3) brightness(0.55)';
        g.translate(W + 30, 0); g.scale(-1, 1);
        g.drawImage(ci, 3 * cw, 0, cw, ch, 0, GROUND - 210, 270, 210);
        g.restore();
      }
      g.font = 'bold 18px "DotGothic16", sans-serif'; g.textAlign = 'center';
      g.fillStyle = '#9cc4ff'; g.fillText('人族の城', 100, GROUND + 40);
      g.fillStyle = '#ff9aa8'; g.fillText('魔族の城', W - 100, GROUND + 40);
      // 軍隊
      const sp = makeSprites();
      const bob = mode === 'battle' ? 1 : 0.25;
      const drawArmy = (arr, side) => {
        const list = arr.slice().sort((a, b) => a.row - b.row);
        for (const u of list) {
          const dir = side === 'h' ? -1 : 1;
          const x = fX + dir * (40 + u.col * 62 + u.row * 22 + u.jit) + Math.sin(t0 * (mode === 'battle' ? 9 : 2) + u.jit) * 6 * bob * -dir;
          const y = GROUND - 8 + u.row * 22;
          if (x < 150 && side === 'h') continue; if (x > W - 150 && side === 'd') continue;
          const s = sp ? sp[side][u.k % sp[side].length] : null;
          const size = 96 + u.row * 6;
          if (s) {
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
      const medal = (key, x, name, col) => {
        const im = img[key]; const y = GROUND - 210 + Math.sin(t0 * 3 + x) * 3;
        g.save(); g.beginPath(); g.arc(x, y, 40, 0, Math.PI * 2); g.closePath();
        g.fillStyle = '#000'; g.fill(); g.clip();
        if (im && im.complete) g.drawImage(im, x - 40, y - 40, 80, 80);
        g.restore();
        g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.arc(x, y, 40, 0, Math.PI * 2); g.stroke();
        g.font = 'bold 15px "DotGothic16", sans-serif'; g.fillStyle = '#000a'; g.fillRect(x - 46, y + 44, 92, 22);
        g.fillStyle = col; g.fillText(name, x, y + 60);
      };
      if (S && S.alive.allen) medal('allen', Math.max(170, fX - 95), '勇者アレン', '#7fb4ff');
      if (S) medal('zephyra', Math.min(W - 170, fX + 95), '魔王ゼフィラ', '#ff7a8a');
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
