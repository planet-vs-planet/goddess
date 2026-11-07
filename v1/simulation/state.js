// 世界の状態(セーブされる中身)と、よく使う便利関数
(function (G) {
  const W = {
    S: null,   // 現在の世界の状態
    rng: null, // シミュレーション用の乱数(状態は S.rng に保存)

    month() { return Math.floor(W.S.day / G.CFG.DAYS_PER_MONTH); },
    year() { return W.S.startYear + Math.floor(W.month() / 12); },
    monthOfYear() { return W.month() % 12; }, // 0=1月
    season() { return G.SEASONS[W.monthOfYear()]; },
    dateText(day) {
      const m = Math.floor((day == null ? W.S.day : day) / G.CFG.DAYS_PER_MONTH);
      return `${W.S.startYear + Math.floor(m / 12)}年${(m % 12) + 1}月`;
    },
    newId() { return W.S.nextId++; },

    nation(id) { return id == null ? null : W.S.nations[id] || null; },
    char(id) { return id == null ? null : (W.S.chars[id] || W.S.dead[id] || null); },
    liveChar(id) { const c = W.S.chars[id]; return c && c.alive ? c : null; },
    city(i) { return W.S.cities[i]; },
    aliveNations() { return Object.values(W.S.nations).filter(n => n.alive); },
    citiesOf(nid) { return W.S.cities.filter(c => c.owner === nid); },
    charsOf(nid) { return Object.values(W.S.chars).filter(c => c.alive && c.nation === nid); },
    nationPop(nid) { let p = 0; for (const c of W.S.cities) if (c.owner === nid) p += c.pop; return p; },
    worldPop() { let p = 0; for (const c of W.S.cities) p += c.pop; return p; },
    nationName(id) { const n = W.nation(id); return n ? n.name : (id === -1 ? '魔物' : '?'); },
    charName(id) { const c = W.char(id); return c ? c.name : '?'; },

    // 2国の関係(なければ作る)
    rel(a, b) {
      if (a === b) return null;
      const k = a < b ? a + '|' + b : b + '|' + a;
      let r = W.S.relations[k];
      if (!r) r = W.S.relations[k] = { v: 0, alliance: false, nap: false, trade: false, truce: 0, marriage: false };
      return r;
    },
    atWar(a, b) {
      if (a === -1 || b === -1) return a !== b; // 魔物はすべての国の敵
      for (const id in W.S.wars) {
        const w = W.S.wars[id];
        if (w.ended) continue;
        if ((w.att.includes(a) && w.def.includes(b)) || (w.att.includes(b) && w.def.includes(a))) return true;
      }
      return false;
    },
    warsOf(nid) { return Object.values(W.S.wars).filter(w => !w.ended && (w.att.includes(nid) || w.def.includes(nid))); },
    enemiesOf(nid) {
      const out = new Set();
      for (const w of W.warsOf(nid)) {
        const mine = w.att.includes(nid) ? w.def : w.att;
        for (const e of mine) out.add(e);
      }
      return Array.from(out);
    },
    // となりの国
    neighbors(nid) {
      const out = new Set();
      const adj = G.Map.W.cityAdj;
      for (const c of W.S.cities) {
        if (c.owner !== nid) continue;
        for (const j of adj[c.id]) { const o = W.S.cities[j].owner; if (o != null && o !== nid) out.add(o); }
      }
      return Array.from(out);
    },
    capitalOf(nid) { const n = W.nation(nid); return n && n.capital != null ? W.S.cities[n.capital] : null; },
    distCities(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); },

    // ---- 記録 ----
    // imp: 0=小 1=普通 2=重要(年表にも残る) 3=歴史的
    log(type, title, text, opt) {
      opt = opt || {};
      const e = { d: W.S.day, type, title, text, x: opt.x, y: opt.y, n: opt.n || [], c: opt.c || [], imp: opt.imp || 1 };
      W.S.log.push(e);
      if (W.S.log.length > G.CFG.LOG_MAX) W.S.log.splice(0, W.S.log.length - G.CFG.LOG_MAX);
      if (e.imp >= 2) {
        W.S.history.push({ y: W.year(), m: W.monthOfYear() + 1, type, title, text, imp: e.imp, x: e.x, y2: e.y });
        if (W.S.history.length > G.CFG.HISTORY_MAX) W.S.history.splice(0, W.S.history.length - G.CFG.HISTORY_MAX);
      }
      for (const cid of e.c) { const ch = W.S.chars[cid]; if (ch && opt.memory !== false && e.imp >= 1) G.Chars.remember(ch, title); }
      if (G.Events && G.Events.onLog) G.Events.onLog(e);
      return e;
    },
    effect(kind, x, y, extra) { // 画面の演出(セーブしない)
      W.fx.push(Object.assign({ kind, x, y, t: 0 }, extra || {}));
      if (W.fx.length > 80) W.fx.shift();
    },
    fx: [],
    dirtyTerritory: true // 領土の色を描き直す合図
  };
  G.World = W;
})(globalThis.GD = globalThis.GD || {});
