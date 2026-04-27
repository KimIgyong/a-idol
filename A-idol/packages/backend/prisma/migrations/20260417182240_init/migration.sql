-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('email', 'apple', 'google', 'kakao');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'withdrawn');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "nickname" VARCHAR(30) NOT NULL,
    "avatar_url" TEXT,
    "instagram_handle" VARCHAR(40),
    "birthdate" DATE NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "marketing_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "push_opt_in" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "device_id" VARCHAR(80),
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idols" (
    "id" UUID NOT NULL,
    "agency_id" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "stage_name" VARCHAR(40),
    "birthdate" DATE,
    "mbti" VARCHAR(4),
    "bio" TEXT,
    "hero_image_url" TEXT,
    "heart_count" BIGINT NOT NULL DEFAULT 0,
    "follow_count" BIGINT NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "idols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hearts" (
    "user_id" UUID NOT NULL,
    "idol_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hearts_pkey" PRIMARY KEY ("user_id","idol_id")
);

-- CreateTable
CREATE TABLE "follows" (
    "user_id" UUID NOT NULL,
    "idol_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follows_pkey" PRIMARY KEY ("user_id","idol_id")
);

-- CreateTable
CREATE TABLE "fan_clubs" (
    "id" UUID NOT NULL,
    "idol_id" UUID NOT NULL,
    "tier" VARCHAR(20) NOT NULL DEFAULT 'official',
    "price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fan_clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "fan_club_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_provider_provider_user_id_key" ON "users"("provider", "provider_user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "idols_published_at_idx" ON "idols"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "fan_clubs_idol_id_key" ON "fan_clubs"("idol_id");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_fan_club_id_key" ON "memberships"("user_id", "fan_club_id");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idols" ADD CONSTRAINT "idols_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hearts" ADD CONSTRAINT "hearts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hearts" ADD CONSTRAINT "hearts_idol_id_fkey" FOREIGN KEY ("idol_id") REFERENCES "idols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follows" ADD CONSTRAINT "follows_idol_id_fkey" FOREIGN KEY ("idol_id") REFERENCES "idols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fan_clubs" ADD CONSTRAINT "fan_clubs_idol_id_fkey" FOREIGN KEY ("idol_id") REFERENCES "idols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_fan_club_id_fkey" FOREIGN KEY ("fan_club_id") REFERENCES "fan_clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
