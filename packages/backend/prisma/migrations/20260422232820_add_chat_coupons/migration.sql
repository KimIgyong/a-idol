-- CreateEnum
CREATE TYPE "CouponReason" AS ENUM ('ADMIN_GRANT', 'PURCHASE', 'MESSAGE_CONSUME', 'REFUND', 'DAILY_GIFT');

-- CreateTable
CREATE TABLE "chat_quotas" (
    "user_id" UUID NOT NULL,
    "messages_today" INTEGER NOT NULL DEFAULT 0,
    "daily_limit" INTEGER NOT NULL DEFAULT 5,
    "last_reset_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_quotas_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "chat_coupon_wallets" (
    "user_id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_coupon_wallets_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "chat_coupon_ledger" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "CouponReason" NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_coupon_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_coupon_ledger_user_id_created_at_idx" ON "chat_coupon_ledger"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "chat_quotas" ADD CONSTRAINT "chat_quotas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_coupon_wallets" ADD CONSTRAINT "chat_coupon_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_coupon_ledger" ADD CONSTRAINT "chat_coupon_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
