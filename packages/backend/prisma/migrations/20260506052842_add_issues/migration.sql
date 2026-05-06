-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('TASK', 'BUG', 'STORY', 'RISK');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('P0', 'P1', 'P2', 'P3');

-- CreateTable
CREATE TABLE "issues" (
    "id" UUID NOT NULL,
    "key" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "type" "IssueType" NOT NULL DEFAULT 'TASK',
    "status" "IssueStatus" NOT NULL DEFAULT 'BACKLOG',
    "priority" "IssuePriority" NOT NULL DEFAULT 'P2',
    "order_in_column" INTEGER NOT NULL DEFAULT 0,
    "assignee_admin_id" UUID,
    "reporter_admin_id" UUID,
    "due_date" DATE,
    "labels" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "issues_key_key" ON "issues"("key");

-- CreateIndex
CREATE INDEX "issues_status_order_in_column_idx" ON "issues"("status", "order_in_column");

-- CreateIndex
CREATE INDEX "issues_assignee_admin_id_idx" ON "issues"("assignee_admin_id");

-- CreateIndex
CREATE INDEX "issues_reporter_admin_id_idx" ON "issues"("reporter_admin_id");

-- CreateIndex
CREATE INDEX "issues_type_idx" ON "issues"("type");

-- CreateIndex
CREATE INDEX "issues_priority_idx" ON "issues"("priority");

-- RPT-260506: human-readable issue key sequence ('IIS-1', 'IIS-2', ...)
CREATE SEQUENCE IF NOT EXISTS issue_key_seq START 1;
