CREATE TABLE IF NOT EXISTS "rule_dependencies" (
  "id" TEXT NOT NULL,
  "sourceRef" TEXT NOT NULL,
  "sourceType" TEXT,
  "targetRef" TEXT NOT NULL,
  "targetType" TEXT,
  "relationType" TEXT NOT NULL,
  "rulesVersion" TEXT NOT NULL DEFAULT 'v1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rule_dependencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "rule_dependencies_sourceRef_targetRef_relationType_key"
  ON "rule_dependencies"("sourceRef", "targetRef", "relationType");

CREATE INDEX IF NOT EXISTS "rule_dependencies_sourceRef_relationType_idx"
  ON "rule_dependencies"("sourceRef", "relationType");

CREATE INDEX IF NOT EXISTS "rule_dependencies_targetRef_relationType_idx"
  ON "rule_dependencies"("targetRef", "relationType");
