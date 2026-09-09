ALTER TABLE "AiPendingAction" ADD COLUMN "sourceMessageId" TEXT;

CREATE UNIQUE INDEX "AiPendingAction_sourceMessageId_key" ON "AiPendingAction"("sourceMessageId");

ALTER TABLE "AiPendingAction" ADD CONSTRAINT "AiPendingAction_sourceMessageId_fkey"
FOREIGN KEY ("sourceMessageId") REFERENCES "AiMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
