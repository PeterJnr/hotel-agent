CREATE TYPE "ServiceRequestCategory" AS ENUM ('HOUSEKEEPING','MAINTENANCE','ROOM_SERVICE','COMPLAINT','OTHER');
CREATE TYPE "ServiceRequestPriority" AS ENUM ('LOW','MEDIUM','HIGH','URGENT');
CREATE TYPE "ServiceRequestStatus" AS ENUM ('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','CANCELLED');
CREATE TABLE "ServiceRequest" (
 "id" TEXT NOT NULL,"userId" TEXT NOT NULL,"reservationId" TEXT NOT NULL,"roomId" TEXT NOT NULL,"assignedToId" TEXT,
 "category" "ServiceRequestCategory" NOT NULL,"priority" "ServiceRequestPriority" NOT NULL DEFAULT 'MEDIUM',
 "status" "ServiceRequestStatus" NOT NULL DEFAULT 'OPEN',"title" TEXT NOT NULL,"description" TEXT NOT NULL,
 "resolvedAt" TIMESTAMP(3),"closedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ServiceRequestComment" ("id" TEXT NOT NULL,"serviceRequestId" TEXT NOT NULL,"authorId" TEXT NOT NULL,"content" TEXT NOT NULL,"isInternal" BOOLEAN NOT NULL DEFAULT false,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ServiceRequestComment_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ServiceRequest_userId_idx" ON "ServiceRequest"("userId"); CREATE INDEX "ServiceRequest_reservationId_idx" ON "ServiceRequest"("reservationId"); CREATE INDEX "ServiceRequest_roomId_idx" ON "ServiceRequest"("roomId"); CREATE INDEX "ServiceRequest_assignedToId_idx" ON "ServiceRequest"("assignedToId"); CREATE INDEX "ServiceRequest_status_priority_idx" ON "ServiceRequest"("status","priority");
CREATE INDEX "ServiceRequestComment_serviceRequestId_createdAt_idx" ON "ServiceRequestComment"("serviceRequestId","createdAt"); CREATE INDEX "ServiceRequestComment_authorId_idx" ON "ServiceRequestComment"("authorId");
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceRequestComment" ADD CONSTRAINT "ServiceRequestComment_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceRequestComment" ADD CONSTRAINT "ServiceRequestComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
