-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('CHAT_COUPON', 'VOTE_TICKET', 'FAN_CLUB_SUBSCRIPTION', 'PHOTOCARD_PACK');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('DEV_SANDBOX', 'APPLE_IAP', 'GOOGLE_IAP', 'STRIPE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'FULFILLED', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "purchase_products" (
    "id" UUID NOT NULL,
    "sku" VARCHAR(60) NOT NULL,
    "kind" "ProductKind" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "price_krw" INTEGER NOT NULL,
    "delivery_payload" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "provider_tx_id" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "price_krw" INTEGER NOT NULL,
    "delivery_snapshot" JSONB NOT NULL,
    "fulfilled_at" TIMESTAMP(3),
    "failed_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_products_sku_key" ON "purchase_products"("sku");

-- CreateIndex
CREATE INDEX "purchase_products_kind_is_active_idx" ON "purchase_products"("kind", "is_active");

-- CreateIndex
CREATE INDEX "purchase_transactions_user_id_created_at_idx" ON "purchase_transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "purchase_transactions_status_created_at_idx" ON "purchase_transactions"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_transactions_provider_provider_tx_id_key" ON "purchase_transactions"("provider", "provider_tx_id");

-- AddForeignKey
ALTER TABLE "purchase_transactions" ADD CONSTRAINT "purchase_transactions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "purchase_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
