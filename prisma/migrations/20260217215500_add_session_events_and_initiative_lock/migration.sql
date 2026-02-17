CREATE TABLE IF NOT EXISTS "session_events" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "actorTelegramId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "session_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "session_events_sessionId_createdAt_idx"
ON "session_events"("sessionId", "createdAt");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sessions'
  ) THEN
    ALTER TABLE "sessions"
    ADD COLUMN IF NOT EXISTS "initiative_locked" BOOLEAN NOT NULL DEFAULT false;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'session_events_sessionId_fkey'
    ) THEN
      ALTER TABLE "session_events"
      ADD CONSTRAINT "session_events_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
  END IF;
END $$;
