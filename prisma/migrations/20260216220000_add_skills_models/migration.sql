-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ability" TEXT NOT NULL,
    "contentSourceId" TEXT,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "skills_contentSourceId_fkey" FOREIGN KEY ("contentSourceId") REFERENCES "content_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateTable
CREATE TABLE "character_skill_proficiencies" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "character_skill_proficiencies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "character_skill_proficiencies_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "character_skill_proficiencies_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "character_skill_proficiencies_characterId_skillId_key" ON "character_skill_proficiencies"("characterId", "skillId");
