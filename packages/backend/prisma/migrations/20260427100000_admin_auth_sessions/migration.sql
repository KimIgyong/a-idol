-- RPT-260426-D Phase D T-082 — admin refresh token server-side persistence.
-- stateless JWT 만 사용하던 admin 인증에 revocation 능력 추가.
-- user측 `auth_sessions` 와 동일 패턴.

CREATE TABLE "admin_auth_sessions" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "admin_auth_sessions_pkey" PRIMARY KEY ("id")
);

-- 한 admin이 여러 device로 로그인 가능 — 빠른 lookup용 인덱스.
CREATE INDEX "admin_auth_sessions_admin_user_id_idx" ON "admin_auth_sessions"("admin_user_id");

ALTER TABLE "admin_auth_sessions" ADD CONSTRAINT "admin_auth_sessions_admin_user_id_fkey"
    FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
