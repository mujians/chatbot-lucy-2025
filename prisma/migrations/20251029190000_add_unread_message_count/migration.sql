-- AlterTable
-- Add unreadMessageCount field to ChatSession for P13 notification badges
ALTER TABLE "ChatSession" ADD COLUMN "unreadMessageCount" INTEGER NOT NULL DEFAULT 0;

-- Update existing sessions to have 0 unread messages
UPDATE "ChatSession" SET "unreadMessageCount" = 0 WHERE "unreadMessageCount" IS NULL;
