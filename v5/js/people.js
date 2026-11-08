// 人物: 生まれる・年をとる・関係をもつ・死ぬ・後をつぐ
(function (G) {
  const P = {
    make(o) {
      const S = G.S, rng = G.rng, race = o.race, sex = o.sex || (rng.chance(0.55) ? 'm' : 'f');
      const age = o.age != null ? o.age : rng.int(18, 50);
      const id = G.newId('p');
      const traits = o.traits ? o.traits.slice() : [];
      while (traits.length < 2) {
        const t = rng.pick(G.TRAIT_KEYS);
        if (traits.includes(t) || traits.some(x => G.TRAITS[x].opp === t || G.TRAITS[t].opp === x)) continue;
        traits.push(t);
      }
      const L = G.RACES[race].life;
      const st = (b) => G.clamp(Math.round(rng.gauss(b, 16)), 5, 99);
      const p = {
        id, alive: true, race, sex, name: o.name || G.Names.person(rng, race, sex), house: o.house || G.Names.family(rng, race),
        born: G.Y() - age, life: rng.int(L[0], L[1]), nation: o.nation || null, role: o.role || 'noble', title: '',
        traits,
        martial: o.martial != null ? o.martial : st(traits.includes('brave') ? 62 : 48),
        intrigue: o.intrigue != null ? o.intrigue : st(traits.includes('cunning') ? 66 : 42),
        diplomacy: o.diplomacy != null ? o.diplomacy : st(traits.includes('gentle') || traits.includes('just') ? 60 : 45),
        piety: o.piety != null ? o.piety : st(traits.includes('devout') ? 82 : 52),
        ambition: o.ambition != null ? o.ambition : st(traits.includes('ambitious') ? 80 : 44),
        loyalty: o.loyalty != null ? o.loyalty : st(64),
        fear: 10, conf: 50, health: 100, fame: o.fame || 0,
        rel: {}, mem: [], inf: [], parents: o.parents || [], spouse: null, children: [],
        face: null, blessed: 0, ill: 0, armyId: null, city: o.city || null, deathDay: null, death: '',
        plot: 0
      };
      p.face = P.faceFor(p);
      S.chars[id] = p;
      P.updateTitle(p);
      return p;
    },
    faceFor(p) {
      const age = G.ageOf(p), grp = age < 26 ? 'young' : age < 58 ? 'adult' : 'old';
      const pool = G.FACES[p.race][p.sex][grp];
      return pool[G.hashString(p.id + p.name)[0] % pool.length];
    },
    updateTitle(p) {
      const n = G.N(p.nation);
      if (p.role === 'ruler') p.title = G.RULER_TITLE[p.race][p.sex];
      else if (p.role === 'heir') p.title = p.sex === 'f' ? '王女' : '王子';
      else if (p.role === 'general') p.title = '将軍';
      else if (p.role === 'hero') p.title = '英雄';
      else if (p.role === 'priest') p.title = '大神官';
      else if (p.role === 'knight') p.title = '騎士';
      else if (p.role === 'rebel') p.title = '反乱軍の';
      else if (p.role === 'exile') p.title = '亡命中の';
      else p.title = '';
      if (p.race === 'demon' && p.role === 'heir') p.title = p.sex === 'f' ? '魔王女' : '魔王子';
      if (n && p.role === 'ruler' && n.form && n.form.includes('帝国')) p.title = p.race === 'demon' ? '魔帝' : (p.sex === 'f' ? '女帝' : '皇帝');
    },
    full(p) { return `${G.pname(p)}`; },
    traitText(p) { return p.traits.map(t => G.TRAITS[t].name).join('・'); },
    // 家族をつなぐ
    family(parent, child) {
      child.parents.push(parent.id); parent.children.push(child.id);
      G.setRel(parent, child, 'child', 70); G.setRel(child, parent, 'parent', 60);
    },
    marry(a, b) {
      a.spouse = b.id; b.spouse = a.id;
      G.setRel(a, b, 'spouse', 55, 'spouse');
    },
    alive(id) { const p = G.P(id); return p && p.alive ? p : null; },
    ruler(n) { return n ? P.alive(n.ruler) : null; },
    members(n, role) { return G.chars().filter(p => p.nation === n.id && (!role || p.role === role)); },
    // 跡継ぎ候補(子ども → きょうだい → 将軍・貴族)
    heirs(n) {
      const r = G.P(n.ruler);
      const fam = new Set();
      if (r) { for (const c of r.children) fam.add(c); for (const pid of r.parents) { const pp = G.P(pid); if (pp) for (const c of pp.children) if (c !== r.id) fam.add(c); } }
      const list = [...fam].map(id => P.alive(id)).filter(p => p && p.nation === n.id && G.ageOf(p) >= 0);
      list.sort((a, b) => (G.ageOf(b) >= G.RACES[b.race].adult) - (G.ageOf(a) >= G.RACES[a.race].adult) || a.born - b.born);
      return list;
    },
    die(p, cause, opt) {
      if (!p || !p.alive) return;
      p.alive = false; p.deathDay = G.S.day; p.death = cause;
      if (p.armyId) { const a = G.A(p.armyId); if (a && a.cmd === p.id) a.cmd = null; p.armyId = null; }
      // 家族・友人の記憶に残る
      for (const id in p.rel) {
        const q = P.alive(id); if (!q) continue;
        const r = q.rel[p.id];
        if (r && r.v > 25) {
          G.remember(q, `${G.pname(p)}が${cause}。`, 'grief', { who: p.id });
          if (opt && opt.killerNation && q.nation !== opt.killerNation) {
            const kn = G.N(opt.killerNation);
            G.remember(q, `${G.pname(p)}を${G.nname(kn)}に殺された。`, 'revenge', { nation: opt.killerNation, who: p.id });
            q.hate = q.hate || {}; q.hate[opt.killerNation] = (q.hate[opt.killerNation] || 0) + (r.k === 'child' || r.k === 'parent' || r.k === 'spouse' ? 40 : 18);
            if (opt.killer) { const k = P.alive(opt.killer); if (k) G.setRel(q, k, 'hate', -80); }
          }
        }
      }
      const n = G.N(p.nation);
      if (n && n.ruler === p.id) G.Nations.succession(n, cause, opt);
      G.emit('death', p);
    },
    // 毎年: 年をとる・病気・死・結婚・子ども
    yearly() {
      const rng = G.rng;
      for (const p of G.chars()) {
        const age = G.ageOf(p);
        if ([26, 58].includes(age)) p.face = P.faceFor(p);
        let risk = age > p.life ? 0.12 + (age - p.life) * 0.05 : age > p.life * 0.75 ? 0.012 : 0.003;
        if (p.ill > 0) risk += 0.18;
        if (rng.chance(risk)) {
          if (p.blessed > G.S.day) { p.blessed = 0; G.remember(p, '死の淵から奇跡的に回復した。', 'miracle'); p.piety = Math.min(100, p.piety + 15); continue; }
          P.die(p, age > p.life * 0.9 ? '老衰で世を去った' : '病で世を去った');
          if (p.role === 'ruler' || p.role === 'hero' || p.fame > 40) G.news(`${G.pname(p)}が${age}歳で亡くなった。`, { k: 'person', at: P.where(p), imp: 2 });
          continue;
        }
        if (p.ill > 0) { p.ill--; if (p.ill === 0) G.remember(p, '病から回復した。', 'event'); }
        if (!p.ill && rng.chance(age > 55 ? 0.08 : 0.02)) p.ill = rng.int(1, 2);
        p.fear = Math.max(0, p.fear - 8); p.conf += (50 - p.conf) * 0.2;
        p.inf = p.inf.filter(f => f.until > G.S.day);
      }
      P.marriages(); P.births(); P.newcomers();
    },
    marriages() {
      const rng = G.rng;
      const single = G.chars().filter(p => !p.spouse && ['ruler', 'heir', 'general', 'noble', 'hero', 'knight'].includes(p.role) && G.ageOf(p) >= G.RACES[p.race].adult + 2 && G.ageOf(p) < 55);
      for (const a of single) {
        if (a.spouse || !rng.chance(0.18)) continue;
        // 愛情のある相手を先に
        let b = null;
        for (const id in a.rel) { const q = P.alive(id); if (q && !q.spouse && q.sex !== a.sex && a.rel[id].k === 'love') { b = q; break; } }
        if (!b) {
          const pool = single.filter(q => q !== a && !q.spouse && q.sex !== a.sex && q.race === a.race && !a.parents.some(x => q.parents.includes(x)));
          // 王族どうしの政略結婚(仲のよい国)
          const royal = pool.filter(q => q.nation !== a.nation && ['ruler', 'heir'].includes(q.role) && ['ruler', 'heir'].includes(a.role) && G.rel(a.nation, q.nation).opinion > 15 && !G.atWar(a.nation, q.nation));
          b = royal.length && rng.chance(0.6) ? rng.pick(royal) : (pool.filter(q => q.nation === a.nation).length ? rng.pick(pool.filter(q => q.nation === a.nation)) : null);
          if (!b) {
            // 君主・王族には、宮廷の貴族から結婚相手があらわれる
            if (!['ruler', 'heir'].includes(a.role) || !rng.chance(0.6)) continue;
            b = P.make({ race: a.race, nation: a.nation, role: 'noble', sex: a.sex === 'm' ? 'f' : 'm', age: Math.max(G.RACES[a.race].adult, G.ageOf(a) + rng.int(-6, 4)), city: a.city, ambition: rng.int(20, 60) });
          }
        }
        P.marry(a, b);
        if (a.nation !== b.nation && ['ruler', 'heir'].includes(a.role) && ['ruler', 'heir'].includes(b.role)) {
          const r = G.rel(a.nation, b.nation); r.opinion = Math.min(100, r.opinion + 25);
          G.Story.event('marriage', { a: a.id, b: b.id });
        } else if (a.role === 'ruler' || b.role === 'ruler' || (a.rel[b.id] && a.rel[b.id].k === 'love' && a.race !== b.race)) {
          G.news(`${G.pname(a)}と${G.pname(b)}が結婚した。`, { k: 'person', at: P.where(a) });
        }
        G.remember(a, `${G.pname(b)}と結婚した。`, 'joy', { who: b.id }); G.remember(b, `${G.pname(a)}と結婚した。`, 'joy', { who: a.id });
      }
    },
    births() {
      const rng = G.rng;
      for (const m of G.chars()) {
        if (m.sex !== 'f' || !m.spouse) continue;
        const f = P.alive(m.spouse); if (!f) continue;
        const age = G.ageOf(m), R = G.RACES[m.race];
        if (age < R.adult || age > (m.race === 'demon' ? 90 : 42) || m.children.length >= 4) continue;
        if (!rng.chance(m.race === 'demon' ? 0.12 : 0.22)) continue;
        const royal = [m, f].some(p => p.role === 'ruler' || p.role === 'heir');
        const n = G.N(m.nation) || G.N(f.nation);
        const c = P.make({ race: m.race, age: 0, nation: (royal && n) ? n.id : m.nation, role: royal ? 'heir' : 'noble', house: f.house, city: m.city });
        P.family(m, c); P.family(f, c);
        G.setRel(c, m, 'parent', 60); G.setRel(c, f, 'parent', 60);
        if (royal && n && (n.ruler === m.id || n.ruler === f.id)) G.news(`${G.nname(n)}に${c.sex === 'f' ? '王女' : '王子'}${c.name}が生まれた。`, { k: 'person', at: P.where(m) });
      }
    },
    // 新しい人物があらわれる(騎士・神官など)。人物が足りないときだけ
    newcomers() {
      const rng = G.rng;
      if (G.chars().length > G.CFG.MAX_ALIVE_CHARS) return;
      for (const n of G.nations()) {
        const gens = P.members(n, 'general').length + P.members(n, 'hero').length;
        if (gens < 2 && rng.chance(0.5)) P.promote(n, 'general');
        if (!P.members(n, 'priest').length && rng.chance(0.4)) {
          const p = P.make({ race: n.race, nation: n.id, role: 'priest', age: rng.int(35, 60), city: n.capital, piety: rng.int(70, 98) });
          G.news(`${G.nname(n)}に新しい${G.pname(p)}が立った。`, { k: 'faith', at: G.C(n.capital) });
        }
        if (P.members(n, 'knight').length < 1 && rng.chance(0.3)) {
          P.make({ race: n.race, nation: n.id, role: 'knight', age: rng.int(17, 24), city: rng.pick(n.cities), martial: rng.int(45, 85) });
        }
      }
    },
    promote(n, role) {
      const rng = G.rng;
      const cand = G.chars().filter(p => p.nation === n.id && ['knight', 'noble'].includes(p.role) && G.ageOf(p) >= G.RACES[p.race].adult);
      let p = cand.length ? cand.sort((a, b) => b.martial - a.martial)[0] : null;
      if (!p) p = P.make({ race: n.race, nation: n.id, role, age: rng.int(25, 45), city: rng.pick(n.cities), martial: rng.int(50, 85) });
      p.role = role; P.updateTitle(p);
      const r = P.ruler(n); if (r) { G.addRel(p, r, 'loyal', 20); }
      return p;
    },
    where(p) {
      if (!p) return null;
      if (p.armyId) { const a = G.A(p.armyId); if (a) return { x: a.x, y: a.y }; }
      const c = G.C(p.city) || (G.N(p.nation) && G.C(G.N(p.nation).capital));
      return c ? { x: c.x, y: c.y } : null;
    },
    // ---- 頭の中: いまの目標と、これからしそうなこと(画面に出す) ----
    mind(p) {
      const n = G.N(p.nation), out = { goal: '', next: '', lean: 0 };
      if (!n) { out.goal = '居場所を探している'; return out; }
      const age = G.ageOf(p);
      if (age < G.RACES[p.race].adult) { out.goal = '幼く、まだ大人たちに守られている'; out.next = '成長を待つ'; return out; }
      // 復讐
      let rev = null, rv = 0;
      if (p.hate) for (const k in p.hate) if (p.hate[k] > rv && G.N(k) && G.N(k).alive) { rv = p.hate[k]; rev = G.N(k); }
      if (p.role === 'ruler') {
        const wars = G.enemiesOf(n);
        if (wars.length) {
          const pd = G.Nations.peaceDesire(n, wars[0]);
          out.goal = `${G.nname(wars[0])}との戦争に勝つ`;
          out.next = pd > 55 ? `${G.nname(wars[0])}との和平を考えはじめている` : `${G.nname(wars[0])}への攻撃を続けるつもりだ`;
          out.lean = pd;
        } else {
          let best = null, bv = -999;
          for (const m of G.Nations.neighbors(n)) { const v = G.Nations.warDesire(n, m); if (v > bv) { bv = v; best = m; } }
          if (best && bv > 30) {
            out.goal = rev ? `${G.nname(rev)}への復讐` : `${G.nname(best)}の領土を手に入れる`;
            out.next = bv > 52 ? `近いうちに${G.nname(best)}へ攻めこみそうだ` : `${G.nname(best)}への侵攻を考えている(まだ迷っている)`;
            out.lean = bv;
          } else if (G.hasTrait(p, 'peaceful') || G.hasTrait(p, 'gentle')) { out.goal = '国を豊かにし、民を守る'; out.next = '戦争を避け、国の中を整えようとしている'; }
          else { out.goal = '国の力をたくわえる'; out.next = best ? `${G.nname(best)}の動きを警戒している` : '国の守りを固めている'; }
        }
        return out;
      }
      if (p.plot > 40) { out.goal = '王位を自分のものにする(ひそかに)'; out.next = p.plot > 70 ? '近いうちに行動を起こしそうだ' : '仲間を集め、機会をうかがっている'; out.lean = p.plot; return out; }
      if (rev) { out.goal = `${G.nname(rev)}への復讐`; out.next = `${G.nname(rev)}と戦う機会を待っている`; return out; }
      if (p.role === 'heir') { out.goal = '王位を継ぐ日にそなえる'; out.next = p.ambition > 70 ? '自分こそ王にふさわしいと考えている' : '父母のそばで学んでいる'; return out; }
      if (p.role === 'general' || p.role === 'hero') {
        const a = G.A(p.armyId);
        if (a && a.goal) { const c = G.C(a.goal); out.goal = c ? `${c.name}を${c.owner === p.nation ? '守る' : '攻め落とす'}` : '敵軍を打ち破る'; out.next = `${a.name}を率いて進軍している`; }
        else { out.goal = p.role === 'hero' ? '人々を守る' : '国を守る'; out.next = '命令を待っている'; }
        return out;
      }
      if (p.role === 'priest') { out.goal = `${G.FAITH[p.race].name}を広める`; out.next = '神殿の祭りを準備している'; return out; }
      if (p.role === 'rebel') { out.goal = '今の支配をくつがえす'; out.next = '反乱軍を率いている'; return out; }
      if (p.role === 'exile') { out.goal = '故郷を取りもどす'; out.next = '亡命先で味方を探している'; return out; }
      out.goal = p.ambition > 65 ? '出世する' : '家と領地を守る'; out.next = '日々のつとめを果たしている';
      return out;
    }
  };
  G.People = P;
})(globalThis.GD = globalThis.GD || {});
