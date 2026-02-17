-- AlterTable
ALTER TABLE "character_drafts" ADD COLUMN     "abilityScoreSetId" TEXT;

-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "abilityScoreSetId" TEXT;

-- CreateTable
CREATE TABLE "ability_score_sets" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "str" INTEGER NOT NULL,
    "dex" INTEGER NOT NULL,
    "con" INTEGER NOT NULL,
    "int" INTEGER NOT NULL,
    "wis" INTEGER NOT NULL,
    "cha" INTEGER NOT NULL,

    CONSTRAINT "ability_score_sets_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_abilityScoreSetId_fkey" FOREIGN KEY ("abilityScoreSetId") REFERENCES "ability_score_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_drafts" ADD CONSTRAINT "character_drafts_abilityScoreSetId_fkey" FOREIGN KEY ("abilityScoreSetId") REFERENCES "ability_score_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
