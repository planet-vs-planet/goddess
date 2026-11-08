// 起動: 画像を読む → タイトル → 新しい世界 / つづきから
(function (G) {
  const $ = s => document.querySelector(s);
  const Main = {
    boot() {
      G.Render.init($('#map'));
      G.UI.init();
      // ボタンは画像を待たずにすぐ押せるようにする
      Main.title();
      const go = () => { Main.ready = true; if (Main.pending) { const f = Main.pending; Main.pending = null; f(); } };
      G.Render.load([['tiles', G.src('assets/map/tiles.png')], ['cities', G.src('assets/map/cities.png')], ['armies', G.src('assets/map/armies.png')]], go);
      G.listeners.push((t, d) => { if (t === 'pick') G.UI.select(d); });
    },
    title() {
      $('#title').classList.remove('hidden');
      $('#btn-continue').disabled = !G.Save.has();
      const run = f => () => { try { G.BGM.start(); } catch (e) { } if (Main.ready) f(); else { Main.pending = f; $('#btn-new').textContent = '読み込み中…'; } };
      $('#btn-new').onclick = run(() => Main.newGame($('#seed').value.trim() || null));
      $('#btn-continue').onclick = run(() => { if (G.Save.load()) Main.afterLoad(); });
    },
    newGame(seed) {
      G.Sim.newGame(seed || String(Math.floor(Math.random() * 1e9)));
      Main.enter();
      // 最初の出来事へカメラを向ける
      const sp = G.Story.spotlight()[0];
      if (sp && sp.at) setTimeout(() => G.Render.flyTo(sp.at.x, sp.at.y, Math.max(G.Render.cam.z * 1.5, 1.3)), 500);
      let coached = false; try { coached = !!localStorage.getItem('goddess6-coached'); } catch (e) { }
      setTimeout(() => coached ? G.UI.toast('▶を押すと時間が進みます') : G.Coach.start(), 1500);
    },
    afterLoad() { Main.enter(); },
    enter() {
      $('#title').classList.add('hidden');
      G.Render.resize();
      G.Render.buildTerrain();
      G.Render.fit();
      G.Render.flagCache = {};
      G.UI.start();
      G.BGM.play('field');
    }
  };
  G.Main = Main;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', Main.boot); else Main.boot();
})(globalThis.GD = globalThis.GD || {});
