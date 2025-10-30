-- AUDIT FIX: Convert ChatSession.priority from String to Enum
-- This migration safely converts existing priority values to enum type

-- Step 1: Create the ChatPriority enum type
CREATE TYPE "ChatPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- Step 2: Normalize any invalid priority values to NORMAL
UPDATE "ChatSession"
SET priority = 'NORMAL'
WHERE priority NOT IN ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- Step 3: Alter the column type from String to ChatPriority enum
-- Using USING clause to cast the existing text values to the enum
ALTER TABLE "ChatSession"
  ALTER COLUMN priority TYPE "ChatPriority"
  USING (priority::"ChatPriority");

-- Step 4: Set default value for the enum column
ALTER TABLE "ChatSession"
  ALTER COLUMN priority SET DEFAULT 'NORMAL'::"ChatPriority";

-- Migration complete: priority is now a validated enum instead of freeform string
