-- RPT-260426-D Phase D T-085 — App Store / Play 디자인 자산 관리.
-- 디자이너 + PO + 법무 협업 트래킹용. 자산 자체는 외부 storage(S3 등) URL.

CREATE TYPE "DesignAssetType" AS ENUM (
    'APP_ICON',
    'SCREENSHOT',
    'FEATURE_GRAPHIC',
    'SPLASH',
    'PREVIEW_VIDEO',
    'PERSONA_IMAGE',
    'PHOTOCARD_ART',
    'OTHER'
);

CREATE TYPE "DesignAssetPlatform" AS ENUM ('IOS', 'ANDROID', 'WEB', 'ALL');

CREATE TYPE "DesignAssetStatus" AS ENUM (
    'PLACEHOLDER',
    'DRAFT',
    'APPROVED',
    'LEGAL_REVIEWED',
    'SHIPPED'
);

CREATE TABLE "design_assets" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "DesignAssetType" NOT NULL,
    "platform" "DesignAssetPlatform" NOT NULL DEFAULT 'ALL',
    "status" "DesignAssetStatus" NOT NULL DEFAULT 'PLACEHOLDER',
    "file_url" VARCHAR(500),
    "spec" VARCHAR(200),
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "caption" VARCHAR(200),
    "notes" VARCHAR(2000),
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_assets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "design_assets_type_platform_order_index_idx"
    ON "design_assets"("type", "platform", "order_index");
CREATE INDEX "design_assets_status_idx" ON "design_assets"("status");
