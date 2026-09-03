/**
 * どの配布ファイルから、どの曲を作るか。
 *
 * tools/prepare-bgm.mjs(音源を作る)と tools/bgm-seam.mjs(継ぎ目を測る)の
 * 両方が使う。片方だけ直すと食い違うので、表はここ1つに置いてある。
 *
 * 原曲は assets/audio/原曲/ に置く。重いので git には入れていない。
 * 下の「出どころ」から落とし直せる。
 *
 * cut は「終わりのフェードを切ってよい上限(全体に対する割合)」。
 * 曲によって終わり方が違うので、切りすぎないよう頭打ちにしてある。
 * fade はクロスフェードの秒数。長いほど繋ぎ目は目立たないが、
 * 拍のある曲は輪郭がぼやける。
 *
 * end を書くと、終わりを切るのではなく「そこで折り返す」(無音を落としたあとの秒数)。
 * 曲の終わりが頭と和音の合わない曲は、途中に戻ったほうが繋がる。
 * 位置は、頭の3秒と候補の3秒でクロマ(12音階に畳んだ音の分布)を比べて探した。
 */
export const PIECES = [
  {
    out: "title.m4a",
    src: "inishienohiseki.mp3",
    title: "古の碑石 / 甘茶の音楽工房",
    from: "https://amachamusic.chagasi.com/music_inishienohiseki.html",
    loop: true,
    cut: 0.15,
    fade: 5,
    // 終わり際(頭との和音の一致 0.84)より、ここ(0.97)のほうがよく繋がる。
    // 2分21秒 → 1分24秒と短くなるが、継ぎ目が聞こえないほうを取った
    end: 89.0,
  },
  {
    out: "waiting.m4a",
    src: "janegreynoshouzou.mp3",
    title: "ジェーン・グレイの肖像 / 甘茶の音楽工房",
    from: "https://amachamusic.chagasi.com/music_janegreynoshouzou.html",
    loop: true,
    cut: 0.15,
    fade: 4,
    // 終わり際は頭との和音の一致が 0.46 しかなく、5曲でいちばん悪かった。
    // ここなら 0.98。2:23 → 1:45
    end: 108.8,
  },
  {
    out: "setup.m4a",
    src: "fukaiyaminookude.mp3",
    title: "深い闇の奥で / 甘茶の音楽工房",
    from: "https://amachamusic.chagasi.com/music_fukaiyaminookude.html",
    loop: true,
    cut: 0.15,
    fade: 3,
    // 92.8秒にすると一致が 0.93 → 0.98 になるが、2:23 → 1:29 は削りすぎ。
    // 0.93 なら繋がるので、長さを取ってそのままにしてある
  },
  {
    out: "battle.m4a",
    src: "shatou.mp3",
    title: "斜塔 / 甘茶の音楽工房",
    from: "https://amachamusic.chagasi.com/music_shatou.html",
    loop: true,
    cut: 0.12,
    fade: 4,
    // 終わり際は 0.85。ここなら 1.00 で、長さもほとんど変わらない(3:56 → 3:43)
    end: 227.3,
  },
  {
    out: "endgame.m4a",
    src: "kiheisen.mp3",
    title: "騎兵戦 / 甘茶の音楽工房",
    from: "https://amachamusic.chagasi.com/music_kiheisen.html",
    loop: true,
    // 行進の曲は、長く重ねると拍がぼやける
    cut: 0.12,
    fade: 2,
  },
  {
    out: "win.m4a",
    src: "j01.m4a",
    title: "ジングル01 / 魔王魂",
    from: "https://maou.audio/game_jingle01/",
    loop: false,
  },
  {
    out: "lose.m4a",
    src: "j07.m4a",
    title: "ジングル07 / 魔王魂",
    from: "https://maou.audio/game_jingle07/",
    loop: false,
  },
];
