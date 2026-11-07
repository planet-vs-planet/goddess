// 経済: 食料・木材・鉱石・金・技術・安定度・都市の不満
(function (G) {
  const W = G.World, P = G.Personality;

  const E = {
    monthly() {
      const S = W.S;
      for (const n of W.aliveNations()) {
        const cities = W.citiesOf(n.id);
        const ruler = W.liveChar(n.ruler);
        const R = G.RACES[n.race];
        let food = 0, wood = 0, ore = 0, gold = 0, tech = 0, pop = 0, eat = 0, mp = 0, faith = 0, unrestSum = 0;
        const trades = Object.keys(S.relations).filter(k => { const r = S.relations[k]; return r.trade && (k.split('|')[0] == n.id || k.split('|')[1] == n.id); }).length;
        for (const c of cities) {
          const info = G.Map.W.cityInfo[c.id], b = c.buildings;
          const eff = c.mods.drought > S.day ? 0.55 : 1;
          const work = Math.min(c.pop, c.cap || c.pop);
          food += work * 0.112 * eff * (c.mods.harvest > S.day ? 1.3 : 1);
          eat += c.pop * 0.1;
          wood += info.wood * c.pop / 7000;
          ore += info.ore * c.pop / 7000 * (n.race === 'dwarf' ? 1.6 : 1) * (1 + 0.25 * (b.smithy || 0));
          gold += c.pop * 0.011 * (1 + 0.22 * (b.market || 0)) * (0.55 + n.stability / 200) * (info.coastal ? 1.12 : 1) * (1 + trades * 0.08) + (b.port ? 8 : 0);
          tech += c.pop / 2600 * R.tech * (1 + 0.35 * (b.school || 0));
          mp += c.pop * 0.055 * (1 + 0.15 * (b.barracks || 0));
          faith += c.pop * (c.faith || 0);
          pop += c.pop;
        }
        if (ruler && P.has(ruler, 'greedy')) gold *= 1.08;
        if (ruler) tech *= 0.7 + ruler.st.int / 160;
        // 軍の維持費
        let upkeep = 0;
        for (const c of cities) for (const k in c.buildings) upkeep += c.buildings[k] * 0.35;
        upkeep += W.charsOf(n.id).length * 1.5;
        for (const id in S.armies) { const a = S.armies[id]; if (a.nation === n.id) upkeep += a.total * 0.018; }
        n.res.food += food - eat;
        n.res.wood += wood; n.res.ore += ore;
        n.res.gold += gold - upkeep;
        n.income = gold - upkeep; n.economy = gold;
        n.techPts += tech;
        const need = 220 * Math.pow(n.tech + 1, 1.55);
        if (n.techPts > need) {
          n.techPts -= need; n.tech = Math.round((n.tech + 1) * 10) / 10;
          if (Math.floor(n.tech) % 2 === 0) W.log('discovery', '技術の進歩', `${n.name}の技術が発展した(技術Lv${Math.floor(n.tech)})。`, { n: [n.id], imp: 1 });
        }
        // 食料不足 → ききん
        const famine = n.res.food < 0;
        if (famine) n.res.food = 0;
        for (const c of cities) c.famine = famine;
        n.res.food = Math.min(n.res.food, pop * 0.6 + 500);
        n.res.wood = Math.min(n.res.wood, 6000); n.res.ore = Math.min(n.res.ore, 6000);
        n.res.gold = Math.min(n.res.gold, 600 + pop * 0.5);
        if (n.res.gold < -300) { n.stability -= 2; n.res.gold = -300; }
        // 兵力
        mp *= n.mpMul || 1;
        n.manpower += (mp - n.manpower) * 0.06;
        n.pop = pop;
        n.faith = pop ? (faith / pop) : 0;
        // 安定度
        let target = 58 + P.rulerStability(ruler) - n.weariness * 0.35 + (famine ? -25 : 0) + (W.S.religions[n.religion] && W.S.religions[n.religion].goddess ? n.faith * 0.05 : 0);
        if (n.mods.oracle > S.day) target += 12;
        target -= Math.max(0, cities.length - 5) * 1.5; // 大きすぎる国はまとまりにくい
        n.stability = G.clamp(n.stability + (target - n.stability) * 0.07 + W.rng.gauss(0, 0.6), 0, 100);
        n.weariness = Math.max(0, n.weariness - (W.warsOf(n.id).length ? 0 : 1.2));
        // 都市の不満
        for (const c of cities) {
          let u = 15 + (100 - n.stability) * 0.35;
          if (c.famine) u += 30;
          const main = G.Population.mainRace(c);
          if (main !== n.race) u += n.goal === 'domination' ? 26 : 12;
          if (c.religion !== n.religion) u += 9;
          if (c.conquered && S.day - c.conquered < 360 * 8) u += 22 * (1 - (S.day - c.conquered) / (360 * 8));
          if (c.mods.plague > S.day) u += 10;
          if (ruler && P.has(ruler, 'cruel')) u += 6;
          if (ruler && P.has(ruler, 'just')) u -= 5;
          if (c.id === n.capital) u -= 12;
          u -= (c.buildings.temple || 0) * 4;
          c.unrest = G.clamp(c.unrest + (u - c.unrest) * 0.05 + W.rng.gauss(0, 1.2), 0, 100);
          unrestSum += c.unrest;
          c.sat = Math.round(100 - c.unrest);
          // 国の宗教が広まる
          if (c.religion !== n.religion && W.rng.chance(0.004 * (1 + (c.buildings.temple || 0)) * (n.goal === 'religion' ? 3 : 1))) {
            c.religion = n.religion;
          }
          const rel = W.S.religions[c.religion];
          const ft = rel && rel.goddess ? 0.72 : (rel && rel.anti ? 0.02 : 0.15);
          c.faith = G.lerp(c.faith || 0, ft + (c.mods.blessed > S.day ? 0.15 : 0), 0.03);
        }
        n.satisfaction = cities.length ? Math.round(100 - unrestSum / cities.length) : 0;
        n.military = Math.round(G.Nations.power(n.id));
      }
      // 国に属さない都市(ないはずだが念のため)
      for (const c of S.cities) if (c.owner == null) { c.unrest = 30; c.sat = 70; }
    }
  };
  G.Economy = E;
})(globalThis.GD = globalThis.GD || {});
