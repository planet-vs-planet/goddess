// ボイス: VOICEVOXで作った声のファイルを鳴らす(ないセリフはしゃべらない)
(function (G) {
  let cur = null;
  const V = {
    on: true, volume: 1,
    stop() { if (cur) { cur.pause(); cur.onended = null; cur = null; } },
    has(who, text) { return !!(G.VOICES && G.VOICES[who + '|' + text]); },
    // セリフを読み、終わったら done
    say(who, text, done) {
      V.stop();
      const src = G.VOICES && G.VOICES[who + '|' + text];
      const src2 = src && G.IMG && G.IMG[src] ? G.IMG[src] : src;
      if (!V.on || !src2) { if (done) setTimeout(done, 10); return; }
      const a = new Audio(src2);
      a.volume = V.volume;
      cur = a;
      let fired = false;
      const fin = () => { if (fired) return; fired = true; if (cur === a) cur = null; if (done) done(); };
      a.onended = fin; a.onerror = fin;
      a.play().catch(fin);
    }
  };
  G.Voice = V;
})(globalThis.G2 = globalThis.G2 || {});
