-- CreateEnum
CREATE TYPE "VoteTicketReason" AS ENUM ('PURCHASE', 'VOTE_CAST', 'ADMIN_GRANT', 'REFUND');

-- CreateTable
CREATE TABLE "vote_ticket_balances" (
    "user_id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vote_ticket_balances_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "vote_ticket_ledger" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "VoteTicketReason" NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vote_ticket_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vote_ticket_ledger_user_id_created_at_idx" ON "vote_ticket_ledger"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "vote_ticket_balances" ADD CONSTRAINT "vote_ticket_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote_ticket_ledger" ADD CONSTRAINT "vote_ticket_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
