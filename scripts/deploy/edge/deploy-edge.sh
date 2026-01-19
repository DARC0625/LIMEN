#!/usr/bin/env bash
set -euo pipefail

# ✅ P1-Next-Fix-Module-4F: Edge 배포 스크립트
# 태그 배포 금지, digest만 허용
# 실패 시 자동 롤백

IMAGE_REF="${1:-}"
if [[ -z "${IMAGE_REF}" ]]; then
  echo "usage: deploy-edge.sh <image@sha256:...>"
  exit 1
fi

# 태그 배포 거부
if [[ "${IMAGE_REF}" != *@sha256:* ]]; then
  echo "FATAL: tag deploy is forbidden. Use digest only."
  exit 1
fi

ROOT="/opt/limen/edge"
mkdir -p "${ROOT}"
touch "${ROOT}/current_image" "${ROOT}/prev_image"

# 이전 이미지 백업
PREV="$(cat "${ROOT}/current_image" 2>/dev/null || true)"
if [[ -n "${PREV}" ]]; then
  echo "${PREV}" > "${ROOT}/prev_image"
fi

# 현재 이미지 기록
echo "${IMAGE_REF}" > "${ROOT}/current_image"

cd "${ROOT}"

# docker-compose.yml이 없으면 생성 (예시)
if [[ ! -f "docker-compose.yml" ]]; then
  cat > docker-compose.yml <<'EOF'
version: '3.8'
services:
  edge:
    image: ${LIMEN_EDGE_IMAGE}
    restart: unless-stopped
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
EOF
fi

# 이미지 pull
export LIMEN_EDGE_IMAGE="${IMAGE_REF}"
docker compose pull || {
  echo "Failed to pull image. Rolling back..."
  if [[ -n "${PREV}" ]] && [[ "${PREV}" == *@sha256:* ]]; then
    export LIMEN_EDGE_IMAGE="${PREV}"
    docker compose pull
    docker compose up -d
  fi
  exit 1
  exit 1
}

# 배포
docker compose up -d || {
  echo "Failed to start container. Rolling back..."
  if [[ -n "${PREV}" ]] && [[ "${PREV}" == *@sha256:* ]]; then
    export LIMEN_EDGE_IMAGE="${PREV}"
    docker compose up -d
  fi
  exit 1
}

# 헬스체크 (프로젝트에 맞게 조정)
HEALTH_URL="http://127.0.0.1:3000/healthz"
MAX_RETRIES=10
RETRY_INTERVAL=5

for i in $(seq 1 ${MAX_RETRIES}); do
  if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
    echo "Healthcheck passed"
    echo "Edge deploy OK: ${IMAGE_REF}"
    exit 0
  fi
  echo "Healthcheck attempt ${i}/${MAX_RETRIES} failed, retrying in ${RETRY_INTERVAL}s..."
  sleep ${RETRY_INTERVAL}
done

# 헬스체크 실패 시 롤백
echo "Healthcheck failed after ${MAX_RETRIES} attempts. Rolling back..."
RB="$(cat "${ROOT}/prev_image" 2>/dev/null || true)"
if [[ -z "${RB}" ]] || [[ "${RB}" != *@sha256:* ]]; then
  echo "No valid rollback image. Manual intervention required."
  exit 2
fi

export LIMEN_EDGE_IMAGE="${RB}"
docker compose pull
docker compose up -d

# 롤백 후 헬스체크
sleep 10
if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
  echo "Rollback successful: ${RB}"
  exit 3
else
  echo "Rollback failed. Manual intervention required."
  exit 4
fi
