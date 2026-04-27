-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('admin', 'operator', 'viewer');

-- CreateEnum
CREATE TYPE "AdminStatus" AS ENUM ('active', 'suspended');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" VARCHAR(40) NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'operator',
    "status" "AdminStatus" NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");
