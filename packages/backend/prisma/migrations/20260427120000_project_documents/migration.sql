-- CreateEnum
CREATE TYPE "ProjectDocCategory" AS ENUM ('ADR', 'DESIGN', 'IMPLEMENTATION', 'DELIVERABLE', 'REPORT', 'OPS', 'OTHER');

-- CreateEnum
CREATE TYPE "ProjectDocStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectDocSourceType" AS ENUM ('FILE', 'INLINE');

-- CreateTable
CREATE TABLE "project_documents" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "category" "ProjectDocCategory" NOT NULL,
    "status" "ProjectDocStatus" NOT NULL DEFAULT 'DRAFT',
    "source_type" "ProjectDocSourceType" NOT NULL DEFAULT 'INLINE',
    "source_path" VARCHAR(500),
    "summary" VARCHAR(500),
    "content" TEXT NOT NULL,
    "tags" VARCHAR(500),
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_documents_slug_key" ON "project_documents"("slug");

-- CreateIndex
CREATE INDEX "project_documents_category_order_index_idx" ON "project_documents"("category", "order_index");

-- CreateIndex
CREATE INDEX "project_documents_status_idx" ON "project_documents"("status");
