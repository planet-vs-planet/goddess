// 女神: 信仰と神力・介入(直接/間接)・長期計画
// 女神の正体は住民には決して知られない。結果の文章も、住民から見た出来事として書く。
(function (G) {
  const Go = {
    // 神力の最大
    MAX: 400,
    monthly() {
      const g = G.S.goddess;
      // 種族ごとの信仰(人口で重みをつけた平均)
      for (const race of ['human', 'demon']) {
        const cs = G.cities().filter(c => c.race === race && G.N(c.owner));
        const pop = G.sum(cs, c => c.pop) || 1;
        g.faith[race] = Math.round(G.sum(cs, c => c.faith * c.pop) / pop);
      }
      const inc = G.sum(G.cities(), c => c.pop / 1000 * c.faith / 100) * 0.13;
      g.lastIncome = Math.round(inc);
      g.power = Math.min(Go.MAX, g.power + inc);
      Go.plansCheck();
    },
    prayers(nid, amt) {
      const n = G.N(nid); if (!n) return;
      for (const cid of n.cities) { const c = G.C(cid); c.faith = Math.min(100, c.faith + amt); }
    },
    cost(key, si) { return Math.round(G.POWERS[key].cost * G.STRENGTH[si == null ? 1 : si].cost); },
    // その対象に使える力
    powersFor(type) { return Object.keys(G.POWERS).filter(k => G.POWERS[k].on.includes(type)); },
    // 成功しやすさ(画面に出す目安)
    chance(key, tgt, si) {
      const k = G.STRENGTH[si == null ? 1 : si].k;
      if (tgt.type !== 'person') return null;
      const p = G.P(tgt.id); if (!p) return null;
      if (key === 'oracle') return G.clamp(p.piety / 100 * 0.85 + k * 0.1 + (G.hasTrait(p, 'devout') ? 0.12 : 0), 0.05, 0.98);
      if (key === 'dream') return G.clamp(0.55 + k * 0.15 + (G.hasTrait(p, 'curious') ? 0.1 : 0) - (G.hasTrait(p, 'cunning') ? 0.1 : 0), 0.1, 0.95);
      if (key === 'meet') return null;
      return G.clamp(0.7 + k * 0.1, 0.1, 0.97);
    },
    // ---- 介入する ----
    use(key, tgt, opt) {
      opt = Object.assign({ str: 1, when: 0 }, opt || {});
      const g = G.S.goddess, cost = Go.cost(key, opt.str);
      if (g.power < cost) return { ok: false, text: '神力が足りない。' };
      const err = Go.check(key, tgt, opt); if (err) return { ok: false, text: err };
      g.power -= cost; g.acts++;
      const delay = G.TIMING[opt.when || 0].d;
      if (delay) {
        g.pending.push({ due: G.S.day + delay, key, tgt, opt });
        const msg = `${G.TIMING[opt.when].name}、「${G.POWERS[key].name}」が起きる予定。`;
        g.history.push({ d: G.S.day, key, t: msg });
        return { ok: true, text: msg, later: true };
      }
      return Go.exec(key, tgt, opt);
    },
    check(key, tgt, opt) {
      const P = G.POWERS[key];
      if (!P.on.includes(tgt.type)) return 'この対象には使えない。';
      if (tgt.type === 'person' && !(G.P(tgt.id) && G.P(tgt.id).alive)) return 'この人物はもういない。';
      const nt = P.needTarget && opt.option ? P.needTarget[opt.option] : null;
      if ((P.need && P.need.person) || nt === 'person') { if (!opt.other || !G.P(opt.other)) return '相手の人物を選んでください。'; if (opt.other === tgt.id) return '同じ人物は選べない。'; }
      if ((P.need && P.need.nation) || nt === 'nation') { if (!opt.other || !G.N(opt.other)) return '相手の国を選んでください。'; }
      if (P.need && P.need.option && !opt.option) return '内容を選んでください。';
      return null;
    },
    pendingDay() {
      const g = G.S.goddess;
      const due = g.pending.filter(x => x.due <= G.S.day);
      g.pending = g.pending.filter(x => x.due > G.S.day);
      for (const x of due) { const r = Go.exec(x.key, x.tgt, x.opt); G.emit('goddessResult', r); }
    },
    where(tgt) {
      if (tgt.type === 'person') return G.People.where(G.P(tgt.id));
      if (tgt.type === 'nation') { const n = G.N(tgt.id); return n && G.C(n.capital); }
      if (tgt.type === 'city') return G.C(tgt.id);
      if (tgt.type === 'army') return G.A(tgt.id);
      if (tgt.type === 'place') return { x: tgt.x, y: tgt.y };
      return null;
    },
    exec(key, tgt, opt) {
      const k = G.STRENGTH[opt.str == null ? 1 : opt.str].k, rng = G.rng;
      const f = Go.FX[key];
      let res;
      try { res = f(tgt, opt, k, rng); } catch (e) { console.error(e); res = { ok: false, text: '何も起きなかった。' }; }
      if (!res) res = { ok: false, text: '何も起きなかった。' };
      res.key = key;
      const at = Go.where(tgt);
      res.at = at ? { x: at.x, y: at.y } : null;
      G.S.goddess.history.push({ d: G.S.day, key, t: res.text });
      if (G.S.goddess.history.length > 120) G.S.goddess.history.shift();
      G.news(`【女神】${res.text}`, { k: 'goddess', at: res.at, imp: 2 });
      if (res.at && !res.nofx) G.fx(res.fx || 'divine', res.at.x, res.at.y, { days: 25 });
      Go.plansCheck();
      return res;
    },
    // ---- それぞれの力 ----
    FX: {
      oracle(t, o, k, rng) {
        const p = G.P(t.id), ch = Go.chance('oracle', t, o.str);
        const yes = rng.chance(ch);
        const n = o.other && G.N(o.other), q = o.other && G.P(o.other);
        const msg = { war: `「${n && n.short}を討て」`, peace: `「${n && n.short}と剣をおさめよ」`, distrust: `「${q && q.name}を信じるな」`, temple: '「わが神殿を建てよ」' }[o.option];
        if (!yes) {
          G.influence(p, o.option === 'war' ? 'war' : o.option === 'peace' ? 'peace' : 'x', n ? n.id : null, 6 * k, 200);
          return { ok: false, text: `${G.pname(p)}は祈りの中で声を聞いた。${msg}——しかし${p.piety < 40 ? '信仰の薄い' + p.name + 'は、疲れのせいだと笑い飛ばした' : p.name + 'は迷い、誰にも話さなかった'}。`, fx: 'whisper' };
        }
        G.remember(p, `祈りの中で女神の声を聞いた。${msg}`, 'oracle');
        p.piety = Math.min(100, p.piety + 5);
        if (o.option === 'war') { G.influence(p, 'war', n.id, 32 * k, 720); p.conf = Math.min(100, p.conf + 10 * k); }
        if (o.option === 'peace') { G.influence(p, 'peace', n.id, 34 * k, 720); G.rel(p.nation, n.id).opinion += 6 * k; }
        if (o.option === 'distrust') { G.addRel(p, q, 'enemy', -30 * k); if (G.N(p.nation) && G.N(p.nation).ruler === q.id) p.plot += 12 * k; }
        if (o.option === 'temple') { const nn = G.N(p.nation); const c = nn && nn.cities.map(G.C).find(c => !c.temple); if (c) { c.temple = 1; c.faith += 15; G.fx('temple', c.x, c.y, { days: 40 }); } }
        const reaction = o.option === 'war' ? (p.role === 'ruler' ? `${p.name}は翌朝、将軍たちを集めて戦の準備を命じた。` : `${p.name}はお告げを君主に伝えると決めた。`) : o.option === 'peace' ? `${p.name}は剣を置き、使者を送る準備を始めた。` : o.option === 'distrust' ? `${p.name}は${q.name}を見る目が変わった。` : `${p.name}はただちに神殿の建設を命じた。`;
        if (o.option === 'war' && p.role !== 'ruler') { const r = G.People.ruler(G.N(p.nation)); if (r) G.influence(r, 'war', n.id, 12 * k, 540); }
        return { ok: true, text: `${G.pname(p)}は夜の祈りの中で女神の声を聞いた。${msg}——${p.name}はそれを神の意思と信じた。${reaction}`, fx: 'oracle' };
      },
      dream(t, o, k, rng) {
        const p = G.P(t.id), n = o.other && G.N(o.other);
        const ch = Go.chance('dream', t, o.str);
        const strong = rng.chance(ch);
        const kk = strong ? k : k * 0.4;
        let text;
        if (o.option === 'victory') { G.influence(p, 'war', n.id, 22 * kk, 540); p.conf = Math.min(100, p.conf + 22 * kk); text = `${G.pname(p)}は夢の中で、${G.C(n.capital).name}が炎に包まれ、自分の旗がひるがえる光景を見た。`; }
        if (o.option === 'ruin') { G.influence(p, 'fear', n.id, 26 * kk, 540); G.influence(p, 'peace', n.id, 12 * kk, 540); p.fear = Math.min(100, p.fear + 25 * kk); text = `${G.pname(p)}は、${n.short}の軍勢に自分の都が踏みにじられる悪夢にうなされた。`; }
        if (o.option === 'glory') { G.influence(p, 'ambition', null, 26 * kk, 720); p.ambition = Math.min(100, p.ambition + 6 * kk); text = `${G.pname(p)}は、自分が王冠をかぶり、人々にひざまずかれる夢を見た。`; }
        if (o.option === 'peace') { G.influence(p, 'peace', null, 22 * kk, 540); p.fear = Math.max(0, p.fear - 10); text = `${G.pname(p)}は、子どもたちが国境の川で笑いあう、静かな夢を見た。`; }
        G.remember(p, '忘れられない夢を見た。', 'dream');
        text += strong ? `目覚めた${p.name}は、その夢を何かのしるしだと感じた。` : `${p.name}は、ただの夢だと思おうとした。`;
        return { ok: strong, text, fx: 'dream' };
      },
      ambition(t, o, k) {
        const p = G.P(t.id); p.ambition = Math.min(100, p.ambition + 12 * k); G.influence(p, 'ambition', null, 20 * k, 720); p.plot += p.role === 'ruler' ? 0 : 6 * k;
        return { ok: true, text: `${G.pname(p)}の胸に、もっと大きなものを手にしたいという思いが芽生えた。` + (p.role === 'ruler' ? '近隣の国々の地図をながめる時間が増えた。' : '主君の玉座を見る目が、少し変わった。'), fx: 'whisper' };
      },
      fear(t, o, k) {
        if (t.type === 'army') { const a = G.A(t.id); a.morale = Math.max(5, a.morale - 25 * k); return { ok: true, text: `${a.name}の野営地に不吉な鳥の群れが舞った。兵たちはおびえ、士気が落ちた。`, fx: 'whisper' }; }
        const p = G.P(t.id); p.fear = Math.min(100, p.fear + 28 * k); G.influence(p, 'fear', null, 18 * k, 360); p.plot = Math.max(0, p.plot - 10 * k);
        return { ok: true, text: `${G.pname(p)}は理由のわからない不安に眠れなくなった。${G.hasTrait(p, 'brave') ? '勇敢な彼でさえ、決断をためらうようになった。' : '何をするにも慎重になった。'}`, fx: 'whisper' };
      },
      hope(t, o, k) {
        const p = G.P(t.id); p.conf = Math.min(100, p.conf + 26 * k); p.fear = Math.max(0, p.fear - 20 * k); G.influence(p, 'conf', null, 16 * k, 360); if (p.ill && k > 1) p.ill = 0;
        return { ok: true, text: `朝日をあびた${G.pname(p)}は、迷いが晴れたように感じた。「今なら何でもできる」——${p.name}はそう思った。`, fx: 'light' };
      },
      meet(t, o, k) {
        const a = G.P(t.id), b = G.P(o.other);
        const kind = G.Story.meet(a, b, true);
        if (k > 1 && kind !== 'rival') G.addRel(a, b, null, 15);
        return { ok: kind !== 'rival', text: `${G.pname(a)}と${G.pname(b)}の運命が重なった。` + (kind === 'love' ? '2人は惹かれあった。' : kind === 'friend' ? '2人は友となった。' : '…しかし2人は互いを宿敵とみなした。'), fx: 'bond' };
      },
      distrust(t, o, k) {
        const a = G.P(t.id), b = G.P(o.other);
        G.addRel(a, b, 'enemy', -35 * k); G.addRel(b, a, null, -18 * k);
        const n = G.N(a.nation); if (n && n.ruler === b.id) { a.plot += 14 * k; a.loyalty = Math.max(0, a.loyalty - 15 * k); }
        G.remember(a, `${G.pname(b)}が自分を裏切ろうとしている気がする。`, 'suspicion', { who: b.id });
        return { ok: true, text: `${G.pname(a)}の耳に、${G.pname(b)}についての小さな疑いがささやかれた。疑いは、日ごとに大きくなっていく。`, fx: 'whisper' };
      },
      rumor(t, o, k, rng) {
        const p = G.P(t.id), n = G.N(p.nation), r = n && G.People.ruler(n);
        if (o.option === 'fame') { p.fame += 25 * k; return { ok: true, text: `「${p.name}こそ真の${p.race === 'human' ? '騎士' : '戦士'}だ」——そんな噂が酒場から酒場へ広がった。`, fx: 'whisper' }; }
        if (o.option === 'shame') { p.fame = Math.max(0, p.fame - 20 * k); if (p.role === 'ruler' && n) n.stability -= 10 * k; return { ok: true, text: `${G.pname(p)}についての悪い噂が広まった。民は陰でささやきあっている。`, fx: 'whisper' }; }
        if (r && r !== p) {
          G.addRel(r, p, 'enemy', -30 * k);
          if ((G.hasTrait(r, 'cruel') || G.hasTrait(r, 'proud')) && rng.chance(0.3 * k)) {
            G.People.die(p, '謀反を疑われて処刑された');
            G.Story.record(`${G.pname(r)}が謀反の疑いで${p.name}を処刑した。`, 'execution');
            return { ok: true, text: `「${p.name}が謀反をたくらんでいる」という噂を聞いた${G.pname(r)}は、${p.name}を捕らえて処刑した。`, fx: 'whisper' };
          }
          p.plot += 10; G.addRel(p, r, 'enemy', -15);
          return { ok: true, text: `「${p.name}が謀反をたくらんでいる」——噂を聞いた${G.pname(r)}は${p.name}を遠ざけた。冷たくされた${p.name}の心も離れはじめた。`, fx: 'whisper' };
        }
        return { ok: false, text: '噂は広がらなかった。' };
      },
      hero(t, o, k) {
        const p = G.P(t.id);
        const n = G.N(p.nation);
        if (['knight', 'noble', 'general', 'exile'].includes(p.role)) { p.role = 'hero'; G.People.updateTitle(p); }
        p.heroic = true; p.martial = Math.min(99, p.martial + 18 * k); p.fame += 30 * k; p.conf = Math.min(100, p.conf + 30);
        G.remember(p, '体の奥から、知らない力があふれ出した。', 'awakening');
        if (!p.armyId && n) { const free = G.armies().find(a => a.nation === n.id && (!a.cmd || !G.P(a.cmd) || !G.P(a.cmd).alive || G.P(a.cmd).martial < p.martial - 20)); if (free) { const old = G.P(free.cmd); if (old) old.armyId = null; free.cmd = p.id; p.armyId = free.id; } }
        const inc = G.Story.open('hero', { title: `英雄${p.name}の目覚め`, nations: [p.nation], actors: [p.id], why: 'ある朝、突然。', at: G.People.where(p) });
        G.Story.close(inc, `${G.pname(p)}の剣は光をおび、${p.armyId ? G.A(p.armyId).name + 'の兵たちは' : '人々は'}奇跡だとさわいでいる。`);
        return { ok: true, text: `${G.pname(p)}が英雄の力に目覚めた。剣をふるうたびに、刃が光をおびる。`, fx: 'hero' };
      },
      life(t, o, k) {
        const p = G.P(t.id); p.life += Math.round(10 * k); p.ill = 0; p.health = 100;
        return { ok: true, text: `重い病にかかっていた${G.pname(p)}が、ある朝すっかり回復していた。医者たちは首をかしげている。`, fx: 'light' };
      },
      sickness(t, o, k, rng) {
        const p = G.P(t.id);
        if (p.blessed > G.S.day) { p.blessed = 0; return { ok: false, text: `${G.pname(p)}は高い熱を出したが、なぜか数日で回復した。`, fx: 'whisper' }; }
        p.ill = 2;
        if (rng.chance(0.12 * k + (G.ageOf(p) > p.life * 0.8 ? 0.2 : 0))) { G.People.die(p, '急な病で世を去った'); return { ok: true, text: `${G.pname(p)}は急な病に倒れ、そのまま帰らぬ人となった。`, fx: 'dark' }; }
        if (G.N(p.nation) && G.N(p.nation).ruler === p.id) G.N(p.nation).stability -= 8;
        return { ok: true, text: `${G.pname(p)}が重い病に倒れた。宮廷は不安に包まれている。`, fx: 'dark' };
      },
      protect(t, o, k) {
        if (t.type === 'army') { const a = G.A(t.id); a.blessed = G.S.day + Math.round(120 * k); a.morale = Math.min(100, a.morale + 10); return { ok: true, text: `${a.name}の旗に、朝の光がやどった。兵たちは「女神が見ておられる」とささやきあった。`, fx: 'bless' }; }
        const p = G.P(t.id); p.blessed = G.S.day + Math.round(360 * k);
        return { ok: true, text: `${G.pname(p)}は気づかないうちに、見えない光に守られるようになった。`, fx: 'bless' };
      },
      harvest(t, o, k) {
        const list = Go.cityList(t, 6);
        for (const c of list) { c.harvest = Math.round(6 * k); c.faith = Math.min(100, c.faith + 6 * k); c.famine = 0; }
        const n = t.type === 'nation' ? G.N(t.id) : G.N(list[0] && list[0].owner);
        if (n && t.type === 'nation') n.stability = Math.min(100, n.stability + 6);
        return { ok: true, text: `${t.type === 'nation' ? G.nname(n) + 'の畑' : list.map(c => c.name).join('・') + 'の畑'}が黄金色に実った。人々は${n ? G.FAITH[n.race].god : '女神'}に感謝の祈りをささげた。`, fx: 'harvest' };
      },
      plague(t, o, k) {
        const list = Go.cityList(t, 4).sort((a, b) => b.pop - a.pop).slice(0, t.type === 'nation' ? 1 + (k > 1 ? 1 : 0) : 1);
        if (!list.length) return { ok: false, text: '近くに町がない。' };
        for (const c of list) { const inc = G.Story.plague(c, true); c.plague = Math.round(c.plague * k); }
        return { ok: true, text: `${list.map(c => c.name).join('・')}で、原因のわからない病が広がりはじめた。人々は神殿に集まり、救いを祈っている。`, fx: 'plague', nofx: true };
      },
      arms(t, o, k) {
        const n = G.N(t.id); n.arms = G.S.day + Math.round(360 * k); n.treasury += 150 * k;
        for (const a of G.armies()) if (a.nation === n.id) a.q *= 1 + 0.08 * k;
        return { ok: true, text: `${G.nname(n)}の鍛冶場で、炉の火がかつてないほど強く燃えた。名剣が次々と打たれ、兵が集まりはじめた。`, fx: 'forge' };
      },
      sour(t, o, k) {
        const a = G.N(t.id), b = G.N(o.other);
        if (!G.rel(a.id, b.id).border) { const r = G.rel(a.id, b.id); r.opinion -= 20 * k; r.tension += 10 * k; return { ok: true, text: `${G.nname(a)}の使節が${G.nname(b)}で侮辱を受けたという話が広まった。両国の関係は冷えこんだ。`, fx: 'whisper' }; }
        const c = G.Nations.frontCity(b, [a]);
        const r = G.rel(a.id, b.id); r.tension = Math.min(100, r.tension + 20 * k); r.opinion -= 15 * k;
        if (G.atWar(a.id, b.id)) return { ok: true, text: `${G.nname(a)}と${G.nname(b)}の憎しみが、さらに深まった。`, fx: 'whisper' };
        G.S.cd['clash:' + G.relKey(a.id, b.id)] = 0;
        const inc = c && G.Story.event('border_clash', { a: a.id, b: b.id, city: c.id, goddess: true });
        return { ok: true, text: `${c ? c.name : '国境'}の近くで、${G.nname(a)}と${G.nname(b)}の見回り兵が衝突した。誰が先に矢を放ったのか、誰にもわからない。`, fx: 'clash', nofx: true };
      },
      mend(t, o, k) {
        const a = G.N(t.id), b = G.N(o.other);
        const r = G.rel(a.id, b.id); r.opinion += 22 * k; r.tension = Math.max(0, r.tension - 20 * k);
        for (const n of [a, b]) { const ru = G.People.ruler(n); if (ru) G.influence(ru, 'peace', n === a ? b.id : a.id, 18 * k, 540); }
        return { ok: true, text: `${G.nname(a)}と${G.nname(b)}の商人たちが、国境の市で手を取りあった。小さな交流が、2国のあいだの氷を少しとかした。`, fx: 'bond' };
      },
      unrest(t, o, k) {
        const list = Go.cityList(t, 3).filter(c => G.N(c.owner)).sort((a, b) => b.unrest - a.unrest).slice(0, 1);
        if (!list.length) return { ok: false, text: '町がない。' };
        const c = list[0]; c.unrest = Math.min(100, c.unrest + 32 * k);
        return { ok: true, text: `${c.name}の広場で、税に抗議する声があがった。誰かが投げた石をきっかけに、町は不穏な空気に包まれている。`, fx: 'unrest' };
      },
      tech(t, o, k) {
        const n = G.N(t.id); n.tech = Math.min(6, n.tech + 0.5 * k);
        for (const a of G.armies()) if (a.nation === n.id) a.q *= 1 + 0.04 * k;
        return { ok: true, text: `${G.nname(n)}の学者が、眠れない夜に新しい${n.race === 'human' ? '鍛鉄法' : '魔術の式'}を思いついた。国の技術が一歩進んだ。`, fx: 'light' };
      },
      faith(t, o, k) {
        const list = Go.cityList(t, 5);
        for (const c of list) c.faith = Math.min(100, c.faith + 14 * k);
        const nt = list.find(c => !c.temple); if (nt && k >= 1) { nt.temple = 1; G.fx('temple', nt.x, nt.y, { days: 40 }); }
        return { ok: true, text: `「女神が奇跡を起こした」という話が広まり、${list.length > 1 ? '各地の' : list[0].name + 'の'}神殿に人々が集まった。${nt && k >= 1 ? nt.name + 'には新しい神殿が建てられた。' : ''}`, fx: 'light' };
      },
      heal(t, o, k) {
        const c = G.C(t.id); const had = c.plague || c.famine; c.plague = 0; c.famine = 0; c.faith = Math.min(100, c.faith + (had ? 20 : 8) * k); c.unrest = Math.max(0, c.unrest - 15 * k);
        const inc = G.vals(G.S.incidents).find(i => i.type === 'plague' && i.status === 'active' && i.data.city === c.id);
        if (inc) G.Story.close(inc, `ある朝、${c.name}をやわらかな光が包み、病人たちが起き上がった。人々は女神の奇跡だと涙を流した。`);
        G.S.fx = G.S.fx.filter(f => !(f.type === 'plague' && f.city === c.id));
        return { ok: true, text: had ? `${c.name}をやわらかな光が包み、病がおさまった。人々の信仰はいっそう深まった。` : `${c.name}の人々の傷がいえた。`, fx: 'light' };
      },
      quake(t, o, k) {
        const list = Go.cityList(t, 4).slice(0, 1); if (!list.length) return { ok: false, text: '近くに町がない。' };
        const c = list[0]; c.walls = Math.max(0, c.walls - 40 * k); c.pop *= 1 - 0.05 * k; c.unrest += 10; c.faith += 8; c.garrison *= 1 - 0.15 * k;
        return { ok: true, text: `${c.name}の大地が揺れた。城壁の一部がくずれ落ち、人々は女神の怒りをおそれて祈った。`, fx: 'quake' };
      },
      ward(t, o, k) {
        const c = G.C(t.id); c.ward = G.S.day + Math.round(360 * k); c.garrison *= 1.25; c.walls = Math.min(100, c.walls + 20 * k);
        return { ok: true, text: `${c.name}の城壁が、月の光のようにかすかに輝くようになった。守備兵たちは勇気づけられた。`, fx: 'bless' };
      },
      storm(t, o, k) {
        const at = Go.where(t);
        G.S.weather = (G.S.weather || []).filter(w => w.until > G.S.day);
        G.S.weather.push({ x: at.x, y: at.y, r: 7, until: G.S.day + Math.round(30 * k), type: 'storm' });
        for (const a of G.armies()) if (Math.hypot(a.x - at.x, a.y - at.y) < 7) { a.storm = G.S.day + Math.round(30 * k); a.supply -= 10 * k; }
        for (const b of G.vals(G.S.battles)) if (!b.over && Math.hypot(b.x - at.x, b.y - at.y) < 7) b.weather = 'rain';
        return { ok: true, text: `${G.War.placeName(at.x, at.y)}に、季節はずれの嵐が吹き荒れた。道はぬかるみ、軍は進めなくなった。`, fx: 'storm', nofx: true };
      },
      meteor(t, o, k, rng) {
        const at = Go.where(t);
        let hit = 0; const names = [];
        for (const a of G.armies()) if (Math.hypot(a.x - at.x, a.y - at.y) < 2.6) {
          const loss = a.men * 0.28 * k; a.men -= loss; a.morale = Math.max(5, a.morale - 30); hit += loss; names.push(a.name);
          const c = G.P(a.cmd); if (c && rng.chance(0.1 * k) && !(c.blessed > G.S.day)) G.People.die(c, '天から落ちた星に打たれて死んだ');
          if (a.men < 200) G.War.disband(a, '星');
        }
        G.fx('meteor', at.x, at.y, { days: 20 });
        return { ok: true, text: hit ? `夜空を裂いて、燃える星が${names.join('・')}の上に落ちた。${G.fmt(hit)}人が倒れた。生き残った兵は「天罰だ」とふるえている。` : `${G.War.placeName(at.x, at.y)}に燃える星が落ち、大地に大きな穴があいた。`, fx: 'meteor', nofx: true };
      },
      miracle(t, o, k) {
        const at = Go.where(t);
        let n = 0;
        for (const c of G.cities()) if (Math.hypot(c.x - at.x, c.y - at.y) < 12) { c.faith = Math.min(100, c.faith + 18 * k); c.unrest = Math.max(0, c.unrest - 5); n++; }
        return { ok: true, text: `${G.War.placeName(at.x, at.y)}の空に、光の柱が立った。見た者たちはひざまずき、女神の名をとなえた。(${n}つの町の信仰が深まった)`, fx: 'pillar' };
      },
      morale(t, o, k) {
        const a = G.A(t.id); a.morale = Math.min(100, a.morale + 25 * k);
        return { ok: true, text: `${a.name}の兵たちの前に、白い鹿があらわれて消えた。「吉兆だ」——兵たちの目に力がもどった。`, fx: 'bless' };
      },
      lost(t, o, k) {
        const a = G.A(t.id); a.lost = G.S.day + Math.round(30 * k);
        return { ok: true, text: `${a.name}を深い霧が包んだ。案内人は道を見失い、軍は同じ場所をさまよいはじめた。`, fx: 'fog' };
      },
      revel(t, o, k) {
        const a = G.A(t.id), c = G.P(a.cmd); a.revel = G.S.day + Math.round(90 * k);
        if (c) { c.conf = Math.min(100, c.conf + 15); G.remember(c, '夢の中で、敵を打ち破る陣形がひらめいた。', 'oracle'); }
        return { ok: true, text: `${c ? G.pname(c) : '指揮官'}は夢の中で、敵を打ち破る陣形を見た。目覚めるとすぐ、隊の並びを変えるよう命じた。`, fx: 'light' };
      }
    },
    cityList(t, r) {
      if (t.type === 'city') return [G.C(t.id)];
      if (t.type === 'nation') return G.N(t.id).cities.map(G.C);
      if (t.type === 'place') return G.cities().filter(c => Math.hypot(c.x - t.x, c.y - t.y) < r).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y));
      return [];
    },

    // ---- 戦場で使う力(会戦の画面) ----
    battlePower(b, key, side) {
      const g = G.S.goddess, cost = { bless: 16, weather: 12, revel: 14, meteor: 26, hero: 30 }[key];
      if (g.power < cost) return { ok: false, text: '神力が足りない。' };
      g.power -= cost; g.acts++;
      const s = b.s[side], a = G.A(s.armies[0]), c = a && G.P(a.cmd);
      let text = '';
      if (key === 'bless') { b.bless[side] = (b.bless[side] || 0) + 0.35; for (const id of s.armies) { const x = G.A(id); if (x) x.morale = Math.min(100, x.morale + 12); } text = `${G.nname(G.N(s.nation))}軍の頭上に光が差した。兵たちは恐れを忘れて前へ進む。`; }
      if (key === 'weather') { b.weather = b.weather === 'rain' ? 'fog' : 'rain'; b.rainHurts = 1 - side; text = b.weather === 'rain' ? '空がにわかに暗くなり、激しい雨が降りはじめた。騎兵の足が止まる。' : '濃い霧が戦場をおおった。攻める側は敵の位置を見失った。'; }
      if (key === 'revel') { if (a) a.revel = G.S.day + 60; if (c) G.remember(c, '戦いのさなか、敵陣の弱点がはっきり見えた。', 'oracle'); text = `${c ? G.pname(c) : '指揮官'}の目に、敵陣の弱いところが光って見えた。「左翼を突け！」`; }
      if (key === 'meteor') { const o = b.s[1 - side]; let hit = 0; for (const id of o.armies) { const x = G.A(id); if (x) { const l = x.men * 0.2; x.men -= l; x.morale -= 25; hit += l; } } o.cas += hit; text = `燃える星が${G.nname(G.N(o.nation))}軍の真ん中に落ちた。${G.fmt(hit)}人が吹き飛び、陣形がくずれた。`; }
      if (key === 'hero') {
        const cand = s.armies.map(G.A).filter(Boolean).map(x => G.P(x.cmd)).filter(p => p && p.alive)[0];
        if (cand) { cand.heroic = true; cand.martial = Math.min(99, cand.martial + 20); cand.fame += 30; if (['general', 'knight', 'noble'].includes(cand.role)) { cand.role = 'hero'; G.People.updateTitle(cand); } b.bless[side] = (b.bless[side] || 0) + 0.25; text = `乱戦のなか、${G.pname(cand)}の剣が光を放った。英雄の力に目覚めた${cand.name}が、ひとりで敵陣を切り開く！`; G.remember(cand, `${b.name}で、体の奥から力があふれた。`, 'awakening'); }
        else text = '目覚めるべき者がいなかった。';
      }
      G.War.blog(b, `【女神】${text}`, 'goddess');
      G.S.goddess.history.push({ d: G.S.day, key: 'battle_' + key, t: text });
      return { ok: true, text };
    },

    // ---- 長期計画 ----
    newPlan(key, target, other) {
      const P = G.PLANS[key], g = G.S.goddess;
      if (g.plans.filter(p => p.status === 'active').length >= 3) return { ok: false, text: '同時に進められる計画は3つまで。' };
      const pl = { id: G.newId('pl'), key, target, other: other || null, start: G.S.day, deadline: G.S.day + P.years * 360, status: 'active', progress: 0, log: [] };
      const pv = Go.planProgress(pl);
      if (pv === null) return { ok: false, text: 'この相手には立てられない計画です。' };
      if (pv >= 1) return { ok: false, text: 'すでに達成されている。' };
      pl.progress = pv;
      g.plans.push(pl);
      return { ok: true, plan: pl, text: `計画「${Go.planTitle(pl)}」を始めた。` };
    },
    planTitle(pl) {
      const t = G.P(pl.target) || G.N(pl.target), o = pl.other && (G.P(pl.other) || G.N(pl.other));
      const nm = x => x ? (x.short ? G.nname(x) : G.pname(x)) : '?';
      return { invade: `${nm(t)}に${nm(o)}への侵攻を決断させる`, breakpeace: `${nm(t)}と${nm(o)}を戦わせる`, makepeace: `${nm(t)}と${nm(o)}に和平を結ばせる`, crown: `${nm(t)}を君主にする`, makehero: `${nm(t)}を英雄に育てる`, split: `${nm(t)}を分裂させる`, bond: `${nm(t)}と${nm(o)}を結びつける` }[pl.key];
    },
    // 0〜1。null=立てられない
    planProgress(pl) {
      const p = G.P(pl.target), n = G.N(pl.target), o = pl.other && (G.P(pl.other) || G.N(pl.other));
      switch (pl.key) {
        case 'invade': {
          if (!p || !p.alive || p.role !== 'ruler' || !o) return null;
          const me = G.N(p.nation); if (G.atWar(me.id, o.id)) { const w = G.Nations.warBetween(me.id, o.id); return w && w.start >= pl.start && w.a.includes(me.id) ? 1 : 0.99; }
          return G.clamp(G.Nations.warDesire(me, o) / 56, 0, 0.98);
        }
        case 'breakpeace': if (!n || !o) return null; if (G.atWar(n.id, o.id)) return 1; return G.clamp(Math.max(G.Nations.warDesire(n, o), G.Nations.warDesire(o, n)) / 56, 0, 0.98);
        case 'makepeace': if (!n || !o) return null; if (!G.atWar(n.id, o.id)) return pl.progress > 0 ? 1 : null; return G.clamp(Math.min(G.Nations.peaceDesire(n, o), G.Nations.peaceDesire(o, n)) / 50, 0, 0.98);
        case 'crown': if (!p || !p.alive) return null; if (p.role === 'ruler') return 1; return G.clamp(Math.max(p.plot / 85, G.People.heirs(G.N(p.nation) || {}).indexOf(p) === 0 ? 0.6 : 0), 0, 0.98);
        case 'makehero': if (!p || !p.alive) return null; if ((p.role === 'hero' || p.heroic) && p.fame >= 60) return 1; return G.clamp(((p.role === 'hero' || p.heroic) ? 0.5 : 0) + p.fame / 130, 0, 0.98);
        case 'split': if (!n) return null; if (G.vals(G.S.nations).some(m => m.parent === n.id && m.founded >= G.CFG.START_YEAR + Math.floor(pl.start / 360))) return 1; return G.clamp(Math.max(0, ...G.chars().filter(q => q.nation === n.id).map(q => q.plot)) / 85, 0, 0.98);
        case 'bond': { if (!p || !p.alive || !o || !o.alive) return null; const r = p.rel[o.id]; if (r && ['friend', 'love', 'debt', 'spouse'].includes(r.k) && r.v >= 60) return 1; return G.clamp(r ? Math.max(0, r.v) / 60 : 0, 0, 0.98); }
      }
      return null;
    },
    planTips(pl) {
      const t = pl.target, o = pl.other;
      const p = G.P(t);
      switch (pl.key) {
        case 'invade': return [['dream', { type: 'person', id: t }, { option: 'victory', other: o }], ['oracle', { type: 'person', id: t }, { option: 'war', other: o }], ['hope', { type: 'person', id: t }, {}], ['sour', { type: 'nation', id: p && p.nation }, { other: o }], ['arms', { type: 'nation', id: p && p.nation }, {}]];
        case 'breakpeace': return [['sour', { type: 'nation', id: t }, { other: o }], ['ambition', { type: 'person', id: G.N(t) && G.N(t).ruler }, {}], ['dream', { type: 'person', id: G.N(t) && G.N(t).ruler }, { option: 'victory', other: o }]];
        case 'makepeace': return [['mend', { type: 'nation', id: t }, { other: o }], ['oracle', { type: 'person', id: G.N(t) && G.N(t).ruler }, { option: 'peace', other: o }], ['dream', { type: 'person', id: G.N(o) && G.N(o).ruler }, { option: 'ruin', other: t }]];
        case 'crown': return [['ambition', { type: 'person', id: t }, {}], ['dream', { type: 'person', id: t }, { option: 'glory' }], ['rumor', { type: 'person', id: p && G.N(p.nation) && G.N(p.nation).ruler }, { option: 'shame' }], ['sickness', { type: 'person', id: p && G.N(p.nation) && G.N(p.nation).ruler }, {}]];
        case 'makehero': return [['hero', { type: 'person', id: t }, {}], ['rumor', { type: 'person', id: t }, { option: 'fame' }], ['protect', { type: 'person', id: t }, {}]];
        case 'split': return [['unrest', { type: 'nation', id: t }, {}], ['rumor', { type: 'person', id: G.N(t) && G.N(t).ruler }, { option: 'shame' }], ['plague', { type: 'nation', id: t }, {}]];
        case 'bond': return [['meet', { type: 'person', id: t }, { other: o }], ['hope', { type: 'person', id: t }, {}]];
      }
      return [];
    },
    plansCheck() {
      const g = G.S.goddess;
      for (const pl of g.plans) {
        if (pl.status !== 'active') continue;
        const v = Go.planProgress(pl);
        if (v === null) { pl.status = 'fail'; pl.end = G.S.day; pl.why = '対象が失われた'; G.news(`【計画失敗】${Go.planTitle(pl)}(対象が失われた)`, { k: 'goddess', imp: 2 }); G.emit('plan', pl); continue; }
        pl.progress = v;
        if (v >= 1) { pl.status = 'success'; pl.end = G.S.day; g.power = Math.min(Go.MAX, g.power + G.PLANS[pl.key].reward); G.news(`【計画成功】${Go.planTitle(pl)}。信仰の高まりで神力+${G.PLANS[pl.key].reward}`, { k: 'goddess', imp: 3 }); G.emit('plan', pl); }
        else if (G.S.day > pl.deadline) { pl.status = 'fail'; pl.end = G.S.day; pl.why = '期限切れ'; G.news(`【計画失敗】${Go.planTitle(pl)}(期限切れ)`, { k: 'goddess', imp: 2 }); G.emit('plan', pl); }
      }
    }
  };
  G.Goddess = Go;
})(globalThis.GD = globalThis.GD || {});
