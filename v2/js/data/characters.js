// 登場人物(顔の絵・声の高さ・話す速さ)
(function (G) {
  G.CHARS = {
    goddess: { name: '女神アステリア', face: 'assets/img/face_light.jpg', voice: { sex: 'f', pitch: 1.15, rate: 0.95 }, color: '#f2d27a' },
    goddess_dark: { name: '女神アステリア(裏の顔)', face: 'assets/img/face_dark.jpg', voice: { sex: 'f', pitch: 0.75, rate: 0.88 }, color: '#ff6a9a' },
    nox: { name: '影の側近ノクス', face: 'assets/face/demon_a.jpg', voice: { sex: 'f', pitch: 0.9, rate: 1.02 }, color: '#c9a0e0' },
    allen: { name: '勇者アレン', face: 'assets/face/hero.jpg', voice: { sex: 'm', pitch: 1.05, rate: 1.05 }, color: '#7fb4ff', side: 'h' },
    serena: { name: '聖女セレナ', face: 'assets/face/queen_b.jpg', voice: { sex: 'f', pitch: 1.3, rate: 0.98 }, color: '#bfe0ff', side: 'h' },
    gran: { name: '人族の王グラン', face: 'assets/face/king.jpg', voice: { sex: 'm', pitch: 0.75, rate: 0.92 }, color: '#e8c96a', side: 'h' },
    zephyra: { name: '魔王ゼフィラ', face: 'assets/face/demon_d.jpg', voice: { sex: 'f', pitch: 0.85, rate: 0.95 }, color: '#ff7a8a', side: 'd' },
    volg: { name: '魔将ヴォルグ', face: 'assets/face/demon_b.jpg', voice: { sex: 'm', pitch: 0.6, rate: 0.95 }, color: '#d98a5a', side: 'd' },
    ignis: { name: '竜王イグニス', face: 'assets/face/dragon_c.jpg', voice: { sex: 'm', pitch: 0.5, rate: 0.85 }, color: '#ff5a3a', side: 'd' },
    elder: { name: 'エルフの長老', face: 'assets/face/elf_a.jpg', voice: { sex: 'f', pitch: 1.1, rate: 0.9 }, color: '#9fe0a0', side: 'h' },
    narr: { name: '', face: null, voice: { sex: 'f', pitch: 1.0, rate: 1.0 }, color: '#efe6d0' }
  };
})(globalThis.G2 = globalThis.G2 || {});
