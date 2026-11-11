/**
 * 英語の辞書: puzzle の受け持ち(reports/i18n-20261111/移し方.md)。
 * 詰めトッタリー・称号・熟練度・タイトルのデータ管理。
 *
 * 表に無い言葉の決め(訳語の表.md に足していないもの):
 *   通常の(王ではない) → regular / 王の10 → King 10 / 伏せ札X → face-down card X
 *   入れ替え(A) → swap / 王位継承 → succession / 採用 → in the (starting) formation
 *   段(熟練度) → tier / 極み → Mastered / 点 → pts / 護衛 → guard
 *   初級・中級・応用 → Beginner / Intermediate / Advanced
 *   称号の名前は直訳せず、英語の称号らしい名前にした(軌跡の追跡者 → Trail Tracker など)
 */
export const EN_PUZZLE = {
  // ---- tsume-questions.js ----
  "初級":
    "Beginner",
  "中級":
    "Intermediate",
  "応用":
    "Advanced",
  "伏せ札の推理":
    "Face-down deduction",
  "破線は観測した移動。図はXと経路のみ。各移動の間に入れ替え・王位継承はありません。":
    "Dashed lines are observed moves. Only X and its path are shown. No swaps or successions happened between moves.",
  "相手の王は別の8だと公開情報で確認できています。":
    "Public info confirms your opponent's King is a separate card, an 8. ",
  "伏せ札Xが{from}から{to}へ1回で移動し、途中と着地点の{a}・{b}にいた自分の通常駒をまとめて取りました。Xの数字と王かどうかを答えてください。":
    "Face-down card X moved {from}→{to} in one move, taking your regular pieces on {a} and {b} along the way and on its landing square. Name X's rank and whether it's the King.",
  "{rank}（王かは不明）":
    "{rank} (King unknown)",
  "王の{rank}":
    "King {rank}",
  "JかQ":
    "J or Q",
  "王の{rank}です。":
    "King {rank}.",
  "進む方向・出発点からの距離の偶奇・途中の敵を取り続けた事実を合わせます。":
    "Combine the direction, whether each distance from the start is even or odd, and the fact that it kept taking enemies along the way.",
  "図は移動前。破線の1回の移動で、示された自分の通常駒2枚が撃破されました。ほかの経路は空きマスです。":
    "Shown before the move. In one dashed move, the 2 regular pieces of yours shown were defeated. The rest of the path was empty.",
  "王を取って決着":
    "Take the King",
  "{at}の王の{rank}を動かし、この一手で相手の王を取って勝ってください。":
    "Move the King {rank} on {at} and take your opponent's King this move to win.",
  "{at}の{rank}を動かし、この一手で相手の王を取って勝ってください。":
    "Move the {rank} on {at} and take your opponent's King this move to win.",
  "{from} → {to}。相手の王を取り、あなたの勝利。":
    "{from} → {to}. Take your opponent's King and win.",
  "あなたのターン。両軍の札を見せた練習用の途中局面です。図にある駒だけが残っています。":
    "Your turn. A practice position with both sides' cards shown. Only the pieces on the board remain.",
  "跳んだ札は一種類とは限らない":
    "A jump can mean more than one card",
  "伏せ札Xがc2→d4へ1回の通常移動で跳びました。Aの入れ替えではありません。数字の候補をすべて選んでください。":
    "Face-down card X jumped c2→d4 in one regular move. It wasn't an A's swap. Choose all possible ranks.",
  "10だけ":
    "Only 10",
  "Kだけ":
    "Only K",
  "10かK":
    "10 or K",
  "J・Q・K":
    "J, Q, or K",
  "10またはK。王かどうかまでは確定しません。":
    "10 or K. Whether it's the King is still unknown.",
  "同じ跳び方を持つ駒が二種類あります。":
    "Two kinds of pieces share this jump.",
  "10とKはどちらも縦2・横1へ跳べます。Kは必ず王ですが、10には通常駒と王の両方があるため、Xが王とはまだ断定できません。":
    "Both 10 and K can jump 2 squares vertically and 1 horizontally. A K is always the King, but a 10 can be either a regular piece or the King, so you can't yet say X is the King.",
  "縦の長距離、その後に斜め一歩":
    "Long vertical move, then one step diagonally",
  "同じ伏せ札Xが別々のターンでc1→c4、続いてc4→d5へ動きました。両方を満たす候補はどれですか？":
    "The same face-down card X moved c1→c4, then c4→d5 on a later turn. Which candidates fit both moves?",
  "通常のJか通常のQ":
    "Regular J or regular Q",
  "王のJかK":
    "King J or K",
  "王の2か王の4":
    "King 2 or King 4",
  "王のJ、またはK。Xが王であることは確定します。":
    "King J or K. X is definitely the King.",
  "縦3マスと斜め1マスを同じ駒が動いています。":
    "The same piece moved 3 squares vertically and 1 square diagonally.",
  "Jは王のときだけ斜め1マスが加わります。王のQは縦1マスまでなので縦3マスを説明できません。残る王のJとKは、どちらも王です。":
    "A J gains a 1-square diagonal move only as the King. A King Q moves just 1 square vertically, so it can't explain the 3-square move. The remaining King J and K are both Kings.",
  "長い対角線、その後に縦一歩":
    "Long diagonal, then one step vertically",
  "同じ伏せ札Xが別々のターンでa1→d4、続いてd4→d5へ動きました。数字と王の候補を選んでください。":
    "The same face-down card X moved a1→d4, then d4→d5 on a later turn. Choose the candidates for its rank and King status.",
  "通常のQだけ":
    "Only a regular Q",
  "王のQかK":
    "King Q or K",
  "王の3か王の5":
    "King 3 or King 5",
  "王のQ、またはK。Xが王であることは確定します。":
    "King Q or K. X is definitely the King.",
  "通常のQに、王になると加わる動きを思い出しましょう。":
    "Remember the move a Q gains when it's the King.",
  "斜め3マスと縦1マスの両方を持つのは王のQとKです。王のJの斜め移動は1マスまでなので除外できます。":
    "Only the King Q and K can move both 3 squares diagonally and 1 square vertically. A King J's diagonal move is limited to 1 square, so it's ruled out.",
  "跳躍のあとに長い横移動":
    "A jump, then a long sideways move",
  "伏せ札Xがc2→d4へ跳び、別のターンでd4→b4へ横に2マス動きました。Xの正体は？":
    "Face-down card X jumped c2→d4, then moved 2 squares sideways d4→b4 on a later turn. What is X?",
  "通常の10":
    "Regular 10",
  "王の10":
    "King 10",
  "王のJ":
    "King J",
  "Kです。したがってXは相手の王です。":
    "It's a K, so X is your opponent's King.",
  "最初の跳躍で二択にし、次の移動で一つに絞ります。":
    "The jump narrows it to two; the next move picks one.",
  "最初は10かKです。10は王でも横2マスへ直接移動できません。横移動もできるKだけが残り、Kは王としてしか採用できません。":
    "The jump means 10 or K. A 10 can't move 2 squares sideways, even as the King. Only the K, which can also move sideways, remains—and a K can only be used as the King.",
  "見えている王が候補を減らす":
    "A known King narrows the field",
  "別の伏せ札Xがc2→d4へ跳びました。Xの正体は？":
    "Another face-down card X jumped c2→d4. What is X?",
  "王ではない10です。":
    "A 10 that isn't the King.",
  "一つの軍に王は一枚です。":
    "Each army has only one King.",
  "跳躍だけなら10かKですが、王は別の8と分かっています。Kは王以外では採用できず、Xも王ではないので、通常の10に確定します。":
    "The jump alone means 10 or K, but the King is known to be the 8. A K can only be used as the King, and X isn't the King, so X must be a regular 10.",
  "縦の偶数と奇数を両方見た":
    "Even and odd orthogonal moves",
  "Xがc1→c3へ2マス、別のターンでc3→f3へ3マス動きました。Xは何ですか？":
    "X moved 2 squares c1→c3, then 3 squares c3→f3 on a later turn. What is X?",
  "王ではないJです。":
    "A J that isn't the King.",
  "2マスと3マスの両方に届く必要があります。":
    "It has to reach both 2 and 3 squares.",
  "通常4は2マスまで、6は偶数、8は奇数だけです。王が8なので4の射程拡張もありません。縦横の2マスと3マスを両方動ける通常Jに絞れます。":
    "A regular 4 moves up to 2 squares, a 6 only even distances, and an 8 only odd ones. The King is the 8, so the 4 gets no range boost either. Only a regular J can move both 2 and 3 squares orthogonally.",
  "対角線の偶数と奇数を両方見た":
    "Even and odd diagonal moves",
  "Xがa1→c3へ斜め2マス、別のターンでc3→f6へ斜め3マス動きました。Xは何ですか？":
    "X moved 2 squares diagonally a1→c3, then 3 squares diagonally c3→f6 on a later turn. What is X?",
  "王ではないQです。":
    "A Q that isn't the King.",
  "一方の移動だけなら複数の候補が残ります。":
    "Either move alone leaves several candidates.",
  "通常5は2マスまで、7は偶数、9は奇数だけです。王が8なので5の射程拡張もありません。両方の距離を満たす通常Qが残ります。":
    "A regular 5 moves up to 2 squares, a 7 only even distances, and a 9 only odd ones. The King is the 8, so the 5 gets no range boost either. Only a regular Q fits both distances.",
  "縦二マスでは、まだ三択":
    "Two squares vertically: still three options",
  "別の伏せ札Xがc1→c3へ縦2マス動きました。残る候補をすべて選んでください。":
    "Another face-down card X moved 2 squares vertically c1→c3. Choose all remaining candidates.",
  "4だけ":
    "Only 4",
  "4・6・J":
    "4, 6, or J",
  "2・4・6・8・J":
    "2, 4, 6, 8, or J",
  "6・8":
    "6 or 8",
  "通常の4・6・Jの三択です。":
    "Three options: a regular 4, 6, or J.",
  "動いた距離から外せる札と、まだ外せない札を分けます。":
    "Separate the cards this distance rules out from the ones it doesn't.",
  "Xは王ではありません。通常2は1マスまで、8は奇数マスだけです。4・6・Jはいずれも縦2マスを動けるため、この履歴だけでは一枚に絞れません。":
    "X isn't the King. A regular 2 moves only 1 square, and an 8 only odd distances. A 4, 6, and J can all move 2 squares vertically, so this history alone can't narrow it to one card.",
  "斜め二マスでは、まだ三択":
    "Two squares diagonally: still three options",
  "別の伏せ札Xがa1→c3へ斜め2マス動きました。残る候補をすべて選んでください。":
    "Another face-down card X moved 2 squares diagonally a1→c3. Choose all remaining candidates.",
  "5・7・Q":
    "5, 7, or Q",
  "3・5・7・9・Q":
    "3, 5, 7, 9, or Q",
  "7だけ":
    "Only 7",
  "Qだけ":
    "Only Q",
  "通常の5・7・Qの三択です。":
    "Three options: a regular 5, 7, or Q.",
  "通常の3と9は、この距離へ着地できますか？":
    "Can a regular 3 or 9 land at this distance?",
  "通常3は斜め1マス、9は斜めの奇数マスだけです。通常5・7・Qはどれも斜め2マスを動けるので、候補として残ります。":
    "A regular 3 moves 1 square diagonally, and a 9 only odd diagonal distances. A regular 5, 7, and Q can all move 2 squares diagonally, so they remain.",
  "手札と捨て札で最後の二択を消す":
    "Hand and discards settle the last two",
  "Jは4枚とも確認済みで、自分の手札に2枚、公開された捨て札に2枚あります。Xがa2→d2へ横3マス動きました。Xは何ですか？":
    "All four Js are accounted for: 2 in your hand and 2 in the public discards. X moved 3 squares sideways a2→d2. What is X?",
  "王ではない8です。":
    "An 8 that isn't the King.",
  "トランプには同じ数字が4枚しかありません。":
    "A deck has only four cards of each rank.",
  "王が別の8なので、横3マスの候補は通常8かJです。J全4枚の所在を確認できているため、伏せ札XはJではありません。通常8に確定します。":
    "Since the King is another 8, a 3-square sideways move means a regular 8 or a J. All four Js are accounted for, so X isn't a J. It must be a regular 8.",
  "対角線にも枚数の推理を使う":
    "Card counting works on diagonals too",
  "Qは4枚とも確認済みで、自分の手札に2枚、公開された捨て札に2枚あります。Xがa1→d4へ斜め3マス動きました。Xは何ですか？":
    "All four Qs are accounted for: 2 in your hand and 2 in the public discards. X moved 3 squares diagonally a1→d4. What is X?",
  "王ではない9です。":
    "A 9 that isn't the King.",
  "移動の候補を出してから、確認済みの4枚を使います。":
    "List the candidates for the move, then use the four known cards.",
  "王が8なので通常5に射程拡張はありません。斜め3マスの候補は通常9かQ。Q全4枚の所在が分かっているため、9だけが残ります。":
    "The King is the 8, so a regular 5 gets no range boost. A 3-square diagonal move means a regular 9 or a Q. All four Qs are accounted for, so only the 9 remains.",
  "縦の二枚抜きから王を読む":
    "Reading the King from a vertical double take",
  "c3とc5は出発点から縦2マス・4マスです。通常6は最初の敵で止まります。偶数マスの敵を取りながら進んだので、まとめ取りの能力を持つ王の6に確定します。":
    "c3 and c5 are 2 and 4 squares from the start. A regular 6 stops at the first enemy. Since it kept going while taking enemies at even distances, it must be the King 6, which can take several pieces in one move.",
  "対角線の二枚抜きから王を読む":
    "Reading the King from a diagonal double take",
  "c3とe5は斜め2マス・4マスです。通常7やQは最初の敵を越えられません。偶数間隔の敵を連続で取れる王の7だけが、この結果を説明できます。":
    "c3 and e5 are 2 and 4 squares away diagonally. A regular 7 or Q can't get past the first enemy. Only the King 7, which takes enemies at even distances in a row, explains this result.",
  "奇数の縦列が残した証拠":
    "Evidence from an odd-distance file",
  "b2とb4は出発点から1マス・3マスです。奇数の着地点を使い、途中の敵も取りながら進めるのは王の8です。通常8はb2の敵を取ったところで止まります。":
    "b2 and b4 are 1 and 3 squares from the start. Only the King 8 lands on odd distances and keeps taking enemies along the way. A regular 8 would stop after taking the piece on b2.",
  "奇数の対角線が残した証拠":
    "Evidence from an odd-distance diagonal",
  "b2とd4は斜め1マス・3マスです。通常9は手前の敵で止まり、王の7は偶数マスが対象です。両方を取ってd4へ進めたので、王の9と分かります。":
    "b2 and d4 are 1 and 3 squares away diagonally. A regular 9 stops at the nearer enemy, and the King 7 works on even distances. Since it took both and reached d4, it's the King 9.",
  "ターンが渡らない二連跳躍":
    "Two jumps without passing the turn",
  "伏せ札Xがb1→c3、続いてc3→d5へ跳びました。相手の同じ1ターンの中で、同じXが2回動いています。Aの入れ替えではありません。Xの正体は？":
    "Face-down card X jumped b1→c3, then c3→d5. The same X moved twice within a single opponent turn. It wasn't an A's swap. What is X?",
  "王のA":
    "King A",
  "王の10です。":
    "The King 10.",
  "跳び方だけでなく、ターンが交代しなかったことが決め手です。":
    "It's not just the jump—the key is that the turn never passed.",
  "10とKはどちらも跳べますが、同じターンに2回移動できるのは王の10だけです。王のAの追加行動は入れ替えで、通常移動ではありません。":
    "Both 10 and K can jump, but only the King 10 can move twice in one turn. The King A's extra action is a swap, not a regular move.",
  "長い4が、消えた採用札を教える":
    "A long-range 4 reveals the starting formation",
  "相手の王は別の4だと確認済みです。J全4枚は自分の手札2枚と公開捨て札2枚にあります。Xがa1→a8へ7マス、別のターンでa8→c8へ2マス動きました。Xの数字と、最初に採用された4の最低枚数は？":
    "Your opponent's King is confirmed to be a separate card, a 4. All four Js are accounted for: 2 in your hand and 2 in the public discards. X moved 7 squares a1→a8, then 2 squares a8→c8 on a later turn. What is X, and what's the fewest 4s the starting formation could have had?",
  "通常4・最低2枚":
    "Regular 4, at least 2",
  "通常4・最低3枚":
    "Regular 4, at least 3",
  "王の2・最低3枚":
    "King 2, at least 3",
  "通常J・採用数不明":
    "Regular J, count unknown",
  "Xは通常の4。相手は最初に4を少なくとも3枚採用しています。":
    "X is a regular 4. Your opponent started with at least three 4s in their formation.",
  "王以外の4の射程は「2＋採用した4の枚数×2」です。":
    "A non-King 4's range is \"2 + 2 × the number of 4s in the formation.\"",
  "横2マスと縦7マスを両方動ける通常駒は、射程の伸びた4かJです。Jは全4枚を確認済みなので除外できます。4が7マス先へ届くには2＋2×採用数が7以上、つまり最低3枚です。今の盤上に3枚残っているとは限りません。":
    "A regular piece that can move both 2 squares sideways and 7 vertically is a range-boosted 4 or a J. All four Js are accounted for, so it's not a J. For a 4 to reach 7 squares, 2 + 2 × the count must be at least 7—so at least 3. That doesn't mean 3 are still on the board.",
  "長い5も、最初の布陣を語る":
    "A long-range 5 tells of the starting formation",
  "相手の王は別の5だと確認済みです。Q全4枚は自分の手札2枚と公開捨て札2枚にあります。Xがa1→h8へ斜め7マス、別のターンでh8→f6へ斜め2マス動きました。Xの数字と、最初に採用された5の最低枚数は？":
    "Your opponent's King is confirmed to be a separate card, a 5. All four Qs are accounted for: 2 in your hand and 2 in the public discards. X moved 7 squares diagonally a1→h8, then 2 squares diagonally h8→f6 on a later turn. What is X, and what's the fewest 5s the starting formation could have had?",
  "通常5・最低3枚":
    "Regular 5, at least 3",
  "通常5・最低2枚":
    "Regular 5, at least 2",
  "王の3・最低3枚":
    "King 3, at least 3",
  "通常Q・採用数不明":
    "Regular Q, count unknown",
  "Xは通常の5。相手は最初に5を少なくとも3枚採用しています。":
    "X is a regular 5. Your opponent started with at least three 5s in their formation.",
  "採用枚数で伸びるのは、王自身ではなく王以外の5です。":
    "The formation count boosts the non-King 5s, not the King itself.",
  "斜め7マスと2マスの両方を動ける候補は、射程が伸びた5かQです。Qを全4枚確認済みなので5に確定。2＋2×採用数が7以上になるには、最初の採用数が最低3枚必要です。":
    "A piece that can move both 7 and 2 squares diagonally is a range-boosted 5 or a Q. All four Qs are accounted for, so it's a 5. For 2 + 2 × the count to reach 7, the formation needed at least 3.",
  "数字が三択でも、王は確定する":
    "Three possible ranks, but definitely the King",
  "伏せ札Xが別々のターンでc2→c3へ縦1マス、続いてc3→d4へ斜め1マス動きました。確実に言えることはどれですか？":
    "On separate turns, face-down card X moved 1 square vertically c2→c3, then 1 square diagonally c3→d4. What can you say for certain?",
  "Kに確定する":
    "It must be a K",
  "王のJ・王のQ・Kのいずれか":
    "King J, King Q, or K",
  "王かどうかも分からない":
    "Can't even tell if it's the King",
  "数字はJ・Q・Kの三択ですが、Xが王であることは確定します。":
    "The rank could be J, Q, or K, but X is definitely the King.",
  "方向が違う二つの移動を両立できるか確認しましょう。":
    "Check which pieces can make both moves in different directions.",
  "縦1マスと斜め1マスを両方動けるのは王のJ・王のQ・Kです。数字が一つに絞れなくても、残る候補がすべて王なら、王の位置は推理できます。":
    "Only the King J, King Q, and K can move both 1 square vertically and 1 diagonally. Even if you can't pin down the rank, when every candidate is the King, you know where the King is.",
  "二枚の伏せ札をつなげて読む":
    "Reading two face-down cards together",
  "同じ相手の伏せ札Xはc1→c4、別のターンでc4→d5へ移動。もう一枚の伏せ札Yはc2→b4へ跳びました。王位継承や入れ替えは起きていません。XとYについて確定することは？":
    "Your opponent's face-down card X moved c1→c4, then c4→d5 on a later turn. Another face-down card Y jumped c2→b4. No successions or swaps happened. What's certain about X and Y?",
  "Xが王、Yは通常の10":
    "X is the King, Y is a regular 10",
  "Yが王、Xは通常のJ":
    "Y is the King, X is a regular J",
  "XもYも王":
    "Both X and Y are Kings",
  "Xは必ずK、Yは王の10":
    "X must be a K, Y is the King 10",
  "Xが王（王のJかK）で、Yは王ではない10です。":
    "X is the King (King J or K), and Y is a 10 that isn't the King.",
  "二枚を別々に絞ったあと、一軍に王は一枚という条件を使います。":
    "Narrow each card down separately, then use the rule that each army has one King.",
  "Xは縦3マスと斜め1マスを動くので、王のJかKです。これで王の位置がXに確定します。Yの跳躍だけなら10かKですが、王はすでにXなのでKと王の10を除外でき、通常10に決まります。":
    "X moved 3 squares vertically and 1 diagonally, so it's a King J or K. That places the King at X. Y's jump alone means 10 or K, but the King is already X, so K and King 10 are out—Y is a regular 10.",
  "図はX・Yの現在位置と観測経路のみ。移動はそれぞれ別のターンに行われ、経路はその時点で空いていました。":
    "Only X and Y's current squares and observed paths are shown. Each move happened on a separate turn, and the paths were clear at the time.",
  "王のJで斜めに決める":
    "Finish diagonally with the King J",
  "王のJには斜め1マスの移動が加わります。c3からd4へ進んで相手のKを取り、勝利です。":
    "A King J can also move 1 square diagonally. Move from c3 to d4 to take your opponent's K and win.",
  "Jが王であることを使います。":
    "Use the fact that your J is the King.",
  "王のQで正面を突く":
    "Strike head-on with the King Q",
  "王のQには縦横1マスが加わります。正面のc4へ進んでKを取れば、その場で勝利します。":
    "A King Q can also move 1 square orthogonally. Step forward to c4 and take the K to win on the spot.",
  "対角線以外に、王のQだけが進める方向があります。":
    "Besides the diagonals, there's a direction only the King Q can move.",
  "五マス先へ届く小さな王":
    "A small King that reaches 5 squares",
  "最初に2を2枚採用しているため、王の2の射程は1＋2×2＝5マス。a2からf2のKを取り、勝利します。":
    "You started with two 2s, so your King 2's range is 1 + 2 × 2 = 5 squares. Take the K on f2 from a2 and win.",
  "王の2の射程は、最初に採用した2の枚数で決まります。":
    "A King 2's range depends on how many 2s were in your starting formation.",
  "自分の2は最初に2枚採用。あなたのターンで、両軍の札を見せた途中局面です。":
    "You started with two 2s. Your turn, in a position with both sides' cards shown.",
  "王が伸ばした仲間の一撃":
    "An ally's strike, boosted by the King",
  "王が4で、最初の採用も4が2枚。通常の4は2＋2×2＝6マス動けるので、a2からg2のKを取って勝利します。王自身は2マスのままです。":
    "Your King is a 4, and you started with two 4s. A regular 4 can move 2 + 2 × 2 = 6 squares, so take the K on g2 from a2 and win. The King itself stays at 2 squares.",
  "動かすのは王ではない4です。":
    "Move the 4 that isn't the King.",
  "自分の4は最初に2枚採用。あなたのターンで、両軍の札を見せた途中局面です。":
    "You started with two 4s. Your turn, in a position with both sides' cards shown.",
  "縦横の護衛を抜いて王まで":
    "Through the guards to the King, orthogonally",
  "王の6でa5からg5へ。偶数マス先のc5・e5の護衛を順に取り、最後にg5のKを取って勝利します。":
    "Move the King 6 from a5 to g5. It takes the guards on c5 and e5 at even distances in turn, then takes the K on g5 to win.",
  "手前の敵を取ったところで止まらず、王まで見通します。":
    "Don't stop at the first enemy—look all the way to the King.",
  "対角線の護衛を抜いて王まで":
    "Through the guards to the King, diagonally",
  "王の7でa1からg7へ。斜め2マス・4マス先の護衛を取り、6マス先のKを最後に撃破して勝利します。":
    "Move the King 7 from a1 to g7. It takes the guards 2 and 4 squares away diagonally, then defeats the K 6 squares away to win.",
  "斜めの偶数マスにいる3枚を、一度に取れます。":
    "You can take all three pieces at even diagonal distances at once.",
  "奇数の列を貫く王の8":
    "The King 8 pierces the odd squares",
  "王の8は奇数マス先の相手をまとめて取れます。1・3・5マス先のb5・d5・f5を順に取り、最後のKで勝利が決まります。":
    "The King 8 can take enemies at odd distances in one move. It takes b5, d5, and f5 at 1, 3, and 5 squares in turn, and the final K wins it.",
  "王までの距離を1・3・5と数えます。":
    "Count the distances to the King: 1, 3, 5.",
  "奇数の対角線を貫く王の9":
    "The King 9 pierces the odd diagonal",
  "王の9でa1からf6へ。斜め1・3・5マス先のb2・d4・f6をまとめて取り、最後にKを倒して勝利します。":
    "Move the King 9 from a1 to f6. It takes b2, d4, and f6 at 1, 3, and 5 squares diagonally, finishing with the K to win.",
  "偶数マスへは着地せず、奇数の対角線を使います。":
    "It never lands on even squares—use the odd diagonal.",
  "二段跳びの最後に王を取る":
    "Take the King with a double jump",
  "王の10でb1→c3と跳び、8を取ります。相手にターンを渡さず、追加行動でc3→d5へ跳んでKを取り、勝利です。":
    "Jump the King 10 b1→c3 to take the 8. Without passing the turn, use its extra action to jump c3→d5, take the K, and win.",
  "一回目の着地点を、二回目の出発点として考えます。":
    "Treat the first landing square as the start of the second jump.",
  "b1の王の10を使い、このターン中に相手の王を取って勝ってください。":
    "Use the King 10 on b1 to take your opponent's King this turn and win.",
  "b1 → c3 → d5。同じターンの二段跳びで王を取り、勝利。":
    "b1 → c3 → d5. Take the King with a double jump in one turn and win.",
  "Aの包囲で護衛も王も消す":
    "Surround the guards and the King with an A",
  "a1のAで入れ替えを使います。どの入れ替え結果でも相手の王を包囲撃破して勝てるよう、ほかの駒2枚を選んでください。":
    "Use the A on a1 to swap. Choose 2 other pieces so that every possible swap result surrounds and defeats your opponent's King for the win.",
  "e1の4とc5の5を選ぶ。護衛2枚とKを包囲撃破し、勝利。":
    "Choose the 4 on e1 and the 5 on c5. Surround and defeat both guards and the K to win.",
  "味方3枚で作る三角形に、相手の王を入れます。":
    "Trap your opponent's King inside a triangle of your 3 pieces.",
  "a1・e1・c5の三角形で、b2とd2の護衛、c3のKを囲めます。3枚が入れ替わっても三角形の頂点は同じです。6通りすべてで護衛を取った後にKを包囲撃破し、勝利が決まります。":
    "The a1–e1–c5 triangle surrounds the guards on b2 and d2 and the K on c3. However the 3 pieces swap, the triangle's corners stay the same. In all 6 outcomes, you take the guards and surround the K to win.",
  "あなたのターン。両軍の札を見せた途中局面です。入れ替え結果の運に頼らず、確実に勝てる選び方を考えます。":
    "Your turn, in a position with both sides' cards shown. Find the choice that wins for sure, without relying on the luck of the swap.",
  // ---- tsume-daily.js ----
  "朝5時になり、問題が更新されました。今日の問題に挑戦してください。":
    "It's past 5:00 AM JST, so the puzzle has changed. Try today's puzzle.",
  // ---- tsume.js ----
  "先に今日の問題への参加を保存してください。":
    "Save your entry for today's puzzle first.",
  "この回答では、まだクリアになりません。":
    "That answer doesn't clear the puzzle yet.",
  // ---- tsume.jsx ----
  "詰めトッタリー":
    "Take Down Puzzle",
  "一日一問 · 毎朝5時更新（日本時間）":
    "Daily puzzle · New every day at 5:00 AM JST",
  "参加 · エーテル50":
    "Join · 50 Ether",
  "クリア ·":
    "Clear ·",
  "{date} の一問":
    "Puzzle for {date}",
  "札の動きと王の力を読み、答えを見つけよう。":
    "Read the moves and King Powers to find the answer.",
  "保存中…":
    "Saving…",
  "挑戦する":
    "Take the challenge",
  "参加でエーテル50を受け取れます。":
    "Join to get 50 Ether.",
  "今日の問題は何度でも再挑戦できます。":
    "You can retry today's puzzle as many times as you like.",
  "やり直す":
    "Retry",
  "ホームに戻る":
    "Back to Home",
  "もう一度、移動と公開情報を確認してみましょう。":
    "Check the moves and public info again.",
  "正解です！":
    "Correct!",
  "その操作はできません。選ぶ駒とマスを確認してください。":
    "You can't do that. Check the piece and square you chose.",
  "相手の王を撃破。あなたの勝利です！":
    "You took your opponent's King. You win!",
  "今回は王を取れましたが、別の入れ替え結果では勝てません。どの配置でも包囲できる2枚を探しましょう。":
    "You took the King this time, but other swap results wouldn't win. Find 2 pieces that surround it in every arrangement.",
  "このターンでは王を取れませんでした。やり直して、別の手を探しましょう。":
    "You couldn't take the King this turn. Retry and look for another move.",
  "王の10は、続けてもう一度動けます。王を狙いましょう。":
    "The King 10 can move again. Go for the King.",
  "自分の駒を選んでから、行き先を押してください。":
    "Choose your piece first, then tap where it goes.",
  "今日の一問 ·":
    "Today's puzzle ·",
  "本日クリア済み · 報酬受取済み":
    "Cleared today · Reward claimed",
  "赤：自分":
    "Red: You",
  "青：相手":
    "Blue: Opponent",
  "王：王の駒":
    "King: King piece",
  "答えを選んでください":
    "Choose your answer",
  "回答する":
    "Submit",
  "選んだ2枚で入れ替えを実行できます。":
    "Ready to swap with the 2 pieces you chose.",
  "入れ替える駒をあと{n}枚選んでください。":
    "Pieces left to choose for the swap: {n}",
  "自分の駒 → 行き先の順に押してください。":
    "Tap your piece, then where it goes.",
  "この2枚で入れ替える":
    "Swap with these 2",
  "もう一度挑戦する":
    "Try again",
  "撃破：":
    "Defeated:",
  "（王）":
    " (King)",
  "クリア！":
    "Cleared!",
  "報酬を保存しています…":
    "Saving your reward…",
  "正解です。報酬の保存を再試行してください。":
    "Correct. Please retry saving your reward.",
  "· 本日の報酬受取済み":
    "· Today's reward claimed",
  "報酬の保存を再試行":
    "Retry saving reward",
  "ヒントを見る":
    "Show hint",
  "解説を閉じる":
    "Hide explanation",
  "答え・解説を見る":
    "Show answer & explanation",
  "答え":
    "Answer",
  "答えを確認したら、実際に解いてクリアしましょう。":
    "Now that you've seen the answer, solve it for real to clear.",
  "{size}×{size}の盤面":
    "{size}×{size} board",
  "自分":
    "You",
  "相手":
    "Opponent",
  "伏せ札{label}":
    "Face-down card {label}",
  "空きマス":
    "Empty",
  "王":
    "King",
  // ---- formation-honors.js ----
  "軌跡の追跡者":
    "Trail Tracker",
  "土":
    "Earth",
  "荒波の航海士":
    "Storm Navigator",
  "海":
    "Sea",
  "静寂な狩人":
    "Silent Hunter",
  "森":
    "Forest",
  "堅牢な要塞":
    "Iron Fortress",
  "氷":
    "Ice",
  "双翼の将":
    "Twin-Wing General",
  "空":
    "Sky",
  "覇道・天界":
    "Path of Conquest: Heaven",
  "宮殿":
    "Palace",
  "覇道・魔界":
    "Path of Conquest: Underworld",
  "{area}の布陣称号を獲得":
    "Earn the {area} formation Title",
  // ---- titles.js ----
  "10連がすべてRになる（累計{n}回目）":
    "Get all R in a 10-pull ({n} total)",
  "静寂の凪":
    "Dead Calm",
  "灰燼の蒐集者":
    "Ash Collector",
  "無銘の求道者":
    "Nameless Seeker",
  "常闇の徒":
    "Child of Endless Night",
  "虚無を統べる者":
    "Ruler of the Void",
  "無冠の帝王":
    "Uncrowned Emperor",
  "フリーズを引く（累計{n}回目）":
    "Pull a Freeze ({n} total)",
  "氷結の刻":
    "Hour of Frost",
  "永氷の使徒":
    "Apostle of Eternal Ice",
  "絶対零度":
    "Absolute Zero",
  "氷獄の支配者":
    "Master of the Ice Prison",
  "氷結界の主":
    "Lord of the Frozen Realm",
  "絶氷帝":
    "Glacial Emperor",
  "フォイルを引く（累計{n}回目）":
    "Pull a Foil ({n} total)",
  "輝きの黎明":
    "Dawn of Radiance",
  "金箔の求道者":
    "Gold Leaf Seeker",
  "黄金律":
    "Golden Rule",
  "光輝の覇者":
    "Radiant Conqueror",
  "燦然たる者":
    "The Resplendent",
  "黄金卿":
    "El Dorado",
  "SSRを引く（累計{n}回目）":
    "Pull an SSR ({n} total)",
  "至高との邂逅":
    "Brush with Greatness",
  "頂への渇望":
    "Thirst for the Summit",
  "高みの征服者":
    "Conqueror of Heights",
  "至高の狩人":
    "Supreme Hunter",
  "頂点捕食者":
    "Apex Predator",
  "至尊の覇王":
    "Sovereign Supreme",
  "ガチャを引く（累計{n}回）":
    "Pull from the Gacha ({n} total)",
  "召喚者":
    "Summoner",
  "門の開拓者":
    "Gate Pioneer",
  "召喚の求道者":
    "Summoning Seeker",
  "星辰の召喚士":
    "Star Summoner",
  "千召の覇者":
    "Master of a Thousand Summons",
  "万象の召喚士":
    "Summoner of All Things",
  "召喚の権化":
    "Summoning Incarnate",
  "深淵の召喚王":
    "Abyssal Summon King",
  "万召を統べる者":
    "Ruler of Ten Thousand Summons",
  "双星の奇跡":
    "Twin Star Miracle",
  "三星の煌めき":
    "Triple Star Gleam",
  "四星の伝説":
    "Four Star Legend",
  "1回の10連でSSRを{n}枚引く":
    "Pull {n} SSRs in a single 10-pull",
  "蒐集の煌めき":
    "Collector's Gleam",
  "箔を統べる者":
    "Ruler of Foil",
  "黄金聖域":
    "Golden Sanctuary",
  "フォイルを{n}種そろえる":
    "Collect {n} different Foils",
  "図鑑の開拓者":
    "Collection Pioneer",
  "英雄の蒐集者":
    "Hero Collector",
  "英雄譚の完成者":
    "Keeper of the Saga",
  "通常版カードを{n}種そろえる":
    "Collect {n} different standard cards",
  "千夜の魔導師":
    "Sorcerer of a Thousand Nights",
  "不滅の墓守":
    "Undying Gravekeeper",
  "黄昏の亡姫":
    "Twilight Wraith Princess",
  "黒潮の覇者":
    "Lord of the Black Tide",
  "紅帆の女帝":
    "Empress of the Crimson Sails",
  "翠風の狙撃手":
    "Emerald Wind Marksman",
  "銀月の狙撃姫":
    "Silver Moon Markswoman",
  "北海の覇王":
    "Overlord of the North Sea",
  "氷牙の戦姫":
    "Ice Fang Valkyrie",
  "天翔ける竜王":
    "Sky-Soaring Dragon King",
  "蒼天の天馬騎士":
    "Azure Pegasus Knight",
  "黎明の告使":
    "Herald of Dawn",
  "奸智の魔公":
    "Cunning Archduke",
  "慈光の癒使":
    "Healer of Gentle Light",
  "夜を統べる魔后":
    "Demon Queen of the Night",
  "熾天の大天使":
    "Seraphic Archangel",
  "奈落の堕天王":
    "Fallen King of the Abyss",
  "扉を拓く少女":
    "The Girl Who Opens Doors",
  "帰還の先導者":
    "Leader of the Way Home",
  "不屈の小さな使者":
    "Dauntless Little Messenger",
  "永遠の茶会の主":
    "Host of the Endless Tea Party",
  "奇想の茶会の客人":
    "Guest of the Mad Tea Party",
  "海辺の舞踏家":
    "Seaside Dancer",
  "涙のカドリール":
    "Quadrille of Tears",
  "時を駆ける案内人":
    "Guide Who Races Time",
  "迷いの森の賢者":
    "Sage of the Tangled Wood",
  "幻影の微笑み":
    "Phantom Smile",
  "紅心の近衛":
    "Guard of Hearts",
  "紅心の女帝":
    "Empress of Hearts",
  "紅心の君主":
    "Sovereign of Hearts",
  "{rank}のスキンを使って{n}点ためる":
    "Earn {n} pts with a {rank} skin",
  "十七英雄の主":
    "Lord of the Seventeen Heroes",
  "不思議の国の主":
    "Lord of Wonderland",
  "{series}の全{count}種類で{n}点ずつためる":
    "Earn {n} pts with each of the {count} {series} skins",
  "盤上無双":
    "Unrivaled on the Board",
  "ワンダーランド・マスター":
    "Wonderland Master",
  "見習い":
    "Apprentice",
  "最初から":
    "From the start",
  "初陣":
    "First Battle",
  "1局遊ぶ":
    "Play 1 match",
  "十戦の兵":
    "Veteran of Ten",
  "10局遊ぶ":
    "Play 10 matches",
  "五十戦の将":
    "General of Fifty",
  "50局遊ぶ":
    "Play 50 matches",
  "十勝の勇":
    "Ten-Win Hero",
  "10勝する":
    "Win 10 matches",
  "三十勝の猛者":
    "Thirty-Win Champion",
  "30勝する":
    "Win 30 matches",
  "腕試し":
    "Test of Skill",
  "オンラインで1局遊ぶ":
    "Play 1 online match",
  "氷のエリアで獲得":
    "Earned in the Ice Area",
  "空のエリアで獲得":
    "Earned in the Sky Area",
  "土のエリアで獲得":
    "Earned in the Earth Area",
  "森のエリアで獲得":
    "Earned in the Forest Area",
  "海のエリアで獲得":
    "Earned in the Sea Area",
  "覇道":
    "Path of Conquest",
  "宮殿のエリアで獲得":
    "Earned in the Palace Area",
  "国士無双":
    "Peerless",
  "シークレット「手札が絵札に偏りすぎて配り直された」":
    "Secret: \"Your hand was so full of face cards it got redealt\"",
  "常連":
    "Regular",
  "ミッション「3日あそぶ」":
    "Mission: \"Play on 3 days\"",
  "皆勤の士":
    "Perfect Attendance",
  "ミッション「30日あそぶ」":
    "Mission: \"Play on 30 days\"",
  "士の位":
    "Rank of Knight",
  "レート 1600":
    "Rating 1600",
  "将の位":
    "Rank of General",
  "レート 1800":
    "Rating 1800",
  "王の位":
    "Rank of King",
  "レート 2000":
    "Rating 2000",
  "{mission}\n（ミッション報酬を受け取る）":
    "{mission}\n(Claim the mission reward)",
  "獲得日の記録なし":
    "No earned date on record",
  "{date} に獲得":
    "Earned {date}",
  // ---- title-design.js ----
  "素朴":
    "Plain",
  "細い金属枠":
    "Thin metal frame",
  "彫金":
    "Engraved",
  "銀の彫刻・小さな宝石":
    "Silver engraving, small gems",
  "宝飾":
    "Jeweled",
  "二重の金縁・紋章・宝石":
    "Double gold rim, crest, gems",
  "荘厳":
    "Majestic",
  "翼状の彫刻・宝石の帯":
    "Wing carvings, band of gems",
  "絢爛":
    "Resplendent",
  "多重の装飾・大粒の宝石・後光":
    "Layered ornament, large gems, halo",
  "極煌":
    "Radiant",
  "冠飾り・放射状の翼・極光の縁":
    "Crown crest, radiant wings, aurora rim",
  // ---- card-mastery.jsx ----
  "未到達":
    "Not reached",
  "極み":
    "Mastered",
  "段{n}":
    "Tier {n}",
  "カード":
    "Cards",
  "熟練度を見るシリーズを選びます。所持スキンを装備して対局すると、そのスキンに点がたまります。":
    "Choose a series to view its Mastery. Equip a skin you own and play a match to earn points for that skin.",
  "スキンをまだ持っていません。ガチャやミッションでスキンを手に入れると、そのスキンの熟練度が解放されます。":
    "You don't have any skins yet. Get skins from the Gacha or Missions to unlock their Mastery.",
  "シリーズを選ぶ":
    "Choose a series",
  "所持 {have}/{total} · 合計 {points}点":
    "Owned {have}/{total} · Total {points} pts",
  "このシリーズの熟練度を見る":
    "View this series' Mastery",
  "シリーズ選択へ":
    "Back to series",
  "所持スキンを装備して対局すると、そのスキンに点がたまります。通常版とフォイル版は同じ熟練度です。 王に選ぶ +5、駒を出す +1(何体でも)、 王として動かす +1(1局3点まで)、王で相手の駒を取る +1(10点まで)、王で相手の王を討つ +10。 段に届くと称号が手に入ります。通常札では増えません。盤の有利不利には効きません。":
    "Equip a skin you own and play a match to earn points for that skin. Standard and Foil versions share Mastery. Chosen as King +5, each piece placed +1 (no limit), each King move +1 (up to 3 per match), each take by your King +1 (up to 10), taking the enemy King with your King +10. Reaching a tier earns a Title. Standard cards don't earn points. Mastery has no effect on the board.",
  "熟練度のまとめ":
    "Mastery summary",
  "解放したスキン":
    "Skins unlocked",
  "称号":
    "Titles",
  "合計":
    "Total",
  "点":
    " pts",
  "{series}シリーズの熟練度":
    "{series} series Mastery",
  "スキン":
    "Skin",
  "このスキンを手に入れると解放":
    "Unlocks when you get this skin",
  "{n}点":
    "{n} pts",
  "{n} / {next}点":
    "{n} / {next} pts",
  "{name} の熟練度":
    "{name} Mastery",
  "極み（{n}点）":
    "Mastered ({n} pts)",
  "{n}点。次の段まであと{left}点":
    "{n} pts. {left} pts to the next tier",
  "あと{n}点で称号「{name}」":
    "{n} pts to the Title \"{name}\"",
  "次の段まであと {n}":
    "{n} to the next tier",
  "これ以上は上がりません":
    "Maxed out",
  "通しの称号":
    "Series Titles",
  "{series}の全スキンを使い込むと":
    "Master every {series} skin to earn",
  "{step}に届いたスキン {has}/{total}":
    "Skins at {step}: {has}/{total}",
  "段の境目: {steps}点":
    "Tier thresholds: {steps} pts",
  // ---- mastery.jsx ----
  "スキンの熟練度":
    "Skin Mastery",
  "使ったスキンにたまる点":
    "Points earned by the skins you used",
  "極み · 累計{n}点":
    "Mastered · {n} pts total",
  "極みに到達":
    "Mastered!",
  "{name}に到達":
    "Reached {name}",
  "段{n}に到達":
    "Reached Tier {n}",
  "王に選んだ +{n}":
    "Chosen as King +{n}",
  "駒を出した +{n}":
    "Pieces placed +{n}",
  "王を動かした +{n}":
    "King moved +{n}",
  "王で取った +{n}":
    "Takes by King +{n}",
  "王を討った +{n}":
    "Took the King +{n}",
  "称号を手に入れました":
    "Title earned",
  // ---- formation-honor.jsx ----
  "布陣の称号と紋章アイコン":
    "Formation Title and emblem",
  "称号と紋章アイコンを獲得しました。設定から選べます。":
    "You earned a Title and emblem. Choose them in Settings.",
  "布陣の称号":
    "Formation Title",
  "布陣の称号獲得演出":
    "Formation Title award",
  "対局へ":
    "To the match",
  // ---- title-acquisition.jsx ----
  "新しい称号を獲得":
    "New Title earned",
  "称号「{name}」を手に入れた。":
    "You earned the Title \"{name}\". ",
  "{how}。":
    "{how}. ",
  "設定で、装備できる。":
    "Equip it in Settings.",
  "称号獲得":
    "Title earned",
  "あと{n}件":
    "{n} more",
  "次の獲得称号へ":
    "Next Title",
  "称号獲得の表示を閉じる":
    "Close Title award",
  // ---- title-data.jsx ----
  "(まだありません)":
    "(none yet)",
  "データ管理":
    "Data",
  "閉じる":
    "Close",
  "プレイヤーID":
    "Player ID",
  "写しました":
    "Copied",
  "写す":
    "Copy",
  "お問い合わせのときに教えてください。この番号から、あなたの記録を探せます。":
    "Share this when you contact us. We can use it to find your records.",
  "問い合わせ先":
    "Contact",
  "お問い合わせ":
    "Contact us",
  "未設定":
    "Not set",
  "プライバシーポリシー":
    "Privacy Policy",
  "開く":
    "Open",
  "ゲームの版":
    "Game version",
  "アカウント削除":
    "Delete account",
  "この端末の記録を消す":
    "Delete records on this device",
  "消す":
    "Delete",
  "名前・戦績・レートと、公開ランキングのあなたの行を消します。元には戻せません。":
    "Deletes your name, record, Rating, and your row in the public Rankings. This can't be undone.",
  "とじる":
    "Close",
  "この端末の記録を預けました。新しい端末では、同じ Apple ID でサインインしてください。":
    "Your records are saved. On your new device, sign in with the same Apple ID.",
  "設定できませんでした。":
    "Couldn't set this up.",
  "預かっていた記録を読めませんでした。お問い合わせください。":
    "We couldn't read your saved records. Please contact us.",
  "この Apple ID には、まだ記録が預けられていません。":
    "No records have been saved to this Apple ID yet.",
  "引き継ぎました。画面を読み込み直します。":
    "Transfer complete. Reloading…",
  "引き継げませんでした。":
    "Couldn't transfer your data.",
  "データ引き継ぎ":
    "Data transfer",
  "Apple ID にこの記録を結びつけます。新しい端末で同じ Apple ID からサインインすると、 名前・レベル・戦績・レート・持っているスキンとジェムを引き継げます。":
    "Link these records to your Apple ID. Sign in with the same Apple ID on a new device to bring over your name, Level, record, Rating, skins, and Gems.",
  "いまの状態":
    "Status",
  "Apple ID と結びつき済み":
    "Linked to Apple ID",
  "この端末だけ":
    "This device only",
  "最後に預けた日時":
    "Last saved",
  "まだ預けていません":
    "Not saved yet",
  "確認しています…":
    "Checking…",
  "引き継ぎの設定は、iPhone・iPad のアプリで行えます。":
    "You can set up data transfer in the iPhone or iPad app.",
  "預けています…":
    "Saving…",
  "いまの記録を預け直す":
    "Save current records again",
  "Apple ID で引き継ぎを設定する":
    "Set up data transfer with Apple ID",
  "引き継いでいます…":
    "Transferring…",
  "別の端末から引き継ぐ":
    "Transfer from another device",
  "引き継ぐと、この端末にいまある記録は、預けてあった記録で置き換わります。 ジェムとチケットの残高はサーバーの台帳が正なので、引き継いだあとにそろいます。":
    "Transferring replaces the records on this device with your saved records. Gem and ticket balances come from our server, so they'll sync after the transfer.",
};
