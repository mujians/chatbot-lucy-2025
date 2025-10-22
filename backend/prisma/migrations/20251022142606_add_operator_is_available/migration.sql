-- AlterTable
ALTER TABLE "Operator" ADD COLUMN "isAvailable" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Operator_isAvailable_idx" ON "Operator"("isAvailable");
