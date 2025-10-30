-- P1.2: Add ChatRating table for Customer Satisfaction (CSAT)
-- Enables post-chat rating and operator performance tracking

CREATE TABLE "ChatRating" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "operatorId" TEXT,
    "operatorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRating_pkey" PRIMARY KEY ("id")
);

-- Create unique index on sessionId (one rating per session)
CREATE UNIQUE INDEX "ChatRating_sessionId_key" ON "ChatRating"("sessionId");

-- Create indexes for analytics queries
CREATE INDEX "ChatRating_rating_idx" ON "ChatRating"("rating");
CREATE INDEX "ChatRating_operatorId_idx" ON "ChatRating"("operatorId");
CREATE INDEX "ChatRating_createdAt_idx" ON "ChatRating"("createdAt");

-- Add foreign key constraint to ChatSession
ALTER TABLE "ChatRating" ADD CONSTRAINT "ChatRating_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
