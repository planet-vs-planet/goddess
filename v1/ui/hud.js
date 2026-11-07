// 画面の操作: 上の女神・戦況バー・3つの介入・次の月へ・今月の報告
(function (G) {
  const W = G.World;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  G.esc = esc;
  const F = () => G.Factions;
  const AUTO = [1, 2, 5];

  const UI = {
    init() {
      const art = k => G.StoryUI.art(k);
      $('#g-face').src = (G.STORY_ART && G.STORY_ART.face_light) || art('goddess_light');
      $('#g-face-dark').src = (G.STORY_ART && G.STORY_ART.face_dark) || art('goddess_dark');
      const icons = { miracle: 'bless', whisper: 'disaster', fate: 'miracle' };
      const A = G.ART || { powers: {} };
      document.querySelectorAll('.ibtn').forEach(b => { const src = (G.STORY_ART && G.STORY_ART['icon_' + b.dataset.cat]) || (A.powers && A.powers[icons[b.dataset.cat]]); if (src) b.querySelector('.iico').src = src; else b.querySelector('.iico').remove(); });
      // 自動で進める
      $('#speed').innerHTML = '<span class="lbl">自動</span>' + AUTO.map(s => `<button data-speed="${s}" title="止めずに${s}倍の速さで進める">${s}倍</button>`).join('');
      $('#speed').addEventListener('click', e => { const b = e.target.closest('[data-speed]'); if (!b) return; const s = +b.dataset.speed; if (G.View.speed === s && !G.View.turnMode) UI.setSpeed(0); else { G.View.turnMode = false; UI.setSpeed(s); } });
      $('#btn-next').addEventListener('click', () => UI.nextMonth());
      // 介入メニュー
      $('#interventions').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) UI.openMenu(b.dataset.cat); });
      $('#imenu').addEventListener('click', e => {
        if (e.target.closest('.im-close')) return UI.closeMenu();
        const c = e.target.closest('[data-choose]'); if (c) { const [k, v] = c.dataset.choose.split(':'); return UI.usePower(k, v); }
        const o = e.target.closest('[data-key]'); if (o && !o.classList.contains('locked')) UI.pickPower(o.dataset.key);
      });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') { UI.closeMenu(); UI.cancelTargeting(); } });
      $('#mapmode').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (!b) return; G.View.mode = b.dataset.mode; G.View.refreshTerritory(); UI.refreshMapMode(); });
      $('#target-cancel').addEventListener('click', () => UI.cancelTargeting());
      $('#btn-save').addEventListener('click', () => { const r = G.Save.save(); UI.toast(r.ok ? `セーブしました(${W.dateText()})` : 'セーブできませんでした: ' + r.msg); });
      $('#btn-load').addEventListener('click', () => UI.loadGame());
      $('#btn-menu').addEventListener('click', () => $('#menu').classList.toggle('open'));
      $('#menu').addEventListener('click', e => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        $('#menu').classList.remove('open');
        const act = b.dataset.act;
        if (act === 'export') G.Save.exportFile();
        if (act === 'import') $('#import-file').click();
        if (act === 'help') UI.help(true);
        if (act === 'title') G.Main.showTitle();
        if (act === 'opening') G.StoryUI.play(G.StoryUI.OPENING);
        if (act === 'tutorial') G.Tut.start();
        if (act === 'mission') G.StoryUI.mission();
      });
      $('#import-file').addEventListener('change', e => {
        const f = e.target.files[0]; if (!f) return;
        f.text().then(t => { try { G.Save.restore(t); G.Main.afterWorldReady(true); UI.toast('ファイルから読みこみました'); } catch (err) { UI.toast('読みこめませんでした: ' + err.message); } });
        e.target.value = '';
      });
      $('#help-close').addEventListener('click', () => UI.help(false));
      $('#drawer-left').addEventListener('click', () => { document.body.classList.toggle('show-left'); document.body.classList.remove('show-right'); });
      $('#drawer-right').addEventListener('click', () => { document.body.classList.toggle('show-right'); document.body.classList.remove('show-left'); });
      $('#alert').addEventListener('click', () => { if (W.S && W.S.peace) UI.openMenu('fate'); else if (W.S && W.S.revolt && W.S.revolt.active) UI.openMenu('fate'); });
      document.addEventListener('click', e => {
        const a = e.target.closest('[data-sel]');
        if (a) { const [t, id] = a.dataset.sel.split(':'); UI.select(t, isNaN(+id) ? id : +id, true); e.preventDefault(); }
        const f = e.target.closest('[data-focus]');
        if (f && f.dataset.focus) { const [x, y] = f.dataset.focus.split(',').map(Number); G.View.focus(x, y, 3); }
        if (!e.target.closest('#imenu') && !e.target.closest('#interventions') && !e.target.closest('#coach')) UI.closeMenu();
      });
      UI.refreshMapMode();
      G.View.turnMode = true;
      UI.setSpeed(0);
    },

    // ---- 時間 ----
    setSpeed(s) { G.View.speed = s; UI.refreshSpeed(); },
    refreshSpeed() {
      document.querySelectorAll('#speed button').forEach(b => b.classList.toggle('on', !G.View.turnMode && +b.dataset.speed === G.View.speed));
      const nb = $('#btn-next');
      const running = G.View.speed > 0;
      nb.classList.toggle('running', running && G.View.turnMode);
      nb.textContent = running && G.View.turnMode ? '1か月 進行中…' : (running ? '止める ■' : '次の月へ ▶');
    },
    nextMonth() {
      if (G.View.speed > 0 && !G.View.turnMode) { UI.setSpeed(0); return; }
      if (G.View.speed > 0) return;
      if (W.S.ended && W.S.ended.final) { G.StoryUI.ending(W.S.ended.key); return; }
      UI.closeMenu();
      G.View.turnMode = true;
      UI.setSpeed(2.2);
    },
    onMonthEnd() {
      if (!W.S) return;
      if (G.View.turnMode) { G.View.selected = null; G.Panels.renderDetail(true); const d = $('#right'); d.classList.remove('pulse'); void d.offsetWidth; d.classList.add('pulse'); if (window.innerWidth < 900) document.body.classList.add('show-right'); }
      G.Tut.notify('month');
    },

    // ---- 介入メニュー ----
    openMenu(cat) {
      if (!W.S) return;
      const C = G.Powers.CATS[cat];
      const list = G.Powers.ofCat(cat);
      const used = G.Powers.usedThisMonth();
      let h = `<div class="im-head ${cat}"><b>${C.name}</b><small>${C.sub}</small><span class="im-faith">信仰 ${Math.floor(W.S.goddess.power)}</span><button class="im-close" aria-label="閉じる">×</button></div>`;
      if (used) h += `<div class="im-note">今月はもう介入しました。「次の月へ」で進めてください。</div>`;
      h += '<div class="im-list">';
      for (const p of list) {
        const why = G.Powers.check(p);
        const cost = G.Powers.costOf(p);
        const sus = p.sus > 0 ? `<span class="sus">疑念+${p.sus}</span>` : p.sus < 0 ? `<span class="sus good">疑念${p.sus}</span>` : '';
        h += `<div class="im-opt${why ? ' locked' : ''}" data-key="${p.key}"><div class="im-top"><b>${p.name}</b><span class="cost">${cost ? '信仰 ' + cost : '無料'}</span>${sus}</div><div class="im-desc">${esc(p.desc)}</div>${why ? `<div class="im-why">${esc(why)}</div>` : ''}</div>`;
      }
      h += '</div>';
      const m = $('#imenu');
      m.innerHTML = h; m.className = 'open ' + cat; m.dataset.cat = cat;
      document.querySelectorAll('.ibtn').forEach(b => b.classList.toggle('on', b.dataset.cat === cat));
      G.Tut.notify('menu:' + cat);
    },
    closeMenu() { const m = $('#imenu'); if (m) { m.className = ''; m.innerHTML = ''; } document.querySelectorAll('.ibtn').forEach(b => b.classList.remove('on')); },
    pickPower(key) {
      const p = G.Powers.get(key);
      const why = G.Powers.check(p); if (why) { UI.toast(why); return; }
      if (p.choose) {
        const opt = document.querySelector(`#imenu [data-key="${key}"]`);
        if (opt.querySelector('.im-choose')) return;
        opt.insertAdjacentHTML('beforeend', `<div class="im-choose">${p.choose.map(c => `<button data-choose="${key}:${c.v}">${c.t}</button>`).join('')}</div>`);
        return;
      }
      if (p.target === 'point') { UI.closeMenu(); UI.startTargeting(key); return; }
      UI.usePower(key);
    },
    usePower(key, arg) {
      const r = G.Powers.use(key, arg);
      if (!r.ok) { UI.toast(r.msg); return; }
      UI.closeMenu(); UI.cancelTargeting();
      const fmt = (a, b) => `${G.fmt(a)} → <b>${G.fmt(b)}</b>`;
      UI.result(`<b>${r.p.name}</b><span>人族の戦力 ${fmt(r.before.h, r.after.h)}</span><span>魔族の戦力 ${fmt(r.before.d, r.after.d)}</span>`);
      if (r.p.cat !== 'miracle') UI.mask();
      G.Log.render(true); G.Panels.renderDetail(true); UI.refreshTop();
      G.Tut.notify('use:' + key);
    },
    // 裏の顔が一瞬のぞく
    mask() { const b = $('#goddess-box'); b.classList.remove('reveal'); void b.offsetWidth; b.classList.add('reveal'); },
    result(html) {
      const t = $('#toast');
      t.innerHTML = html; t.classList.add('on', 'result');
      clearTimeout(UI._tt); UI._tt = setTimeout(() => t.classList.remove('on', 'result'), 3600);
    },
    startTargeting(key) {
      const p = G.Powers.get(key);
      G.View.targeting = key;
      $('#target-text').textContent = `「${p.name}」: 地図で場所をクリックしてください`;
      $('#targeting').classList.add('on');
    },
    cancelTargeting() { G.View.targeting = null; $('#targeting').classList.remove('on'); },

    select(type, id, focus) {
      G.View.selected = { type, id };
      if (type === 'nation' || UI._lastSelNation) G.View.refreshTerritory();
      UI._lastSelNation = type === 'nation';
      G.Panels.renderDetail(true);
      if (window.innerWidth < 900) { document.body.classList.add('show-right'); document.body.classList.remove('show-left'); }
      if (focus) { const p = G.Panels.positionOf(type, id); if (p) G.View.focus(p.x, p.y, type === 'nation' ? null : 3); }
    },
    refreshMapMode() { document.querySelectorAll('#mapmode button').forEach(b => b.classList.toggle('on', b.dataset.mode === G.View.mode)); },

    toast(msg) {
      const t = $('#toast');
      t.textContent = msg; t.classList.remove('result'); t.classList.add('on');
      clearTimeout(UI._tt); UI._tt = setTimeout(() => t.classList.remove('on'), 2600);
    },
    help(on) { $('#help').classList.toggle('open', on); },
    loadGame() {
      const r = G.Save.load();
      if (!r.ok) { UI.toast(r.msg); return; }
      G.Main.afterWorldReady(true);
      UI.toast(`ロードしました(${W.dateText()})`);
    },

    // ---- 上のバーと戦況バー ----
    refreshTop() {
      const S = W.S; if (!S) return;
      const g = S.goddess, Fa = F();
      $('#t-date').textContent = `${W.year()}年 ${W.monthOfYear() + 1}月`;
      $('#t-season').textContent = W.season();
      $('#t-season').className = 'season s-' + { 春: 'spring', 夏: 'summer', 秋: 'autumn', 冬: 'winter' }[W.season()];
      $('#t-waryear').textContent = Fa.grandWar() && !Fa.grandWar().ended ? `人魔大戦 ${Fa.warYears() + 1}年目` : '';
      $('#t-faith').textContent = Math.floor(g.power);
      const inc = g.income || 0;
      $('#t-income').textContent = `${inc >= 0 ? '+' : ''}${inc.toFixed(1)}/月`;
      $('#t-income').className = inc < 2 ? 'low' : '';
      $('#t-lv').textContent = 'Lv' + g.level;
      const lo = G.Faith.LEVELS[g.level - 1] || 0, hi = G.Faith.nextLevelAt(g.level);
      $('#t-lvbar').style.width = hi ? ((g.total - lo) / (hi - lo) * 100) + '%' : '100%';
      $('#t-aware').style.width = g.awareness + '%';
      $('#t-aware-n').textContent = Math.round(g.awareness);
      $('#goddess-box').classList.toggle('slipping', g.awareness >= 68 || !!(S.revolt && S.revolt.active));
      // 戦況バー
      const hp = Fa.power('h'), dp = Fa.power('d'), b = Fa.balance();
      $('#wb-hp').textContent = G.fmt(hp); $('#wb-dp').textContent = G.fmt(dp);
      $('#wb-hc').textContent = `${Fa.citiesOf('h').length}都市`; $('#wb-dc').textContent = `${Fa.citiesOf('d').length}都市`;
      $('#wb-fill').style.width = (b * 100) + '%';
      $('#wb-mark').style.left = (b * 100) + '%';
      const lab = Fa.balanceLabel(b);
      const lb = $('#wb-label'); lb.textContent = lab.t + (b >= 0.38 && b <= 0.62 ? '(ちょうどいい)' : '(かたよりすぎ)'); lb.className = 'wb-label ' + lab.k;
      // 警告
      const al = $('#alert');
      if (S.revolt && S.revolt.active) { al.innerHTML = `<b>神殺しの同盟</b> 力 ${Math.round(S.revolt.v)}/100 ― 100になると女神は倒される。「運命の操作」で対抗を`; al.className = 'on revolt'; }
      else if (S.peace) { const left = S.peace.months - Math.floor((S.day - S.peace.start) / 30); al.innerHTML = `<b>和平交渉中!</b> あと${Math.max(0, left)}か月で戦争が終わる ―「運命の操作」→「和平の妨害」で止める`; al.className = 'on peace'; }
      else if (b > 0.7 || b < 0.3) { al.innerHTML = `<b>${b > 0.7 ? '人族' : '魔族'}が勝ちすぎています</b> ―「${b > 0.7 ? '邪神の囁き' : '神の奇跡'}」で${b > 0.7 ? '魔族' : '人族'}に力を`; al.className = 'on warn'; }
      else { al.className = ''; al.innerHTML = ''; }
      const used = G.Powers.usedThisMonth();
      $('#used-note').textContent = used ? `今月の介入: ${S.report && S.report.used ? S.report.used : '済み'}` : '今月の介入: まだ(1回えらべる)';
      $('#used-note').className = 'used-note' + (used ? ' done' : '');
    }
  };
  G.UI = UI;
})(globalThis.GD = globalThis.GD || {});
