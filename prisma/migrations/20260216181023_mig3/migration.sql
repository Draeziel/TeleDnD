-- AlterTable
ALTER TABLE "character_drafts" ADD COLUMN     "backgroundId" TEXT,
ADD COLUMN     "raceId" TEXT;

-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "backgroundId" TEXT,
ADD COLUMN     "raceId" TEXT;

-- CreateTable
CREATE TABLE "races" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentSourceId" TEXT NOT NULL,

    CONSTRAINT "races_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "race_features" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,

    CONSTRAINT "race_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backgrounds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentSourceId" TEXT NOT NULL,

    CONSTRAINT "backgrounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "background_features" (
    "id" TEXT NOT NULL,
    "backgroundId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,

    CONSTRAINT "background_features_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "races_name_key" ON "races"("name");

-- CreateIndex
CREATE UNIQUE INDEX "race_features_raceId_featureId_key" ON "race_features"("raceId", "featureId");

-- CreateIndex
CREATE UNIQUE INDEX "backgrounds_name_key" ON "backgrounds"("name");

-- CreateIndex
CREATE UNIQUE INDEX "background_features_backgroundId_featureId_key" ON "background_features"("backgroundId", "featureId");

-- AddForeignKey
ALTER TABLE "races" ADD CONSTRAINT "races_contentSourceId_fkey" FOREIGN KEY ("contentSourceId") REFERENCES "content_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_features" ADD CONSTRAINT "race_features_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "races"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "race_features" ADD CONSTRAINT "race_features_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backgrounds" ADD CONSTRAINT "backgrounds_contentSourceId_fkey" FOREIGN KEY ("contentSourceId") REFERENCES "content_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "background_features" ADD CONSTRAINT "background_features_backgroundId_fkey" FOREIGN KEY ("backgroundId") REFERENCES "backgrounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "background_features" ADD CONSTRAINT "background_features_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "races"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_backgroundId_fkey" FOREIGN KEY ("backgroundId") REFERENCES "backgrounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_drafts" ADD CONSTRAINT "character_drafts_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "races"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_drafts" ADD CONSTRAINT "character_drafts_backgroundId_fkey" FOREIGN KEY ("backgroundId") REFERENCES "backgrounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
