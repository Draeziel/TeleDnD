-- CreateTable
CREATE TABLE "character_drafts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "classId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_draft_choices" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "choiceId" TEXT NOT NULL,
    "selectedOption" TEXT,

    CONSTRAINT "character_draft_choices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "character_draft_choices_draftId_choiceId_key" ON "character_draft_choices"("draftId", "choiceId");

-- AddForeignKey
ALTER TABLE "character_drafts" ADD CONSTRAINT "character_drafts_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_draft_choices" ADD CONSTRAINT "character_draft_choices_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "character_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_draft_choices" ADD CONSTRAINT "character_draft_choices_choiceId_fkey" FOREIGN KEY ("choiceId") REFERENCES "choices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
