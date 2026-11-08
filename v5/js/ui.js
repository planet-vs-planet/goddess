// 画面の動き: 上の数字・左の一覧・右の詳細と介入・下の注目の出来事とニュース
(function (G) {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const face = (p, cls) => p ? `<img class="${cls || 'face'}" src="${G.src(`assets/face/${p.face}.jpg`)}" alt="" loading="lazy">` : '';
  const RATE = [0, 5, 14, 36]; // 1秒に進む日数
  const word = {
    stab: v => v > 70 ? '安定' : v > 50 ? 'まずまず' : v > 30 ? '不安定' : '崩壊寸前',
    unrest: v => v > 70 ? '爆発寸前' : v > 45 ? '不穏' : v > 25 ? '不満あり' : '平穏',
    faith: v => v > 80 ? '熱狂的' : v > 60 ? '篤い' : v > 40 ? 'ふつう' : '薄い',
    opinion: v => v > 40 ? '友好' : v > 10 ? 'まずまず' : v > -20 ? '冷ややか' : v > -50 ? '敵対的' : '憎みあう',
    tension: v => v > 70 ? '一触即発' : v > 45 ? '緊張' : v > 20 ? 'ややぴりぴり' : '落ちついている',
    morale: v => v > 70 ? '高い' : v > 45 ? 'ふつう' : v > 25 ? '低い' : '崩れかけ',
    chance: v => v > 0.8 ? 'とても高い' : v > 0.6 ? '高い' : v > 0.4 ? '五分五分' : v > 0.2 ? '低い' : 'とても低い'
  };
  const U = {
    speed: 0, lastRun: 1, holdUntil: 0, newsQ: [], newsHover: false, acc: 0, last: 0, sel: null, tab: 'nations', newsF: '', cfg: null, planCfg: null, dirty: true, spotDirty: true, listDirty: true, peopleF: 'all',
    init() {
      $$('#speed button').forEach(b => b.onclick = () => { G.BGM.start(); U.setSpeed(+b.dataset.sp); });
      $$('#tabs button').forEach(b => b.onclick = () => { U.tab = b.dataset.tab; U.listDirty = true; U.renderList(); });
      $$('#news-filter button').forEach(b => b.onclick = () => { U.newsF = b.dataset.f; $$('#news-filter button').forEach(x => x.classList.toggle('on', x === b)); U.renderNews(); });
      $$('#zoom button').forEach(b => b.onclick = () => { const R = G.Render; if (b.dataset.z === 'fit') R.fit(); else { R.cam.z *= b.dataset.z === 'in' ? 1.35 : 0.74; R.clamp(); } });
      $('#btn-menu').onclick = U.menu;
      $('#btn-left').onclick = () => $('#left').classList.toggle('open');
      $('#right-close').onclick = () => $('#right').classList.remove('open');
      $('#picker-cancel').onclick = () => U.endPick();
      document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; if (e.key === ' ') { e.preventDefault(); U.setSpeed(U.speed ? 0 : (U.lastRun || 1)); } if (e.key === 'Escape') { U.closeModal(); U.endPick(); } });
      // さわっている間は画面を作り直さない(ボタンが消えて押せなくなるのを防ぐ)
      ['#left', '#right', '#bottom', '#modal', '#feed'].forEach(q => { const el = $(q); if (!el) return;
        el.addEventListener('pointerdown', () => { U.holdUntil = performance.now() + 1500; }, true);
        el.addEventListener('pointerup', () => { U.holdUntil = performance.now() + 400; }, true);
        el.addEventListener('pointercancel', () => { U.holdUntil = performance.now() + 400; }, true); });
      const wl = $('#warline'); if (wl) wl.onclick = () => { U.tab = 'wars'; U.renderList(); if (window.innerWidth <= 900) $('#left').classList.add('open'); };
      const nw = $('#news-wrap'); if (nw) { nw.addEventListener('mouseenter', () => U.newsHover = true); nw.addEventListener('mouseleave', () => { U.newsHover = false; }); }
      G.listeners.push(U.on);
      requestAnimationFrame(U.loop);
      setInterval(() => { if (!G.S) return; U.renderTop(); U.renderWars(); U.tickFeed(); if (U.held()) return; U.flushNews(); if (U.speed && U.dirty) { U.renderDetail(true); U.dirty = false; } if (U.spotDirty) { U.renderSpot(); U.spotDirty = false; } if (U.listDirty) { U.renderList(); U.listDirty = false; } }, 500);
    },
    start() {
      U.sel = null; U.cfg = null; U.renderTop(); U.renderSpot(); U.renderList(); U.renderNews(); U.renderDetail(); U.setSpeed(0);
      $$('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.tab === U.tab));
    },
    // ---- 時間 ----
    held() { return performance.now() < U.holdUntil; },
    setSpeed(s) {
      U.speed = s; if (s) U.lastRun = s; $$('#speed button').forEach(b => b.classList.toggle('on', +b.dataset.sp === s));
      if (s) G.BGM.play(G.enemiesCount() ? 'battle' : 'field');
    },
    loop(t) {
      requestAnimationFrame(U.loop);
      const dt = Math.min(0.1, (t - (U.last || t)) / 1000); U.last = t;
      if (!G.S || !U.speed || $('#battle').classList.contains('hidden') === false) return;
      U.acc += dt * RATE[U.speed];
      let n = 0;
      while (U.acc >= 1 && U.speed && n < 60) { G.Sim.day(); U.acc--; n++; }
      if (n) U.dirty = true;
    },
    pause(why) { if (U.speed) { U.setSpeed(0); if (why) U.toast(`⏸ ${why}`); } },
    // ---- 世界からの知らせ ----
    on(type, d) {
      if (!G.S) return;
      if (type === 'news') U.addNews(d);
      if (type === 'incident' || type === 'beat' || type === 'incidentDone') U.spotDirty = true;
      if (type === 'territory') { G.Render.buildTerritory(); U.listDirty = true; }
      if (type === 'month') { G.Render.buildTerritory(); U.listDirty = true; U.spotDirty = true; }
      if (type === 'year') { G.Save.save(); }
      if (type === 'focus') U.focus(d);
      if (type === 'bigBattle') U.bigBattle(d);
      if (type === 'plan') { U.toast(d.status === 'success' ? `✦ 計画成功: ${G.Goddess.planTitle(d)}` : `計画失敗: ${G.Goddess.planTitle(d)}`); U.listDirty = true; }
      if (type === 'goddessResult' && d) U.toast(`✦ ${d.text}`);
    },
    focus(d) {
      const st = G.S.settings;
      const big = ['war', 'split', 'death', 'rebel'].includes(d.k) || (d.k === 'capture' && /首都/.test(d.title)) || (d.k === 'siege');
      if (st.autoCam) G.Render.flyTo(d.x, d.y, Math.max(G.Render.cam.z, 1.7));
      U.banner(d.title);
    },
    bigBattle(b) {
      if (G.S.settings.autoCam) G.Render.flyTo(b.x, b.y, Math.max(G.Render.cam.z, 1.8));
      U.banner(`${b.name}が始まる！`, [['戦場を見る', () => { U.select({ type: 'battle', id: b.id }); G.BattleView.open(b.id); }]]);
    },
    banner(text, btns) {
      const el = $('#banner');
      el.innerHTML = `<span>${esc(text)}</span>` + (btns || []).map((b, i) => `<button class="btn gold small" data-i="${i}">${esc(b[0])}</button>`).join('');
      (btns || []).forEach((b, i) => el.querySelector(`[data-i="${i}"]`).onclick = () => { el.classList.remove('show'); b[1](); });
      el.classList.add('show');
      clearTimeout(U.bannerT); U.bannerT = setTimeout(() => el.classList.remove('show'), btns ? 9000 : 4200);
    },
    toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; $('#toast').appendChild(d); setTimeout(() => d.remove(), 4000); },
    // ---- 上 ----
    renderTop() {
      const g = G.S.goddess;
      $('#t-date').textContent = G.dateStr();
      $('#t-season').textContent = G.season() + (G.enemiesCount() ? ' ・戦争中' : ' ・平和');
      $('#t-power').textContent = Math.floor(g.power);
      $('#t-inc').textContent = `+${g.lastIncome || 0}/月`;
      $('#t-fh').textContent = g.faith.human; $('#t-fd').textContent = g.faith.demon;
      $('#t-pop').textContent = G.fmt(G.sum(G.cities(), c => c.pop));
    },
    // ---- 下: 注目の出来事 ----
    renderSpot() {
      const list = G.Story.spotlight();
      G.Render.spot = list;
      const el = $('#spot');
      const cards = list.map((i, k) => {
        const last = i.beats.filter(b => !b.minor).slice(-1)[0];
        const fut = i.status === 'done' ? '結末: ' + i.result : (G.Story.future(i)[0] || '');
        const who = i.actors.map(G.P).filter(Boolean).slice(0, 4).map(p => face(p)).join('');
        return `<div class="card ${i.status === 'done' ? 'done' : ''}" data-id="${i.id}"><div class="no">${k + 1}</div><div class="ic">${i.icon}</div><h4>${esc(i.title)}</h4><div class="what">${esc(last ? last.t : i.why)}</div><div class="fut">${i.status === 'done' ? '' : '▶ '}${esc(fut)}</div><div class="who">${who}</div></div>`;
      });
      while (cards.length < 3) cards.push(`<div class="card empty">${cards.length ? '' : '世界は静かだ…'}</div>`);
      el.innerHTML = cards.join('');
      $$('#spot .card[data-id]').forEach(c => c.onclick = () => { const i = G.I(c.dataset.id); U.select({ type: 'incident', id: i.id }); if (i.at) G.Render.flyTo(i.at.x, i.at.y, Math.max(G.Render.cam.z, 1.6)); G.BGM.sfx && G.BGM.sfx('click'); });
    },
    // ---- ニュース ----
    addNews(e) {
      if (!e.noFeed) U.feed(e);
      if (U.newsF && e.k !== U.newsF) return;
      if (U.held() || U.newsHover) { U.newsQ.push(e); if (U.newsQ.length > 80) U.newsQ.shift(); return; }
      const el = $('#news'); if (!el) return;
      el.insertAdjacentHTML('afterbegin', U.newsLine(e));
      el.firstElementChild.onclick = () => U.newsClick(e);
      while (el.children.length > 80) el.lastElementChild.remove();
    },
    flushNews() { if (U.newsHover || !U.newsQ.length) return; const q = U.newsQ; U.newsQ = []; for (const e of q) U.addNews(Object.assign({}, e, { noFeed: true })); },
    newsLine(e) { return `<div class="nl ${e.k} imp${e.imp}"><small>${G.CFG.START_YEAR + Math.floor(e.d / 360)}年${Math.floor((e.d % 360) / 30) + 1}月</small>${esc(e.t)}</div>`; },
    newsClick(e) { if (e.inc && G.I(e.inc)) U.select({ type: 'incident', id: e.inc }); if (e.at) G.Render.flyTo(e.at.x, e.at.y, Math.max(G.Render.cam.z, 1.6)); },
    renderNews() {
      const el = $('#news'), list = G.S.log.filter(e => !U.newsF || e.k === U.newsF).slice(-80).reverse();
      el.innerHTML = list.map(U.newsLine).join('');
      [...el.children].forEach((d, i) => d.onclick = () => U.newsClick(list[i]));
    },
    // ---- 地図の上の「いま起きたこと」 ----
    icon(e) {
      const t = e.t || '';
      if (/陥落|占領|奪/.test(t)) return '🏰';
      if (/包囲/.test(t)) return '⛺';
      if (/戦死|亡くな|死ん|暗殺/.test(t)) return '✝';
      if (/宣戦|開戦|攻め/.test(t)) return '⚔';
      if (/和平|講和|休戦|同盟/.test(t)) return '🕊';
      if (/王位|即位|継ぎ|分裂|独立|反乱/.test(t)) return '👑';
      return { war: '⚔', person: '👤', politics: '👑', goddess: '✦', faith: '✟', disaster: '☠' }[e.k] || '•';
    },
    short(t, n) { t = String(t || '').split('。')[0]; return t.length > n ? t.slice(0, n - 1) + '…' : t; },
    feed(e) {
      if (!e || (e.imp || 1) < 2 && e.k !== 'goddess') return;
      if (e.at && e.at.x != null) G.Render.pop(e.at.x, e.at.y, U.icon(e) + ' ' + U.short(e.t, 18), e.k);
      const el = $('#feed-list'); if (!el) return;
      const d = document.createElement('div'); d.className = 'fi ' + (e.k || '');
      d.innerHTML = `<span class="fic">${U.icon(e)}</span><span class="ft">${esc(U.short(e.t, 40))}</span>`;
      d.dataset.t = performance.now(); d.onclick = () => U.newsClick(e);
      el.prepend(d);
      while (el.children.length > 4) el.lastElementChild.remove();
    },
    tickFeed() {
      const now = performance.now();
      $$('#feed-list .fi').forEach(d => { const age = now - +d.dataset.t; if (age > 14000) d.remove(); else d.classList.toggle('old', age > 9000); });
    },
    renderWars() {
      const el = $('#warline'); if (!el) return;
      const ws = G.vals(G.S.wars).filter(w => !w.end);
      const nm = ids => ids.map(G.N).filter(Boolean).map(n => `<b style="color:${n.color}">${esc(n.short || n.name)}</b>`).join('・');
      const h = ws.length ? '⚔ 戦争中: ' + ws.slice(0, 3).map(w => `${nm(w.a)} 対 ${nm(w.b)}`).join(' ／ ') + (ws.length > 3 ? ` ほか${ws.length - 3}` : '') : '🕊 いまは平和';
      if (el.dataset.h !== h) { el.innerHTML = h; el.dataset.h = h; }
    },
    // ---- 左の一覧 ----
    renderList() {
      if (!G.S) return;
      const el = $('#list'), t = U.tab; let h = '';
      $$('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.tab === t));
      if (t === 'nations') {
        for (const race of ['human', 'demon']) {
          h += `<div class="list-head">${G.RACES[race].name}の国</div>`;
          for (const n of G.nations().filter(n => n.race === race)) {
            const r = G.People.ruler(n), en = G.enemiesOf(n);
            h += `<div class="row" data-t="nation" data-id="${n.id}"><span class="sw" style="background:${n.color}"></span><div class="t"><b>${esc(n.name)}</b><small>${r ? esc(G.pname(r)) : '君主不在'} ・ 町${n.cities.length}</small></div>${en.length ? `<span class="tag war">戦争中</span>` : `<span class="tag peace">平和</span>`}</div>`;
          }
        }
        const dead = G.vals(G.S.nations).filter(n => !n.alive);
        if (dead.length) h += `<div class="list-head">滅びた国</div>` + dead.map(n => `<div class="row" style="opacity:.55"><span class="sw" style="background:${n.color}"></span><div class="t"><b>${esc(n.name)}</b><small>${G.dateStr(n.fell)}に滅亡</small></div></div>`).join('');
      } else if (t === 'people') {
        const F = { all: 'すべて', ruler: '君主', hero: '英雄', general: '将軍', heir: '王族', other: 'その他' };
        h += `<div class="seg" style="margin:4px">${Object.keys(F).map(k => `<button data-pf="${k}" class="${U.peopleF === k ? 'on' : ''}">${F[k]}</button>`).join('')}</div>`;
        const order = { ruler: 0, hero: 1, heir: 2, general: 3, priest: 4, rebel: 5, exile: 6, knight: 7, noble: 8 };
        const list = G.chars().filter(p => U.peopleF === 'all' || p.role === U.peopleF || (U.peopleF === 'other' && !['ruler', 'hero', 'general', 'heir'].includes(p.role)))
          .sort((a, b) => (order[a.role] - order[b.role]) || (b.fame - a.fame));
        for (const p of list.slice(0, 120)) {
          const n = G.N(p.nation), m = G.People.mind(p);
          h += `<div class="row" data-t="person" data-id="${p.id}">${face(p)}<div class="t"><b>${esc(G.pname(p))}</b><small>${n ? esc(n.short) : '流浪'}・${G.ageOf(p)}歳・${esc(m.goal)}</small></div></div>`;
        }
      } else if (t === 'cities') {
        for (const n of G.nations()) {
          h += `<div class="list-head" style="color:${n.color}">${esc(n.name)}</div>`;
          for (const cid of n.cities) {
            const c = G.C(cid), st = [c.siege ? '包囲中' : '', c.plague ? '疫病' : '', c.famine ? '飢饉' : '', c.unrest > 60 ? '不穏' : ''].filter(Boolean).join('・');
            h += `<div class="row" data-t="city" data-id="${c.id}"><div class="t"><b>${n.capital === c.id ? '♛ ' : ''}${esc(c.name)}</b><small>人口${G.fmt(c.pop)}・信仰 ${word.faith(c.faith)}${c.race !== n.race ? '・' + G.raceName(c.race) + 'の町' : ''}</small></div>${st ? `<span class="tag war">${st}</span>` : ''}</div>`;
          }
        }
      } else if (t === 'wars') {
        const ws = G.vals(G.S.wars).sort((a, b) => (!!a.end - !!b.end) || b.start - a.start);
        if (!ws.length) h += '<p style="padding:10px;color:var(--dim)">いま戦争はない。</p>';
        for (const w of ws.slice(0, 40)) {
          const a = w.a.map(G.N).filter(Boolean).map(n => n.short).join('・'), b = w.b.map(G.N).filter(Boolean).map(n => n.short).join('・');
          h += `<div class="row" data-t="incident" data-id="${w.inc || ''}"><div class="t"><b>${esc(w.name)}</b><small>${a} 対 ${b} ・ ${G.CFG.START_YEAR + Math.floor(w.start / 360)}年〜${w.end ? (G.CFG.START_YEAR + Math.floor(w.end / 360)) + '年' : ''} ・ 死傷${G.fmt(w.deaths)}</small></div>${w.end ? '<span class="tag">終結</span>' : '<span class="tag war">継続中</span>'}</div>`;
        }
      } else if (t === 'history') {
        const ch = G.S.chronicle.slice().reverse();
        let lastY = null;
        for (const e of ch.slice(0, 250)) {
          h += `<div class="chron ${e.k === 'past' ? 'past' : ''}" ${e.inc ? `data-inc="${e.inc}"` : ''}>${e.y !== lastY ? `<b>${e.y}年</b>` : ''}${esc(e.t)}</div>`;
          lastY = e.y;
        }
      } else if (t === 'plans') {
        const pl = G.S.goddess.plans.slice().reverse();
        h += `<p style="padding:6px 8px;font-size:12px;color:var(--dim);line-height:1.6">長期計画は、人物や国を選んで「長期計画を立てる」から始めます。いくつもの介入を重ねて、歴史を目標へ導きましょう。同時に3つまで。</p>`;
        for (const p of pl) {
          const tips = p.status === 'active' ? G.Goddess.planTips(p) : [];
          h += `<div style="padding:8px;border-bottom:1px solid #ffffff10"><b style="font-family:var(--serif);color:var(--paper)">${esc(G.Goddess.planTitle(p))}</b> <span class="tag ${p.status === 'success' ? 'peace' : p.status === 'fail' ? 'war' : ''}">${{ active: '進行中', success: '成功', fail: '失敗' }[p.status]}</span>
            <div class="bar"><i style="width:${Math.round(p.progress * 100)}%"></i></div><small style="color:var(--dim)">達成度 ${Math.round(p.progress * 100)}% ・ 期限 ${G.dateStr(p.deadline)}${p.why ? ' ・ ' + esc(p.why) : ''}</small>
            ${tips.length ? `<div style="margin-top:6px;font-size:11px;color:var(--gold)">おすすめの介入</div><div class="chips">${tips.map((tp, k) => `<button class="chip" data-plan="${p.id}" data-k="${k}">${esc(G.POWERS[tp[0]].name)}${U.tgtName(tp[1]) ? '(' + esc(U.tgtName(tp[1])) + ')' : ''}</button>`).join('')}</div>` : ''}</div>`;
        }
      }
      el.innerHTML = h;
      el.querySelectorAll('.row[data-t]').forEach(r => r.onclick = () => { if (!r.dataset.id) return; U.select({ type: r.dataset.t, id: r.dataset.id }, true); $('#left').classList.remove('open'); });
      el.querySelectorAll('[data-pf]').forEach(b => b.onclick = () => { U.peopleF = b.dataset.pf; U.renderList(); });
      el.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => { if (G.I(b.dataset.inc)) U.select({ type: 'incident', id: b.dataset.inc }, true); });
      el.querySelectorAll('[data-plan]').forEach(b => b.onclick = () => {
        const p = G.S.goddess.plans.find(x => x.id === b.dataset.plan), tp = G.Goddess.planTips(p)[+b.dataset.k];
        if (!tp[1].id) return;
        U.select(tp[1], true); U.openCfg(tp[0], tp[1], tp[2]); $('#left').classList.remove('open');
      });
    },
    tgtName(t) {
      if (!t) return '';
      if (t.type === 'person') return G.P(t.id) ? G.P(t.id).name : '';
      if (t.type === 'nation') return G.N(t.id) ? G.N(t.id).short : '';
      return '';
    },
    // ---- 選ぶ ----
    select(sel, fly) {
      if (U.picking) { U.pickDone(sel); return; }
      if (sel && sel.type === 'place' && sel.nation && !sel.force) sel = { type: 'nation', id: sel.nation, x: sel.x, y: sel.y };
      U.sel = sel; U.cfg = null; U.planCfg = null;
      G.Render.sel = sel;
      if (sel && sel.type === 'nation') G.Render.buildHighlight(sel.id); else G.Render.hiNation = null;
      if (fly && sel) { const w = U.where(sel); if (w) G.Render.flyTo(w.x, w.y, Math.max(G.Render.cam.z, 1.5)); }
      U.renderDetail(); $('#detail').scrollTop = 0;
      $('#right').classList.toggle('open', !!sel);
      if (U.onSelect) U.onSelect(sel);
    },
    where(sel) {
      if (sel.type === 'person') return G.People.where(G.P(sel.id));
      if (sel.type === 'nation') { const n = G.N(sel.id); return n && G.C(n.capital); }
      if (sel.type === 'city') return G.C(sel.id);
      if (sel.type === 'army') return G.A(sel.id);
      if (sel.type === 'battle') return G.B(sel.id);
      if (sel.type === 'incident') return G.I(sel.id) && G.I(sel.id).at;
      if (sel.type === 'place') return sel;
      return null;
    },
    // 介入の相手を地図・一覧から選ぶ
    startPick(kind, cb, text) { U.picking = { kind, cb }; $('#picker-text').textContent = text; $('#picker').classList.add('on'); $('#right').classList.remove('open'); },
    pickDone(sel) {
      const p = U.picking; if (!p) return;
      let id = null;
      if (p.kind === 'nation') id = sel && (sel.type === 'nation' ? sel.id : sel.type === 'city' ? G.C(sel.id).owner : sel.type === 'place' ? sel.nation : sel.type === 'army' ? G.A(sel.id).nation : null);
      if (p.kind === 'person') id = sel && (sel.type === 'person' ? sel.id : sel.type === 'army' ? G.A(sel.id).cmd : sel.type === 'nation' ? G.N(sel.id).ruler : null);
      if (!id) { U.toast(p.kind === 'nation' ? '国(領土・町)を押してください' : '人物(一覧・軍・国)を押してください'); return; }
      U.endPick(); p.cb(id);
    },
    endPick() { U.picking = null; $('#picker').classList.remove('on'); if (U.sel) $('#right').classList.add('open'); },

    // ---- 右: くわしい情報 ----
    renderDetail(auto) {
      const el = $('#detail'); if (!el) return;
      if (auto && (U.cfg || U.planCfg)) return;
      const s = U.sel;
      let h = '';
      if (!s) h = U.dHome();
      else if (s.type === 'nation') h = U.dNation(G.N(s.id));
      else if (s.type === 'person') h = U.dPerson(G.P(s.id));
      else if (s.type === 'city') h = U.dCity(G.C(s.id));
      else if (s.type === 'army') h = U.dArmy(G.A(s.id));
      else if (s.type === 'battle') h = U.dBattle(G.B(s.id));
      else if (s.type === 'incident') h = U.dIncident(G.I(s.id));
      else if (s.type === 'place') h = U.dPlace(s);
      const st = el.scrollTop;
      el.innerHTML = h || '<p style="color:var(--dim)">もう存在しない。</p>';
      el.scrollTop = st;
      U.bindDetail(el);
    },
    bindDetail(el) {
      el.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => { const [t, id] = b.dataset.sel.split(':'); U.select({ type: t, id }, true); });
      el.querySelectorAll('[data-pw]').forEach(b => b.onclick = () => U.openCfg(b.dataset.pw, U.curTarget()));
      el.querySelectorAll('[data-plan-new]').forEach(b => b.onclick = () => { U.planCfg = { key: b.dataset.planNew, other: null }; U.cfg = null; U.renderDetail(); });
      el.querySelectorAll('[data-place]').forEach(b => b.onclick = () => { const [x, y] = b.dataset.place.split(',').map(Number); U.select({ type: 'place', x, y, nation: G.Map.W.owner[y * G.Map.W.w + x], force: true }); });
      el.querySelectorAll('[data-bv]').forEach(b => b.onclick = () => G.BattleView.open(b.dataset.bv));
      U.bindCfg(el);
    },
    curTarget() {
      const s = U.sel; if (!s) return null;
      if (s.type === 'place') return { type: 'place', x: s.x, y: s.y };
      return { type: s.type, id: s.id };
    },
    dHome() {
      const g = G.S.goddess;
      return `<div class="kind">女神アステリア</div><div class="d-head"><img class="big-face" src="${G.src('assets/img/face_light.jpg')}" alt=""><div><h2>世界を見守る</h2><div class="sub">神力 ${Math.floor(g.power)} ・ 介入 ${g.acts}回</div></div></div>
        <div class="why">地図の上の国・町・軍・人物を押すと、くわしい様子と<b>女神の介入</b>が出ます。何もない土地を押すと、その場所に奇跡や災害を起こせます。</div>
        <div class="sec"><h3>遊び方</h3><ol style="font-size:13px;line-height:1.8;padding-left:20px;margin:0">
        <li>下の<b>「いま注目の出来事」</b>で世界の動きを知る</li><li>気になる国・人物・軍を選ぶ</li><li>神託・夢・奇跡・災害などで<b>介入</b>する</li><li>▶で時間を進める</li><li>地図とニュースで結果を見る</li></ol></div>
        <div class="sec"><h3>女神の手帳(最近の介入)</h3>${g.history.slice(-6).reverse().map(x => `<div class="mem"><small>${G.dateStr(x.d)}</small>${esc(x.t)}</div>`).join('') || '<p style="font-size:12px;color:var(--dim)">まだ何もしていない。</p>'}</div>`;
    },
    dNation(n) {
      if (!n) return '';
      const r = G.People.ruler(n), cap = G.C(n.capital), m = r ? G.People.mind(r) : null;
      const pop = G.sum(n.cities, id => G.C(id).pop), faith = n.cities.length ? G.sum(n.cities, id => G.C(id).faith) / n.cities.length : 0;
      let h = `<div class="kind">${G.raceName(n.race)}の国</div><div class="d-head"><div class="crest" style="background:${n.color}">${n.race === 'human' ? '⚜' : '☾'}</div><div><h2>${esc(n.name)}</h2><div class="sub">首都 ${cap ? `<span class="link" data-sel="city:${cap.id}">${esc(cap.name)}</span>` : '—'} ・ 町${n.cities.length} ・ 人口${G.fmt(pop)}</div></div></div>`;
      if (U.sel && U.sel.x != null) h += `<p><button class="btn small" data-place="${U.sel.x},${U.sel.y}">✧ 押した場所に、奇跡や災害を起こす</button></p>`;
      if (r) h += `<div class="mind"><div class="lbl">${esc(G.pname(r))}の考え</div><p>目標: ${esc(m.goal)}</p><p>これから: ${esc(m.next)}</p></div>`;
      h += `<div class="sec"><h3>君主</h3>${r ? U.relRow(r, `${G.ageOf(r)}歳 ・ ${G.People.traitText(r)}`) : '<p>君主がいない</p>'}</div>`;
      h += `<div class="sec"><h3>国のようす</h3><dl class="kv"><dt>国の安定</dt><dd>${word.stab(n.stability)}</dd><dt>戦争の疲れ</dt><dd>${n.weary > 60 ? 'とても疲れている' : n.weary > 30 ? '疲れが見える' : 'まだ元気'}</dd><dt>信仰</dt><dd>${esc(G.FAITH[n.race].name)}(${esc(n.sect)}) ・ ${word.faith(faith)}</dd><dt>軍</dt><dd>${G.armies().filter(a => a.nation === n.id).map(a => `<span class="link" data-sel="army:${a.id}">${esc(a.name)}</span>`).join('、') || 'なし'}</dd><dt>建国</dt><dd>${n.founded}年${n.parent && G.N(n.parent) ? `(${esc(G.N(n.parent).short)}から分かれた)` : ''}</dd></dl></div>`;
      h += `<div class="sec"><h3>ほかの国との関係</h3>`;
      for (const o of G.nations().filter(o => o !== n).sort((a, b) => G.rel(n.id, a.id).opinion - G.rel(n.id, b.id).opinion)) {
        const rl = G.rel(n.id, o.id);
        const tag = rl.state === 'war' ? '<span class="tag war">戦争</span>' : rl.state === 'alliance' ? '<span class="tag ally">同盟</span>' : rl.state === 'truce' && rl.truce > G.S.day ? '<span class="tag truce">休戦</span>' : '';
        h += `<div class="rel" data-sel="nation:${o.id}"><span class="sw" style="display:inline-block;width:8px;height:22px;border-radius:2px;background:${o.color}"></span><span>${esc(o.name)}</span><span class="k ${rl.opinion > 10 ? 'good' : 'bad'}">${word.opinion(rl.opinion)}${rl.border && rl.state !== 'war' ? '・' + word.tension(rl.tension) : ''}</span>${tag}</div>`;
      }
      h += `</div>`;
      const people = G.chars().filter(p => p.nation === n.id && p !== r).sort((a, b) => b.fame - a.fame).slice(0, 8);
      h += `<div class="sec"><h3>おもな人物</h3>${people.map(p => U.relRow(p, `${G.ROLES[p.role] || ''} ・ ${G.People.mind(p).goal}`)).join('')}</div>`;
      h += U.powerSec('nation') + U.planSec('nation');
      return h;
    },
    relRow(p, sub, k) { return `<div class="rel" data-sel="person:${p.id}">${face(p)}<span><b style="font-family:var(--serif);font-size:13.5px">${esc(G.pname(p))}</b><br><small style="color:var(--dim)">${esc(sub || '')}</small></span>${k || ''}</div>`; },
    dPerson(p) {
      if (!p) return '';
      const n = G.N(p.nation), age = G.ageOf(p);
      if (!p.alive) return `<div class="kind">故人</div><div class="d-head">${face(p, 'big-face')}<div><h2>${esc(G.pname(p))}</h2><div class="sub">${esc(p.death)}(${G.dateStr(p.deathDay)})</div></div></div>` + U.memSec(p);
      const m = G.People.mind(p);
      let h = `<div class="kind">${G.raceName(p.race)} ・ ${esc(G.ROLES[p.role] || '')}</div><div class="d-head">${face(p, 'big-face')}<div><h2>${esc(G.pname(p))}</h2><div class="sub">${p.house}家 ・ ${age}歳 ・ ${p.sex === 'f' ? '女性' : '男性'}<br>${n ? `<span class="link" data-sel="nation:${n.id}">${esc(n.name)}</span>` : '国を持たない'}${p.armyId && G.A(p.armyId) ? ` ・ <span class="link" data-sel="army:${p.armyId}">${esc(G.A(p.armyId).name)}</span>を指揮` : ''}</div></div></div>`;
      h += `<div class="chips">${p.traits.map(t => `<span class="chip trait">${G.TRAITS[t].name}</span>`).join('')}${p.heroic ? '<span class="chip trait">英雄の力</span>' : ''}${p.ill ? '<span class="chip" style="color:#ffb3a8">病気</span>' : ''}${p.blessed > G.S.day ? '<span class="chip" style="color:#fff3b0">見えない加護</span>' : ''}</div>`;
      h += `<div class="mind"><div class="lbl">いま考えていること</div><p>目標: ${esc(m.goal)}</p><p>これから: ${esc(m.next)}</p><p style="font-size:13px;color:#cbbfe6">${p.fear > 50 ? '何かをおそれている。' : p.conf > 70 ? '自信に満ちている。' : ''}${p.ambition > 75 ? '野心が強い。' : ''}${p.piety > 75 ? '女神を深く信じている。' : p.piety < 30 ? '信仰心は薄い。' : ''}</p></div>`;
      const bar = (l, v) => `<div>${l}<div class="bar"><i style="width:${v}%"></i></div></div>`;
      h += `<div class="sec"><h3>能力</h3><div class="stats">${bar('武勇', p.martial)}${bar('策略', p.intrigue)}${bar('外交', p.diplomacy)}${bar('信仰心', p.piety)}${bar('野心', p.ambition)}${bar('名声', Math.min(100, p.fame))}</div></div>`;
      const rels = Object.entries(p.rel).map(([id, r]) => [G.P(id), r]).filter(([q]) => q).sort((a, b) => Math.abs(b[1].v) - Math.abs(a[1].v)).slice(0, 10);
      h += `<div class="sec"><h3>人間関係</h3>${rels.map(([q, r]) => U.relRow(q, `${G.pname(q) === q.name ? '' : ''}${q.alive ? (G.N(q.nation) ? G.N(q.nation).short : '') : '故人'}`, `<span class="k ${G.REL[r.k] && G.REL[r.k].good && r.v >= 0 ? 'good' : 'bad'}">${G.REL[r.k] ? G.REL[r.k].name : r.k}</span>`)).join('') || '<p style="font-size:12px;color:var(--dim)">深い関係の相手はいない。</p>'}</div>`;
      if (p.hate) { const hs = Object.entries(p.hate).filter(([k, v]) => v > 15 && G.N(k)); if (hs.length) h += `<div class="sec"><h3>うらみ</h3><div class="chips">${hs.map(([k]) => `<span class="chip" style="color:#ffb3a8">${esc(G.N(k).name)}</span>`).join('')}</div></div>`; }
      h += U.memSec(p);
      h += U.powerSec('person') + U.planSec('person');
      return h;
    },
    memSec(p) { return `<div class="sec"><h3>記憶(最近の出来事)</h3>${p.mem.slice(-8).reverse().map(m => `<div class="mem"><small>${G.dateStr(m.d)}</small>${esc(m.t)}</div>`).join('') || '<p style="font-size:12px;color:var(--dim)">特になし</p>'}</div>`; },
    dCity(c) {
      if (!c) return '';
      const n = G.N(c.owner), cap = n && n.capital === c.id;
      const st = [c.siege ? `<span class="chip" style="color:#ff9a8a">包囲されている(${c.siege.day}日目)</span>` : '', c.plague ? '<span class="chip" style="color:#a8e6b4">疫病</span>' : '', c.famine ? '<span class="chip">飢饉</span>' : '', c.burn ? '<span class="chip" style="color:#ffb37a">焼けあと</span>' : '', c.harvest ? '<span class="chip" style="color:#f6dd94">豊作</span>' : '', c.ward > G.S.day ? '<span class="chip">守りの結界</span>' : ''].join('');
      let h = `<div class="kind">${cap ? '首都' : '町'}</div><div class="d-head"><div class="crest" style="background:${n ? n.color : '#555'}">${cap ? '♛' : '⌂'}</div><div><h2>${esc(c.name)}</h2><div class="sub">${n ? `<span class="link" data-sel="nation:${n.id}">${esc(n.name)}</span>` : ''} ・ ${G.raceName(c.race)}の町${c.home && c.home !== c.owner && G.N(c.home) ? ` ・ もとは${esc(G.vals(G.S.nations).find(x => x.id === c.home).short)}の町` : ''}</div></div></div><div class="chips">${st}</div>`;
      h += `<div class="sec"><h3>町のようす</h3><dl class="kv"><dt>人口</dt><dd>${G.fmt(c.pop)}</dd><dt>城壁</dt><dd>${c.walls > 60 ? '堅固' : c.walls > 30 ? 'ふつう' : c.walls > 8 ? '崩れかけ' : 'ほぼない'}</dd><dt>守備兵</dt><dd>${G.fmt(c.garrison)}人</dd><dt>信仰</dt><dd>${word.faith(c.faith)}${c.temple ? '(神殿あり)' : ''}</dd><dt>民の気持ち</dt><dd>${word.unrest(c.unrest)}</dd><dt>くらし</dt><dd>${c.prosper > 65 ? '豊か' : c.prosper > 45 ? 'ふつう' : '貧しい'}</dd></dl></div>`;
      const ppl = G.chars().filter(p => p.city === c.id && !p.armyId).slice(0, 6);
      if (ppl.length) h += `<div class="sec"><h3>この町にいる人物</h3>${ppl.map(p => U.relRow(p, G.ROLES[p.role])).join('')}</div>`;
      const near = G.armies().filter(a => G.dist(a, c) < 6);
      if (near.length) h += `<div class="sec"><h3>近くの軍</h3>${near.map(a => `<div class="rel" data-sel="army:${a.id}"><span class="sw" style="display:inline-block;width:8px;height:22px;border-radius:2px;background:${a.color}"></span>${esc(a.name)}<span class="k ${a.nation === c.owner ? 'good' : 'bad'}">${G.fmt(a.men)}人</span></div>`).join('')}</div>`;
      h += U.powerSec('city');
      return h;
    },
    dArmy(a) {
      if (!a) return '<p style="color:var(--dim)">この軍はもう存在しない。</p>';
      const n = G.N(a.nation), c = G.P(a.cmd), goal = G.C(a.goal);
      const mis = { attack: `${goal ? goal.name : '敵の町'}を攻めに向かっている`, relief: `${goal ? goal.name : '味方の町'}の救援に向かっている`, hunt: '敵軍を追っている', home: `${goal ? goal.name : '町'}へ移動中`, retreat: '退却中', idle: '待機中' }[a.mission] || '';
      const stt = a.state === 'battle' ? '戦闘中' : a.state === 'siege' ? `${goal ? goal.name : '町'}を包囲中` : mis;
      let h = `<div class="kind">軍</div><div class="d-head"><div class="crest" style="background:${a.color}">⚑</div><div><h2>${esc(a.name)}</h2><div class="sub">${n ? `<span class="link" data-sel="nation:${n.id}">${esc(n.name)}</span>` : ''} ・ ${esc(stt)}</div></div></div>`;
      if (c) h += `<div class="sec"><h3>指揮官</h3>${U.relRow(c, `${G.People.traitText(c)} ・ 武勇${c.martial}`)}</div>`;
      const cp = a.comp;
      h += `<div class="sec"><h3>部隊</h3><dl class="kv"><dt>兵の数</dt><dd>${G.fmt(a.men)}人(最初は${G.fmt(a.max)}人)</dd><dt>編成</dt><dd>${n && n.race === 'human' ? `歩兵${cp.inf}%・弓兵${cp.rng}%・騎兵${cp.cav}%・魔法使い${cp.mag}%` : `魔族兵${cp.inf}%・弓${cp.rng}%・魔獣${cp.cav}%・魔術師${cp.mag}%`}</dd><dt>士気</dt><dd>${word.morale(a.morale)}<div class="bar"><i style="width:${a.morale}%"></i></div></dd><dt>補給</dt><dd>${a.supply > 60 ? '十分' : a.supply > 25 ? '減っている' : '尽きかけている'}<div class="bar"><i style="width:${a.supply}%"></i></div></dd>${a.blessed > G.S.day ? '<dt>加護</dt><dd>女神の加護がある</dd>' : ''}</dl></div>`;
      if (a.battle && G.B(a.battle)) h += `<p><button class="btn gold" data-sel="battle:${a.battle}">⚔ 戦いを見る</button></p>`;
      h += U.powerSec('army');
      return h;
    },
    dBattle(b) {
      if (!b) return '<p style="color:var(--dim)">戦いは終わった。</p>';
      const side = (s, i) => {
        const n = G.N(s.nation), a = G.A(s.armies[0]), c = a && G.P(a.cmd);
        return `<div class="sec"><h3 style="color:${n ? n.color : '#fff'}">${n ? esc(n.name) : ''}</h3>${c ? U.relRow(c, a.name) : ''}<dl class="kv"><dt>兵</dt><dd>${G.fmt(G.War.menOf(s))} / ${G.fmt(s.men0)}</dd><dt>士気</dt><dd>${word.morale(G.War.morOf(s))}</dd></dl></div>`;
      };
      let h = `<div class="kind">${b.important ? '重要な戦い' : '戦い'}</div><div class="d-head"><div class="crest" style="background:#5a1a16">⚔</div><div><h2>${esc(b.name)}</h2><div class="sub">${b.over ? (b.winner == null ? '引き分け' : `${esc(G.nname(G.N(b.s[b.winner].nation)))}の勝利`) : `${b.round}日目`}</div></div></div>`;
      if (!b.over) h += `<p><button class="btn gold" data-bv="${b.id}" style="width:100%">⚔ 戦場を見る(女神の力も使える)</button></p>`;
      h += side(b.s[0], 0) + side(b.s[1], 1);
      h += `<div class="sec"><h3>戦いの流れ</h3>${b.log.slice(-10).reverse().map(l => `<div class="beat"><small>${l.r}日目</small>${esc(l.t)}</div>`).join('')}</div>`;
      return h;
    },
    dIncident(i) {
      if (!i) return '';
      const fut = G.Story.future(i);
      const cause = i.cause && G.I(i.cause);
      let h = `<div class="kind">${i.status === 'done' ? '結末' : '進行中の出来事'}</div><div class="d-head"><div class="crest" style="background:#3a2a10">${i.icon}</div><div><h2>${esc(i.title)}</h2><div class="sub">${G.dateStr(i.d0)}〜${i.end ? G.dateStr(i.end) : ''} ・ ${i.nations.map(G.N).filter(Boolean).map(n => `<span class="link" data-sel="nation:${n.id}">${esc(n.short)}</span>`).join('・')}</div></div></div>`;
      const last = i.beats.filter(b => !b.minor).slice(-1)[0];
      h += `<div class="sec"><h3>何が起きているのか</h3><div class="why">${esc(i.status === 'done' ? i.result : last ? last.t : '')}</div></div>`;
      h += `<div class="sec"><h3>なぜ起きたのか</h3><div class="why">${esc(i.why)}${cause ? `<br><span class="link" data-sel="incident:${cause.id}">← きっかけ: ${esc(cause.title)}</span>` : ''}</div></div>`;
      const who = i.actors.map(G.P).filter(Boolean);
      if (who.length) h += `<div class="sec"><h3>関わる人物</h3>${who.map(p => U.relRow(p, p.alive ? G.People.mind(p).goal : '故人')).join('')}</div>`;
      if (fut.length) h += `<div class="sec"><h3>${i.status === 'done' ? 'その後' : 'これから(どうなるかは決まっていない)'}</h3><ul class="future" style="margin:0;padding-left:18px">${fut.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>`;
      if (i.children.length && i.status !== 'done') h += `<div class="sec"><h3>ここから生まれた出来事</h3>${i.children.map(G.I).filter(Boolean).map(c => `<div class="rel" data-sel="incident:${c.id}">${c.icon} ${esc(c.title)}</div>`).join('')}</div>`;
      h += `<div class="sec"><h3>これまでの流れ</h3>${i.beats.slice().reverse().slice(0, 16).map(b => `<div class="beat ${b.minor ? 'minor' : ''}"><small>${G.dateStr(b.d)}</small>${esc(b.t)}</div>`).join('')}</div>`;
      if (i.type === 'war') { const bs = G.vals(G.S.battles).filter(b => !b.over && G.S.wars[i.data.war] && [...G.S.wars[i.data.war].a, ...G.S.wars[i.data.war].b].includes(b.s[0].nation)); if (bs.length) h += `<div class="sec"><h3>いま戦っている場所</h3>${bs.map(b => `<div class="rel" data-sel="battle:${b.id}">⚔ ${esc(b.name)}</div>`).join('')}</div>`; }
      return h;
    },
    dPlace(s) {
      const W = G.Map.W, t = G.TERRAIN[W.t[s.y * W.w + s.x]];
      return `<div class="kind">土地</div><div class="d-head"><div class="crest" style="background:#2a3a2a">✧</div><div><h2>${esc(G.War.placeName(s.x, s.y))}</h2><div class="sub">${t.name}${s.nation ? ' ・ ' + esc(G.N(s.nation).name) + 'の領土' : ' ・ だれの土地でもない'}</div></div></div>` + U.powerSec('place');
    },

    // ---- 女神の介入 ----
    powerSec(type) {
      const keys = G.Goddess.powersFor(type);
      const g = G.S.goddess;
      const btn = k => { const P = G.POWERS[k], c = G.Goddess.cost(k, 1); return `<button class="pbtn ${P.kind} ${g.power < G.Goddess.cost(k, 0) ? 'dis' : ''}" data-pw="${k}"><span class="ic">${P.icon}</span><span>${P.name}</span><span class="c">${c}</span></button>`; };
      const ind = keys.filter(k => G.POWERS[k].kind === 'indirect'), dir = keys.filter(k => G.POWERS[k].kind === 'direct');
      return `<div class="sec powers" id="powers"><h3>女神の介入 <small style="color:var(--dim);letter-spacing:0">(神力 ${Math.floor(g.power)})</small></h3>${U.cfg ? U.cfgHtml() : ''}${ind.length ? `<h4>間接介入 ― 心や判断に働きかける</h4><div class="pgrid">${ind.map(btn).join('')}</div>` : ''}${dir.length ? `<h4>直接介入 ― 力で世界を変える</h4><div class="pgrid">${dir.map(btn).join('')}</div>` : ''}</div>`;
    },
    openCfg(key, tgt, pre) {
      U.cfg = Object.assign({ key, tgt, str: 1, when: 0, option: null, other: null }, pre || {});
      U.planCfg = null;
      U.renderDetail();
      const el = $('#powers'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    cfgHtml() {
      const c = U.cfg, P = G.POWERS[c.key], g = G.S.goddess;
      const nt = (P.need && P.need.nation) ? 'nation' : (P.need && P.need.person) ? 'person' : (P.needTarget && c.option ? P.needTarget[c.option] : null);
      let h = `<div class="cfg"><h4>${P.icon} ${P.name}</h4><p>${esc(P.desc)}</p>`;
      if (P.need && P.need.option) h += `<label>内容</label><div class="seg">${P.need.option.map(([k, l]) => `<button data-opt="${k}" class="${c.option === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
      if (nt === 'nation') {
        const me = c.tgt.type === 'nation' ? c.tgt.id : c.tgt.type === 'person' && G.P(c.tgt.id) ? G.P(c.tgt.id).nation : null;
        h += `<label>相手の国</label><select data-other><option value="">— えらぶ —</option>${G.nations().filter(n => n.id !== me).map(n => `<option value="${n.id}" ${c.other === n.id ? 'selected' : ''}>${esc(n.name)}(${G.raceName(n.race)})</option>`).join('')}</select>`;
      }
      if (nt === 'person') {
        h += `<label>相手の人物</label><select data-other><option value="">— えらぶ —</option>${G.nations().map(n => `<optgroup label="${esc(n.name)}">${G.chars().filter(p => p.nation === n.id && p.id !== c.tgt.id && G.ageOf(p) >= 12).sort((a, b) => b.fame - a.fame).map(p => `<option value="${p.id}" ${c.other === p.id ? 'selected' : ''}>${esc(G.pname(p))}(${G.ROLES[p.role] || ''})</option>`).join('')}</optgroup>`).join('')}</select>`;
      }
      h += `<label>強さ</label><div class="seg">${G.STRENGTH.map((s, i) => `<button data-str="${i}" class="${c.str === i ? 'on' : ''}">${s.name}<br><small>神力${G.Goddess.cost(c.key, i)}</small></button>`).join('')}</div>`;
      h += `<label>いつ</label><div class="seg">${G.TIMING.map((t, i) => `<button data-when="${i}" class="${c.when === i ? 'on' : ''}">${t.name}</button>`).join('')}</div>`;
      const ch = G.Goddess.chance(c.key, c.tgt, c.str);
      if (ch != null && ['oracle', 'dream'].includes(c.key)) h += `<div class="hint">${c.key === 'oracle' ? 'お告げを信じる可能性' : '心が動く可能性'}: ${word.chance(ch)}</div>`;
      const cost = G.Goddess.cost(c.key, c.str);
      h += `<div class="go"><button class="btn" data-cfg-cancel>やめる</button><button class="btn gold" data-cfg-go ${g.power < cost ? 'disabled' : ''}>${g.power < cost ? '神力が足りない' : '介入する(神力' + cost + ')'}</button></div></div>`;
      return h;
    },
    bindCfg(el) {
      el.querySelectorAll('[data-opt]').forEach(b => b.onclick = () => { U.cfg.option = b.dataset.opt; U.cfg.other = null; U.renderDetail(); });
      el.querySelectorAll('[data-str]').forEach(b => b.onclick = () => { U.cfg.str = +b.dataset.str; U.renderDetail(); });
      el.querySelectorAll('[data-when]').forEach(b => b.onclick = () => { U.cfg.when = +b.dataset.when; U.renderDetail(); });
      el.querySelectorAll('select[data-other]').forEach(s => s.onchange = () => { U.cfg && (U.cfg.other = s.value || null); if (U.planCfg) U.planCfg.other = s.value || null; });
      const cancel = el.querySelector('[data-cfg-cancel]'); if (cancel) cancel.onclick = () => { U.cfg = null; U.planCfg = null; U.renderDetail(); };
      const go = el.querySelector('[data-cfg-go]'); if (go) go.onclick = U.doPower;
      const pgo = el.querySelector('[data-plan-go]'); if (pgo) pgo.onclick = U.doPlan;
    },
    doPower() {
      const c = U.cfg;
      const res = G.Goddess.use(c.key, c.tgt, { str: c.str, when: c.when, option: c.option, other: c.other });
      if (!res.ok && !res.key && !res.later) { U.toast(res.text); return; }
      U.cfg = null;
      G.BGM.sfx(['plague', 'sickness', 'meteor', 'quake', 'fear'].includes(c.key) ? 'dark' : c.key === 'storm' ? 'storm' : 'light');
      U.result(c.key, res);
      U.renderDetail(); U.renderTop(); U.spotDirty = true; U.listDirty = true;
    },
    result(key, res) {
      const P = G.POWERS[key];
      const art = { oracle: 'ev_crest_altar', dream: 'ev_celestial_city', ambition: 'ev_crest_zephyra', fear: 'ev_cursed_castle', hope: 'ev_holy', meet: 'ev_alliance', distrust: 'ev_crest_zephyra', rumor: 'ev_capital_city', hero: 'ev_holy', life: 'ev_holy', sickness: 'ev_cursed_castle', protect: 'ev_pillar', harvest: 'ev_peace', plague: 'ev_vortex', arms: 'ev_fire_city', sour: 'ev_burning_fortress', mend: 'ev_alliance', unrest: 'ev_burning_fortress', tech: 'ev_capital_city', faith: 'ev_altar', heal: 'ev_holy', quake: 'ev_vortex', ward: 'ev_pillar', storm: 'ev_vortex', meteor: 'ev_war', miracle: 'ev_pillar', morale: 'ev_war', lost: 'ev_vortex', revel: 'ev_war' }[key] || 'ev_altar';
      U.modal(`<img class="art" src="${G.src(`assets/art/${art}.jpg`)}" alt=""><h2>${P.icon} ${P.name}</h2><p class="res">${esc(res.text)}</p>${res.later ? '' : `<p style="font-size:12.5px;color:var(--dim)">${res.ok ? '世界の人々は、これが女神のしわざだとは知らない。' : '思いどおりにはいかなかった。人には人の心がある。'}</p>`}<div class="row-btns">${res.at ? '<button class="btn" data-m="look">その場所を見る</button>' : ''}<button class="btn gold" data-m="go">時間を進めて見守る ▶</button></div>`, {
        look: () => { U.closeModal(); G.Render.flyTo(res.at.x, res.at.y, Math.max(G.Render.cam.z, 1.8)); },
        go: () => { U.closeModal(); if (res.at) G.Render.flyTo(res.at.x, res.at.y, Math.max(G.Render.cam.z, 1.5)); U.setSpeed(U.speed || U.lastRun || 1); }
      });
    },
    // ---- 長期計画 ----
    planSec(type) {
      const keys = Object.keys(G.PLANS).filter(k => G.PLANS[k].on === type);
      let h = `<div class="sec"><h3>長期計画を立てる</h3>`;
      if (U.planCfg) {
        const P = G.PLANS[U.planCfg.key];
        h += `<div class="cfg"><h4>${P.name}</h4><p>${esc(P.desc)} 期限は${P.years}年。いくつもの介入を重ねて、目標に近づけよう。</p>`;
        if (P.needNation) h += `<label>相手の国</label><select data-other><option value="">— えらぶ —</option>${G.nations().filter(n => n.id !== (U.sel.type === 'nation' ? U.sel.id : G.P(U.sel.id) && G.P(U.sel.id).nation)).map(n => `<option value="${n.id}">${esc(n.name)}</option>`).join('')}</select>`;
        if (P.needPerson) h += `<label>相手の人物</label><select data-other><option value="">— えらぶ —</option>${G.chars().filter(p => p.id !== U.sel.id && G.ageOf(p) >= 14).sort((a, b) => b.fame - a.fame).slice(0, 80).map(p => `<option value="${p.id}">${esc(G.pname(p))}(${G.N(p.nation) ? esc(G.N(p.nation).short) : ''})</option>`).join('')}</select>`;
        h += `<div class="go"><button class="btn" data-cfg-cancel>やめる</button><button class="btn gold" data-plan-go>計画を始める</button></div></div>`;
      } else h += `<div class="chips">${keys.map(k => `<button class="chip" data-plan-new="${k}">${G.PLANS[k].name}</button>`).join('')}</div>`;
      const mine = G.S.goddess.plans.filter(p => p.status === 'active' && (p.target === U.sel.id || p.other === U.sel.id));
      for (const p of mine) h += `<div style="margin-top:8px;font-size:12.5px">${esc(G.Goddess.planTitle(p))}<div class="bar"><i style="width:${Math.round(p.progress * 100)}%"></i></div></div>`;
      return h + '</div>';
    },
    doPlan() {
      const pc = U.planCfg, P = G.PLANS[pc.key];
      if ((P.needNation || P.needPerson) && !pc.other) { U.toast('相手を選んでください'); return; }
      const r = G.Goddess.newPlan(pc.key, U.sel.id, pc.other);
      U.toast(r.text);
      if (r.ok) { U.planCfg = null; U.tab = 'plans'; U.renderList(); U.renderDetail(); }
    },
    // ---- モーダル・メニュー ----
    modal(html, acts) {
      $('#modal-box').innerHTML = html; $('#modal').classList.remove('hidden');
      $$('#modal-box [data-m]').forEach(b => b.onclick = () => (acts[b.dataset.m] || U.closeModal)());
      $('#modal').onclick = e => { if (e.target.id === 'modal') U.closeModal(); };
    },
    closeModal() { $('#modal').classList.add('hidden'); },
    menu() {
      const st = G.S ? G.S.settings : { autoCam: true, autoPause: true };
      U.modal(`<h2>メニュー</h2>
        <label class="toggle">大きな出来事でカメラを動かす<input type="checkbox" id="o-cam" ${st.autoCam ? 'checked' : ''}></label>
        <label class="toggle">音楽<input type="checkbox" id="o-bgm" ${G.BGM.on ? 'checked' : ''}></label>
        <div class="menu-list" style="margin-top:12px">
        <button class="btn" data-m="save">セーブする</button><button class="btn" data-m="load">ロードする</button>
        <button class="btn" data-m="export">セーブをファイルに書き出す</button><button class="btn" data-m="import">ファイルから読みこむ</button>
        <button class="btn" data-m="tut">遊び方をもう一度</button><button class="btn" data-m="title">タイトルにもどる</button><button class="btn" data-m="close">閉じる</button></div>`, {
        save: () => { U.toast(G.Save.save() ? 'セーブしました' : 'セーブできませんでした'); U.closeModal(); },
        load: () => { if (G.Save.load()) { G.Main.afterLoad(); U.toast('ロードしました'); } else U.toast('セーブがありません'); U.closeModal(); },
        export: () => { const b = new Blob([G.Save.dump()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `goddess-${G.Y()}.json`; a.click(); U.closeModal(); },
        import: () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json'; i.onchange = () => { const f = i.files[0]; if (!f) return; f.text().then(t => { try { G.Save.restore(t); G.Main.afterLoad(); U.toast('読みこみました'); } catch (e) { U.toast('読みこめませんでした'); } }); }; i.click(); U.closeModal(); },
        tut: () => { U.closeModal(); G.Coach.start(); },
        title: () => { U.closeModal(); U.setSpeed(0); G.Save.save(); document.querySelector('#title').classList.remove('hidden'); G.Main.title(); },
        close: U.closeModal
      });
      const bind = (id, f) => { const e = document.getElementById(id); if (e) e.onchange = () => f(e.checked); };
      bind('o-cam', v => { if (G.S) G.S.settings.autoCam = v; }); bind('o-bgm', v => G.BGM.setMusic(v));
    }
  };
  G.enemiesCount = () => G.vals(G.S.wars).filter(w => !w.end).length;

  // ---- はじめての人への説明 ----
  const Coach = {
    steps: [
      ['#spot', 'いま注目の出来事', '世界で今いちばん大事な出来事が、ここに最大3つ出ます。番号は地図の上の印と同じです。まず1番を押してみましょう。', 'spot'],
      ['#right', '何が起きているのか', 'なぜ起きたのか、誰が関わっているのか、これからどうなりそうかがわかります。人物の名前を押すと、その人の考えも見られます。', null],
      ['#mapwrap', '世界の地図', '色が国の領土です。赤い国境は戦争中。旗を持った兵が軍で、本当に移動します。町・軍・人物・土地を押してみましょう。', null],
      ['#right', '女神の介入', '選んだ相手に、神託・夢・噂・奇跡・災害などを起こせます。強さとタイミングも選べます。うまくいくかは、相手の性格しだい。', null],
      ['#speed', '時間を進める', '▶で時間が進みます。何もしなくても、国や人物は自分の考えで動きます。介入したら、時間を進めて結果を見守りましょう。', null],
      ['#top', '神力と信仰', '人族と魔族の祈りが、あなたの神力になります。人々は、争いの裏にあなたがいることを知りません。', null]
    ],
    i: 0,
    start() { Coach.i = 0; $('#coach').classList.remove('hidden'); Coach.show(); },
    show() {
      const s = Coach.steps[Coach.i]; if (!s) return Coach.end();
      if (s[0] === '#right' && !U.sel) { const sp = G.Story.spotlight()[0]; if (sp) U.select({ type: 'incident', id: sp.id }); }
      if (Coach.i === 3) { const sp = G.Story.spotlight()[0]; const p = sp && sp.actors.map(G.P).find(Boolean); if (p) U.select({ type: 'person', id: p.id }); setTimeout(() => { const el = $('#powers'); if (el) el.scrollIntoView({ block: 'start' }); Coach.place(s); }, 380); }
      if (window.innerWidth <= 900 && s[0] === '#right') $('#right').classList.add('open');
      setTimeout(() => Coach.place(s), 360);
    },
    place(s) {
      const el = $(s[0]); if (!el) return;
      const r = el.getBoundingClientRect(), hole = $('#coach-hole'), box = $('#coach-box');
      hole.style.left = (r.left + 4) + 'px'; hole.style.top = (r.top + 4) + 'px'; hole.style.width = (r.width - 8) + 'px'; hole.style.height = (r.height - 8) + 'px';
      box.innerHTML = `<h4>${Coach.i + 1}/${Coach.steps.length} ${s[1]}</h4><p>${s[2]}</p><div class="row-btns"><button class="btn small" data-c="skip">とばす</button><button class="btn gold small" data-c="next">${Coach.i === Coach.steps.length - 1 ? 'はじめる' : '次へ'}</button></div>`;
      const bw = Math.min(340, window.innerWidth * 0.9);
      let bx = r.left + r.width / 2 - bw / 2, by = r.bottom + 12;
      if (by + 170 > window.innerHeight) by = Math.max(10, r.top - 180);
      if (r.height > window.innerHeight * 0.5) by = r.top + 20;
      box.style.left = G.clamp(bx, 10, window.innerWidth - bw - 10) + 'px'; box.style.top = by + 'px';
      box.querySelector('[data-c=next]').onclick = () => { Coach.i++; Coach.show(); };
      box.querySelector('[data-c=skip]').onclick = Coach.end;
    },
    end() { $('#coach').classList.add('hidden'); if (window.innerWidth <= 900) $('#right').classList.remove('open'); try { localStorage.setItem('goddess6-coached', '1'); } catch (e) { } }
  };
  G.UI = U; G.Coach = Coach;
})(globalThis.GD = globalThis.GD || {});
