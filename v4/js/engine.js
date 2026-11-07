// 物語エンジン: 場面 → 女神が誰かに介入 → 結果(フラグ) → 次の場面 → … → エンディング
// 物語の中身は G.SAGA(ChatGPTが書いた全体図と本文)
(function (G) {
  const has = (S, f) => S.flags.includes(f);
  const Engine = {
    S: null,
    newGame() {
      Engine.S = { v: 5, ch: 1, done: [], flags: [], log: [], scene: null, ended: null };
      Engine.S.scene = Engine.nextScene();
      return Engine.S;
    },
    scene(id) { return G.SAGA.scenes.find(s => s.id === id); },
    ok(sc) {
      const S = Engine.S;
      return (sc.requires || []).every(f => has(S, f)) && !(sc.excludes || []).some(f => has(S, f));
    },
    // まだ見ていない場面のうち、条件に合う最初のもの(章の順)
    nextScene() {
      const S = Engine.S, list = G.SAGA.scenes;
      for (const sc of list) {
        if (S.done.includes(sc.id)) continue;
        if (sc.chapter < S.ch) continue;
        // 同じ「枠(slot)」の場面をもう見ていたら飛ばす(入れ替わる別の場面)
        if (sc.slot && S.done.some(id => (Engine.scene(id) || {}).slot === sc.slot)) continue;
        if (!Engine.ok(sc)) continue;
        S.ch = sc.chapter;
        return sc.id;
      }
      return null;
    },
    branch(sc, act, target) { return (sc.branches || []).find(b => b.act === act && b.target === target); },
    // 女神の介入
    act(act, target) {
      const S = Engine.S, sc = Engine.scene(S.scene), b = Engine.branch(sc, act, target);
      if (!b) return null;
      for (const f of b.sets || []) if (!has(S, f)) S.flags.push(f);
      for (const f of b.clears || []) S.flags = S.flags.filter(x => x !== f);
      S.log.push({ scene: sc.id, title: sc.title, ch: sc.chapter, act, target, result: b.result });
      S.done.push(sc.id);
      const prevCh = S.ch;
      S.scene = Engine.nextScene();
      if (!S.scene) S.ended = Engine.ending().id;
      return { b, newChapter: S.scene && Engine.scene(S.scene).chapter !== prevCh };
    },
    // エンディングの条件(ChatGPT案)。最後の玉座で「誰に」介入したかで優先順位が変わる
    RULES: {
      e_revolt: ['allen_rebel', 'zephyra_rebel', 'truth_shared'],
      e_peace: ['peace_road', 'truth_shared'],
      e_newqueen: ['zephyra_rebel', 'secret_blood'],
      e_shadow: ['shadow_deal', 'nox_confess'],
      e_nogods: ['goddess_exposed', 'elmina_truth'],
      e_sacrifice: ['allen_oath', 'angel_faith'],
      e_human: ['allen_oath', 'gran_peace'],
      e_demon: ['zephyra_rebel', 'volg_loyal'],
      e_war: []
    },
    ORDER: {
      allen: ['e_sacrifice', 'e_human', 'e_revolt', 'e_peace', 'e_nogods', 'e_newqueen', 'e_demon', 'e_shadow'],
      zephyra: ['e_newqueen', 'e_demon', 'e_peace', 'e_revolt', 'e_nogods', 'e_human', 'e_sacrifice', 'e_shadow'],
      nox: ['e_shadow', 'e_nogods', 'e_revolt', 'e_peace', 'e_newqueen', 'e_demon', 'e_human', 'e_sacrifice'],
      _: ['e_revolt', 'e_peace', 'e_newqueen', 'e_shadow', 'e_nogods', 'e_sacrifice', 'e_human', 'e_demon']
    },
    ending() {
      const S = Engine.S, last = S.log[S.log.length - 1] || {};
      const order = (Engine.ORDER[last.target] || Engine.ORDER._).concat('e_war');
      const id = order.find(k => (Engine.RULES[k] || []).every(f => has(S, f))) || 'e_war';
      return G.SAGA.endings.find(e => e.id === id) || G.SAGA.endings[G.SAGA.endings.length - 1];
    },
    save() { try { localStorage.setItem('goddess5-save', JSON.stringify(Engine.S)); } catch (e) { } },
    load() { try { const t = localStorage.getItem('goddess5-save'); if (t) { Engine.S = JSON.parse(t); return true; } } catch (e) { } return false; },
    hasSave() { try { return !!localStorage.getItem('goddess5-save'); } catch (e) { return false; } },
    clearSave() { try { localStorage.removeItem('goddess5-save'); } catch (e) { } },
    // 見たエンディングを集める
    seenEndings() { try { return JSON.parse(localStorage.getItem('goddess5-endings') || '[]'); } catch (e) { return []; } },
    addEnding(id) { try { const a = Engine.seenEndings(); if (!a.includes(id)) { a.push(id); localStorage.setItem('goddess5-endings', JSON.stringify(a)); } } catch (e) { } }
  };
  G.Engine = Engine;
})(globalThis.G2 = globalThis.G2 || {});
