-- CreateEnum
CREATE TYPE "VoteMethod" AS ENUM ('HEART', 'SMS', 'TICKET');

-- CreateTable
CREATE TABLE "vote_rules" (
    "id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "heart_weight" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "sms_weight" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "ticket_weight" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "daily_heart_limit" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vote_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vote_rules_round_id_key" ON "vote_rules"("round_id");

-- AddForeignKey
ALTER TABLE "vote_rules" ADD CONSTRAINT "vote_rules_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
