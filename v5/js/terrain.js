// 地形を作る(シードから毎回ちがう大陸)
(function (G) {
  const T = G.T;

  function makeNoise(rng) {
    const P = 256, perm = new Uint16Array(P * 2), val = new Float32Array(P);
    for (let i = 0; i < P; i++) { perm[i] = i; val[i] = rng.next(); }
    for (let i = P - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < P; i++) perm[i + P] = perm[i];
    const h = (x, y) => val[perm[(perm[x & 255] + y) & 511]];
    const sm = t => t * t * (3 - 2 * t);
    function n2(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
      const u = sm(xf), v = sm(yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    return function fbm(x, y, oct) {
      let s = 0, amp = 1, f = 1, tot = 0;
      for (let o = 0; o < (oct || 5); o++) { s += n2(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2.03; }
      return s / tot;
    };
  }

  G.Terrain = {
    generate(seed) {
      const W = G.CFG.MAP_W, H = G.CFG.MAP_H, N = W * H;
      const rng = new G.RNG(seed + '/terrain');
      const nE = makeNoise(rng), nM = makeNoise(rng), nW = makeNoise(rng), nT = makeNoise(rng);
      const elev = new Float32Array(N), moist = new Float32Array(N), temp = new Float32Array(N);
      const t = new Uint8Array(N), river = new Uint8Array(N), flow = new Int32Array(N).fill(-1); // flow: 川の流れる先のマス
      // 大陸の形: 中心からの距離をゆがめる
      const cx = W * rng.range(0.46, 0.54), cy = H * rng.range(0.46, 0.54);
      const rot = rng.range(0, Math.PI);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const wx = (nW(x / 40, y / 40, 3) - 0.5) * 34, wy = (nW(x / 40 + 50, y / 40 + 50, 3) - 0.5) * 34;
        let dx = (x + wx - cx) / (W * 0.46), dy = (y + wy - cy) / (H * 0.44);
        const rx = dx * Math.cos(rot) - dy * Math.sin(rot), ry = dx * Math.sin(rot) + dy * Math.cos(rot);
        const d = Math.sqrt(rx * rx * 0.9 + ry * ry * 1.1);
        const base = nE(x / 26, y / 26, 6);
        let e = base * 0.62 + (1 - d) * 0.62 - 0.08;
        // 山脈の筋
        const ridge = 1 - Math.abs(nE(x / 34 + 100, y / 34 + 100, 4) - 0.5) * 2;
        e += Math.pow(ridge, 6) * 0.22 * (d < 0.9 ? 1 : 0);
        elev[i] = e;
        moist[i] = nM(x / 22, y / 22, 5);
        temp[i] = 0.12 + 0.88 * (y / H) + (nT(x / 30, y / 30, 3) - 0.5) * 0.3; // 北(上)ほど寒い
      }
      // 海の高さ: 陸が約47%になるように決める
      const sorted = Array.from(elev).sort((a, b) => a - b);
      const sea = sorted[Math.floor(N * 0.53)];
      const landMax = sorted[N - 1];
      for (let i = 0; i < N; i++) {
        const e = (elev[i] - sea) / (landMax - sea); // 陸は0〜1
        elev[i] = e;
        if (e < 0) { t[i] = e < -0.18 ? T.DEEP : (e < -0.05 ? T.SEA : T.SHALLOW); continue; }
        const tp = temp[i] - e * 0.35, m = moist[i];
        let k;
        if (e > 0.62) k = (e > 0.8 || tp < 0.32) ? T.SNOW : T.MOUNTAIN;
        else if (tp < 0.2) k = T.SNOW;
        else if (tp > 0.72 && m < 0.47) k = T.DESERT;
        else if (m > 0.63 && e < 0.22 && tp > 0.35) k = T.SWAMP;
        else if (m > 0.6) k = T.DEEPFOREST;
        else if (m > 0.5) k = T.FOREST;
        else k = T.GRASS;
        if (e > 0.5 && k !== T.SNOW && k !== T.MOUNTAIN && m < 0.6) k = (rng.next() < 0.35 ? T.MOUNTAIN : k);
        t[i] = k;
      }
      const isWater = i => G.TERRAIN[t[i]].water;
      // 海岸: 海に接する低い陸
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        if (isWater(i) || elev[i] > 0.09 || t[i] === T.SNOW || t[i] === T.MOUNTAIN) continue;
        if (isWater(i - 1) || isWater(i + 1) || isWater(i - W) || isWater(i + W)) t[i] = T.COAST;
      }
      // 湖
      const lakes = rng.int(3, 5);
      for (let k = 0; k < lakes; k++) {
        for (let tries = 0; tries < 60; tries++) {
          const x = rng.int(8, W - 9), y = rng.int(8, H - 9), i = y * W + x;
          if (elev[i] < 0.12 || elev[i] > 0.45 || t[i] === T.DESERT) continue;
          const r = rng.range(1.5, 3.2);
          for (let yy = -4; yy <= 4; yy++) for (let xx = -4; xx <= 4; xx++) {
            const d = Math.sqrt(xx * xx + yy * yy) + (rng.next() - 0.5) * 0.9;
            if (d < r) t[(y + yy) * W + x + xx] = T.LAKE;
          }
          break;
        }
      }
      // 川: 高い所から低い所へ
      const sources = [];
      for (let i = 0; i < N; i++) if (!isWater(i) && elev[i] > 0.48 && elev[i] < 0.75) sources.push(i);
      rng.shuffle(sources);
      let made = 0;
      for (const s of sources) {
        if (made >= 11) break;
        let cur = s, path = [], ok = false;
        const seen = new Set();
        for (let step = 0; step < 220; step++) {
          path.push(cur); seen.add(cur);
          const x = cur % W, y = (cur / W) | 0;
          const nb = [cur - 1, cur + 1, cur - W, cur + W].filter(j => j >= 0 && j < N && Math.abs((j % W) - x) <= 1);
          const end = nb.find(j => isWater(j) || river[j]);
          if (end != null) { ok = true; path.push(end); break; }
          let best = -1, be = Infinity;
          for (const j of nb) {
            if (seen.has(j)) continue;
            const v = elev[j] + rng.next() * 0.02;
            if (v < be) { be = v; best = j; }
          }
          if (best < 0) break;
          cur = best;
        }
        if (ok && path.length > 10) {
          for (let q = 0; q < path.length - 1; q++) { const p = path[q]; river[p] = 1; flow[p] = path[q + 1]; if (t[p] !== T.SNOW && t[p] !== T.MOUNTAIN) t[p] = T.RIVER; }
          made++;
        }
      }
      return { w: W, h: H, t, elev, moist, river, flow };
    }
  };
})(globalThis.GD = globalThis.GD || {});
