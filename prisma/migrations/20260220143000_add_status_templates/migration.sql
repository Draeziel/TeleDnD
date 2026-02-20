CREATE TABLE IF NOT EXISTS "status_templates" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "effect_type" TEXT NOT NULL,
  "default_duration" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "status_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "status_templates_key_key"
  ON "status_templates"("key");

CREATE INDEX IF NOT EXISTS "status_templates_is_active_idx"
  ON "status_templates"("is_active");

INSERT INTO "status_templates" (
  "id",
  "key",
  "name",
  "effect_type",
  "default_duration",
  "payload",
  "is_active",
  "created_at",
  "updated_at"
)
VALUES (
  'f5a6be80-6f57-4f0a-8f66-32fd36f4f491',
  'poisoned_d6',
  'Отравлен (1d6)',
  'poisoned',
  '3 раунд(ов)',
  '{
    "automation": {
      "kind": "POISON_TICK",
      "trigger": "TURN_START",
      "damage": {
        "mode": "dice",
        "count": 1,
        "sides": 6,
        "bonus": 0
      },
      "roundsLeft": 3,
      "save": {
        "ability": "con",
        "dieSides": 12,
        "threshold": 10,
        "halfOnSave": true
      }
    }
  }'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
