#!/usr/bin/env bash
# 一键推送 JS 热补丁到 VPS：把当前 src 的 4 个核心文件作为新 patchVersion 发布。
# 已安装的 Coco 下次启动会自动下载并生效（坏补丁自动回退，不会变砖）。
# 只覆盖主进程逻辑(main/link/state/screentime)；改了渲染层/素材要重打 DMG。
#
# 用法：
#   tools/push-patch.sh                         # 纯 JS 热补丁
#   tools/push-patch.sh 0.2.0 <dmgUrl> "说明"   # 顺带发"有新整包版本"提醒
set -euo pipefail
cd "$(dirname "$0")/.."

# 部署凭据从 tools/deploy.env 读取（已 gitignore；模板见 deploy.env.example）。
ENV_FILE="tools/deploy.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "✗ 缺少 $ENV_FILE —— 先 cp tools/deploy.env.example tools/deploy.env 并填入你的 VPS 信息" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"
KEY="${DEPLOY_KEY/#\$HOME/$HOME}"; VPS="$DEPLOY_VPS"; DIST="$DEPLOY_DIST"

CUR=$(ssh -i "$KEY" "$VPS" "python3 -c \"import json;print(json.load(open('$DIST/manifest.json'))['patchVersion'])\"")
NEXT=$((CUR + 1))
echo "▶ patchVersion $CUR → $NEXT"

ssh -i "$KEY" "$VPS" "mkdir -p $DIST/$NEXT"
scp -i "$KEY" src/main.js src/link.js src/state.js src/screentime.js "$VPS:$DIST/$NEXT/"
ssh -i "$KEY" "$VPS" "cd $DIST && python3 gen-manifest.py $NEXT '${1:-}' '${2:-}' '${3:-}'"
echo "✅ 已发布 patchVersion $NEXT —— 用户下次开 Coco 自动更新"
