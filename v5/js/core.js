// 世界の状態(S)と、どこからでも使う小さな道具
(function (G) {
  // 画像の場所(1つのHTMLにまとめたときは、中に入れたデータを使う)
  G.src = p => (G.ASSET && G.ASSET[p]) || p;
  G.S = null;          // 世界の状態(セーブされる)
  G.rng = null;        // 乱数(状態は S.rngState に保存)
  G.listeners = [];    // 画面への通知
  G.emit = (type, data) => { for (const f of G.listeners) try { f(type, data); } catch (e) { console.error(e); } };

  G.newId = p => p + (G.S.nextId++);
  G.N = id => G.S.nations[id];
  G.C = id => G.S.cities[id];
  G.P = id => G.S.chars[id];
  G.A = id => G.S.armies[id];
  G.B = id => G.S.battles[id];
  G.I = id => G.S.incidents[id];
  G.vals = o => Object.values(o);
  G.nations = () => G.vals(G.S.nations).filter(n => n.alive);
  G.cities = () => G.vals(G.S.cities);
  G.chars = () => G.vals(G.S.chars).filter(c => c.alive);
  G.armies = () => G.vals(G.S.armies);

  // ---- こよみ ----
  G.Y = () => G.CFG.START_YEAR + Math.floor(G.S.day / 360);
  G.M = () => Math.floor((G.S.day % 360) / 30) + 1;
  G.season = () => G.SEASONS[G.M() - 1];
  G.dateStr = d => {
    d = d == null ? G.S.day : d;
    return `女神暦${G.CFG.START_YEAR + Math.floor(d / 360)}年${Math.floor((d % 360) / 30) + 1}月`;
  };
  G.yearsAgo = d => Math.floor((G.S.day - d) / 360);
  G.ageOf = p => G.Y() - p.born;

  // ---- 名前の表示 ----
  G.pname = p => p ? (p.title ? `${p.title}${p.name}` : p.name) : '???';
  G.nname = n => n ? n.name : '???';
  G.raceName = r => G.RACES[r].name;

  // ---- 国どうしの関係 ----
  G.relKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
  G.rel = (a, b) => {
    const k = G.relKey(a, b);
    let r = G.S.rel[k];
    if (!r) r = G.S.rel[k] = { opinion: 0, tension: 0, state: 'peace', since: G.S.day, truce: 0, border: false };
    return r;
  };
  G.atWar = (a, b) => a !== b && G.rel(a, b).state === 'war';
  G.allied = (a, b) => a !== b && G.rel(a, b).state === 'alliance';
  G.enemiesOf = n => G.nations().filter(m => G.atWar(n.id, m.id));

  // ---- 人物どうしの関係 ----
  G.prel = (a, b) => (a.rel[b.id] || null);
  G.setRel = (a, b, kind, v, both) => {
    a.rel[b.id] = { k: kind, v: G.clamp(v, -100, 100), d: G.S.day };
    if (both) b.rel[a.id] = { k: both === true ? kind : both, v: G.clamp(v, -100, 100), d: G.S.day };
  };
  G.addRel = (a, b, kind, dv) => {
    const r = a.rel[b.id];
    if (!r) { G.setRel(a, b, kind, dv); return; }
    r.v = G.clamp(r.v + dv, -100, 100);
    if (kind && (Math.abs(dv) > 15 || !['parent', 'child', 'sibling', 'spouse'].includes(r.k))) {
      if (!['parent', 'child', 'sibling', 'spouse'].includes(r.k)) r.k = kind;
    }
  };
  G.remember = (p, text, kind, extra) => {
    if (!p || !p.alive) return;
    p.mem.push(Object.assign({ d: G.S.day, t: text, k: kind || 'event' }, extra || {}));
    if (p.mem.length > 24) p.mem.splice(0, p.mem.length - 24);
  };
  // 一時的な気持ち(女神の介入など)。k: 種類 / t: 相手 / v: 強さ / until: いつまで
  G.influence = (p, k, t, v, days) => {
    p.inf.push({ k, t: t == null ? null : t, v, until: G.S.day + (days || 360) });
  };
  G.infSum = (p, k, t) => {
    let s = 0;
    for (const f of p.inf) if (f.k === k && (t == null || f.t == null || f.t === t)) s += f.v * Math.min(1, (f.until - G.S.day) / 120 + 0.25);
    return s;
  };
  G.hasTrait = (p, t) => p.traits.includes(t);

  // ---- ニュース(画面下に流れる) ----
  // kind: war / person / politics / goddess / faith / disaster
  G.news = (text, opt) => {
    opt = opt || {};
    const e = { d: G.S.day, t: text, k: opt.k || 'politics', at: opt.at || null, inc: opt.inc || null, imp: opt.imp || 1 };
    G.S.log.push(e);
    if (G.S.log.length > G.CFG.LOG_MAX) G.S.log.splice(0, G.S.log.length - G.CFG.LOG_MAX);
    G.emit('news', e);
    return e;
  };
  // 一時的な絵の効果(光の柱・炎・煙など)。画面が描く
  G.fx = (type, x, y, opt) => {
    G.S.fx.push(Object.assign({ type, x, y, d: G.S.day, until: G.S.day + ((opt && opt.days) || 20) }, opt || {}));
  };
  // 大事件: カメラを向ける
  G.focus = (x, y, title, opt) => G.emit('focus', Object.assign({ x, y, title }, opt || {}));

  G.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  G.sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  G.pickW = (items) => G.rng.weighted(items.map(([v, w]) => ({ v, w })));
  G.cd = (key, days) => { // くり返し防止(クールダウン)。使えるなら true を返して開始
    const u = G.S.cd[key];
    if (u && u > G.S.day) return false;
    G.S.cd[key] = G.S.day + days;
    return true;
  };
  G.cdOk = key => !(G.S.cd[key] > G.S.day);
})(globalThis.GD = globalThis.GD || {});
