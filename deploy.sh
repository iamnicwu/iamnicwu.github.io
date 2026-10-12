#!/usr/bin/env bash
# 构建博客并发布到 GitHub Pages（master 分支）
# 用法: ./deploy.sh "提交说明(可选)"
set -euo pipefail
cd "$(dirname "$0")"

echo "==> 构建 Hugo 站点..."
hugo --minify --cleanDestinationDir

DEPLOY_DIR=$(mktemp -d)
trap 'rm -rf "$DEPLOY_DIR"' EXIT

echo "==> 准备部署..."
git -c http.version=HTTP/1.1 clone --depth 1 --branch master https://github.com/iamnicwu/iamnicwu.github.io.git "$DEPLOY_DIR"

rsync -a --delete --exclude '.git' public/ "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"
git add -A
if git diff --cached --quiet; then
  echo "==> 没有变化，跳过部署"
  exit 0
fi
git commit -m "Deploy site: ${1:-$(date '+%Y-%m-%d %H:%M')}"
git push origin master
echo "==> 部署完成！稍等一两分钟 GitHub Pages 生效: https://nickwu.fun/"
