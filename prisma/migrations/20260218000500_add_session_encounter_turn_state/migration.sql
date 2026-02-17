ALTER TABLE "sessions"
  ADD COLUMN "encounter_active" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "combat_round" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "active_turn_session_character_id" TEXT;