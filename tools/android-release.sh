#!/bin/sh
# Android を組む。手順は「Android配信.md」。
#   必要なもの: JDK 17 以上、Android SDK(ANDROID_HOME か ANDROID_SDK_ROOT)
#   使い方: sh tools/android-release.sh debug | bundle
#     debug  … 手元で試す APK(署名は debug 鍵)
#     bundle … Play に上げる AAB(署名は Play App Signing に任せる＝未署名で出す)
set -eu
cd "$(dirname "$0")/.."

# 版の番号。Play の versionCode は 21億未満の整数でなければならないので、
# iOS の BUILD_NUMBER(202609190705 のような12桁)はそのまま使えない。
# 「2020-01-01 からの経過分数」にする(単調増加で、当分あふれない)
VERSION_CODE="${ANDROID_VERSION_CODE:-$(node -e 'console.log(Math.floor((Date.now()-Date.UTC(2020,0,1))/60000))')}"
VERSION_NAME="${ANDROID_VERSION_NAME:-$(node -p "require('./package.json').version")}"

# 強制アップデートの判定に使う番号は iOS と別系統になるので、
# アプリに埋めるビルド番号も versionCode と同じものにしておく
BUILD_NUMBER="$VERSION_CODE"
export BUILD_NUMBER

npm run android:sync

step="${1:-bundle}"
cd android
case "$step" in
  debug)
    ./gradlew assembleDebug -PtotteryVersionCode="$VERSION_CODE" -PtotteryVersionName="$VERSION_NAME"
    echo "できました: android/app/build/outputs/apk/debug/app-debug.apk (versionCode $VERSION_CODE)"
    ;;
  bundle)
    ./gradlew bundleRelease -PtotteryVersionCode="$VERSION_CODE" -PtotteryVersionName="$VERSION_NAME"
    echo "できました: android/app/build/outputs/bundle/release/app-release.aab (versionCode $VERSION_CODE)"
    echo "Play Console の「内部テスト」にこの .aab を上げてください"
    ;;
  *)
    echo "× 知らない手順: $step (debug か bundle)" >&2
    exit 1
    ;;
esac
