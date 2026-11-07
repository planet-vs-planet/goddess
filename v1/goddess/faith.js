// 信仰: 人族の祈りが女神の力になる。戦争がきびしく、拮抗しているほど祈りは強い
(function (G) {
  const W = G.World;
  const LEVELS = [0, 150, 450, 1000, 2000, 3600, 6000]; // 集めた信仰の合計で女神のレベルが上がる

  const F = {
    LEVELS,
    levelOf(total) { let lv = 1; for (let i = 0; i < LEVELS.length; i++) if (total >= LEVELS[i]) lv = i + 1; return Math.min(lv, LEVELS.length); },
    nextLevelAt(lv) { return LEVELS[lv] != null ? LEVELS[lv] : null; },

    // 1か月の祈りの量と、その内わけ
    income() {
      const S = W.S, Fa = G.Factions;
      let believers = 0;
      for (const c of S.cities) { const n = W.nation(c.owner); if (n && n.side === 'h') believers += c.pop * (c.faith || 0); }
      const b = Fa.balance();
      // 恐れ: 人族が少し押されているときが最大。人族が勝ちすぎると祈りを忘れる
      const fear = 0.35 + 1.5 * Math.exp(-Math.pow((b - 0.44) / 0.16, 2));
      const base = believers / 14000;
      const parts = [];
      const fromBase = base * fear;
      parts.push({ t: b > 0.65 ? '人族は勝利に酔い、祈りを忘れかけている' : b < 0.35 ? '人族は滅びをおそれ、必死に祈っている' : '戦いにおびえる人々の祈り', v: fromBase });
      const pr = S.prayer || 0;
      if (pr > 0) parts.push({ t: '戦場での祈り(戦闘・都市の陥落)', v: Math.min(pr, 20) * 0.45 });
      const thanks = S.thanks || 0;
      if (thanks > 0) parts.push({ t: '奇跡への感謝', v: thanks });
      if (S.peace) parts.push({ t: '和平の期待で祈りが弱まる', v: -fromBase * 0.4 });
      if (S.revolt && S.revolt.active) parts.push({ t: '女神への疑いが広がる', v: -fromBase * 0.5 });
      let total = parts.reduce((s, p) => s + p.v, 0);
      const lvMul = 1 + (S.goddess.level - 1) * 0.08;
      total *= lvMul;
      return { total, parts, believers, fear };
    },

    monthly() {
      const S = W.S, g = S.goddess;
      if (g.slain) { g.power = 0; g.income = 0; return; }
      const inc = F.income();
      g.income = inc.total; g.faithPop = inc.believers; g.incomeParts = inc.parts;
      g.power = G.clamp(g.power + inc.total, 0, g.max);
      g.total += Math.max(0, inc.total);
      if (S.report) { S.report.faith += inc.total; S.report.faithFrom = inc.parts; }
      S.prayer = 0;
      S.thanks = (S.thanks || 0) * 0.5;
      if (S.thanks < 0.3) S.thanks = 0;
      const lv = F.levelOf(g.total);
      if (lv > g.level) {
        g.level = lv; g.max = 100 + (lv - 1) * 40;
        W.log('goddess', `女神の力が高まった(Lv${lv})`, `集めた祈りによって、女神の力が強くなった。より大きな介入ができるようになった。`, { imp: 2 });
        if (G.Story && G.Story.onLevel) G.Story.onLevel(lv);
      }
      // 疑念は少しずつ薄れる
      g.awareness = Math.max(0, g.awareness - 0.35);
    },
    yearly() { }
  };
  G.Faith = F;
})(globalThis.GD = globalThis.GD || {});
