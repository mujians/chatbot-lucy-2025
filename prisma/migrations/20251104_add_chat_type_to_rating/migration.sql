-- v2.3.8: LACUNA #5 - Add chatType field to distinguish AI vs OPERATOR ratings

-- AlterTable
ALTER TABLE "ChatRating" ADD COLUMN "chatType" TEXT NOT NULL DEFAULT 'OPERATOR';

-- Comment for clarity
COMMENT ON COLUMN "ChatRating"."chatType" IS 'Type of chat that was rated: AI or OPERATOR';
