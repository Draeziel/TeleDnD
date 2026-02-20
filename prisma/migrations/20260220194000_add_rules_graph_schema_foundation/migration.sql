ALTER TABLE "features"
  ADD COLUMN IF NOT EXISTS "rulesVersion" TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS "sourceRef" TEXT;

ALTER TABLE "choices"
  ADD COLUMN IF NOT EXISTS "rulesVersion" TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS "sourceRef" TEXT;

ALTER TABLE "modifiers"
  ADD COLUMN IF NOT EXISTS "rulesVersion" TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS "sourceRef" TEXT;

ALTER TABLE "items"
  ADD COLUMN IF NOT EXISTS "weaponCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "attackAbility" TEXT,
  ADD COLUMN IF NOT EXISTS "damageFormula" TEXT,
  ADD COLUMN IF NOT EXISTS "proficiencyRequirements" JSONB,
  ADD COLUMN IF NOT EXISTS "armorType" TEXT,
  ADD COLUMN IF NOT EXISTS "rulesVersion" TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS "sourceRef" TEXT;

CREATE TABLE IF NOT EXISTS "class_level_progressions" (
  "id" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "featureId" TEXT NOT NULL,
  CONSTRAINT "class_level_progressions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "class_level_progressions_classId_level_featureId_key"
  ON "class_level_progressions"("classId", "level", "featureId");

CREATE INDEX IF NOT EXISTS "class_level_progressions_classId_level_idx"
  ON "class_level_progressions"("classId", "level");

CREATE TABLE IF NOT EXISTS "actions" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "contentSourceId" TEXT NOT NULL,
  "featureId" TEXT,
  "rulesVersion" TEXT NOT NULL DEFAULT 'v1',
  "sourceRef" TEXT,
  "payloadType" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "triggerJson" JSONB,
  CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "actions_featureId_idx"
  ON "actions"("featureId");

CREATE INDEX IF NOT EXISTS "actions_payloadType_idx"
  ON "actions"("payloadType");

CREATE TABLE IF NOT EXISTS "spells" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "level" INTEGER,
  "school" TEXT,
  "itemId" TEXT,
  "contentSourceId" TEXT NOT NULL,
  "rulesVersion" TEXT NOT NULL DEFAULT 'v1',
  "sourceRef" TEXT,
  "payloadType" TEXT NOT NULL DEFAULT 'CUSTOM',
  "payloadJson" JSONB,
  CONSTRAINT "spells_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "spells_name_key"
  ON "spells"("name");

CREATE INDEX IF NOT EXISTS "spells_itemId_idx"
  ON "spells"("itemId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'class_level_progressions_classId_fkey'
  ) THEN
    ALTER TABLE "class_level_progressions"
      ADD CONSTRAINT "class_level_progressions_classId_fkey"
      FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'class_level_progressions_featureId_fkey'
  ) THEN
    ALTER TABLE "class_level_progressions"
      ADD CONSTRAINT "class_level_progressions_featureId_fkey"
      FOREIGN KEY ("featureId") REFERENCES "features"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'actions_contentSourceId_fkey'
  ) THEN
    ALTER TABLE "actions"
      ADD CONSTRAINT "actions_contentSourceId_fkey"
      FOREIGN KEY ("contentSourceId") REFERENCES "content_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'actions_featureId_fkey'
  ) THEN
    ALTER TABLE "actions"
      ADD CONSTRAINT "actions_featureId_fkey"
      FOREIGN KEY ("featureId") REFERENCES "features"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'spells_contentSourceId_fkey'
  ) THEN
    ALTER TABLE "spells"
      ADD CONSTRAINT "spells_contentSourceId_fkey"
      FOREIGN KEY ("contentSourceId") REFERENCES "content_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'spells_itemId_fkey'
  ) THEN
    ALTER TABLE "spells"
      ADD CONSTRAINT "spells_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
