// フルボイス: ブラウザに入っている日本語の読み上げ音声で、キャラごとに声の高さと速さを変えて読む
(function (G) {
  const synth = window.speechSynthesis || null;
  let voices = [], male = null, female = null, any = null;
  function pickVoices() {
    if (!synth) return;
    voices = synth.getVoices().filter(v => /^ja/i.test(v.lang));
    // 自然な声(Natural/Online/Google)を優先
    const rank = v => (/(Natural|Online|Neural)/i.test(v.name) ? 3 : /Google/i.test(v.name) ? 2 : 1);
    voices.sort((a, b) => rank(b) - rank(a));
    const isM = v => /(Keita|Ichiro|Daichi|Naoki|Otoya|Hattori|male|男)/i.test(v.name) && !/female/i.test(v.name);
    male = voices.find(isM) || null;
    female = voices.find(v => !isM(v)) || null;
    any = voices[0] || null;
  }
  if (synth) { pickVoices(); synth.onvoiceschanged = pickVoices; }

  const V = {
    on: true, rateMul: 1,
    available() { return !!(synth && (any || synth.getVoices().length)); },
    voiceName() { return any ? any.name : 'なし'; },
    stop() { if (synth) synth.cancel(); },
    // 1つのセリフを読み、終わったら done を呼ぶ
    say(who, text, done) {
      if (!synth || !V.on) { if (done) setTimeout(done, 10); return; }
      synth.cancel();
      const c = G.CHARS[who] || G.CHARS.narr;
      const plain = text.replace(/[「」『』()()]/g, ' ').replace(/……/g, '、').replace(/!/g, '!');
      const u = new SpeechSynthesisUtterance(plain);
      u.lang = 'ja-JP';
      const vc = c.voice || {};
      let voice = vc.sex === 'm' ? (male || any) : (female || any);
      if (voice) u.voice = voice;
      // 男性の声がないときは、女性の声を低くして男性らしくする
      let pitch = vc.pitch || 1;
      if (vc.sex === 'm' && !male) pitch = Math.max(0.1, pitch * 0.55);
      u.pitch = G.clamp(pitch, 0, 2);
      u.rate = G.clamp((vc.rate || 1) * V.rateMul, 0.5, 2);
      u.volume = 1;
      let fired = false;
      const fin = () => { if (fired) return; fired = true; if (done) done(); };
      u.onend = fin; u.onerror = fin;
      // 読み上げが動かない環境でも止まらないように
      setTimeout(fin, 1500 + plain.length * 220);
      synth.speak(u);
    }
  };
  G.Voice = V;
})(globalThis.G2 = globalThis.G2 || {});
