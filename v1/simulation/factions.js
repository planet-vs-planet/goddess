// 2つの陣営(人族 VS 魔族)と、終わらない人魔大戦
// 国どうしの自由な外交のかわりに、陣営で敵と味方が決まる。
(function (G) {
  const W = G.World;

  G.SIDES = {
    h: { name: '人族', full: '人族陣営', color: 0x5b8fd9, css: '#6b9be0', races: ['human', 'elf', 'dwarf', 'beast'] },
    d: { name: '魔族', full: '魔族陣営', color: 0xb0405a, css: '#c9506a', races: ['demon', 'dragon'] }
  };
  // 種族ごとの陣営での役わり(指示書7)
  G.RACE_ROLE = {
    human: '数が多く、信仰があつい。人族の中心',
    elf: '人族の魔法を強める(魔法使いが強くなる)',
    dwarf: '人族の武器を強める(守りと攻城が得意)',
    beast: '人族の足を速くする(移動と奇襲が得意)',
    demon: '魔法と力に優れた魔族の中心。魔物を使う',
    dragon: '魔族に従う竜。攻撃力がとても高い'
  };
  const sideOfRace = r => (G.SIDES.d.races.includes(r) ? 'd' : 'h');

  const F = {
    sideOfRace,
    side(nid) { const n = W.nation(nid); return n ? (n.side || sideOfRace(n.race)) : (nid === -1 ? 'm' : null); },
    nationsOf(side) { return W.aliveNations().filter(n => (n.side || sideOfRace(n.race)) === side); },
    citiesOf(side) { return W.S.cities.filter(c => c.owner != null && F.side(c.owner) === side); },
    // 陣営の戦力(兵力×種族の強さ×技術+軍隊+英雄+加護)
    power(side) {
      let p = 0;
      for (const n of F.nationsOf(side)) p += G.Nations.power(n.id);
      const b = W.S.buffs && W.S.buffs[side];
      if (b) for (const x of b) if (x.until > W.S.day) p *= x.mult;
      return Math.round(p / 10);
    },
    // 人族の割合(0〜1)。0.5なら互角
    // 戦力6割・領土(都市の数)4割で決める
    balance() {
      const h = F.power('h'), d = F.power('d');
      const ps = h + d > 0 ? h / (h + d) : 0.5;
      const ch = F.citiesOf('h').length, cd = F.citiesOf('d').length;
      const cs = ch + cd > 0 ? ch / (ch + cd) : 0.5;
      return ps * 0.6 + cs * 0.4;
    },
    powerShare() { const h = F.power('h'), d = F.power('d'); return h + d > 0 ? h / (h + d) : 0.5; },
    landShare() { const ch = F.citiesOf('h').length, cd = F.citiesOf('d').length; return ch + cd > 0 ? ch / (ch + cd) : 0.5; },
    balanceLabel(b) {
      if (b > 0.75) return { t: '人族が圧倒', k: 'h3' };
      if (b > 0.62) return { t: '人族が優勢', k: 'h2' };
      if (b > 0.54) return { t: '人族がやや優勢', k: 'h1' };
      if (b >= 0.46) return { t: '互角', k: 'even' };
      if (b >= 0.38) return { t: '魔族がやや優勢', k: 'd1' };
      if (b >= 0.25) return { t: '魔族が優勢', k: 'd2' };
      return { t: '魔族が圧倒', k: 'd3' };
    },
    grandWar() { return W.S.wars[W.S.grandWar] || null; },
    warYears() { const w = F.grandWar(); return w ? Math.floor((W.S.day - w.start) / 360) : 0; },

    // 一時的な強化(介入の効果)
    addBuff(side, mult, days, label) {
      W.S.buffs = W.S.buffs || { h: [], d: [] };
      W.S.buffs[side].push({ mult, until: W.S.day + days, label });
    },
    buffsOf(side) { return ((W.S.buffs || {})[side] || []).filter(x => x.until > W.S.day); },

    // 世界を作ったときに呼ぶ
    setup() {
      const S = W.S;
      S.buffs = { h: [], d: [] };
      S.peace = null;            // 和平の動き
      S.report = F.newReport();  // 今月の報告
      S.report.startH = 0;
      S.lastReport = null;
      S.ended = null;
      for (const n of W.aliveNations()) {
        n.side = sideOfRace(n.race);
        n.religion = n.side === 'h' ? 'goddess' : 'demonlord';
        n.goal = n.side === 'd' ? (W.rng.chance(0.5) ? 'domination' : 'military') : W.rng.pick(['expansion', 'military', 'religion', 'economy']);
      }
      for (const c of S.cities) { const n = W.nation(c.owner); if (n) { c.religion = n.religion; c.faith = n.side === 'h' ? 0.65 : 0.05; } }
      F.syncAlliances();
      // 開始時の戦力をそろえる(魔族は国が少ないので兵の集まりを強くする)
      G.Economy.monthly();
      for (const n of W.aliveNations()) n.manpower = W.nationPop(n.id) * 0.05;
      const h = F.power('h'), d = F.power('d');
      // 都市の数の差も戦力で埋めて、はじめは互角(50%)にする
      const cs = F.landShare(), wantPs = G.clamp((0.5 - 0.4 * cs) / 0.6, 0.2, 0.8);
      const mul = G.clamp((h / Math.max(1, d)) * (1 - wantPs) / wantPs, 0.6, 6);
      for (const n of F.nationsOf('d')) { n.mpMul = mul; n.manpower *= mul; }
      F.syncWar(true);
    },

    syncAlliances() {
      const ns = W.aliveNations();
      for (const a of ns) for (const b of ns) {
        if (a.id >= b.id) continue;
        const r = W.rel(a.id, b.id);
        const same = F.side(a.id) === F.side(b.id);
        r.alliance = same; r.nap = same; r.trade = same;
        r.v = same ? Math.max(r.v, 40) : Math.min(r.v, -60);
      }
    },

    // 人魔大戦をつねに1つにまとめる
    syncWar(start) {
      const S = W.S;
      if (S.peaceDone || S.ended) return;
      let w = F.grandWar();
      const att = F.nationsOf('d').map(n => n.id), def = F.nationsOf('h').map(n => n.id);
      if (!att.length || !def.length) return;
      if (!w || w.ended) {
        for (const id in S.wars) if (!S.wars[id].ended) { S.wars[id].ended = true; S.wars[id].endDay = S.day; }
        const rk = 'demon|human';
        S.warCount[rk] = (S.warCount[rk] || 0) + 1;
        const k = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][Math.min(9, S.warCount[rk] - 1)];
        w = { id: W.newId(), name: `第${k}次人魔大戦`, att, def, cause: '魔族の侵攻', start: S.day, attScore: 0, defScore: 0, battles: 0, attLoss: 0, defLoss: 0, ended: false };
        S.wars[w.id] = w; S.grandWar = w.id;
        if (start) W.log('war', `${w.name}`, `魔王の軍勢が人族の国々へ攻めこんだ。人族は女神に祈り、剣を取った。`, { n: att.concat(def), imp: 3 });
      } else { w.att = att; w.def = def; }
    },

    newReport() {
      return { battles: 0, lossH: 0, lossD: 0, citiesH: 0, citiesD: 0, faith: 0, faithFrom: [], events: [], startH: 0, startD: 0, used: null };
    },
    // 都市が落ちたとき(army.js から呼ばれる)
    onCapture(city, fromId, toId) {
      const r = W.S.report; if (!r) return;
      const fs = F.side(fromId), ts = F.side(toId);
      if (fs === ts) return;
      if (ts === 'h') r.citiesH++; else if (ts === 'd') r.citiesD++;
      if (fs === 'h') W.S.prayer = (W.S.prayer || 0) + 6; // 人族の危機 → 祈りが強くなる
    },
    onBattle(winSide, lossW, lossL) {
      const r = W.S.report; if (!r) return;
      r.battles++;
      if (winSide === 'h') { r.lossH += lossW; r.lossD += lossL; } else { r.lossD += lossW; r.lossH += lossL; }
      W.S.prayer = (W.S.prayer || 0) + 1 + (winSide === 'd' ? 1.5 : 0);
    },

    // 毎月(時間の処理から呼ばれる)
    monthly() {
      const S = W.S;
      if (S.ended && S.ended.final) return;
      F.syncAlliances();
      F.syncWar();
      F.comeback();
      F.peaceProcess();
      F.checkEnd();
    },

    // どちらかが追いつめられると、必死の抵抗がおこる(すぐには決着しない)
    comeback() {
      const b = F.balance(), rng = W.rng;
      const ls = F.landShare();
      const lose = (b > 0.72 || ls > 0.82) ? 'd' : (b < 0.28 || ls < 0.18) ? 'h' : null;
      if (!lose) return;
      for (const n of F.nationsOf(lose)) n.manpower *= 1.015;
      for (const c of F.citiesOf(lose)) if (W.rng.chance(0.05) && (c.buildings.wall || 0) < 3) c.buildings.wall = (c.buildings.wall || 0) + 1;
      if (rng.chance(0.04) && !F.buffsOf(lose).some(x => x.label === '決死の抵抗')) {
        F.addBuff(lose, 1.15, 180, '決死の抵抗');
        W.log('war', lose === 'h' ? '人族の決死の抵抗' : '魔族の決死の抵抗', lose === 'h' ? '追いつめられた人族は、最後の一兵まで戦うと誓った。' : '追いつめられた魔族は、すべての力を戦いにつぎこんだ。', { imp: 2 });
      }
    },

    // 和平の動き: 戦争に疲れると和平交渉がはじまる。放っておくと戦争が終わってしまう
    peaceProcess() {
      const S = W.S, rng = W.rng;
      if (S.peaceDone || S.ended) return;
      const w = F.grandWar(); if (!w) return;
      const months = (S.day - w.start) / 30;
      const hs = F.nationsOf('h'), ds = F.nationsOf('d');
      const wear = (hs.concat(ds).reduce((s, n) => s + n.weariness, 0)) / Math.max(1, hs.length + ds.length);
      const b = F.balance();
      if (!S.peace) {
        if (months < 18 || (S.peaceBlockUntil || 0) > S.day) return;
        const p = 0.004 + Math.max(0, wear - 35) / 2500 + (Math.abs(b - 0.5) < 0.08 ? 0.006 : 0);
        if (rng.chance(p)) {
          const hn = hs.slice().sort((a, b2) => W.nationPop(b2.id) - W.nationPop(a.id))[0];
          const dn = ds.slice().sort((a, b2) => W.nationPop(b2.id) - W.nationPop(a.id))[0];
          if (!hn || !dn) return;
          S.peace = { start: S.day, months: 6, h: hn.id, d: dn.id };
          W.log('politics', '和平交渉のはじまり', `長い戦いに疲れた${hn.name}と${dn.name}が、ひそかに和平の話し合いをはじめた。このままでは6か月後に戦争が終わってしまう。`, { n: [hn.id, dn.id], imp: 3 });
        }
        return;
      }
      const left = S.peace.months - Math.floor((S.day - S.peace.start) / 30);
      if (left <= 0) {
        S.peaceDone = true; S.peace = null;
        w.ended = true; w.endDay = S.day; w.result = 'draw';
        W.log('war', '和平の成立', `人族と魔族は和平を結んだ。${w.name}は終わり、人々は剣を置いた。祈る理由を失った人々は、しだいに女神を忘れていく……。`, { imp: 3 });
        F.endGame('peace');
      }
    },
    breakPeace(how) {
      const S = W.S;
      if (!S.peace) return false;
      S.peace = null; S.peaceBlockUntil = S.day + 360 * 2;
      W.log('politics', '和平交渉の決裂', how || '話し合いの場で使者が殺され、和平交渉は決裂した。両陣営の憎しみは前よりも深まった。', { imp: 2 });
      for (const n of W.aliveNations()) n.weariness = Math.max(0, n.weariness - 25);
      return true;
    },

    // 決着がついたかどうか
    checkEnd() {
      const S = W.S;
      if (S.ended) return;
      if (!F.citiesOf('h').length) return F.endGame('demonWin');
      if (!F.citiesOf('d').length) return F.endGame('humanWin');
      const w = F.grandWar();
      if (w && F.warYears() >= 100 && !S.flags.eternal) { S.flags.eternal = true; F.endGame('eternal'); }
    },
    endGame(key) {
      const S = W.S;
      const final = key !== 'eternal';
      S.ended = { key, y: W.year(), final };
      if (G.Story) G.Story.onEnd(key);
    }
  };

  // ---- 前の自由な外交をとめる(同じ陣営では戦わない) ----
  G.Diplomacy.yearly = function () { };
  G.Diplomacy.monthlyWars = function () {
    const S = W.S;
    for (const id in S.wars) {
      const w = S.wars[id];
      if (w.ended) continue;
      w.att = w.att.filter(x => W.nation(x) && W.nation(x).alive);
      w.def = w.def.filter(x => W.nation(x) && W.nation(x).alive);
      for (const nid of w.att.concat(w.def)) { const n = W.nation(nid); n.weariness = Math.min(100, n.weariness + 0.6); }
    }
  };
  const origStart = G.Diplomacy.startWar;
  G.Diplomacy.startWar = function (att, def, cause, silent) {
    // 陣営をまたぐ戦争だけ。それは人魔大戦にまとめる
    if (!att.length || !def.length || F.side(att[0]) === F.side(def[0])) return null;
    F.syncWar();
    return F.grandWar();
  };
  G.Factions = F;
})(globalThis.GD = globalThis.GD || {});
