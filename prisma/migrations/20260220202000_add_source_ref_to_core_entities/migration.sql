ALTER TABLE "classes"
  ADD COLUMN IF NOT EXISTS "rulesVersion" TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS "sourceRef" TEXT;

ALTER TABLE "races"
  ADD COLUMN IF NOT EXISTS "rulesVersion" TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS "sourceRef" TEXT;

ALTER TABLE "backgrounds"
  ADD COLUMN IF NOT EXISTS "rulesVersion" TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS "sourceRef" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "classes_sourceRef_key"
  ON "classes"("sourceRef")
  WHERE "sourceRef" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "races_sourceRef_key"
  ON "races"("sourceRef")
  WHERE "sourceRef" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "backgrounds_sourceRef_key"
  ON "backgrounds"("sourceRef")
  WHERE "sourceRef" IS NOT NULL;
