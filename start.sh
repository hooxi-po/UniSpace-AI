#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"

if ! command -v java >/dev/null 2>&1; then
  echo "[ERROR] 未检测到 java。请先安装 JDK 21，并确保 java 在 PATH 中。" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] 未检测到 node。请先安装 Node.js (建议 >= 18)。" >&2
  exit 1
fi

if [ ! -d "$FRONTEND_DIR" ] || [ ! -d "$BACKEND_DIR" ]; then
  echo "[ERROR] 未找到 frontend/ 或 backend/ 目录，请在项目根目录运行。" >&2
  exit 1
fi

echo "[INFO] 项目根目录: $ROOT_DIR"

# 启动后端
(
  cd "$BACKEND_DIR"
  echo "[INFO] 启动后端: ./gradlew bootRun"
  ./gradlew bootRun
) &
BACKEND_PID=$!

# 确保退出时清理后台进程
cleanup() {
  echo "\n[INFO] 正在停止服务..."
  if kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    kill "$BACKEND_PID" || true
  fi
  # 尝试停止前端（如果是本脚本启动的 node 进程）
  if [ -n "${FRONTEND_PID:-}" ] && kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    kill "$FRONTEND_PID" || true
  fi
}
trap cleanup EXIT INT TERM

# 启动前端
(
  cd "$FRONTEND_DIR"

  if [ -f package-lock.json ]; then
    INSTALL_CMD="npm ci"
  else
    INSTALL_CMD="npm install"
  fi

  echo "[INFO] 安装前端依赖: $INSTALL_CMD"
  eval "$INSTALL_CMD"

  echo "[INFO] 启动前端: npm run dev"
  npm run dev
) &
FRONTEND_PID=$!

echo "[INFO] 前端 PID: $FRONTEND_PID"
echo "[INFO] 后端 PID: $BACKEND_PID"
echo "[INFO] 服务启动中..."
echo "[INFO] 前端: http://localhost:3000"
echo "[INFO] 后端: http://localhost:8080"
echo "[INFO] 按 Ctrl+C 退出并停止前后端。"

wait "$FRONTEND_PID"

