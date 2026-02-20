DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sessions'
  ) THEN
    ALTER TABLE "sessions"
    ADD COLUMN IF NOT EXISTS "initiative_locked" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
