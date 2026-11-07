// 国家: 建国・滅亡・分裂・独立・都市の移り変わり
(function (G) {
  const W = G.World, C = G.Chars;

  function freeColor() {
    const used = new Set(W.aliveNations().map(n => n.colorIdx));
    const free = [];
    for (let i = 0; i < G.NATION_COLORS.length; i++) if (!used.has(i)) free.push(i);
    return free.length ? W.rng.pick(free) : W.rng.int(0, G.NATION_COLORS.length - 1);
  }
  function dirWord(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y;
    if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? '東' : '西';
    return dy > 0 ? '南' : '北';
  }

  const N = {
    create(o) {
      const rng = W.rng, S = W.S;
      const id = W.newId();
      const nm = o.name ? { name: o.name, short: o.short || o.name } : G.Names.nation(rng, o.race);
      const ci = o.colorIdx != null ? o.colorIdx : freeColor();
      const n = {
        id, name: nm.name, short: nm.short, race: o.race,
        colorIdx: ci, color: G.NATION_COLORS[ci],
        goal: o.goal || rng.pick(Object.keys(G.GOALS)),
        ruler: null, capital: null, alive: true,
        founded: o.founded != null ? o.founded : W.year(), fallen: null,
        dynasty: null, religion: o.religion || G.RACES[o.race].religion,
        res: { food: 600, wood: 150, ore: 100, gold: 400 },
        tech: o.tech != null ? o.tech : rng.range(1, 2.2), techPts: 0,
        stability: 65, faith: 30, manpower: 0, weariness: 0,
        income: 0, military: 0, economy: 0,
        flag: { pat: rng.int(0, 5), emb: rng.int(0, 7), acc: rng.int(0, 4) },
        parent: o.parent != null ? o.parent : null, mods: {}, warsWon: 0, warsLost: 0, peakCities: 0,
        side: o.side || (G.Factions ? G.Factions.sideOfRace(o.race) : 'h'), mpMul: o.mpMul || 1
      };
      if (G.Factions) n.religion = n.side === 'h' ? 'goddess' : 'demonlord';
      S.nations[id] = n;
      if (o.cities) for (const c of o.cities) N.giveCity(c, n.id, true);
      if (o.cities && o.cities.length) {
        n.capital = o.cities.slice().sort((a, b) => b.pop - a.pop)[0].id;
      }
      W.dirtyTerritory = true;
      return n;
    },

    giveCity(city, nid, silent) {
      const old = W.nation(city.owner);
      city.owner = nid;
      W.dirtyTerritory = true;
      if (old && old.alive && old.id !== nid) {
        if (old.capital === city.id) {
          const rest = W.citiesOf(old.id).sort((a, b) => b.pop - a.pop);
          if (rest.length) {
            old.capital = rest[0].id;
            old.stability = Math.max(0, old.stability - 15);
            if (!silent) W.log('politics', `${old.name}の遷都`, `首都${city.name}を失った${old.name}は、${rest[0].name}に都を移した。`, { n: [old.id], x: rest[0].x, y: rest[0].y, imp: 2 });
          }
        }
        if (!W.citiesOf(old.id).length) N.destroy(old, nid);
      }
      const n = W.nation(nid);
      if (n) n.peakCities = Math.max(n.peakCities, W.citiesOf(nid).length);
    },

    destroy(n, byId) {
      if (!n.alive) return;
      n.alive = false; n.fallen = W.year();
      const by = W.nation(byId);
      W.log('nation', `${n.name}の滅亡`, `${n.founded}年に建国された${n.name}は、${by ? by.name + 'によって' : ''}滅亡した。${n.founded < W.year() ? (W.year() - n.founded) + '年の歴史だった。' : ''}`, { n: [n.id, byId], imp: 3 });
      // 戦争を終わらせる
      for (const w of W.warsOf(n.id)) {
        w.att = w.att.filter(x => x !== n.id); w.def = w.def.filter(x => x !== n.id);
        if (!w.att.length || !w.def.length) G.Diplomacy.endWar(w, '一方の国が滅亡したため', byId);
      }
      // 軍は解散
      for (const id in W.S.armies) if (W.S.armies[id].nation === n.id) G.Armies.remove(W.S.armies[id]);
      // 人物は亡命者に
      for (const c of W.charsOf(n.id)) {
        if (c.royal) { c.role = 'exile'; c.exileOf = n.id; c.nation = null; C.remember(c, `祖国${n.name}が滅びた`); if (by) { C.raceAtt(c, by.race, -30); } }
        else if (by && W.rng.chance(0.6)) { c.nation = by.id; c.st.loy = 30; C.remember(c, `${by.name}に仕えることになった`); }
        else { c.role = 'wanderer'; c.nation = null; }
      }
    },

    // 内戦: 反乱者が国の一部を持って独立し、戦争になる
    civilWar(n, rival, reason) {
      const cap = W.capitalOf(n.id);
      const cities = W.citiesOf(n.id).filter(c => c.id !== n.capital);
      if (!cap || !cities.length) return null;
      cities.sort((a, b) => W.distCities(b, cap) - W.distCities(a, cap));
      const k = Math.max(1, Math.round(W.citiesOf(n.id).length * W.rng.range(0.3, 0.45)));
      const far = cities[0];
      const take = cities.slice().sort((a, b) => W.distCities(a, far) - W.distCities(b, far)).slice(0, k);
      const word = dirWord(cap, far);
      const nn = N.create({ race: n.race, cities: take, name: `${word}${n.short}${W.rng.pick(['王国', '公国', '国'])}`, short: word + n.short, parent: n.id, religion: n.religion, tech: n.tech, goal: 'expansion', side: n.side, mpMul: n.mpMul });
      nn.res.gold = n.res.gold * 0.4; n.res.gold *= 0.6;
      nn.manpower = n.manpower * 0.4; n.manpower *= 0.6;
      rival.royal = true;
      G.Family.crown(nn, rival, reason);
      // 反乱者に近い人物がついていく
      for (const c of W.charsOf(n.id)) {
        if (c.id === n.ruler || c.id === rival.id) continue;
        const r = c.rel[rival.id];
        if ((r && r.a > 20) || (c.st.loy < 35 && W.rng.chance(0.5)) || c.spouse === rival.id) { c.nation = nn.id; C.remember(c, `${rival.name}に従った`); }
      }
      W.log('politics', `${n.name}の分裂`, `${reason}から、${rival.name}が独立し「${nn.name}」を建国した。${take.map(c => c.name).join('・')}が従った。同じ${G.SIDES[n.side].name}どうし、剣は向け合わず、ともに${n.side === 'h' ? '魔族' : '人族'}と戦い続ける。`, { n: [n.id, nn.id], c: [rival.id], x: far.x, y: far.y, imp: 3 });
      W.effect('revolt', far.x, far.y);
      return nn;
    },

    // 都市の独立(反乱)
    independence(city, reason, leader) {
      const old = W.nation(city.owner);
      const rs = Object.keys(city.races);
      let race = rs.sort((a, b) => city.races[b] - city.races[a])[0] || (old && old.race) || 'human';
      if (reason === '再興' && leader && leader.char) race = leader.char.race;
      const group = [city];
      if (old) for (const j of G.Map.W.cityAdj[city.id]) {
        const c2 = W.S.cities[j];
        if (c2.owner === old.id && c2.unrest > 62 && c2.id !== old.capital && group.length < 3) group.push(c2);
      }
      if (old && W.citiesOf(old.id).length <= group.length) return null; // 全部が反乱したら独立ではない
      const nn = N.create({ race, cities: group, side: old ? old.side : undefined, mpMul: old ? old.mpMul : 1, parent: old ? old.id : null, goal: W.rng.pick(['peace', 'economy', 'expansion', 'religion']), tech: old ? old.tech * 0.9 : 1.5 });
      if (reason === '再興' && leader) { nn.name = '再興' + leader.oldName.replace(/^(再興)+/, ''); nn.short = leader.oldShort; }
      let ruler = leader && leader.char;
      if (!ruler) ruler = C.spawnNotable(nn.id, 'noble', { family: G.Names.family(W.rng, race) });
      ruler.nation = nn.id; ruler.role = 'ruler'; ruler.royal = true;
      G.Family.crown(nn, ruler, reason);
      if (W.rng.chance(0.5)) { const g = C.spawnNotable(nn.id, 'general'); C.relAdd(g, ruler, 'a', 30); }
      for (const c of group) { c.unrest = 20; }
      nn.stability = 55;
      W.log('politics', reason === '再興' ? `${nn.name}の再興` : `${city.name}の独立`, reason === '再興'
        ? `滅びた${leader.oldName}の血を引く${ruler.name}が${city.name}で立ち上がり、国を再建した。`
        : `${old ? old.name + 'の' : ''}${group.map(c => c.name).join('・')}で${reason}が起き、${ruler.name}のもと「${nn.name}」として独立した。`,
        { n: [nn.id, old ? old.id : null].filter(x => x != null), c: [ruler.id], x: city.x, y: city.y, imp: 3 });
      W.effect('revolt', city.x, city.y);
      return nn;
    },

    // 国の強さ(戦争の判断に使う)
    power(nid) {
      const n = W.nation(nid); if (!n) return 0;
      let p = n.manpower * G.RACES[n.race].power * (1 + n.tech * 0.06);
      for (const id in W.S.armies) { const a = W.S.armies[id]; if (a.nation === nid) p += G.Battle.armyPower(a, null, true); }
      return p;
    },
    rulerTitle(n) { return n.race === 'demon' ? '魔王' : n.race === 'dragon' ? '竜王' : n.race === 'beast' ? '大族長' : '国王'; }
  };
  G.Nations = N;
})(globalThis.GD = globalThis.GD || {});
