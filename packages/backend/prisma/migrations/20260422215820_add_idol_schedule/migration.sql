-- CreateEnum
CREATE TYPE "IdolScheduleType" AS ENUM ('BROADCAST', 'CONCERT', 'FANMEETING', 'STREAMING', 'OTHER');

-- CreateTable
CREATE TABLE "idol_schedules" (
    "id" UUID NOT NULL,
    "idol_id" UUID NOT NULL,
    "type" "IdolScheduleType" NOT NULL DEFAULT 'OTHER',
    "title" VARCHAR(120) NOT NULL,
    "location" VARCHAR(120),
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "idol_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idol_schedules_idol_id_start_at_idx" ON "idol_schedules"("idol_id", "start_at");

-- AddForeignKey
ALTER TABLE "idol_schedules" ADD CONSTRAINT "idol_schedules_idol_id_fkey" FOREIGN KEY ("idol_id") REFERENCES "idols"("id") ON DELETE CASCADE ON UPDATE CASCADE;
