# tottery-nearby

近くの端末とのフレンド対戦(インターネット不要)。iOS の MultipeerConnectivity(Bluetooth / 近距離 Wi‑Fi)を
Capacitor のプラグインとして包む。JS 側の使い方は `src/net/nearby.js`。

- `start({ name })` 名乗り(advertise)と探索(browse)を同時に始める
- `invite({ peerId })` 見つけた相手を招待する。招待した側がゲスト(席1)、された側がホスト(席0)
- `send({ data })` 文字列を相手へ(順序保証・確実)
- `stop()` 全部やめる
- イベント: `peers { peers:[{id,name}] }` / `connected { peerId, name, initiator }` / `message { data }` / `disconnected { peerId }`

Info.plist に NSLocalNetworkUsageDescription・NSBonjourServices(`_tottery-near._tcp` / `_tottery-near._udp`)・
NSBluetoothAlwaysUsageDescription が要る(ios/App/App/Info.plist に入れてある)。
