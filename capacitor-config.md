# capacitor.config.json の覚え書き

JSON にはコメントを書けないので、決めた理由をここに置く。

## `android.includePlugins: []`

Android では**ネイティブのプラグインを1つも入れない**。

いま入っているプラグインは、どれも Android では使わない:

| プラグイン | Android での扱い |
| --- | --- |
| `@capacitor-community/admob` | 広告は iOS だけ([src/net/ads.js](src/net/ads.js)) |
| `@capgo/native-purchases` | 店は iOS だけ([src/net/platform.js](src/net/platform.js) の `hasStore()`) |
| `@capacitor-community/apple-sign-in` | Apple でのサインインは iOS だけ |
| `tottery-nearby` | Swift だけで、Android の実装が無い |

入れたままだと、使っていないのに **`AD_ID`(広告 ID)などの権限が AndroidManifest に
入ってしまう**。Google Play の「データ セーフティ」では権限に合わせた申告が要るので、
「広告は出さないのに広告 ID を使う」という食い違った申告になる。

あとで Google Play Billing を入れるときは、ここに `"NativePurchases"` を足す。
iOS 側は今まで通り全部入る(`ios` には書いていないので、全体の既定＝全部)。
