// 世界マップを描く(真上から見下ろす)。地形・領土・国境・町・軍・戦場・事件の場所・女神の力の光
(function (G) {
  const TS = () => G.CFG.TILE;
  const R = {
    cv: null, ctx: null, dpr: 1, W: 0, H: 0,
    cam: { x: 0, y: 0, z: 1 }, fly: null,
    img: {}, terrain: null, terr: null, hiNation: null, hiCv: null,
    sel: null, hover: null, anims: [], spot: [], t0: performance.now(),
    flagCache: {},
    init(canvas) {
      R.cv = canvas; R.ctx = canvas.getContext('2d');
      R.resize(); window.addEventListener('resize', R.resize);
      R.input();
      // 一時的な光(女神の力・事件)を、実際の時間で動かす
      const fx0 = G.fx;
      G.fx = (type, x, y, opt) => { fx0(type, x, y, opt); R.anims.push({ type, x, y, t: performance.now(), dur: R.DUR[type] || 2600 }); };
      requestAnimationFrame(R.frame);
    },
    DUR: { divine: 2600, pillar: 5000, meteor: 3200, clash: 2600, battle: 1800, temple: 3000, oracle: 2600, dream: 2800, whisper: 2400, hero: 3200, bless: 2600, light: 2400, dark: 2600, forge: 2400, quake: 2400, unrest: 2400, bond: 2600, fog: 2600, harvest: 3000, fire: 2000, plague: 2000, storm: 2600, siege: 1500 },
    load(list, done) {
      let left = list.length;
      for (const [k, src] of list) { const im = new Image(); im.onload = im.onerror = () => { if (im.naturalWidth) R.img[k] = im; if (--left === 0) done(); }; im.src = src; }
    },
    resize() {
      const r = R.cv.parentElement.getBoundingClientRect();
      R.dpr = Math.min(2, window.devicePixelRatio || 1);
      R.W = r.width; R.H = r.height;
      R.cv.width = Math.round(r.width * R.dpr); R.cv.height = Math.round(r.height * R.dpr);
      R.cv.style.width = r.width + 'px'; R.cv.style.height = r.height + 'px';
    },
    // ---- 地形(1回だけ描く) ----
    buildTerrain() {
      const W = G.Map.W, ts = TS(), cv = document.createElement('canvas');
      cv.width = W.w * ts; cv.height = W.h * ts;
      const g = cv.getContext('2d'), tiles = R.img.tiles;
      g.imageSmoothingEnabled = false;
      const cw = tiles ? tiles.width / 13 : 16, rows = tiles ? Math.max(1, Math.round(tiles.height / cw)) : 1;
      const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
      const PAL = ['#0d1b2e', '#163252', '#235a7a', '#2a6f93', '#4a7d3a', '#56853b', '#33612f', '#21442a', '#7a7268', '#e6ecf1', '#d1b273', '#46553a', '#d4c290'];
      for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++) {
        const k = W.t[y * W.w + x];
        if (tiles) g.drawImage(tiles, k * cw, Math.floor(hash(x >> 1, y >> 1) * rows) * cw, cw, cw, x * ts, y * ts, ts, ts);
        else { g.fillStyle = PAL[k]; g.fillRect(x * ts, y * ts, ts, ts); }
      }
      // 川
      g.strokeStyle = '#3d86c6'; g.lineWidth = Math.max(2, ts / 4); g.lineCap = 'round';
      for (let i = 0; i < W.w * W.h; i++) {
        if (!W.river[i] || W.flow[i] < 0) continue;
        const x = i % W.w, y = (i / W.w) | 0, j = W.flow[i], x2 = j % W.w, y2 = (j / W.w) | 0;
        g.beginPath(); g.moveTo((x + 0.5) * ts, (y + 0.5) * ts); g.lineTo((x2 + 0.5) * ts, (y2 + 0.5) * ts); g.stroke();
      }
      // 海岸に影
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = 1; y < W.h; y++) for (let x = 0; x < W.w; x++) {
        const i = y * W.w + x;
        if (G.TERRAIN[W.t[i]].water && !G.TERRAIN[W.t[i - W.w]].water) g.fillRect(x * ts, y * ts, ts, ts / 3);
      }
      // 地形を少し落ち着いた色に(国の色が見えるように)
      g.fillStyle = 'rgba(20,24,30,0.22)'; g.fillRect(0, 0, cv.width, cv.height);
      R.terrain = cv;
      R.buildTerritory();
    },
    // ---- 領土と国境(町の持ち主が変わるたびに描きなおす) ----
    buildTerritory() {
      const W = G.Map.W, ts = TS();
      if (!R.terr) { R.terr = document.createElement('canvas'); R.terr.width = W.w * ts; R.terr.height = W.h * ts; }
      const g = R.terr.getContext('2d');
      g.clearRect(0, 0, R.terr.width, R.terr.height);
      for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++) {
        const o = W.owner[y * W.w + x]; if (!o) continue;
        const n = G.N(o); if (!n) continue;
        g.fillStyle = n.color; g.globalAlpha = 0.42; g.fillRect(x * ts, y * ts, ts, ts);
      }
      g.globalAlpha = 1;
      // 国境の線: 戦争中は赤く
      const edge = (x, y, x2, y2, a, b) => {
        if (!a && !b) return;
        const war = a && b && G.atWar(a, b);
        g.strokeStyle = war ? '#ff3b30' : a && b ? 'rgba(20,10,5,0.75)' : 'rgba(20,10,5,0.55)';
        g.lineWidth = war ? 3 : 2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
      };
      for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++) {
        const i = y * W.w + x, o = W.owner[i];
        if (x + 1 < W.w) { const p = W.owner[i + 1]; if (p !== o && (o || p) && !(G.TERRAIN[W.t[i]].water && G.TERRAIN[W.t[i + 1]].water)) edge((x + 1) * ts, y * ts, (x + 1) * ts, (y + 1) * ts, o, p); }
        if (y + 1 < W.h) { const p = W.owner[i + W.w]; if (p !== o && (o || p)) edge(x * ts, (y + 1) * ts, (x + 1) * ts, (y + 1) * ts, o, p); }
      }
      R.hiNation = null;
    },
    buildHighlight(nid) {
      const W = G.Map.W, ts = TS();
      if (!R.hiCv) { R.hiCv = document.createElement('canvas'); R.hiCv.width = W.w * ts; R.hiCv.height = W.h * ts; }
      const g = R.hiCv.getContext('2d'); g.clearRect(0, 0, R.hiCv.width, R.hiCv.height);
      R.hiNation = nid; if (!nid) return;
      g.strokeStyle = '#fff6c8'; g.lineWidth = 3;
      for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++) {
        const i = y * W.w + x, o = W.owner[i] === nid;
        if (x + 1 < W.w && o !== (W.owner[i + 1] === nid)) { g.beginPath(); g.moveTo((x + 1) * ts, y * ts); g.lineTo((x + 1) * ts, (y + 1) * ts); g.stroke(); }
        if (y + 1 < W.h && o !== (W.owner[i + W.w] === nid)) { g.beginPath(); g.moveTo(x * ts, (y + 1) * ts); g.lineTo((x + 1) * ts, (y + 1) * ts); g.stroke(); }
      }
    },
    // ---- カメラ ----
    toScreen(wx, wy) { return [(wx - R.cam.x) * R.cam.z + R.W / 2, (wy - R.cam.y) * R.cam.z + R.H / 2]; },
    toWorld(sx, sy) { return [(sx - R.W / 2) / R.cam.z + R.cam.x, (sy - R.H / 2) / R.cam.z + R.cam.y]; },
    tileToScreen(tx, ty) { return R.toScreen((tx + 0.5) * TS(), (ty + 0.5) * TS()); },
    fit() {
      const W = G.Map.W, ts = TS();
      R.cam.z = Math.max(R.W / (W.w * ts), R.H / (W.h * ts)) * 1.02;
      R.cam.x = W.w * ts / 2; R.cam.y = W.h * ts / 2; R.clamp();
    },
    minZ() { const W = G.Map.W, ts = TS(); return Math.min(R.W / (W.w * ts), R.H / (W.h * ts)) * 0.95; },
    clamp() {
      const W = G.Map.W, ts = TS();
      R.cam.z = G.clamp(R.cam.z, R.minZ(), 4.5);
      const hw = R.W / 2 / R.cam.z, hh = R.H / 2 / R.cam.z;
      R.cam.x = G.clamp(R.cam.x, Math.min(hw, W.w * ts / 2), Math.max(W.w * ts - hw, W.w * ts / 2));
      R.cam.y = G.clamp(R.cam.y, Math.min(hh, W.h * ts / 2), Math.max(W.h * ts - hh, W.h * ts / 2));
    },
    flyTo(tx, ty, z) {
      const ts = TS();
      R.fly = { x0: R.cam.x, y0: R.cam.y, z0: R.cam.z, x1: (tx + 0.5) * ts, y1: (ty + 0.5) * ts, z1: z || Math.max(R.cam.z, 1.6), t: performance.now(), dur: 900 };
    },
    input() {
      const cv = R.cv; let drag = null, pts = new Map(), pinch = null, moved = 0;
      cv.addEventListener('pointerdown', e => {
        cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.offsetX, e.offsetY]);
        if (pts.size === 1) { drag = { x: e.offsetX, y: e.offsetY, cx: R.cam.x, cy: R.cam.y }; moved = 0; }
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: R.cam.z }; drag = null; }
        R.fly = null;
      });
      cv.addEventListener('pointermove', e => {
        if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.offsetX, e.offsetY]);
        if (pinch && pts.size === 2) {
          const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, [wx, wy] = R.toWorld(mx, my);
          R.cam.z = pinch.z * d / pinch.d; R.clamp();
          const [wx2, wy2] = R.toWorld(mx, my); R.cam.x += wx - wx2; R.cam.y += wy - wy2; R.clamp(); moved = 99; return;
        }
        if (drag) {
          const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y; moved = Math.max(moved, Math.hypot(dx, dy));
          if (moved > 4) { R.cam.x = drag.cx - dx / R.cam.z; R.cam.y = drag.cy - dy / R.cam.z; R.clamp(); }
        } else R.hover = R.pick(e.offsetX, e.offsetY);
      });
      const up = e => {
        pts.delete(e.pointerId);
        if (pts.size < 2) pinch = null;
        if (drag && moved < 6 && pts.size === 0) { const hit = R.pick(e.offsetX, e.offsetY); G.emit('pick', hit); }
        if (pts.size === 0) drag = null;
      };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', e => {
        e.preventDefault(); R.fly = null;
        const [wx, wy] = R.toWorld(e.offsetX, e.offsetY);
        R.cam.z *= Math.exp(-e.deltaY * 0.0015); R.clamp();
        const [wx2, wy2] = R.toWorld(e.offsetX, e.offsetY); R.cam.x += wx - wx2; R.cam.y += wy - wy2; R.clamp();
      }, { passive: false });
    },
    // 画面のどこを押したか
    pick(sx, sy) {
      const ts = TS(); let best = null, bd = 1e9;
      const near = (tx, ty, r) => { const [x, y] = R.tileToScreen(tx, ty); const d = Math.hypot(x - sx, y - sy); return d < r ? d : null; };
      for (const b of G.vals(G.S.battles)) { if (b.over) continue; const d = near(b.x, b.y, 22); if (d !== null && d < bd) { bd = d; best = { type: 'battle', id: b.id }; } }
      for (const a of G.armies()) { const d = near(a.x, a.y, 20); if (d !== null && d - 4 < bd) { bd = d - 4; best = { type: 'army', id: a.id }; } }
      for (const c of G.cities()) { const d = near(c.x, c.y, 24); if (d !== null && d + 2 < bd) { bd = d + 2; best = { type: 'city', id: c.id }; } }
      for (const i of R.spot) { if (!i.at) continue; const d = near(i.at.x, i.at.y, 16); if (d !== null && d + 6 < bd) { bd = d + 6; best = { type: 'incident', id: i.id }; } }
      if (best) return best;
      const [wx, wy] = R.toWorld(sx, sy), tx = Math.floor(wx / ts), ty = Math.floor(wy / ts);
      if (!G.Map.inside(tx, ty)) return null;
      const o = G.Map.W.owner[ty * G.Map.W.w + tx];
      return { type: 'place', x: tx, y: ty, nation: o };
    },
    // 軍の旗を国の色にする(画像のマゼンタ部分)
    armySprite(race, color) {
      const key = race + color; if (R.flagCache[key]) return R.flagCache[key];
      const img = R.img.armies; if (!img) return null;
      const sw = img.width / 6, col = race === 'human' ? 0 : 1;
      const cv = document.createElement('canvas'); cv.width = sw; cv.height = img.height;
      const g = cv.getContext('2d'); g.drawImage(img, col * sw, 0, sw, img.height, 0, 0, sw, img.height);
      const d = g.getImageData(0, 0, sw, img.height), p = d.data;
      const c = parseInt(color.slice(1), 16), cr = c >> 16, cg = (c >> 8) & 255, cb = c & 255;
      for (let i = 0; i < p.length; i += 4) if (p[i] > 180 && p[i + 2] > 180 && p[i + 1] < 90) { const k = p[i] / 255; p[i] = cr * k; p[i + 1] = cg * k; p[i + 2] = cb * k; }
      g.putImageData(d, 0, 0);
      return (R.flagCache[key] = cv);
    },
    cityLevel(c) { return c.pop < 2500 ? 0 : c.pop < 5000 ? 1 : c.pop < 9000 ? 2 : c.pop < 14000 ? 3 : 4; },

    // ---- 毎フレーム ----
    frame(now) {
      requestAnimationFrame(R.frame);
      if (!G.S || !R.terrain) return;
      if (R.fly) {
        const k = Math.min(1, (now - R.fly.t) / R.fly.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        R.cam.x = R.fly.x0 + (R.fly.x1 - R.fly.x0) * e; R.cam.y = R.fly.y0 + (R.fly.y1 - R.fly.y0) * e; R.cam.z = R.fly.z0 + (R.fly.z1 - R.fly.z0) * e;
        R.clamp(); if (k >= 1) R.fly = null;
      }
      const g = R.ctx, ts = TS(), z = R.cam.z, T = now / 1000;
      g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
      g.fillStyle = '#0b1424'; g.fillRect(0, 0, R.W, R.H);
      g.save();
      g.translate(R.W / 2, R.H / 2); g.scale(z, z); g.translate(-R.cam.x, -R.cam.y);
      g.imageSmoothingEnabled = z < 1;
      g.drawImage(R.terrain, 0, 0);
      g.drawImage(R.terr, 0, 0);
      if (R.sel && R.sel.type === 'nation' && R.hiNation === R.sel.id) { g.globalAlpha = 0.6 + 0.4 * Math.sin(T * 3); g.drawImage(R.hiCv, 0, 0); g.globalAlpha = 1; }
      g.imageSmoothingEnabled = true;
      // 嵐
      for (const w of (G.S.weather || [])) {
        const x = (w.x + 0.5) * ts, y = (w.y + 0.5) * ts, r = w.r * ts;
        const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(40,50,70,0.55)'); gr.addColorStop(1, 'rgba(40,50,70,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        g.strokeStyle = 'rgba(180,200,230,0.5)'; g.lineWidth = 1;
        for (let k = 0; k < 40; k++) { const a = (k * 97.3) % 1, b = (k * 61.7) % 1, px = x + (a - 0.5) * r * 1.6, py = y + (((b + T * 1.5) % 1) - 0.5) * r * 1.6; g.beginPath(); g.moveTo(px, py); g.lineTo(px - 3, py + 8); g.stroke(); }
      }
      R.drawPaths(g, ts);
      R.drawCities(g, ts, z, T);
      R.drawArmies(g, ts, z, T);
      R.drawBattles(g, ts, z, T);
      R.drawAnims(g, ts, now);
      R.drawSpot(g, ts, z, T);
      g.restore();
      R.drawLabels(g, ts, z);
    },
    // 地図の上にうかぶ短い知らせ
    pops: [],
    pop(x, y, text, k) {
      const now = performance.now();
      const near = R.pops.filter(p => Math.abs(p.x - x) < 4 && Math.abs(p.y - y) < 4 && now - p.t < 5000).length;
      R.pops.push({ x, y, text, k, t: now, lane: near });
      if (R.pops.length > 6) R.pops.shift();
    },
    drawPops(g, ts, z) {
      const now = performance.now(), DUR = 5500;
      R.pops = R.pops.filter(p => now - p.t < DUR);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 13px sans-serif';
      for (const p of R.pops) {
        const age = (now - p.t) / DUR, [x, y0] = R.tileToScreen(p.x, p.y);
        const y = y0 - 34 - p.lane * 26 - Math.min(1, age * 6) * 8;
        if (x < -100 || x > R.W + 100 || y < -30 || y > R.H + 30) continue;
        const a = age < 0.75 ? 1 : 1 - (age - 0.75) / 0.25;
        const w = g.measureText(p.text).width + 16;
        g.globalAlpha = a;
        g.fillStyle = p.k === 'goddess' ? 'rgba(60,48,10,0.92)' : p.k === 'war' ? 'rgba(70,14,10,0.9)' : 'rgba(15,18,34,0.9)';
        g.strokeStyle = p.k === 'goddess' ? '#fff3b0' : p.k === 'war' ? '#ff7a6a' : '#c9b78a'; g.lineWidth = 1.5;
        g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - 12, w, 24, 6) : g.rect(x - w / 2, y - 12, w, 24); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(x - 5, y + 12); g.lineTo(x + 5, y + 12); g.lineTo(x, y0 - 6); g.closePath(); g.fill();
        g.fillStyle = '#fff'; g.fillText(p.text, x, y + 0.5);
        g.globalAlpha = 1;
      }
    },
    drawPaths(g, ts) {
      const sel = R.sel && R.sel.type === 'army' ? R.sel.id : null;
      for (const a of G.armies()) {
        if (!a.path || a.pi >= a.path.length) continue;
        const war = a.mission === 'attack' || a.mission === 'hunt' || a.mission === 'relief';
        if (!war && a.id !== sel) continue;
        const n = G.N(a.nation);
        g.strokeStyle = a.id === sel ? '#fff3b0' : (n ? n.color : '#fff'); g.globalAlpha = a.id === sel ? 0.95 : 0.55; g.lineWidth = a.id === sel ? 2.5 : 1.6;
        g.setLineDash([5, 4]); g.lineDashOffset = -performance.now() / 60;
        g.beginPath(); g.moveTo((a.x + 0.5) * ts, (a.y + 0.5) * ts);
        for (let i = a.pi; i < a.path.length; i++) g.lineTo((a.path[i][0] + 0.5) * ts, (a.path[i][1] + 0.5) * ts);
        g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
        const end = a.path[a.path.length - 1];
        if (war) { g.fillStyle = '#ff5a4a'; g.font = `bold ${ts * 1.1}px sans-serif`; g.textAlign = 'center'; g.fillText('✕', (end[0] + 0.5) * ts, (end[1] + 0.9) * ts); }
      }
    },
    drawCities(g, ts, z, T) {
      const sp = R.img.cities, sw = sp ? sp.width / 5 : 0;
      for (const c of G.cities()) {
        const n = G.N(c.owner), x = (c.x + 0.5) * ts, y = (c.y + 0.5) * ts;
        const cap = n && n.capital === c.id, lv = R.cityLevel(c);
        const w = (cap ? 3.4 : 2.4 + lv * 0.2) * ts, h = w * 0.75;
        if (c.plague) { g.fillStyle = `rgba(110,200,80,${0.25 + 0.1 * Math.sin(T * 2 + c.x)})`; g.beginPath(); g.arc(x, y, w * 0.8, 0, 7); g.fill(); }
        if (c.ward > G.S.day) { g.strokeStyle = `rgba(200,230,255,${0.5 + 0.3 * Math.sin(T * 2)})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, w * 0.62, 0, 7); g.stroke(); }
        if (sp) g.drawImage(sp, lv * sw, 0, sw, sp.height, x - w / 2, y - h * 0.65, w, h);
        else { g.fillStyle = n ? n.color : '#999'; g.fillRect(x - 5, y - 5, 10, 10); }
        // 燃える町
        if (c.burn > 0) for (let k = 0; k < 6; k++) { const f = (T * 1.3 + k * 0.37) % 1; g.fillStyle = `rgba(255,${120 + k * 15},40,${1 - f})`; g.beginPath(); g.arc(x + Math.sin(k * 2.1 + T) * w * 0.25, y - f * h * 0.9, (1 - f) * ts * 0.45, 0, 7); g.fill(); }
        // 包囲
        if (c.siege) { g.strokeStyle = '#ff4a3a'; g.lineWidth = 2.5; g.setLineDash([6, 5]); g.lineDashOffset = T * 20; g.beginPath(); g.arc(x, y, w * 0.7, 0, 7); g.stroke(); g.setLineDash([]); }
        if (c.temple && z > 1.3) { g.fillStyle = '#ffe9a8'; g.font = `${ts * 0.8}px serif`; g.textAlign = 'center'; g.fillText('✟', x + w * 0.45, y - h * 0.35); }
        if (R.sel && R.sel.type === 'city' && R.sel.id === c.id) { g.strokeStyle = '#fff3b0'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, w * 0.7 + Math.sin(T * 4) * 2, 0, 7); g.stroke(); }
      }
    },
    drawArmies(g, ts, z, T) {
      for (const a of G.armies()) {
        const n = G.N(a.nation); if (!n) continue;
        const spr = R.armySprite(n.race, n.color);
        const s = ts * (1.8 + Math.min(1.6, a.men / 5000)), x = (a.x + 0.5) * ts, y = (a.y + 0.5) * ts;
        const bob = a.state === 'march' || a.state === 'retreat' ? Math.abs(Math.sin(T * 6 + a.x)) * 1.5 : 0;
        const shake = a.state === 'battle' ? Math.sin(T * 30) * 1.2 : 0;
        if (a.blessed > G.S.day) { g.fillStyle = `rgba(255,240,170,${0.3 + 0.15 * Math.sin(T * 3)})`; g.beginPath(); g.arc(x, y, s * 0.6, 0, 7); g.fill(); }
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, y + s * 0.38, s * 0.42, s * 0.12, 0, 0, 7); g.fill();
        if (spr) { if (a.state === 'retreat') g.globalAlpha = 0.75; g.drawImage(spr, x - s / 2 + shake, y - s * 0.6 - bob, s, s); g.globalAlpha = 1; }
        else { g.fillStyle = n.color; g.fillRect(x - 4, y - 4, 8, 8); }
        if (R.sel && R.sel.type === 'army' && R.sel.id === a.id) { g.strokeStyle = '#fff3b0'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, s * 0.55, 0, 7); g.stroke(); }
      }
    },
    drawBattles(g, ts, z, T) {
      for (const b of G.vals(G.S.battles)) {
        const x = (b.x + 0.5) * ts, y = (b.y + 0.5) * ts;
        if (b.over) { const k = (G.S.day - b.over) / 20; g.fillStyle = `rgba(90,60,40,${0.35 * (1 - k)})`; g.beginPath(); g.arc(x, y, ts * 1.6, 0, 7); g.fill(); continue; }
        const r = ts * (b.important ? 2.4 : 1.7);
        const gr = g.createRadialGradient(x, y, 0, x, y, r * 1.6); gr.addColorStop(0, 'rgba(255,120,60,0.5)'); gr.addColorStop(1, 'rgba(255,120,60,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 1.6, 0, 7); g.fill();
        for (let k = 0; k < 10; k++) { const f = (T * 2 + k * 0.13) % 1, a = k * 0.63 + T; g.fillStyle = k % 2 ? `rgba(255,220,120,${1 - f})` : `rgba(160,140,120,${0.6 * (1 - f)})`; g.beginPath(); g.arc(x + Math.cos(a) * r * f, y + Math.sin(a) * r * f * 0.7, ts * 0.22 * (1 - f) + 1, 0, 7); g.fill(); }
        g.font = `bold ${ts * (b.important ? 2.2 : 1.6)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; const sc = 1 + 0.08 * Math.sin(T * 8);
        g.save(); g.translate(x, y - ts); g.scale(sc, sc); g.strokeText('⚔', 0, 0); g.fillText('⚔', 0, 0); g.restore();
        if (b.important) { g.strokeStyle = `rgba(255,215,90,${0.6 + 0.4 * Math.sin(T * 4)})`; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, r * 1.25, 0, 7); g.stroke(); }
        g.textBaseline = 'alphabetic';
      }
    },
    drawAnims(g, ts, now) {
      R.anims = R.anims.filter(a => now - a.t < a.dur);
      for (const a of R.anims) {
        const k = G.clamp((now - a.t) / a.dur, 0, 1), x = (a.x + 0.5) * ts, y = (a.y + 0.5) * ts;
        const col = { divine: '255,240,180', oracle: '255,230,140', dream: '190,160,255', whisper: '170,90,220', dark: '120,40,160', hero: '255,215,90', bless: '255,250,200', light: '255,250,220', harvest: '240,210,90', forge: '255,140,60', bond: '255,150,190', fog: '200,210,220', unrest: '255,80,60', clash: '255,90,60', quake: '200,150,90', temple: '255,240,180', plague: '120,210,90', fire: '255,120,40', battle: '255,150,80', storm: '150,170,210', pillar: '255,245,200', meteor: '255,150,60', siege: '255,80,60' }[a.type] || '255,255,255';
        if (a.type === 'pillar' || a.type === 'hero' || a.type === 'divine') {
          const h = ts * 30, w = ts * (a.type === 'pillar' ? 2.2 : 1.4) * (1 - Math.abs(0.5 - k));
          const gr = g.createLinearGradient(x, y - h, x, y); gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(1, `rgba(${col},${0.85 * (1 - k)})`);
          g.fillStyle = gr; g.fillRect(x - w / 2, y - h, w, h);
        }
        if (a.type === 'meteor') {
          if (k < 0.35) { const f = k / 0.35, sx = x + ts * 25 * (1 - f), sy = y - ts * 30 * (1 - f); g.strokeStyle = `rgba(${col},0.9)`; g.lineWidth = ts * 0.7; g.beginPath(); g.moveTo(sx + ts * 5, sy - ts * 6); g.lineTo(sx, sy); g.stroke(); g.fillStyle = '#fff3c0'; g.beginPath(); g.arc(sx, sy, ts * 0.6, 0, 7); g.fill(); }
          else { const f = (k - 0.35) / 0.65; g.fillStyle = `rgba(255,180,80,${0.8 * (1 - f)})`; g.beginPath(); g.arc(x, y, ts * (1 + f * 5), 0, 7); g.fill(); }
          continue;
        }
        if (a.type === 'quake') { for (let i = 0; i < 3; i++) { const f = (k + i * 0.3) % 1; g.strokeStyle = `rgba(${col},${1 - f})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, ts * (1 + f * 5), 0, 7); g.stroke(); } continue; }
        // 光の輪と粒
        g.strokeStyle = `rgba(${col},${1 - k})`; g.lineWidth = 2.5;
        g.beginPath(); g.arc(x, y, ts * (0.8 + k * 4), 0, 7); g.stroke();
        for (let i = 0; i < 12; i++) { const an = i / 12 * 6.283 + k * 2, r = ts * (0.5 + k * 3.2); g.fillStyle = `rgba(${col},${1 - k})`; g.beginPath(); g.arc(x + Math.cos(an) * r, y + Math.sin(an) * r - k * ts * 2, ts * 0.22, 0, 7); g.fill(); }
      }
    },
    // いま注目の出来事(1〜3)の場所
    drawSpot(g, ts, z, T) {
      R.spot.forEach((i, k) => {
        if (!i.at) return;
        const x = (i.at.x + 0.5) * ts, y = (i.at.y + 0.5) * ts;
        const r = ts * 2.6 + Math.sin(T * 3 + k) * ts * 0.4;
        g.strokeStyle = i.status === 'done' ? 'rgba(220,210,190,0.7)' : 'rgba(255,214,90,0.95)'; g.lineWidth = 2.5 / Math.max(0.7, z) * 1.4;
        g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
        const bx = x + r * 0.75, by = y - r * 0.75, br = Math.max(ts * 0.9, 9 / z);
        g.fillStyle = '#ffd65a'; g.beginPath(); g.arc(bx, by, br, 0, 7); g.fill();
        g.fillStyle = '#2a1a05'; g.font = `bold ${br * 1.3}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(k + 1), bx, by + br * 0.05); g.textBaseline = 'alphabetic';
      });
    },
    // 文字は画面の大きさで描く(ズームしても読める)
    drawLabels(g, ts, z) {
      g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const showAll = z > 0.95;
      for (const c of G.cities()) {
        const n = G.N(c.owner), cap = n && n.capital === c.id;
        if (!cap && !showAll) continue;
        const [x, y0] = R.tileToScreen(c.x, c.y), y = y0 + ts * z * 1.25 + 7;
        if (x < -50 || y < -20 || x > R.W + 50 || y > R.H + 20) continue;
        const fs = cap ? 13 : 11.5, txt = (cap ? '♛ ' : '') + c.name;
        g.font = `${cap ? 'bold ' : ''}${fs}px "Shippori Mincho", serif`;
        const w = g.measureText(txt).width + 10;
        g.fillStyle = 'rgba(15,10,6,0.72)'; g.beginPath(); g.roundRect ? g.roundRect(x - w / 2, y - 9, w, 18, 4) : g.rect(x - w / 2, y - 9, w, 18); g.fill();
        if (n) { g.fillStyle = n.color; g.fillRect(x - w / 2, y - 9, 3, 18); }
        g.fillStyle = c.siege ? '#ff8a7a' : '#f6ecd2'; g.fillText(txt, x + 1, y + 0.5);
      }
      // 国の名前(ひいて見たとき)
      if (z < 1.25) {
        for (const n of G.nations()) {
          if (!n.cities.length) continue;
          let sx = 0, sy = 0; for (const cid of n.cities) { sx += G.C(cid).x; sy += G.C(cid).y; }
          const [x, y] = R.tileToScreen(sx / n.cities.length, sy / n.cities.length - 3);
          g.font = `bold ${n.cities.length > 3 ? 17 : 14}px "Shippori Mincho", serif`;
          g.lineWidth = 4; g.strokeStyle = 'rgba(10,6,3,0.85)'; g.strokeText(n.name, x, y);
          g.fillStyle = n.race === 'human' ? '#fff4d6' : '#f0d8ff'; g.fillText(n.name, x, y);
        }
      }
      // 軍の兵数
      if (z > 1.1) for (const a of G.armies()) {
        const [x, y] = R.tileToScreen(a.x, a.y);
        if (x < -40 || y < -40 || x > R.W + 40 || y > R.H + 40) continue;
        g.font = 'bold 11px sans-serif'; const t = G.fmt(a.men);
        g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(t, x, y + ts * z * 0.9 + 4);
        g.fillStyle = a.state === 'retreat' ? '#ffb0a0' : '#fff'; g.fillText(t, x, y + ts * z * 0.9 + 4);
      }
      // 軍の行き先(どこを攻めに行くのか)
      if (z > 0.8) for (const a of G.armies()) {
        if (!a.path || a.pi >= a.path.length) continue;
        const goal = a.goal && G.C(a.goal), what = a.mission === 'attack' ? '攻撃' : a.mission === 'relief' ? '救援' : a.mission === 'retreat' ? '退却' : null;
        if (!what) continue;
        const [x, y] = R.tileToScreen(a.x, a.y); if (x < -40 || y < -40 || x > R.W + 40 || y > R.H + 40) continue;
        const t = goal ? `→${goal.name}へ${what}` : what; g.font = 'bold 10.5px sans-serif';
        const yy = y + ts * z * 0.9 + (z > 1.1 ? 17 : 4);
        g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(t, x, yy);
        g.fillStyle = what === '攻撃' ? '#ffb4a8' : what === '救援' ? '#b8e0ff' : '#ddd'; g.fillText(t, x, yy);
      }
      R.drawPops(g, ts, z);
      g.textBaseline = 'alphabetic';
    }
  };
  G.Render = R;
})(globalThis.GD = globalThis.GD || {});
