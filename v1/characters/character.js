// 人物: 誕生・成長・死亡・関係・記憶
(function (G) {
  const W = G.World, P = G.Personality;
  const STATS = ['war', 'int', 'cha', 'amb', 'loy', 'fai'];
  G.STAT_NAMES = { war: '武力', int: '知力', cha: '魅力', amb: '野心', loy: '忠誠', fai: '信仰' };

  const C = {
    create(o) {
      const rng = W.rng, S = W.S;
      const race = o.race;
      const R = G.RACES[race];
      const sex = o.sex || (rng.chance(0.5) ? 'm' : 'f');
      const id = W.newId();
      const st = {};
      const fa = o.father != null ? W.char(o.father) : null, mo = o.mother != null ? W.char(o.mother) : null;
      for (const k of STATS) {
        let v;
        if (fa && mo) v = (fa.st[k] + mo.st[k]) / 2 + rng.gauss(0, 13); // 親から受けつぐ
        else v = rng.gauss(48, 15);
        st[k] = Math.round(G.clamp(v, 3, 100));
      }
      if (rng.chance(0.06)) { const k = rng.pick(['war', 'int', 'cha']); st[k] = Math.min(100, st[k] + 25); } // 天才
      const bias = { general: { war: 18 }, hero: { war: 28, cha: 12, loy: 10 }, mage: { int: 20 }, priest: { fai: 25 }, merchant: { int: 10, cha: 12 }, ruler: { cha: 8 } }[o.role] || {};
      for (const k in bias) st[k] = Math.min(100, st[k] + bias[k]);
      if (race === 'dragon') st.war = Math.min(100, st.war + 20);
      const inh = [].concat(fa ? fa.traits : [], mo ? mo.traits : []);
      const c = {
        id, race, sex,
        given: o.given || G.Names.person(rng, race, sex),
        family: o.family || (fa ? fa.family : (mo ? mo.family : null)),
        nation: o.nation != null ? o.nation : null,
        role: o.role || 'noble',
        born: o.born != null ? o.born : W.month(),
        life: Math.round(rng.range(R.life[0], R.life[1])),
        st, traits: o.traits || P.randomTraits(rng, rng.chance(0.5) ? 3 : 2, inh),
        father: fa ? fa.id : null, mother: mo ? mo.id : null,
        spouse: null, children: [], rel: {}, raceAtt: {}, mem: [],
        alive: true, death: null, blessed: false, item: null,
        look: { skin: rng.int(0, 3), hair: rng.int(0, 7), eye: rng.int(0, 4), style: rng.int(0, 3), acc: rng.int(0, 3) },
        royal: !!o.royal, fame: 0, kills: 0
      };
      c.name = c.family && (c.royal || o.useFamily) ? `${c.given}・${c.family}` : c.given;
      S.chars[id] = c;
      if (fa) fa.children.push(id);
      if (mo) mo.children.push(id);
      // 親が持っていた種族への感情を少し受けつぐ
      for (const p of [fa, mo]) if (p) for (const r in p.raceAtt) c.raceAtt[r] = (c.raceAtt[r] || 0) + p.raceAtt[r] * 0.5;
      return c;
    },

    age(c) { return Math.floor(((c.death ? c.death.m : W.month()) - c.born) / 12); },
    isAdult(c) { return C.age(c) >= G.RACES[c.race].adult; },
    remember(c, text) {
      c.mem.push({ y: W.year(), t: text });
      if (c.mem.length > 12) c.mem.shift();
    },
    relGet(a, bId) {
      let r = a.rel[bId];
      if (!r) {
        const keys = Object.keys(a.rel);
        if (keys.length >= 10) { // 関係が多すぎたら一番弱いものを忘れる
          let weak = null, wv = Infinity;
          for (const k of keys) { const x = a.rel[k]; const v = Math.abs(x.t) + Math.abs(x.a) + x.f + x.j + x.h; if (v < wv && !x.fixed) { wv = v; weak = k; } }
          if (weak) delete a.rel[weak];
        }
        r = a.rel[bId] = { t: 0, a: 0, f: 0, j: 0, h: 0, kind: '' };
      }
      return r;
    },
    relAdd(a, b, field, delta, kind) {
      if (!a || !b || a.id === b.id) return;
      const r = C.relGet(a, b.id);
      r[field] = G.clamp(r[field] + delta, -100, 100);
      if (kind) r.kind = kind;
    },
    relKind(a, bId) {
      const r = a.rel[bId]; if (!r) return '';
      if (r.kind) return r.kind;
      if (r.h > 50) return '仇敵';
      if (r.h > 25 || r.t < -30) return '敵対';
      if (r.a > 40) return '友人';
      return '';
    },
    raceAtt(c, race, d) { c.raceAtt[race] = G.clamp((c.raceAtt[race] || 0) + d, -100, 100); },

    kill(c, cause, killer) {
      if (!c || !c.alive) return;
      const S = W.S;
      c.alive = false;
      c.death = { m: W.month(), cause };
      const wasRuler = c.role === 'ruler';
      if (c.spouse != null) { const sp = W.liveChar(c.spouse); if (sp) { sp.spouse = null; C.remember(sp, `配偶者${c.given}を失う`); } }
      // 家族の悲しみ・憎しみ
      if (killer) {
        const kc = W.char(killer.charId);
        for (const kid of c.children.concat(c.father, c.mother)) {
          const k = W.liveChar(kid); if (!k) continue;
          if (kc) { C.relAdd(k, kc, 'h', 60, '仇敵'); }
          if (killer.race && killer.race !== k.race) {
            C.raceAtt(k, killer.race, -35);
            C.remember(k, `家族の${c.given}を${G.RACES[killer.race].name}に殺された`);
          }
        }
      }
      S.dead[c.id] = c;
      delete S.chars[c.id];
      c.rel = {}; // 死んだ人の関係は消す(軽くするため)
      // 軍を率いていたら指揮官を外す
      for (const id in S.armies) if (S.armies[id].cmd === c.id) S.armies[id].cmd = null;
      const n = W.nation(c.nation);
      if (n && n.alive && n.ruler === c.id && wasRuler) G.Family.succession(n, c, cause);
      C.pruneDead();
    },
    pruneDead() {
      const S = W.S, ids = Object.keys(S.dead);
      if (ids.length < 1600) return;
      ids.sort((a, b) => S.dead[a].death.m - S.dead[b].death.m);
      for (const id of ids.slice(0, 300)) if (!S.dead[id].royal && !S.dead[id].fame) delete S.dead[id];
    },

    // 1年に1回(人物ごとの誕生月に)
    yearly(c) {
      const rng = W.rng, R = G.RACES[c.race];
      const a = C.age(c);
      const L = c.life;
      let p = 0.003;
      if (a > L) p = 0.55;
      else if (a > L * 0.85) p = 0.08 + (a - L * 0.85) / (L * 0.15) * 0.25;
      else if (a < R.adult / 3) p = 0.01;
      if (rng.chance(p)) {
        C.kill(c, a > L * 0.85 ? '老衰' : rng.pick(['病気', '病気', '事故', '流行り病']));
        return;
      }
      // 大人になったら役職を決める
      if (c.role === 'heir' && a >= R.adult) {
        const n = W.nation(c.nation);
        const isMainHeir = n && G.Family.heirOf(n) === c.id;
        if (!isMainHeir && rng.chance(0.6)) c.role = P.bestRole(c);
      }
      // 能力の変化(若いうちは伸び、年をとると落ちる)
      if (a < R.adult * 2) { c.st.war = Math.min(100, c.st.war + rng.int(0, 2)); c.st.int = Math.min(100, c.st.int + rng.int(0, 2)); }
      if (a > L * 0.75) c.st.war = Math.max(1, c.st.war - rng.int(0, 3));
      // 野心家は王に不満を持ちやすい
      const n = W.nation(c.nation);
      if (n && n.alive && c.id !== n.ruler) {
        const ruler = W.liveChar(n.ruler);
        if (ruler) {
          let d = rng.gauss(0, 4) + (ruler.st.cha - 50) * 0.06;
          if (P.has(c, 'ambitious')) d -= 3;
          if (P.has(ruler, 'cruel') && !P.has(c, 'cruel')) d -= 3;
          if (P.has(ruler, 'just')) d += 2;
          if (n.stability < 30) d -= 3;
          c.st.loy = Math.round(G.clamp(c.st.loy + d, 0, 100));
          C.relAdd(c, ruler, 't', d * 1.5);
        }
      }
      // 同じ国の人とのつながり(友情・嫉妬)
      if (n) {
        const others = W.charsOf(c.nation).filter(o => o.id !== c.id && C.isAdult(o));
        if (others.length && rng.chance(0.5)) {
          const o = rng.pick(others);
          if (P.has(c, 'ambitious') && o.fame > c.fame + 10) C.relAdd(c, o, 'j', 15);
          else if (P.has(c, 'gentle') || P.has(o, 'gentle')) { C.relAdd(c, o, 'a', 12); C.relAdd(o, c, 'a', 8); }
          else if (P.has(c, 'cruel') && rng.chance(0.4)) { C.relAdd(c, o, 'h', 10); C.relAdd(o, c, 'f', 10); }
          else { C.relAdd(c, o, 'a', rng.int(-6, 10)); }
        }
      }
      // 種族への憎しみは少しずつ薄れる
      for (const r in c.raceAtt) c.raceAtt[r] *= 0.97;
    },

    // 国から重要人物を新しく出す(平民の出世)
    spawnNotable(nid, role, opt) {
      const n = W.nation(nid); if (!n) return null;
      const rng = W.rng;
      const cities = W.citiesOf(nid);
      const city = cities.length ? rng.pick(cities) : null;
      let race = n.race;
      if (city && rng.chance(0.25)) { // 都市に住むほかの種族から出ることもある
        const rs = Object.keys(city.races);
        race = rng.weighted(rs.map(r => ({ w: city.races[r], v: r }))) || n.race;
      }
      const R = G.RACES[race];
      const ageY = rng.int(R.adult, Math.floor(R.adult + (R.life[0] - R.adult) * 0.5));
      const c = C.create({ race, nation: nid, role, born: W.month() - ageY * 12 - rng.int(0, 11), family: opt && opt.family });
      if (city) c.home = city.id;
      return c;
    }
  };
  G.Chars = C;
})(globalThis.GD = globalThis.GD || {});
