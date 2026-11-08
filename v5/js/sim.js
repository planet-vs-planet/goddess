// 時間を進める: 毎日(軍・会戦・包囲)/毎月(国・事件・信仰)/毎年(人物)
(function (G) {
  const Sim = {
    newGame(seed) {
      G.World.create(seed);
      for (const c of G.cities()) c.home = c.owner;
      G.Nations.recomputeBorders();
      G.War.plan();
      return G.S;
    },
    day() {
      const S = G.S;
      S.day++;
      G.War.daily();
      G.Goddess.pendingDay();
      if (S.day % 7 === 0) Sim.hunt();
      if (S.day % G.CFG.DAYS_PER_MONTH === 0) Sim.month();
      if (S.day % 360 === 0) G.People.yearly();
      S.fx = S.fx.filter(f => f.until > S.day && (f.type !== 'siege' || (G.C(f.city) && G.C(f.city).siege)));
      if (S.weather) S.weather = S.weather.filter(w => w.until > S.day);
      S.rngState = G.rng.getState();
    },
    month() {
      G.Nations.monthly();
      G.Story.monthly();
      G.War.plan();
      G.Goddess.monthly();
      if (G.M() === 1) G.emit('year', G.Y());
      G.emit('month');
    },
    // 敵の軍を追いかける軍は、ときどき道を引き直す
    hunt() {
      for (const a of G.armies()) {
        if (a.mission !== 'hunt' || a.state !== 'march') continue;
        const e = G.A(a.hunt);
        if (!e || !G.War.hostile(a, e)) { a.state = 'idle'; a.mission = 'idle'; continue; }
        G.War.go(a, e.x, e.y, 'hunt', null); a.hunt = e.id;
      }
    },
    run(days) { for (let i = 0; i < days; i++) Sim.day(); }
  };
  G.Sim = Sim;

  // ---- セーブ・ロード ----
  G.Save = {
    dump() { G.S.rngState = G.rng.getState(); return JSON.stringify(G.S); },
    restore(txt) {
      const S = JSON.parse(txt);
      if (!S || S.v !== G.CFG.VERSION) throw new Error('このセーブは読めません');
      G.S = S;
      G.rng = new G.RNG(S.rngState);
      G.World.buildMap();
      G.World.regions();
      G.World.refresh();
      return S;
    },
    save(slot) { try { localStorage.setItem(G.CFG.SAVE_KEY + (slot || ''), G.Save.dump()); return true; } catch (e) { return false; } },
    load(slot) { try { const t = localStorage.getItem(G.CFG.SAVE_KEY + (slot || '')); if (!t) return false; G.Save.restore(t); return true; } catch (e) { console.error(e); return false; } },
    has(slot) { try { return !!localStorage.getItem(G.CFG.SAVE_KEY + (slot || '')); } catch (e) { return false; } }
  };
})(globalThis.GD = globalThis.GD || {});
