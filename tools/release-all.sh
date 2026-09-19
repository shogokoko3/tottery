#!/bin/sh
# iOS 版と Google Play 版を、1つの命令で両方作る。
#
# 片方だけ出して、もう片方を忘れるのを防ぐための道具。
# 中身(src/)は同じものから作り、**絵の重さだけ**を変える:
#   iOS     … ASSETS=full    png のまま(画質はいまのまま)
#   Android … ASSETS=compact 盤面エリアと称号を webp q95(Play の 200MB 上限のため)
# 同じ中身から作られたかは、最後に tools/check-release-parity.mjs が確かめる。
#
#   sh tools/release-all.sh        … 両方作る。iOS は TestFlight まで送る
#   sh tools/release-all.sh build  … 両方作るだけ(送らない)
set -eu
cd "$(dirname "$0")/.."

step="${1:-all}"
case "$step" in
  all|build) ;;
  *) echo "× 知らない手順: $step (all か build)" >&2; exit 1 ;;
esac

echo "───── 1/3 iOS(画質はそのまま) ─────"
if [ "$step" = "all" ]; then
  sh tools/ios-release.sh all
else
  sh tools/ios-release.sh archive
fi

echo ""
echo "───── 2/3 Google Play(絵を webp に) ─────"
sh tools/android-release.sh bundle

echo ""
echo "───── 3/3 両方が同じ中身か確かめる ─────"
node tools/check-release-parity.mjs --strict

# 手元と Cloudflare に配るぶんは画質そのままに戻しておく
# (android:sync のあとは dist/ が compact のままになっているため)
echo ""
echo "dist/ を画質そのまま(full)に戻しています…"
ASSETS=full node build.mjs > /dev/null
echo "終わりました。"
if [ "$step" = "all" ]; then
  echo "  iOS     … TestFlight で処理待ち(10〜30分)"
else
  echo "  iOS     … ios/build/App.xcarchive"
fi
echo "  Android … android/app/build/outputs/bundle/release/app-release.aab"
