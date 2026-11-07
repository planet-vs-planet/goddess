// ミッション v2(ChatGPTと詰めた設計): 物語のできごとが、戦場で「迷う事件」になる
// ・ゲージは2本。片方を守ると、もう片方が苦しくなる
// ・ミッション中は11枚のカードがすべて「ミッション用の効果」に変わる(正解は1つではない)
// ・神意はミッション中は回復しない
// ・結果は4通り。結果ごとに「記憶フラグ」が残り、あとの物語やミッションが変わる
(function (G) {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const LEN = 30; // 秒
  const humansDoubt = (S, n) => { for (const c of G.Game.humans()) c.doubt = clamp(c.doubt + n, 0, 100); };

  // ---- 4種類のミッションの決まり ----
  const DEF = {
    // 防衛: 城門突破圧力 と 勇者の負傷度
    defend: {
      name: '防衛ミッション', a: { k: 'gate', name: '城門突破圧力', start: 20, bad: true }, b: { k: 'hurt', name: 'アレンの負傷度', start: 10, bad: true },
      goal: m => `魔族の精鋭部隊が${fn(m.f)}の城門へ突撃! 城門(突破圧力)とアレン(負傷度)、守れるのはどちらか…`,
      perSec(m) {
        let g = 0.6; if (m.hurt >= 60) g += 0.5; if (m.hurt >= 85) g += 0.5;
        let h = 0; if (m.gate >= 60) h += 0.6; if (m.gate >= 85) h += 0.6;
        return { gate: g, hurt: h };
      },
      events: [{ t: 9, hurt: 10, warn: 7, msg: '敵の隊長の強攻撃!' }, { t: 11, gate: 5, msg: '敵が城門を集中攻撃' }, { t: 14, hurt: 10, warn: 12, msg: '隊長の強攻撃!' }, { t: 15, gate: 5, msg: '城門の一部が破損' },
        { t: 19, hurt: 15, warn: 17, msg: '隊長の必殺攻撃!' }, { t: 24, gate: 8, msg: '最後の突撃!' }, { t: 27, hurt: 20, warn: 25, msg: '隊長の最終攻撃!' }],
      cards: {
        light: { f: 1, gate: -18, txt: '城門 -18' },
        rally: { f: 1, hurt: -20, gate: -5, hero: 2, txt: 'アレンの負傷 -20・城門 -5・成長+2' },
        sword: { f: 2, gate: -20, block: 1, txt: '城門 -20・次の強攻撃を無効' },
        angels: { f: 3, gate: -30, hurt: -15, txt: '城門 -30・負傷 -15' },
        horde: { f: 1, gate: -15, doubtH: 3, txt: '敵の気をそらす: 城門 -15・人族の疑念+3' },
        empower: { f: 1, hurt: -15, gate: -5, txt: '闇の力で治す: 負傷 -15・城門 -5' },
        hatred: { f: 1, gate: -20, hurt: 8, doubtH: 5, txt: '怒りをアレンへ: 城門 -20・負傷 +8・疑念+5' },
        awaken: { f: 2, gate: -25, demon: 3, doubtZ: 2, txt: '魔王の威圧: 城門 -25・魔王成長+3' },
        storm: { f: 3, gate: -35, hurt: 10, txt: '落雷: 城門 -35・アレンも負傷 +10' },
        move: { f: 1, delay: 8, gate: -5, other: 10, txt: '次の強攻撃を8秒のばす(別の戦線が危うくなる)' },
        forget: { f: 2, gate: -25, doubtH: -3, txt: '隊長に命令を忘れさせる: 城門 -25' }
      }
    },
    // 反撃: 魔族の反撃準備度(ためる) と 人族の目撃度
    counter: {
      name: '反撃ミッション', a: { k: 'ready', name: '魔族の反撃準備度', start: 35, bad: false }, b: { k: 'seen', name: '人族の目撃度', start: 10, bad: true },
      goal: m => `${fn(m.f)}の魔族が夜襲をしかける。反撃準備を70以上に! ただし人族の目撃が31以上だと女神が疑われる`,
      perSec: () => ({ seen: 0.3 }),
      events: [{ t: 10, seen: 5, msg: '人族の斥候が近づいてきた' }, { t: 20, ready: -8, warn: 18, msg: '聖騎士団の突撃!' }],
      cards: {
        light: { f: 1, ready: 10, seen: 5, txt: '準備 +10・目撃 +5' },
        rally: { f: 1, ready: 8, seen: 3, demon: 2, txt: '準備 +8・魔王成長+2・目撃 +3' },
        sword: { f: 2, ready: 15, seen: 8, txt: '準備 +15・目撃 +8' },
        angels: { f: 3, ready: 25, seen: 20, txt: '準備 +25・目撃 +20' },
        horde: { f: 1, ready: 20, seen: 5, txt: '準備 +20・目撃 +5' },
        empower: { f: 1, ready: 12, txt: '準備 +12(見られない)' },
        hatred: { f: 1, ready: 15, seen: 10, doubtZ: 2, txt: '準備 +15・目撃 +10' },
        awaken: { f: 2, ready: 25, seen: 10, demon: 5, txt: '準備 +25・魔王成長+5・目撃 +10' },
        storm: { f: 3, ready: 30, seen: 15, txt: '準備 +30・目撃 +15' },
        move: { f: 1, seen: -15, ready: 5, txt: '見ている人を遠ざける: 目撃 -15' },
        forget: { f: 2, seen: -30, txt: '見た記憶を消す: 目撃 -30' }
      }
    },
    // 隠蔽: 調査の進み と 違和感(改ざんの跡)
    cover: {
      name: '隠蔽ミッション', a: { k: 'inv', name: '調査の進み', start: 10, bad: true }, b: { k: 'odd', name: '証拠の露出度', start: 0, bad: true },
      goal: m => `${G.CHARS[m.who].name}が女神の秘密を調べている! 調査と証拠を30以下に抑えろ`,
      perSec: () => ({ inv: 1.2, odd: 0.5 }),
      events: [{ t: 12, inv: 8, msg: '古い記録が見つかった' }, { t: 22, inv: 10, warn: 20, msg: '証拠がそろってきた!' }],
      cards: {
        light: { f: 1, inv: -10, odd: 5, txt: '奇跡で気をそらす: 調査 -10・証拠 +5' },
        rally: { f: 1, inv: -8, doubtH: 2, txt: '調査 -8・ほかの人族の疑念+2' },
        sword: { f: 2, inv: -20, odd: 10, txt: '調査 -20・証拠 +10' },
        angels: { f: 3, inv: -30, odd: 20, txt: '調査 -30・証拠 +20' },
        horde: { f: 1, inv: -15, moveWho: 1, txt: '魔物で追いやる: 調査 -15' },
        empower: { f: 1, inv: -10, odd: -5, txt: '調査 -10・証拠 -5' },
        hatred: { f: 1, inv: -15, doubtH: 5, txt: '調査を中断させる: 調査 -15・人族の疑念+5' },
        awaken: { f: 2, inv: -20, d: 15, txt: '魔族の事件を起こす: 調査 -20' },
        storm: { f: 3, inv: -35, odd: 25, txt: '調査の場所を壊す: 調査 -35・証拠 +25' },
        move: { f: 1, inv: -15, moveWho: 1, txt: '別の場所へ導く: 調査 -15' },
        forget: { f: 2, inv: -30, odd: 15, txt: '記憶を消す: 調査 -30・証拠 +15' }
      }
    },
    // 決戦: 金色の帯にいた時間(ためる) と 二人の覚醒度
    clash: {
      name: '決戦ミッション', a: { k: 'band', name: '均衡を保った時間', start: 0, bad: false, max: 10 }, b: { k: 'wake', name: '衝突の危険度', start: 20, bad: true },
      goal: m => `${fn(m.f)}で勇者と魔王が激突! 前線を金色の帯に合計10秒保て。危険度が高いと二人が神に迫る`,
      perSec: () => ({ wake: 0.6 }),
      events: [{ t: 8, push: 18, warn: 6, msg: '勇者の突撃!' }, { t: 15, push: -22, warn: 13, msg: '魔王の反撃!' }, { t: 23, push: 20, warn: 21, msg: '勇者の必殺の一撃!' }],
      cards: {
        light: { f: 1, push: 10, wake: 3, txt: '前線を人族側へ +10' },
        rally: { f: 1, hero: 3, wake: 5, txt: 'アレン成長+3・覚醒 +5' },
        sword: { f: 2, hero: 5, push: 15, wake: 8, txt: 'アレン成長+5・前線 +15' },
        angels: { f: 3, push: 25, wake: 15, txt: '前線 +25・覚醒 +15' },
        horde: { f: 1, push: -10, wake: 3, txt: '前線を魔族側へ -10' },
        empower: { f: 1, demon: 3, wake: 5, txt: 'ゼフィラ成長+3・覚醒 +5' },
        hatred: { f: 1, push: -15, wake: 8, txt: '前線 -15・覚醒 +8' },
        awaken: { f: 2, demon: 5, push: -15, wake: 10, txt: 'ゼフィラ成長+5・前線 -15' },
        storm: { f: 3, center: 100, wake: 15, txt: '前線をまんなかへ・覚醒 +15' },
        move: { f: 1, center: 10, wake: -5, txt: '前線をまんなかへ10・覚醒 -5' },
        forget: { f: 2, doubtAZ: -5, wake: -10, txt: '二人の疑念 -5・覚醒 -10' }
      }
    }
  };

  // ---- 結果(4通り)。上から順に当てはまるものになる ----
  // ChatGPTの確定案。fx は物語と同じ書き方(hero/demon/h/d/faith/doubt_名前)
  const RESULTS = {
    defend: [
      { if: m => m.gate <= 30 && m.hurt <= 30, t: '城も勇者も無事', ok: true, fx: { h: 8, hero: 6, faith: 12 }, flags: ['grayfang_gate_held', 'allen_unhurt'], msg: '城門も勇者も守りきった!' },
      { if: m => m.gate <= 30, t: '城は守ったが勇者が負傷', ok: true, fx: { h: 8, hero: 3, faith: 7, doubt_allen: 3 }, flags: ['grayfang_gate_held', 'allen_wounded'], hurt: 2, msg: '城は守った。でもアレンは傷を負った' },
      { if: m => m.hurt <= 60, t: '城門突破、勇者覚醒', ok: true, fx: { h: -8, d: 3, hero: 12, faith: 4 }, flags: ['grayfang_gate_breached', 'allen_awakened_under_pressure'], breach: 20, msg: '城門は破られた。だが追いつめられたアレンが覚醒した(成長+12)' },
      { if: () => true, t: '城門突破、勇者重傷', ok: false, fx: { h: -15, d: 8, hero: 2, faith: -5, doubt_allen: 5 }, flags: ['grayfang_gate_breached', 'allen_critically_wounded', 'grayfang_commander_escaped'], breach: 30, hurt: 6, msg: '城門を破られ、アレンは重傷。敵の隊長は逃げのびた…' }
    ],
    counter: [
      { if: m => m.ready >= 70 && m.seen <= 30, t: '秘密の反撃成功', ok: true, fx: { d: 10, demon: 8, faith: 8 }, flags: ['counterattack_secret_success'], msg: 'だれにも見られず、魔族の反撃は成功した' },
      { if: m => m.ready >= 70, t: '反撃成功、だが目撃された', ok: true, fx: { d: 10, demon: 5, h: 5, faith: 4, doubt_allen: 4, doubt_elmina: 3 }, flags: ['counterattack_witnessed'], msg: '反撃は成功。でも人族に「何か」を見られた' },
      { if: m => m.seen <= 30, t: '反撃失敗、秘密は守った', ok: false, fx: { d: -4, demon: 4, faith: 2 }, flags: ['counterattack_failed_secretly'], push: 15, msg: '反撃は失敗。でも女神の介入はばれなかった' },
      { if: () => true, t: '反撃失敗、作戦が露見', ok: false, fx: { d: -10, h: 8, faith: -4, doubt_allen: 6, doubt_elmina: 8 }, flags: ['counterattack_exposed'], push: 30, msg: '反撃は失敗し、女神の作戦まで見られた…' }
    ],
    cover: [
      { if: m => m.inv <= 30 && m.odd <= 30, t: '完全に隠した', ok: true, fx: { faith: 5, doubt_W: -5 }, flags: ['secret_completely_hidden', 'investigator_misled'], msg: '秘密は完全に守られた' },
      { if: m => m.inv <= 30, t: '調査は止めたが痕跡が残った', ok: true, fx: { faith: 2, doubt_W: 4, doubt_serena: 2 }, flags: ['investigation_diverted', 'trace_remains'], msg: '調査は止めた。でも痕跡が残っている' },
      { if: m => m.odd <= 60, t: '証拠の一部を見つけられた', ok: false, fx: { faith: -3, doubt_W: 8, doubt_serena: 3 }, flags: ['elmina_found_fragment'], msg: '証拠のかけらを見つけられてしまった' },
      { if: () => true, t: '女神の秘密が露見', ok: false, fx: { faith: -10, h: -3, doubt_W: 12, doubt_serena: 8, doubt_allen: 8 }, flags: ['goddess_secret_exposed'], msg: '女神の秘密が人族に知られてしまった!' }
    ],
    clash: [
      { if: m => m.band >= 10 && m.wake <= 40, t: '均衡を保った決戦', ok: true, fx: { faith: 30, hero: 3, demon: 3, h: 3, d: 3 }, flags: ['decisive_balance_held'], msg: '完璧な均衡! 激戦の祈りが集まった' },
      { if: m => m.band >= 10, t: '激突しながら均衡を維持', ok: true, fx: { faith: 22, hero: 8, demon: 8, doubt_allen: 3, doubt_zephyra: 3 }, flags: ['decisive_duel_balanced', 'both_champions_awakened'], msg: '祈りは集まった。でも二人は強くなりすぎた' },
      { if: m => m.wake <= 60, t: '均衡崩壊、両軍消耗', ok: false, fx: { faith: 5, h: -5, d: -5 }, flags: ['decisive_balance_broken'], msg: '決戦は崩れ、両軍が消耗した' },
      { if: () => true, t: '二人が神に迫る激突', ok: false, fx: { faith: 12, hero: 10, demon: 10, h: -8, d: -8, doubt_allen: 8, doubt_zephyra: 8 }, flags: ['divine_duel_triggered', 'both_near_rebellion'], msg: '二人の力が神の領域に届きかけた…' }
    ]
  };
  const fn = fid => { const f = G.FRONTS.find(x => x.id === fid); return f ? f.name : ''; };
  // ---- 神託の方針: ミッションがない時に1つ選ぶ(60秒・神意0)。次に来る対象のミッションを有利に ----
  const POLICY = {
    hero: { name: '勇者の成長', desc: '次の防衛か決戦で有利に(アレンの負傷-10/均衡+2秒)。終わるとアレン成長+8・疑念+2', types: ['defend', 'clash'], start: m => { if (m.type === 'defend') m.hurt = Math.max(0, m.hurt - 10); else m.band += 2; }, after: { hero: 8, doubt_allen: 2 } },
    demon: { name: '魔王の成長', desc: '次の反撃か決戦で有利に(準備+15・目撃+5/危険度+15)。終わると魔王成長+8・疑念+2', types: ['counter', 'clash'], start: m => { if (m.type === 'counter') { m.ready += 15; m.seen += 5; } else m.wake += 15; }, after: { demon: 8, doubt_zephyra: 2 } },
    hide: { name: '痕跡の隠蔽', desc: '次の隠蔽で有利に(調査-20・証拠-15)。終わると信仰-5・調べる人の疑念+2', types: ['cover'], start: m => { m.inv = Math.max(0, m.inv - 20); m.odd = Math.max(0, m.odd - 15); }, after: { faith: -5, doubt_elmina: 2 } }
  };
  const POLICY_LEN = 6; // か月(60秒)
  // ---- 記憶フラグ: 前のミッションの結果が、あとで返ってくる ----
  const Flags = {
    has: (S, f) => !!(S.flags && S.flags[f]),
    use(S, f) { if (S.flags && S.flags[f]) { S.flags[f] = 0; return true; } return false; },
    onMissionStart(S, m, e) {
      const notes = [];
      if (m.type === 'defend' && Flags.use(S, 'grayfang_commander_escaped')) { m.gate += 15; m.title = '再襲来: ' + m.title; notes.push('前に逃した敵の隊長が、仕返しに戻ってきた!(城門の圧力+15)'); }
      if (m.type === 'defend' && Flags.use(S, 'allen_awakened_under_pressure')) { m.hurt = Math.max(0, m.hurt - 10); notes.push('前の戦いで覚醒したアレンは、もう簡単には倒れない(負傷-10)'); }
      if (m.type === 'defend' && Flags.use(S, 'grayfang_gate_held')) { m.gate = Math.max(0, m.gate - 10); notes.push('前に城を守りきった兵士たちが、自信をもって戦っている(城門-10)'); }
      if (m.type === 'counter' && Flags.use(S, 'zephyra_saw_ruin')) { m.ready += 15; m.seen += 10; notes.push('滅びの夢を見たゼフィラが、自ら先頭に立った(準備+15・目撃+10)'); }
      if (m.type === 'counter' && Flags.use(S, 'counterattack_exposed')) { m.seen += 15; notes.push('前に作戦を見られたので、人族の見張りが増えている(目撃+15)'); }
      if (m.type === 'cover' && Flags.use(S, 'counterattack_witnessed')) { m.inv += 15; notes.push('前に目撃された「魔族を助ける光」のせいで、最初から警戒されている(調査+15)'); }
      if (m.type === 'cover' && Flags.use(S, 'elmina_found_fragment')) { m.odd += 15; notes.push('前に見つかった証拠のかけらが残っている(証拠+15)'); }
      if (m.type === 'cover' && Flags.use(S, 'trace_remains')) { m.odd += 10; notes.push('前の痕跡が残っている(証拠+10)'); }
      if (m.type === 'clash' && Flags.use(S, 'both_champions_awakened')) { m.wake += 15; notes.push('前の決戦で強くなりすぎた二人は、もっと激しくぶつかる(危険度+15)'); }
      if (notes.length) m.flagNote = notes.join(' ');
    },
    afterMission(S, r, ev) {
      // 秘密がばれたら、すぐに物語が動く
      if (r.flags.includes('goddess_secret_exposed')) for (const id of ['allen', 'serena', 'elmina']) { const c = S.chars[id]; if (c.alive) c.doubt = clamp(c.doubt + 5, 0, 100); }
      // 神に迫る激突のあとは、勇者と魔王が早く近づく
      if (r.flags.includes('divine_duel_triggered')) S.allyEarly = 1;
    },
    // 物語の2択から記憶フラグを残す(数値だけでなく、あとで返ってくるように)
    fromChoice(S, e, choice) {
      const c = choice != null && e.choice && e.choice[choice]; if (!c) return null;
      const ef = c.effect || {}; S.flags = S.flags || {};
      let f = null;
      if (e.kind === 'demon' && (ef.d || 0) >= 8) f = 'zephyra_saw_ruin';
      else if (e.kind === 'human' && (ef.h || 0) >= 8) f = 'allen_saw_miracle';
      else if ((ef.doubt_allen || 0) < 0 || (ef.doubt_zephyra || 0) < 0) f = 'trusted_self';
      if (f) S.flags[f] = (S.flags[f] || 0) + 1;
      return f;
    }
  };
  function hurtAllen(S, months) { S.allenHurt = Math.max(S.allenHurt || 0, S.month + months); }
  function breach(S, m) { const fr = G.Game.front(m.f); fr.f = clamp(fr.f - 35, -100, 100); for (const c of G.Game.humans()) c.trust = Math.max(0, c.trust - 8); }
  function gainFaith(S, n) { S.faith = Math.min(200, S.faith + n); S.total += n; }

  const Mission = {
    LEN, DEF, RESULTS, POLICY, POLICY_LEN, Flags,
    setPolicy(S, k) { if (S.mission || S.policy || !POLICY[k]) return false; S.policy = { k, left: POLICY_LEN }; return true; },
    start(S, sev, choice) {
      const e = sev.e, kind = e.kind;
      if (kind === 'intro' || S.revolt || S.ended) return null;
      const type = { human: 'defend', demon: 'counter', secret: 'cover', climax: 'clash' }[kind];
      if (!type) return null;
      const d = DEF[type], fid = sev.front || 'center';
      const m = { type, f: fid, title: e.title, t: 0, delay: [], blocks: 0 };
      m[d.a.k] = d.a.start; m[d.b.k] = d.b.start;
      if (type === 'cover') { m.who = investigator(S, e); if (!m.who) return null; if (S.chars[m.who]) S.chars[m.who].at = fid; }
      if (type === 'defend' && S.chars.allen.alive) S.chars.allen.at = fid;
      if (type === 'counter' && S.chars.zephyra.alive) S.chars.zephyra.at = fid;
      if (type === 'clash') { for (const id of ['allen', 'zephyra']) if (S.chars[id].alive) S.chars[id].at = fid; const fr0 = G.Game.front(fid); fr0.f *= 0.4; }
      m.events = d.events.map(x => Object.assign({}, x));
      // 物語で選んだ答えで、始まり方が少し変わる
      const ce = choice != null && e.choice && e.choice[choice] ? e.choice[choice].effect || {} : {};
      if (type === 'defend' && (ce.h || 0) >= 8) { m.gate = Math.max(0, m.gate - 10); m.note = '女神の光で、城門は最初から少し持ちこたえている'; }
      if (type === 'counter' && (ce.d || 0) >= 8) { m.ready += 10; m.note = '夢の力で、魔族は最初から勢いづいている'; }
      if (type === 'cover' && (ce['doubt_' + m.who] || 0) < 0) { m.inv = Math.max(0, m.inv - 10); m.note = '記憶を曇らせたので、調査はおくれて始まる'; }
      // 記憶フラグで始まり方が変わる(前に起きたことが返ってくる)
      Flags.onMissionStart(S, m, e);
      // 神託の方針(前もって選んでおいたもの)
      const P = S.policy && POLICY[S.policy.k];
      if (P && P.types.includes(type)) { P.start(m); m.policy = S.policy.k; m.policyNote = `神託「${P.name}」が効いている`; S.policy = null; }
      m.goal = d.goal(m);
      S.mission = m;
      return m;
    },
    def(m) { return DEF[m.type]; },
    // 時間を進める(dt = 月)。1か月 = MS秒
    tick(S, dt, ev) {
      if (S.policy && !S.mission) { S.policy.left -= dt; if (S.policy.left <= 0) { ev.push({ k: 'mwarn', t: `神託「${POLICY[S.policy.k].name}」は使われずに消えた` }); S.policy = null; } }
      const m = S.mission; if (!m) return;
      if (S.revolt) { S.mission = null; return; }
      const d = DEF[m.type], sec = dt * G.Game.MS, fr = G.Game.front(m.f);
      m.t += sec;
      const ps = d.perSec(m);
      for (const k in ps) Mission.add(m, k, ps[k] * sec * (m.speed || 1));
      if (m.type === 'cover' && S.chars[m.who] && S.chars[m.who].at !== m.f) Mission.add(m, 'inv', -1.5 * sec); // 現場をはなれると遅い
      if (m.type === 'clash') {
        fr.f = clamp(fr.f + (Math.random() - 0.5) * 20 * Math.sqrt(sec / 10) + (fr.f > 0 ? 0.6 : -0.6) * sec, -100, 100);
        const both = ['allen', 'zephyra'].every(id => S.chars[id].alive && S.chars[id].at === m.f);
        if (Math.abs(fr.f) < 30 && both) m.band = Math.min(10, m.band + sec);
      }
      // 決まった時刻の事件(予告つき)
      for (const x of m.events) {
        if (x.done) continue;
        if (x.warn != null && !x.warned && m.t >= x.warn) { x.warned = 1; ev.push({ k: 'mwarn', t: '⚠ まもなく' + x.msg }); }
        if (m.t >= x.t) {
          x.done = 1;
          if (x.hurt != null && m.blocks > 0) { m.blocks--; ev.push({ k: 'mwarn', t: '聖剣が攻撃をはね返した!' }); continue; }
          if (x.hurt != null && m.delay.length) { m.delay.shift(); m.events.push(Object.assign({}, x, { t: x.t + 8, warn: x.t + 6, done: 0, warned: 0 })); ev.push({ k: 'mwarn', t: '運命の糸が攻撃を遅らせた' }); continue; }
          for (const k of ['hurt', 'gate', 'ready', 'seen', 'inv']) if (x[k]) Mission.add(m, k, x[k]);
          if (x.push) fr.f = clamp(fr.f + x.push, -100, 100);
          ev.push({ k: 'mwarn', t: x.msg, hit: true });
        }
      }
      // ゲージが100になったら早めに終わるもの
      if (m.type === 'counter' && m.seen >= 100) return Mission.finish(S, ev);
      if (m.type === 'cover' && (m.inv >= 100 || m.odd >= 100)) return Mission.finish(S, ev);
      if (m.type === 'clash' && m.wake >= 100) return Mission.finish(S, ev);
      if (m.t >= LEN) Mission.finish(S, ev);
    },
    add(m, k, v) { const max = k === 'band' ? 10 : 100; m[k] = clamp((m[k] || 0) + v, 0, max); if (k === 'gate' && m.gate >= 100) m.gateBroken = 1; if (m.gateBroken) m.gate = 100; },
    // ミッション中のカード(全部「すぐ使う」になる)
    cardFx(S, card) { const m = S && S.mission; return m ? DEF[m.type].cards[card.id] || null : null; },
    play(S, card) {
      const m = S.mission, c = Mission.cardFx(S, card); if (!m || !c) return null;
      const fr = G.Game.front(m.f);
      for (const k of ['gate', 'hurt', 'ready', 'seen', 'inv', 'odd', 'wake']) if (c[k]) Mission.add(m, k, c[k]);
      if (c.hero) G.Game.addGrow('hero', c.hero);
      if (c.demon) G.Game.addGrow('demon', c.demon);
      if (c.doubtH) humansDoubt(S, c.doubtH);
      if (c.doubtZ) S.chars.zephyra.doubt = clamp(S.chars.zephyra.doubt + c.doubtZ, 0, 100);
      if (c.doubtAZ) for (const id of ['allen', 'zephyra']) S.chars[id].doubt = clamp(S.chars[id].doubt + c.doubtAZ, 0, 100);
      if (c.block) m.blocks += c.block;
      if (c.delay) { m.delay.push(1); if (c.other) { const o = S.fronts.find(x => x.id !== m.f); o.db += c.other * 2; } }
      if (c.push) fr.f = clamp(fr.f + c.push, -100, 100);
      if (c.center) fr.f = Math.abs(fr.f) <= c.center ? 0 : fr.f - Math.sign(fr.f) * c.center;
      if (c.d) fr.db += c.d;
      if (c.moveWho && m.who) { const o = S.fronts.find(x => x.id !== m.f); S.chars[m.who].at = o.id; }
      return c;
    },
    finish(S, ev) {
      const m = S.mission; if (!m) return;
      S.mission = null; S.missionRest = S.time + 1.5;
      const r = RESULTS[m.type].find(x => x.if(m));
      const fx = {}; for (const k in r.fx) fx[k === 'doubt_W' ? 'doubt_' + (m.who || 'elmina') : k] = r.fx[k];
      G.Story.apply(S, fx, m.f);
      if (r.breach) { const fr = G.Game.front(m.f); fr.f = clamp(fr.f - r.breach, -100, 100); }
      if (r.push) { const fr = G.Game.front(m.f); fr.f = clamp(fr.f + r.push, -100, 100); }
      if (r.hurt) hurtAllen(S, r.hurt);
      S.flags = S.flags || {}; for (const f of r.flags) S.flags[f] = (S.flags[f] || 0) + 1;
      // 神託の方針の「終わったときの効果」
      if (m.policy) { G.Story.apply(S, POLICY[m.policy].after, m.f); }
      if (r.ok) S.focus = Math.min(G.Game.FOCUS_MAX, (S.focus || 0) + 1);
      S.mlog = S.mlog || []; S.mlog.push({ title: m.title, res: r.t, ok: r.ok });
      ev.push({ k: 'mission', ok: r.ok, m, res: r, t: `${m.title}: ${r.t}`, msg: r.msg });
      if (G.Flags) G.Flags.afterMission(S, r, ev);
    }
  };
  // 秘密を調べている人(セリフに出る人族、または疑念が上がる人)
  function investigator(S, e) {
    const ok = id => S.chars[id] && S.chars[id].alive && S.chars[id].side === 'h';
    for (const k in (e.effect || {})) if (k.startsWith('doubt_') && ok(k.slice(6))) return k.slice(6);
    for (const l of e.lines) if (ok(l[0])) return l[0];
    return ok('elmina') ? 'elmina' : ok('serena') ? 'serena' : null;
  }
  G.Mission = Mission; G.Flags = Flags;
})(globalThis.G2 = globalThis.G2 || {});
