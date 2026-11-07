// GODDESS — 全体の決まり(ここを変えるとゲーム全体に効く)
(function (G) {
  G.CFG = {
    VERSION: 2,
    SAVE_KEY: 'goddess-save-v2',
    MAP_W: 168,          // マップの横マス数
    MAP_H: 108,          // マップの縦マス数
    TILE: 8,             // 1マスの大きさ(ドット)
    NATIONS: 8,
    CITIES: 20,
    START_CHARS_PER_NATION: 7,
    MAX_ALIVE_CHARS: 130,
    DAYS_PER_MONTH: 30,
    SPEEDS: [0, 1, 2, 5, 10], // 1倍速 = 1秒で1か月
    LOG_MAX: 400,
    HISTORY_MAX: 1500,
    GODDESS_MAX_POWER: 100
  };
  G.SEASONS = ['冬', '冬', '春', '春', '春', '夏', '夏', '夏', '秋', '秋', '秋', '冬']; // 0=1月
})(globalThis.GD = globalThis.GD || {});
