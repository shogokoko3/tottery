# 召喚導入の制作記録（2026-09-16）

この文書は初版の制作記録。現在の建築画・門の描画方式は [召喚建築 v3](summon-architecture-v3.md) を参照。

## 演出

保存済みの抽選結果を使い、階段の上昇2秒、門を見せる2秒、開門3秒、実際の結果枠へのカード飛翔2秒を再生する。フォイルが1枚でもあれば黄金の門、なければSSRを含んでも赤銅の門。

世界はフォイルの中の最高レアから選び、フォイルなしなら全結果の最高レアから選ぶ。同格は最初に抽選された札。結果や所持品はこの演出では変更しない。

遠景は描き込んだイラスト。手前の階段・柱・扉はThree.jsの立体で、視点の移動・左右の扉の開閉を独立して描画する。カードは実際の結果画面の矩形を測って着地する。短縮・演出OFF・OSの動き抑制では導入を省き、WebGL失敗や非表示への移行でも保存済み結果へ進む。

## 画像制作

built-in imagegenで新規生成。元画像は生成履歴に保存し、ゲーム用はWebPへ符号化した。切り抜き・描き変えは行っていない。

- `assets/skins/summon/gate-relief.webp`: 左右一対の彫刻門のモノクロ表面。材質側で銅／金を着色。
- `assets/skins/summon/{earth,sea,forest,ice,sky,heaven,hell}-hall.webp`: 7世界の遠景。
- `assets/skins/summon/crest-*.png`: 既存 `assets/honors/icons` の紋章を再利用。

生成プロンプトの共通指定：

> Premium Japanese dark fantasy card-game illustration, painterly angular materials, monumental architecture with atmospheric depth, portrait 1024x1536. Straight-on perspective. A broad empty dark central alcove from25%-75%width and42%-82%height for a separately modeled door; no painted door, stairs, characters, cards, text or UI. Exquisitely detailed upper half and outer edges. Deep navy foundations with restrained theme accents.

世界別の指定：

- 土: moonlit royal necropolis, weathered funerary columns, mausoleums, skeletal branches, pale teal moon, green ghost-fire and graveyard mist.
- 海: pirate treasure sanctuary, dark timber and bronze, detailed rigging, red sails, moonlit ocean, compass carvings and lanterns.
- 森: ancient jungle temple, dense tropical leaves, twisting roots, moss-covered botanical columns, jade forest depth and humid mist.
- 氷: arctic ice sanctuary, glacier pillars, jagged crystalline arches, polar sea and icebergs, green-teal aurora and frosted ornaments.
- 空: sanctuary above a cloud ocean, lapis stone and gold, dragon-wing architectural forms, layered clouds and distant floating islands; distinct from an angel cathedral.
- 天界: vast celestial cathedral at midnight, indigo and antique gold, carved pillars and vaults, astronomical circles and blue-gold stained-glass rosette, no angel-wing emblem in the background.
- 魔界: infernal royal palace, obsidian pillars, forged chains, crimson banners, horn-like spires, violet clouds, braziers, lava, smoke and embers; regal rather than cartoonish.

彫刻扉の指定：

> Orthographic metal-door surface texture atlas, two symmetric tall leaves, monochrome silver-gray so the game can tint bronze or gold. Deep acanthus bas-relief, pointed Gothic tracery, faceted crystal ornaments, engraved rays, filigree and heavy borders, dark recessed backing, soft upper-left raking light, no wall/floor/handles/text.

## 確認

`node tools/check-summon-intro.mjs` は7世界、結果と門色の対応、枚数、時間境界、結果保護を確認する。既存 `check-foil-acquisition.mjs` も通過し、SSRまでの全昇格後0.5秒からフォイルに進む処理を維持。

`node tools/preview-summon.mjs` で `/tmp/tottery-summon-preview` に専用プレビューを作成。

- `index.html`: 7世界・金属色・時間を切り替える表示確認。
- `flow.html?foil=1`: 10枚の実際の召喚から開示まで。
- `flow.html?count=1&reduce=1`: 動きを抑えた1枚の開示。
- `flow.html?no-gl=1`: プレビューだけでWebGL失敗を再現し、結果へ復帰。

390×844で7世界・銅と金・10枚の着地・既存開示・動きの抑制・WebGL失敗をブラウザ確認した。iPhone実機のGPU負荷と音の聴感は別途実機確認の対象。
