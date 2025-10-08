-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "OperatorRole" AS ENUM ('OPERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('ACTIVE', 'WAITING', 'WITH_OPERATOR', 'CLOSED', 'TICKET_CREATED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('PENDING', 'ASSIGNED', 'OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "KnowledgeCategory" AS ENUM ('PARCHEGGIO', 'BIGLIETTI', 'ORARI', 'ACCESSO', 'SERVIZI', 'ALTRO');

-- CreateTable
CREATE TABLE "Operator" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "OperatorRole" NOT NULL DEFAULT 'OPERATOR',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "whatsappNumber" TEXT,
    "notificationPreferences" JSONB DEFAULT '{"email":{"newChat":true,"newTicket":true,"ticketResumed":true},"whatsapp":{"newChat":false,"newTicket":false,"ticketResumed":true},"inApp":{"newChat":true,"newTicket":true,"chatMessage":true,"ticketResumed":true},"audio":{"newChat":true,"newTicket":true,"chatMessage":false,"ticketResumed":true},"quietHours":{"start":"22:00","end":"08:00"}}',
    "totalChatsHandled" INTEGER NOT NULL DEFAULT 0,
    "totalTicketsHandled" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "userName" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "status" "ChatStatus" NOT NULL DEFAULT 'ACTIVE',
    "messages" JSONB NOT NULL DEFAULT '[]',
    "aiConfidence" DOUBLE PRECISION,
    "aiTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "operatorId" TEXT,
    "operatorJoinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "contactMethod" "ContactMethod" NOT NULL,
    "whatsappNumber" TEXT,
    "email" TEXT,
    "initialMessage" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "operatorId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resumeToken" TEXT NOT NULL,
    "resumeTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeItem" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" "KnowledgeCategory" NOT NULL DEFAULT 'ALTRO',
    "embedding" vector(1536),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "sentViaEmail" BOOLEAN NOT NULL DEFAULT false,
    "sentViaWhatsApp" BOOLEAN NOT NULL DEFAULT false,
    "sentViaInApp" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Operator_email_key" ON "Operator"("email");

-- CreateIndex
CREATE INDEX "Operator_email_idx" ON "Operator"("email");

-- CreateIndex
CREATE INDEX "Operator_isOnline_idx" ON "Operator"("isOnline");

-- CreateIndex
CREATE INDEX "ChatSession_status_idx" ON "ChatSession"("status");

-- CreateIndex
CREATE INDEX "ChatSession_operatorId_idx" ON "ChatSession"("operatorId");

-- CreateIndex
CREATE INDEX "ChatSession_lastMessageAt_idx" ON "ChatSession"("lastMessageAt");

-- CreateIndex
CREATE INDEX "ChatSession_createdAt_idx" ON "ChatSession"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_resumeToken_key" ON "Ticket"("resumeToken");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_sessionId_key" ON "Ticket"("sessionId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_operatorId_idx" ON "Ticket"("operatorId");

-- CreateIndex
CREATE INDEX "Ticket_whatsappNumber_idx" ON "Ticket"("whatsappNumber");

-- CreateIndex
CREATE INDEX "Ticket_email_idx" ON "Ticket"("email");

-- CreateIndex
CREATE INDEX "Ticket_resumeToken_idx" ON "Ticket"("resumeToken");

-- CreateIndex
CREATE INDEX "Ticket_createdAt_idx" ON "Ticket"("createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeItem_category_idx" ON "KnowledgeItem"("category");

-- CreateIndex
CREATE INDEX "KnowledgeItem_isActive_idx" ON "KnowledgeItem"("isActive");

-- CreateIndex
CREATE INDEX "KnowledgeItem_createdAt_idx" ON "KnowledgeItem"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_recipientId_idx" ON "Notification"("recipientId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSettings_key_key" ON "SystemSettings"("key");

-- CreateIndex
CREATE INDEX "SystemSettings_key_idx" ON "SystemSettings"("key");

-- CreateIndex
CREATE INDEX "SystemSettings_category_idx" ON "SystemSettings"("category");

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
