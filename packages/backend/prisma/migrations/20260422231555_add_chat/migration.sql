-- CreateEnum
CREATE TYPE "ChatSenderType" AS ENUM ('user', 'idol');

-- CreateTable
CREATE TABLE "chat_rooms" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "idol_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMP(3),

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "sender_type" "ChatSenderType" NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_rooms_user_id_last_message_at_idx" ON "chat_rooms"("user_id", "last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "chat_rooms_user_id_idol_id_key" ON "chat_rooms"("user_id", "idol_id");

-- CreateIndex
CREATE INDEX "chat_messages_room_id_created_at_idx" ON "chat_messages"("room_id", "created_at");

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_idol_id_fkey" FOREIGN KEY ("idol_id") REFERENCES "idols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
