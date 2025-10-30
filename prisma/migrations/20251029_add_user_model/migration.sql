-- CreateTable
-- P0.2: Create User table for tracking user history across sessions
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "totalChats" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_lastSeenAt_idx" ON "User"("lastSeenAt");

-- AlterTable
-- P0.2: Add userId field to ChatSession for user tracking
ALTER TABLE "ChatSession" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "ChatSession_userId_idx" ON "ChatSession"("userId");

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Comment
COMMENT ON TABLE "User" IS 'User profiles for tracking history across multiple chat sessions';
COMMENT ON COLUMN "User"."totalChats" IS 'Total number of chat sessions for this user';
COMMENT ON COLUMN "ChatSession"."userId" IS 'Optional reference to User for history tracking';
