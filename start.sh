#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"

# 检查依赖
if ! command -v java >/dev/null 2>&1; then
  echo "[ERROR] 未检测到 java，请先安装 JDK 21" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] 未检测到 node，请先安装 Node.js >= 18" >&2
  exit 1
fi

if [ ! -d "$FRONTEND_DIR" ] || [ ! -d "$BACKEND_DIR" ]; then
  echo "[ERROR] 未找到 frontend/ 或 backend/ 目录" >&2
  exit 1
fi

echo "[INFO] 项目根目录: $ROOT_DIR"

# 清理函数
cleanup() {
  echo ""
  echo "[INFO] 正在停止服务..."
  [ -n "${BACKEND_PID:-}" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "${FRONTEND_PID:-}" ] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# 启动后端
(
  cd "$BACKEND_DIR"
  echo "[INFO] 启动后端: ./gradlew bootRun"
  ./gradlew bootRun
) &
BACKEND_PID=$!

# 启动前端
(
  cd "$FRONTEND_DIR"
  [ -f package-lock.json ] && npm ci || npm install
  echo "[INFO] 启动前端: npm run dev"
  npm run dev
) &
FRONTEND_PID=$!

echo "[INFO] 前端 PID: $FRONTEND_PID"
echo "[INFO] 后端 PID: $BACKEND_PID"
echo "[INFO] 前端: http://localhost:3000"
echo "[INFO] 后端: http://localhost:8080"
echo "[INFO] 按 Ctrl+C 退出"

wait "$FRONTEND_PID"
