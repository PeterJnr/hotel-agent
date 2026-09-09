ALTER TYPE "ReservationStatus" ADD VALUE 'CANCELLATION_PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';

CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'NEEDS_ATTENTION', 'SUCCESSFUL', 'FAILED');

CREATE TABLE "Refund" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "initiatedById" TEXT NOT NULL,
  "providerRefundId" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "failureReason" TEXT,
  "expectedAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Refund_paymentId_key" ON "Refund"("paymentId");
CREATE UNIQUE INDEX "Refund_providerRefundId_key" ON "Refund"("providerRefundId");
CREATE INDEX "Refund_status_idx" ON "Refund"("status");
CREATE INDEX "Refund_initiatedById_idx" ON "Refund"("initiatedById");
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
