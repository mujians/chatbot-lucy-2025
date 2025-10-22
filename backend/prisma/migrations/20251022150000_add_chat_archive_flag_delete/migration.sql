-- AlterTable: Add archive, flag and soft delete fields to ChatSession
ALTER TABLE "ChatSession" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatSession" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "ChatSession" ADD COLUMN "archivedBy" TEXT;
ALTER TABLE "ChatSession" ADD COLUMN "isFlagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatSession" ADD COLUMN "flagReason" TEXT;
ALTER TABLE "ChatSession" ADD COLUMN "flaggedBy" TEXT;
ALTER TABLE "ChatSession" ADD COLUMN "flaggedAt" TIMESTAMP(3);
ALTER TABLE "ChatSession" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ChatSession_isArchived_idx" ON "ChatSession"("isArchived");

-- CreateIndex
CREATE INDEX "ChatSession_isFlagged_idx" ON "ChatSession"("isFlagged");

-- CreateIndex
CREATE INDEX "ChatSession_deletedAt_idx" ON "ChatSession"("deletedAt");
