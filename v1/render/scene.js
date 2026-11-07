// 世界マップの描画(Phaser 3)。計算はしない。World.S の中身を見て描くだけ。
(function (G) {
  const W = G.World;
  const TS = () => G.CFG.TILE;
  const FONT = '"DotGothic16","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif';

  class WorldScene extends Phaser.Scene {
    constructor() { super('world'); }

    create() {
      G.View.scene = this;
      this.cameras.main.setBackgroundColor('#0a1424');
      this.layers = {
        terrain: this.add.layer(), territory: this.add.layer(), ruins: this.add.layer(), cities: this.add.layer(),
        nationLabels: this.add.layer(), armies: this.add.layer(), fx: this.add.layer(), labels: this.add.layer()
      };
      this.fxGfx = this.add.graphics(); this.layers.fx.add(this.fxGfx);
      this.selGfx = this.add.graphics(); this.layers.fx.add(this.selGfx);
      this.armyObjs = {}; this.battleObjs = {};
      this.acc = 0; this.lastTerr = 0;
      this.setupInput();
      this.scale.on('resize', () => this.clampCamera());
      if (G.View.pendingBuild) { G.View.pendingBuild = false; this.buildWorld(); }
    }

    // ---- 世界ができたとき・ロードしたときに作り直す ----
    buildWorld() {
      const MW = G.Map.W, ts = TS();
      for (const k in this.layers) if (k !== 'fx') this.layers[k].removeAll(true);
      this.armyObjs = {}; this.battleObjs = {};
      const tex = this.textures;
      for (const key of ['terrain', 'territory']) if (tex.exists(key)) tex.remove(key);
      tex.addCanvas('terrain', G.Sprites.terrainCanvas(MW));
      this.terrCanvas = document.createElement('canvas');
      this.terrCanvas.width = MW.w * ts; this.terrCanvas.height = MW.h * ts;
      this.terrTex = tex.addCanvas('territory', this.terrCanvas);
      for (let lv = 0; lv < 5; lv++) if (!tex.exists('city' + lv)) tex.addCanvas('city' + lv, G.Sprites.cityCanvas(lv));
      if (!tex.exists('banner')) tex.addCanvas('banner', G.Sprites.bannerCanvas());
      if (!tex.exists('monster')) tex.addCanvas('monster', G.Sprites.monsterCanvas());
      if (!tex.exists('swords')) tex.addCanvas('swords', G.Sprites.swordsCanvas());
      if (!tex.exists('ruin0')) { tex.addCanvas('ruin0', G.Sprites.ruinCanvas(false)); tex.addCanvas('ruin1', G.Sprites.ruinCanvas(true)); }
      this.layers.terrain.add(this.add.image(0, 0, 'terrain').setOrigin(0));
      this.layers.territory.add(this.add.image(0, 0, 'territory').setOrigin(0));
      this.cityObjs = []; this.ruinObjs = [];
      this.syncCities(true);
      this.syncRuins();
      W.dirtyTerritory = true;
      const cam = this.cameras.main;
      cam.setBounds(-MW.w * ts * 0.25, -MW.h * ts * 0.25, MW.w * ts * 1.5, MW.h * ts * 1.5);
      this.fitZoom();
    }
    fitZoom() {
      const MW = G.Map.W, ts = TS(), cam = this.cameras.main;
      const z = Math.min(cam.width / (MW.w * ts), cam.height / (MW.h * ts)) * 1.05;
      this.minZoom = Math.max(0.15, z * 0.8);
      cam.setZoom(Math.max(z, 0.2));
      cam.centerOn(MW.w * ts / 2, MW.h * ts / 2);
    }
    clampCamera() { /* カメラの範囲は setBounds が守る */ }

    syncCities(force) {
      const S = W.S, ts = TS();
      while (this.cityObjs.length < S.cities.length) {
        const c = S.cities[this.cityObjs.length];
        const img = this.add.image((c.x + 0.5) * ts, (c.y + 0.5) * ts, 'city0');
        const flag = this.add.rectangle(0, 0, 5, 4, 0xffffff).setOrigin(0, 1);
        const label = this.add.text(0, 0, c.name, { fontFamily: FONT, fontSize: '13px', color: '#f4ecd8', stroke: '#0b0b0b', strokeThickness: 4, resolution: 2 }).setOrigin(0.5, 0);
        const capStar = this.add.text(0, 0, '★', { fontFamily: FONT, fontSize: '11px', color: '#ffd76a', stroke: '#000', strokeThickness: 3, resolution: 2 }).setOrigin(0.5, 1);
        this.layers.cities.add([img, flag]); this.layers.labels.add([label, capStar]);
        this.cityObjs.push({ img, flag, label, capStar, lv: -1 });
      }
      for (let i = 0; i < S.cities.length; i++) {
        const c = S.cities[i], o = this.cityObjs[i];
        if (o.lv !== c.level) { o.img.setTexture('city' + c.level); o.lv = c.level; }
        const n = W.nation(c.owner);
        o.flag.fillColor = n ? n.color : 0x888888;
        o.isCap = n && n.capital === c.id;
        o.label.setText(c.name);
      }
    }
    syncRuins() {
      const ts = TS();
      for (const o of this.ruinObjs) o.destroy();
      this.ruinObjs = [];
      for (const r of W.S.ruins) {
        const img = this.add.image((r.x + 0.5) * ts, (r.y + 0.5) * ts, r.found ? 'ruin1' : 'ruin0').setAlpha(r.found ? 1 : 0.75);
        this.layers.ruins.add(img); this.ruinObjs.push(img);
      }
      this.ruinFound = W.S.ruins.filter(r => r.found).length;
    }

    redrawTerritory() {
      const MW = G.Map.W, S = W.S;
      const sel = G.View.selected && G.View.selected.type === 'nation' ? G.View.selected.id : null;
      G.Sprites.drawTerritory(this.terrCanvas, MW, S.cities, S.nations, G.View.mode, sel);
      this.terrTex.refresh();
      // 国名をその国の真ん中に
      this.layers.nationLabels.removeAll(true);
      if (G.View.mode === 'terrain') return;
      const sum = {};
      for (let i = 0; i < MW.region.length; i++) {
        const r = MW.region[i]; if (r < 0) continue;
        const o = S.cities[r].owner; if (o == null) continue;
        const s = sum[o] || (sum[o] = { x: 0, y: 0, n: 0 });
        s.x += i % MW.w; s.y += (i / MW.w) | 0; s.n++;
      }
      this.nationLabelObjs = [];
      for (const id in sum) {
        const n = S.nations[id], s = sum[id];
        if (!n || s.n < 30) continue;
        const t = this.add.text((s.x / s.n + 0.5) * TS(), (s.y / s.n) * TS(), n.name, {
          fontFamily: FONT, fontSize: '22px', color: '#fff6e0', stroke: G.Sprites.hexColor(n), strokeThickness: 5, resolution: 2
        }).setOrigin(0.5).setAlpha(0.82);
        t.size = s.n;
        this.layers.nationLabels.add(t); this.nationLabelObjs.push(t);
      }
    }

    // ---- 操作 ----
    setupInput() {
      const cam = () => this.cameras.main;
      this.input.addPointer(1);
      let down = null, pinch = null;
      this.input.on('pointerdown', p => {
        if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
          const a = this.input.pointer1, b = this.input.pointer2;
          pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: cam().zoom }; down = null; return;
        }
        down = { x: p.x, y: p.y, sx: cam().scrollX, sy: cam().scrollY, moved: false };
      });
      this.input.on('pointermove', p => {
        if (pinch && this.input.pointer1.isDown && this.input.pointer2.isDown) {
          const a = this.input.pointer1, b = this.input.pointer2;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          this.zoomTo(pinch.z * d / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2);
          return;
        }
        if (down && p.isDown) {
          const dx = p.x - down.x, dy = p.y - down.y;
          if (Math.abs(dx) + Math.abs(dy) > 6) down.moved = true;
          if (down.moved) { cam().scrollX = down.sx - dx / cam().zoom; cam().scrollY = down.sy - dy / cam().zoom; }
        } else {
          const wp = cam().getWorldPoint(p.x, p.y);
          G.View.hover = { x: wp.x / TS(), y: wp.y / TS() };
        }
      });
      this.input.on('pointerup', p => {
        if (pinch) { if (!this.input.pointer1.isDown || !this.input.pointer2.isDown) pinch = null; down = null; return; }
        if (down && !down.moved) {
          const wp = cam().getWorldPoint(p.x, p.y);
          G.View.click(wp.x / TS(), wp.y / TS());
        }
        down = null;
      });
      this.input.on('wheel', (p, objs, dx, dy) => {
        this.zoomTo(cam().zoom * (dy > 0 ? 0.85 : 1.18), p.x, p.y);
      });
      const keys = this.input.keyboard;
      if (keys) {
        keys.on('keydown', e => {
          if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
          const step = 60 / cam().zoom;
          if (e.key === 'ArrowLeft' || e.key === 'a') cam().scrollX -= step;
          if (e.key === 'ArrowRight' || e.key === 'd') cam().scrollX += step;
          if (e.key === 'ArrowUp' || e.key === 'w') cam().scrollY -= step;
          if (e.key === 'ArrowDown' || e.key === 's') cam().scrollY += step;
          if (e.key === ' ' && !(G.StoryUI && G.StoryUI.queue)) { G.UI.nextMonth(); e.preventDefault(); }
          if (e.key === 'Escape') G.UI.cancelTargeting();
        });
      }
    }
    zoomTo(z, sx, sy) {
      const cam = this.cameras.main;
      const before = cam.getWorldPoint(sx, sy);
      cam.setZoom(G.clamp(z, this.minZoom || 0.4, 4.5 * 8 / TS()));
      const after = cam.getWorldPoint(sx, sy);
      cam.scrollX += before.x - after.x; cam.scrollY += before.y - after.y;
    }
    focus(x, y, z) {
      const cam = this.cameras.main;
      if (z) cam.setZoom(G.clamp(z * 8 / TS(), this.minZoom || 0.4, 4.5 * 8 / TS()));
      cam.pan(x * TS(), y * TS(), 450, 'Sine.easeInOut');
    }

    // ---- 毎フレーム ----
    update(time, delta) {
      if (!W.S || !this.cityObjs) return;
      // 時間を進める(1倍速 = 1秒で1か月)
      const sp = G.View.speed;
      if (sp > 0 && !G.View.paused) {
        this.acc += Math.min(delta, 100) / 1000 * sp * G.CFG.DAYS_PER_MONTH;
        let steps = 0;
        while (this.acc >= 1 && steps < 40) {
          G.Sim.stepDay(); this.acc -= 1; steps++;
          if (W.S.day % G.CFG.DAYS_PER_MONTH === 0) {
            G.UI.onMonthEnd();
            if (G.View.turnMode || G.View.speed === 0) { G.View.speed = 0; this.acc = 0; G.UI.refreshSpeed(); break; }
          }
        }
        if (steps >= 40) this.acc = 0;
      }
      const cam = this.cameras.main, ts = TS(), z = cam.zoom * ts / 8; // z = 8pxマスに換算した拡大率
      if (W.S.cities.length !== this.cityObjs.length) { this.syncCities(); W.dirtyTerritory = true; }
      if (W.dirtyTerritory && time - this.lastTerr > 200) { W.dirtyTerritory = false; this.lastTerr = time; this.syncCities(); this.redrawTerritory(); }
      if (W.S.ruins.filter(r => r.found).length !== this.ruinFound) this.syncRuins();
      // 都市の絵と名前(拡大しても文字の大きさは同じ)
      const inv = 1 / cam.zoom; // 文字は画面上でいつも同じ大きさ
      const cityScale = G.clamp(0.55 / Math.sqrt(z) * 1.0, 0.18, 0.7);
      for (let i = 0; i < this.cityObjs.length; i++) {
        const c = W.S.cities[i], o = this.cityObjs[i];
        const px = (c.x + 0.5) * ts, py = (c.y + 0.5) * ts;
        const s = cityScale * (0.75 + c.level * 0.12) * (z < 1 ? 1.4 : 1) * (36 / o.img.width) * (G.Sprites.images.cities ? 1.5 : 1) * ts / 8;
        o.img.setPosition(px, py).setScale(s);
        const half = o.img.displayHeight / 2;
        o.flag.setPosition(px + o.img.displayWidth * 0.3, py - half * 0.6).setScale(inv * 1.6 * Math.min(1.5, z));
        o.label.setPosition(px, py + half + 1 * inv).setScale(inv);
        o.label.setVisible(z > 1.1 || c.level >= 3 || (o.isCap && z > 0.7));
        o.capStar.setVisible(!!o.isCap).setPosition(px, py - half).setScale(inv);
        const sel = G.View.selected;
        o.label.setColor(sel && sel.type === 'city' && sel.id === i ? '#ffe28a' : '#f4ecd8');
      }
      for (const r of this.ruinObjs) r.setScale(G.clamp(0.5 / Math.sqrt(z), 0.15, 0.6) * ts / 8);
      const small = cam.width < 700 ? 0.65 : 1;
      if (this.nationLabelObjs) for (const t of this.nationLabelObjs) { t.setScale(inv * (z < 1 ? 1 : 0.9) * small); t.setVisible(z < 2.6); t.setAlpha(z < 1.6 ? 0.85 : 0.5); }
      this.syncArmies(z, ts);
      this.drawFx(delta, cam.zoom, ts);
    }

    // 国ごとの軍隊の絵(旗の色)
    armyTex(nid) {
      const n = W.nation(nid);
      if (!G.Sprites.images.armies || !n) return 'banner';
      const key = 'army_' + n.race + '_' + n.color;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, G.Sprites.armyCanvas(n.race, n.color));
      return key;
    }
    syncArmies(z, ts) {
      const S = W.S, seen = {};
      for (const id in S.armies) {
        const a = S.armies[id];
        seen[id] = 1;
        let o = this.armyObjs[id];
        if (!o) {
          const mon = a.nation === -1;
          const img = this.add.image(0, 0, mon ? 'monster' : this.armyTex(a.nation)).setOrigin(G.Sprites.images.armies && !mon ? 0.5 : 0.2, 1);
          if (!mon && !G.Sprites.images.armies) img.setTint(W.nation(a.nation) ? W.nation(a.nation).color : 0xffffff);
          const txt = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', color: '#fff', stroke: '#000', strokeThickness: 3, resolution: 2 }).setOrigin(0, 0.5);
          this.layers.armies.add([img, txt]);
          o = this.armyObjs[id] = { img, txt, nation: a.nation };
        }
        if (o.nation !== a.nation) { o.nation = a.nation; if (a.nation !== -1 && W.nation(a.nation)) { if (G.Sprites.images.armies) o.img.setTexture(this.armyTex(a.nation)); else o.img.setTint(W.nation(a.nation).color); } }
        const s = G.clamp(0.45 / Math.sqrt(z), 0.16, 0.55) * (0.8 + Math.min(1.2, Math.log10(Math.max(10, a.total)) / 4)) * (24 / o.img.width) * (G.Sprites.images.armies && a.nation !== -1 ? 2.2 : 1) * ts / 8;
        const px = a.x * ts, py = a.y * ts;
        o.img.setPosition(px, py).setScale(s);
        o.txt.setPosition(px + o.img.displayWidth * 0.75, py - o.img.displayHeight * 0.6).setScale(1 / this.cameras.main.zoom).setText(G.fmt(a.total)).setVisible(z > 0.9);
        const sel = G.View.selected;
        o.img.setAlpha(a.state === 'retreat' ? 0.6 : 1);
        if (sel && sel.type === 'army' && sel.id === a.id) o.txt.setColor('#ffe28a'); else o.txt.setColor('#ffffff');
      }
      for (const id in this.armyObjs) if (!seen[id]) { this.armyObjs[id].img.destroy(); this.armyObjs[id].txt.destroy(); delete this.armyObjs[id]; }
      // 戦闘
      const bseen = {};
      for (const id in S.battles) {
        const b = S.battles[id]; bseen[id] = 1;
        let o = this.battleObjs[id];
        if (!o) { o = this.battleObjs[id] = this.add.image(0, 0, 'swords'); this.layers.armies.add(o); }
        const pulse = 1 + Math.sin(this.time.now / 120) * 0.15;
        o.setPosition(b.x * ts, b.y * ts - 6 / z).setScale(G.clamp(0.5 / Math.sqrt(z), 0.18, 0.6) * pulse * ts / 8);
      }
      for (const id in this.battleObjs) if (!bseen[id]) { this.battleObjs[id].destroy(); delete this.battleObjs[id]; }
    }

    drawFx(delta, z, ts) {
      const g = this.fxGfx; g.clear();
      const COL = { clash: 0xffa040, victory: 0xffffff, capture: 0xffd060, revolt: 0xff4040, drought: 0xe0a040, plague: 0x80ff60, quake: 0xc08060, flood: 0x60a0ff, cold: 0xc0e8ff, monster: 0xc040ff, fire: 0xff6020, hero: 0xffe080, bless: 0xfff0a0, oracle: 0xfff6d0, harvest: 0xf0d040, disaster: 0xff3030, miracle: 0xffffff, destroy: 0xff2020 };
      const life = 2.2;
      W.fx = W.fx.filter(f => (f.t += delta / 1000) < (f.kind === 'disaster' ? 3 : life));
      for (const f of W.fx) {
        const k = f.t / life;
        const col = f.color || COL[f.kind] || 0xffffff;
        const cx = (f.x + 0.5) * ts, cy = (f.y + 0.5) * ts;
        const base = f.r ? f.r * ts : 4 * ts;
        g.lineStyle(Math.max(1, 3 / z), col, Math.max(0, 1 - k));
        g.strokeCircle(cx, cy, base * (0.3 + k));
        g.lineStyle(Math.max(1, 2 / z), col, Math.max(0, 0.7 - k));
        g.strokeCircle(cx, cy, base * (0.1 + k * 0.6));
        if (f.kind === 'disaster' || f.kind === 'bless' || f.kind === 'miracle' || f.kind === 'oracle' || f.kind === 'harvest' || f.kind === 'hero') {
          for (let j = 0; j < 10; j++) {
            const a = j / 10 * Math.PI * 2 + f.t * 2;
            const r = base * (0.2 + k * 0.9) * (0.6 + (j % 3) * 0.2);
            g.fillStyle(col, Math.max(0, 1 - k));
            g.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r - k * ts * 2, 3 / z + 1, 3 / z + 1);
          }
        }
        if (f.kind === 'disaster') { g.fillStyle(0xff2020, Math.max(0, 0.25 - k * 0.1)); g.fillCircle(cx, cy, base); }
      }
      // 選んでいるものの印
      const sg = this.selGfx; sg.clear();
      const sel = G.View.selected;
      if (sel && sel.type === 'city' && W.S.cities[sel.id]) {
        const c = W.S.cities[sel.id];
        sg.lineStyle(2 / z, 0xffe28a, 0.9 + Math.sin(this.time.now / 200) * 0.1);
        sg.strokeCircle((c.x + 0.5) * ts, (c.y + 0.5) * ts, ts * 1.6);
      }
      if (sel && sel.type === 'army' && W.S.armies[sel.id]) {
        const a = W.S.armies[sel.id];
        sg.lineStyle(2 / z, 0xffe28a, 1); sg.strokeCircle(a.x * ts, a.y * ts, ts * 1.4);
        if (a.path) {
          sg.lineStyle(1.5 / z, 0xffe28a, 0.6); sg.beginPath(); sg.moveTo(a.x * ts, a.y * ts);
          for (let i = a.pi; i < a.path.length; i += 2) sg.lineTo((a.path[i][0] + 0.5) * ts, (a.path[i][1] + 0.5) * ts);
          sg.strokePath();
        }
      }
      // 女神の力の対象をえらんでいるとき
      if (G.View.targeting && G.View.hover) {
        const h = G.View.hover;
        const p = G.Powers.get(G.View.targeting);
        sg.lineStyle(2 / z, 0xfff0a0, 0.6 + Math.sin(this.time.now / 150) * 0.3);
        sg.strokeCircle(h.x * ts, h.y * ts, p.key === 'disaster' ? 7 * ts : ts * 1.5);
      }
    }
  }

  G.View = {
    game: null, scene: null, speed: 1, lastSpeed: 1, mode: 'political', selected: null, targeting: null, hover: null, paused: false, pendingBuild: false,
    start(parentId) {
      G.View.game = new Phaser.Game({
        type: Phaser.AUTO, parent: parentId, pixelArt: true, antialias: false, roundPixels: false,
        backgroundColor: '#0a1424', scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
        scene: WorldScene, banner: false, disableContextMenu: true
      });
    },
    rebuild() { if (G.View.scene) G.View.scene.buildWorld(); else G.View.pendingBuild = true; },
    focus(x, y, z) { if (G.View.scene && x != null) G.View.scene.focus(x, y, z); },
    refreshTerritory() { W.dirtyTerritory = true; },

    // マップをクリックしたとき
    click(x, y) {
      const S = W.S; if (!S) return;
      const near = (ax, ay, r) => Math.hypot(ax - x, ay - y) < r;
      const z = G.View.scene ? G.View.scene.cameras.main.zoom : 1;
      const R = G.clamp(1.6 / Math.sqrt(z) + 0.4, 0.8, 3);
      let army = null, ad = Infinity;
      for (const a of Object.values(S.armies)) { const d = Math.hypot(a.x - x, a.y - y + 0.6); if (d < R && d < ad) { ad = d; army = a; } }
      let city = null, cd = Infinity;
      for (const c of S.cities) { const d = Math.hypot(c.x + 0.5 - x, c.y + 0.5 - y); if (d < R * 1.1 && d < cd) { cd = d; city = c; } }
      const ix = Math.floor(x), iy = Math.floor(y);
      const inside = G.Map.inside(ix, iy);
      const region = inside ? G.Map.W.region[G.Map.idx(ix, iy)] : -1;
      const owner = region >= 0 ? S.cities[region].owner : null;
      // 女神の力
      if (G.View.targeting) {
        const p = G.Powers.get(G.View.targeting);
        let t = null;
        if (p.target === 'point') t = inside ? { x, y } : null;
        else if (p.target === 'army') t = army;
        else if (p.target === 'city') t = city || (region >= 0 ? S.cities[region] : null);
        else if (p.target === 'nation') t = owner != null ? W.nation(owner) : (city ? W.nation(city.owner) : null);
        if (!t) { G.UI.toast(p.target === 'army' ? '軍隊をクリックしてください' : 'その場所には使えません'); return; }
        G.UI.usePower(p.key, t);
        return;
      }
      if (army && (!city || ad < cd)) return G.UI.select('army', army.id);
      if (city) return G.UI.select('city', city.id);
      const ruin = S.ruins.find(r => near(r.x + 0.5, r.y + 0.5, R));
      if (ruin && ruin.found) return G.UI.select('ruin', S.ruins.indexOf(ruin));
      if (inside) return G.UI.select('tile', { x: ix, y: iy });
    }
  };
})(globalThis.GD = globalThis.GD || {});
