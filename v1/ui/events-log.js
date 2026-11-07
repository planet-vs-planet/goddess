// 下のイベントログ
(function (G) {
  const W = G.World;
  const $ = s => document.querySelector(s);
  const LABEL = { war: '戦', politics: '政', person: '人', disaster: '災', goddess: '神', miracle: '奇', nation: '国', religion: '宗', discovery: '発' };

  const Log = {
    filter: '', minImp: 1, _last: null,
    init() {
      $('#log-filter').addEventListener('click', e => {
        const b = e.target.closest('[data-f]'); if (!b) return;
        Log.filter = b.dataset.f;
        document.querySelectorAll('#log-filter [data-f]').forEach(x => x.classList.toggle('on', x === b));
        Log.render(true);
      });
      $('#bigevent').addEventListener('click', () => {
        const i = +$('#bigevent').dataset.i, ev = W.S.log[i];
        if (ev && ev.x != null) G.View.focus(ev.x, ev.y, 3);
        if (ev) G.UI.select('event', i);
        $('#bigevent').classList.remove('on');
      });
      $('#log').addEventListener('click', e => {
        const it = e.target.closest('[data-i]'); if (!it) return;
        const ev = W.S.log[+it.dataset.i];
        if (!ev) return;
        if (ev.x != null) G.View.focus(ev.x, ev.y, 3);
        G.UI.select('event', +it.dataset.i);
      });
    },
    match(e) {
      if (e.imp < Log.minImp && e.type !== 'goddess') return false;
      if (!Log.filter) return true;
      if (Log.filter === 'disaster') return e.type === 'disaster';
      if (Log.filter === 'goddess') return e.type === 'goddess' || e.type === 'miracle' || e.type === 'religion';
      if (Log.filter === 'politics') return e.type === 'politics' || e.type === 'nation';
      return e.type === Log.filter;
    },
    render(force) {
      const S = W.S; if (!S) return;
      const key = S.log.length + ':' + (S.log.length ? S.log[S.log.length - 1].d : 0) + Log.filter;
      if (!force && key === Log._last) return;
      Log._last = key;
      const out = [];
      for (let i = S.log.length - 1; i >= 0 && out.length < 120; i--) {
        const e = S.log[i];
        if (!Log.match(e)) continue;
        out.push(`<div class="ev t-${e.type}${e.imp >= 3 ? ' big' : ''}${S.day - e.d < 60 ? ' new' : ''}" data-i="${i}"><span class="ety">${LABEL[e.type] || '・'}</span><span class="edate">${W.dateText(e.d)}</span><b>${G.esc(e.title)}</b><span class="etx">${G.esc(e.text)}</span></div>`);
      }
      $('#log').innerHTML = out.join('') || '<div class="empty">まだ出来事はありません</div>';
      Log.popup();
    },
    _seen: -1, _popAt: 0,
    // 歴史的な出来事が起きたら、絵つきのカードを少しのあいだ出す
    popup() {
      const S = W.S, now = Date.now();
      if (Log._seen < 0 || Log._seenWorld !== S) { Log._seen = S.log.length; Log._seenWorld = S; return; }
      let pick = null;
      for (let i = Log._seen; i < S.log.length; i++) { const e = S.log[i]; if (e && (e.imp >= 3 || (e.type === 'goddess' && e.imp >= 2))) pick = i; }
      Log._seen = S.log.length;
      if (pick == null || now - Log._popAt < 6000 || !G.Art.has()) return;
      const e = S.log[pick], img = G.Art.eventImage(e);
      if (!img) return;
      Log._popAt = now;
      const el = $('#bigevent');
      el.innerHTML = `<img src="${img}" alt=""><div class="be-body"><small>${W.dateText(e.d)}</small><b>${G.esc(e.title)}</b><span>${G.esc(e.text)}</span></div>`;
      el.dataset.i = pick;
      el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
      clearTimeout(Log._pt); Log._pt = setTimeout(() => el.classList.remove('on'), 5500);
    }
  };
  G.Log = Log;
})(globalThis.GD = globalThis.GD || {});
