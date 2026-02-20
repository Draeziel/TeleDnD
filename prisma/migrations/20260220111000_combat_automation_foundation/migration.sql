ALTER TABLE "session_events"
  ADD COLUMN "event_seq" BIGSERIAL,
  ADD COLUMN "event_category" TEXT NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "payload" JSONB;

ALTER TABLE "session_events"
  ADD CONSTRAINT "session_events_event_seq_key" UNIQUE ("event_seq");

CREATE INDEX "session_events_session_id_event_seq_idx"
  ON "session_events"("sessionId", "event_seq");

CREATE TABLE "session_combat_snapshots" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "encounter_active" BOOLEAN NOT NULL DEFAULT false,
  "combat_round" INTEGER NOT NULL DEFAULT 1,
  "active_turn_session_character_id" TEXT,
  "initiative_order" JSONB NOT NULL,
  "actors" JSONB NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "session_combat_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "session_combat_snapshots_session_id_key" UNIQUE ("session_id")
);

CREATE INDEX "session_combat_snapshots_session_id_updated_at_idx"
  ON "session_combat_snapshots"("session_id", "updated_at");

ALTER TABLE "session_combat_snapshots"
  ADD CONSTRAINT "session_combat_snapshots_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "session_combat_actions" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "action_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "request_payload" JSONB NOT NULL,
  "response_payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "session_combat_actions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "session_combat_actions_session_id_idempotency_key_key"
  ON "session_combat_actions"("session_id", "idempotency_key");

CREATE INDEX "session_combat_actions_session_id_created_at_idx"
  ON "session_combat_actions"("session_id", "created_at");

ALTER TABLE "session_combat_actions"
  ADD CONSTRAINT "session_combat_actions_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "session_reaction_windows" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_ref_id" TEXT NOT NULL,
  "reaction_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "deadline_at" TIMESTAMP(3) NOT NULL,
  "requested_by_user_id" TEXT NOT NULL,
  "resolved_by_user_id" TEXT,
  "response_payload" JSONB,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "session_reaction_windows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "session_reaction_windows_session_id_status_deadline_at_idx"
  ON "session_reaction_windows"("session_id", "status", "deadline_at");

CREATE INDEX "session_reaction_windows_session_id_target_type_target_ref_id_idx"
  ON "session_reaction_windows"("session_id", "target_type", "target_ref_id");

ALTER TABLE "session_reaction_windows"
  ADD CONSTRAINT "session_reaction_windows_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
