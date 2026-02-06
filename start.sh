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

# 端口占用检测
check_port() {
  local port=$1
  local name=$2
  if lsof -iTCP:"$port" -sTCP:LISTEN -n >/dev/null 2>&1; then
    echo "[ERROR] $name 端口 $port 已被占用，请先停止占用进程或修改端口" >&2
    echo "[INFO] 占用进程信息：" >&2
    lsof -iTCP:"$port" -sTCP:LISTEN -n >&2 || true
    exit 1
  fi
}

check_port 8080 "后端"
check_port 3000 "前端"

echo "[INFO] 项目根目录: $ROOT_DIR"

# PID 文件（防止重复启动）
PIDFILE="$ROOT_DIR/.start.pid"
if [ -f "$PIDFILE" ]; then
  OLD_PID=$(cat "$PIDFILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "[ERROR] 检测到已有 start.sh 实例运行 (PID $OLD_PID)，请勿重复启动" >&2
    exit 1
  else
    echo "[WARN] 清理残留 PID 文件" >&2
    rm -f "$PIDFILE"
  fi
fi
echo $ > "$PIDFILE"

# 清理函数
cleanup() {
  echo ""
  echo "[INFO] 正在停止服务..."
  [ -n "${BACKEND_PID:-}" ] && {
    echo "[INFO] 停止后端 (PID $BACKEND_PID)"
    kill "$BACKEND_PID" 2>/dev/null || true
    # 确保进程组也被清理
    pkill -P "$BACKEND_PID" 2>/dev/null || true
    # 等待进程退出，最多 5 秒
    local count=0
    while kill -0 "$BACKEND_PID" 2>/dev/null && [ $count -lt 5 ]; do
      sleep 1
      count=$((count+1))
    done
    if kill -0 "$BACKEND_PID" 2>/dev/null; then
      echo "[WARN] 后端未响应 SIGTERM，强制终止"
      kill -9 "$BACKEND_PID" 2>/dev/null || true
      pkill -9 -P "$BACKEND_PID" 2>/dev/null || true
    fi
  }
  [ -n "${FRONTEND_PID:-}" ] && {
    echo "[INFO] 停止前端 (PID $FRONTEND_PID)"
    kill "$FRONTEND_PID" 2>/dev/null || true
    pkill -P "$FRONTEND_PID" 2>/dev/null || true
    local count=0
    while kill -0 "$FRONTEND_PID" 2>/dev/null && [ $count -lt 5 ]; do
      sleep 1
      count=$((count+1))
    done
    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
      echo "[WARN] 前端未响应 SIGTERM，强制终止"
      kill -9 "$FRONTEND_PID" 2>/dev/null || true
      pkill -9 -P "$FRONTEND_PID" 2>/dev/null || true
    fi
  }
  rm -f "$PIDFILE"
  echo "[INFO] 服务已停止"
}
trap cleanup EXIT INT TERM

# 启动后端
(
  cd "$BACKEND_DIR"
  echo "[INFO] 启动后端: ./gradlew bootRun"
  exec ./gradlew bootRun
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
