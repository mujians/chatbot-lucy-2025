-- AlterTable
-- P0.3: Add internalNotes field for operator-only notes
ALTER TABLE "ChatSession" ADD COLUMN "internalNotes" JSONB NOT NULL DEFAULT '[]';

-- Comment
COMMENT ON COLUMN "ChatSession"."internalNotes" IS 'Array of internal notes visible only to operators (JSON: {id, content, operatorId, operatorName, createdAt})';
