#!/usr/bin/env bash
# AI CEO 新品分仓 Demo —— gh-pages 部署 / 线上回退（唯一可靠方式）
#
#   用法:
#     scripts/deploy-gh-pages.sh              # 把当前 HEAD 部署到 gh-pages
#     scripts/deploy-gh-pages.sh <git-ref>    # 把线上回退到该 ref（如 tag pre-merge-wenshu-v2.18），
#                                             # 完成后自动切回 main 并重建 dist
#
# 为什么必须用 `cd dist && git init`：`git subtree push` / `subtree split` 都会**静默丢失
#   dist/assets/**（页面空白、JS/CSS 404），2026-09-09 二次验证确认。
# 为什么回退要"重新 build"而不是"检出历史 dist"：`dist/assets/*` 在 .gitignore 里，只有
#   dist/index.html 等少数文件被 force-tracked；旧资源被 force push 覆盖后远端就没有了。
# 2026-09-24 实操跑通：线上从合并版回退到 V2.18（产物 index-B2lf1z79.js / index-CNmMqlcy.css），
#   约 1 分钟生效；全程 main / tag 未动。
set -euo pipefail

REPO_URL="https://github.com/He-Binjie/ai-ceo-newproduct-demo.git"
REPO_PATH="He-Binjie/ai-ceo-newproduct-demo"
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null || true)"
# ⚠️ 2026-09-24 修：本脚本原来写死 `git -C $(dirname $0) rev-parse --show-toplevel`，
#   放在 skill 目录（~/.hermes/...）里跑会直接 `fatal: not a git repository`（set -e 直接退出）。
#   现在：优先用所在仓库；解析不到（脚本被拷到 skill 目录等仓库外）时退回项目路径 / ${DEMO_ROOT}。
if [ -z "$ROOT" ]; then
  ROOT="${DEMO_ROOT:-$HOME/Documents/工作/熵海/ai-ceo-demo-newproduct}"
  if [ ! -d "$ROOT/.git" ]; then
    echo "✗ 找不到 demo 仓库（试过脚本所在仓库与 ${ROOT}）→ 用 DEMO_ROOT=<仓库路径> 再跑，或用仓库内的 scripts/deploy-gh-pages.sh" >&2
    exit 1
  fi
  echo "ℹ 脚本不在仓库内 → ROOT 退回 ${ROOT}（**建议直接用仓库里的 scripts/deploy-gh-pages.sh**）"
fi
cd "$ROOT"

REF="${1:-}"

if [ -n "$REF" ]; then
  if [ -n "$(git status --porcelain)" ]; then
    echo "✗ 工作区不干净，先跟用户确认（回退要切 HEAD，别硬覆盖）：" >&2
    git status --short >&2
    exit 1
  fi
  echo "→ 回退模式：先看这个 ref 的产物长什么样（回退后线上应该是它）"
  git show "$REF:dist/index.html" | grep -o 'assets/index-[^"]*' || true
  git checkout -q "$REF"
fi

echo "→ npm run build（内部 prebuild → build-wenshu.mjs，断言必须全过）"
npm run build
echo "→ 本地产物：$(grep -o 'assets/index-[^"]*' dist/index.html | tr '\n' ' ')"

echo "→ 推 gh-pages（git init 方式）"
cd dist
rm -rf .git
git init -q
git add -A
git commit -q -m "deploy $(git -C .. rev-parse --short HEAD) $(date '+%F %H:%M')"
git branch -M gh-pages
git remote add origin "$REPO_URL"
git push -f origin gh-pages
cd ..
rm -rf dist/.git

if [ -n "$REF" ]; then
  echo "→ 切回 main 并重建 dist（让本地预览 4179 与源码一致，否则会误导下一轮排查）"
  git checkout -q main
  npm run build
  # manifest 只有 generatedAt 会变，回退掉让工作区保持干净
  git checkout -q -- src/skills/wenshu/generated/manifest.json || true
fi

cat <<EOF

✓ 部署完成。按这个顺序验证（别跳过第 1 步）：
  1) 先看推上去的内容对不对（秒级）：
     curl -s https://raw.githubusercontent.com/$REPO_PATH/gh-pages/index.html | grep -oE 'assets/index-[^"]*|wenshu/[a-z.-]+'
  2) 确认 assets 子目录还在：
     curl -s "https://api.github.com/repos/$REPO_PATH/contents/assets?ref=gh-pages" | grep -o '"name": "[^"]*"'
  3) 再轮询线上 hash（传播 30s~3min，**别 1 分钟没变就重新部署**）：
     curl -s "https://he-binjie.github.io/ai-ceo-newproduct-demo/?v=\$RANDOM" | grep -o 'assets/index-[^"]*\.js'
  4) 收尾回报必须写清「哪条分支被动了、哪条没动」（如：gh-pages 回退到 xxx，main 原样未动）
EOF