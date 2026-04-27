-- CreateTable
CREATE TABLE "round_vote_ticket_balances" (
    "user_id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "round_vote_ticket_balances_pkey" PRIMARY KEY ("user_id","round_id")
);

-- CreateTable
CREATE TABLE "round_vote_ticket_ledger" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "VoteTicketReason" NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "round_vote_ticket_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "round_vote_ticket_balances_round_id_idx" ON "round_vote_ticket_balances"("round_id");

-- CreateIndex
CREATE INDEX "round_vote_ticket_ledger_user_id_round_id_created_at_idx" ON "round_vote_ticket_ledger"("user_id", "round_id", "created_at");

-- AddForeignKey
ALTER TABLE "round_vote_ticket_balances" ADD CONSTRAINT "round_vote_ticket_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_vote_ticket_balances" ADD CONSTRAINT "round_vote_ticket_balances_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_vote_ticket_ledger" ADD CONSTRAINT "round_vote_ticket_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_vote_ticket_ledger" ADD CONSTRAINT "round_vote_ticket_ledger_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
