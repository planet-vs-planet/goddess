// 左の一覧(国家・種族・人物・戦争・年表)と右の詳細
(function (G) {
  const W = G.World, C = () => G.Chars, esc = s => G.esc(s);
  const $ = s => document.querySelector(s);

  const nLink = id => { const n = W.nation(id); if (!n) return id === -1 ? '魔物' : '?'; return `<a class="lnk" data-sel="nation:${id}"><i class="dot" style="background:${G.Sprites.hexColor(n)}"></i>${esc(n.name)}${n.alive ? '' : '<small>(滅亡)</small>'}</a>`; };
  const cLink = id => { const c = W.char(id); return c ? `<a class="lnk" data-sel="char:${id}">${esc(c.name)}${c.alive ? '' : '<small>†</small>'}</a>` : '—'; };
  const cityLink = i => { const c = W.S.cities[i]; return c ? `<a class="lnk" data-sel="city:${i}">${esc(c.name)}</a>` : '?'; };
  const bar = (v, max, col) => `<span class="bar"><span style="width:${G.clamp(v / max * 100, 0, 100)}%;${col ? 'background:' + col : ''}"></span></span>`;
  const row = (k, v) => `<div class="kv"><span>${k}</span><b>${v}</b></div>`;
  const TYPE_LABEL = { war: '戦', politics: '政', person: '人', disaster: '災', goddess: '神', miracle: '奇', nation: '国', religion: '宗', discovery: '発' };

  const Panels = {
    tab: 'war', charFilter: 'notable', histFilter: '',
    init() {
      $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { Panels.tab = b.dataset.tab; Panels.renderList(true); } });
      $('#list').addEventListener('change', e => {
        if (e.target.id === 'char-filter') { Panels.charFilter = e.target.value; Panels.renderList(true); }
        if (e.target.id === 'hist-filter') { Panels.histFilter = e.target.value; Panels.renderList(true); }
      });
    },

    // ---------- 左の一覧 ----------
    renderList(force) {
      const S = W.S; if (!S) return;
      document.querySelectorAll('#tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === Panels.tab));
      const el = $('#list');
      if (!force && el.matches(':hover') && Panels.tab !== 'history') return; // マウスがのっている間は動かさない
      const top = el.scrollTop;
      let h = '';
      if (Panels.tab === 'war') h = Panels.listWar();
      else if (Panels.tab === 'nations') h = Panels.listNations();
      else if (Panels.tab === 'races') h = Panels.listRaces();
      else if (Panels.tab === 'chars') h = Panels.listChars();
      else if (Panels.tab === 'wars') h = Panels.listWars();
      else if (Panels.tab === 'history') h = Panels.listHistory();
      if (h !== Panels._lastList) { el.innerHTML = h; Panels._lastList = h; el.scrollTop = force ? 0 : top; }
    },
    // 戦況: 2つの陣営と、勇者・魔王
    listWar() {
      const Fa = G.Factions, St = G.Story;
      let h = '';
      for (const side of ['h', 'd']) {
        const S0 = G.SIDES[side];
        const ns = Fa.nationsOf(side).sort((a, b) => W.nationPop(b.id) - W.nationPop(a.id));
        const key = side === 'h' ? St.hero() : St.lord();
        h += `<div class="side-block ${side}"><div class="sb-head"><b>${S0.full}</b><span>戦力 <b>${G.fmt(Fa.power(side))}</b></span><span>${Fa.citiesOf(side).length}都市</span></div>`;
        if (key) h += `<div class="key-figure" data-sel="char:${key.id}">${G.Art.face(key)}<div><small>${side === 'h' ? '勇者' : '魔王'}</small><div class="nm">${esc(key.name)}</div><div class="sub">武力${key.st.war}${key.item ? '・' + esc(key.item) : ''}${key.blessed ? '・女神の加護' : ''}</div></div></div>`;
        else h += `<div class="key-figure empty">${side === 'h' ? '勇者はいない(神の奇跡「勇者の誕生」で生み出せる)' : '魔王はいない'}</div>`;
        const bf = Fa.buffsOf(side);
        if (bf.length) h += `<div class="buffs">${bf.map(b => `<span class="tag gold">${esc(b.label)} ×${b.mult} あと${Math.ceil((b.until - W.S.day) / 30)}か月</span>`).join('')}</div>`;
        for (const n of ns) {
          h += `<div class="item" data-sel="nation:${n.id}"><img class="flag" src="${G.Sprites.flag(n)}" alt=""><div class="grow"><div class="nm">${esc(n.name)}</div><div class="sub">${G.RACES[n.race].name} ・ ${W.citiesOf(n.id).length}都市 ・ ${G.fmt(W.nationPop(n.id))}人</div></div></div>`;
        }
        h += `<div class="roles">${S0.races.map(r => `<div><b>${G.RACES[r].name}</b> ${esc(G.RACE_ROLE[r])}</div>`).join('')}</div></div>`;
      }
      const fallen = Object.values(W.S.nations).filter(n => !n.alive);
      if (fallen.length) h += `<div class="lh">滅んだ国 <small>${fallen.length}</small></div>` + fallen.slice(-12).reverse().map(n => `<div class="item dim" data-sel="nation:${n.id}"><img class="flag" src="${G.Sprites.flag(n)}" alt=""><div class="grow"><div class="nm">${esc(n.name)}</div><div class="sub">${n.founded}年〜${n.fallen}年</div></div></div>`).join('');
      return h;
    },
    listNations() {
      const ns = W.aliveNations().sort((a, b) => W.nationPop(b.id) - W.nationPop(a.id));
      const maxP = Math.max(1, ...ns.map(n => W.nationPop(n.id)));
      let h = `<div class="lh">国家 <small>${ns.length}か国</small></div>`;
      for (const n of ns) {
        const wars = W.warsOf(n.id).length;
        h += `<div class="item${G.View.selected && G.View.selected.type === 'nation' && G.View.selected.id === n.id ? ' sel' : ''}" data-sel="nation:${n.id}">
          <img class="flag" src="${G.Sprites.flag(n)}" alt="">
          <div class="grow"><div class="nm">${esc(n.name)}${wars ? '<span class="tag war">戦争中</span>' : ''}</div>
          <div class="sub">${G.RACES[n.race].name} ・ ${W.citiesOf(n.id).length}都市 ・ ${G.fmt(W.nationPop(n.id))}人</div>
          ${bar(W.nationPop(n.id), maxP, G.Sprites.hexColor(n))}</div></div>`;
      }
      const fallen = Object.values(W.S.nations).filter(n => !n.alive).sort((a, b) => b.fallen - a.fallen);
      if (fallen.length) {
        h += `<div class="lh">滅んだ国 <small>${fallen.length}</small></div>`;
        for (const n of fallen.slice(0, 30)) h += `<div class="item dim" data-sel="nation:${n.id}"><img class="flag" src="${G.Sprites.flag(n)}" alt=""><div class="grow"><div class="nm">${esc(n.name)}</div><div class="sub">${n.founded}年〜${n.fallen}年</div></div></div>`;
      }
      return h;
    },
    racePop() {
      const out = {}; for (const r of G.RACE_KEYS) out[r] = 0;
      for (const c of W.S.cities) for (const r in c.races) out[r] += c.pop * c.races[r];
      return out;
    },
    listRaces() {
      const rp = Panels.racePop();
      const tot = Object.values(rp).reduce((a, b) => a + b, 0);
      let h = '<div class="lh">種族</div>';
      for (const r of G.RACE_KEYS) {
        const R = G.RACES[r];
        const ns = W.aliveNations().filter(n => n.race === r).length;
        const ch = Object.values(W.S.chars).filter(c => c.alive && c.race === r).length;
        h += `<div class="item" data-sel="race:${r}"><span class="race-ico r-${r}"></span><div class="grow"><div class="nm">${R.name}</div>
          <div class="sub">${G.fmt(rp[r])}人 ・ ${ns}か国 ・ 重要人物${ch}人</div>${bar(rp[r], tot, '#c9a45c')}</div></div>`;
      }
      return h;
    },
    listChars() {
      const f = Panels.charFilter;
      let cs = Object.values(W.S.chars).filter(c => c.alive);
      if (f === 'notable') cs = cs.filter(c => c.role !== 'heir' || C().isAdult(c));
      else if (f === 'dead') cs = Object.values(W.S.dead).slice(-200);
      else if (f !== 'all') cs = cs.filter(c => c.role === f || (f === 'rebel' && c.godRebel));
      cs.sort((a, b) => f === 'dead' ? b.death.m - a.death.m : (b.role === 'ruler') - (a.role === 'ruler') || b.fame - a.fame || a.born - b.born);
      let h = `<div class="lh">人物 <small>${Object.keys(W.S.chars).length}人</small>
        <select id="char-filter">${[['notable', '主な人物'], ['all', 'すべて'], ['ruler', '王'], ['hero', '英雄'], ['general', '将軍'], ['mage', '魔法使い'], ['priest', '宗教指導者'], ['merchant', '商人'], ['exile', '亡命者'], ['rebel', '神への反逆者'], ['dead', '亡くなった人']].map(([k, v]) => `<option value="${k}"${k === f ? ' selected' : ''}>${v}</option>`).join('')}</select></div>`;
      for (const c of cs.slice(0, 150)) {
        h += `<div class="item${G.View.selected && G.View.selected.type === 'char' && G.View.selected.id === c.id ? ' sel' : ''}" data-sel="char:${c.id}">${G.Art.face(c)}
          <div class="grow"><div class="nm">${esc(c.name)}${c.blessed ? '<span class="tag gold">加護</span>' : ''}${c.godRebel ? '<span class="tag war">反逆</span>' : ''}</div>
          <div class="sub">${G.RACES[c.race].name} ・ ${Panels.roleName(c)} ・ ${C().age(c)}歳${c.nation != null ? ' ・ ' + esc(W.nationName(c.nation)) : ''}</div></div></div>`;
      }
      if (!cs.length) h += '<div class="empty">該当する人物はいません</div>';
      return h;
    },
    roleName(c) {
      if (!c.alive) return '故人';
      if (c.role === 'ruler') { const n = W.nation(c.nation); return n ? G.Nations.rulerTitle(n) : '王'; }
      if (c.role === 'heir') return C().isAdult(c) ? '王族' : (c.sex === 'm' ? '王子' : '王女');
      return G.ROLES[c.role] || c.role;
    },
    listWars() {
      const S = W.S;
      const act = Object.values(S.wars).filter(w => !w.ended).sort((a, b) => a.start - b.start);
      const past = Object.values(S.wars).filter(w => w.ended).sort((a, b) => b.endDay - a.endDay);
      let h = `<div class="lh">戦争中 <small>${act.length}</small></div>`;
      if (!act.length) h += '<div class="empty">いまは平和です</div>';
      for (const w of act) h += Panels.warItem(w);
      const mon = Object.values(S.armies).filter(a => a.nation === -1);
      if (mon.length) { h += `<div class="lh">魔物 <small>${mon.length}</small></div>`; for (const a of mon) h += `<div class="item" data-sel="army:${a.id}"><div class="grow"><div class="nm">${esc(a.label)}</div><div class="sub">${G.fmt(a.total)}体</div></div></div>`; }
      if (past.length) { h += `<div class="lh">終わった戦争</div>`; for (const w of past.slice(0, 25)) h += Panels.warItem(w); }
      return h;
    },
    warItem(w) {
      const yrs = Math.max(0, Math.round(((w.ended ? w.endDay : W.S.day) - w.start) / 360));
      const tot = Math.max(1, w.attScore + w.defScore);
      return `<div class="item${w.ended ? ' dim' : ''}" data-sel="war:${w.id}"><div class="grow"><div class="nm">${esc(w.name)}</div>
        <div class="sub">${W.dateText(w.start)}〜${w.ended ? W.dateText(w.endDay) : ''}(${yrs}年)・${esc(w.cause)}</div>
        <div class="warbar"><span style="width:${w.attScore / tot * 100}%;background:${G.Sprites.hexColor(W.nation(w.att[0]) || 0x888888)}"></span><span style="flex:1;background:${G.Sprites.hexColor(W.nation(w.def[0]) || 0x888888)}"></span></div></div></div>`;
    },
    listHistory() {
      const f = Panels.histFilter;
      const list = G.History.list(f || null);
      let h = `<div class="lh">歴史年表 <select id="hist-filter">${[['', 'すべて'], ['war', '戦争'], ['politics', '政治'], ['nation', '国家'], ['person', '人物'], ['disaster', '災害'], ['goddess', '女神'], ['religion', '宗教'], ['discovery', '発見']].map(([k, v]) => `<option value="${k}"${k === f ? ' selected' : ''}>${v}</option>`).join('')}</select></div>`;
      let lastY = null;
      for (const e of list.slice(0, 250)) {
        if (e.y !== lastY) { h += `<div class="yr">${e.y}年${e.pre ? '<small>(女神が眠っていた時代)</small>' : ''}</div>`; lastY = e.y; }
        h += `<div class="hist t-${e.type}${e.imp >= 3 ? ' big' : ''}"${e.x != null ? ` data-focus="${e.x},${e.y2}"` : ''}><b>${esc(e.title)}</b><span>${esc(e.text)}</span></div>`;
      }
      return h;
    },

    positionOf(type, id) {
      const S = W.S;
      if (type === 'city') return S.cities[id];
      if (type === 'army') return S.armies[id];
      if (type === 'nation') return W.capitalOf(id);
      if (type === 'char') { const c = W.char(id); if (!c) return null; const a = Object.values(S.armies).find(a => a.cmd === id); if (a) return a; return S.cities[c.home] || (c.nation != null ? W.capitalOf(c.nation) : null); }
      if (type === 'war') { const w = S.wars[id]; return w ? W.capitalOf(w.def[0]) : null; }
      if (type === 'tile') return id;
      if (type === 'ruin') return S.ruins[id];
      return null;
    },

    // ---------- 右の詳細 ----------
    renderDetail(force) {
      const el = $('#detail'); const sel = G.View.selected;
      if (!W.S) return;
      if (!force && el.matches(':hover')) return;
      let h = '';
      if (!sel) h = Panels.dReport();
      else if (sel.type === 'nation') h = Panels.dNation(W.nation(sel.id));
      else if (sel.type === 'city') h = Panels.dCity(W.S.cities[sel.id]);
      else if (sel.type === 'char') h = Panels.dChar(W.char(sel.id));
      else if (sel.type === 'army') h = Panels.dArmy(W.S.armies[sel.id]);
      else if (sel.type === 'war') h = Panels.dWar(W.S.wars[sel.id]);
      else if (sel.type === 'race') h = Panels.dRace(sel.id);
      else if (sel.type === 'tile') h = Panels.dTile(sel.id);
      else if (sel.type === 'ruin') h = Panels.dRuin(W.S.ruins[sel.id]);
      else if (sel.type === 'pickchar') h = Panels.dPickChar(sel.id);
      else if (sel.type === 'event') h = Panels.dEvent(W.S.log[sel.id]);
      if (!h) h = `<div class="empty">この対象はもういません。</div>` + Panels.dWorld();
      if (h !== Panels._lastDetail) { const top = el.scrollTop; el.innerHTML = h; el.scrollTop = force ? 0 : top; Panels._lastDetail = h; }
    },
    powerBtn(key, type, id) {
      const p = G.Powers.get(key), can = W.S.goddess.power >= p.cost;
      return `<button class="pbtn${can ? '' : ' cant'}" data-use="${key}:${type}:${id}" title="${esc(p.desc)}">${G.Art.powerIcon(key)}${p.name}<small>神力${p.cost}</small></button>`;
    },
    // 側近の助言(次に何をすればいいか)
    advice() {
      const S = W.S, Fa = G.Factions, b = Fa.balance(), g = S.goddess;
      if (S.ended && S.ended.final) return '物語は終わりました。メニューから新しい世界を始められます。';
      if (S.revolt && S.revolt.active) return '神殺しの同盟が力をつけています。「運命の操作」の「記憶の改ざん」で疑念を消すか、「神罰」で中心の者を討ちましょう。';
      if (S.peace) return '和平交渉が進んでいます! このままでは戦争が終わります。「運命の操作」→「和平の妨害」を急いでください。';
      if (b > 0.7) return '人族が勝ちすぎています。祈りも弱まっています。「邪神の囁き」で魔族に力を与えましょう。';
      if (b > 0.6) return '人族がやや有利です。魔族を少し助けるとよいでしょう。';
      if (b < 0.3) return '魔族が勝ちすぎています。人族が滅びてしまいます。「神の奇跡」で人族を救いましょう。';
      if (b < 0.4) return '魔族がやや有利です。人族は必死に祈っていて、信仰がよく集まっています。危なくなったら奇跡を。';
      if (g.awareness > 55) return '疑念が高まっています。邪神の囁きはしばらくひかえるか、「記憶の改ざん」を考えましょう。';
      if (g.power > g.max * 0.8) return '信仰がたまっています。「衝突の導き」で戦いを起こしたり、強い介入に使いましょう。';
      return '戦況は女神さまの望みどおり、拮抗しています。このまま見守るのもひとつの手です。';
    },
    dReport() {
      const S = W.S, r = S.lastReport, Fa = G.Factions;
      let h = `<div class="report">`;
      h += `<div class="advice"><img src="${G.StoryUI.art('aide')}" alt=""><div><small>影の側近 ノクス</small><p>${esc(Panels.advice())}</p></div></div>`;
      if (!r) {
        h += `<div class="dh"><div class="title">今月の報告</div></div><p class="hint">「次の月へ」を押すと、1か月の戦いの結果がここに出ます。</p>`;
        return h + Panels.dWorldBrief() + '</div>';
      }
      const ym = S.startYear + Math.floor(r.month / 12) + '年' + (r.month % 12 + 1) + '月';
      const dh = r.endH - (r.startH || r.endH), dd = r.endD - (r.startD || r.endD);
      h += `<div class="dh"><div><div class="title">今月の報告</div><div class="sub">${ym}</div></div></div>`;
      const bb = Math.round(r.balBefore * 100), ba = Math.round(r.bal * 100);
      h += `<div class="rp-bal"><span>戦況</span><div class="mini-bar"><i style="width:${ba}%"></i><u style="left:${bb}%"></u></div><b>${Fa.balanceLabel(r.bal).t}</b></div>`;
      h += `<div class="rp-grid">
        <div><small>戦い</small><b>${r.battles}回</b></div>
        <div><small>人族の損害</small><b>${G.fmt(r.lossH)}人</b></div>
        <div><small>魔族の損害</small><b>${G.fmt(r.lossD)}人</b></div>
        <div><small>うばった都市</small><b>人族${r.citiesH}・魔族${r.citiesD}</b></div></div>`;
      const f = r.faith;
      h += `<div class="rp-faith"><div class="rf-top"><span>信仰</span><b class="${f >= 0 ? 'pos' : 'neg'}">${f >= 0 ? '+' : ''}${f.toFixed(1)}</b></div>${(r.faithFrom || []).filter(p => Math.abs(p.v) > 0.05).map(p => `<div class="rf-row"><span>${esc(p.t)}</span><span>${p.v >= 0 ? '+' : ''}${p.v.toFixed(1)}</span></div>`).join('')}</div>`;
      if (r.used) h += `<div class="kv"><span>今月の介入</span><b>${esc(r.used)}</b></div>`;
      if (r.events && r.events.length) h += `<div class="sect">今月の出来事</div>` + r.events.slice().reverse().map(e => `<div class="hist t-${e.type}"${e.x != null ? ` data-focus="${e.x},${e.y}"` : ''}><b>${esc(e.title)}</b><span>${esc(e.text)}</span></div>`).join('');
      return h + Panels.dWorldBrief() + '</div>';
    },
    dWorldBrief() {
      const S = W.S, g = S.goddess;
      let h = `<div class="sect">女神</div>`;
      h += row('女神のレベル', `Lv${g.level}${G.Faith.nextLevelAt(g.level) ? ` <small>(次まで ${G.fmt(G.Faith.nextLevelAt(g.level) - g.total)})</small>` : ''}`);
      h += row('物語', ['はじまり', '魔王の紋章', '女神の痕跡', '勇者と魔王の疑い', '真実の露見'][S.story ? S.story.beat : 0]);
      return h + Panels.chart();
    },
    dWorld() {
      const S = W.S, st = S.stats;
      let h = `<div class="dh"><div class="title">世界のようす</div><div class="sub">${W.dateText()}・開始から${W.year() - S.startYear}年</div></div>`;
      h += row('国家', `${W.aliveNations().length}か国(滅亡 ${Object.values(S.nations).filter(n => !n.alive).length})`);
      h += row('都市', S.cities.length);
      h += row('人口', G.fmt(W.worldPop()) + '人');
      h += row('戦争', Object.values(S.wars).filter(w => !w.ended).length + '件');
      h += row('重要人物', Object.keys(S.chars).length + '人');
      h += row('神の存在の認知', Math.round(S.goddess.awareness) + ' / 100');
      if (S.goddess.rebels.length) h += row('神への反逆者', S.goddess.rebels.filter(id => W.liveChar(id)).length + '人');
      h += Panels.chart();
      h += `<div class="hint">地図の都市・軍隊・土地をクリックすると、ここに詳しい情報が出ます。</div>`;
      return h;
    },
    // 国ごとの人口の移り変わり(積み上げグラフ)
    chart() {
      const st = W.S.stats; if (st.length < 2) return '';
      const w = 280, h = 110, ids = new Set();
      for (const s of st) for (const id in s.per) ids.add(id);
      const maxP = Math.max(...st.map(s => s.pop));
      const xs = i => i / (st.length - 1) * w;
      let paths = '';
      const base = st.map(() => 0);
      for (const id of ids) {
        const n = W.S.nations[id]; if (!n) continue;
        const top = st.map((s, i) => base[i] + (s.per[id] || 0));
        let d = `M${xs(0)},${h - base[0] / maxP * h}`;
        top.forEach((v, i) => d += `L${xs(i)},${h - v / maxP * h}`);
        for (let i = st.length - 1; i >= 0; i--) d += `L${xs(i)},${h - base[i] / maxP * h}`;
        paths += `<path d="${d}Z" fill="${G.Sprites.hexColor(n)}" opacity="0.85"><title>${esc(n.name)}</title></path>`;
        top.forEach((v, i) => base[i] = v);
      }
      return `<div class="sect">国ごとの人口の移り変わり</div><svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${paths}</svg><div class="chart-x"><span>${st[0].y}年</span><span>${st[st.length - 1].y}年</span></div>`;
    },
    dNation(n) {
      if (!n) return '';
      const S = W.S;
      const ruler = W.char(n.ruler);
      const cities = W.citiesOf(n.id).sort((a, b) => b.pop - a.pop);
      let h = `<div class="dh"><img class="bigflag" src="${G.Sprites.flag(n)}" alt=""><div><div class="title">${esc(n.name)}</div>
        <div class="sub">${G.RACES[n.race].name}の国 ・ ${n.founded}年建国${n.alive ? '' : ` ・ <b class="red">${n.fallen}年滅亡</b>`}</div></div></div>`;
      h += `<div class="btns"><button data-focus="${W.capitalOf(n.id) ? W.capitalOf(n.id).x + ',' + W.capitalOf(n.id).y : ''}">地図で見る</button><span class="tag side-${n.side}">${G.SIDES[n.side].full}</span></div>`;
      if (ruler) h += `<div class="person-row" data-sel="char:${ruler.id}">${G.Art.face(ruler)}<div><small>${n.alive ? G.Nations.rulerTitle(n) : '最後の王'}</small><div class="nm">${esc(ruler.name)}</div><div class="sub">${C().age(ruler)}歳 ・ ${G.Personality.traitNames(ruler).join('・')}</div></div></div>`;
      if (!n.alive) return h + Panels.nationHistory(n);
      h += row('方針', G.GOALS[n.goal].name);
      h += row('宗教', esc((S.religions[n.religion] || {}).name || '?'));
      h += row('人口', G.fmt(W.nationPop(n.id)) + '人');
      h += row('領土', `${cities.length}都市`);
      h += `<div class="kv"><span>軍事力</span><b>${G.fmt(n.military || 0)}</b></div>`;
      h += `<div class="kv"><span>技術</span><b>Lv ${Math.floor(n.tech)}</b></div>`;
      h += `<div class="kv"><span>安定度</span>${bar(n.stability, 100, n.stability < 30 ? '#c0392b' : '#6fa86a')}<b>${Math.round(n.stability)}</b></div>`;
      h += `<div class="kv"><span>国民の満足度</span>${bar(n.satisfaction, 100, '#5b8fd9')}<b>${n.satisfaction}</b></div>`;
      h += `<div class="kv"><span>女神への信仰</span>${bar(n.faith * 100, 100, '#e8d48b')}<b>${Math.round(n.faith * 100)}</b></div>`;
      h += `<div class="sect">都市</div>` + cities.map(c => `<div class="mini" data-sel="city:${c.id}">${c.id === n.capital ? '★' : '・'}${esc(c.name)} <small>${G.CITY_LEVELS[c.level].name} ${G.fmt(c.pop)}人</small></div>`).join('');
      const wars = W.warsOf(n.id);
      if (wars.length) h += `<div class="sect">戦争</div>` + wars.map(w => `<div class="mini red" data-sel="war:${w.id}">⚔ ${esc(w.name)}</div>`).join('');
      h += `<div class="sect">外交</div>`;
      const others = W.aliveNations().filter(m => m.id !== n.id).map(m => ({ m, r: W.rel(n.id, m.id) })).sort((a, b) => b.r.v - a.r.v);
      for (const { m, r } of others) {
        const tags = [W.atWar(n.id, m.id) ? '<span class="tag war">戦争</span>' : '', r.alliance ? '<span class="tag ok">同盟</span>' : '', r.nap ? '<span class="tag">不可侵</span>' : '', r.trade ? '<span class="tag">貿易</span>' : '', r.truce > S.day ? '<span class="tag">停戦</span>' : ''].join('');
        h += `<div class="dip">${nLink(m.id)}${tags}<span class="relv ${r.v >= 0 ? 'pos' : 'neg'}">${r.v > 0 ? '+' : ''}${Math.round(r.v)}</span></div>`;
      }
      const people = W.charsOf(n.id).filter(c => c.id !== n.ruler).sort((a, b) => b.fame - a.fame);
      h += `<div class="sect">人物 (${people.length})</div>` + people.slice(0, 14).map(c => `<div class="mini" data-sel="char:${c.id}">${esc(c.name)} <small>${Panels.roleName(c)}</small></div>`).join('');
      h += Panels.nationHistory(n);
      return h;
    },
    nationHistory(n) {
      const list = W.S.history.filter(e => e.title.includes(n.short) || e.text.includes(n.name)).slice(-12).reverse();
      if (!list.length) return '';
      return `<div class="sect">この国の歴史</div>` + list.map(e => `<div class="hist t-${e.type}"><b>${e.y}年 ${esc(e.title)}</b></div>`).join('');
    },
    dCity(c) {
      if (!c) return '';
      const n = W.nation(c.owner), info = G.Map.W.cityInfo[c.id];
      let h = `<div class="dh"><div><div class="title">${esc(c.name)}</div><div class="sub">${G.CITY_LEVELS[c.level].name}${n && n.capital === c.id ? ' ・ 首都' : ''} ・ ${n ? nLink(n.id) : '無所属'}</div></div></div>`;
      h += `<div class="btns"><button data-focus="${c.x},${c.y}">地図で見る</button></div>`;
      h += row('人口', G.fmt(c.pop) + `人 <small>(養える人数 ${G.fmt(c.cap || 0)})</small>`);
      const races = Object.keys(c.races).sort((a, b) => c.races[b] - c.races[a]).map(r => `${G.RACES[r].name} ${Math.round(c.races[r] * 100)}%`).join('・');
      h += row('住民', races);
      h += row('宗教', esc((W.S.religions[c.religion] || {}).name || '?'));
      h += `<div class="kv"><span>治安</span>${bar(100 - c.unrest, 100, c.unrest > 70 ? '#c0392b' : '#6fa86a')}<b>${Math.round(100 - c.unrest)}</b></div>`;
      const dev = Math.min(100, Math.round(c.pop / 150 + Object.values(c.buildings).reduce((a, b) => a + b, 0) * 3));
      h += `<div class="kv"><span>発展度</span>${bar(dev, 100, '#c9a45c')}<b>${dev}</b></div>`;
      const st = [];
      if (c.famine) st.push('<span class="tag war">ききん</span>');
      if (c.mods.plague > W.S.day) st.push('<span class="tag war">疫病</span>');
      if (c.mods.drought > W.S.day) st.push('<span class="tag">干ばつ</span>');
      if (c.mods.harvest > W.S.day) st.push('<span class="tag gold">豊作</span>');
      if (c.unrest > 80) st.push('<span class="tag war">反乱の危機</span>');
      if (st.length) h += `<div class="kv"><span>状態</span><b>${st.join('')}</b></div>`;
      const bl = Object.keys(c.buildings).filter(k => c.buildings[k] > 0);
      h += `<div class="sect">建物</div><div class="blds">${bl.length ? bl.map(k => `<span class="bld b-${k}">${G.BUILDINGS[k].name}${c.buildings[k] > 1 ? '×' + c.buildings[k] : ''}</span>`).join('') : '<small>まだありません</small>'}</div>`;
      const ter = Object.entries(info.counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${G.TERRAIN.find(t => t.key === k).name} ${Math.round(v / info.tiles * 100)}%`).join('・');
      h += row('土地', ter);
      const hist = W.S.history.filter(e => e.text.includes(c.name)).slice(-8).reverse();
      if (hist.length) h += `<div class="sect">この都市の出来事</div>` + hist.map(e => `<div class="hist t-${e.type}"><b>${e.y}年 ${esc(e.title)}</b></div>`).join('');
      return h;
    },
    dChar(c) {
      if (!c) return '';
      const P = G.Personality, Ch = C();
      let h = `<div class="dh">${G.Art.face(c, "bigface")}<div><div class="title">${esc(c.name)}</div>
        <div class="sub">${G.RACES[c.race].name} ・ ${c.sex === 'm' ? '男性' : '女性'} ・ ${Ch.age(c)}歳 ・ ${Panels.roleName(c)}</div>
        <div class="sub">${c.nation != null ? nLink(c.nation) : (c.exileOf != null ? '亡命中(元 ' + nLink(c.exileOf) + ')' : '国に属さない')}</div></div></div>`;
      if (!c.alive) h += `<div class="death">${W.S.startYear + Math.floor(c.death.m / 12)}年に亡くなった(${esc(c.death.cause)})</div>`;
      h += `<div class="btns"><button data-sel="char:${c.id}" data-focus="${(Panels.positionOf('char', c.id) || { x: 0 }).x},${(Panels.positionOf('char', c.id) || { y: 0 }).y}">地図で見る</button></div>`;
      h += `<div class="tags">${c.traits.map(t => `<span class="tag trait">${G.TRAITS[t].name}</span>`).join('')}${c.blessed ? '<span class="tag gold">女神の加護</span>' : ''}${c.godRebel ? '<span class="tag war">神への反逆者</span>' : ''}${c.item ? `<span class="tag gold">${esc(c.item)}</span>` : ''}</div>`;
      h += `<div class="stats">${Object.keys(G.STAT_NAMES).map(k => `<div class="kv"><span>${G.STAT_NAMES[k]}</span>${bar(c.st[k], 100)}<b>${c.st[k]}</b></div>`).join('')}
        <div class="kv"><span>寿命</span><b>${c.alive ? `あと約${Math.max(0, c.life - Ch.age(c))}年` : '—'}</b></div><div class="kv"><span>名声</span><b>${Math.round(c.fame)}</b></div></div>`;
      // 家族
      const fam = [];
      if (c.father != null) fam.push(['父', c.father]);
      if (c.mother != null) fam.push(['母', c.mother]);
      if (c.spouse != null) fam.push(['配偶者', c.spouse]);
      for (const k of c.children) fam.push([W.char(k) && W.char(k).sex === 'f' ? '娘' : '息子', k]);
      if (fam.length) h += `<div class="sect">家族</div>` + fam.map(([r, id]) => `<div class="mini"><small>${r}</small> ${cLink(id)}</div>`).join('');
      // 人間関係
      const rels = Object.keys(c.rel).map(id => ({ id: +id, r: c.rel[id], k: Ch.relKind(c, id) })).filter(x => x.k && x.k !== '配偶者' && W.char(x.id));
      if (rels.length) h += `<div class="sect">人間関係</div>` + rels.map(x => `<div class="mini"><span class="tag ${/仇|敵/.test(x.k) ? 'war' : 'ok'}">${x.k}</span> ${cLink(x.id)} <small>${x.r.t ? '信頼' + Math.round(x.r.t) : ''} ${x.r.h > 10 ? '憎しみ' + Math.round(x.r.h) : ''}</small></div>`).join('');
      const att = Object.keys(c.raceAtt).filter(r => Math.abs(c.raceAtt[r]) > 12);
      if (att.length) h += `<div class="sect">種族への思い</div>` + att.map(r => `<div class="mini">${G.RACES[r].name}: <b class="${c.raceAtt[r] < 0 ? 'red' : 'grn'}">${c.raceAtt[r] < 0 ? '憎んでいる' : '好意的'}</b></div>`).join('');
      if (c.mem.length) h += `<div class="sect">過去の記録</div>` + c.mem.slice().reverse().map(m => `<div class="mem"><small>${m.y}年</small> ${esc(m.t)}</div>`).join('');
      return h;
    },
    dArmy(a) {
      if (!a) return '';
      const cmd = W.char(a.cmd);
      const st = { march: '進軍中', siege: '包囲中', battle: '戦闘中', retreat: '撤退中', idle: '待機中' }[a.state] || a.state;
      let tgt = '';
      if (a.target && a.target.type === 'city') tgt = `${cityLink(a.target.id)}${a.state === 'siege' ? `(包囲 ${Math.round(a.siege)}%)` : 'へ向かっている'}`;
      if (a.target && a.target.type === 'army') tgt = '敵軍を追っている';
      if (a.target && a.target.type === 'home') tgt = `${cityLink(a.target.id)}へ帰還中`;
      let h = `<div class="dh"><div><div class="title">${a.nation === -1 ? esc(a.label) : esc(W.nationName(a.nation)) + '軍'}</div><div class="sub">${st}</div></div></div>`;
      const uimg = G.Art.unitImage(a);
      if (uimg) h += `<div class="pic"><img src="${uimg}" alt=""></div>`;
      h += `<div class="btns"><button data-focus="${a.x},${a.y}">地図で見る</button></div>`;
      if (a.nation !== -1) h += row('国', nLink(a.nation));
      h += row('兵の数', G.fmt(a.total) + (a.nation === -1 ? '体' : '人'));
      if (cmd) h += row('指揮官', cLink(cmd.id) + ` <small>武力${cmd.st.war}</small>`);
      if (tgt) h += row('目的', tgt);
      h += `<div class="kv"><span>士気</span>${bar(a.morale * 100, 100, '#e0a040')}<b>${Math.round(a.morale * 100)}</b></div>`;
      h += `<div class="kv"><span>補給</span>${bar(a.supply * 100, 100, '#5b8fd9')}<b>${Math.round(a.supply * 100)}</b></div>`;
      if (a.buff && a.buff.until > W.S.day) h += row('奇跡', '<span class="tag gold">力が1.5倍</span>');
      h += `<div class="sect">兵種</div>` + Object.keys(a.troops).map(k => `<div class="kv"><span>${G.UNIT_BY_KEY[k].name}</span><b>${G.fmt(a.troops[k])}</b></div>`).join('');
      h += row('強さ(めやす)', G.fmt(G.Battle.armyPower(a, null)));
      return h;
    },
    dWar(w) {
      if (!w) return '';
      const yrs = Math.round(((w.ended ? w.endDay : W.S.day) - w.start) / 360);
      let h = `<div class="dh"><div><div class="title">${esc(w.name)}</div><div class="sub">${W.dateText(w.start)}〜${w.ended ? W.dateText(w.endDay) : '続いている'}(${yrs}年)</div></div></div>`;
      h += row('原因', esc(w.cause));
      h += `<div class="sides"><div><div class="sect">攻めた側</div>${w.att.map(id => `<div>${nLink(id)}</div>`).join('')}<div class="score">${w.attScore}点</div></div><div><div class="sect">守った側</div>${w.def.map(id => `<div>${nLink(id)}</div>`).join('')}<div class="score">${w.defScore}点</div></div></div>`;
      h += row('戦闘', w.battles + '回');
      h += row('戦死者', `約${G.fmt(w.attLoss + w.defLoss)}人`);
      if (w.ended) h += row('結果', w.result === 'draw' ? '引き分け' : (w.result === 'att' ? '攻めた側の勝利' : '守った側の勝利'));
      const armies = Object.values(W.S.armies).filter(a => w.att.includes(a.nation) || w.def.includes(a.nation));
      if (armies.length && !w.ended) h += `<div class="sect">戦場の軍</div>` + armies.map(a => `<div class="mini" data-sel="army:${a.id}">${esc(W.nationName(a.nation))}軍 <small>${G.fmt(a.total)}人</small></div>`).join('');
      const ev = W.S.history.filter(e => e.y * 12 + e.m >= W.S.startYear * 12 + Math.floor(w.start / 30) && (e.text.includes(W.nationName(w.att[0])) || e.title.includes(w.name)) && e.type === 'war').slice(-10);
      if (ev.length) h += `<div class="sect">戦いの記録</div>` + ev.map(e => `<div class="hist t-war"${e.x != null ? ` data-focus="${e.x},${e.y2}"` : ''}><b>${e.y}年 ${esc(e.title)}</b><span>${esc(e.text)}</span></div>`).join('');
      return h;
    },
    dRace(r) {
      const R = G.RACES[r]; if (!R) return '';
      const rp = Panels.racePop();
      let h = `<div class="dh"><span class="race-ico big r-${r}"></span><div><div class="title">${R.name}</div><div class="sub">${G.fmt(rp[r])}人</div></div></div>`;
      h += `<p class="desc">${R.desc}</p>`;
      h += row('寿命', `${R.life[0]}〜${R.life[1]}年`);
      h += row('人口の増えやすさ', '★'.repeat(Math.max(1, Math.round(R.growth * 4))));
      h += row('魔法', '★'.repeat(Math.round(R.magic * 3)));
      h += row('個の強さ', '★'.repeat(Math.min(6, Math.round(R.power * 2))));
      h += row('信仰', esc(W.S.religions[R.religion].name));
      h += `<div class="sect">兵種</div><div class="blds">${G.UNITS[r].map(u => `<span class="bld">${u.name}</span>`).join('')}</div>`;
      const ns = W.aliveNations().filter(n => n.race === r);
      if (ns.length) h += `<div class="sect">${R.name}の国</div>` + ns.map(n => `<div class="mini">${nLink(n.id)}</div>`).join('');
      const cs = Object.values(W.S.chars).filter(c => c.alive && c.race === r).sort((a, b) => b.fame - a.fame).slice(0, 10);
      if (cs.length) h += `<div class="sect">主な人物</div>` + cs.map(c => `<div class="mini">${cLink(c.id)} <small>${Panels.roleName(c)}</small></div>`).join('');
      return h;
    },
    dTile(p) {
      const MW = G.Map.W, i = G.Map.idx(p.x, p.y), ter = G.TERRAIN[MW.t[i]];
      const r = MW.region[i];
      let h = `<div class="dh"><span class="terr-ico t-${ter.key}"></span><div><div class="title">${ter.name}</div><div class="sub">(${p.x}, ${p.y})</div></div></div>`;
      const timg = G.Art.terrainImage(ter.key);
      if (timg) h += `<div class="pic"><img src="${timg}" alt=""></div>`;
      if (!ter.water) {
        h += row('移動のしやすさ', ter.move <= 1.1 ? 'ふつう' : ter.move < 2 ? 'やや遅い' : ter.move < 3 ? '遅い' : 'とても遅い');
        h += row('食料', '★'.repeat(Math.round(ter.food * 3)) || '—');
        h += row('木材', '★'.repeat(Math.round(ter.wood * 3)) || '—');
        h += row('鉱石', '★'.repeat(Math.round(ter.ore * 3)) || '—');
        h += row('守りやすさ', ter.def ? '+' + Math.round(ter.def * 100) + '%' : '—');
      }
      if (r >= 0) { const c = W.S.cities[r]; h += row('領地', `${cityLink(c.id)} / ${c.owner != null ? nLink(c.owner) : '無所属'}`); }
      else if (!ter.water) h += row('領地', 'だれの土地でもない');
      return h;
    },
    dRuin(r) {
      if (!r) return '';
      return `<div class="dh"><div><div class="title">${G.RUINS[r.type].name}</div><div class="sub">${r.found}年に${nLink(r.by)}が発見</div></div></div><div class="btns"><button data-focus="${r.x},${r.y}">地図で見る</button></div>`;
    },
    dEvent(e) {
      if (!e) return '';
      const img = G.Art.eventImage(e);
      let h = img ? `<div class="pic wide"><img src="${img}" alt=""></div>` : '';
      h += `<div class="dh"><div><div class="title">${esc(e.title)}</div><div class="sub">${W.dateText(e.d)}</div></div></div>`;
      h += `<p class="evtext">${esc(e.text)}</p>`;
      if (e.x != null) h += `<div class="btns"><button data-focus="${e.x},${e.y}">地図で見る</button></div>`;
      const ns = (e.n || []).filter(id => W.nation(id));
      if (ns.length) h += `<div class="sect">関わった国</div>` + ns.map(id => `<div class="mini">${nLink(id)}</div>`).join('');
      const cs = (e.c || []).filter(id => W.char(id));
      if (cs.length) h += `<div class="sect">関わった人物</div>` + cs.map(id => { const c = W.char(id); return `<div class="item" data-sel="char:${id}">${G.Art.face(c)}<div class="grow"><div class="nm">${esc(c.name)}</div><div class="sub">${Panels.roleName(c)}</div></div></div>`; }).join('');
      return h;
    },
    dPickChar(key) {
      const p = G.Powers.get(key);
      const cs = Object.values(W.S.chars).filter(c => c.alive && C().isAdult(c)).sort((a, b) => (b.role === 'ruler') - (a.role === 'ruler') || b.fame - a.fame).slice(0, 60);
      let h = `<div class="dh"><div><div class="title">${p.name}をだれに与える?</div><div class="sub">${esc(p.desc)}(神力${p.cost})</div></div></div>`;
      h += cs.map(c => `<div class="item">${G.Art.face(c)}<div class="grow"><div class="nm"><a class="lnk" data-sel="char:${c.id}">${esc(c.name)}</a></div><div class="sub">${Panels.roleName(c)} ・ ${esc(W.nationName(c.nation))}</div></div>${Panels.powerBtn(key, 'char', c.id)}</div>`).join('');
      return h;
    }
  };
  G.Panels = Panels;
})(globalThis.GD = globalThis.GD || {});
