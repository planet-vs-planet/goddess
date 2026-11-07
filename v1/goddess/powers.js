// 女神の介入: 神の奇跡(人族)・邪神の囁き(魔族)・運命の操作(両方)
// 1か月に1回。信仰を使う。女神のレベルで強い介入が解放される。
(function (G) {
  const W = G.World, C = G.Chars;
  const F = () => G.Factions;

  function aware(v) { const g = W.S.goddess; g.awareness = G.clamp(g.awareness + v, 0, 100); g.used++; }
  function strongest(side) { return F().nationsOf(side).sort((a, b) => W.nationPop(b.id) - W.nationPop(a.id))[0] || null; }
  // いちばん危ない(敵に近く、押されている)国
  function frontline(side) {
    const ns = F().nationsOf(side); if (!ns.length) return null;
    return ns.map(n => ({ n, s: W.enemiesOf(n.id).length * 2 + (W.citiesOf(n.id).some(c => c.conquered && W.S.day - c.conquered < 720) ? 3 : 0) + W.neighbors(n.id).filter(m => F().side(m) !== side).length + W.rng.next() }))
      .sort((a, b) => b.s - a.s)[0].n;
  }
  function addThanks(v) { W.S.thanks = (W.S.thanks || 0) + v; }
  function capOf(n) { return W.capitalOf(n.id); }

  const CATS = {
    miracle: { name: '神の奇跡', sub: '人族に希望を', color: '#e8c96a', side: 'h' },
    whisper: { name: '邪神の囁き', sub: '魔族に力を', color: '#b36ad8', side: 'd' },
    fate: { name: '運命の操作', sub: '両者を争わせる', color: '#7fa6c9', side: null }
  };

  const LIST = [
    // ---------- 神の奇跡(人族) ----------
    {
      key: 'bless_army', cat: 'miracle', name: '光の加護', cost: 12, lv: 1, sus: 0,
      desc: '人族の全軍に女神の光をそそぐ。人族の戦力が1年間1.25倍になる。',
      apply() {
        F().addBuff('h', 1.25, 360, '光の加護'); addThanks(3);
        for (const a of Object.values(W.S.armies)) if (F().side(a.nation) === 'h') { a.morale = 1; W.effect('miracle', a.x, a.y); }
        W.log('goddess', '神の奇跡「光の加護」', '戦場の人族の兵たちを、まばゆい光がつつんだ。「女神さまが見ていてくださる!」兵たちは涙を流して剣をにぎった。', { imp: 2 });
        return true;
      }
    },
    {
      key: 'harvest', cat: 'miracle', name: '豊穣の恵み', cost: 8, lv: 1, sus: 0,
      desc: '人族の都市を2年間ゆたかにする。人口が増え、兵が集まりやすくなる。信仰も少し増える。',
      apply() {
        for (const c of F().citiesOf('h')) { c.mods.harvest = W.S.day + 720; c.mods.drought = 0; c.faith = Math.min(1, (c.faith || 0) + 0.05); }
        for (const n of F().nationsOf('h')) n.manpower *= 1.1;
        addThanks(4);
        const n = strongest('h'); if (n) W.effect('harvest', capOf(n).x, capOf(n).y);
        W.log('goddess', '神の奇跡「豊穣の恵み」', '人族の畑が黄金色に実った。人々は女神に感謝の祈りをささげた。', { imp: 1 });
        return true;
      }
    },
    {
      key: 'hero', cat: 'miracle', name: '勇者の誕生', cost: 28, lv: 2, sus: 1,
      desc: '人族に女神の声を聞いた勇者を生み出す。勇者は軍を率いて大きな戦果をあげる。',
      apply() {
        const n = frontline('h'); if (!n) return false;
        const h = G.Events.makeHero(n, true);
        h.st.fai = Math.min(100, h.st.fai + 30); h.blessed = true; h.st.war = Math.min(100, h.st.war + 10);
        C.remember(h, '女神の声を聞き、勇者として目覚めた');
        if (G.Story) G.Story.setHero(h.id);
        addThanks(6);
        W.effect('hero', capOf(n).x, capOf(n).y);
        W.log('goddess', '勇者の誕生', `${n.name}の${h.name}が女神の声を聞き、勇者として目覚めた。「魔王を倒し、世界に平和を!」`, { n: [n.id], c: [h.id], x: capOf(n).x, y: capOf(n).y, imp: 3, memory: false });
        return true;
      }
    },
    {
      key: 'holy_sword', cat: 'miracle', name: '聖剣の発見', cost: 22, lv: 2, sus: 1,
      desc: '人族の勇者か将軍に聖剣をさずける。その者が率いる軍はとても強くなる。',
      apply() {
        const cs = Object.values(W.S.chars).filter(c => c.alive && F().side(c.nation) === 'h' && ['hero', 'general', 'ruler'].includes(c.role) && c.item !== '聖剣アストレア');
        if (!cs.length) return false;
        const c = cs.sort((a, b) => (b.role === 'hero') - (a.role === 'hero') || b.st.war - a.st.war)[0];
        c.item = '聖剣アストレア'; c.st.war = Math.min(100, c.st.war + 20); c.fame += 20;
        F().addBuff('h', 1.08, 720, '聖剣');
        addThanks(4);
        W.log('goddess', '聖剣の発見', `${c.name}は湖の底で光る聖剣アストレアを見つけた。人族はふるい立った。`, { n: [c.nation], c: [c.id], imp: 2 });
        return true;
      }
    },
    {
      key: 'great_miracle', cat: 'miracle', name: '天使の軍勢', cost: 60, lv: 4, sus: 2,
      desc: '天使を地上に降ろす。人族の戦力が1年間1.6倍になり、すべての人族の都市の信仰が高まる。',
      apply() {
        F().addBuff('h', 1.6, 360, '天使の軍勢'); addThanks(12);
        for (const c of F().citiesOf('h')) c.faith = Math.min(1, (c.faith || 0) + 0.15);
        const n = strongest('h'); if (n) W.effect('bless', capOf(n).x, capOf(n).y, { r: 12 });
        W.log('goddess', '天使の降臨', '空が裂け、光の翼を持つ天使たちが人族の軍に加わった。人族は女神こそ唯一の救いだと信じた。', { imp: 3 });
        return true;
      }
    },
    // ---------- 邪神の囁き(魔族) ----------
    {
      key: 'empower_lord', cat: 'whisper', name: '魔王への力', cost: 12, lv: 1, sus: 4,
      desc: '魔王にひそかに力をさずける。魔族の戦力が1年間1.25倍になる。疑念が少し増える。',
      apply() {
        F().addBuff('d', 1.25, 360, '魔王への力');
        const n = strongest('d'); if (!n) return false;
        const lord = W.liveChar(n.ruler); if (lord) { lord.st.war = Math.min(100, lord.st.war + 8); C.remember(lord, '夢の中で「声」から力を授かった'); }
        W.effect('monster', capOf(n).x, capOf(n).y);
        W.log('goddess', '邪神の囁き「魔王への力」', `${lord ? lord.name : '魔王'}は夢の中で、だれかの声を聞いた。「戦いなさい。力をあげるわ」目覚めると、体に力があふれていた。`, { n: [n.id], c: lord ? [lord.id] : [], imp: 2, memory: false });
        return true;
      }
    },
    {
      key: 'horde', cat: 'whisper', name: '魔物の軍勢', cost: 16, lv: 1, sus: 5,
      desc: '人族の国境の近くに魔物の大軍をわかせる。魔族の軍として人族の都市を襲う。',
      apply() {
        const dn = frontline('d'); if (!dn) return false;
        const myC = W.citiesOf(dn.id);
        const target = F().citiesOf('h').sort((a, b) => Math.min(...myC.map(c => W.distCities(a, c))) - Math.min(...myC.map(c => W.distCities(b, c))))[0];
        const base = myC.sort((a, b) => W.distCities(a, target) - W.distCities(b, target))[0];
        if (!base) return false;
        const size = 700 + W.S.goddess.level * 260;
        const a = G.Armies.raise(dn, base, Math.min(size, 99999));
        if (!a) return false;
        a.troops = { m_hrd: size * 0.7, d_bst: size * 0.3 }; G.Armies.recount(a); a.start = a.total; a.morale = 1;
        dn.manpower += size; // 兵を減らさない(魔物は女神がつくる)
        if (target) G.Armies.setTarget(a, target.x, target.y, { type: 'city', id: target.id });
        W.effect('monster', base.x, base.y);
        W.log('goddess', '邪神の囁き「魔物の軍勢」', `${base.name}の近くの闇から、${G.fmt(a.total)}体の魔物があふれ出し、${target ? target.name + 'へ向かった' : '人族の地へ向かった'}。`, { n: [dn.id], x: base.x, y: base.y, imp: 2 });
        return true;
      }
    },
    {
      key: 'forbidden', cat: 'whisper', name: '禁断の魔法', cost: 18, lv: 2, sus: 5,
      desc: '魔族に禁じられた魔法を教える。魔族の技術が上がり、魔術師が強くなる(2年間1.15倍)。',
      apply() {
        for (const n of F().nationsOf('d')) n.tech += 1;
        F().addBuff('d', 1.15, 720, '禁断の魔法');
        const n = strongest('d'); if (n) W.effect('monster', capOf(n).x, capOf(n).y);
        W.log('goddess', '邪神の囁き「禁断の魔法」', '魔族の魔術師たちの前に、だれも知らない古い魔法書があらわれた。その表紙には、光の輪の紋章がきざまれていた……。', { imp: 2 });
        return true;
      }
    },
    {
      key: 'demon_general', cat: 'whisper', name: '新たな魔将', cost: 10, lv: 1, sus: 3,
      desc: '魔族に強い将軍を生み出す。魔族の軍が賢く戦えるようになる。',
      apply() {
        const n = frontline('d'); if (!n) return false;
        const g = C.spawnNotable(n.id, 'general');
        g.st.war = Math.min(100, g.st.war + 25); g.st.int = Math.min(100, g.st.int + 15); g.fame += 20;
        C.remember(g, '闇の声に導かれ、魔将となった');
        W.log('goddess', '新たな魔将', `${n.name}に、闇の声に導かれた魔将${g.name}があらわれた。`, { n: [n.id], c: [g.id], imp: 2, memory: false });
        return true;
      }
    },
    {
      key: 'awaken_lord', cat: 'whisper', name: '魔王の覚醒', cost: 55, lv: 4, sus: 10,
      desc: '魔王を真の姿に目覚めさせる。魔族の戦力が2年間1.5倍。ただし疑念が大きく増える。',
      apply() {
        const n = strongest('d'); if (!n) return false;
        const lord = W.liveChar(n.ruler);
        F().addBuff('d', 1.5, 720, '魔王の覚醒');
        if (lord) { lord.st.war = 100; lord.life += 200; lord.fame += 40; if (G.Story) G.Story.setLord(lord.id); C.remember(lord, '真の魔王として覚醒した'); }
        W.effect('monster', capOf(n).x, capOf(n).y, { r: 12 });
        W.log('goddess', '魔王の覚醒', `${lord ? lord.name : '魔王'}の体から黒い光がほとばしり、真の魔王として覚醒した。その額には、光の輪の紋章がうかんでいた。`, { n: [n.id], c: lord ? [lord.id] : [], imp: 3, memory: false });
        return true;
      }
    },
    // ---------- 運命の操作(両方) ----------
    {
      key: 'prophecy', cat: 'fate', name: '偽りの予言', cost: 8, lv: 1, sus: 2,
      desc: '「今こそ攻めよ」という偽りの予言を流す。えらんだ陣営が大攻勢に出る。',
      choose: [{ v: 'h', t: '人族を攻めさせる' }, { v: 'd', t: '魔族を攻めさせる' }],
      apply(side) {
        const ns = F().nationsOf(side); if (!ns.length) return false;
        for (const n of ns) { n.manpower *= 1.15; n.weariness = Math.max(0, n.weariness - 15); }
        F().addBuff(side, 1.1, 120, '偽りの予言');
        W.log('goddess', '偽りの予言', side === 'h' ? '人族の神殿に「今こそ魔族を討て。勝利は約束されている」という予言が下った。人族は大攻勢に出た。' : '魔族の祭壇に「人族の守りは今、弱っている」というお告げが届いた。魔族は大攻勢に出た。', { imp: 2 });
        for (const n of ns) G.Armies.warAI(n);
        return true;
      }
    },
    {
      key: 'clash', cat: 'fate', name: '衝突の導き', cost: 6, lv: 1, sus: 1,
      desc: '両陣営の軍を引きよせ、大きな戦いを起こす。たくさんの祈りが生まれる。',
      apply() {
        let made = 0;
        for (const side of ['h', 'd']) for (const n of F().nationsOf(side)) {
          if (Object.values(W.S.armies).filter(a => a.nation === n.id).length >= 2) continue;
          const cap = capOf(n); if (!cap) continue;
          const a = G.Armies.raise(n, cap, n.manpower * 0.4); if (a) made++;
        }
        for (const n of W.aliveNations()) G.Armies.warAI(n);
        W.S.prayer = (W.S.prayer || 0) + 6;
        W.log('goddess', '衝突の導き', `運命の糸がたぐりよせられ、両陣営の軍が戦場へ向かった(新たに${made}つの軍が出陣)。`, { imp: 1 });
        return true;
      }
    },
    {
      key: 'discord', cat: 'fate', name: '指導者の対立', cost: 12, lv: 2, sus: 2,
      desc: '人族と魔族の王たちの心に憎しみを植える。3年間、和平の話し合いが起こらなくなる。',
      apply() {
        W.S.peaceBlockUntil = Math.max(W.S.peaceBlockUntil || 0, W.S.day + 360 * 3);
        const hr = (strongest('h') || {}).ruler, dr = (strongest('d') || {}).ruler;
        const a = W.liveChar(hr), b = W.liveChar(dr);
        if (a && b) { C.relAdd(a, b, 'h', 60, '仇敵'); C.relAdd(b, a, 'h', 60, '仇敵'); }
        W.log('goddess', '指導者の対立', `${a ? a.name : '人族の王'}と${b ? b.name : '魔王'}は、たがいに相手が自分の家族を殺したという夢を見た。二人の憎しみは消えないものになった。`, { c: [hr, dr].filter(x => x != null), imp: 2 });
        return true;
      }
    },
    {
      key: 'sabotage', cat: 'fate', name: '和平の妨害', cost: 14, lv: 1, sus: 3,
      desc: '進んでいる和平交渉をこわす。和平が成立すると戦争が終わってしまうので、そのときに使う。',
      need: () => !!W.S.peace, needText: '和平交渉が起きているときだけ使える',
      apply() {
        return F().breakPeace('和平の使者が、だれかの手で殺された。人族は魔族を、魔族は人族を疑った。和平交渉は決裂し、憎しみは前よりも深くなった。');
      }
    },
    {
      key: 'calamity', cat: 'fate', name: '天災', cost: 25, lv: 3, sus: 3,
      desc: '地図でえらんだ場所に大地震と嵐を起こす。その場所の都市と軍に大きな被害。勝ちすぎた側を止めるのに使える。',
      target: 'point',
      apply(pt) {
        const R = 7, hitC = [], hitA = [];
        for (const c of W.S.cities) if (Math.hypot(c.x - pt.x, c.y - pt.y) < R) { c.pop *= W.rng.range(0.72, 0.85); hitC.push(c); c.unrest = Math.min(100, c.unrest + 12); }
        for (const a of Object.values(W.S.armies)) if (Math.hypot(a.x - pt.x, a.y - pt.y) < R) { for (const k in a.troops) a.troops[k] *= 0.55; G.Armies.recount(a); a.morale = Math.max(0, a.morale - 0.35); hitA.push(a); }
        W.effect('disaster', pt.x, pt.y, { r: R });
        W.S.prayer = (W.S.prayer || 0) + 5;
        W.log('goddess', '天災', `大地がさけ、嵐がふきあれた。${hitC.length ? hitC.map(c => c.name).join('・') + 'が被害を受けた。' : ''}${hitA.length ? hitA.length + 'つの軍が大きな損害を出した。' : ''}`, { x: pt.x, y: pt.y, imp: 2 });
        return true;
      }
    },
    {
      key: 'memory', cat: 'fate', name: '記憶の改ざん', cost: 45, lv: 3, sus: -35,
      desc: '人々の記憶を書きかえ、女神への疑念を大きく減らす。真実に近づいた者たちを忘れさせる。',
      apply() {
        const S = W.S;
        if (S.revolt && S.revolt.active) S.revolt.v = Math.max(0, S.revolt.v - 30);
        W.log('goddess', '記憶の改ざん', '世界中の人々が、同じ夜に同じ夢を見た。目覚めたとき、女神を疑っていたことを、だれも思い出せなかった。', { imp: 2 });
        return true;
      }
    }
  ];

  const P = {
    CATS, list: LIST,
    get(key) { return LIST.find(p => p.key === key); },
    ofCat(cat) { return LIST.filter(p => p.cat === cat); },
    costOf(p) { return W.S.tutorial ? 0 : p.cost; },
    usedThisMonth() { const S = W.S; return !S.tutorial && S.goddess.usedMonth === W.month(); },
    // 使えるかどうかと、その理由
    check(p) {
      const g = W.S.goddess;
      if (g.slain) return '女神はもういない';
      if (W.S.ended && W.S.ended.final) return 'この世界の物語は終わった';
      if (p.lv > g.level) return `女神Lv${p.lv}で解放`;
      if (P.usedThisMonth()) return '介入は1か月に1回まで';
      if (p.need && !p.need()) return p.needText || '今は使えない';
      if (g.power < P.costOf(p)) return `信仰が足りない(${P.costOf(p)}必要)`;
      return null;
    },
    use(key, arg) {
      const p = P.get(key), g = W.S.goddess;
      const why = P.check(p);
      if (why) return { ok: false, msg: why };
      const before = { h: F().power('h'), d: F().power('d') };
      if (!p.apply(arg)) return { ok: false, msg: 'いまは使えない' };
      g.power -= P.costOf(p);
      g.usedMonth = W.month();
      aware(p.sus);
      g.counts = g.counts || {}; g.counts[p.cat] = (g.counts[p.cat] || 0) + 1;
      if (W.S.report) W.S.report.used = p.name;
      const after = { h: F().power('h'), d: F().power('d') };
      if (G.Story) G.Story.onPower(p);
      return { ok: true, before, after, p };
    }
  };
  G.Powers = P;
})(globalThis.GD = globalThis.GD || {});
