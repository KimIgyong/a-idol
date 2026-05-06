-- REQ-260507 — 첨부파일 테이블 + 프로젝트 노트 테이블 신설.

-- CreateEnum
CREATE TYPE "AttachmentOwnerType" AS ENUM ('ISSUE', 'NOTE', 'DOC', 'DRAFT');
CREATE TYPE "ProjectNoteCategory" AS ENUM ('NOTE', 'MEETING', 'DECISION', 'LINK', 'OTHER');

-- CreateTable: attachments
CREATE TABLE "attachments" (
  "id" UUID NOT NULL,
  "owner_type" "AttachmentOwnerType" NOT NULL,
  "owner_id" UUID,
  "filename" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(120) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "storage_key" VARCHAR(500) NOT NULL,
  "uploaded_by_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "attachments_owner_type_owner_id_idx" ON "attachments" ("owner_type", "owner_id");
CREATE INDEX "attachments_uploaded_by_id_idx" ON "attachments" ("uploaded_by_id");

-- CreateTable: project_notes
CREATE TABLE "project_notes" (
  "id" UUID NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "body" TEXT NOT NULL,
  "category" "ProjectNoteCategory" NOT NULL DEFAULT 'NOTE',
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "author_admin_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_notes_category_idx" ON "project_notes" ("category");
CREATE INDEX "project_notes_pinned_updated_at_idx" ON "project_notes" ("pinned", "updated_at" DESC);
CREATE INDEX "project_notes_author_admin_id_idx" ON "project_notes" ("author_admin_id");
