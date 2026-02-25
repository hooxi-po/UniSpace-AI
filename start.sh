#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"
ENV_FILE="$ROOT_DIR/.env"

COMPOSE_CMD=""

trim_value() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

strip_matching_quotes() {
  local value="$1"
  if [ "${#value}" -ge 2 ]; then
    local first_char="${value:0:1}"
    local last_char="${value: -1}"
    if { [ "$first_char" = "'" ] && [ "$last_char" = "'" ]; } || { [ "$first_char" = '"' ] && [ "$last_char" = '"' ]; }; then
      printf '%s' "${value:1:${#value}-2}"
      return
    fi
  fi
  printf '%s' "$value"
}

parse_quoted_value() {
  local raw="$1"
  local quote="${raw:0:1}"
  local body rest char
  local i escaped=0

  body="${raw:1}"
  for ((i=0; i<${#body}; i++)); do
    char="${body:i:1}"

    if [ "$quote" = '"' ] && [ "$char" = '\' ] && [ $escaped -eq 0 ]; then
      escaped=1
      continue
    fi

    if [ "$char" = "$quote" ] && [ $escaped -eq 0 ]; then
      rest="${body:i+1}"
      rest="$(trim_value "$rest")"
      if [ -z "$rest" ] || [[ "$rest" == \#* ]]; then
        printf '%s' "${body:0:i}"
        return
      fi
      break
    fi

    escaped=0
  done

  printf '%s' "$(strip_matching_quotes "$raw")"
}

parse_env_file() {
  local env_file="$1"
  local line key value first_char
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    line="$(trim_value "$line")"
    [ -z "$line" ] && continue
    case "$line" in
      \#*) continue ;;
    esac

    if [[ "$line" == export[[:space:]]* ]]; then
      line="$(trim_value "${line#export}")"
    fi
    [[ "$line" != *=* ]] && continue

    key="$(trim_value "${line%%=*}")"
    value="$(trim_value "${line#*=}")"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

    first_char="${value:0:1}"
    if [ "$first_char" = "'" ] || [ "$first_char" = '"' ]; then
      value="$(parse_quoted_value "$value")"
    else
      value="${value%%[[:space:]]#*}"
      value="$(trim_value "$value")"
    fi

    printf -v "$key" '%s' "$value"
    export "$key"
  done < "$env_file"
}

if [ -f "$ENV_FILE" ]; then
  parse_env_file "$ENV_FILE"
fi

# 检查依赖
if ! command -v java >/dev/null 2>&1; then
  echo "[ERROR] 未检测到 java，请先安装 JDK 21" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] 未检测到 node，请先安装 Node.js >= 18" >&2
  exit 1
fi

if command -v docker >/dev/null 2>&1; then
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
  fi
fi

if [ ! -d "$FRONTEND_DIR" ] || [ ! -d "$BACKEND_DIR" ]; then
  echo "[ERROR] 未找到 frontend/ 或 backend/ 目录" >&2
  exit 1
fi

is_truthy() {
  local value
  value="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    1|true|yes|on) return 0 ;;
    0|false|no|off|'') return 1 ;;
    *) return 0 ;;
  esac
}

if [ -z "${DB_PASSWORD:-}" ] && [ -z "${POSTGRES_PASSWORD:-}" ]; then
  echo "[ERROR] 缺少 DB_PASSWORD/POSTGRES_PASSWORD（至少配置一个）" >&2
  exit 1
fi

if [ -z "${APP_ADMIN_PASSWORD:-}" ] && is_truthy "${APP_SECURITY_WRITE_AUTH_ENABLED:-true}"; then
  echo "[ERROR] 缺少 APP_ADMIN_PASSWORD（后端写接口鉴权必需，可在 .env 中配置）" >&2
  exit 1
fi

export DB_PASSWORD="${DB_PASSWORD:-${POSTGRES_PASSWORD:-}}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-${DB_PASSWORD:-}}"
export BACKEND_ADMIN_USER="${BACKEND_ADMIN_USER:-${APP_ADMIN_USER:-admin}}"
export BACKEND_ADMIN_PASSWORD="${BACKEND_ADMIN_PASSWORD:-${APP_ADMIN_PASSWORD:-}}"

# 端口占用检测
find_port_pids() {
  local port=$1
  lsof -tiTCP:"$port" -sTCP:LISTEN -n 2>/dev/null || true
}

try_kill_pid() {
  local pid=$1
  local label=$2
  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  echo "[WARN] 终止残留进程 $label (PID $pid)"
  kill "$pid" 2>/dev/null || true

  local count=0
  while kill -0 "$pid" 2>/dev/null && [ $count -lt 5 ]; do
    sleep 1
    count=$((count+1))
  done

  if kill -0 "$pid" 2>/dev/null; then
    echo "[WARN] 进程未响应 SIGTERM，强制终止 (PID $pid)"
    kill -9 "$pid" 2>/dev/null || true
  fi
}

ensure_port_clean() {
  local port=$1
  local name=$2
  local pids
  pids="$(find_port_pids "$port")"
  [ -z "$pids" ] && return 0

  while IFS= read -r pid; do
    [ -z "$pid" ] && continue
    local cmd
    cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    if [[ "$cmd" == *"UniSpace-AI"* ]] || [[ "$cmd" == *"nuxt dev"* ]] || [[ "$cmd" == *"bootRun"* ]] || [[ "$cmd" == *"WorkflowApplication"* ]]; then
      try_kill_pid "$pid" "$name"
    fi
  done <<< "$pids"

  if [ -n "$(find_port_pids "$port")" ]; then
    echo "[ERROR] $name 端口 $port 已被占用，请先停止占用进程或修改端口" >&2
    echo "[INFO] 占用进程信息：" >&2
    lsof -iTCP:"$port" -sTCP:LISTEN -n >&2 || true
    exit 1
  fi
}

wait_for_port() {
  local port=$1
  local max_wait=$2
  local waited=0
  while [ $waited -lt "$max_wait" ]; do
    if lsof -iTCP:"$port" -sTCP:LISTEN -n >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    waited=$((waited+1))
  done
  return 1
}

ensure_postgis_ready() {
  if lsof -iTCP:5432 -sTCP:LISTEN -n >/dev/null 2>&1; then
    echo "[INFO] 检测到 5432 端口已就绪"
    return
  fi

  if [ -z "$COMPOSE_CMD" ]; then
    echo "[ERROR] 未检测到 PostgreSQL(5432)，且未找到 docker compose，无法自动拉起 PostGIS" >&2
    echo "[INFO] 请先手动执行：docker compose up -d" >&2
    exit 1
  fi

  echo "[INFO] 未检测到 PostgreSQL(5432)，正在启动 PostGIS 容器..."
  (cd "$ROOT_DIR" && $COMPOSE_CMD up -d postgis)

  if wait_for_port 5432 30; then
    echo "[INFO] PostGIS 已就绪 (5432)"
  else
    echo "[ERROR] PostGIS 启动超时，请检查容器状态：$COMPOSE_CMD ps" >&2
    exit 1
  fi
}

should_install_frontend_deps() {
  if [ "${FORCE_NPM_INSTALL:-0}" = "1" ]; then
    echo "1"
    return
  fi

  if [ ! -d node_modules ]; then
    echo "1"
    return
  fi

  if [ ! -f node_modules/vite-plugin-checker/dist/checkers/vueTsc/typescript-vue-tsc/lib/typescript.js ]; then
    echo "1"
    return
  fi

  echo "0"
}

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
echo $$ > "$PIDFILE"

ensure_postgis_ready
ensure_port_clean 8080 "后端"
ensure_port_clean 3000 "前端"

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
  if [ "$(should_install_frontend_deps)" = "1" ]; then
    echo "[INFO] 安装前端依赖..."
    rm -rf .nuxt .output
    [ -f package-lock.json ] && npm ci || npm install
  else
    echo "[INFO] 检测到 node_modules 完整，跳过依赖安装（设置 FORCE_NPM_INSTALL=1 可强制安装）"
  fi
  echo "[INFO] 启动前端: npm run dev"
  exec npm run dev
) &
FRONTEND_PID=$!

echo "[INFO] 前端 PID: $FRONTEND_PID"
echo "[INFO] 后端 PID: $BACKEND_PID"
echo "[INFO] 前端: http://localhost:3000"
echo "[INFO] 后端: http://localhost:8080"
echo "[INFO] 按 Ctrl+C 退出"

while true; do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "[ERROR] 后端进程已退出，请查看后端日志" >&2
    exit 1
  fi

  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "[ERROR] 前端进程已退出，请查看前端日志" >&2
    exit 1
  fi

  sleep 1
done
