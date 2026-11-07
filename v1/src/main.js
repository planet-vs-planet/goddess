// はじまり: タイトル画面・世界の創造・画面の更新
(function (G) {
  const W = G.World;
  const $ = s => document.querySelector(s);

  const Main = {
    started: false,
    boot() {
      // ChatGPTで作った画像があれば使う(なくても動く)
      const files = (G.ASSET_FILES || []).map(f => [f.replace(/\.\w+$/, ''), (G.ASSET_DATA && G.ASSET_DATA[f]) || 'assets/' + f]);
      G.Sprites.loadOptional(files, () => {
        if (G.Sprites.images.tiles) G.CFG.TILE = 16; // ChatGPTの地形画像があれば細かく描く
        G.UI.init(); G.Panels.init(); G.Log.init(); G.StoryUI.init(); G.Tut.init();
        G.View.start('map');
        Main.showTitle();
        setInterval(Main.tick, 250);
        setInterval(() => { if (Main.started && !(W.S && W.S.tutorial)) G.Save.save(); }, 60000); // 1分ごとに自動セーブ
      });
      $('#title-new').addEventListener('click', () => Main.newWorld($('#seed').value.trim() || Main.randomSeed()));
      $('#title-dice').addEventListener('click', () => { $('#seed').value = Main.randomSeed(); });
      $('#title-continue').addEventListener('click', () => {
        const r = G.Save.load();
        if (!r.ok) { G.UI.toast(r.msg); return; }
        Main.afterWorldReady(true);
      });
    },
    randomSeed() {
      const a = ['蒼', '紅', '翠', '金', '銀', '黒', '白', '星', '月', '炎', '氷', '風'], b = ['の大地', 'の大陸', 'の世界', 'の王国', 'の時代'];
      return a[Math.floor(Math.random() * a.length)] + b[Math.floor(Math.random() * b.length)] + Math.floor(Math.random() * 9000 + 1000);
    },
    showTitle() {
      const tbg = (G.STORY_ART && G.STORY_ART.goddess_light) || (G.ART && G.ART.title);
      if (tbg) { $('#title').style.backgroundImage = `url("${tbg}")`; $('#title').classList.add('has-art'); }
      G.UI.setSpeed(0);
      const meta = G.Save.meta();
      $('#title-continue').disabled = !meta;
      $('#title-save-info').textContent = meta ? `前回: ${meta.date}(${meta.nations}か国・世界「${meta.seed}」)` : 'セーブデータはありません';
      if (!$('#seed').value) $('#seed').value = Main.randomSeed();
      $('#title').classList.add('open');
    },
    newWorld(seed) {
      $('#title-new').disabled = true;
      $('#creating').classList.add('on');
      setTimeout(() => { // 「創造中」を表示してから重い処理
        try {
          G.Sim.newWorld(seed);
          Main.afterWorldReady(false);
        } catch (e) { console.error(e); G.UI.toast('世界の創造に失敗しました: ' + e.message); }
        $('#title-new').disabled = false;
        $('#creating').classList.remove('on');
      }, 60);
    },
    // loaded: セーブから続きを始めたとき
    afterWorldReady(loaded) {
      Main.started = true;
      G.Sprites.portraitCache = {}; G.Sprites.flagCache = {};
      G.View.selected = null; G.UI.cancelTargeting();
      G.View.rebuild();
      $('#title').classList.remove('open');
      G.Panels.renderList(true); G.Panels.renderDetail(true); G.Log.render(true); G.UI.refreshTop();
      G.View.turnMode = true; G.UI.setSpeed(0);
      if (loaded) return;
      // 新しい世界: オープニング → チュートリアル → 使命(初回)。2回目からはオープニングだけ選べる
      let seen = false; try { seen = !!localStorage.getItem('goddess-tutorial-done'); } catch (e) { }
      G.StoryUI.play(G.StoryUI.OPENING, () => {
        if (seen) { G.StoryUI.mission(); return; }
        try { localStorage.setItem('goddess-tutorial-done', '1'); } catch (e) { }
        G.Tut.start();
      });
    },
    n: 0,
    tick() {
      if (!Main.started || !W.S) return;
      Main.n++;
      G.UI.refreshTop();
      G.StoryUI.check();
      G.Log.render();
      G.Panels.renderDetail();
      if (Main.n % 4 === 0) G.Panels.renderList();
    }
  };
  G.Main = Main;
  window.addEventListener('DOMContentLoaded', Main.boot);
})(globalThis.GD = globalThis.GD || {});
