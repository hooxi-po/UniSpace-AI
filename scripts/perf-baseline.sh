#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
BBOX="${BBOX:-119.1500,26.0000,119.2500,26.0800}"
PAGE_SIZE="${PAGE_SIZE:-800}"
MAX_PAGES="${MAX_PAGES:-5}"
TARGET_FIRST_SCREEN_S="${TARGET_FIRST_SCREEN_S:-10.0}"
TARGET_ENTITY_COUNT="${TARGET_ENTITY_COUNT:-6000}"
TARGET_FPS="${TARGET_FPS:-30}"

REPORT_PATH="${1:-reports/perf-baseline-$(date +%Y%m%d-%H%M%S).md}"
mkdir -p "$(dirname "$REPORT_PATH")"

measure_time_total() {
  local url="$1"
  curl -s -o /dev/null -w '%{time_total}' "$url"
}

count_features_for_layer() {
  local layer="$1"
  local total=0

  for page in $(seq 1 "$MAX_PAGES"); do
    local url="${BACKEND_URL}/api/v1/features?layers=${layer}&visible=true&bbox=${BBOX}&limit=${PAGE_SIZE}&page=${page}"
    local count
    count=$(curl -s "$url" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(String(Array.isArray(d.features)?d.features.length:0));")
    total=$((total + count))
    if [ "$count" -lt "$PAGE_SIZE" ]; then
      break
    fi
  done

  echo "$total"
}

FRONT_PAGE_S=$(measure_time_total "${FRONTEND_URL}/")
PIPES_PAGE1_S=$(measure_time_total "${BACKEND_URL}/api/v1/features?layers=pipes&visible=true&bbox=${BBOX}&limit=${PAGE_SIZE}&page=1")
BUILDINGS_PAGE1_S=$(measure_time_total "${BACKEND_URL}/api/v1/features?layers=buildings&visible=true&bbox=${BBOX}&limit=${PAGE_SIZE}&page=1")

FIRST_SCREEN_S=$(node -e "const a=Number(process.argv[1]);const b=Number(process.argv[2]);const c=Number(process.argv[3]);process.stdout.write((a+b+c).toFixed(3));" "$FRONT_PAGE_S" "$PIPES_PAGE1_S" "$BUILDINGS_PAGE1_S")

PIPES_ENTITY_COUNT=$(count_features_for_layer "pipes")
BUILDINGS_ENTITY_COUNT=$(count_features_for_layer "buildings")
TOTAL_ENTITY_COUNT=$((PIPES_ENTITY_COUNT + BUILDINGS_ENTITY_COUNT))

if [ -n "${FPS_CURRENT:-}" ]; then
  FPS_CURRENT_VALUE="$FPS_CURRENT"
  FPS_SOURCE="manual"
else
  FPS_CURRENT_VALUE=$(node -e "const n=Number(process.argv[1]);const v=Math.max(20, 60 - Math.min(35, n/500));process.stdout.write(v.toFixed(1));" "$TOTAL_ENTITY_COUNT")
  FPS_SOURCE="estimated"
fi

cat > "$REPORT_PATH" <<REPORT
# UniSpace-AI 性能基线报告

- 生成时间: $(date '+%Y-%m-%d %H:%M:%S %z')
- 前端地址: ${FRONTEND_URL}
- 后端地址: ${BACKEND_URL}
- 统计视口(bbox): ${BBOX}
- 分页参数: limit=${PAGE_SIZE}, maxPages=${MAX_PAGES}

## 基线结果（Current vs Target）

| 指标 | Current | Target |
|---|---:|---:|
| 首屏加载总耗时(秒) | ${FIRST_SCREEN_S} | <= ${TARGET_FIRST_SCREEN_S} |
| 视口内实体总量(管段+楼宇) | ${TOTAL_ENTITY_COUNT} | <= ${TARGET_ENTITY_COUNT} |
| FPS(${FPS_SOURCE}) | ${FPS_CURRENT_VALUE} | >= ${TARGET_FPS} |

## 统计明细

- 前端首页请求耗时: ${FRONT_PAGE_S}s
- 管段首屏API(page=1)耗时: ${PIPES_PAGE1_S}s
- 楼宇首屏API(page=1)耗时: ${BUILDINGS_PAGE1_S}s
- 管段实体数量: ${PIPES_ENTITY_COUNT}
- 楼宇实体数量: ${BUILDINGS_ENTITY_COUNT}

## 复现命令

\`\`\`bash
BACKEND_URL=${BACKEND_URL} FRONTEND_URL=${FRONTEND_URL} BBOX='${BBOX}' PAGE_SIZE=${PAGE_SIZE} MAX_PAGES=${MAX_PAGES} ./scripts/perf-baseline.sh
\`\`\`
REPORT

echo "[perf-baseline] report generated: ${REPORT_PATH}"
