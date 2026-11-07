// 性格: 行動の「なりやすさ」を決める
(function (G) {
  const P = {
    has(c, t) { return !!c && c.traits.includes(t); },
    randomTraits(rng, n, inherit) {
      const out = [];
      if (inherit) for (const t of inherit) if (out.length < n && rng.chance(0.4) && !out.includes(t)) out.push(t);
      let guard = 0;
      while (out.length < n && guard++ < 50) {
        const t = rng.pick(G.TRAIT_KEYS);
        if (out.includes(t)) continue;
        const opp = G.TRAITS[t].opp;
        if (opp && out.includes(opp)) continue;
        out.push(t);
      }
      return out;
    },
    traitNames(c) { return c.traits.map(t => G.TRAITS[t].name); },

    // 戦争をしたがる度合い(-1〜+1くらい)
    warlike(c) {
      if (!c) return 0;
      let v = (c.st.amb - 50) / 160;
      if (P.has(c, 'brave')) v += 0.12;
      if (P.has(c, 'ambitious')) v += 0.15;
      if (P.has(c, 'cruel')) v += 0.15;
      if (P.has(c, 'greedy')) v += 0.08;
      if (P.has(c, 'coward')) v -= 0.18;
      if (P.has(c, 'gentle')) v -= 0.2;
      if (P.has(c, 'wise')) v -= 0.06;
      return v;
    },
    // 裏切りやすさ(0〜1)
    treachery(c) {
      if (!c) return 0;
      let v = (c.st.amb / 100) * 0.5 + (1 - c.st.loy / 100) * 0.5;
      if (P.has(c, 'cunning')) v += 0.2;
      if (P.has(c, 'greedy')) v += 0.1;
      if (P.has(c, 'ambitious')) v += 0.15;
      if (P.has(c, 'just')) v -= 0.3;
      if (P.has(c, 'gentle')) v -= 0.1;
      return G.clamp(v, 0, 1);
    },
    // 王としての安定感への効果
    rulerStability(c) {
      if (!c) return -15;
      let v = (c.st.cha - 50) * 0.25 + (c.st.int - 50) * 0.1;
      if (P.has(c, 'just')) v += 6;
      if (P.has(c, 'wise')) v += 5;
      if (P.has(c, 'gentle')) v += 4;
      if (P.has(c, 'cruel')) v -= 6;
      if (P.has(c, 'greedy')) v -= 5;
      return v;
    },
    // 役職に向いているか
    bestRole(c) {
      const s = c.st;
      const scores = [
        { v: 'general', w: s.war + (P.has(c, 'brave') ? 15 : 0) },
        { v: 'mage', w: s.int * G.RACES[c.race].magic + (P.has(c, 'curious') ? 10 : 0) - 10 },
        { v: 'priest', w: s.fai + (P.has(c, 'just') ? 8 : 0) - 8 },
        { v: 'merchant', w: (s.int + s.cha) / 2 + (P.has(c, 'greedy') ? 15 : 0) - 10 },
        { v: 'noble', w: s.cha - 5 }
      ];
      scores.sort((a, b) => b.w - a.w);
      return scores[0].v;
    }
  };
  G.Personality = P;
})(globalThis.GD = globalThis.GD || {});
