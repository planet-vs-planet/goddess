// 事件: 世界の状態から生まれ、ほかの事件につながっていく。
// 事件 = きっかけ(why) → 関係する人物(actors) → 人物の選択と出来事(beats) → 結果(result) → 次への影響(children)
(function (G) {
  const IMP = { war: 4, border_clash: 3, succession: 4, civil_war: 5, rebellion: 3, assassination: 4, plague: 3, famine: 2, hero: 3, fall: 5, alliance: 2, alliance_broken: 2, marriage: 1, festival: 1, coup: 4, betrayal: 3, friendship: 2, schism: 2, revenge: 2, new_dynasty: 3, restoration: 4, massacre: 3, goddess: 2, harvest: 1, spared: 2 };
  const ICON = { war: '⚔', border_clash: '⚠', succession: '♛', civil_war: '⚔', rebellion: '✊', assassination: '🗡', plague: '☣', famine: '☁', hero: '✶', fall: '☠', alliance: '🤝', alliance_broken: '✂', marriage: '💍', festival: '✟', coup: '♛', betrayal: '⚑', friendship: '⚭', schism: '✟', revenge: '🔥', new_dynasty: '♛', restoration: '⚜', massacre: '🔥', goddess: '✦', harvest: '❀', spared: '⚭' };
  const St = {
    open(type, o) {
      const id = G.newId('i');
      const inc = G.S.incidents[id] = Object.assign({
        id, type, title: '', d0: G.S.day, at: null, nations: [], actors: [], cause: null, why: '', beats: [], status: 'active',
        imp: IMP[type] || 2, result: '', end: 0, icon: ICON[type] || '•', children: [], data: {}
      }, o);
      if (inc.cause) { const p = G.I(inc.cause); if (p) p.children.push(id); }
      G.emit('incident', inc);
      return inc;
    },
    beat(inc, t, opt) {
      if (!inc) return;
      opt = opt || {};
      inc.beats.push({ d: G.S.day, t, at: opt.at ? { x: opt.at.x, y: opt.at.y } : null, minor: !!opt.minor });
      if (inc.beats.length > 40) inc.beats.splice(1, inc.beats.length - 40);
      inc.last = G.S.day;
      if (opt.at) inc.at = { x: opt.at.x, y: opt.at.y };
      G.emit('beat', { inc, t });
    },
    close(inc, result, opt) {
      if (!inc || inc.status === 'done') return;
      inc.status = 'done'; inc.end = G.S.day; inc.result = result;
      St.beat(inc, result);
      G.S.chronicle.push({ y: G.Y(), m: G.M(), t: `${inc.title}: ${result}`, k: inc.type, inc: inc.id });
      if (G.S.chronicle.length > 900) G.S.chronicle.splice(0, 100);
      G.emit('incidentDone', inc);
    },
    record(t, k) { G.S.chronicle.push({ y: G.Y(), m: G.M(), t, k: k || 'event' }); },
    active(type, pred) { return G.vals(G.S.incidents).find(i => i.status === 'active' && i.type === type && (!pred || pred(i))); },
    // 古い事件を整理(セーブを軽く)
    prune() {
      const list = G.vals(G.S.incidents).filter(i => i.status === 'done').sort((a, b) => a.end - b.end);
      while (list.length > 160) { const i = list.shift(); delete G.S.incidents[i.id]; }
    },

    // ---- 画面: いま注目の出来事(最大3件) ----
    spotlight() {
      const now = G.S.day;
      const act = G.vals(G.S.incidents).filter(i => i.status === 'active').map(i => ({ i, s: i.imp * 10 + (i.last ? Math.max(0, 15 - (now - i.last) / 6) : 0) + St.urgency(i) - (now - i.d0) / 90 }));
      const done = G.vals(G.S.incidents).filter(i => i.status === 'done' && now - i.end < 40 && i.imp >= 3).map(i => ({ i, s: i.imp * 9 - (now - i.end) / 3 }));
      return act.concat(done).sort((a, b) => b.s - a.s).slice(0, G.CFG.SPOTLIGHT).map(x => x.i);
    },
    urgency(i) {
      if (i.type === 'war') { const w = G.S.wars[i.data.war]; if (w && G.cities().some(c => c.siege && (w.a.includes(c.owner) || w.b.includes(c.owner)))) return 8; return G.vals(G.S.battles).some(b => !b.over && w && (w.a.includes(b.s[0].nation) || w.b.includes(b.s[0].nation))) ? 10 : 0; }
      if (i.type === 'border_clash') return G.rel(i.nations[0], i.nations[1]).tension / 8;
      if (i.type === 'succession') { const r = G.P(i.data.rival); return r && r.alive ? r.plot / 8 : 0; }
      return 0;
    },
    // これからどうなるか(確定はしない)
    future(i) {
      const out = [];
      const N = id => G.N(id);
      if (i.status === 'done') return i.children.map(G.I).filter(Boolean).map(c => `→ ${c.title}につながった`);
      if (i.type === 'border_clash') {
        const [a, b] = i.nations.map(N); if (!a || !b) return out;
        const da = G.Nations.warDesire(a, b), db = G.Nations.warDesire(b, a);
        const hi = da > db ? a : b, v = Math.max(da, db);
        out.push(v > 50 ? `${G.nname(hi)}は今にも攻めこみそうだ` : v > 30 ? `${G.nname(hi)}の君主は侵攻を考えている` : 'このまま緊張がやわらぐかもしれない');
        const r = G.People.ruler(hi);
        if (r && (G.hasTrait(r, 'peaceful') || G.hasTrait(r, 'gentle'))) out.push(`ただし${G.pname(r)}は争いを好まない`);
      } else if (i.type === 'war') {
        const w = G.S.wars[i.data.war]; if (!w) return out;
        const sg = G.cities().find(c => c.siege && (w.a.includes(c.owner) || w.b.includes(c.owner)));
        if (sg) out.push(`包囲された${sg.name}が落ちるかどうかが焦点`);
        const a = N(w.a[0]), b = N(w.b[0]);
        if (a && b) {
          const sa = G.Nations.strength(a), sb = G.Nations.strength(b);
          out.push(sa > sb * 1.4 ? `兵力では${G.nname(a)}が優勢` : sb > sa * 1.4 ? `兵力では${G.nname(b)}が優勢` : '両軍の力はほぼ互角');
          const pa = G.Nations.peaceDesire(a, b), pb = G.Nations.peaceDesire(b, a);
          if (pa > 45 || pb > 45) out.push(`${G.nname(pa > pb ? a : b)}には和平を望む声が出ている`);
        }
      } else if (i.type === 'succession') {
        const r = G.P(i.data.rival), h = G.P(i.data.heir);
        if (r && r.alive && h && h.alive) out.push(r.plot > 70 ? `${G.pname(r)}が近く動くかもしれない` : `${G.pname(r)}はまだ様子を見ている`);
        out.push('国が2つに割れる可能性もある');
      } else if (i.type === 'rebellion' || i.type === 'civil_war') out.push('反乱軍が勝てば、新しい国が生まれるかもしれない');
      else if (i.type === 'plague') out.push('信仰に救いを求める人が増えている');
      else if (i.type === 'hero') out.push('英雄の活躍しだいで戦争の流れが変わるかもしれない');
      return out;
    },

    // ---- 外から呼ばれる事件 ----
    event(type, d) {
      const f = St.E[type]; if (!f) return null;
      return f(d || {});
    },
    E: {
      border_clash(d) {
        const a = G.N(d.a), b = G.N(d.b), c = G.C(d.city), rng = G.rng;
        if (!a || !b || !c) return null;
        if (!d.opening && !G.cd('clash:' + G.relKey(a.id, b.id), 480)) return null;
        const r = G.rel(a.id, b.id);
        const ra = G.People.ruler(a);
        G.S.clash = G.S.clash || {};
        const ck = G.relKey(a.id, b.id), nth = (G.S.clash[ck] = (G.S.clash[ck] || 0) + 1);
        const cause0 = d.opening ? '何年も続く国境の緊張' : d.goddess ? '国境で起きた不可解な事件' : rng.pick(['国境の村での家畜の盗み合い', '見回りの兵どうしの言い争い', '国境の泉をめぐる争い', '旅の商人が殺された事件']);
        const cause = nth > 1 && !d.opening ? `${cause0}(この国境での衝突は${nth}度目)` : cause0;
        const inc = St.open('border_clash', { title: nth > 1 ? `${c.name}国境の衝突(${nth}度目)` : `${c.name}国境の衝突`, at: { x: c.x, y: c.y }, nations: [a.id, b.id], actors: [ra && ra.id].filter(Boolean), why: `${cause}がきっかけ。${G.nname(a)}と${G.nname(b)}は${a.race !== b.race ? '人族と魔族として長く対立してきた' : '前から仲が悪い'}。`, data: { city: c.id } });
        const lose = Math.round(rng.int(60, 220));
        c.garrison = Math.max(50, c.garrison - lose);
        r.tension = Math.min(100, r.tension + (d.opening ? 0 : 18 + nth * 4)); r.opinion -= 6 + nth * 4;
        St.beat(inc, `${G.nname(a)}の兵が国境をこえ、${c.name}近くの村を襲った。守備兵${lose}人が倒れた。`, { at: c });
        if (ra) St.beat(inc, ra.ambition > 60 ? `${G.pname(ra)}は「国境の土地は本来われらのもの」と言い放った。` : `${G.pname(ra)}は兵の勝手な行動だと言ったが、謝罪はしなかった。`);
        const rb = G.People.ruler(b);
        if (rb) { G.remember(rb, `${c.name}の国境で${G.nname(a)}の兵に村を襲われた。`, 'anger', { nation: a.id }); St.beat(inc, G.hasTrait(rb, 'proud') || G.hasTrait(rb, 'vengeful') ? `${G.pname(rb)}は激怒し、国境へ兵を集めはじめた。` : `${G.pname(rb)}は守りを固めるよう命じた。`); }
        // 両国の軍が国境へ
        for (const n of [a, b]) for (const ar of G.armies()) if (ar.nation === n.id && ar.state === 'idle') { const fc = G.Nations.frontCity(n, [n === a ? b : a]); if (fc) G.War.go(ar, fc.x, fc.y, 'home', fc.id); }
        G.news(`${c.name}の国境で、${G.nname(a)}と${G.nname(b)}の兵が衝突した。`, { k: 'war', at: c, imp: 3, inc: inc.id });
        G.fx('clash', c.x, c.y, { days: 30 });
        if (!d.opening) G.focus(c.x, c.y, inc.title, { k: 'clash' });
        return inc;
      },
      war(d) {
        const w = G.S.wars[d.war], a = G.N(d.a), b = G.N(d.b);
        const clash = St.active('border_clash', i => i.nations.includes(a.id) && i.nations.includes(b.id));
        const cause = d.cause || (clash && clash.id) || null;
        const ra = G.People.ruler(a);
        const why = {
          '復讐': `${ra ? G.pname(ra) : '君主'}は${G.nname(b)}への恨みを忘れていなかった。`,
          '失った土地の奪還': `${G.nname(b)}にうばわれた町を取りもどすため。`,
          '女神の啓示': `${ra ? G.pname(ra) : '君主'}は女神のお告げを信じ、戦いを決めた。`,
          '国境での衝突': '国境での衝突がくり返され、ついに戦争になった。',
          '領土の拡大': `野心家の${ra ? G.pname(ra) : '君主'}が、${G.nname(b)}の豊かな土地を狙った。`
        }[d.reason] || `${d.reason}。`;
        const inc = St.open('war', { title: w.name, nations: w.a.concat(w.b), actors: [ra && ra.id, G.People.ruler(b) && G.People.ruler(b).id].filter(Boolean), cause, why, data: { war: w.id }, at: { x: G.C(b.capital).x, y: G.C(b.capital).y } });
        if (clash) St.close(clash, `${G.nname(a)}が${G.nname(b)}に宣戦。戦争になった。`);
        const allies = w.a.slice(1).concat(w.b.slice(1)).map(G.N).filter(Boolean);
        St.beat(inc, `${G.nname(a)}が${G.nname(b)}に宣戦を布告した。${d.truceBroken ? '休戦の約束は破られた。' : ''}${allies.length ? '同盟国' + allies.map(G.nname).join('・') + 'も参戦した。' : ''}`, { at: G.C(a.capital) });
        G.news(`${w.name}が始まった！ ${G.nname(a)}が${G.nname(b)}に宣戦。`, { k: 'war', at: G.C(b.capital), imp: 3, inc: inc.id });
        const fc = G.Nations.frontCity(a, [b]); if (fc) G.focus(fc.x, fc.y, `${w.name}が始まった`, { k: 'war' });
        G.War.plan();
        return inc;
      },
      peace(d) {
        const w = G.S.wars[d.war], asker = G.N(d.asker);
        const taken = d.taken.map(G.C).filter(Boolean);
        const res = `${G.nname(asker)}の申し出で和平が結ばれた(${d.years}年の休戦)。` + (taken.length ? `${taken.map(c => c.name).join('・')}は${G.nname(G.N(taken[0].owner))}のものとなった。` : '国境は元のまま。') + `死傷者は${G.fmt(w.deaths)}人にのぼった。`;
        St.closeWar(w, res);
        for (const id of w.a.concat(w.b)) { const r = G.People.ruler(G.N(id)); if (r) G.remember(r, `${w.name}が終わった。`, 'peace'); }
        G.news(`${w.name}が終わった。${res}`, { k: 'politics', imp: 3 });
      },
      alliance(d) {
        const a = G.N(d.a), b = G.N(d.b), e = d.enemy && G.N(d.enemy);
        const cross = a.race !== b.race;
        const inc = St.open('alliance', { title: `${a.short}・${b.short}同盟`, nations: [a.id, b.id], why: e ? `共通の敵${G.nname(e)}に対抗するため。` : '長年の友好から。', imp: cross ? 4 : 2 });
        if (cross) St.beat(inc, `人族と魔族が手を組んだ。前例のない同盟に、両国の神官たちはとまどっている。`);
        St.close(inc, `${G.nname(a)}と${G.nname(b)}が同盟を結んだ。`);
        G.news(`${G.nname(a)}と${G.nname(b)}が同盟を結んだ。`, { k: 'politics', at: G.C(a.capital), imp: cross ? 3 : 2 });
      },
      alliance_broken(d) {
        const a = G.N(d.a), b = G.N(d.b);
        G.news(`${G.nname(a)}と${G.nname(b)}の同盟が解消された。`, { k: 'politics', at: G.C(a.capital) });
        St.record(`${G.nname(a)}と${G.nname(b)}の同盟が終わった。`, 'alliance');
      },
      marriage(d) {
        const a = G.P(d.a), b = G.P(d.b);
        const inc = St.open('marriage', { title: '王家の結婚', nations: [a.nation, b.nation], actors: [a.id, b.id], why: '両国の結びつきを強めるため。' });
        St.close(inc, `${G.pname(a)}と${G.pname(b)}が結婚した。`);
        G.news(`${G.nname(G.N(a.nation))}の${G.pname(a)}と${G.nname(G.N(b.nation))}の${G.pname(b)}が結婚した。`, { k: 'person', at: G.People.where(a) });
      },
      succession(d) {
        const n = G.N(d.nation), h = G.P(d.heir), r = G.P(d.rival), old = G.P(d.old);
        if (!n || !h || !r) return null;
        r.plot = Math.max(r.plot, 55);
        const why = d.regent ? `新しい君主${G.pname(h)}はまだ幼く、${G.pname(r)}が実権を狙っている。` : `${old ? G.pname(old) + 'が' + d.cause.replace(/た$/, 'たあと') : '先代のあと'}、${G.pname(r)}は${G.pname(h)}の即位を認めていない。`;
        const inc = St.open('succession', { title: `${n.short}の王位継承争い`, nations: [n.id], actors: [h.id, r.id], why, data: { heir: h.id, rival: r.id, nation: n.id }, at: G.C(n.capital) });
        St.beat(inc, `${G.pname(h)}が${G.nname(n)}の君主となった。しかし${G.pname(r)}は「${r.ambition > 75 ? '王冠は力ある者がかぶるべきだ' : '正しい継承者は私だ'}」と主張している。`, { at: G.C(n.capital) });
        G.addRel(r, h, 'rival', -35); G.addRel(h, r, 'rival', -20);
        G.news(`${G.nname(n)}で王位継承争いが起きている。`, { k: 'politics', at: G.C(n.capital), imp: 3, inc: inc.id });
        return inc;
      },
      new_dynasty(d) {
        const n = G.N(d.nation), p = G.P(d.ruler);
        const inc = St.open('new_dynasty', { title: `${n.short}の新王朝`, nations: [n.id], actors: [p.id], why: '王家の血が絶えたため。' });
        St.close(inc, `${G.pname(p)}が${G.nname(n)}の新しい君主に推された。${p.house}家の時代が始まる。`);
        n.house = p.house;
      },
      fall(d) {
        const n = G.N(d.nation), by = d.by && G.N(d.by);
        const inc = St.open('fall', { title: `${n.name}の滅亡`, nations: [n.id, by && by.id].filter(Boolean), why: d.why || '', imp: 5 });
        St.close(inc, `${G.nname(n)}は${by ? G.nname(by) + 'によって' : ''}滅びた。建国から${G.Y() - n.founded}年。`);
        G.news(`${G.nname(n)}が滅亡した。`, { k: 'politics', imp: 3, inc: inc.id });
        G.Goddess.prayers(n.id, 0);
      }
    },
    closeWar(w, res) { const inc = G.I(w.inc); if (inc) St.close(inc, res); },

    // ---- 戦いのあとに生まれる事件 ----
    afterBattle(b, W, L) {
      const rng = G.rng, wa = G.A(W.armies[0]), la = G.A(L.armies[0]);
      const wc = wa && G.P(wa.cmd), lc = la && G.P(la.cmd);
      const war = G.Nations.warBetween(W.nation, L.nation);
      // 敵将を見のがす(恩義・友情の芽)
      if (wc && lc && lc.alive && (G.hasTrait(wc, 'gentle') || G.hasTrait(wc, 'just')) && rng.chance(0.18) && G.cd('spare:' + wc.id, 1800)) {
        G.setRel(lc, wc, 'debt', 45); G.addRel(wc, lc, 'friend', 20);
        G.remember(lc, `${b.name}で敗れたが、${G.pname(wc)}に命を助けられた。`, 'debt', { who: wc.id });
        G.remember(wc, `${b.name}で、敵将${G.pname(lc)}を見のがした。`, 'mercy', { who: lc.id });
        const inc = St.open('spared', { title: '敵将への情け', nations: [W.nation, L.nation], actors: [wc.id, lc.id], why: `${G.pname(wc)}は${G.hasTrait(wc, 'gentle') ? '温厚な' : '正義感の強い'}人物だった。`, cause: war && war.inc, at: { x: b.x, y: b.y } });
        St.close(inc, `${G.pname(wc)}は、捕らえた${G.pname(lc)}を解き放った。${wc.race !== lc.race ? '種族をこえた借りが生まれた。' : ''}`);
      }
      // 残酷な勝者
      if (wc && G.hasTrait(wc, 'cruel') && rng.chance(0.25) && G.cd('cruel:' + wc.id, 1500)) {
        const ln = G.N(L.nation), rl = G.People.ruler(ln);
        if (rl) { rl.hate = rl.hate || {}; rl.hate[W.nation] = (rl.hate[W.nation] || 0) + 20; G.remember(rl, `${G.pname(wc)}が${b.name}で降伏した兵を皆殺しにした。`, 'revenge', { nation: W.nation }); }
        G.rel(W.nation, L.nation).opinion -= 15;
        const inc = St.open('massacre', { title: `${b.name}の虐殺`, nations: [W.nation, L.nation], actors: [wc.id], why: `${G.pname(wc)}は残酷な人物として知られていた。`, cause: war && war.inc, at: { x: b.x, y: b.y } });
        St.close(inc, `${G.pname(wc)}は降伏した兵を許さなかった。${G.nname(ln)}の人々の憎しみは深まった。`);
      }
      // 英雄の誕生(負けた側から生まれることが多い)
      const ln = G.N(L.nation);
      if (ln && rng.chance(0.09) && G.cd('hero:' + ln.id, 360 * 6)) St.heroRise(ln, `${b.name}の敗走のさなか`, war && war.inc);
    },
    afterCapture(c, n, old, a) {
      const rng = G.rng, cmd = G.P(a.cmd);
      if (cmd && G.hasTrait(cmd, 'cruel') && rng.chance(0.3)) {
        c.pop *= 0.8; c.unrest = 90;
        const inc = St.open('massacre', { title: `${c.name}の惨劇`, nations: [n.id, old.id], actors: [cmd.id], why: `攻め落とした${G.pname(cmd)}は、抵抗した町を見せしめにした。`, at: c });
        St.close(inc, G.rng.pick([`${G.pname(cmd)}の兵は${c.name}の家々に火を放った。生き残った人々は復讐を誓っている。`, `${G.pname(cmd)}は${c.name}の城門に、守備隊長の首をさらした。${G.nname(old)}の人々は怒りにふるえている。`, `${c.name}の人々の多くが命を落とした。${G.pname(cmd)}の名は、${G.nname(old)}で呪いの言葉になった。`]));
        const ro = G.People.ruler(old); if (ro) { ro.hate = ro.hate || {}; ro.hate[n.id] = (ro.hate[n.id] || 0) + 25; }
      }
      if (rng.chance(0.15) && G.cd('hero:' + old.id, 360 * 5)) St.heroRise(old, `${c.name}が落ちた夜`, null);
    },
    heroRise(n, when, cause, forced) {
      const rng = G.rng;
      let p = G.chars().filter(q => q.nation === n.id && ['knight', 'noble'].includes(q.role) && G.ageOf(q) >= G.RACES[q.race].adult && G.ageOf(q) < 40).sort((a, b) => b.martial - a.martial)[0];
      if (!p) p = G.People.make({ race: n.race, nation: n.id, role: 'knight', age: rng.int(17, 24), city: rng.pick(n.cities), martial: rng.int(60, 85) });
      p.role = 'hero'; G.People.updateTitle(p); p.martial = Math.min(99, p.martial + 18); p.fame += 35; p.conf = 85;
      const deed = rng.pick([`燃える村から子どもたちを救い出した`, `たったひとりで敵の追撃を食い止めた`, `折れた旗をかかげ、逃げる兵たちを立ち直らせた`, `敵の魔獣を一騎打ちで倒した`]);
      const inc = St.open('hero', { title: `英雄${p.name}の誕生`, nations: [n.id], actors: [p.id], cause, why: `${when}、${G.ageOf(p)}歳の${p.name}が${deed}。`, at: G.People.where(p) });
      G.remember(p, `${when}、${deed}。人々は英雄と呼んだ。`, 'glory');
      St.close(inc, `${G.nname(n)}の人々は${p.name}を英雄とたたえている。${forced ? '(その力が女神から来たことを、誰も知らない)' : ''}`);
      G.news(`${G.nname(n)}に英雄${p.name}があらわれた。`, { k: 'person', at: G.People.where(p), imp: 3, inc: inc.id });
      // 軍をまかされる
      const free = G.armies().find(a => a.nation === n.id && (!a.cmd || !G.P(a.cmd) || !G.P(a.cmd).alive));
      if (free) { free.cmd = p.id; p.armyId = free.id; }
      return p;
    },

    // ---- 毎月: 世界の状態から事件が生まれる ----
    monthly() {
      const rng = G.rng;
      // 野心・陰謀が育つ
      for (const p of G.chars()) {
        const n = G.N(p.nation); if (!n || p.role === 'ruler' || G.ageOf(p) < G.RACES[p.race].adult) continue;
        if (!['heir', 'general', 'noble', 'hero', 'exile'].includes(p.role)) continue;
        const r = G.People.ruler(n); if (!r) continue;
        const rr = p.rel[r.id];
        let g = (p.ambition - 66) * 0.08 + (rr ? -rr.v * 0.06 : 0) + G.infSum(p, 'ambition') * 0.15 + (n.stability < 40 ? 1.5 : 0) + (n.cities.length > 8 ? 1 : 0) - p.loyalty * 0.02 - p.fear * 0.03;
        if (p.role === 'heir' && rr && rr.k === 'child') g -= 1.2;
        p.plot = G.clamp(p.plot + g, 0, 100);
      }
      // 暗殺・クーデター
      for (const p of G.chars()) {
        if (p.plot < 75 || !rng.chance(0.05)) continue;
        const n = G.N(p.nation), r = n && G.People.ruler(n); if (!r || r === p) continue;
        if (!G.cd('plotN:' + n.id, 360 * 9)) continue; // 同じ国で陰謀が続きすぎないように
        if (p.armyId && p.martial > p.intrigue && rng.chance(0.5)) St.coup(p, n, r); else St.assassinate(p, r, n);
      }
      // 王位継承争いのゆくえ
      for (const inc of G.vals(G.S.incidents)) {
        if (inc.status !== 'active') continue;
        if (inc.type === 'succession') St.successionStep(inc);
        if (inc.type === 'border_clash' && (G.rel(inc.nations[0], inc.nations[1]).tension < 30 || G.S.day - inc.d0 > 720)) St.close(inc, St.clashEnd(inc));
        if ((inc.type === 'rebellion' || inc.type === 'civil_war' || inc.type === 'restoration') && inc.data.nation && !G.N(inc.data.nation).alive) { const rn = G.N(inc.data.nation); St.close(inc, `${G.nname(rn)}は${G.Y() - rn.founded}年で倒れた。${G.pname(G.P(rn.ruler))}の夢は終わった。`); }
      }
      // 国境の衝突
      for (const a of G.nations()) for (const b of G.Nations.neighbors(a)) {
        if (a.id >= b.id) continue;
        const r = G.rel(a.id, b.id);
        if (r.state !== 'peace' || r.tension < 42 || !rng.chance(0.025 + r.tension / 1800)) continue;
        const ag = G.Nations.warDesire(a, b) > G.Nations.warDesire(b, a) ? a : b, df = ag === a ? b : a;
        const c = G.Nations.frontCity(df, [ag]); if (c) St.event('border_clash', { a: ag.id, b: df.id, city: c.id });
      }
      // 反乱
      for (const c of G.cities()) if (c.unrest > 75 && !c.siege && rng.chance(0.07) && G.cd('rebel:' + c.id, 360 * 7)) St.rebellion(c);
      // 疫病・飢饉・豊作
      for (const c of G.cities()) {
        if (!c.plague && c.pop > 5000 && rng.chance(0.0018) && G.cd('plague:' + c.id, 360 * 12)) St.plague(c, null);
        if (!c.famine && rng.chance(c.food < 25 ? 0.0015 : 0.0004) && G.cd('famine:' + c.id, 360 * 8)) St.famine(c);
      }
      // 祭り(信仰)
      for (const p of G.chars()) if (p.role === 'priest' && rng.chance(0.02) && G.cd('fest:' + p.nation, 360 * 3)) {
        const n = G.N(p.nation); if (!n) continue;
        for (const cid of n.cities) G.C(cid).faith += 6;
        G.news(`${G.pname(p)}が${G.nname(n)}で${n.race === 'human' ? '光の大祭' : '月の夜祭'}を開いた。${G.FAITH[n.race].prayer}が都にあふれた。`, { k: 'faith', at: G.C(n.capital) });
      }
      // 宗派の対立
      if (rng.chance(0.006) && G.cdOk('schism')) {
        const ns = G.nations().filter(n => n.sect);
        const pair = [];
        for (const a of ns) for (const b of ns) if (a.id < b.id && a.race === b.race && a.sect !== b.sect) pair.push([a, b]);
        if (pair.length) { const [a, b] = rng.pick(pair); if (G.cd('schism:' + G.relKey(a.id, b.id), 360 * 25) && G.cd('schism', 360 * 8)) { G.rel(a.id, b.id).opinion -= 18; const inc = St.open('schism', { title: '教えをめぐる対立', nations: [a.id, b.id], why: `${G.nname(a)}は「${a.sect}」、${G.nname(b)}は「${b.sect}」を信じている。` }); St.close(inc, rng.pick([`${G.nname(a)}の大神官が「${b.sect}は女神の言葉をゆがめている」と説教し、${G.nname(b)}は使節を引き上げた。`, `${a.sect}と${b.sect}の巡礼者が聖地で衝突した。両国は互いを「誤った教え」と非難している。`, `${G.nname(b)}で${a.sect}の書物が焼かれた。${G.nname(a)}の人々は激しく怒った。`])); } }
      }
      // 種族をこえた出会い(まれ)
      if (rng.chance(0.006) && G.cd('crossmeet', 360 * 6)) {
        const hs = G.chars().filter(p => p.race === 'human' && ['knight', 'heir', 'general', 'hero'].includes(p.role) && G.ageOf(p) >= 16);
        const ds = G.chars().filter(p => p.race === 'demon' && ['knight', 'heir', 'general', 'hero'].includes(p.role) && G.ageOf(p) >= 20);
        if (hs.length && ds.length) St.meet(rng.pick(hs), rng.pick(ds), null);
      }
      // 亡命者が故郷の奪還を願う
      for (const p of G.chars()) {
        if (p.role !== 'exile' || !p.exileOf || !rng.chance(0.03)) continue;
        const host = G.N(p.nation), old = G.N(p.exileOf), hr = host && G.People.ruler(host);
        if (!host || !hr) continue;
        const occ = G.cities().find(c => c.home === p.exileOf && c.owner !== host.id && G.N(c.owner));
        if (occ && G.cd('exile:' + p.id, 360 * 3)) {
          G.influence(hr, 'war', occ.owner, 18, 720);
          G.news(`亡命中の${p.name}が、${G.pname(hr)}に故郷${occ.name}の奪還を訴えた。`, { k: 'politics', at: G.C(host.capital) });
          G.remember(hr, `亡命者${p.name}に、${G.nname(G.N(occ.owner))}討伐を頼まれた。`, 'politics', { who: p.id });
        }
      }
      // 裏切り(負けている国の、忠誠の低い将軍)
      for (const p of G.chars()) {
        if (p.role !== 'general' || !p.armyId || !rng.chance(0.01)) continue;
        const n = G.N(p.nation), r = n && G.People.ruler(n), rr = r && p.rel[r.id];
        if (!r || !rr || rr.v > -25 || p.ambition < 55) continue;
        const enemy = G.enemiesOf(n)[0]; if (!enemy || G.Nations.strength(enemy) < G.Nations.strength(n)) continue;
        St.betray(p, n, enemy);
      }
      St.prune();
    },
    successionStep(inc) {
      const rng = G.rng, n = G.N(inc.data.nation), h = G.P(inc.data.heir), r = G.P(inc.data.rival);
      if (!n || !n.alive) { St.close(inc, `${h ? G.pname(h) + 'と' : ''}${r ? G.pname(r) : '対立者'}が争ううちに、${n ? G.nname(n) : '国'}そのものが失われた。`); return; }
      if (!r || !r.alive) { St.close(inc, `${r ? G.pname(r) : '対立者'}の死で、争いは終わった。`); return; }
      if (!h || !h.alive || n.ruler !== h.id) { St.close(inc, `王位は${G.pname(G.P(n.ruler))}のものとなった。`); return; }
      if (r.nation !== n.id) { St.close(inc, `${G.pname(r)}は国を去った。`); return; }
      if (G.S.day - inc.d0 > 360 * 4 || r.plot < 25) { St.close(inc, `${G.pname(r)}は${G.pname(h)}に従うことを選んだ。`); r.plot = 0; G.addRel(r, h, 'loyal', 30); return; }
      if (r.plot > 80 && rng.chance(0.15 + Math.max(0, n.cities.length - 7) * 0.05)) {
        // 内乱: 国が割れる
        const nn = G.Nations.split(n, r, '王位継承争い');
        if (nn) {
          const civ = St.open('civil_war', { title: `${n.short}の内乱`, nations: [n.id, nn.id], actors: [h.id, r.id], cause: inc.id, why: `${G.pname(r)}が王位を主張し、${nn.name}の建国を宣言した。`, data: { nation: nn.id }, at: G.C(nn.capital) });
          St.close(inc, `${G.pname(r)}が兵を挙げ、国は2つに割れた。`);
          G.Nations.declareWar(n, nn, '内乱', { cause: civ.id });
          G.focus(G.C(nn.capital).x, G.C(nn.capital).y, `${n.short}が分裂`, { k: 'split' });
        }
      }
    },
    clashEnd(inc) {
      const [a, b] = inc.nations.map(G.N); if (!a || !b) return '国境の争いは立ち消えになった。';
      const r = G.rel(a.id, b.id), ra = G.People.ruler(a), rb = G.People.ruler(b);
      if (r.tension < 30 && ra && rb && (G.hasTrait(ra, 'gentle') || G.hasTrait(rb, 'gentle') || G.hasTrait(ra, 'peaceful') || G.hasTrait(rb, 'peaceful'))) return `${G.pname(G.hasTrait(ra, 'gentle') || G.hasTrait(ra, 'peaceful') ? ra : rb)}が使者を送り、国境の争いはおさまった。`;
      if (r.tension < 30) return `${G.nname(a)}と${G.nname(b)}の兵は国境から引き上げた。にらみ合いは、ひとまず終わった。`;
      return `戦争にはならなかったが、${G.nname(a)}と${G.nname(b)}の国境には今も兵が残っている。`;
    },
    famine(c) {
      const rng = G.rng, n = G.N(c.owner); if (!n) return;
      c.famine = rng.int(4, 8);
      const cause = G.season() === '夏' ? '日照り' : G.season() === '冬' ? '冷たい長雨と早い冬' : rng.pick(['長雨', 'イナゴの大群', '麦の病']);
      const r = G.People.ruler(n);
      let res;
      if (r && (G.hasTrait(r, 'gentle') || G.hasTrait(r, 'just')) && n.treasury > 150) { n.treasury -= 120; c.famine = Math.ceil(c.famine / 2); c.unrest = Math.max(0, c.unrest - 10); res = `${G.pname(r)}が国の倉を開き、飢えはやわらいだ。`; G.addRel(r, r, null, 0); }
      else if (r && (G.hasTrait(r, 'cruel') || G.hasTrait(r, 'greedy'))) { c.unrest += 15; res = `${G.pname(r)}は助けを送らず、民の怒りは君主に向かった。`; }
      else { c.faith += 6; res = '人々は神殿で雨と実りを祈った。'; }
      G.news(`${c.name}を${cause}による飢饉が襲った。${res}`, { k: 'disaster', at: c });
      St.record(`${c.name}で${cause}による飢饉。${res}`, 'famine');
    },
    assassinate(p, r, n) {
      const rng = G.rng;
      if (!G.cd('assas:' + p.id, 360 * 3)) return;
      const ok = rng.chance(G.clamp(0.25 + (p.intrigue - r.intrigue) / 160 - (r.blessed > G.S.day ? 1 : 0), 0.05, 0.75));
      const found = rng.chance(ok ? 0.35 : 0.7);
      const inc = St.open('assassination', { title: `${G.pname(r)}暗殺${ok ? '' : '未遂'}事件`, nations: [n.id], actors: [r.id, p.id], why: `${G.pname(p)}は${p.role === 'heir' ? '王冠' : '権力'}を求めていた。`, at: G.C(n.capital) });
      if (r.blessed > G.S.day && !ok) { r.blessed = 0; St.beat(inc, `毒の盃が、なぜか${G.pname(r)}の手からすべり落ちた。`); }
      if (ok) {
        St.beat(inc, rng.pick([`宴の夜、${G.pname(r)}の盃に毒が入れられた。`, `狩りの途中、${G.pname(r)}を矢が貫いた。`, `寝室に忍びこんだ刺客が${G.pname(r)}を襲った。`]), { at: G.C(n.capital) });
        G.People.die(r, '暗殺された', {});
      } else St.beat(inc, `${G.pname(r)}を狙った刺客は失敗した。`);
      if (found) {
        St.beat(inc, `調べの結果、${G.pname(p)}が黒幕だとわかった。`);
        if (rng.chance(0.5)) { G.People.die(p, '陰謀が露見して処刑された'); St.close(inc, `${G.pname(p)}は処刑された。`); }
        else { const to = G.nations().filter(m => m !== n && m.race === p.race); if (to.length) { const t = rng.pick(to); p.nation = t.id; p.role = 'exile'; p.exileOf = null; G.People.updateTitle(p); p.city = t.capital; St.close(inc, `${G.pname(p)}は${G.nname(t)}へ逃げた。`); } else St.close(inc, `${G.pname(p)}は姿を消した。`); }
      } else {
        p.plot = ok ? 0 : p.plot - 20;
        St.close(inc, ok ? `犯人はわからないまま。宮廷には疑いの空気が広がり、${G.pname(p)}はひそかに胸をなでおろした。` : `刺客は口を割らずに死んだ。${G.pname(r)}は護衛を増やし、${p.name}は計画を練り直している。`);
      }
      G.news(inc.title + '。', { k: 'person', at: G.C(n.capital), imp: 3, inc: inc.id });
      if (ok) G.focus(G.C(n.capital).x, G.C(n.capital).y, inc.title, { k: 'death' });
    },
    coup(p, n, r) {
      if (!G.cd('coup:' + p.id, 360 * 4)) return;
      const a = G.A(p.armyId);
      const inc = St.open('coup', { title: `${G.pname(p)}の反乱`, nations: [n.id], actors: [p.id, r.id], why: `${G.pname(p)}は${G.pname(r)}に不満を持ち、軍を握っていた。`, at: a || G.C(n.capital) });
      const nn = G.Nations.split(n, p, 'クーデター');
      if (nn) {
        St.beat(inc, `${G.pname(p)}が${a ? a.name : '手勢'}を率いて反旗をひるがえし、${nn.name}を名乗った。`, { at: G.C(nn.capital) });
        inc.data.nation = nn.id; inc.type = 'civil_war';
        G.Nations.declareWar(n, nn, '内乱', { cause: inc.id });
        G.focus(G.C(nn.capital).x, G.C(nn.capital).y, inc.title, { k: 'split' });
      } else St.close(inc, '反乱は失敗に終わった。');
    },
    betray(p, n, enemy) {
      if (!G.cd('betray:' + p.id, 360 * 10)) return;
      const a = G.A(p.armyId);
      const inc = St.open('betrayal', { title: `${G.pname(p)}の裏切り`, nations: [n.id, enemy.id], actors: [p.id], why: `${G.pname(p)}は君主${G.pname(G.People.ruler(n))}を憎み、負け戦に見切りをつけた。`, at: a });
      if (a) { a.nation = enemy.id; a.color = enemy.color; a.name = `${p.name}の離反軍`; }
      p.nation = enemy.id; G.remember(p, `${G.nname(n)}を裏切り、${G.nname(enemy)}についた。`, 'betray');
      const r = G.People.ruler(n); if (r) G.setRel(r, p, 'hate', -90);
      St.close(inc, `${G.pname(p)}は${a ? a.name + 'ごと' : ''}${G.nname(enemy)}に寝返った。`);
      G.news(`${G.pname(p)}が${G.nname(enemy)}に寝返った！`, { k: 'war', at: a || G.C(n.capital), imp: 3, inc: inc.id });
    },
    rebellion(c) {
      const rng = G.rng, owner = G.N(c.owner); if (!owner) return;
      const home = c.home && c.home !== c.owner ? G.N(c.home) : null;
      const why = home ? `${c.name}はもともと${G.nname(home)}の町。占領への不満が爆発した。` : c.plague ? '疫病と重い税に、民の我慢が限界をこえた。' : c.race !== owner.race ? `${G.raceName(c.race)}の町を${G.raceName(owner.race)}が治めることへの反発。` : '戦争の重い負担に、民が立ち上がった。';
      const inc = St.open('rebellion', { title: `${c.name}の反乱`, nations: [owner.id], why, at: c });
      const rebels = c.pop * 0.05 * (c.unrest / 80);
      if (rebels > c.garrison * 1.2) {
        if (home && home.alive) {
          c.owner = home.id; c.unrest = 30; G.World.refresh(); G.Nations.recomputeBorders();
          St.close(inc, `${G.Y() - (c.lostY || G.Y())}年の占領ののち、反乱軍が${G.nname(owner)}の守備兵を追い出した。${c.name}は${G.nname(home)}にもどった。`);
          if (!G.atWar(home.id, owner.id)) G.rel(home.id, owner.id).tension += 25;
        } else {
          // 同じ種族のとなりの国が、町を受け入れる(解放)
          const libs = G.World.neighborsOfCity(c).map(o => G.N(o.owner)).filter(m => m && m.alive && m !== owner && m.race === c.race);
          if (libs.length && (!home || !G.chars().some(p => p.exileOf === home.id))) {
            const lib = libs.sort((x, y) => G.rel(owner.id, x.id).opinion - G.rel(owner.id, y.id).opinion)[0];
            c.owner = lib.id; c.unrest = 20; c.garrison = rebels * 0.5; G.World.refresh(); G.Nations.recomputeBorders();
            const rr = G.rel(owner.id, lib.id); rr.tension = Math.min(100, rr.tension + 30); rr.opinion -= 20;
            inc.title = `${c.name}の解放`;
            St.close(inc, `${G.raceName(c.race)}の民が${G.nname(owner)}の守備兵を追い出し、同じ${G.raceName(c.race)}の${G.nname(lib)}に助けを求めた。${c.name}は${G.nname(lib)}の町となった。`);
            G.news(`${c.name}で反乱。町は${G.nname(lib)}に加わった。`, { k: 'politics', at: c, imp: 3, inc: inc.id });
            return;
          }
          // 新しい国(自由都市)、または滅んだ国の再興
          const exile = home ? G.chars().find(p => p.exileOf === home.id && ['exile'].includes(p.role)) : null;
          let nn;
          if (home && !home.alive && exile && G.cd('restore:' + home.id, 360 * 30)) {
            nn = home; nn.alive = true; nn.capital = c.id; nn.founded = nn.founded; c.owner = nn.id;
            G.World.refresh(); exile.nation = nn.id; exile.exileOf = null; G.Nations.crown(nn, exile, null, '再興');
            inc.type = 'restoration'; inc.title = `${nn.name}の再興`;
            St.beat(inc, `亡命していた${exile.name}が${c.name}に帰り、${G.nname(nn)}の再興を宣言した。`, { at: c });
          } else {
            const leader = G.People.make({ race: c.race, role: 'rebel', age: rng.int(25, 50), city: c.id, ambition: rng.int(60, 90), traits: [rng.pick(['just', 'brave', 'ambitious'])] });
            const id = G.newId('n');
            nn = G.S.nations[id] = { id, alive: true, name: G.Nations.uniqueName(c.name + (c.race === 'human' ? '自由都市' : '自由領')), short: c.name, form: c.race === 'human' ? '自由都市' : '自由領', race: c.race, color: G.Nations.shade(owner.color, 0.5), capital: c.id, cities: [], ruler: null, treasury: 200, tech: owner.tech, stability: 50, sect: owner.race === c.race ? owner.sect : G.FAITH[c.race].sects[0], weary: 0, founded: G.Y(), parent: null, arms: 0, armsUntil: 0 };
            c.owner = id; c.home = id; G.World.refresh();
            leader.nation = id; G.Nations.crown(nn, leader, null, '反乱');
            St.beat(inc, `${leader.name}に率いられた民衆が守備兵を倒し、${nn.name}を名乗った。`, { at: c });
          }
          c.unrest = 25; c.garrison = rebels * 0.6;
          for (const m of G.nations()) if (m !== nn) { const r = G.rel(nn.id, m.id); r.border = G.World.borders(nn, m); r.opinion = m.race === nn.race ? 0 : -30; }
          G.Nations.recomputeBorders();
          inc.data.nation = nn.id;
          const or = G.People.ruler(owner);
          if (owner.weary > 45 || (or && (G.hasTrait(or, 'gentle') || G.hasTrait(or, 'peaceful'))) || G.rng.chance(0.3)) {
            const r2 = G.rel(owner.id, nn.id); r2.state = 'truce'; r2.truce = G.S.day + 360 * G.rng.int(6, 12);
            St.beat(inc, `${or ? G.pname(or) : G.nname(owner)}は兵を送らず、${G.nname(nn)}の独立をしぶしぶ認めた。`);
            St.close(inc, inc.type === 'restoration' ? `${G.nname(nn)}は${G.Y() - Math.floor(((G.vals(G.S.nations).find(x => x.id === nn.id) || {}).fell || 0) / 360) - G.CFG.START_YEAR}年ぶりによみがえった。${G.pname(G.P(nn.ruler))}が国を率いる。` : `${G.nname(nn)}が生まれた。君主は${G.pname(G.P(nn.ruler))}。`);
          } else G.Nations.declareWar(owner, nn, '反乱の鎮圧', { cause: inc.id });
          G.focus(c.x, c.y, inc.title, { k: 'rebel' });
        }
      } else {
        c.garrison *= 0.8; c.pop *= 0.95; c.unrest = 40;
        St.close(inc, `反乱は${G.nname(owner)}の守備兵にしずめられた。多くの民が捕らえられた。`);
      }
      G.news(`${c.name}で反乱が起きた。`, { k: 'politics', at: c, imp: 3, inc: inc.id });
    },
    plague(c, goddess) {
      c.plague = G.rng.int(4, 9);
      const inc = St.open('plague', { title: `${c.name}の疫病`, nations: [c.owner], why: goddess ? '原因は誰にもわからない。' : G.rng.pick(['港から来た船が病を運んだらしい。', '長雨で井戸が汚れた。', '戦で倒れた兵の遺体から病が広がった。']), at: c });
      St.beat(inc, `${c.name}で疫病が広がっている。人々は神殿に集まり、女神に救いを祈っている。`, { at: c });
      G.news(`${c.name}で疫病が発生した。`, { k: 'disaster', at: c, imp: 2, inc: inc.id });
      G.fx('plague', c.x, c.y, { days: c.plague * 30, city: c.id });
      inc.data.city = c.id;
      return inc;
    },
    meet(a, b, byGoddess) {
      const rng = G.rng;
      // 相性: 温厚・正義・平和主義は友情に、残酷・誇り・執念は敵対に
      let s = rng.int(-20, 30);
      for (const p of [a, b]) for (const t of p.traits) s += { gentle: 18, just: 12, peaceful: 22, curious: 10, brave: 6, cruel: -22, proud: -10, vengeful: -14, cunning: -4 }[t] || 0;
      if (a.hate && a.hate[b.nation]) s -= a.hate[b.nation] * 0.5;
      if (b.hate && b.hate[a.nation]) s -= b.hate[a.nation] * 0.5;
      if (byGoddess) s += 12;
      const love = s > 40 && a.sex !== b.sex && !a.spouse && !b.spouse && rng.chance(0.35);
      const kind = love ? 'love' : s > 15 ? 'friend' : s < -15 ? 'rival' : 'friend';
      const v = love ? 60 : G.clamp(s, -70, 70);
      G.setRel(a, b, kind, v, kind);
      const place = rng.pick(['国境の森', '嵐の夜の山小屋', '戦場跡の川辺', '巡礼の道', '霧の峠']);
      const story = `${G.pname(a)}と${G.pname(b)}: ` + (kind === 'love' ? `${place}で出会った2人は、種族も立場もこえて惹かれあった。` : kind === 'friend' ? `${place}で出会った2人は、互いの国の話を語り合い、友となった。` : `${place}で出会った2人は、すぐに剣を抜いた。互いを宿敵と認めた。`);
      G.remember(a, `${place}で${b.race !== a.race ? G.raceName(b.race) + 'の' : ''}${G.pname(b)}と出会った。`, kind, { who: b.id });
      G.remember(b, `${place}で${a.race !== b.race ? G.raceName(a.race) + 'の' : ''}${G.pname(a)}と出会った。`, kind, { who: a.id });
      const inc = St.open('friendship', { title: kind === 'rival' ? '宿命の出会い' : a.race !== b.race ? '種族をこえた出会い' : '運命の出会い', nations: [a.nation, b.nation].filter(Boolean), actors: [a.id, b.id], why: byGoddess ? '偶然が重なった(本当は女神のしわざ)。' : '偶然の出会い。', at: G.People.where(a) });
      St.close(inc, story);
      return kind;
    }
  };
  G.Story = St;
})(globalThis.GD = globalThis.GD || {});
