// GODDESS Ver.5 — ゲーム全体の決まりと基本データ
// 種族は「人族」と「魔族」の2つだけ。どちらも同じ女神を信仰している(形はちがう)。
(function (G) {
  G.CFG = {
    VERSION: 5,
    SAVE_KEY: 'goddess6-save',
    MAP_W: 168, MAP_H: 108,
    TILE: 12,            // 画面に描くときの1マスの大きさ
    START_YEAR: 812,     // 女神暦
    DAYS_PER_MONTH: 30,
    HUMAN_NATIONS: 3, DEMON_NATIONS: 3,
    CITIES_PER_NATION: 5,
    MAX_ALIVE_CHARS: 140,
    SPOTLIGHT: 3,        // 「いま注目の出来事」は3件まで
    LOG_MAX: 300
  };
  G.SEASONS = ['冬', '冬', '春', '春', '春', '夏', '夏', '夏', '秋', '秋', '秋', '冬'];

  // ---- 地形(Ver.1と同じ並び。タイル画像の列と対応) ----
  G.T = { DEEP: 0, SEA: 1, SHALLOW: 2, LAKE: 3, RIVER: 4, GRASS: 5, FOREST: 6, DEEPFOREST: 7, MOUNTAIN: 8, SNOW: 9, DESERT: 10, SWAMP: 11, COAST: 12 };
  G.TERRAIN = [
    { key: 'deep', name: '深い海', water: true, move: Infinity, food: 0, def: 0 },
    { key: 'sea', name: '海', water: true, move: Infinity, food: 0, def: 0 },
    { key: 'shallow', name: '浅瀬', water: true, move: Infinity, food: 0, def: 0 },
    { key: 'lake', name: '湖', water: true, move: Infinity, food: 0, def: 0 },
    { key: 'river', name: '川', water: false, move: 2.2, food: 1.6, def: 0.15 },
    { key: 'grass', name: '草原', water: false, move: 1.0, food: 1.0, def: 0 },
    { key: 'forest', name: '森', water: false, move: 1.6, food: 0.45, def: 0.15 },
    { key: 'deepforest', name: '深い森', water: false, move: 2.3, food: 0.3, def: 0.3 },
    { key: 'mountain', name: '山', water: false, move: 3.2, food: 0.1, def: 0.5 },
    { key: 'snow', name: '雪原', water: false, move: 2.6, food: 0.08, def: 0.2 },
    { key: 'desert', name: '砂漠', water: false, move: 1.8, food: 0.08, def: 0 },
    { key: 'swamp', name: '沼地', water: false, move: 2.6, food: 0.35, def: 0.25 },
    { key: 'coast', name: '海岸', water: false, move: 1.1, food: 0.8, def: 0 }
  ];

  // ---- 種族(2つだけ) ----
  G.RACES = {
    human: { name: '人族', life: [52, 80], adult: 16, power: 1.0, grow: 1.0, like: { grass: 1.3, river: 1.4, coast: 1.2 } },
    demon: { name: '魔族', life: [90, 160], adult: 20, power: 1.18, grow: 0.7, like: { swamp: 1.5, deepforest: 1.2, mountain: 1.1, desert: 1.0 } }
  };
  // 同じ女神への信仰。種族・国ごとに形(教義)がちがう
  G.FAITH = {
    human: { name: '光の女神教', god: '光の女神アステリア', prayer: '祈り', sects: ['聖典派', '救済派', '騎士修道会', '巡礼派'] },
    demon: { name: '夜の母神信仰', god: '夜の母アステリア', prayer: '血の誓い', sects: ['月影派', '力の教団', '母なる夜の会', '古き契約派'] }
  };

  // ---- 性格 ----
  G.TRAITS = {
    brave: { name: '勇敢', opp: 'coward', war: 8 },
    coward: { name: '臆病', opp: 'brave', war: -12 },
    ambitious: { name: '野心家', war: 8 },
    gentle: { name: '温厚', opp: 'cruel', war: -14 },
    cruel: { name: '残酷', opp: 'gentle', war: 10 },
    just: { name: '正義感が強い', opp: 'cunning', war: 0 },
    cunning: { name: '策略家', opp: 'just', war: 2 },
    proud: { name: '誇り高い', war: 5 },
    devout: { name: '信心深い', war: 0 },
    family: { name: '家族思い', war: -6 },
    vengeful: { name: '執念深い', war: 6 },
    peaceful: { name: '平和主義', opp: 'cruel', war: -22 }
  };
  G.TRAIT_KEYS = Object.keys(G.TRAITS);

  // ---- 役職 ----
  G.ROLES = { ruler: '君主', heir: '王族', general: '将軍', hero: '英雄', priest: '大神官', noble: '貴族', rebel: '反乱の指導者', exile: '亡命者', knight: '騎士' };
  G.RULER_TITLE = { human: { m: '王', f: '女王' }, demon: { m: '魔王', f: '魔王' } };

  // ---- 関係の種類 ----
  G.REL = {
    friend: { name: '友情', good: true }, love: { name: '愛情', good: true }, debt: { name: '恩義', good: true },
    loyal: { name: '忠誠', good: true }, fear: { name: '恐怖', good: false }, hate: { name: '憎悪', good: false },
    enemy: { name: '敵対', good: false }, rival: { name: 'ライバル', good: false },
    parent: { name: '親', good: true }, child: { name: '子', good: true }, sibling: { name: 'きょうだい', good: true }, spouse: { name: '配偶者', good: true }
  };

  // ---- 名前 ----
  const SYL = {
    human: {
      m: [['アル', 'ベル', 'カイ', 'ディ', 'エド', 'ガル', 'ハル', 'レオ', 'マル', 'ロイ', 'セド', 'ユリ', 'グレ', 'オズ', 'フィ', 'ヴィ', 'クラ', 'ジル', 'ラウ', 'テオ'], ['ベルト', 'ン', 'ス', 'ウス', 'リック', 'ド', 'ガー', 'ネス', 'モンド', 'フリード', 'ヴァン', 'ラス', 'オン', 'ル']],
      f: [['エリ', 'セラ', 'リア', 'マリ', 'アン', 'ソフィ', 'クレア', 'ルー', 'イザ', 'ノエ', 'ヘレ', 'ミラ', 'ロザ', 'カタ', 'ユノ'], ['ナ', 'ス', 'ベル', 'リナ', 'ア', 'ル', 'ーシャ', 'エル', 'ンヌ', 'ーネ']],
      family: ['ヴァレリウス', 'アーデン', 'グランツ', 'ローウェル', 'エルスト', 'ハイデン', 'ブランシュ', 'カーライル', 'モルガン', 'リヒター', 'セルヴァン', 'オルディス', 'レーヴェ', 'フォルクナー']
    },
    demon: {
      m: [['ザ', 'ヴォル', 'ガズ', 'ベリ', 'モル', 'ゼ', 'ドラ', 'アズ', 'バル', 'グ', 'ネル', 'カル', 'ヴァ', 'ゴル'], ['ガロス', 'ディス', 'ラム', 'ゴス', 'ザーク', 'ヴァス', 'モス', 'ゼル', 'ドール', 'ガン', 'ルド']],
      f: [['リリ', 'ネメ', 'ザラ', 'ヴェ', 'モル', 'セレ', 'アス', 'ルシ', 'イル', 'ゼフィ', 'ノク'], ['ス', 'シア', 'ネア', 'ラ', 'ティア', 'ゼ', 'ヴィア', 'ラ']],
      family: ['ヴォルガ', 'ザルグ', 'ネクロス', 'ベリアル', 'ガズラ', 'モルディア', 'ディアボロ', 'アスタロ', 'ルキフェ', 'ヴァルハ']
    }
  };
  const PLACE = {
    human: { a: ['アル', 'グラン', 'ベル', 'ロー', 'セント', 'エス', 'リン', 'カスト', 'ヴァル', 'ノル', 'ハイ', 'ウィン', 'マル', 'ブラン', 'エル', 'シオン'], b: ['ディア', 'ハイム', 'ブルク', 'ガルド', 'ミア', 'ウェル', 'リア', 'フォード', 'ポート', 'ヴィル', 'ローズ', 'ティス', 'ベルク'] },
    demon: { a: ['ザル', 'ヴォル', 'ネクロ', 'ガズ', 'モル', 'ディス', 'バル', 'アビ', 'グル', 'ドレ', 'ヘル'], b: ['ガス', 'ドゥーム', 'ヘイム', 'ゴス', 'マール', 'ザード', 'ロス', 'ネア', 'ガルド', 'モア'] }
  };
  const FORMS = { human: ['王国', '王国', '帝国', '公国', '神聖王国'], demon: ['魔王国', '魔導帝国', '魔族連邦', '夜王国'] };
  G.Names = {
    person(rng, race, sex) { const s = SYL[race][sex === 'f' ? 'f' : 'm']; return rng.pick(s[0]) + rng.pick(s[1]); },
    family(rng, race) { return rng.pick(SYL[race].family); },
    place(rng, race) { return rng.pick(PLACE[race].a) + rng.pick(PLACE[race].b); },
    nation(rng, race, core) { return { name: core + rng.pick(FORMS[race]), short: core }; }
  };

  // 国の色(人族=暖色・青系、魔族=紫・赤黒系)
  G.NATION_COLORS = {
    human: ['#3f7fd8', '#d8a43a', '#3fae6a', '#e07a3f', '#5ab4c8', '#c9c070'],
    demon: ['#9b4fd0', '#c23b4f', '#5a3fa8', '#a8336e', '#6e2a8a', '#8a4040']
  };

  // ---- 顔の絵(性別・年齢・種族) ----
  G.FACES = {
    human: {
      m: { young: ['hero', 'human_a', 'human_b', 'f_allen', 'bard', 'scholar'], adult: ['king', 'general', 'soldier', 'emperor', 'craftsman', 'farmer', 'assassin', 'merchant'], old: ['f_gran', 'sage_king', 'pontiff'] },
      f: { young: ['f_hina', 'f_serena', 'queen'], adult: ['queen_b', 'priest', 'queen'], old: ['priest', 'queen_b'] }
    },
    demon: {
      m: { young: ['f_kai', 'demon_a'], adult: ['demon_a', 'demon_b', 'f_volg', 'mage'], old: ['mage', 'f_volg'] },
      f: { young: ['demon_d', 'demon_f', 'demon_c'], adult: ['f_zephyra', 'demon_e', 'demon_c'], old: ['f_zephyra', 'demon_e'] }
    }
  };

  // ---- 女神の介入 ----
  // kind: direct(直接) / indirect(間接)。on: 対象の種類。cost: 神力。need: 追加で選ぶもの
  //   need.person: 別の人物 / need.nation: 別の国 / need.option: その場の選択肢
  G.POWERS = {
    // 人物へ
    oracle: { name: '神託を与える', kind: 'indirect', on: ['person'], cost: 14, icon: '✦', art: 'oracle',
      desc: '女神の声として言葉を届ける。信心深い者ほど従う。',
      need: { option: [['war', '戦えと告げる'], ['peace', '和平を結べと告げる'], ['distrust', '疑えと告げる'], ['temple', '神殿を建てよと告げる']] },
      needTarget: { war: 'nation', peace: 'nation', distrust: 'person' } },
    dream: { name: '夢を見せる', kind: 'indirect', on: ['person'], cost: 10, icon: '☾', art: 'oracle',
      desc: '眠りの中に光景を見せる。信仰が薄くても心は揺れる。',
      need: { option: [['victory', '勝利の夢'], ['ruin', '破滅の夢'], ['glory', '王冠の夢'], ['peace', '平和な夢']] },
      needTarget: { victory: 'nation', ruin: 'nation' } },
    ambition: { name: '野心を強める', kind: 'indirect', on: ['person'], cost: 10, icon: '♛', desc: 'もっと上を望む心を育てる。' },
    fear: { name: '恐怖を与える', kind: 'indirect', on: ['person', 'army'], cost: 9, icon: '☠', desc: '不安と恐れを植えつける。' },
    hope: { name: '自信を与える', kind: 'indirect', on: ['person'], cost: 8, icon: '☀', desc: '迷いを消し、決断を後押しする。' },
    meet: { name: '出会わせる', kind: 'indirect', on: ['person'], cost: 12, icon: '⚭', need: { person: true },
      desc: '運命を重ね、2人を出会わせる。友情になるか、敵になるかは2人しだい。' },
    distrust: { name: '不信を植える', kind: 'indirect', on: ['person'], cost: 11, icon: '⚔', need: { person: true }, desc: '2人の間に疑いの種をまく。' },
    rumor: { name: '噂を流す', kind: 'indirect', on: ['person'], cost: 8, icon: '☍',
      need: { option: [['shame', '悪い噂'], ['fame', '名声の噂'], ['plot', '謀反の噂']] }, desc: '人々の口に噂をのせる。' },
    hero: { name: '英雄の力を与える', kind: 'direct', on: ['person'], cost: 30, icon: '✶', art: 'hero', desc: '眠っている力を目覚めさせ、英雄にする。' },
    life: { name: '寿命を延ばす', kind: 'direct', on: ['person'], cost: 22, icon: '✚', desc: '病を癒し、命を長らえさせる。' },
    sickness: { name: '病に伏せさせる', kind: 'direct', on: ['person'], cost: 18, icon: '✖', desc: '重い病を与える。死ぬこともある。' },
    protect: { name: '加護を与える', kind: 'direct', on: ['person', 'army'], cost: 14, icon: '◈', art: 'bless', desc: '次の危機から守る。軍なら戦いで強くなる。' },
    // 国へ
    harvest: { name: '豊穣を与える', kind: 'direct', on: ['nation', 'city', 'place'], cost: 16, icon: '❀', art: 'harvest', desc: '実りを増やす。民は女神に感謝する。' },
    plague: { name: '疫病を起こす', kind: 'direct', on: ['nation', 'city', 'place'], cost: 18, icon: '☣', art: 'disaster', desc: '病が広がる。民は救いを求めて祈る。' },
    arms: { name: '軍事力を強める', kind: 'direct', on: ['nation'], cost: 18, icon: '⚒', desc: '鍛冶の火を強め、兵を集めやすくする。' },
    sour: { name: '関係を悪化させる', kind: 'indirect', on: ['nation'], cost: 14, icon: '⚡', need: { nation: true }, desc: '国境で事件を起こし、2国の仲を裂く。' },
    mend: { name: '関係を改善させる', kind: 'indirect', on: ['nation'], cost: 14, icon: '☮', need: { nation: true }, desc: '使者や交易の縁を結ばせる。' },
    unrest: { name: '反乱のきっかけを作る', kind: 'indirect', on: ['nation', 'city'], cost: 16, icon: '✊', desc: '不満に火をつける。' },
    tech: { name: '技術の発展を促す', kind: 'direct', on: ['nation'], cost: 15, icon: '⚙', desc: '学者にひらめきを与え、国を進歩させる。' },
    faith: { name: '信仰を広める', kind: 'indirect', on: ['nation', 'city'], cost: 12, icon: '✟', desc: '奇跡の噂を広め、神殿を建てさせる。' },
    // 町・場所へ
    heal: { name: '治癒の光', kind: 'direct', on: ['city'], cost: 12, icon: '✚', desc: '病や傷をいやす。救われた民は深く感謝する。' },
    quake: { name: '地震を起こす', kind: 'direct', on: ['city', 'place'], cost: 20, icon: '≋', art: 'disaster', desc: '城壁がくずれ、町が傷つく。' },
    ward: { name: '守りの結界', kind: 'direct', on: ['city'], cost: 14, icon: '⛨', art: 'bless', desc: '城壁と守備兵を強くする。' },
    storm: { name: '嵐を呼ぶ', kind: 'direct', on: ['place', 'army'], cost: 12, icon: '☂', desc: 'その地方に嵐を呼び、軍の足を止める。' },
    meteor: { name: '星を落とす', kind: 'direct', on: ['place', 'army'], cost: 26, icon: '☄', art: 'disaster', desc: '天から星を落とす。近くの軍は大きな被害を受ける。' },
    miracle: { name: '奇跡の光', kind: 'direct', on: ['place', 'city'], cost: 12, icon: '✧', art: 'miracle', desc: '空に光の柱を立てる。見た者の信仰が深まる。' },
    // 軍へ
    morale: { name: '士気を高める', kind: 'indirect', on: ['army'], cost: 9, icon: '⚑', desc: '兵に勇気を与える。' },
    lost: { name: '道に迷わせる', kind: 'indirect', on: ['army'], cost: 10, icon: '?', desc: '霧で道を見失わせ、行軍を遅らせる。' },
    revel: { name: '指揮官に啓示を与える', kind: 'indirect', on: ['army'], cost: 12, icon: '✦', desc: '指揮官に戦い方をひらめかせる。' }
  };
  G.STRENGTH = [{ k: 0.6, cost: 0.5, name: '弱く' }, { k: 1, cost: 1, name: 'ふつう' }, { k: 1.7, cost: 2, name: '強く' }];
  G.TIMING = [{ d: 0, name: '今すぐ' }, { d: 30, name: '来月' }, { d: 90, name: '次の季節' }];

  // ---- 女神の長期計画 ----
  G.PLANS = {
    invade: { name: '侵攻を決断させる', on: 'person', needNation: true, desc: '君主に、ある国への侵攻を決断させる。', years: 3, reward: 60 },
    breakpeace: { name: '和平を壊す', on: 'nation', needNation: true, desc: '2国のあいだに戦争を起こす。', years: 3, reward: 50 },
    makepeace: { name: '戦争を終わらせる', on: 'nation', needNation: true, desc: '戦争中の2国に和平を結ばせる。', years: 3, reward: 50 },
    crown: { name: '王位につかせる', on: 'person', desc: 'この人物を君主にする。', years: 6, reward: 80 },
    makehero: { name: '英雄に育てる', on: 'person', desc: '英雄にして、戦いで勝利させる。', years: 5, reward: 70 },
    split: { name: '国を分裂させる', on: 'nation', desc: '内乱を起こし、国を2つに割る。', years: 6, reward: 90 },
    bond: { name: '2人を結びつける', on: 'person', needPerson: true, desc: '2人の間に強い友情か愛情を生む。', years: 4, reward: 50 }
  };
})(globalThis.GD = globalThis.GD || {});
