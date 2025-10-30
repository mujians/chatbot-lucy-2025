-- CreateTable
CREATE TABLE "CannedResponse" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "shortcut" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CannedResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CannedResponse_createdBy_idx" ON "CannedResponse"("createdBy");

-- CreateIndex
CREATE INDEX "CannedResponse_isGlobal_idx" ON "CannedResponse"("isGlobal");

-- CreateIndex
CREATE INDEX "CannedResponse_isActive_idx" ON "CannedResponse"("isActive");

-- CreateIndex
CREATE INDEX "CannedResponse_shortcut_idx" ON "CannedResponse"("shortcut");

-- AddForeignKey
ALTER TABLE "CannedResponse" ADD CONSTRAINT "CannedResponse_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
