// セーブ・ロード(ブラウザのlocalStorage。ファイルへの書き出し・読みこみもできる)
(function (G) {
  const W = G.World;

  const Save = {
    serialize() {
      W.S.rng = W.rng.getState();
      return JSON.stringify(W.S);
    },
    restore(json) {
      const S = typeof json === 'string' ? JSON.parse(json) : json;
      if (!S || S.version !== G.CFG.VERSION || !S.seed) throw new Error('セーブデータの形式がちがいます');
      W.S = S;
      W.rng = new G.RNG(S.rng);
      W.fx = [];
      G.Map.build(S.seed);          // 地形はシードから作り直す
      G.Map.computeRegions(S.cities); // 領土は都市の位置から作り直す
      W.dirtyTerritory = true;
      return S;
    },
    save() {
      try {
        const data = Save.serialize();
        localStorage.setItem(G.CFG.SAVE_KEY, data);
        localStorage.setItem(G.CFG.SAVE_KEY + '-meta', JSON.stringify({ date: W.dateText(), nations: W.aliveNations().length, saved: Date.now(), seed: W.S.seed }));
        return { ok: true, size: data.length };
      } catch (e) {
        return { ok: false, msg: e.message };
      }
    },
    load() {
      const data = localStorage.getItem(G.CFG.SAVE_KEY);
      if (!data) return { ok: false, msg: 'セーブデータがありません' };
      try { Save.restore(data); return { ok: true }; } catch (e) { return { ok: false, msg: e.message }; }
    },
    meta() {
      try { return JSON.parse(localStorage.getItem(G.CFG.SAVE_KEY + '-meta') || 'null'); } catch (e) { return null; }
    },
    exportFile() {
      const blob = new Blob([Save.serialize()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `goddess-${W.S.seed}-${W.year()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  };
  G.Save = Save;
})(globalThis.GD = globalThis.GD || {});
