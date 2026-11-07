// BGMと効果音(ブラウザの中で音を合成する。外部の音声ファイルはいらない)
(function (G) {
  let ctx = null, master = null, musicBus = null, sfxBus = null, timer = null, cur = null, step = 0, nextTime = 0;
  const vol = { music: 0.5, sfx: 0.7 };
  const N = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI番号 → 周波数

  // 曲: bpm, 和音の進行(根音), 音階, パート
  const SONGS = {
    title: { bpm: 70, prog: [57, 53, 48, 55], minor: true, pad: 0.16, arp: 0.06, bass: 0.1, drum: 0, lead: 0.05, leadPat: [0, null, 2, null, 4, null, 3, null] },
    field: { bpm: 104, prog: [50, 46, 48, 45], minor: true, pad: 0.1, arp: 0.05, bass: 0.13, drum: 0.5, lead: 0.06, leadPat: [7, null, 5, 3, 2, null, 0, null] },
    battle: { bpm: 138, prog: [50, 50, 46, 48], minor: true, pad: 0.08, arp: 0.07, bass: 0.16, drum: 0.85, lead: 0.07, leadPat: [0, 2, 3, 5, 7, 5, 3, 2] },
    dark: { bpm: 60, prog: [45, 46, 45, 44], minor: true, pad: 0.2, arp: 0.03, bass: 0.12, drum: 0.15, lead: 0.04, leadPat: [0, null, null, 1, null, null, 0, null] },
    ending: { bpm: 76, prog: [48, 55, 57, 53], minor: false, pad: 0.17, arp: 0.06, bass: 0.1, drum: 0, lead: 0.06, leadPat: [4, null, 2, null, 0, null, 2, null] }
  };

  function init() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
      // 残響(簡単なディレイ)
      const delay = ctx.createDelay(); delay.delayTime.value = 0.28;
      const fb = ctx.createGain(); fb.gain.value = 0.3;
      const wet = ctx.createGain(); wet.gain.value = 0.25;
      delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = vol.music; musicBus.connect(master); musicBus.connect(delay);
      sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
      return true;
    } catch (e) { return false; }
  }
  function tone(t, freq, dur, type, gain, bus, attack, release) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + (attack || 0.01));
    g.gain.setTargetAtTime(0, t + dur, release || 0.08);
    o.connect(g); g.connect(bus || musicBus);
    o.start(t); o.stop(t + dur + (release || 0.08) * 6);
  }
  function noise(t, dur, gain, hp, bus) {
    const len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = 'highpass'; f.frequency.value = hp || 1000; g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(bus || musicBus); s.start(t);
  }
  function kick(t, gain) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.3);
  }
  function chord(root, minor) { return [root, root + (minor ? 3 : 4), root + 7]; }
  const SCALE_M = [0, 2, 3, 5, 7, 8, 10, 12], SCALE_J = [0, 2, 4, 5, 7, 9, 11, 12];

  // 16分音符ごとに音を置く
  function schedule() {
    const s = SONGS[cur]; if (!s) return;
    const spb = 60 / s.bpm / 4;
    while (nextTime < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 16) % s.prog.length, pos = step % 16, root = s.prog[bar];
      const ch = chord(root, s.minor), t = nextTime;
      if (pos === 0 && s.pad) for (const n of ch) { tone(t, N(n), spb * 15, 'sawtooth', s.pad * 0.25, null, 0.4, 0.5); tone(t, N(n + 12), spb * 15, 'triangle', s.pad * 0.4, null, 0.5, 0.6); }
      if (s.bass && pos % 4 === 0) tone(t, N(root - 12), spb * 3, 'triangle', s.bass, null, 0.01, 0.1);
      if (s.arp && pos % 2 === 0) tone(t, N(ch[(pos / 2) % 3] + 12), spb * 1.5, 'square', s.arp * 0.5, null, 0.005, 0.05);
      if (s.lead && pos % 2 === 0) {
        const p = s.leadPat[(pos / 2) % s.leadPat.length];
        if (p != null && (bar % 2 === 1 || cur !== 'title')) { const sc = s.minor ? SCALE_M : SCALE_J; tone(t, N(root + 12 + sc[p % 8]), spb * 3, 'sine', s.lead, null, 0.02, 0.2); }
      }
      if (s.drum) {
        if (pos % 8 === 0) kick(t, 0.5 * s.drum);
        if (pos % 8 === 4) noise(t, 0.12, 0.18 * s.drum, 1500);
        if (cur === 'battle' && pos % 2 === 1) noise(t, 0.03, 0.05 * s.drum, 6000);
        if (cur === 'field' && pos === 14) kick(t, 0.3 * s.drum);
      }
      nextTime += spb; step++;
    }
  }

  const BGM = {
    get on() { return BGM._on; }, _on: true,
    start() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    play(name) {
      if (!init()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (cur === name) return;
      cur = name;
      // 曲の切りかえ: いったん音を小さくしてから
      musicBus.gain.cancelScheduledValues(ctx.currentTime);
      musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      setTimeout(() => { if (!ctx) return; step = 0; nextTime = ctx.currentTime + 0.05; musicBus.gain.setTargetAtTime(BGM._on ? vol.music : 0, ctx.currentTime, 0.3); }, 450);
      if (!timer) timer = setInterval(() => { if (ctx && cur) schedule(); }, 60);
    },
    setMusic(on) { BGM._on = on; if (musicBus) musicBus.gain.setTargetAtTime(on ? vol.music : 0, ctx.currentTime, 0.2); },
    // 効果音
    sfx(kind) {
      if (!init() || !BGM.sfxOn) return;
      const t = ctx.currentTime;
      if (kind === 'light') { [72, 76, 79, 84, 88].forEach((n, i) => tone(t + i * 0.07, N(n), 0.5, 'sine', 0.12, sfxBus, 0.01, 0.4)); }
      if (kind === 'dark') { tone(t, N(38), 1.4, 'sawtooth', 0.12, sfxBus, 0.3, 0.6); tone(t, N(39), 1.4, 'sawtooth', 0.1, sfxBus, 0.3, 0.6); noise(t, 1.2, 0.05, 300, sfxBus); }
      if (kind === 'storm') { noise(t, 0.9, 0.35, 200, sfxBus); tone(t, N(31), 0.8, 'square', 0.1, sfxBus, 0.01, 0.4); }
      if (kind === 'fate') { [60, 67, 74, 79].forEach((n, i) => tone(t + i * 0.11, N(n), 0.7, 'triangle', 0.1, sfxBus, 0.01, 0.5)); }
      if (kind === 'clash') { noise(t, 0.12, 0.22, 2500, sfxBus); tone(t, N(84 + Math.random() * 6), 0.05, 'square', 0.04, sfxBus); }
      if (kind === 'coin') { tone(t, N(88), 0.08, 'square', 0.05, sfxBus); tone(t + 0.07, N(93), 0.12, 'square', 0.05, sfxBus); }
      if (kind === 'click') tone(t, N(81), 0.04, 'square', 0.04, sfxBus);
      if (kind === 'boom') { kick(t, 0.9); noise(t, 0.6, 0.3, 120, sfxBus); }
    },
    sfxOn: true
  };
  G.BGM = BGM;
})(globalThis.G2 = globalThis.G2 || {});
