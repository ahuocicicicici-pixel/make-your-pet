#!/usr/bin/env bash
# Build a role-specific arm64 DMG.  Usage: tools/build-dmg.sh cc|mark
# - swaps link.config.<role>.json into link.config.json (baked into the app)
# - temporarily disables the npmmirror .npmrc (else dmgbuild-bundle 404s)
# - renames the output to COCO-<role>-arm64.dmg
set -euo pipefail
ROLE="${1:?usage: build-dmg.sh cc|mark}"
cd "$(dirname "$0")/.."

[ -f "link.config.$ROLE.json" ] || { echo "missing link.config.$ROLE.json"; exit 1; }
cp "link.config.$ROLE.json" link.config.json
echo "▶ active config: $ROLE"

restore() { [ -f .npmrc.bak ] && mv -f .npmrc.bak .npmrc || true; }
trap restore EXIT
[ -f .npmrc ] && mv .npmrc .npmrc.bak || true

npx electron-builder --mac dmg --arm64

OUT="dist/Coco-0.1.0-arm64.dmg"
DEST="dist/Coco-$ROLE-arm64.dmg"
# rm the dest first so a case-only-different leftover (case-insensitive FS) is
# replaced cleanly and the new file keeps the exact "Coco-" casing.
rm -f "$DEST" "$OUT.blockmap"
[ -f "$OUT" ] && mv -f "$OUT" "$DEST" && echo "✅ built $DEST"
