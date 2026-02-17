-- CreateTable
CREATE TABLE "modifiers" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "targetKey" TEXT,
    "operation" TEXT NOT NULL,
    "value" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "modifiers_source_idx" ON "modifiers"("sourceType", "sourceId");
