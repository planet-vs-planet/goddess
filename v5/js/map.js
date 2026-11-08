// マップの計算: 都市の領域・となり合う都市・道さがし
(function (G) {
  class Heap { // 小さい順の優先度つきキュー
    constructor() { this.k = []; this.v = []; }
    push(key, val) {
      const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
      while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break;[k[p], k[i]] = [k[i], k[p]];[v[p], v[i]] = [v[i], v[p]]; i = p; }
    }
    pop() {
      const k = this.k, v = this.v, top = v[0], last = k.length - 1;
      k[0] = k[last]; v[0] = v[last]; k.pop(); v.pop();
      let i = 0;
      for (; ;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];[v[m], v[i]] = [v[i], v[m]]; i = m;
      }
      return top;
    }
    get size() { return this.k.length; }
  }
  G.Heap = Heap;

  const Map = {
    W: null, // 現在の世界(地形・領域)。セーブには入れず、シードと都市から作り直す

    build(seed) {
      const w = G.Terrain.generate(seed);
      const N = w.w * w.h;
      // 陸のまとまり(いちばん大きい陸=大陸)
      const comp = new Int32Array(N).fill(-1);
      let best = -1, bestSize = 0, cid = 0;
      for (let i = 0; i < N; i++) {
        if (comp[i] >= 0 || G.TERRAIN[w.t[i]].water) continue;
        const st = [i]; comp[i] = cid; let size = 0;
        while (st.length) {
          const c = st.pop(); size++;
          const x = c % w.w;
          for (const j of [c - 1, c + 1, c - w.w, c + w.w]) {
            if (j < 0 || j >= N || Math.abs((j % w.w) - x) > 1) continue;
            if (comp[j] < 0 && !G.TERRAIN[w.t[j]].water) { comp[j] = cid; st.push(j); }
          }
        }
        if (size > bestSize) { bestSize = size; best = cid; }
        cid++;
      }
      w.comp = comp; w.mainComp = best;
      w.region = new Int16Array(N).fill(-1);
      Map.W = w;
      return w;
    },

    idx(x, y) { return y * Map.W.w + x; },
    inside(x, y) { return x >= 0 && y >= 0 && x < Map.W.w && y < Map.W.h; },
    terrainAt(x, y) { return G.TERRAIN[Map.W.t[Map.idx(x | 0, y | 0)]]; },
    isLand(i) { return !G.TERRAIN[Map.W.t[i]].water; },
    moveCost(i) { return G.TERRAIN[Map.W.t[i]].move; },

    // 都市をおく場所を選ぶ(陸の上・離れている・住みやすい)
    placeSites(rng, count, races, existing) {
      const w = Map.W, sites = (existing || []).slice(), first = sites.length;
      const cand = [];
      for (let y = 3; y < w.h - 3; y++) for (let x = 3; x < w.w - 3; x++) {
        const i = y * w.w + x;
        if (w.comp[i] !== w.mainComp || G.TERRAIN[w.t[i]].water) continue;
        if (w.t[i] === G.T.SNOW && rng.next() < 0.7) continue;
        cand.push(i);
      }
      const suit = (i, race) => {
        const x = i % w.w, y = (i / w.w) | 0; let s = 0;
        const like = race ? G.RACES[race].like : {};
        for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) {
          if (!Map.inside(x + xx, y + yy)) continue;
          const ter = G.TERRAIN[w.t[(y + yy) * w.w + x + xx]];
          if (ter.water) { s += 0.25; continue; }
          s += ter.food * 0.6 + ter.wood * 0.15 + ter.ore * 0.2 + (like[ter.key] ? (like[ter.key] - 1) * 1.2 : 0);
        }
        return s;
      };
      // 首都: 種族の好みと、ほかの首都からの距離で決める
      for (let k = 0; k < count; k++) {
        const race = races ? races[k] : null;
        let bestI = -1, bestS = -Infinity;
        for (let n = 0; n < 500; n++) {
          const i = rng.pick(cand);
          const x = i % w.w, y = (i / w.w) | 0;
          let md = 999;
          for (const s of sites) md = Math.min(md, Math.hypot(s.x - x, s.y - y));
          const minGap = races ? 20 : 11;
          if (md < minGap) continue;
          const sc = suit(i, race) + Math.min(md, 40) * (races ? 0.9 : 0.35) + rng.next() * 3;
          if (sc > bestS) { bestS = sc; bestI = i; }
        }
        if (bestI < 0) { // 条件がきつすぎたら緩める
          bestI = rng.pick(cand);
        }
        sites.push({ x: bestI % w.w, y: (bestI / w.w) | 0 });
      }
      return sites.slice(first);
    },

    // 各マスを、いちばん近い(移動しやすい)都市の領域にする
    computeRegions(cities) {
      const w = Map.W, N = w.w * w.h;
      const dist = new Float32Array(N).fill(Infinity);
      const reg = w.region; reg.fill(-1);
      const heap = new Heap();
      for (const c of cities) { const i = c.y * w.w + c.x; dist[i] = 0; reg[i] = c.id; heap.push(0, i); }
      while (heap.size) {
        const i = heap.pop();
        const x = i % w.w, d = dist[i];
        for (const j of [i - 1, i + 1, i - w.w, i + w.w]) {
          if (j < 0 || j >= N || Math.abs((j % w.w) - x) > 1) continue;
          if (G.TERRAIN[w.t[j]].water) continue;
          const nd = d + G.TERRAIN[w.t[j]].move;
          if (nd < dist[j] && nd < 26) { dist[j] = nd; reg[j] = reg[i]; heap.push(nd, j); }
        }
      }
      // 都市ごとのデータ
      const info = cities.map(() => ({ tiles: 0, food: 0, wood: 0, ore: 0, coastal: false, river: false, counts: {} }));
      for (let i = 0; i < N; i++) {
        const r = reg[i]; if (r < 0) continue;
        const ter = G.TERRAIN[w.t[i]], inf = info[r];
        inf.tiles++; inf.food += ter.food; inf.wood += ter.wood; inf.ore += ter.ore;
        inf.counts[ter.key] = (inf.counts[ter.key] || 0) + 1;
        if (w.river[i]) inf.river = true;
        const x = i % w.w;
        for (const j of [i - 1, i + 1, i - w.w, i + w.w]) {
          if (j >= 0 && j < N && Math.abs((j % w.w) - x) <= 1 && (w.t[j] === G.T.SEA || w.t[j] === G.T.SHALLOW)) inf.coastal = true;
        }
      }
      // となり合う都市
      const adj = cities.map(() => new Set());
      for (let i = 0; i < N; i++) {
        const r = reg[i]; if (r < 0) continue;
        const x = i % w.w;
        if (x + 1 < w.w) { const r2 = reg[i + 1]; if (r2 >= 0 && r2 !== r) { adj[r].add(r2); adj[r2].add(r); } }
        if (i + w.w < N) { const r2 = reg[i + w.w]; if (r2 >= 0 && r2 !== r) { adj[r].add(r2); adj[r2].add(r); } }
      }
      w.cityInfo = info;
      w.cityAdj = adj.map(s => Array.from(s));
      return info;
    },

    // A*で道をさがす(陸の上だけ)。[[x,y],...] を返す
    findPath(sx, sy, tx, ty, maxNodes) {
      const w = Map.W, N = w.w * w.h;
      sx |= 0; sy |= 0; tx |= 0; ty |= 0;
      const s = sy * w.w + sx, g = ty * w.w + tx;
      if (!Map.isLand(g) || !Map.isLand(s)) return null;
      if (w.comp[s] !== w.comp[g]) return null;
      const cost = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1);
      const heap = new Heap(); cost[s] = 0; heap.push(0, s);
      let n = 0; const lim = maxNodes || 40000;
      while (heap.size) {
        const i = heap.pop();
        if (i === g) break;
        if (++n > lim) return null;
        const x = i % w.w;
        for (const j of [i - 1, i + 1, i - w.w, i + w.w]) {
          if (j < 0 || j >= N || Math.abs((j % w.w) - x) > 1) continue;
          const mc = G.TERRAIN[w.t[j]].move; if (mc === Infinity) continue;
          const nc = cost[i] + mc;
          if (nc < cost[j]) {
            cost[j] = nc; from[j] = i;
            const jx = j % w.w, jy = (j / w.w) | 0;
            heap.push(nc + (Math.abs(jx - tx) + Math.abs(jy - ty)) * 1.0, j);
          }
        }
      }
      if (from[g] < 0 && s !== g) return null;
      const path = []; let c = g;
      while (c !== s && c >= 0) { path.push([c % w.w, (c / w.w) | 0]); c = from[c]; }
      path.reverse();
      return path;
    }
  };
  G.Map = Map;
})(globalThis.GD = globalThis.GD || {});
