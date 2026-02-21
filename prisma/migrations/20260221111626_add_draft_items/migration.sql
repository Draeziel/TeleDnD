/*
  Warnings:

  - A unique constraint covering the columns `[sourceRef]` on the table `backgrounds` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sourceRef]` on the table `classes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sourceRef]` on the table `races` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "character_draft_items" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "equipped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "character_draft_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "character_draft_items_draftId_itemId_key" ON "character_draft_items"("draftId", "itemId");


-- AddForeignKey
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_draft_items" ADD CONSTRAINT "character_draft_items_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "character_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_draft_items" ADD CONSTRAINT "character_draft_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "session_events_session_id_event_seq_idx" RENAME TO "session_events_sessionId_event_seq_idx";

-- RenameIndex
ALTER INDEX "session_reaction_windows_session_id_target_type_target_ref_id_i" RENAME TO "session_reaction_windows_session_id_target_type_target_ref__idx";
