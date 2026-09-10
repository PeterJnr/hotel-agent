import crypto from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import { initiateFullRefund, listPayments, processRefundWebhook } from "../src/services/refund.service.js";

process.env.PAYSTACK_SECRET_KEY = "refund-smoke-key";
process.env.SENDLIB_API_KEY = "refund-email-key";
process.env.SENDLIB_FROM_EMAIL = "Apex Solacii <bookings@example.com>";
const suffix = crypto.randomUUID().slice(0, 8);
let user, room, reservation, payment;
let emails = 0;

globalThis.fetch = async (url) => {
  if (url === "https://api.paystack.co/refund") return { ok: true, json: async () => ({ status: true, data: { id: 987654, status: "pending", expected_at: "2030-01-05T10:00:00Z" } }) };
  if (url === "https://sendlib.samueltuoyo.com/api/send") { emails += 1; return { ok: true, json: async () => ({ id: `email-${emails}` }) }; }
  throw new Error(`Unexpected URL: ${url}`);
};

try {
  const roomType = await prisma.roomType.findFirstOrThrow();
  user = await prisma.user.create({ data: { firstName: "Refund", lastName: "Smoke", email: `refund-${suffix}@example.com` } });
  room = await prisma.room.create({ data: { roomNumber: `REF-${suffix}`, roomTypeId: roomType.id } });
  reservation = await prisma.reservation.create({ data: { userId: user.id, roomId: room.id, checkIn: new Date("2030-01-01"), checkOut: new Date("2030-01-02"), guests: 1, status: "CONFIRMED", totalAmount: "6000" } });
  payment = await prisma.payment.create({ data: { reservationId: reservation.id, reference: `refund-${suffix}`, amount: "6000", status: "SUCCESSFUL", providerTransactionId: `tx-${suffix}`, paidAt: new Date() } });
  const ledger = await listPayments({ reference: payment.reference });
  const safeLedger = ledger.payments.length === 1 && !("accessCode" in ledger.payments[0]) && !("passwordHash" in ledger.payments[0].reservation.user);
  const initiated = await initiateFullRefund({ paymentId: payment.id, initiatedById: user.id, reason: "Smoke test" });
  const completed = await processRefundWebhook("refund.processed", { transaction_reference: payment.reference, id: 987654, refunded_at: "2030-01-03T10:00:00Z" });
  const result = { initiated: initiated.status, completed: completed.status, payment: completed.payment.status, reservation: completed.payment.reservation.status, emails, safeLedger };
  console.log(JSON.stringify(result, null, 2));
  if (result.initiated !== "PENDING" || result.completed !== "SUCCESSFUL" || result.payment !== "REFUNDED" || result.reservation !== "CANCELLED" || emails !== 2 || !safeLedger) process.exitCode = 1;
} finally {
  if (payment) await prisma.refund.deleteMany({ where: { paymentId: payment.id } });
  if (payment) await prisma.payment.delete({ where: { id: payment.id } });
  if (reservation) await prisma.reservation.delete({ where: { id: reservation.id } });
  if (room) await prisma.room.delete({ where: { id: room.id } });
  if (user) await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}
