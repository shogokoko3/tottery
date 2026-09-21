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
  rm -rf "$EXPORT"
  if [ -n "${SIGNING_PROFILE:-}" ]; then
    # 手動署名: CI 用の ExportOptions(手動・プロファイル指定)を使う。クラウド署名はしない
    xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportPath "$EXPORT" \
      -exportOptionsPlist ios/ExportOptions-ci.plist
  else
    # shellcheck disable=SC2086
    xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportPath "$EXPORT" \
      -exportOptionsPlist ios/ExportOptions.plist -allowProvisioningUpdates $AUTH_ARGS
  fi
  echo "TestFlight へ送りました。App Store Connect の TestFlight で処理が終わるのを待ってください(10〜30分)"
  echo "このビルドの番号: $BUILD_NUMBER  ← 旧版を強制アップデートさせるには、Worker の環境変数 MIN_APP_BUILD をこの番号にする"
fi
