#!/bin/sh
# iOS を TestFlight へ送る。手順は「iOS配信.md」。
#   必要な環境変数: APPLE_TEAM_ID(10桁)。
#   任意: ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH(App Store Connect の API キー。無ければ Xcode にサインイン済みの Apple ID で送る)
#   使い方: sh tools/ios-release.sh archive | upload | all
set -eu
cd "$(dirname "$0")/.."
PROJ=ios/App/App.xcodeproj
ARCHIVE=ios/build/App.xcarchive
EXPORT=ios/build/export
# Team ID。指定が無ければプロジェクトに書いてあるもの(Xcode が Signing で書き込む)を使う
APPLE_TEAM_ID="${APPLE_TEAM_ID:-$(sed -n 's/.*DEVELOPMENT_TEAM = \([A-Z0-9]*\);.*/\1/p' "$PROJ/project.pbxproj" | head -1)}"
: "${APPLE_TEAM_ID:?APPLE_TEAM_ID(Apple Developer の Team ID、10桁)を設定してください}"
# ビルド番号は時刻から作る(前回より必ず大きくなる)。見た目の版(MARKETING_VERSION)は Xcode の設定のまま
BUILD_NUMBER="${BUILD_NUMBER:-$(date +%Y%m%d%H%M)}"
# build.mjs(npm run ios:sync)がこの番号を __APP_BUILD__ に埋める。強制アップデートの判定に使う
export BUILD_NUMBER
# ── 署名のキーチェーンを開ける ──────────────────────────────
# 配布証明書(Apple Distribution)は login ではなく、バカラの署名用キーチェーン
# (baccaland-signing)の中にある。配布証明書は Apple アカウントに1枚なので、
# 両アプリで同じものを使っている。
#
# このキーチェーンは **眠ると施錠され、6時間で自動施錠**される設定なので、
# そのまま書き出すと署名が errSecInternalComponent で落ちる
# (2026-09-28 に実際に落ちた。原因が読み取りにくいので自動で開けるようにした)。
#
# 合言葉の在処は、上から順に:
#   1. 環境変数 SIGNING_KEYCHAIN_PASSWORD
#   2. 環境変数 SIGNING_ENV が指すファイル
#   3. ios/.signing.env(このリポジトリの中。git には入らない)
#   4. ../../Baccarat/scripts/.testflight.env(バカラが作ったときに書き出したもの)
# どれも無ければ何もせず先へ進む(すでに開いていれば署名は通る)。
unlock_signing_keychain() {
  # 証明書がどのキーチェーンに入っているかは、その場で調べる
  kc=$(security find-certificate -c "Apple Distribution" 2>/dev/null |
    sed -n 's/^keychain: "\(.*\)"$/\1/p' | head -1)
  [ -n "$kc" ] || return 0
  # login キーチェーンは画面に入るときに開いているので触らない
  case "$kc" in *login.keychain*) return 0 ;; esac

  pw="${SIGNING_KEYCHAIN_PASSWORD:-}"
  if [ -z "$pw" ]; then
    for f in "${SIGNING_ENV:-}" ios/.signing.env ../../Baccarat/scripts/.testflight.env; do
      [ -n "$f" ] && [ -f "$f" ] || continue
      pw=$(sed -n 's/^SIGNING_KEYCHAIN_PASSWORD=//p' "$f" | head -1)
      [ -n "$pw" ] && break
    done
  fi
  if [ -z "$pw" ]; then
    echo "! 署名のキーチェーン($kc)の合言葉が見つかりません。"
    echo "  施錠されていると、書き出しの署名が errSecInternalComponent で落ちます。"
    echo "  次のどちらかで渡してください:"
    echo "    SIGNING_KEYCHAIN_PASSWORD=… npm run ios:testflight"
    echo "    ios/.signing.env に SIGNING_KEYCHAIN_PASSWORD=… の1行を置く"
    return 0
  fi
  # すでに開いていても、もう一度開けるのは害が無い
  if security unlock-keychain -p "$pw" "$kc" 2>/dev/null; then
    echo "署名のキーチェーンを開けました: $(basename "$kc")"
  else
    echo "! 署名のキーチェーンを開けられませんでした($kc)。合言葉が違うかもしれません" >&2
  fi
}

step="${1:-all}"
# App Store Connect の API キー(あれば)。archive のクラウド署名にも export にも使う。
# CI(サインイン済みの Apple アカウントが無い)ではこれが必須。ローカルで未設定なら空=従来どおり。
AUTH_ARGS=""
if [ -n "${ASC_KEY_ID:-}" ]; then
  AUTH_ARGS="-authenticationKeyPath ${ASC_KEY_PATH:?ASC_KEY_PATH(.p8 の場所)} -authenticationKeyID $ASC_KEY_ID -authenticationKeyIssuerID ${ASC_ISSUER_ID:?ASC_ISSUER_ID}"
fi
# SIGNING_PROFILE が指定されていれば手動署名(CI)。プロファイルは呼ぶ側が
# ~/Library/MobileDevice/Provisioning Profiles/ に入れておく。未指定ならローカルの自動署名。
if [ "$step" = "archive" ] || [ "$step" = "all" ]; then
  npm run ios:sync
  # 同期でできた控え(「config 10.xml」)をアプリに入れない。
  # cap copy が置いた直後に複製されるので、写したあとに落とす
  node tools/drop-dupes.mjs ios/App/App
  rm -rf "$ARCHIVE"
  if [ -n "${SIGNING_PROFILE:-}" ]; then
    xcodebuild -project "$PROJ" -scheme App -configuration Release -sdk iphoneos \
      -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" \
      DEVELOPMENT_TEAM="$APPLE_TEAM_ID" CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
      CODE_SIGN_STYLE=Manual \
      PROVISIONING_PROFILE_SPECIFIER="$SIGNING_PROFILE" \
      CODE_SIGN_IDENTITY="${SIGNING_IDENTITY:-Apple Distribution}" \
      archive
  else
    # shellcheck disable=SC2086
    xcodebuild -project "$PROJ" -scheme App -configuration Release -sdk iphoneos \
      -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" \
      -allowProvisioningUpdates -allowProvisioningDeviceRegistration $AUTH_ARGS \
      DEVELOPMENT_TEAM="$APPLE_TEAM_ID" CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
      archive
  fi
  echo "アーカイブ完了: $ARCHIVE (ビルド番号 $BUILD_NUMBER)"
fi
if [ "$step" = "upload" ] || [ "$step" = "all" ]; then
  unlock_signing_keychain
  # upload だけを走らせたときは、**アーカイブに入っている番号**を名乗る。
  # BUILD_NUMBER は時刻から作り直されるので、そのまま出すと
  # 実際に上がった番号と食い違う(2026-09-28 に食い違った)
  if [ -f "$ARCHIVE/Info.plist" ]; then
    in_archive=$(/usr/libexec/PlistBuddy -c \
      "Print :ApplicationProperties:CFBundleVersion" "$ARCHIVE/Info.plist" 2>/dev/null || true)
    [ -n "$in_archive" ] && BUILD_NUMBER="$in_archive"
  fi
  rm -rf "$EXPORT"
  if [ -n "${SIGNING_PROFILE:-}" ]; then
    # 手動署名で書き出し。クラウド署名(-allowProvisioningUpdates)はしないが、
    # ExportOptions の destination:upload によるアップロードの認証に API キーは要る。
    # shellcheck disable=SC2086
    xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportPath "$EXPORT" \
      -exportOptionsPlist ios/ExportOptions-ci.plist $AUTH_ARGS
  else
    # shellcheck disable=SC2086
    xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportPath "$EXPORT" \
      -exportOptionsPlist ios/ExportOptions.plist -allowProvisioningUpdates $AUTH_ARGS
  fi
  echo "TestFlight へ送りました。App Store Connect の TestFlight で処理が終わるのを待ってください(10〜30分)"
  echo "このビルドの番号: $BUILD_NUMBER  ← 旧版を強制アップデートさせるには、Worker の環境変数 MIN_APP_BUILD をこの番号にする"
fi
