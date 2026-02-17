-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gmUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sessions_gmUserId_fkey" FOREIGN KEY ("gmUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sessions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session_players" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_players_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "session_players_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "session_players_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session_characters" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_characters_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "session_characters_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "session_characters_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session_character_states" (
    "id" TEXT NOT NULL,
    "sessionCharacterId" TEXT NOT NULL,
    "currentHp" INTEGER NOT NULL DEFAULT 0,
    "maxHpSnapshot" INTEGER NOT NULL DEFAULT 0,
    "tempHp" INTEGER,
    "initiative" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_character_states_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "session_character_states_sessionCharacterId_fkey" FOREIGN KEY ("sessionCharacterId") REFERENCES "session_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session_effects" (
    "id" TEXT NOT NULL,
    "sessionCharacterId" TEXT NOT NULL,
    "effectType" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_effects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "session_effects_sessionCharacterId_fkey" FOREIGN KEY ("sessionCharacterId") REFERENCES "session_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "characters" ADD COLUMN "ownerUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramId_key" ON "users"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_joinCode_key" ON "sessions"("joinCode");

-- CreateIndex
CREATE INDEX "sessions_gmUserId_idx" ON "sessions"("gmUserId");

-- CreateIndex
CREATE INDEX "sessions_createdByUserId_idx" ON "sessions"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "session_players_sessionId_userId_key" ON "session_players"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "session_players_userId_idx" ON "session_players"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_characters_sessionId_characterId_key" ON "session_characters"("sessionId", "characterId");

-- CreateIndex
CREATE INDEX "session_characters_characterId_idx" ON "session_characters"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "session_character_states_sessionCharacterId_key" ON "session_character_states"("sessionCharacterId");

-- CreateIndex
CREATE INDEX "session_effects_sessionCharacterId_idx" ON "session_effects"("sessionCharacterId");

-- CreateIndex
CREATE INDEX "characters_ownerUserId_idx" ON "characters"("ownerUserId");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
