-- CreateEnum
CREATE TYPE "PhotocardRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "PhotocardSource" AS ENUM ('PURCHASE', 'ADMIN_GRANT');

-- CreateTable
CREATE TABLE "photocard_sets" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "idol_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photocard_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photocard_templates" (
    "id" UUID NOT NULL,
    "set_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "image_url" TEXT,
    "rarity" "PhotocardRarity" NOT NULL DEFAULT 'COMMON',
    "drop_weight" INTEGER NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photocard_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_photocards" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "source" "PhotocardSource" NOT NULL,
    "source_ref" VARCHAR(120),
    "obtained_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_photocards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "photocard_sets_is_active_created_at_idx" ON "photocard_sets"("is_active", "created_at");

-- CreateIndex
CREATE INDEX "photocard_templates_set_id_is_active_idx" ON "photocard_templates"("set_id", "is_active");

-- CreateIndex
CREATE INDEX "photocard_templates_rarity_idx" ON "photocard_templates"("rarity");

-- CreateIndex
CREATE INDEX "user_photocards_user_id_obtained_at_idx" ON "user_photocards"("user_id", "obtained_at");

-- CreateIndex
CREATE INDEX "user_photocards_template_id_idx" ON "user_photocards"("template_id");

-- AddForeignKey
ALTER TABLE "photocard_sets" ADD CONSTRAINT "photocard_sets_idol_id_fkey" FOREIGN KEY ("idol_id") REFERENCES "idols"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photocard_templates" ADD CONSTRAINT "photocard_templates_set_id_fkey" FOREIGN KEY ("set_id") REFERENCES "photocard_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_photocards" ADD CONSTRAINT "user_photocards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_photocards" ADD CONSTRAINT "user_photocards_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "photocard_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
