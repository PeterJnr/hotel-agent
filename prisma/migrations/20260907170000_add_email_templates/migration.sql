CREATE TYPE "EmailTemplateEvent" AS ENUM ('RESERVATION_CREATED', 'RESERVATION_CANCELLED', 'PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'CHECKED_IN', 'CHECKED_OUT', 'STAFF_ONBOARDED', 'REFUND_STATUS');
CREATE TABLE "EmailTemplate" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "event" "EmailTemplateEvent" NOT NULL,
  "subject" TEXT NOT NULL, "htmlBody" TEXT NOT NULL, "textBody" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false, "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailTemplate_event_name_key" ON "EmailTemplate"("event", "name");
CREATE INDEX "EmailTemplate_event_isActive_idx" ON "EmailTemplate"("event", "isActive");
CREATE UNIQUE INDEX "EmailTemplate_one_active_per_event" ON "EmailTemplate"("event") WHERE "isActive" = true;
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
