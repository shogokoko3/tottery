# 使っている第三者のソフトウェア

配布物(`index.html`)には React が含まれる。いずれも MIT ライセンスで、
配布のさいにライセンス表示を求めている。

| 名前 | 用途 | ライセンス |
| --- | --- | --- |
| React / React DOM | 画面の組み立て。**配布物に含まれる** | MIT |
| esbuild | 1枚の HTML にまとめる。開発時のみ | MIT |
| Babel (parser / traverse / generator / types) | ソースの分割。開発時のみ | MIT |
| Prettier | 書式を整える。開発時のみ | MIT |

## MIT ライセンス

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Copyright (c) Meta Platforms, Inc. and affiliates. (React)
Copyright (c) 2020 Evan Wallace (esbuild)
Copyright (c) 2014-present Sebastian McKenzie and other contributors (Babel)
Copyright (c) James Long and contributors (Prettier)

## 音について

配布物に第三者の音源が含まれる。**いずれも商用利用可**。
出どころは設定画面の「音」にも出している。

| ファイル | 曲名 | 出どころ | 表記 |
| --- | --- | --- | --- |
| `audio/title.m4a` | 古の碑石 | [甘茶の音楽工房](https://amachamusic.chagasi.com/) | 任意 |
| `audio/waiting.m4a` | ジェーン・グレイの肖像 | 甘茶の音楽工房 | 任意 |
| `audio/setup.m4a` | 深い闇の奥で | 甘茶の音楽工房 | 任意 |
| `audio/battle.m4a` | 斜塔 | 甘茶の音楽工房 | 任意 |
| `audio/endgame.m4a` | 騎兵戦 | 甘茶の音楽工房 | 任意 |
| `audio/win.m4a` | ジングル01 | [魔王魂](https://maou.audio/) | **必須** |
| `audio/lose.m4a` | ジングル07 | 魔王魂 | **必須** |
| `audio/se-place.m4a` | カードを台の上に出す | [効果音ラボ](https://soundeffect-lab.info/) | 不要 |
| `audio/se-capture.m4a` | 打撃1 | 効果音ラボ | 不要 |
| `audio/se-tick.m4a` | 時計の針1 | 効果音ラボ | 不要 |

**魔王魂だけは「音楽：魔王魂」の表記が規約で必須。**
設定画面の「出どころ」に出しているのがそれにあたる
([src/audio/tracks.js](src/audio/tracks.js) の `MUSIC_CREDIT`)。
魔王魂のジングルを外さないかぎり、この表示を消してはいけない。

いずれも配布のときに、無音を落とす・ループできるよう繋ぐ・音量を揃える、
という加工をしている(`tools/prepare-bgm.mjs` と `tools/prepare-se.mjs`)。
どのサイトも改変を禁じていない。

3サイトに共通する禁止事項は、**音源そのものの再配布・単独販売**と、
**自分が作ったと偽ること**。ゲームの中で鳴らすぶんには問題ない
(効果音ラボは「ゲームやアプリの操作音として内蔵するのは再配布に当たらない」と明記)。
音源ファイルを取り出して配ったり、音だけを売ったりはできない。

## カードの絵柄について

**カードの絵柄**(`assets/cards/*.webp`)は ChatGPT(OpenAI)の画像生成で
作ったもの。OpenAI の規約により商用利用できる。
[法務メモ.md](法務メモ.md) の 4-(A) を参照。
