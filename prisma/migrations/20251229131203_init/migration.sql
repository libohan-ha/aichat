-- CreateTable
CREATE TABLE "characters" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT '/placeholder.svg',
    "prompt" TEXT NOT NULL,
    "background" TEXT,
    "background_size" TEXT DEFAULT 'cover',
    "background_position" TEXT DEFAULT 'center',
    "background_repeat" TEXT DEFAULT 'no-repeat',
    "user_avatar" TEXT DEFAULT '/placeholder-user.jpg',
    "bubble_user_opacity" DOUBLE PRECISION DEFAULT 1,
    "bubble_ai_opacity" DOUBLE PRECISION DEFAULT 1,
    "model" TEXT DEFAULT 'deepseek-chat',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL DEFAULT 'default',
    "character_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "images" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL DEFAULT 'default',
    "chat_background" TEXT DEFAULT '',
    "current_character_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "characters_user_id_idx" ON "characters"("user_id");

-- CreateIndex
CREATE INDEX "messages_user_id_character_id_idx" ON "messages"("user_id", "character_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
