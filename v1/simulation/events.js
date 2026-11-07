// イベント: 世界の状況によって起こりやすさが変わる事件
(function (G) {
  const W = G.World, C = G.Chars, P = G.Personality;

  const ITEMS = ['聖剣アストレア', '魔槍グングニル', '竜殺しの大剣', '古代王の冠', '星の弓', '黒曜の鎧', '精霊の杖', '雷鳴の戦斧'];

  function weightedCity(fn) {
    return W.rng.weighted(W.S.cities.map(c => ({ w: Math.max(0, fn(c)), v: c })));
  }
  function info(c) { return G.Map.W.cityInfo[c.id]; }
  function share(c, key) { const i = info(c); return (i.counts[key] || 0) / Math.max(1, i.tiles); }
  function owners(cs) { return Array.from(new Set(cs.map(c => c.owner).filter(x => x != null))); }

  const EV = {
    list: [
      {
        key: 'drought', w: () => 0.32 * (W.season() === '夏' ? 1.8 : 0.6), run() {
          const c = weightedCity(c => 0.2 + share(c, 'desert') * 3 + share(c, 'grass'));
          if (!c) return;
          const hit = [c].concat(G.Map.W.cityAdj[c.id].map(j => W.S.cities[j]).filter(() => W.rng.chance(0.5)));
          for (const x of hit) x.mods.drought = W.S.day + 360;
          W.log('disaster', '干ばつ', `${hit.map(x => x.name).join('・')}で雨が降らず、作物が育たない。`, { n: owners(hit), x: c.x, y: c.y, imp: 2 });
          W.effect('drought', c.x, c.y);
        }
      },
      {
        key: 'plague', w: () => 0.25 + Object.values(W.S.wars).filter(w => !w.ended).length * 0.15, run() {
          const c = weightedCity(c => c.pop > 1500 ? c.pop : 0);
          if (!c || c.mods.plague > W.S.day || c.mods.immune > W.S.day) return;
          c.mods.plague = W.S.day + 240; c.mods.immune = W.S.day + 360 * 6;
          W.log('disaster', '疫病の流行', `${c.name}で疫病が流行し始めた。`, { n: owners([c]), x: c.x, y: c.y, imp: 2 });
          W.effect('plague', c.x, c.y);
        }
      },
      {
        key: 'volcano', w: () => 0.07, run() {
          const c = weightedCity(c => share(c, 'mountain') > 0.15 ? share(c, 'mountain') : 0);
          if (!c) return;
          c.pop *= 0.78; for (const k in c.buildings) if (W.rng.chance(0.4)) c.buildings[k] = Math.max(0, c.buildings[k] - 1);
          W.log('disaster', '火山噴火', `${c.name}の近くの山が噴火し、町が灰に埋もれた。`, { n: owners([c]), x: c.x, y: c.y, imp: 2 });
          W.effect('quake', c.x, c.y);
        }
      },
      {
        key: 'quake', w: () => 0.1, run() {
          const c = W.rng.pick(W.S.cities);
          c.pop *= 0.92; const ks = Object.keys(c.buildings).filter(k => c.buildings[k] > 0);
          if (ks.length) c.buildings[W.rng.pick(ks)]--;
          W.log('disaster', '地震', `${c.name}を大きな地震が襲った。`, { n: owners([c]), x: c.x, y: c.y, imp: 1 });
          W.effect('quake', c.x, c.y);
        }
      },
      {
        key: 'flood', w: () => 0.12 * (W.season() === '春' ? 2 : 1), run() {
          const c = weightedCity(c => info(c).river ? 1 : 0);
          if (!c) return;
          c.pop *= 0.95; c.mods.blight = W.S.day + 120;
          W.log('disaster', '洪水', `大雨で川があふれ、${c.name}の畑が水につかった。`, { n: owners([c]), x: c.x, y: c.y, imp: 1 });
          W.effect('flood', c.x, c.y);
        }
      },
      {
        key: 'cold', w: () => W.season() === '冬' ? 0.45 : 0, run() {
          const hit = W.S.cities.filter(c => c.y < G.Map.W.h * 0.38);
          if (!hit.length) return;
          for (const c of hit) { c.pop *= 0.97; c.mods.blight = W.S.day + 150; }
          W.log('disaster', '大寒波', `北の地方を大寒波が襲った(${hit.slice(0, 4).map(c => c.name).join('・')}${hit.length > 4 ? 'など' : ''})。`, { n: owners(hit), x: hit[0].x, y: hit[0].y, imp: 1 });
          W.effect('cold', hit[0].x, hit[0].y);
        }
      },
      {
        key: 'pollution', w: () => W.aliveNations().some(n => n.race === 'demon') ? 0.06 : 0.02, run() {
          const c = W.rng.pick(W.S.cities);
          c.mods.blight = W.S.day + 360; c.unrest = Math.min(100, c.unrest + 15);
          W.log('disaster', '魔力汚染', `${c.name}の土地が濃い魔力にけがされ、作物が枯れ始めた。`, { n: owners([c]), x: c.x, y: c.y, imp: 1 });
          W.effect('plague', c.x, c.y);
        }
      },
      {
        key: 'assassination', w: () => 0.08, run() {
          const rng = W.rng;
          const cands = Object.values(W.S.chars).filter(c => c.alive && c.nation != null && c.role !== 'ruler' && C.isAdult(c) && P.has(c, 'cunning') && P.treachery(c) > 0.55);
          if (!cands.length) return;
          const a = rng.pick(cands); const n = W.nation(a.nation); if (!n) return;
          const ruler = W.liveChar(n.ruler); if (!ruler || ruler.id === a.id) return;
          if (!rng.chance(0.55)) { // 失敗
            W.log('politics', '暗殺未遂', `${n.name}の${ruler.name}を狙った暗殺計画が発覚した。首謀者の${a.name}は国外へ逃げた。`, { n: [n.id], c: [ruler.id, a.id], imp: 2 });
            a.nation = null; a.role = 'exile'; C.relAdd(ruler, a, 'h', 80, '仇敵'); return;
          }
          const cap = W.capitalOf(n.id);
          W.log('politics', `${n.name}の${G.Nations.rulerTitle(n)}暗殺`, `${n.name}の${ruler.name}が暗殺された。${a.st.amb > 65 ? '黒幕は' + a.name + 'だとうわさされている。' : '犯人はわかっていない。'}`, { n: [n.id], c: [ruler.id], x: cap && cap.x, y: cap && cap.y, imp: 3, memory: false });
          C.kill(ruler, '暗殺', { charId: a.id });
          if (a.alive && a.st.amb > 72 && rng.chance(0.4) && n.alive) {
            G.Family.crown(n, a, '王位の簒奪');
            W.log('politics', '王位の簒奪', `${a.name}が混乱に乗じて${n.name}の王位を奪った。`, { n: [n.id], c: [a.id], imp: 3 });
          }
        }
      },
      {
        key: 'coup', w: () => W.aliveNations().filter(n => n.stability < 30).length * 0.12, run() {
          const n = W.rng.pick(W.aliveNations().filter(n => n.stability < 30)); if (!n) return;
          const g = W.charsOf(n.id).filter(c => (c.role === 'general' || c.role === 'hero') && P.treachery(c) > 0.55).sort((a, b) => b.st.war - a.st.war)[0];
          if (!g) return;
          const old = W.liveChar(n.ruler);
          W.log('politics', `${n.name}でクーデター`, `将軍${g.name}が兵をあげて王宮を占拠し、${old ? old.name + 'を追放して' : ''}国の実権をにぎった。`, { n: [n.id], c: [g.id], imp: 3 });
          if (old) { old.role = 'exile'; old.exileOf = n.id; old.nation = null; C.relAdd(old, g, 'h', 80, '仇敵'); }
          G.Family.crown(n, g, 'クーデター'); n.stability = 40;
        }
      },
      {
        key: 'hero', w: () => 0.1 + Object.values(W.S.wars).filter(w => !w.ended || W.S.day - w.endDay < 720).length * 0.08, run() {
          const ns = W.aliveNations(); if (!ns.length) return;
          const n = W.rng.weighted(ns.map(n => ({ w: 1 + W.warsOf(n.id).length * 2 + n.warsLost, v: n })));
          if (Object.keys(W.S.chars).length >= G.CFG.MAX_ALIVE_CHARS) return;
          const h = EV.makeHero(n, false);
          const avenger = n.warsLost > 0 && W.rng.chance(0.5);
          if (avenger) { const foe = W.rng.pick(G.RACE_KEYS.filter(r => r !== n.race)); C.raceAtt(h, foe, -50); C.remember(h, `${G.RACES[foe].name}に故郷を焼かれた`); }
          W.log('person', '英雄の誕生', `${n.name}の平民から、${avenger ? '故郷を失った怒りを胸に' : '並はずれた力を持つ'}${h.name}が英雄として名をあげた。`, { n: [n.id], c: [h.id], imp: 2 });
          W.effect('hero', W.capitalOf(n.id).x, W.capitalOf(n.id).y);
        }
      },
      {
        key: 'awaken', w: () => 0.1, run() {
          const cs = Object.values(W.S.chars).filter(c => c.alive && C.age(c) < G.RACES[c.race].adult * 2 && c.role !== 'ruler');
          if (!cs.length) return;
          const c = W.rng.pick(cs);
          c.st.int = Math.min(100, c.st.int + 25); if (c.role !== 'heir') c.role = 'mage'; c.fame += 10;
          W.log('person', '魔法の才能の覚醒', `${W.nationName(c.nation)}の${c.name}に、大きな魔法の才能が目覚めた。`, { n: [c.nation], c: [c.id], imp: 1 });
        }
      },
      {
        key: 'weapon', w: () => 0.07, run() {
          const cs = Object.values(W.S.chars).filter(c => c.alive && !c.item && (c.role === 'general' || c.role === 'hero' || c.role === 'ruler'));
          if (!cs.length) return;
          const c = W.rng.pick(cs); c.item = W.rng.pick(ITEMS); c.st.war = Math.min(100, c.st.war + 15); c.fame += 15;
          W.log('discovery', '伝説の武器の発見', `${c.name}が伝説の武器「${c.item}」を手に入れた。`, { n: [c.nation], c: [c.id], imp: 2 });
        }
      },
      {
        key: 'defect', w: () => 0.1, run() {
          const cs = Object.values(W.S.chars).filter(c => c.alive && c.nation != null && (c.role === 'general' || c.role === 'mage' || c.role === 'noble') && P.treachery(c) > 0.7 && c.st.loy < 30);
          if (!cs.length) return;
          const c = W.rng.pick(cs);
          const to = W.rng.pick(W.aliveNations().filter(n => n.id !== c.nation && G.Factions.side(n.id) === G.Factions.side(c.nation)));
          if (!to) return;
          const from = c.nation;
          c.nation = to.id; c.st.loy = 45;
          const ruler = W.liveChar(W.nation(from).ruler);
          if (ruler) C.relAdd(ruler, c, 'h', 50, '敵対');
          W.log('person', '裏切り', `${W.nationName(from)}の${c.name}が、国をすてて${to.name}に寝返った。`, { n: [from, to.id], c: [c.id], imp: 2 });
        }
      },
      {
        key: 'ruins', w: () => W.S.ruins.some(r => !r.found) ? 0.16 : 0, run() { EV.discoverRuin(); }
      },
      {
        key: 'dragon', w: () => W.aliveNations().some(n => n.race === 'dragon') ? 0.07 : 0.015, run() {
          const dn = W.aliveNations().find(n => n.race === 'dragon');
          const targets = W.S.cities.filter(c => { const o = W.nation(c.owner); return o && o.race !== 'dragon'; });
          if (!targets.length) return;
          let c;
          if (dn) { const cap = W.capitalOf(dn.id); c = targets.sort((a, b) => W.distCities(a, cap) - W.distCities(b, cap))[W.rng.int(0, Math.min(3, targets.length - 1))]; }
          else c = W.rng.pick(targets);
          c.pop *= 0.9; c.unrest = Math.min(100, c.unrest + 10);
          W.log('disaster', 'ドラゴンの襲来', `${dn ? dn.name + 'の' : 'はぐれ'}竜が${c.name}を襲い、町の一部を焼きはらった。`, { n: owners([c]).concat(dn ? [dn.id] : []), x: c.x, y: c.y, imp: 2 });
          W.effect('fire', c.x, c.y);
          if (dn) { const r = W.rel(dn.id, c.owner); if (r) r.v -= 15; }
        }
      },
      {
        key: 'worldtree', w: () => (!W.S.flags.worldTree && W.aliveNations().some(n => n.race === 'elf')) ? 0.012 : 0, run() {
          const n = W.aliveNations().find(n => n.race === 'elf'); if (!n) return;
          W.S.flags.worldTree = true;
          for (const c of W.citiesOf(n.id)) { c.mods.harvest = W.S.day + 360 * 10; }
          n.tech += 0.5;
          const cap = W.capitalOf(n.id);
          W.log('miracle', '世界樹の覚醒', `${n.name}の森の奥で、眠っていた世界樹が目を覚ました。森に恵みがあふれている。`, { n: [n.id], x: cap.x, y: cap.y, imp: 3 });
          W.effect('bless', cap.x, cap.y);
        }
      },
      {
        key: 'summon', w: () => 0.035, run() {
          const cs = Object.values(W.S.chars).filter(c => c.alive && (c.role === 'mage') && (P.has(c, 'cruel') || P.has(c, 'curious')) && c.nation != null && G.Factions.side(c.nation) === 'h');
          if (!cs.length) return;
          const m = W.rng.pick(cs); const home = W.S.cities[m.home] || W.capitalOf(m.nation);
          if (!home) return;
          const sz = W.rng.int(600, 1600);
          const a = G.Armies.spawnMonsters(home.x + W.rng.int(-3, 3), home.y + W.rng.int(-3, 3), sz, '悪魔の軍勢');
          if (!G.Map.isLand(G.Map.idx(a.x | 0, a.y | 0))) { a.x = home.x + 0.5; a.y = home.y + 0.5; }
          W.log('disaster', '悪魔の召喚', `${m.name}が禁じられた儀式で悪魔を呼び出してしまった。悪魔の軍勢があふれ出している。`, { n: [m.nation], c: [m.id], x: home.x, y: home.y, imp: 2 });
          m.fame -= 10; W.effect('monster', home.x, home.y);
        }
      },
      {
        key: 'romance', w: () => 0.09, run() {
          const cs = Object.values(W.S.chars).filter(c => c.alive && c.spouse == null && C.isAdult(c) && c.nation != null);
          if (cs.length < 2) return;
          const a = W.rng.pick(cs);
          const b = W.rng.pick(cs.filter(x => x.nation !== a.nation && x.sex !== a.sex && C.age(x) < G.RACES[x.race].fertile[1]));
          if (!b) return;
          C.relAdd(a, b, 'a', 60, '恋人'); C.relAdd(b, a, 'a', 60, '恋人');
          const enemy = W.atWar(a.nation, b.nation);
          W.log('person', enemy ? '敵国の恋' : '国をこえた恋', `${W.nationName(a.nation)}の${a.name}と${W.nationName(b.nation)}の${b.name}が恋に落ちた。${enemy ? '二人の国は戦争中だ……。' : ''}`, { n: [a.nation, b.nation], c: [a.id, b.id], imp: 1 });
          if (!enemy && W.rng.chance(0.4)) { G.Family.marry(a, b, a.royal && b.royal); }
          if (a.race !== b.race) { C.raceAtt(a, b.race, 25); C.raceAtt(b, a.race, 25); }
        }
      },
      {
        key: 'missing', w: () => 0.04, run() {
          const cs = Object.values(W.S.chars).filter(c => c.alive && c.role !== 'ruler' && c.nation != null && C.age(c) < G.RACES[c.race].adult * 1.5);
          if (!cs.length) return;
          const c = W.rng.pick(cs); const from = c.nation;
          c.role = 'wanderer'; c.nation = null; c.missingFrom = from;
          W.log('person', '家族の失踪', `${W.nationName(from)}の${c.name}が行方不明になった。`, { n: [from], c: [c.id], imp: 1 });
        }
      }
    ],

    makeHero(n, divine) {
      const h = C.spawnNotable(n.id, 'hero');
      h.st.war = Math.min(100, h.st.war + (divine ? 20 : 8)); h.st.cha = Math.min(100, h.st.cha + 10);
      if (!h.traits.includes('brave') && !h.traits.includes('coward')) h.traits.push('brave');
      h.fame += divine ? 40 : 25;
      return h;
    },

    discoverRuin() {
      const rng = W.rng;
      const MW = G.Map.W;
      const list = W.S.ruins.filter(r => !r.found && MW.region[G.Map.idx(r.x, r.y)] >= 0);
      if (!list.length) return;
      const r = rng.pick(list);
      const c = W.S.cities[MW.region[G.Map.idx(r.x, r.y)]];
      const n = W.nation(c.owner);
      if (!n) return;
      r.found = W.year(); r.by = n.id;
      const R = G.RUINS[r.type];
      let txt = '';
      switch (r.type) {
        case 'city': n.tech += 1; txt = '古代都市の知識で技術が大きく進んだ。'; break;
        case 'tomb': n.res.gold += 1500; txt = '王の墓から莫大な財宝が見つかった。'; break;
        case 'relic': for (const x of W.citiesOf(n.id)) x.faith = Math.min(1, (x.faith || 0) + 0.2); W.S.goddess.awareness = Math.min(100, W.S.goddess.awareness + 3); txt = n.side === 'd' ? '魔族の遺跡なのに、女神の紋章がきざまれた遺物が見つかった……。' : '神の遺物が見つかり、人々の女神への信仰が深まった。'; break;
        case 'weapon': { const g = W.charsOf(n.id).filter(x => x.role === 'general' || x.role === 'hero' || x.role === 'ruler').sort((a, b) => b.st.war - a.st.war)[0]; if (g) { g.item = '古代兵器'; g.st.war = Math.min(100, g.st.war + 20); } n.manpower *= 1.2; txt = '古代兵器が掘り出され、軍が強化された。'; break; }
        case 'magic': n.tech += 0.6; { const m = W.charsOf(n.id).find(x => x.role === 'mage'); if (m) { m.st.int = Math.min(100, m.st.int + 20); m.fame += 20; } } txt = '禁断の魔法の書が見つかった。'; break;
        case 'sealed': { const a = G.Armies.spawnMonsters(r.x, r.y, rng.int(1500, 3000), '封印されていた魔物'); a.start = a.total; } txt = 'しかし、封印されていた魔物が解き放たれてしまった!'; break;
        case 'script': n.tech += 0.4; txt = '古代文字の解読が進み、失われた歴史が明らかになった。'; break;
      }
      W.log('discovery', `${R.name}の発見`, `${n.name}が${c.name}の近くで${R.name}を発見した。${txt}`, { n: [n.id], x: r.x, y: r.y, imp: 2 });
      W.effect(r.type === 'sealed' ? 'monster' : 'bless', r.x, r.y);
    },

    monthly() {
      const S = W.S, rng = W.rng;
      // 疫病の広がり
      for (const c of S.cities) {
        if (!(c.mods.plague > S.day) || !rng.chance(0.05)) continue;
        for (const j of G.Map.W.cityAdj[c.id]) {
          const d = S.cities[j];
          if (!(d.mods.plague > S.day) && !(d.mods.immune > S.day) && rng.chance(0.3)) { d.mods.plague = S.day + 180; d.mods.immune = S.day + 360 * 6; W.log('disaster', '疫病の拡大', `疫病が${c.name}から${d.name}へ広がった。`, { n: owners([d]), x: d.x, y: d.y, imp: 1 }); }
        }
      }
      // 事件のくじ
      const tries = rng.chance(0.55) ? 1 : 0;
      for (let k = 0; k < tries; k++) {
        const ev = rng.weighted(EV.list.map(e => ({ w: e.w(), v: e })));
        if (ev) ev.run();
      }
    },

    // 1年に1回: 亡命した王族による国の再興
    yearly() {
      const rng = W.rng;
      const exiles = Object.values(W.S.chars).filter(c => c.alive && c.exileOf != null && c.nation == null && C.isAdult(c));
      for (const e of exiles) {
        const old = W.S.nations[e.exileOf];
        if (!old || old.alive || old.restored || old.peakCities < 2 || !rng.chance(0.08 + e.st.amb / 800)) continue;
        const cs = W.S.cities.filter(c => c.unrest > 50 && c.pop > 600 && c.races[old.race] > 0.3 && c.owner != null && W.citiesOf(c.owner).length > 1 && W.nation(c.owner).capital !== c.id);
        if (!cs.length) continue;
        const c = rng.pick(cs);
        e.exileOf = null; old.restored = true;
        G.Nations.independence(c, '再興', { char: e, oldName: old.name, oldShort: old.short });
        return;
      }
      // 行方不明だった人の帰還
      for (const c of Object.values(W.S.chars)) {
        if (c.alive && c.missingFrom != null && rng.chance(0.15)) {
          const n = W.nation(c.missingFrom);
          if (n && n.alive) {
            c.nation = n.id; c.role = 'hero'; c.st.war = Math.min(100, c.st.war + 20); c.fame += 20; c.missingFrom = null;
            W.log('person', '帰還', `行方不明だった${c.name}が、たくましく成長して${n.name}に帰ってきた。`, { n: [n.id], c: [c.id], imp: 1 });
          }
        }
      }
    }
  };
  G.RUINS = {
    city: { name: '古代都市の遺跡' }, tomb: { name: '王の墓' }, relic: { name: '神の遺物' }, weapon: { name: '古代兵器' },
    magic: { name: '禁断の魔法' }, sealed: { name: '封印された魔物' }, script: { name: '古代文字の石碑' }
  };
  G.Events = EV;
})(globalThis.GD = globalThis.GD || {});
