// 登場人物・女神の介入・オープニング(物語の本文は js/saga.js)
(function (G) {
  G.CHARS = {
    goddess: { name: '女神アステリア', face: 'assets/img/face_light.jpg', color: '#f2d27a', vv: 2 },
    goddess_dark: { name: '女神アステリア(裏の顔)', face: 'assets/img/face_dark.jpg', color: '#ff6a9a', vv: 4 },
    nox: { name: '影の側近ノクス', face: 'assets/face/demon_a.jpg', stand: 'assets/img/st_nox.webp', color: '#c9a0e0', vv: 17 },
    narr: { name: '', face: null, color: '#efe6d0', vv: 31 },
    allen: { name: '勇者アレン', short: 'アレン', face: 'assets/face/f_allen.jpg', stand: 'assets/img/st_allen.webp', color: '#7fb4ff', side: 'h', vv: 11 },
    serena: { name: '聖女セレナ', short: 'セレナ', face: 'assets/face/f_serena.jpg', stand: 'assets/img/st_serena.webp', color: '#bfe0ff', side: 'h', vv: 14 },
    gran: { name: '人族の王グラン', short: 'グラン王', face: 'assets/face/f_gran.jpg', stand: 'assets/img/st_gran.webp', color: '#e8c96a', side: 'h', vv: 53 },
    elmina: { name: '賢者エルミナ', short: 'エルミナ', face: 'assets/face/f_elmina.jpg', stand: 'assets/img/st_elmina.webp', color: '#9fe0a0', side: 'h', vv: 109 },
    zephyra: { name: '魔王ゼフィラ', short: 'ゼフィラ', face: 'assets/face/f_zephyra.jpg', stand: 'assets/img/st_zephyra.webp', color: '#ff7a8a', side: 'd', vv: 65 },
    volg: { name: '魔将ヴォルグ', short: 'ヴォルグ', face: 'assets/face/f_volg.jpg', stand: 'assets/img/st_volg.webp', color: '#d98a5a', side: 'd', vv: 81 }
  };
  // 女神の介入(7つ)。light=表の顔(光) / dark=裏の顔(闇)
  G.ACTS = {
    bless: { name: '祝福', icon: '✦', face: 'light', desc: '才能や幸運を授ける' },
    curse: { name: '呪い', icon: '☠', face: 'dark', desc: '不幸や弱さを背負わせる' },
    dream: { name: '夢', icon: '☾', face: 'light', desc: '眠りの中で何かを見せる' },
    trial: { name: '試練', icon: '⚔', face: 'dark', desc: '乗りこえるべき苦難を与える' },
    meet: { name: '出会い', icon: '❦', face: 'light', desc: 'だれかと引き合わせる' },
    miracle: { name: '奇跡', icon: '☀', face: 'light', desc: '目に見える奇跡を起こす' },
    whisper: { name: '囁き', icon: '❖', face: 'dark', desc: '心の奥にそっとささやく' }
  };
  // 場所 → 背景の絵。war = 戦争の様子(軍勢)を見せる
  G.PLACES = {
    north: { name: '北部平原', bg: 'assets/img/bg_north.jpg', war: true },
    center: { name: '中央王都', bg: 'assets/img/bg_center.jpg', war: true },
    south: { name: '南部森林', bg: 'assets/img/bg_south.jpg', war: true },
    demon_castle: { name: '魔王城', bg: 'assets/img/ev_cursed_castle.jpg' },
    temple: { name: '古の神殿', bg: 'assets/img/ev_altar.jpg' }
  };
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
    { img: 'dark', who: 'narr', text: 'あなたは、この女神です。人々の運命に手をのばし、物語を思いのままに動かしてください。', big: true }
  ];
})(globalThis.G2 = globalThis.G2 || {});
