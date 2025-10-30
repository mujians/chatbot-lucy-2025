-- AlterTable
-- P1.8: Add priority and tags to ChatSession
ALTER TABLE "ChatSession" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "ChatSession" ADD COLUMN "tags" JSONB NOT NULL DEFAULT '[]';

-- Add index for priority filtering
CREATE INDEX "ChatSession_priority_idx" ON "ChatSession"("priority");

-- Comment
COMMENT ON COLUMN "ChatSession"."priority" IS 'Chat priority: LOW, NORMAL, HIGH, URGENT';
COMMENT ON COLUMN "ChatSession"."tags" IS 'Array of string tags for organization';
