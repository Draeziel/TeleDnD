CREATE TABLE "session_monster_effects" (
  "id" TEXT NOT NULL,
  "session_monster_id" TEXT NOT NULL,
  "effect_type" TEXT NOT NULL,
  "duration" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "session_monster_effects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "session_monster_effects_session_monster_id_idx"
  ON "session_monster_effects"("session_monster_id");

ALTER TABLE "session_monster_effects"
  ADD CONSTRAINT "session_monster_effects_session_monster_id_fkey"
  FOREIGN KEY ("session_monster_id")
  REFERENCES "session_monsters"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
