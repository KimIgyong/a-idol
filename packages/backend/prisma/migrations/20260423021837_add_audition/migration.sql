-- CreateEnum
CREATE TYPE "AuditionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'FINISHED', 'CANCELED');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "auditions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "status" "AuditionStatus" NOT NULL DEFAULT 'DRAFT',
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "auditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" UUID NOT NULL,
    "audition_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "order_index" INTEGER NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'SCHEDULED',
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "max_advancers" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audition_entries" (
    "id" UUID NOT NULL,
    "audition_id" UUID NOT NULL,
    "idol_id" UUID NOT NULL,
    "eliminated_at" TIMESTAMP(3),
    "eliminated_at_round_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audition_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auditions_status_start_at_idx" ON "auditions"("status", "start_at");

-- CreateIndex
CREATE INDEX "rounds_audition_id_status_idx" ON "rounds"("audition_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_audition_id_order_index_key" ON "rounds"("audition_id", "order_index");

-- CreateIndex
CREATE INDEX "audition_entries_idol_id_idx" ON "audition_entries"("idol_id");

-- CreateIndex
CREATE UNIQUE INDEX "audition_entries_audition_id_idol_id_key" ON "audition_entries"("audition_id", "idol_id");

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_audition_id_fkey" FOREIGN KEY ("audition_id") REFERENCES "auditions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audition_entries" ADD CONSTRAINT "audition_entries_audition_id_fkey" FOREIGN KEY ("audition_id") REFERENCES "auditions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audition_entries" ADD CONSTRAINT "audition_entries_idol_id_fkey" FOREIGN KEY ("idol_id") REFERENCES "idols"("id") ON DELETE CASCADE ON UPDATE CASCADE;
