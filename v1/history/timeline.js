// 歴史: ゲーム開始前の歴史を作る・年表をまとめる
(function (G) {
  const W = G.World;

  const H = {
    // 開始前の約300年の歴史(毎回ランダム)
    prehistory() {
      const S = W.S, rng = W.rng, y0 = S.startYear;
      const ns = W.aliveNations();
      const add = (y, type, title, text) => S.history.push({ y, m: rng.int(1, 12), type, title, text, imp: 2, pre: true });
      add(y0 - rng.int(320, 360), 'goddess', '世界の創造', '女神が大地と海を創り、山や森を生み出した。最初に人間が、つづいて多くの種族が生まれた。');
      const sorted = ns.slice().sort((a, b) => a.founded - b.founded);
      for (const n of sorted) add(n.founded, 'nation', `${n.name}の建国`, `${G.RACES[n.race].name}の人々が${W.capitalOf(n.id).name}を都として${n.name}を建てた。`);
      // 昔の戦争 → いまの恨み
      const pairs = [];
      for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) pairs.push([ns[i], ns[j]]);
      rng.shuffle(pairs);
      const hd = pairs.find(p => (p[0].race === 'human' && p[1].race === 'demon') || (p[1].race === 'human' && p[0].race === 'demon'));
      const wars = (hd ? [hd] : []).concat(pairs.filter(p => p !== hd).slice(0, rng.int(2, 4)));
      for (const [a, b] of wars) {
        const y = rng.int(Math.max(a.founded, b.founded) + 5, y0 - 8);
        if (y >= y0) continue;
        const rk = [a.race, b.race].sort().join('|');
        S.warCount[rk] = (S.warCount[rk] || 0) + 1;
        const kanji = ['一', '二', '三', '四'];
        const name = rk === 'demon|human' ? `第${kanji[Math.min(3, S.warCount[rk] - 1)]}次人魔大戦` : `${a.short}・${b.short}戦争`;
        const win = rng.chance(0.5) ? a : b;
        add(y, 'war', name, `${a.name}と${b.name}が争った。${rng.chance(0.3) ? '多くの命が失われ、決着はつかなかった。' : win.name + 'が勝利した。'}`);
        const r = W.rel(a.id, b.id);
        r.grudge = rng.int(15, 45) * (1 - (y0 - y) / 400);
      }
      if (hd && rng.chance(0.6)) {
        const y = rng.int(y0 - 120, y0 - 40);
        add(y, 'politics', '人と魔族の和平', '長い争いに疲れた人間と魔族の王たちが、ひとときの和平を結んだ。');
      }
      const r1 = rng.int(y0 - 280, y0 - 120);
      add(r1, 'religion', '女神教の成立', '女神の存在を信じる人々が集まり、女神教が生まれた。');
      add(rng.int(y0 - 250, y0 - 100), 'disaster', '大災厄', rng.pick(['空から星が落ち、大地が裂けた。', '黒い疫病が大陸中に広がった。', '巨大な魔物が目覚め、いくつもの町が滅んだ。']));
      add(rng.int(y0 - 200, y0 - 60), 'discovery', '古代文明のなごり', '大陸のあちこちに、はるか昔に滅んだ文明の遺跡が眠っていることが語り継がれている。');
      add(y0, 'goddess', '女神の目覚め', '長い眠りから女神が目を覚まし、ふたたび世界を見つめはじめた。');
      S.history.sort((a, b) => a.y - b.y || a.m - b.m);
    },

    // 年表に表示する一覧(新しい順)
    list(filter) {
      const out = W.S.history.slice().reverse();
      return filter ? out.filter(e => e.type === filter) : out;
    }
  };
  G.History = H;
})(globalThis.GD = globalThis.GD || {});
