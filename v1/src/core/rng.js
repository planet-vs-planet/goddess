// 乱数(シードつき)。同じシードなら同じ世界になる。状態はセーブに保存できる。
(function (G) {
  function hashString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    const out = [];
    for (let k = 0; k < 4; k++) {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      out.push((h ^= h >>> 16) >>> 0);
    }
    return out;
  }

  class RNG {
    constructor(seedOrState) {
      if (Array.isArray(seedOrState)) { this.s = seedOrState.slice(); return; } // セーブから復元
      this.s = hashString(String(seedOrState));
      for (let i = 0; i < 12; i++) this.next();
    }
    next() { // sfc32
      let [a, b, c, d] = this.s;
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      this.s = [a, b, c, d];
      return (t >>> 0) / 4294967296;
    }
    range(a, b) { return a + (b - a) * this.next(); }
    int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
    chance(p) { return this.next() < p; }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
    // [{w:重さ, v:値}] から1つ選ぶ
    weighted(items) {
      let total = 0;
      for (const it of items) total += Math.max(0, it.w);
      if (total <= 0) return null;
      let r = this.next() * total;
      for (const it of items) { r -= Math.max(0, it.w); if (r <= 0) return it.v; }
      return items[items.length - 1].v;
    }
    gauss(mean, sd) {
      const u = 1 - this.next(), v = this.next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    getState() { return this.s.slice(); }
  }

  G.RNG = RNG;
  G.hashString = hashString;
  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.fmt = function (n) {
    n = Math.round(n);
    if (Math.abs(n) >= 100000000) return (n / 100000000).toFixed(1) + '億';
    if (Math.abs(n) >= 10000) return (n / 10000).toFixed(1) + '万';
    return n.toLocaleString('ja-JP');
  };
})(globalThis.GD = globalThis.GD || {});
