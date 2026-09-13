import { Component, StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { armAudioUnlock } from "./audio/index.js";
import { checkAppVersion } from "./net/app-version.js";
import { TotteryApp } from "./ui/screens.jsx";

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
          <h2>うまく表示できませんでした</h2>
          <p className="hint">
            申し訳ありません。開き直すと元に戻ります。
            <br />
            対局中だった場合、その対局は続けられません。
          </p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            開き直す
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
        <div className="update-gate" role="alertdialog" aria-label="アップデートが必要です">
          <div className="update-gate-box">
            <h2>アップデートしてください</h2>
            <p className="hint">
              新しいバージョンがあります。続けるには App Store で更新してください。
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
              App Store を開く
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// 音は最初に画面を触るまで鳴らせない決まりになっている。
// 最初のタップを待ち受けて、そこで解錠する
armAudioUnlock();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Boundary>
      <VersionGate>
        <TotteryApp />
      </VersionGate>
    </Boundary>
  </StrictMode>,
);
