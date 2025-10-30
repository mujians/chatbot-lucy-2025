-- Migration: Convert priority from ENUM to String
-- This fixes the type mismatch between database (enum) and schema (string)

-- Step 1: Add temporary column
ALTER TABLE "ChatSession" ADD COLUMN "priority_temp" TEXT;

-- Step 2: Copy values from enum to text
UPDATE "ChatSession" SET "priority_temp" = "priority"::text;

-- Step 3: Drop old enum column
ALTER TABLE "ChatSession" DROP COLUMN "priority";

-- Step 4: Rename temp column to priority
ALTER TABLE "ChatSession" RENAME COLUMN "priority_temp" TO "priority";

-- Step 5: Set default
ALTER TABLE "ChatSession" ALTER COLUMN "priority" SET DEFAULT 'NORMAL';

-- Step 6: Set not null
ALTER TABLE "ChatSession" ALTER COLUMN "priority" SET NOT NULL;

-- Step 7: Recreate index
CREATE INDEX "ChatSession_priority_idx" ON "ChatSession"("priority");

-- Step 8: Drop the enum type if it exists
DROP TYPE IF EXISTS "ChatPriority";
