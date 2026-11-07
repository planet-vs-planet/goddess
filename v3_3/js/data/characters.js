// 登場人物。vv = VOICEVOXの声(話者ID)。side: h人族 / d魔族
(function (G) {
  G.CHARS = {
    goddess: { name: '女神アステリア', face: 'assets/img/face_light.jpg', color: '#f2d27a', vv: 2 },
    goddess_dark: { name: '女神アステリア(裏の顔)', face: 'assets/img/face_dark.jpg', color: '#ff6a9a', vv: 4 },
    nox: { name: '影の側近ノクス', face: 'assets/face/demon_a.jpg', color: '#c9a0e0', vv: 17 },
    narr: { name: '', face: null, color: '#efe6d0', vv: 31 },
    allen: { name: '勇者アレン', short: 'アレン', face: 'assets/face/f_allen.jpg', color: '#7fb4ff', side: 'h', vv: 11, power: 22, role: '女神を信じる若き勇者。いちばん強い' },
    serena: { name: '聖女セレナ', short: 'セレナ', face: 'assets/face/f_serena.jpg', color: '#bfe0ff', side: 'h', vv: 14, power: 8, role: '奇跡の正体を調べている。いると祈りが増える' },
    gran: { name: '人族の王グラン', short: 'グラン王', face: 'assets/face/f_gran.jpg', color: '#e8c96a', side: 'h', vv: 53, power: 10, role: '戦争に疲れ、和平を望んでいる' },
    elmina: { name: '賢者エルミナ', short: 'エルミナ', face: 'assets/face/f_elmina.jpg', color: '#9fe0a0', side: 'h', vv: 109, power: 8, role: 'エルフの賢者。女神の矛盾に気づきやすい' },
    zephyra: { name: '魔王ゼフィラ', short: 'ゼフィラ', face: 'assets/face/f_zephyra.jpg', color: '#ff7a8a', side: 'd', vv: 65, power: 26, role: '夢の声から力を授かる魔王' },
    volg: { name: '魔将ヴォルグ', short: 'ヴォルグ', face: 'assets/face/f_volg.jpg', color: '#d98a5a', side: 'd', vv: 81, power: 16, role: '魔王に忠誠をちかう荒くれ将軍' }
  };
  G.KEY_CHARS = ['allen', 'serena', 'gran', 'elmina', 'zephyra', 'volg'];
  G.FRONTS = [
    { id: 'north', name: '北部平原', short: '北部', sky: ['#2a3a5a', '#5a2a40'], ground: ['#4a5a50', '#5a3a3a'], snow: true, bg: 'assets/img/bg_north.jpg', trait: '魔族の侵攻路', traitDesc: '魔族に毎月少しずつ援軍が来る' },
    { id: 'center', name: '中央王都', short: '中央', sky: ['#22406e', '#6a2030'], ground: ['#3a5428', '#4a2622'], bg: 'assets/img/bg_center.jpg', trait: '人族の王都', traitDesc: '祈りが1.5倍集まる' },
    { id: 'south', name: '南部森林', short: '南部', sky: ['#1e3a3a', '#4a2030'], ground: ['#2a4a24', '#3a2a20'], forest: true, bg: 'assets/img/bg_south.jpg', trait: '呪われた森', traitDesc: '魔物の軍勢が1.5倍強い' }
  ];
})(globalThis.G2 = globalThis.G2 || {});
