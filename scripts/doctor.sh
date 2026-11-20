#!/usr/bin/env bash
set -euo pipefail

# Jonoshheba AI — Service Health Dashboard (scripts/doctor.sh)
# Checks infrastructure containers and application /health endpoints.

PASS=0
FAIL=0

check_http() {
  local name="$1"
  local url="$2"
  local required="${3:-true}"
  if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
    printf "  [OK]   %-22s %s\n" "$name" "$url"
    PASS=$((PASS + 1))
  else
    if [ "$required" = "true" ]; then
      printf "  [FAIL] %-22s %s\n" "$name" "$url"
      FAIL=$((FAIL + 1))
    else
      printf "  [SKIP] %-22s %s (optional)\n" "$name" "$url"
    fi
  fi
}

check_tcp() {
  local name="$1"
  local host="$2"
  local port="$3"
  if (echo >/dev/tcp/"$host"/"$port") >/dev/null 2>&1; then
    printf "  [OK]   %-22s %s:%s\n" "$name" "$host" "$port"
    PASS=$((PASS + 1))
  else
    printf "  [FAIL] %-22s %s:%s\n" "$name" "$host" "$port"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Jonoshheba AI Doctor ==="
echo ""
echo "Core Infrastructure:"
check_tcp  "PostgreSQL 16"   "127.0.0.1" "${POSTGRES_PORT:-5432}"
check_tcp  "Redis 7"         "127.0.0.1" "${REDIS_PORT:-6379}"
check_http "MinIO"           "http://127.0.0.1:${MINIO_API_PORT:-9000}/minio/health/live"
check_http "Mailpit"         "http://127.0.0.1:${MAILPIT_UI_PORT:-8025}/readyz"
check_http "MLflow"          "http://127.0.0.1:${MLFLOW_PORT:-5000}/health"
check_http "Prometheus"      "http://127.0.0.1:${PROMETHEUS_PORT:-9090}/-/healthy"
check_http "Loki"            "http://127.0.0.1:${LOKI_PORT:-3100}/ready"
check_http "Tempo"           "http://127.0.0.1:${TEMPO_PORT:-3200}/ready"
check_http "Grafana"         "http://127.0.0.1:${GRAFANA_PORT:-3005}/api/health"
check_http "OTel Collector"  "http://127.0.0.1:13133/"

echo ""
echo "Applications:"
check_http "apps/api"        "http://127.0.0.1:${API_PORT:-4000}/health"
check_http "apps/ai"         "http://127.0.0.1:${AI_PORT:-8000}/health"
check_http "apps/web"        "http://127.0.0.1:${WEB_PORT:-3000}/" "false"
check_http "apps/admin"      "http://127.0.0.1:${ADMIN_PORT:-3001}/" "false"

echo ""
echo "Optional Profiles:"
check_http "OpenSearch"      "http://127.0.0.1:${OPENSEARCH_PORT:-9200}/_cluster/health" "false"
check_http "Ollama"          "http://127.0.0.1:${OLLAMA_PORT:-11434}/api/tags" "false"

echo ""
echo "Summary: ${PASS} healthy, ${FAIL} failed."
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
