#!/bin/sh
# 修正のたびに TestFlight へ1コマンドで送る(2026-09-21 本人の指示)。
#
# 使い方(あなたのターミナルで):
#   cd /Users/shogo/Desktop/トッタリー/tottery
#   npm run ios:deploy        # ← これだけ。ビルド番号は時刻から自動
#
# やること:
#   1. 配布用の秘密鍵が入った署名キーチェーン(baccaland-signing)を解錠する。
#      パスワードは Baccarat プロジェクトの scripts/.testflight.env にある
#      SIGNING_KEYCHAIN_PASSWORD を読む(このスクリプトには書かない)。
#   2. npm run ios:testflight(ビルド→アーカイブ→アップロード)を実行する。
#
# なぜ手元で: codesign は GUI ログインセッションのキーチェーン権限が要る。
# Claude のバックグラウンド処理からは届かないので、この1コマンドだけは本人が打つ。
set -eu
cd "$(dirname "$0")/.."

# 署名キーチェーンの解錠 -------------------------------------------------
# 置き場所は SIGNING_ENV で上書きできる。既定はバカラの署名設定。
ENV_FILE="${SIGNING_ENV:-$HOME/Desktop/Baccarat/scripts/.testflight.env}"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  KC="${SIGNING_KEYCHAIN:-baccaland-signing.keychain}"
  # security は .keychain / .keychain-db どちらでも解決するが、確実に -db を指す
  case "$KC" in
    /*) KCPATH="$KC" ;;
    *)  KCPATH="$HOME/Library/Keychains/$KC" ;;
  esac
  case "$KCPATH" in *.keychain) KCPATH="${KCPATH}-db" ;; esac
  if [ -n "${SIGNING_KEYCHAIN_PASSWORD:-}" ] && [ -e "$KCPATH" ]; then
    security unlock-keychain -p "$SIGNING_KEYCHAIN_PASSWORD" "$KCPATH" \
      && echo "署名キーチェーンを解錠しました: $KCPATH"
  else
    echo "注意: SIGNING_KEYCHAIN_PASSWORD か $KCPATH が見つかりません。解錠を飛ばします。" >&2
  fi
else
  echo "注意: 署名設定 $ENV_FILE が見つかりません。解錠を飛ばして続けます。" >&2
  echo "      別の場所にあるなら SIGNING_ENV=... を渡してください。" >&2
fi

# ビルド → アーカイブ → アップロード ------------------------------------
npm run ios:testflight
