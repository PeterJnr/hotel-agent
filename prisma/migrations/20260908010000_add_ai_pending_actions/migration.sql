CREATE TYPE "AiPendingActionStatus" AS ENUM ('PENDING', 'EXECUTING', 'EXECUTED', 'CANCELLED', 'EXPIRED', 'FAILED');

CREATE TABLE "AiPendingAction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "toolName" TEXT NOT NULL,
  "arguments" JSONB NOT NULL,
  "status" "AiPendingActionStatus" NOT NULL DEFAULT 'PENDING',
  "result" JSONB,
  "failureReason" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiPendingAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiPendingAction_userId_status_idx" ON "AiPendingAction"("userId", "status");
CREATE INDEX "AiPendingAction_status_expiresAt_idx" ON "AiPendingAction"("status", "expiresAt");

ALTER TABLE "AiPendingAction"
ADD CONSTRAINT "AiPendingAction_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
