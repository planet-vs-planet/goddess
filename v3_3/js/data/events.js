// 介入カードと、セリフ(ボイスつき)
(function (G) {
  const L = (who, text) => ({ who, text });
  const Fr = id => G.FRONTS.find(f => f.id === id);

  // target: 'front'(戦線をえらぶ) / 'human'(人族の人物) / 'demon'(魔族の人物) / 'char'(だれでも) / 'move'(人物→戦線)
  // 効果は apply(S, target) の中。見せる用の chips も持つ
  // chips: '!' で始まるものは副作用(赤く表示)
  const up = (c, n) => { if (c && c.alive) c.doubt = Math.min(100, c.doubt + n); };
  G.CARDS = [
    // ---- 神の奇跡(人族に希望を) ----
    { id: 'light', cat: 'miracle', name: '光の加護', cost: 12, target: 'front', fx: 'light', chips: ['人族 ▲▲', '信仰 +少し', '!魔王の疑念 +3'], desc: 'えらんだ戦線の人族軍を光で包み、強くする。魔王は「また女神か」と気にする。',
      apply: (S, t) => { t.hb += 30; S.thanks += 3; up(S.chars.zephyra, 3); }, say: t => G.Game.charsAt(t.id, 'h')[0] ? [L(G.Game.charsAt(t.id, 'h')[0], 'この光……女神さまだ! みんな、進め!')] : [] },
    { id: 'rally', cat: 'miracle', name: '英雄の鼓舞', cost: 10, target: 'human', fx: 'light', chips: ['その人物 ▲', '信頼 ▲', '!その人物の疑念 +2'], desc: '人族の人物に力と勇気を与える。その人物の戦線が強くなり、信頼が上がる。',
      apply: (S, c) => { c.power += 8; c.trust = Math.min(100, c.trust + 12); G.Game.front(c.at).hb += 15; up(c, 2); }, say: c => [L(c.id, '女神さまの声が聞こえる……! まだ戦える!')] },
    { id: 'sword', cat: 'miracle', name: '聖なる武器', cost: 22, target: 'human', fx: 'light', chips: ['その人物 ▲▲▲(ずっと)', '!聖女の疑念 +4'], desc: '人族の人物に聖剣を授ける。ずっと強くなる。1人1回まで。聖女は「奇跡が多すぎる」と感じる。',
      need: (S, c) => !c || !c.weapon, apply: (S, c) => { c.power += 18; c.weapon = 1; c.trust = Math.min(100, c.trust + 8); up(S.chars.serena, 4); }, say: c => [L(c.id, 'これが伝説の聖剣……! この剣で魔族を打ち払います!')] },
    { id: 'angels', cat: 'miracle', name: '天使の降臨', cost: 40, target: 'front', fx: 'light', unlock: 12, chips: ['人族 ▲▲▲', '全員の信頼 ▲', '!魔王の疑念 +6'], desc: '天使の軍勢を降ろす。その戦線の人族がとても強くなる。1年目が終わると使える。',
      apply: (S, t) => { t.hb += 50; for (const c of G.Game.humans()) c.trust = Math.min(100, c.trust + 6); S.thanks += 5; up(S.chars.zephyra, 6); }, say: () => [L('gran', '空から天使が……! 女神さまは我らを見捨てていなかった!')] },
    // ---- 邪神の囁き(魔族に力を) ----
    { id: 'horde', cat: 'whisper', name: '魔物の軍勢', cost: 14, target: 'front', fx: 'dark', chips: ['魔族 ▲▲', '南部では1.5倍', '!見た人の疑念 +8'], desc: 'えらんだ戦線に魔物の大軍をわかせる。その戦線にいる人族の人物は、何かおかしいと感じる。',
      apply: (S, t) => { t.db += t.id === 'south' ? 50 : 33; G.Game.witness(t.id, 8); }, say: t => [L('volg', '闇の底から魔物どもがわいてきやがる……行け、食いつくせ!')] },
    { id: 'empower', cat: 'whisper', name: '魔力の供給', cost: 12, target: 'demon', fx: 'dark', chips: ['その人物 ▲▲', '!魔王の疑念 +8'], desc: '魔族の人物の夢にささやき、力を与える。魔王は「声」の正体を気にしはじめる。',
      apply: (S, c) => { c.power += 12; G.Game.front(c.at).db += 20; up(S.chars.zephyra, c.id === 'zephyra' ? 8 : 4); if (c.id !== 'zephyra') up(c, 6); }, say: c => [L(c.id, c.id === 'zephyra' ? 'また、あの声……力があふれてくる! だが、この声はどこかで……' : 'うおお、力がみなぎる! だれだか知らねえが、ありがてえ!')] },
    { id: 'hatred', cat: 'whisper', name: '憎悪の増幅', cost: 8, target: 'front', fx: 'dark', chips: ['激戦で祈り ▲▲', '和平が遠のく', '!両軍の兵が減る'], desc: 'えらんだ戦線の両軍の憎しみをあおる。激しい戦いになり祈りがたくさん集まるが、両軍とも兵を失う。和平の話も遠のく。',
      apply: (S, t) => { t.h -= 12; t.d -= 12; t.hate = 1; if (S.peace) S.peace.left += 1; G.Game.witness(t.id, 3); }, say: () => [L('allen', '魔族め……仲間のかたきだ! 一歩も引くな!')] },
    { id: 'awaken', cat: 'whisper', name: '魔王の覚醒', cost: 40, target: 'front', fx: 'dark', unlock: 12, chips: ['魔族 ▲▲▲', '魔王がその戦線へ', '!魔王の疑念 +15'], desc: '魔王を真の姿に目覚めさせ、その戦線に呼ぶ。魔族がとても強くなるが、魔王は声の正体に近づく。1年目が終わると使える。',
      apply: (S, t) => { const z = S.chars.zephyra; if (z.alive) { z.at = t.id; z.power += 15; up(z, 15); } t.db += 35; G.Game.witness(t.id, 8); }, say: () => [L('zephyra', 'この力は……! 額に光の輪の紋章が……? どうでもいい、人族を押しもどせ!')] },
    // ---- 運命の操作(両方に) ----
    { id: 'storm', cat: 'fate', name: '天災', cost: 18, target: 'front', fx: 'storm', chips: ['両軍 ▼▼', '来月の援軍を止める', '!人族の信頼 -3'], desc: 'えらんだ戦線に雷と嵐を落とす。両軍が弱り、その戦線に向かっている援軍も来なくなる。戦況を止めるのに使う。',
      apply: (S, t) => { t.hb -= 30; t.db -= 30; t.f *= 0.85; S.omens = (S.omens || []).filter(o => !(o.f === t.id && (o.k === 'hReinf' || o.k === 'dReinf' || o.k === 'monsters'))); for (const c of G.Game.humans()) c.trust = Math.max(0, c.trust - 3); G.Game.witness(t.id, 2); }, say: () => [L('nox', '天が裂け、雷が両軍に降りそそぎました。')] },
    { id: 'move', cat: 'fate', name: '運命の導き', cost: 6, target: 'move', fx: 'fate', chips: ['人物を別の戦線へ'], desc: 'だれか1人を、えらんだ戦線へ向かわせる。勇者や魔王を動かして戦況を変えたり、見られたくない場所から遠ざけたりできる。',
      apply: (S, c, f) => { c.at = f; }, say: (c, f) => [L(c.id, c.side === 'h' ? `${Fr(f).name}へ向かえと、女神さまのお告げが……行きます!` : `${Fr(f).name}へ行け、という夢を見た……行くとしよう。`)] },
    { id: 'forget', cat: 'fate', name: '記憶の改ざん', cost: 22, target: 'char', fx: 'fate', chips: ['その人物の疑念 ▼▼', '!信頼 -10', '!同じ人は6か月あける'], desc: 'だれか1人の記憶を書きかえ、疑念を30下げる。同じ人物には6か月に1回まで。神殺しの同盟ができた後は効果が半分。',
      need: (S, c) => !c || !c.forgetAt || S.month - c.forgetAt >= 6, needText: '同じ人物は6か月あける',
      apply: (S, c) => { c.doubt = Math.max(0, c.doubt - (S.revolt ? 15 : 30)); c.trust = Math.max(0, c.trust - 10); c.forgetAt = S.month || 0.001; }, say: c => [L(c.id, '……あれ? 何を考えていたんだろう。'), L('goddess_dark', 'いい子ね。忘れてしまいなさい。')] },
    { id: 'sabotage', cat: 'fate', name: '和平の妨害', cost: 30, target: 'none', fx: 'fate', chips: ['和平を止める', '!王の疑念 +8'], desc: '進んでいる和平交渉をこわす。和平が成立すると戦争が終わってしまう。',
      need: S => !!S.peace, needText: '和平交渉中だけ',
      apply: S => { S.peace = null; S.peaceCool = 8; up(S.chars.gran, 8); }, say: () => [L('gran', '使者が殺されただと!? 魔族め……やはり信用できぬ!'), L('zephyra', '使者を殺したのは人族のほうだろう! 和平などもうない!')] },
    { id: 'smite', cat: 'fate', name: '神罰', cost: 35, target: 'char', fx: 'storm', chips: ['その人物をたおす', '!みんなの疑念 +5'], desc: '天の光でだれか1人を討つ。神殺しの同盟ができたときの最後の手段。',
      need: S => !!S.revolt, needText: '神殺しの同盟ができてから',
      apply: (S, c) => { c.alive = false; S.revolt.v = Math.max(0, S.revolt.v - 40); for (const o of G.Game.alive()) o.doubt = Math.min(100, o.doubt + 5); }, say: c => [L(c.id === 'allen' ? 'zephyra' : 'allen', `${G.CHARS[c.id].short}!! ……女神、お前だけは許さない!`)] }
  ];

  // 来月の予兆(戦線ごと)。先を読んで介入するための情報
  G.OMENS = {
    hReinf: { t: '人族の援軍が向かっている', icon: '🛡', side: 'h' },
    dReinf: { t: '魔族の大軍が接近中', icon: '⚔', side: 'd' },
    monsters: { t: '魔物が大量に発生しそう', icon: '👹', side: 'd' },
    peaceTalk: { t: '王が和平の準備をしている', icon: '🕊', side: 'n' }
  };
  // 人物の独自行動(毎月1人)
  G.ACTS = {
    allen: L('allen', 'いちばん苦しい戦場へ行く。みんなを守るんだ!'),
    serena: L('serena', 'この地の人々のために祈ります。女神さま、どうか……'),
    elmina: L('elmina', '今月も闇の力が動いた。どこで、だれが……調べてみましょう。'),
    zephyra: L('zephyra', '同胞が押されている。私が行く!'),
    volg: L('volg', '魔王さまを待っていられるか! 突撃だ!'),
    gran: L('gran', '民はもう限界だ。和平の使者を送る準備をせよ。')
  };
  // 勇者と魔王が近づいていく(神殺しの同盟への3段階)
  G.ALLY = [
    { id: 'ally1', at: 45, title: 'ふたりの予感', img: 'ev_crest_zephyra', lines: [L('zephyra', '人族の勇者……あいつの剣にも、私と同じ光が宿っていた。'), L('allen', '魔王の目……ぼくと同じだ。何かに、あやつられているような。'), L('nox', '女神さま。勇者と魔王が、おたがいを気にしはじめています。')] },
    { id: 'ally2', at: 65, title: '月夜の密会', img: 'ev_alliance', lines: [L('narr', '月のない夜。勇者と魔王は、だれにも知られず戦場のはずれで会った。'), L('allen', '君も、あの声を聞いているんだろう?'), L('zephyra', '……ああ。答えを確かめるまで、休戦だ。'), L('goddess_dark', 'ふたりきりで内緒話? 悪い子たちね。')] }
  ];

  // 危機のときのセリフ
  G.CRISIS = {
    hWin: f => [L('nox', `${Fr(f).name}で、人族軍が魔族の城に迫っています! このままでは城が落ちます!`)],
    dWin: f => [L('nox', `${Fr(f).name}で、魔族軍が人族の城を包囲しました! このままでは城が落ちます!`)],
    hFall: f => [L('zephyra', `${Fr(f).name}の城が……落ちただと!? 人族め……!`)],
    dFall: f => [L('gran', `${Fr(f).name}の城が落ちた……! 女神さま、どうかお救いを!`)],
    peace: () => [L('gran', '民はもう疲れきっている。魔王に使者を送り、和平の話し合いをはじめよう。'), L('nox', '女神さま! 和平が結ばれれば戦争は終わってしまいます。「和平の妨害」で止めてください!')],
    peaceDone: () => [L('gran', '和平が結ばれた……これで、ようやく戦争が終わる。')]
  };

  // 疑念で進む物語(人物ごと)
  G.BEATS = [
    { id: 'serena', who: 'serena', at: 45, title: '聖女の疑い', img: 'ev_crest_altar', lines: [L('serena', '魔族の祭壇で、女神さまと同じ光の輪の紋章を見ました。女神さま……これは、どういうことですか?'), L('goddess_dark', '……あの子、勘がいいわね。')], run: S => { S.chars.allen.doubt = Math.min(100, S.chars.allen.doubt + 10); } },
    { id: 'elmina', who: 'elmina', at: 55, title: '賢者の発見', img: 'ev_vortex', lines: [L('elmina', '奇跡が起きるたびに、魔族の側でも同じ力が動いている。女神と、魔族に力を与える声は……同じ存在なのではないか。'), L('nox', '女神さま、賢者が真実に近づいています。')], run: S => { for (const c of G.Game.humans()) c.doubt = Math.min(100, c.doubt + 8); } },
    { id: 'zephyra', who: 'zephyra', at: 55, title: '魔王の気づき', img: 'ev_crest_zephyra', lines: [L('zephyra', '夢の声……あれは人族のあがめる女神の声と同じだ。私は、女神にあやつられていたのか?'), L('goddess_dark', 'ふふ。気づいても、もう遅いのよ。')] },
    { id: 'allen', who: 'allen', at: 65, title: '勇者のゆらぎ', img: 'ev_burning_fortress', lines: [L('allen', '女神さまは、本当にぼくたちを救いたいのかな……戦いが終わりそうになるたびに、何かが起きる。'), L('nox', '勇者が迷いはじめています。')] }
  ];
  G.REVOLT_LINES = [L('narr', '勇者と魔王は、戦場のまんなかで剣を下ろした。'), L('allen', 'ゼフィラ。君も、あの声を聞いていたんだね。'), L('zephyra', 'ああ。人族の女神と、私に力を与えた声は同じだった。'), L('allen', 'ぼくたちは、もう戦わない。女神アステリア、お前を討つ!'), L('goddess_dark', '……いいわ、愛しい子どもたち。私のところまで、のぼっておいで。')];
  G.REVOLT_END = [L('narr', '同盟の中心が倒れ、神殺しの同盟はくずれ去った。人族と魔族は、ふたたび剣を向けあった。'), L('goddess_dark', 'おかえりなさい、愛しい世界。')];

  G.OPENING = [
    { img: 'scene_peace', who: 'narr', text: 'かつて、この世界には人族しかいなかった。人族は王国を築き、平和に暮らしていた。' },
    { img: 'scene_war', who: 'narr', text: 'ある日、「魔族」と呼ばれる者たちがあらわれた。魔族は人族の国々を襲い、世界は戦乱に包まれた。' },
    { img: 'ev_pillar', who: 'narr', text: 'そのとき、人族の前に女神があらわれた。' },
    { img: 'goddess_light', who: 'goddess', text: '恐れることはありません。私があなたたちを守りましょう。' },
    { img: 'ev_holy', who: 'narr', text: '女神は奇跡を与え、勇者を生んだ。人族は女神を、救いの神とあがめた。' },
    { img: 'ev_cursed_castle', who: 'narr', text: '一方、魔族を率いる魔王もまた、なぞの声から力を授かっていた。戦争は、何十年たっても終わらなかった。' },
    { img: 'dark', who: 'narr', text: '人族を救った女神。魔王に力を与えた、なぞの声。その正体は――' },
    { img: 'goddess_dark', who: 'goddess_dark', text: 'どちらも、私よ。', flash: true, bgm: 'dark', video: true },
    { img: 'goddess_dark', who: 'goddess_dark', text: '戦いがつづけば、人はおそれ、祈る。その祈りが、私の力になるの。' },
    { img: 'goddess_dark', who: 'goddess_dark', text: '人族には希望を。魔族には憎しみを。勝者はいらない。敗者もいらない。' },
    { img: 'goddess_dark', who: 'goddess_dark', text: 'この戦争がつづく限り、私は永遠に存在できるのだから。' },
    { img: 'dark', who: 'narr', text: 'あなたは、この女神です。人族と魔族を裏からあやつり、戦争を5年つづけ、祈りを集めてください。', big: true }
  ];

  G.TUT_LINES = {
    t0: L('nox', 'お目覚めですか、女神さま。影の側近、ノクスでございます。人族と魔族は、3つの戦線で戦っています。'),
    t1: L('nox', '上の3つの札で、北部・中央・南部の戦線を切りかえて見られます。白い点線が前線。まんなかの金色の帯にあるのが、ちょうどいい状態です。札には、来月その戦線で起きることの予兆も出ます。'),
    t2: L('nox', '左には、6人の重要人物がいます。勇者アレンや魔王ゼフィラ。それぞれ女神さまへの「信頼」と「疑念」を持っています。'),
    t3: L('nox', '女神さまは、下のカードでいつでも介入できます。信仰を使い、使ったカードはしばらく休みます。まずは中央王都で人族を助けましょう。「光の加護」を押してください。'),
    t4: L('nox', 'つぎに、戦線をえらびます。「中央王都」をえらんでください。'),
    t5: L('nox', '人族が強くなりました。では次に、魔族にも力を。「魔物の軍勢」を、勇者のいない「南部森林」に使いましょう。'),
    t5b: L('nox', 'つぎに、勇者のいない「南部森林」の札をクリックしてください。'),
    t6: L('nox', 'お見事です。邪神の力を使うと、その戦線にいる人族の人物の疑念が上がります。悪いことは、だれも見ていない場所でするのがコツです。'),
    t7: L('nox', '準備ができたら「時間を動かす」を押してください。時は流れつづけ、3つの戦線では休みなく戦いがつづきます。'),
    t8: L('nox', '戦いがつづけば人族は祈り、信仰が集まります。カードをえらんでいる間は、時間が止まります。城が2つ落ちた側は滅び、和平が結ばれても終わり。物語のできごとが起きたら、ミッションで運命を動かしてください。5年で祈りを1050集めれば、女神さまの勝ちです。')
  };
})(globalThis.G2 = globalThis.G2 || {});
