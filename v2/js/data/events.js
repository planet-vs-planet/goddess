// 毎月の出来事。だれかが話しかけてきて、女神は3つから選ぶ。
// 選択肢の効果: cat(miracle 神の奇跡/whisper 邪神の囁き/fate 運命の操作/none), cost 信仰, h 人族の力, d 魔族の力,
//   f 前線をすぐ動かす(+で人族が前へ), faith 信仰がすぐ増える, sus 疑念, fx 演出, reply 選んだあとのセリフ, run 特別な処理
(function (G) {
  const L = (who, text) => ({ who, text });

  G.TUTORIAL = [
    {
      id: 't1', img: 'scene_war', lines: [L('nox', '女神さま、お目覚めですか。影の側近、ノクスでございます。'), L('nox', 'ごらんください。人族が魔族に押されています。左が人族の城、右が魔族の城。前線が人族の城に近づいています。'), L('nox', 'このままでは人族が滅びます。勇者アレンに、女神さまの光をお与えください。')],
      choices: [
        { label: '勇者に光の加護を与える', cat: 'miracle', cost: 15, h: 35, fx: 'light', hint: 'おすすめ', reply: [L('allen', 'この光は……女神さまだ! みんな、進め! 女神さまがついているぞ!')] },
        { label: '様子を見る', cat: 'none', reply: [L('nox', '……人族はもちこたえられるでしょうか。')] }
      ]
    },
    {
      id: 't2', lines: [L('nox', 'すばらしい。人族は女神さまを、慈悲深い救いの神だと信じています。'), L('nox', 'けれど人族が勝ちすぎれば、魔族は滅び、戦争は終わってしまいます。'), L('nox', '今度は魔王ゼフィラの夢に、そっとささやいてさしあげましょう。')],
      choices: [
        { label: '魔王の夢にささやく', cat: 'whisper', cost: 15, d: 35, sus: 5, fx: 'dark', hint: 'おすすめ', reply: [L('zephyra', '……だれだ、この声は。力が欲しいか、だと? ……ああ、欲しい。人族を倒す力が!'), L('nox', 'ふふ。まさか同じ女神さまの仕業だとは、だれも思いません。ただし、魔族に力を与えるたびに「疑念」が少したまります。')] },
        { label: '人族をさらに強くする', cat: 'miracle', cost: 15, h: 25, fx: 'light', reply: [L('nox', '人族が勝ちすぎないよう、お気をつけください。')] }
      ]
    },
    {
      id: 't3', lines: [L('nox', '戦いがつづけば、人族はおそれ、女神さまに祈ります。その祈りが「信仰」となり、女神さまの力になります。'), L('nox', '前線がまんなかの金色の帯にあるときほど、祈りはたくさん集まります。どちらかの城まで前線が届けば、片方が滅びて戦争は終わりです。'), L('nox', 'では、戦いをごらんください。ここから先は、女神さまご自身でお選びください。')],
      choices: [
        { label: '戦いを見守る', cat: 'none', reply: [L('goddess_dark', 'さあ、愛しき世界よ。今日も祈りなさい。')] },
        { label: '運命の糸を引き、両軍を激突させる', cat: 'fate', cost: 10, fx: 'fate', run: s => { s.clashBonus = 1; }, reply: [L('nox', '両軍が引き寄せられていきます。激しい戦いになれば、祈りも強くなります。')] }
      ]
    }
  ];

  G.EVENTS = [
    {
      id: 'hero_pray', when: s => s.f < -12 && s.alive.allen, weight: 3, img: 'scene_war',
      lines: [L('allen', '女神さま……魔族の軍勢が止まりません。仲間が次々に倒れていく……どうか、力を!')],
      choices: [
        { label: '光の加護を与える', cat: 'miracle', cost: 15, h: 30, fx: 'light', reply: [L('allen', 'この光……女神さまだ! 皆、進め!')] },
        { label: '試練として何もしない', cat: 'none', h: -5, faith: 10, reply: [L('allen', 'なぜだ、女神さま……それでも、祈りつづけます!'), L('nox', '追いつめられた人族の祈りは、とても強いものです。')] },
        { label: '勇者の作戦を魔王にささやく', cat: 'whisper', cost: 10, d: 25, sus: 7, fx: 'dark', reply: [L('zephyra', '人族の動きが手に取るようにわかる……ふふ、運命は私の味方だ。')] }
      ]
    },
    {
      id: 'lord_dream', when: s => s.f > 12, weight: 3, img: 'ev_cursed_castle',
      lines: [L('zephyra', '人族の勇者め……あの光は何なのだ。私にも、あのような力があれば……')],
      choices: [
        { label: '魔王に力をささやく', cat: 'whisper', cost: 15, d: 30, sus: 6, fx: 'dark', reply: [L('zephyra', 'また、あの声……力が、あふれてくる! 人族どもよ、震えるがいい!')] },
        { label: '魔物の大軍を送りこむ', cat: 'whisper', cost: 25, d: 45, sus: 10, fx: 'dark', reply: [L('volg', '闇の底から魔物どもがわいてきやがる……行け! 人族の砦を食いつくせ!')] },
        { label: '放っておく', cat: 'none', reply: [L('zephyra', '……ならば、自分の力で戦うまでだ。')] }
      ]
    },
    {
      id: 'peace', when: s => s.month >= 6 && !s.peaceBlock, weight: s => 1 + s.monthsSincePeace / 6, img: 'ev_capital_city',
      lines: [L('gran', '魔族との和平……民はもう疲れきっている。魔王に使者を送り、話し合いの席を設けよう。'), L('nox', '女神さま! 和平が結ばれれば、戦争は終わってしまいます!')],
      choices: [
        { label: '使者を闇に消す', cat: 'fate', cost: 15, sus: 8, h: 10, d: 10, fx: 'fate', run: s => { s.peaceProg = 0; s.peaceBlock = 6; }, reply: [L('gran', '使者が殺されただと!? 魔族め……やはり信用できぬ!'), L('zephyra', '使者を殺したのは人族のほうだろう! 和平など、もうない!')] },
        { label: '偽りの神託を下す', cat: 'fate', cost: 25, sus: 3, fx: 'fate', run: s => { s.peaceProg = 0; s.peaceBlock = 6; }, reply: [L('serena', '神託が下りました……「和平は魔族の罠である」と。'), L('gran', '女神さまがそうおっしゃるなら……戦いをつづけるしかない。')] },
        { label: '見逃す(和平が一歩進む)', cat: 'none', warn: '2回見逃すと戦争が終わる', run: s => { s.peaceProg++; }, reply: [L('gran', '魔王も話を聞くそうだ。もしかすると、本当に戦争が終わるかもしれん……')] }
      ]
    },
    {
      id: 'serena_doubt', when: s => s.sus >= 20 && s.alive.serena && !s.flags.serenaDone, once: true, weight: 6, img: 'ev_altar',
      lines: [L('serena', '女神さま……魔族の祭壇で、女神さまと同じ紋章を見ました。'), L('serena', 'これは、どういうことなのですか? まさか……')],
      choices: [
        { label: '聖女の記憶を消す', cat: 'fate', cost: 30, sus: -15, fx: 'fate', run: s => { s.flags.serenaDone = 1; }, reply: [L('serena', '……あれ? 私、何を言おうとしていたのでしょう。'), L('goddess_dark', 'いい子ね。忘れてしまいなさい。')] },
        { label: '魔将に聖女を討たせる', cat: 'whisper', cost: 10, sus: 4, d: 15, h: -15, fx: 'dark', run: s => { s.flags.serenaDone = 1; s.alive.serena = false; }, reply: [L('volg', '聖女の首、いただいた!'), L('allen', 'セレナ……セレナァァ! 魔族め、許さない……!'), L('goddess_dark', '悲しみは、よい祈りになるわ。')] },
        { label: '何もしない', cat: 'none', sus: 10, run: s => { s.flags.serenaDone = 1; }, reply: [L('serena', '……女神さまは、何も答えてくださらない。')] }
      ]
    },
    {
      id: 'famine', when: s => s.month > 3, weight: 1.2, img: 'scene_peace',
      lines: [L('gran', '人族の村が飢えている。畑は枯れ、子どもたちが泣いている……女神さま、どうかお恵みを。')],
      choices: [
        { label: '豊穣の奇跡', cat: 'miracle', cost: 15, h: 12, fx: 'light', run: s => { s.thanks += 3; }, reply: [L('gran', '畑が黄金色に……! 女神さまのお恵みだ! 皆、女神さまに感謝を!')] },
        { label: '飢えさせておく', cat: 'none', h: -15, faith: 15, reply: [L('nox', '飢えた人々は、昼も夜も女神さまに祈っています。')] },
        { label: '魔族の畑も枯らす', cat: 'fate', cost: 10, h: -8, d: -15, sus: 3, fx: 'storm', reply: [L('volg', 'くそっ、こっちの畑まで枯れやがった!')] }
      ]
    },
    {
      id: 'dragon', when: s => s.month >= 8 && !s.flags.dragon, once: true, weight: 4, img: 'ev_dragon',
      lines: [L('ignis', '千年の眠りから覚めてみれば……騒がしいな。人間と魔族が、まだ争っているのか。'), L('ignis', '……我を呼んだのは、お前か。天の女。')],
      choices: [
        { label: '竜王を魔族の味方にする', cat: 'whisper', cost: 20, d: 40, sus: 6, fx: 'dark', run: s => { s.flags.dragon = 'd'; }, reply: [L('ignis', 'よかろう。魔王に力を貸してやる。人間の城を焼いてやろう。')] },
        { label: '竜王を人族の味方にする', cat: 'miracle', cost: 25, h: 35, sus: 3, fx: 'light', run: s => { s.flags.dragon = 'h'; }, reply: [L('ignis', '人間に味方せよと? ……面白い。お前の思惑に乗ってやろう。'), L('allen', '竜が……味方に!? これも女神さまの奇跡なのか!')] },
        { label: 'ふたたび眠らせる', cat: 'fate', cost: 10, fx: 'fate', run: s => { s.flags.dragon = 'sleep'; }, reply: [L('ignis', '……また、眠りか。まあよい……')] }
      ]
    },
    {
      id: 'sword', when: s => s.alive.allen && !s.flags.sword, once: true, weight: s => s.f < 0 ? 3 : 1, img: 'ev_holy',
      lines: [L('allen', '湖の底で、何かが光っている……剣? あれは……伝説の聖剣!?')],
      choices: [
        { label: '聖剣を勇者に授ける', cat: 'miracle', cost: 25, h: 40, fx: 'light', run: s => { s.flags.sword = 'h'; }, reply: [L('allen', 'これが聖剣アストレア……! 女神さま、この剣で必ず魔王を倒します!')] },
        { label: '聖剣を魔族に渡す', cat: 'whisper', cost: 20, d: 35, sus: 9, fx: 'dark', run: s => { s.flags.sword = 'd'; }, reply: [L('volg', '人族の聖剣がなぜ俺の手に……? ハハハ、まあいい! これで勇者を斬る!')] },
        { label: '湖に沈めたままにする', cat: 'none', reply: [L('allen', '……光が消えた。気のせいだったのか。')] }
      ]
    },
    {
      id: 'volg_raid', when: s => s.f > -25, weight: 2, img: 'ev_burning_fortress',
      lines: [L('volg', '人族の砦の守りが手薄になっている。いまこそ総攻撃だ! 魔王さま、ご命令を!')],
      choices: [
        { label: '総攻撃をあおる', cat: 'whisper', cost: 10, d: 20, f: -10, sus: 4, fx: 'dark', reply: [L('volg', 'うおおお! 全軍突撃ィ!')] },
        { label: '嵐で魔族の足を止める', cat: 'fate', cost: 15, d: -20, sus: 2, fx: 'storm', reply: [L('volg', 'な、なんだこの嵐は!? 進めねえ!')] },
        { label: '見守る', cat: 'none', reply: [L('nox', '魔将の軍が動き出しました。')] }
      ]
    },
    {
      id: 'human_rampage', when: s => s.f > 45, weight: 5, img: 'ev_fire_city',
      lines: [L('gran', '勝利は目前だ! 魔族を一匹残らず根絶やしにせよ!'), L('nox', '女神さま、人族が勝ちすぎています! このままでは魔族が滅び、戦争が終わります!')],
      choices: [
        { label: '天災で進軍を止める', cat: 'fate', cost: 25, h: -30, f: -15, sus: 3, fx: 'storm', reply: [L('gran', '大地が裂けた!? 進軍は中止だ!')] },
        { label: '魔王を覚醒させる', cat: 'whisper', cost: 40, d: 60, sus: 12, fx: 'dark', reply: [L('zephyra', 'この力は……! 額が熱い……光の輪の紋章が……? どうでもいい! 人族を押しもどせ!')] },
        { label: '進ませる', cat: 'none', h: 10, reply: [L('gran', '進め! 魔族の城まで攻め上るのだ!')] }
      ]
    },
    {
      id: 'demon_rampage', when: s => s.f < -45, weight: 5, img: 'scene_war',
      lines: [L('zephyra', '人族の城まで、あと少し……! 滅ぼしてやる。一人残らず!'), L('nox', '女神さま、人族が滅びそうです! 祈る者がいなくなってしまいます!')],
      choices: [
        { label: '天使の軍勢を降ろす', cat: 'miracle', cost: 40, h: 60, fx: 'light', reply: [L('allen', '空から天使が……! 女神さまは、ぼくたちを見捨てていなかった!')] },
        { label: '勇者を覚醒させる', cat: 'miracle', cost: 25, h: 35, fx: 'light', reply: [L('allen', '体の奥から力がわいてくる……! いくぞ、ゼフィラ!')] },
        { label: '進ませる', cat: 'none', d: 10, reply: [L('zephyra', 'ハハハ! 女神とやらも、ついに見捨てたか!')] }
      ]
    },
    {
      id: 'lovers', when: s => s.month >= 10 && s.alive.allen && !s.flags.lovers, once: true, weight: 2.5, img: 'ev_lovers',
      lines: [L('nox', '女神さま、うわさです。勇者アレンが、魔族の娘と恋に落ちたと……'), L('allen', '魔族にも、ぼくたちと同じように笑って、泣く人がいるんだ……')],
      choices: [
        { label: '二人を引き裂く', cat: 'fate', cost: 10, h: 10, sus: 2, fx: 'fate', run: s => { s.flags.lovers = 'split'; }, reply: [L('allen', '……彼女が、ぼくの仲間を襲った? うそだ……いや、やっぱり魔族は敵なんだ……!')] },
        { label: '見守る', cat: 'none', sus: 6, run: s => { s.flags.lovers = 'love'; s.peaceProg += 0.5; }, reply: [L('allen', 'いつか、人族と魔族が手を取りあえる日が来るのかな……'), L('nox', '……和平の気配がします。お気をつけを。')] },
        { label: '娘を魔族に殺させる', cat: 'whisper', cost: 10, h: 20, d: 10, sus: 8, fx: 'dark', run: s => { s.flags.lovers = 'dead'; }, reply: [L('allen', '……ゆるさない。魔族は、ぼくが全員倒す!'), L('goddess_dark', '憎しみは、戦いを長くするわ。')] }
      ]
    },
    {
      id: 'godless', when: s => s.sus >= 35, weight: 2, img: 'ev_vortex',
      lines: [L('nox', '人族の街で「神なき者たち」という集まりが広がっています。「女神など信じるな」と……')],
      choices: [
        { label: '神罰を下す', cat: 'fate', cost: 20, sus: 4, faith: 10, fx: 'storm', reply: [L('nox', '天の雷が集会所を焼きました。人々は震え上がり、ふたたび祈りはじめました。')] },
        { label: '奇跡を見せて信仰を取りもどす', cat: 'miracle', cost: 20, sus: -8, fx: 'light', reply: [L('serena', 'ごらんなさい! 女神さまの光です! 疑ってはなりません!')] },
        { label: '放っておく', cat: 'none', sus: 5, run: s => { s.thanks -= 3; }, reply: [L('nox', '祈る人が、少しずつ減っています……')] }
      ]
    },
    {
      id: 'stalemate', when: s => Math.abs(s.f) < 20, weight: 1.5, img: 'ev_burning_fortress',
      lines: [L('nox', '両軍がにらみ合ったまま、動きません。戦いが起きなければ、祈りも弱まります。')],
      choices: [
        { label: '運命の糸を引き、両軍を激突させる', cat: 'fate', cost: 10, sus: 1, fx: 'fate', run: s => { s.clashBonus = 1; }, reply: [L('allen', '魔族が来るぞ! 迎え撃て!'), L('volg', '人族が出てきやがった! 叩きつぶせ!')] },
        { label: '偽りの予言で人族を攻めさせる', cat: 'fate', cost: 10, f: 12, sus: 2, fx: 'fate', reply: [L('serena', '「今こそ攻めよ。勝利は約束されている」……神託です!')] },
        { label: '何もしない', cat: 'none', reply: [L('nox', '静かな月になりそうです。')] }
      ]
    },
    {
      id: 'plague', when: s => s.month > 4, weight: 1, img: 'ev_vortex',
      lines: [L('nox', '魔族の陣営で、疫病が広がっています。')],
      choices: [
        { label: '疫病をさらに広げる', cat: 'fate', cost: 10, d: -25, sus: 3, fx: 'storm', reply: [L('zephyra', '兵たちが次々に倒れていく……なぜ魔族ばかりが……!')] },
        { label: '魔族をひそかに癒す', cat: 'whisper', cost: 15, d: 15, sus: 6, fx: 'dark', reply: [L('zephyra', '病が消えた……? だれかが、魔族を守っている……?')] },
        { label: '人族にも広げる', cat: 'fate', cost: 5, h: -15, d: -15, faith: 12, sus: 2, fx: 'storm', reply: [L('gran', '疫病が人族の街にも……! 女神さま、お救いください!')] }
      ]
    },
    {
      id: 'duel', when: s => s.alive.allen && s.month >= 5, weight: 1.3, img: 'ev_burning_fortress',
      lines: [L('nox', '勇者アレンが、魔将ヴォルグと一騎打ちをはじめました!'), L('volg', '勇者よ、ここで死ね!'), L('allen', 'ぼくは負けない! 女神さまのために!')],
      choices: [
        { label: '勇者に勝たせる', cat: 'miracle', cost: 15, h: 20, d: -10, fx: 'light', reply: [L('allen', 'はああっ! ……やった、ヴォルグを退けたぞ!'), L('volg', 'ぐっ……覚えていろ、勇者!')] },
        { label: '魔将に勝たせる', cat: 'whisper', cost: 15, d: 20, h: -10, sus: 5, fx: 'dark', reply: [L('volg', 'どうした勇者、その程度か!'), L('allen', 'ぐあっ……! まだだ……!')] },
        { label: '見守る', cat: 'none', run: s => { if (Math.random() < 0.5) { s.h += 10; } else { s.d += 10; } }, reply: [L('nox', '一騎打ちは、ひきわけに終わったようです。')] }
      ]
    },
    {
      id: 'leave', when: s => s.month >= 7 && !s.flags.leave, once: true, weight: 2, img: 'scene_peace',
      lines: [L('elder', 'エルフとドワーフは、もう人族の戦争にはつきあえぬ。我らは森と山に帰らせてもらう。')],
      choices: [
        { label: '神託で引きとめる', cat: 'miracle', cost: 15, h: 10, fx: 'light', run: s => { s.flags.leave = 'stay'; }, reply: [L('elder', '……女神のお告げとあらば、しかたあるまい。もう少しだけ戦おう。')] },
        { label: '帰らせる', cat: 'none', h: -25, run: s => { s.flags.leave = 'gone'; }, reply: [L('gran', 'エルフとドワーフが去っていく……人族の軍は半分になってしまった。')] },
        { label: '魔族の味方にさせる', cat: 'whisper', cost: 15, h: -20, d: 20, sus: 8, fx: 'dark', run: s => { s.flags.leave = 'betray'; }, reply: [L('elder', '人族は我らを使いすてにしてきた……ならば魔族と手を組もう。'), L('allen', 'エルフたちが……裏切った!?')] }
      ]
    },
    {
      id: 'poor_faith', when: s => s.faith < 20, weight: 4, img: 'ev_pillar',
      lines: [L('nox', '女神さま、祈りが足りません。このままでは何もできなくなります。')],
      choices: [
        { label: '魔族に人族の村を襲わせる', cat: 'whisper', cost: 0, d: 15, f: -8, faith: 22, sus: 5, fx: 'dark', reply: [L('gran', '村が焼かれた……! 女神さま、お救いください!'), L('nox', '恐怖は、何よりも強い祈りを生みます。')] },
        { label: '小さな奇跡を見せる', cat: 'miracle', cost: 5, faith: 15, fx: 'light', reply: [L('serena', '神殿の像が光った……! 女神さまはここにおられる!')] },
        { label: 'がまんする', cat: 'none', faith: 5, reply: [L('nox', '……祈りが戻るのを待ちましょう。')] }
      ]
    }
  ];

  // 神殺しの同盟ができたあとの出来事
  G.REVOLT_EVENTS = [
    {
      id: 'rv_alliance', lines: [L('allen', '女神アステリア。ぼくたちは、すべてを知った。'), L('zephyra', '魔族を生んだのも、私に力を与えたのも、お前だったのだな。'), L('allen', '人族と魔族は、もう戦わない。お前を討つ!')],
      choices: [
        { label: '神罰で勇者を討つ', cat: 'fate', cost: 40, sus: 0, fx: 'storm', run: s => { s.revolt -= 40; s.alive.allen = false; }, reply: [L('allen', 'ぐあああっ……! ゼフィラ……あとは、たのむ……'), L('zephyra', 'アレン!! ……女神、お前だけは許さない!')] },
        { label: '世界中の記憶を書きかえる', cat: 'fate', cost: 60, fx: 'fate', run: s => { s.revolt = -999; }, reply: [L('goddess_dark', '忘れなさい。すべてを。'), L('allen', '……あれ、ぼくは魔王と何を……? 魔族め、離れろ!'), L('zephyra', '人族の勇者……? 貴様、なぜここにいる!')] },
        { label: '受けて立つ', cat: 'none', run: s => { s.revolt += 15; }, reply: [L('goddess_dark', 'いいわ、愛しい子どもたち。私のところまで、のぼっておいで。')] }
      ]
    }
  ];

  // 疑念で進む物語(選択肢のない場面)
  G.BEATS = [
    { at: 25, title: '魔王の紋章', img: 'ev_cursed_castle', lines: [L('narr', '戦場で魔王と剣を交えた騎士が、魔王の額に「光の輪」の紋章を見た。それは女神の神殿にきざまれているものと、まったく同じ形だった。'), L('nox', '女神さま……見られてしまいました。'), L('goddess_dark', 'ふふ。騎士ひとりの見まちがいよ。だれも信じないわ。')] },
    { at: 50, title: '女神の痕跡', img: 'ev_altar', lines: [L('narr', '人族の学者が、魔族の祭壇から古い祈りの書を見つけた。そこには女神への祈りと、まったく同じ言葉が書かれていた。'), L('serena', '魔族の神と女神さまは……同じなのではありませんか……?'), L('goddess_dark', '少し、やりすぎたかしら。')] },
    { at: 75, title: '勇者と魔王の疑い', img: 'ev_burning_fortress', lines: [L('narr', '戦場で向かい合った勇者と魔王は、剣を下ろした。'), L('allen', 'ゼフィラ……君も、あの声を聞いたことがあるのか?'), L('zephyra', '……夢の中で、何度も。「戦いなさい」と。'), L('allen', 'ぼくもだ。ぼくたちは……だれのために戦っているんだ?')] },
    { at: 100, title: '真実の露見', img: 'goddess_dark', revolt: true, lines: [L('narr', 'ついに真実が明らかになった。魔族を生んだのも、魔王に力を与えたのも、人族に奇跡を与えたのも、すべて女神だった。'), L('allen', '女神アステリア! ぼくたちは、もうお前のあやつり人形じゃない!'), L('zephyra', '人族と魔族は手を結ぶ。「神殺しの同盟」だ。'), L('goddess_dark', '……気づいてしまったのね。いいわ。私に剣を向けてごらんなさい。')] }
  ];
})(globalThis.G2 = globalThis.G2 || {});
