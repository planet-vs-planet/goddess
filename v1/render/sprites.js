// 絵の準備。ChatGPTで作った画像(assets/)があればそれを使い、なければプログラムで仮の絵を描く。
(function (G) {
  const TS = () => G.CFG.TILE;

  // 地形の色(仮の絵用)
  const PAL = {
    deep: ['#0d1b2e', '#0f1f35', '#112339'], sea: ['#163252', '#17375a', '#1a3c61'], shallow: ['#235a7a', '#26607f', '#2a6888'],
    lake: ['#2a6f93', '#2d7599', '#3080a3'], river: ['#4a7d3a', '#4f8540', '#538a43'], grass: ['#4f7d36', '#56853b', '#5b8c40', '#4a7532'],
    forest: ['#2f5a2c', '#33612f', '#2b5228'], deepforest: ['#1d3d22', '#21442a', '#1a3720'], mountain: ['#6d665e', '#7a7268', '#5e5850'],
    snow: ['#d9e1e8', '#e6ecf1', '#cdd6de'], desert: ['#c9a96a', '#d1b273', '#bf9f60'], swamp: ['#3f4d34', '#46553a', '#394630'],
    coast: ['#cdbb87', '#d4c290', '#c4b27e']
  };

  function hash(x, y, k) { let h = (x * 374761393 + y * 668265263 + (k || 0) * 2246822519) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  const Sprites = {
    images: {}, // ChatGPTの画像(読みこめたものだけ)

    // assets/ の画像を読む(ファイルを直接開いても動くように <img> で読む)
    loadOptional(list, done) {
      let left = list.length;
      if (!left) return done();
      for (const [key, src] of list) {
        const img = new Image();
        img.onload = () => { Sprites.images[key] = img; if (--left === 0) done(); };
        img.onerror = () => { if (--left === 0) done(); };
        img.src = src;
      }
    },

    // ---- 地形 ----
    terrainCanvas(world) {
      const ts = TS(), cv = document.createElement('canvas');
      cv.width = world.w * ts; cv.height = world.h * ts;
      const g = cv.getContext('2d');
      const tiles = Sprites.images.tiles; // 13列 × 何行か(行=バリエーション)
      for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) {
        const i = y * world.w + x, k = world.t[i], key = G.TERRAIN[k].key;
        if (tiles) {
          const cw = tiles.width / 13, rows = Math.max(1, Math.round(tiles.height / cw));
          const v = Math.floor(hash(x >> 1, y >> 1, 1) * rows);
          g.imageSmoothingEnabled = false;
          g.drawImage(tiles, k * cw, v * cw, cw, cw, x * ts, y * ts, ts, ts);
        } else Sprites.drawTile(g, x, y, key, world, i);
      }
      // 川は線でつなげて描く
      g.fillStyle = tiles ? '#2f7fc0' : '#3f86b8';
      for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) {
        const i = y * world.w + x;
        if (!world.river[i]) continue;
        const lw = Math.max(2, Math.round(ts / 4)), px = x * ts, py = y * ts, m = (ts - lw) / 2;
        g.fillRect(px + m, py + m, lw, lw);
        const best = world.flow ? world.flow[i] : -1;
        // 下流のマスの中心まで、まるごと線を引く
        if (best === i - 1) g.fillRect(px - ts + m, py + m, ts + lw, lw);
        else if (best === i + 1) g.fillRect(px + m, py + m, ts + lw, lw);
        else if (best === i - world.w) g.fillRect(px + m, py - ts + m, lw, ts + lw);
        else if (best === i + world.w) g.fillRect(px + m, py + m, lw, ts + lw);
      }
      // 陸と海のさかいめを暗くする(立体感)
      const img = g.getImageData(0, 0, cv.width, cv.height), d = img.data;
      for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) {
        const i = y * world.w + x;
        const e = world.elev[i];
        if (G.TERRAIN[world.t[i]].water) continue;
        const shade = 1 + Math.max(-0.12, Math.min(0.12, (e - (world.elev[i - world.w] || e)) * 1.4));
        for (let yy = 0; yy < ts; yy++) for (let xx = 0; xx < ts; xx++) {
          const p = ((y * ts + yy) * cv.width + x * ts + xx) * 4;
          d[p] = Math.min(255, d[p] * shade); d[p + 1] = Math.min(255, d[p + 1] * shade); d[p + 2] = Math.min(255, d[p + 2] * shade);
        }
      }
      g.putImageData(img, 0, 0);
      return cv;
    },

    drawTile(g, x, y, key, world, i) {
      const ts = TS(), px = x * ts, py = y * ts, pal = PAL[key] || PAL.grass;
      // 下地のドット
      for (let yy = 0; yy < ts; yy += 2) for (let xx = 0; xx < ts; xx += 2) {
        g.fillStyle = pal[Math.floor(hash(x * 4 + xx, y * 4 + yy, 7) * pal.length)];
        g.fillRect(px + xx, py + yy, 2, 2);
      }
      const r = hash(x, y, 3);
      if (key === 'forest' || key === 'deepforest') {
        const dark = key === 'deepforest' ? '#122a17' : '#1f4521', lite = key === 'deepforest' ? '#2d5a33' : '#4a7d3f';
        const ox = r > 0.5 ? 1 : 3;
        g.fillStyle = dark; g.fillRect(px + ox, py + 2, 4, 4); g.fillRect(px + ox + 1, py + 1, 2, 1);
        g.fillStyle = lite; g.fillRect(px + ox + 1, py + 2, 2, 2);
        g.fillStyle = '#4a3420'; g.fillRect(px + ox + 1, py + 6, 2, 1);
      } else if (key === 'mountain' || key === 'snow' && world.elev[i] > 0.62) {
        g.fillStyle = key === 'snow' ? '#9aa6b1' : '#4a453f';
        g.fillRect(px + 1, py + 6, 6, 1); g.fillRect(px + 2, py + 4, 4, 2); g.fillRect(px + 3, py + 2, 2, 2);
        g.fillStyle = '#eef3f6'; g.fillRect(px + 3, py + 2, 2, 1);
        if (world.elev[i] > 0.75) g.fillRect(px + 2, py + 3, 4, 1);
      } else if (key === 'swamp') {
        g.fillStyle = '#2c4a52'; if (r < 0.6) g.fillRect(px + 2, py + 3, 3, 2);
        g.fillStyle = '#6b7a3f'; g.fillRect(px + 5, py + 1, 1, 3);
      } else if (key === 'desert') {
        g.fillStyle = '#b08d52'; if (r < 0.4) { g.fillRect(px + 1, py + 5, 4, 1); g.fillRect(px + 2, py + 4, 2, 1); }
      } else if (key === 'grass' || key === 'river') {
        g.fillStyle = '#6c9c48'; if (r < 0.35) g.fillRect(px + 2 + ((r * 10) | 0) % 4, py + 3, 1, 2);
      } else if (key === 'sea' || key === 'deep') {
        g.fillStyle = key === 'deep' ? '#14284a' : '#22466c'; if (r < 0.12) g.fillRect(px + 2, py + 4, 3, 1);
      } else if (key === 'shallow') {
        g.fillStyle = '#3a7896'; if (r < 0.25) g.fillRect(px + 1, py + 2, 2, 1);
      }
    },

    // ---- 領土の色 ----
    drawTerritory(cv, world, cities, nations, mode, selectedNation) {
      const ts = TS(), g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      if (mode === 'terrain') return;
      const owner = new Int32Array(world.w * world.h).fill(-1);
      for (let i = 0; i < owner.length; i++) { const r = world.region[i]; if (r >= 0 && cities[r]) owner[i] = cities[r].owner == null ? -1 : cities[r].owner; }
      const col = {};
      for (const id in nations) {
        const c = nations[id].color;
        col[id] = [(c >> 16) & 255, (c >> 8) & 255, c & 255];
      }
      const img = g.createImageData(cv.width, cv.height), d = img.data;
      const put = (px, py, rgb, a) => { const p = (py * cv.width + px) * 4; d[p] = rgb[0]; d[p + 1] = rgb[1]; d[p + 2] = rgb[2]; d[p + 3] = a; };
      for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) {
        const i = y * world.w + x, o = owner[i];
        if (o < 0) continue;
        const rgb = col[o]; if (!rgb) continue;
        const sel = selectedNation != null && selectedNation === o;
        const dim = selectedNation != null && !sel;
        const art = !!Sprites.images.tiles;
        const fillA = sel ? (art ? 95 : 120) : dim ? (art ? 25 : 45) : (art ? 62 : 85);
        const bL = x === 0 || owner[i - 1] !== o, bR = x === world.w - 1 || owner[i + 1] !== o;
        const bT = y === 0 || owner[i - world.w] !== o, bB = y === world.h - 1 || owner[i + world.w] !== o;
        const regEdge = (x > 0 && world.region[i - 1] !== world.region[i] && owner[i - 1] === o) || (y > 0 && world.region[i - world.w] !== world.region[i] && owner[i - world.w] === o);
        const dark = [rgb[0] * 0.55 | 0, rgb[1] * 0.55 | 0, rgb[2] * 0.55 | 0];
        for (let yy = 0; yy < ts; yy++) for (let xx = 0; xx < ts; xx++) {
          let a = fillA, c = rgb;
          if ((bL && xx < 2) || (bR && xx >= ts - 2) || (bT && yy < 2) || (bB && yy >= ts - 2)) { a = 235; c = sel ? [255, 240, 190] : dark; }
          else if (regEdge && ((x > 0 && world.region[i - 1] !== world.region[i] && xx === 0) || (y > 0 && world.region[i - world.w] !== world.region[i] && yy === 0)) && (xx + yy) % 2 === 0) { a = 110; c = dark; }
          put(x * ts + xx, y * ts + yy, c, a);
        }
      }
      g.putImageData(img, 0, 0);
    },

    // ---- 小さなドット絵(仮) ----
    // 文字の配列で描く: '.'=透明, それ以外は色表
    pixelArt(rows, colors, scale) {
      const s = scale || 1, cv = document.createElement('canvas');
      cv.width = rows[0].length * s; cv.height = rows.length * s;
      const g = cv.getContext('2d');
      rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.' && colors[ch]) { g.fillStyle = colors[ch]; g.fillRect(x * s, y * s, s, s); } }));
      return cv;
    },

    cityCanvas(level) {
      const atlas = Sprites.images.cities; // 横に5つ(村→大都市)
      if (atlas) {
        const cw = atlas.width / 5, cv = document.createElement('canvas');
        cv.width = cw; cv.height = atlas.height; const g = cv.getContext('2d');
        g.drawImage(atlas, level * cw, 0, cw, atlas.height, 0, 0, cw, atlas.height);
        return cv;
      }
      const C = { k: '#1b1410', w: '#c9b48a', r: '#8b3a2e', s: '#8d8a84', d: '#5c5650', y: '#f2d27a', f: '#ffffff' };
      const arts = [
        ['............', '............', '............', '............', '...kk.......', '..krrk..kk..', '.krrrrkkrrk.', '.kwwwwkkwwk.', '.kwkwwkkwkk.', '.kwwwwkkwwk.', '.kkkkkkkkkk.', '............'],
        ['............', '............', '.....kk.....', '....krrk....', '.kkkrrrrkkk.', 'krrkwwwwkrrk', 'kwwkwkwwkwwk', 'kwkkwwwwkwkk', 'kwwkwwkwkwwk', 'kkkkkkkkkkkk', '............', '............'],
        ['............', '....kf......', '....kff.....', '...kkk......', '..krrrk.kk..', 'kkkwwwkkrrkk', 'ksskwkwkwwss', 'ksdswwwkwkds', 'kssskkwkwsss', 'ksdssssssdss', 'kkkkkkkkkkkk', '............'],
        ['.....kf.....', '.....kff....', '..kk.k..kk..', '.kssk..kssk.', '.ksskkkkssk.', '.ksdsssssdsk', 'kkssskykssskk'.slice(0, 12), 'ksssskkksssk', 'ksdsskyksdsk', 'ksssskkksssk', 'kkkkkkkkkkkk', '............'],
        ['..kf....kf..', '..kff...kff.', '.kkk..kf.kkk', 'kssk.kkk.ksk', 'kssk.kssksskk'.slice(0, 12), 'ksdkkksskdsk', 'ksssssdsssss', 'kssykssssyks', 'ksssskkkssss', 'ksdsskyksdss', 'kkkkkkkkkkkk', '............']
      ];
      return Sprites.pixelArt(arts[level] || arts[0], C, 3);
    },
    // 軍隊の絵(ChatGPT): 旗の印(マゼンタ)を国の色にぬる
    armyCanvas(race, color) {
      const atlas = Sprites.images.armies; if (!atlas) return null;
      const order = ['human', 'demon', 'elf', 'dwarf', 'beast', 'dragon'];
      const fw = atlas.width / 6, cv = document.createElement('canvas');
      cv.width = fw; cv.height = atlas.height;
      const g = cv.getContext('2d');
      g.drawImage(atlas, Math.max(0, order.indexOf(race)) * fw, 0, fw, atlas.height, 0, 0, fw, atlas.height);
      const img = g.getImageData(0, 0, cv.width, cv.height), d = img.data;
      const r = (color >> 16) & 255, gr = (color >> 8) & 255, b = color & 255;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 240 && d[i + 1] < 20 && d[i + 2] > 240) { d[i] = r; d[i + 1] = gr; d[i + 2] = b; }
      g.putImageData(img, 0, 0);
      return cv;
    },
    bannerCanvas() { // 白い部分に国の色がつく
      const C = { k: '#111111', w: '#ffffff', p: '#9a8a6a' };
      return Sprites.pixelArt(['.k......', '.kkkkkk.', '.kwwwwwk', '.kwwwwwk', '.kwwwwk.', '.kwwwk..', '.kkkk...', '.p......', '.p......', '.p......', 'ppp.....'], C, 3);
    },
    monsterCanvas() {
      const C = { k: '#120a10', r: '#b02a3a', e: '#ffdd55', p: '#5a2a5a' };
      return Sprites.pixelArt(['..k....k..', '.kpk..kpk.', '.kppkkppk.', 'kpppppppk.', 'kpekppekpk', 'kpppppppk.', 'kprrrrrpk.', '.kpppppk..', '..k.k.k...'], C, 3);
    },
    swordsCanvas() {
      const C = { k: '#1a1a1a', s: '#e8e8e8', g: '#d4a017', r: '#b03030' };
      return Sprites.pixelArt(['k.......k', 'sk.....ks', '.sk...ks.', '..sk.ks..', '...sks...', '..gksk g'.replace(' ', 'g'), '.gk...kg.', 'rk.....kr', 'k.......k'], C, 3);
    },
    ruinCanvas(found) {
      const C = { k: '#1a1612', s: found ? '#c9b37a' : '#7d756a', d: found ? '#8a7442' : '#4e4840' };
      return Sprites.pixelArt(['.........', '.ks..sk..', '.ks..sk..', '.ksssssk.', '.kdkdkdk.', '.ks...sk.', 'kkkkkkkkk'], C, 3);
    },

    // ---- 顔(仮のドット絵) ----
    portraitCache: {},
    portrait(c) {
      if (Sprites.portraitCache[c.id]) return Sprites.portraitCache[c.id];
      const atlas = Sprites.images.portraits; // 6列(種族) × 4行(バリエーション)
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      if (atlas) {
        const order = G.RACE_KEYS, cw = atlas.width / 6, rows = Math.max(1, Math.round(atlas.height / cw));
        g.drawImage(atlas, order.indexOf(c.race) * cw, (c.look.hair % rows) * cw, cw, cw, 0, 0, 64, 64);
      } else {
        const skins = {
          human: ['#f1c9a5', '#d9a77e', '#b07a52', '#8a5a3a'], demon: ['#9a8cc0', '#7f6fa8', '#a07c9a', '#6a6a8c'], elf: ['#f6dcc4', '#ead1b5', '#e8cfa8', '#f0e0d0'],
          dwarf: ['#e5b48d', '#c99069', '#d8a07a', '#b88060'], beast: ['#c58b4f', '#a87038', '#d4a26a', '#8e6a4a'], dragon: ['#5e8a4a', '#8a3a30', '#3a5a8a', '#8a7a30']
        };
        const hairs = ['#2b1d14', '#5a3a1e', '#b8862f', '#e3d29a', '#8c2a1e', '#d8d8d8', '#3a3a5a', '#6a2a6a'];
        const sk = skins[c.race][c.look.skin % 4], hr = c.race === 'dragon' ? '#2a2a2a' : hairs[c.look.hair % 8];
        const eye = ['#2a4a8a', '#3a7a3a', '#6a3a1a', '#8a1a1a', '#d4a017'][c.look.eye % 5];
        const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x * 4, y * 4, w * 4, h * 4); };
        const bg = { human: '#2a3346', demon: '#2e2236', elf: '#203626', dwarf: '#3a2e22', beast: '#36301e', dragon: '#3a1e1e' }[c.race];
        P(0, 0, 16, 16, bg);
        P(3, 14, 10, 2, c.royal ? '#7a2a2a' : '#3a4a5a'); // 服
        P(5, 4, 6, 8, sk); P(4, 6, 1, 3, sk); P(11, 6, 1, 3, sk); // 顔
        P(6, 7, 1, 1, eye); P(9, 7, 1, 1, eye); P(7, 10, 2, 1, '#6a3a3a');
        if (c.race === 'elf') { P(3, 5, 1, 3, sk); P(12, 5, 1, 3, sk); }
        if (c.race === 'dwarf') { P(5, 9, 6, 4, hr); P(7, 10, 2, 1, '#6a3a3a'); }
        if (c.race === 'demon' || c.race === 'dragon') { P(4, 1, 1, 3, '#d9d0c0'); P(11, 1, 1, 3, '#d9d0c0'); }
        if (c.race === 'beast') { P(4, 2, 2, 2, hr); P(10, 2, 2, 2, hr); }
        if (c.race === 'dragon') { P(5, 4, 6, 1, '#00000033'); P(6, 11, 4, 1, '#00000044'); }
        P(5, 3, 6, 2, hr); if (c.look.style === 1 && c.sex === 'f') { P(4, 4, 1, 7, hr); P(11, 4, 1, 7, hr); }
        if (c.look.style === 2) P(4, 4, 1, 3, hr);
        if (c.role === 'ruler') { P(5, 1, 6, 2, '#d4a017'); P(6, 0, 1, 1, '#d4a017'); P(9, 0, 1, 1, '#d4a017'); }
        if (c.role === 'mage') P(4, 1, 8, 2, '#3a2a6a');
        if (c.role === 'general' || c.role === 'hero') P(3, 13, 10, 1, '#9aa0a8');
        if (!c.alive) { g.fillStyle = 'rgba(20,20,20,0.55)'; g.fillRect(0, 0, 64, 64); }
      }
      const url = cv.toDataURL();
      Sprites.portraitCache[c.id] = url;
      return url;
    },

    // ---- 国旗 ----
    flagCache: {},
    flag(n) {
      const key = n.id + ':' + n.color;
      if (Sprites.flagCache[key]) return Sprites.flagCache[key];
      const cv = document.createElement('canvas'); cv.width = 48; cv.height = 32;
      const g = cv.getContext('2d');
      const hex = '#' + n.color.toString(16).padStart(6, '0');
      const acc = ['#f2e6c4', '#1b1b1b', '#d4a017', '#ffffff', '#3a2a1a'][n.flag.acc];
      g.fillStyle = hex; g.fillRect(0, 0, 48, 32);
      g.fillStyle = acc;
      switch (n.flag.pat) {
        case 1: g.fillRect(0, 12, 48, 8); break;
        case 2: g.fillRect(18, 0, 8, 32); g.fillRect(0, 12, 48, 8); break;
        case 3: g.fillRect(0, 0, 16, 32); break;
        case 4: g.beginPath(); g.moveTo(0, 0); g.lineTo(20, 16); g.lineTo(0, 32); g.fill(); break;
        case 5: g.fillRect(0, 26, 48, 6); g.fillRect(0, 0, 48, 6); break;
      }
      // 紋章(4x4ドット)
      const E = ['.XX.XXXX.XX..XX.', 'X..X.XX..XX.X..X', '.X..XXX.XXXX.X.X', 'XXXX.XX..XX.XXXX', '..X..X.XXXXX.X.X', 'X.X..X..XXX.X.X.', '.XX.X..XX..X.XX.', 'XX..XX....XX..XX'][n.flag.emb];
      g.fillStyle = n.flag.acc === 1 ? '#f2e6c4' : '#1b1b1b';
      if (n.flag.pat !== 0) g.fillStyle = hex === acc ? '#000' : (n.flag.acc === 1 ? '#f2e6c4' : '#1b1b1b');
      for (let i = 0; i < 16; i++) if (E[i] === 'X') g.fillRect(30 + (i % 4) * 3, 10 + ((i / 4) | 0) * 3, 3, 3);
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; g.strokeRect(1, 1, 46, 30);
      const url = cv.toDataURL();
      Sprites.flagCache[key] = url;
      return url;
    },
    hexColor(n) { return '#' + (n.color != null ? n.color : n).toString(16).padStart(6, '0'); }
  };
  G.Sprites = Sprites;
})(globalThis.GD = globalThis.GD || {});
