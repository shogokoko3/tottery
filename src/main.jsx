import { Component, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { installUiSounds } from "./audio/ui-sounds.js";
import { armAudioUnlock } from "./audio/index.js";
import { checkAppVersion } from "./net/app-version.js";
import { runTestflightReset } from "./net/tf-reset.js";
import { TotteryApp } from "./ui/screens.jsx";
import { installNativeInteractionGuard } from "./ui/native-interactions.js";
import { L } from "./i18n/index.js";

/**
 * 描くところで落ちたときの受け皿。
 *
 * 相手から届いたもの(名前・成績・手番)は、こちらでは何も保証できない。
 * 想定していない形が1つ紛れ込むと React はツリーごと外してしまい、
 * 画面が真っ白になって何も操作できなくなる。ここで受け止めて、
 * 少なくとも「開き直せる」ところまでは残す。
 */
class Boundary extends Component {
  constructor(props) {
    super(props);
    this.state = { fell: false };
  }
  static getDerivedStateFromError() {
    return { fell: true };
  }
  componentDidCatch(err, info) {
    console.error("画面が落ちました", err, info);
  }
  render() {
    if (!this.state.fell) return this.props.children;
    return (
      <div className="tottery-root">
        <div className="center-stage">
          <h2>{L("うまく表示できませんでした")}</h2>
          <p className="hint">
            {L("申し訳ありません。開き直すと元に戻ります。")}
            <br />
            {L("対局中だった場合、その対局は続けられません。")}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            {L("開き直す")}
          </button>
        </div>
      </div>
    );
  }
}

/**
 * 起動時の強制アップデート。iOS で最低ビルド番号未満なら、更新の案内で覆う。
 * 判定できるまでは普通にアプリを出し(フェイルオープン)、ブロックが決まったら上に重ねる。
 */
function VersionGate({ children }) {
  const [block, setBlock] = useState(null); // null=OK / { storeUrl }=要更新
  useEffect(() => {
    let alive = true;
    checkAppVersion()
      .then((r) => {
        if (alive && r && r.blocked) setBlock({ storeUrl: r.storeUrl });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return (
    <>
      {children}
      {block && (
        <div
          className="update-gate"
          role="alertdialog"
          aria-label={L("アップデートが必要です")}
        >
          <div className="update-gate-box">
            <h2>{L("アップデートしてください")}</h2>
            <p className="hint">
              {L("新しいバージョンがあります。続けるには {store} で更新してください。", {
                store: /testflight\.apple\.com/.test(block.storeUrl || "")
                  ? "TestFlight"
                  : "App Store",
              })}
            </p>
            <button
              className="btn btn-primary btn-wide"
              onClick={() =>
                window.open(
                  block.storeUrl || "https://apps.apple.com/app/id6811241552",
                  "_system",
                )
              }
            >
              {/testflight\.apple\.com/.test(block.storeUrl || "")
                ? L("TestFlight を開く")
                : L("App Store を開く")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// 入力欄以外はゲームの操作だけを受け付ける。
installNativeInteractionGuard(document);

// 音は最初に画面を触るまで鳴らせない決まりになっている。
// 最初のタップを待ち受けて、そこで解錠する
armAudioUnlock();
installUiSounds();

/** テスト期間の記録を消したことを、一度だけ知らせる */
function ResetNotice({ children, shown }) {
  const [open, setOpen] = useState(shown);
  return (
    <>
      {children}
      {open && (
        <div className="update-gate" role="alertdialog" aria-label={L("記録を初期化しました")}>
          <div className="update-gate-box">
            <h2>{L("記録を初期化しました")}</h2>
            <p className="hint">
              {L("テスト版で遊んだ記録を消しました。はじめから遊べます。")}
            </p>
            <button className="btn btn-primary btn-wide" onClick={() => setOpen(false)}>
              {L("はじめる")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// テスト期間(TestFlight)の記録を一度だけ消す(src/net/tf-reset.js)。画面が保存を読む前に済ませる。
// 待つのは 10 秒まで。過ぎたら消さずに開き、次の起動でやり直す
const RESET_WAIT_MS = 10000;
let resetWanted = true;
Promise.race([
  runTestflightReset({ stillWanted: () => resetWanted }),
  new Promise((r) => setTimeout(() => r({ reset: false }), RESET_WAIT_MS)),
])
  .catch(() => ({ reset: false }))
  .then((r) => {
    resetWanted = false;
    createRoot(document.getElementById("root")).render(
      <StrictMode>
        <Boundary>
          <VersionGate>
            <ResetNotice shown={!!r?.reset}>
              <TotteryApp />
            </ResetNotice>
          </VersionGate>
        </Boundary>
      </StrictMode>,
    );
  });
