CREATE TYPE "AiMessageStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "AiMessage"
ADD COLUMN "status" "AiMessageStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN "replyToMessageId" TEXT,
ADD COLUMN "failureReason" TEXT;

CREATE UNIQUE INDEX "AiMessage_replyToMessageId_key" ON "AiMessage"("replyToMessageId");

ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_replyToMessageId_fkey"
FOREIGN KEY ("replyToMessageId") REFERENCES "AiMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
