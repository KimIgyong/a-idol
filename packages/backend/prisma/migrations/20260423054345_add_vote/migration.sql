-- CreateTable
CREATE TABLE "votes" (
    "id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "idol_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "weight" DECIMAL(8,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "votes_round_id_idol_id_idx" ON "votes"("round_id", "idol_id");

-- CreateIndex
CREATE INDEX "votes_user_id_round_id_created_at_idx" ON "votes"("user_id", "round_id", "created_at");
