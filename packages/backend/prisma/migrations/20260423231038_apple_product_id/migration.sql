-- AlterTable: add `apple_product_id` to `purchase_products` with a UNIQUE index.
-- Nullable because non-IAP products (operator-only, dev-sandbox fixtures) may
-- not have an Apple App Store Connect product id. NULL does not collide with
-- the unique constraint in Postgres, so existing rows upgrade cleanly.
ALTER TABLE "purchase_products" ADD COLUMN "apple_product_id" VARCHAR(120);
CREATE UNIQUE INDEX "purchase_products_apple_product_id_key"
  ON "purchase_products"("apple_product_id");
