-- CreateTable
CREATE TABLE "round_ranking_snapshots" (
    "id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "snapshot_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idol_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "round_ranking_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "round_ranking_snapshots_round_id_snapshot_at_idx" ON "round_ranking_snapshots"("round_id", "snapshot_at");

-- CreateIndex
CREATE INDEX "round_ranking_snapshots_round_id_rank_idx" ON "round_ranking_snapshots"("round_id", "rank");
