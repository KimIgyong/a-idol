-- CreateEnum
CREATE TYPE "AutoMessageStatus" AS ENUM ('SCHEDULED', 'DISPATCHED', 'CANCELED', 'FAILED');

-- CreateTable
CREATE TABLE "auto_message_templates" (
    "id" UUID NOT NULL,
    "idol_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "AutoMessageStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_by" UUID NOT NULL,
    "dispatched_at" TIMESTAMP(3),
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "failed_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auto_message_templates_idol_id_scheduled_at_idx" ON "auto_message_templates"("idol_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "auto_message_templates_status_scheduled_at_idx" ON "auto_message_templates"("status", "scheduled_at");

-- AddForeignKey
ALTER TABLE "auto_message_templates" ADD CONSTRAINT "auto_message_templates_idol_id_fkey" FOREIGN KEY ("idol_id") REFERENCES "idols"("id") ON DELETE CASCADE ON UPDATE CASCADE;
