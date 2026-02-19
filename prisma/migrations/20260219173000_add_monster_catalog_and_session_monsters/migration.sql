CREATE TABLE "monster_templates" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "armor_class" INTEGER NOT NULL,
  "max_hp" INTEGER NOT NULL,
  "initiative_modifier" INTEGER NOT NULL DEFAULT 0,
  "challenge_rating" TEXT,
  "source" TEXT,
  "scope" TEXT NOT NULL DEFAULT 'PERSONAL',
  "owner_user_id" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "monster_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "session_monsters" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "monster_template_id" TEXT,
  "name_snapshot" TEXT NOT NULL,
  "current_hp" INTEGER NOT NULL,
  "max_hp_snapshot" INTEGER NOT NULL,
  "initiative" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "session_monsters_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "monster_templates_scope_idx" ON "monster_templates"("scope");
CREATE INDEX "monster_templates_owner_user_id_idx" ON "monster_templates"("owner_user_id");
CREATE INDEX "session_monsters_sessionId_idx" ON "session_monsters"("sessionId");
CREATE INDEX "session_monsters_monster_template_id_idx" ON "session_monsters"("monster_template_id");

ALTER TABLE "monster_templates"
  ADD CONSTRAINT "monster_templates_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "session_monsters"
  ADD CONSTRAINT "session_monsters_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "session_monsters"
  ADD CONSTRAINT "session_monsters_monster_template_id_fkey"
  FOREIGN KEY ("monster_template_id") REFERENCES "monster_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;