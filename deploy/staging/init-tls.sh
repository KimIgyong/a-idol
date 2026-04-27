#!/usr/bin/env bash
# 초기 TLS 발급 — 1회만 실행. 이후 certbot 컨테이너가 12h 마다 자동 renew.
#
# 전제:
#   - DNS 가 a-idol-stg.amoeba.site → 서버 IP 로 이미 가리키고 있음 (확인 완료)
#   - server side 에서 실행
#   - deploy.sh 로 코드/compose 가 이미 한 번 올라온 상태
#   - 첫 시도 시 nginx server block 에 ssl_certificate 경로가 없으면 부팅 실패하므로
#     본 스크립트가 nginx 를 먼저 HTTP-only 모드로 띄운 뒤 발급 → HTTPS 활성화 순서 적용.
set -euo pipefail
cd "$(dirname "$0")"

DOMAIN="${DOMAIN:-a-idol-stg.amoeba.site}"
EMAIL="${EMAIL:-gray.kim@amoeba.group}"
ENV_FILE=".env.staging"
COMPOSE="docker compose -f docker-compose.staging.yml --env-file ${ENV_FILE} -p a-idol-stg"

echo "🛡  Let's Encrypt 인증서 발급 — ${DOMAIN}"

# 1) HTTP-only 모드로 nginx + certbot webroot 만 띄움 (HTTPS 부분 임시 비활성화)
echo "1) HTTP-only nginx 임시 부팅"
mkdir -p ./nginx/conf.d.bak
cp ./nginx/conf.d/a-idol-stg.conf ./nginx/conf.d.bak/a-idol-stg.conf

# HTTPS server block 임시 주석 처리한 conf 생성
sed '/^server {$/,$d' ./nginx/conf.d.bak/a-idol-stg.conf > ./nginx/conf.d/a-idol-stg.conf
# 위 sed 는 두번째 server { 부터 끝까지 자름 (HTTPS 블록 제거). HTTP 블록만 남음.

${COMPOSE} up -d nginx
sleep 3

# 2) certbot 으로 발급
echo "2) certbot 발급 시도"
${COMPOSE} run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --email "${EMAIL}" \
  --agree-tos --no-eff-email \
  -d "${DOMAIN}"

# 3) 원본 conf 복원
echo "3) HTTPS 활성화 conf 복원"
mv ./nginx/conf.d.bak/a-idol-stg.conf ./nginx/conf.d/a-idol-stg.conf
rmdir ./nginx/conf.d.bak

# 4) nginx reload (full restart 아닌 reload — TLS 자산만 다시 읽음)
${COMPOSE} exec nginx nginx -s reload

echo "✅  TLS 활성화 완료. https://${DOMAIN}"
