-- AlterTable
-- P0.4: Add userEmail field for chat transcript functionality
ALTER TABLE "ChatSession" ADD COLUMN "userEmail" TEXT;

-- Comment
COMMENT ON COLUMN "ChatSession"."userEmail" IS 'User email address for sending chat transcript';
