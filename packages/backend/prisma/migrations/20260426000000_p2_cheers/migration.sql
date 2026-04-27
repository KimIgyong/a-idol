-- RPT-260426-C P2 — 응원댓글 (Cheer)
-- SCR-006 아이돌 상세에서 사용. MVP는 단순 텍스트.

CREATE TABLE "cheers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "idol_id" UUID NOT NULL,
    "message" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cheers_pkey" PRIMARY KEY ("id")
);

-- Idol detail에서 응원댓글 조회 — 최신순 (createdAt DESC).
CREATE INDEX "cheers_idol_id_created_at_idx" ON "cheers"("idol_id", "created_at" DESC);

-- 마이페이지 — 내가 쓴 응원댓글 (Phase 4 SCR-021~024 후보).
CREATE INDEX "cheers_user_id_created_at_idx" ON "cheers"("user_id", "created_at" DESC);

ALTER TABLE "cheers" ADD CONSTRAINT "cheers_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cheers" ADD CONSTRAINT "cheers_idol_id_fkey"
    FOREIGN KEY ("idol_id") REFERENCES "idols"("id") ON DELETE CASCADE ON UPDATE CASCADE;
