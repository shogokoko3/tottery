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
step="${1:-all}"
if [ "$step" = "archive" ] || [ "$step" = "all" ]; then
  npm run ios:sync
  rm -rf "$ARCHIVE"
  xcodebuild -project "$PROJ" -scheme App -configuration Release -sdk iphoneos \
    -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" \
    -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
    DEVELOPMENT_TEAM="$APPLE_TEAM_ID" CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
    archive
  echo "アーカイブ完了: $ARCHIVE (ビルド番号 $BUILD_NUMBER)"
fi
if [ "$step" = "upload" ] || [ "$step" = "all" ]; then
  rm -rf "$EXPORT"
  if [ -n "${ASC_KEY_ID:-}" ]; then
    xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportPath "$EXPORT" \
      -exportOptionsPlist ios/ExportOptions.plist -allowProvisioningUpdates \
      -authenticationKeyPath "${ASC_KEY_PATH:?ASC_KEY_PATH(.p8 の場所)}" \
      -authenticationKeyID "$ASC_KEY_ID" \
      -authenticationKeyIssuerID "${ASC_ISSUER_ID:?ASC_ISSUER_ID}"
  else
    xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportPath "$EXPORT" \
      -exportOptionsPlist ios/ExportOptions.plist -allowProvisioningUpdates
  fi
  echo "TestFlight へ送りました。App Store Connect の TestFlight で処理が終わるのを待ってください(10〜30分)"
fi
