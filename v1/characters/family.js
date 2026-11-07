// 家族: 結婚・子供・王位継承
(function (G) {
  const W = G.World, C = G.Chars, P = G.Personality;

  function kin(a, b) {
    if (a.id === b.id) return true;
    if (a.father != null && (a.father === b.father || a.father === b.id)) return true;
    if (a.mother != null && (a.mother === b.mother || a.mother === b.id)) return true;
    if (b.father === a.id || b.mother === a.id) return true;
    return false;
  }

  const F = {
    marry(a, b, political) {
      a.spouse = b.id; b.spouse = a.id;
      C.relAdd(a, b, 'a', 40, '配偶者'); C.relAdd(b, a, 'a', 40, '配偶者');
      a.rel[b.id].fixed = true; b.rel[a.id].fixed = true;
      if (a.royal || b.royal) {
        if (!a.royal) { a.royal = true; } if (!b.royal) { b.royal = true; }
      }
      if (political) {
        const r = W.rel(a.nation, b.nation);
        if (r) { r.v = Math.min(100, r.v + 25); r.marriage = true; }
        W.log('politics', '政略結婚', `${W.nationName(a.nation)}の${a.name}と${W.nationName(b.nation)}の${b.name}が結婚した。両国の関係が深まった。`, { n: [a.nation, b.nation], c: [a.id, b.id], imp: 2 });
      } else if (a.royal || b.royal || a.fame > 20 || b.fame > 20) {
        W.log('person', '結婚', `${a.name}と${b.name}が結婚した。`, { n: [a.nation], c: [a.id, b.id], imp: 1 });
      }
    },

    tryMarriage(c) {
      const rng = W.rng;
      if (c.spouse != null || !C.isAdult(c)) return;
      if (C.age(c) > G.RACES[c.race].fertile[1] + 10) return;
      if (!rng.chance(0.3)) return;
      const pool = Object.values(W.S.chars).filter(o => o.alive && o.spouse == null && o.id !== c.id && C.isAdult(o) && !kin(c, o));
      const sameSexOk = rng.chance(0.07);
      let cands = pool.filter(o => o.nation === c.nation && (sameSexOk || o.sex !== c.sex));
      // 王族は友好国と政略結婚することもある
      if (c.royal && rng.chance(0.15)) {
        const ally = pool.filter(o => o.royal && o.nation != null && o.nation !== c.nation && o.sex !== c.sex && W.rel(c.nation, o.nation) && W.rel(c.nation, o.nation).v > 25 && !W.atWar(c.nation, o.nation));
        if (ally.length) { F.marry(c, rng.pick(ally), true); return; }
      }
      if (!cands.length) {
        // 相手がいなければ、国の中の人と結婚する(新しい人物として登場)
        if (c.nation == null || !rng.chance(c.royal ? 0.6 : 0.15)) return;
        if (Object.keys(W.S.chars).length >= G.CFG.MAX_ALIVE_CHARS * (c.royal ? 1 : 0.8)) return;
        const sex = sameSexOk ? c.sex : (c.sex === 'm' ? 'f' : 'm');
        const R = G.RACES[c.race];
        const p = C.create({ race: c.race, sex, nation: c.nation, role: 'noble', born: c.born + rng.int(-60, 60), family: G.Names.family(rng, c.race), useFamily: true });
        if (C.age(p) < R.adult) p.born = W.month() - R.adult * 12 - 12;
        F.marry(c, p, false);
        return;
      }
      // 好意が高い相手ほど選ばれやすい
      const o = rng.weighted(cands.map(o => ({ w: 1 + Math.max(0, (c.rel[o.id] ? c.rel[o.id].a : 0)) / 10 + (o.race === c.race ? 2 : 0), v: o })));
      if (o) F.marry(c, o, false);
    },

    tryBirth(c) {
      const rng = W.rng;
      if (c.spouse == null || c.sex !== 'f') return;
      const sp = W.liveChar(c.spouse); if (!sp || sp.sex === 'f') return;
      const R = G.RACES[c.race], a = C.age(c);
      if (a < R.fertile[0] || a > R.fertile[1]) return;
      if (c.children.length >= 6) return;
      const total = Object.keys(W.S.chars).length;
      const royalNeed = (c.royal || sp.royal) && c.children.filter(id => W.liveChar(id)).length < 2;
      if (total >= G.CFG.MAX_ALIVE_CHARS * 0.8 && !royalNeed) return;
      if (total >= G.CFG.MAX_ALIVE_CHARS * 1.15) return;
      const p = 0.32 * Math.sqrt(R.growth) * (c.children.length < 2 ? 1.2 : 0.6);
      if (!rng.chance(p)) return;
      const race = c.race === sp.race ? c.race : rng.pick([c.race, sp.race]);
      const nation = sp.royal && sp.nation != null ? sp.nation : c.nation;
      const kid = C.create({ race, nation, role: (c.royal || sp.royal) ? 'heir' : 'noble', father: sp.id, mother: c.id, born: W.month(), royal: c.royal || sp.royal, useFamily: true, family: sp.family || c.family });
      kid.name = kid.family ? `${kid.given}・${kid.family}` : kid.given;
      const n = W.nation(nation);
      if (n && (n.ruler === sp.id || n.ruler === c.id)) {
        W.log('person', kid.sex === 'm' ? '王子の誕生' : '王女の誕生', `${n.name}の${W.charName(n.ruler)}に子供${kid.given}が生まれた。`, { n: [nation], c: [kid.id], imp: 1, memory: false });
      }
    },

    // 跡継ぎの候補(上から順に優先)
    heirCandidates(n) {
      const ruler = W.char(n.ruler);
      const list = [];
      const add = id => { const c = W.liveChar(id); if (c && c.nation === n.id && !list.includes(c)) list.push(c); };
      if (ruler) {
        const kids = ruler.children.map(id => W.liveChar(id)).filter(Boolean).sort((a, b) => a.born - b.born);
        const adults = kids.filter(k => C.isAdult(k)), young = kids.filter(k => !C.isAdult(k));
        adults.concat(young).forEach(k => add(k.id));
        if (ruler.spouse != null) add(ruler.spouse);
        // 兄弟
        for (const pid of [ruler.father, ruler.mother]) { const p = W.char(pid); if (p) p.children.forEach(add); }
      }
      return list;
    },
    heirOf(n) { const l = F.heirCandidates(n); return l.length ? l[0].id : null; },

    // 王が亡くなったとき
    succession(n, old, cause) {
      const rng = W.rng;
      if (!n.alive) return;
      const cands = F.heirCandidates(n);
      let heir = cands[0] || null;
      const all = W.charsOf(n.id).filter(c => C.isAdult(c));
      let dynastyChange = false;
      if (!heir) {
        // 跡継ぎがいなければ、一番力のある人物が王になる
        heir = all.slice().sort((a, b) => (b.st.cha + b.st.amb + b.fame) - (a.st.cha + a.st.amb + a.fame))[0] || null;
        dynastyChange = true;
      }
      if (!heir) {
        heir = C.spawnNotable(n.id, 'noble', { family: G.Names.family(rng, n.race) });
        dynastyChange = true;
      }
      // 王位をねらう者(継承争い)
      const rival = all.filter(c => c.id !== heir.id && (c.st.amb > 62 || P.has(c, 'ambitious')) && P.treachery(c) > 0.5 && (c.royal || c.role === 'general'))
        .sort((a, b) => (b.st.amb + b.st.war) - (a.st.amb + a.st.war))[0];
      F.crown(n, heir, dynastyChange ? '新しい王朝' : '継承');
      W.log('politics', `${n.name}の王位継承`, `${old ? old.name : '先王'}が${cause || '亡くなり'}、${heir.name}が新しい${n.race === 'demon' ? '魔王' : '王'}になった。${dynastyChange ? '王家の血は途絶え、新しい王朝が始まった。' : ''}`, { n: [n.id], c: [heir.id], imp: 2, x: W.capitalOf(n.id) && W.capitalOf(n.id).x, y: W.capitalOf(n.id) && W.capitalOf(n.id).y });
      n.stability = Math.max(0, n.stability - (dynastyChange ? 18 : 8));
      if (rival && W.citiesOf(n.id).length >= 3 && rng.chance(0.55 + (n.stability < 40 ? 0.2 : 0))) {
        G.Nations.civilWar(n, rival, '王位継承争い');
      }
    },

    crown(n, c, why) {
      const old = W.char(n.ruler);
      if (old && old.alive && old.id !== c.id) old.role = old.royal ? 'heir' : 'noble';
      n.ruler = c.id; c.role = 'ruler'; c.nation = n.id; c.royal = true;
      if (!c.family) c.family = G.Names.family(W.rng, c.race);
      c.name = `${c.given}・${c.family}`;
      if (n.dynasty !== c.family) { n.dynasty = c.family; }
      n.rulerSince = W.year();
      C.remember(c, `${n.name}の王になった(${why})`);
      c.fame += 20;
      c.st.loy = 100;
    }
  };
  G.Family = F;
})(globalThis.GD = globalThis.GD || {});
