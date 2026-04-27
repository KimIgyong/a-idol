-- AlterTable
ALTER TABLE "idols" ADD COLUMN     "profile_json" JSONB;

-- CreateTable
CREATE TABLE "idol_images" (
    "id" UUID NOT NULL,
    "idol_id" UUID NOT NULL,
    "image_type" VARCHAR(32) NOT NULL,
    "image_url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idol_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idol_images_idol_id_sort_order_idx" ON "idol_images"("idol_id", "sort_order");

-- AddForeignKey
ALTER TABLE "idol_images" ADD CONSTRAINT "idol_images_idol_id_fkey" FOREIGN KEY ("idol_id") REFERENCES "idols"("id") ON DELETE CASCADE ON UPDATE CASCADE;
