import assert from "node:assert/strict";
import crypto from "node:crypto";
import "dotenv/config";

process.env.PAYSTACK_SECRET_KEY = "ai-booking-smoke-secret";
process.env.SENDLIB_API_KEY = "ai-booking-email-secret";
process.env.SENDLIB_FROM_EMAIL = "Apex Solacii <bookings@example.com>";

const [{ prisma }, { createPendingAiAction, confirmPendingAiAction }, { confirmCustomerAiAction }] = await Promise.all([
  import("../src/lib/prisma.js"),
  import("../src/ai/pendingAiAction.service.js"),
  import("../src/ai/hotelAiOrchestrator.js"),
]);

const nativeFetch = globalThis.fetch;
const suffix = crypto.randomUUID().slice(0, 8);
let user;
let room;
let reservationId;
const actionIds = [];

try {
  const [customerRole, roomType] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: "CUSTOMER" } }),
    prisma.roomType.findFirstOrThrow(),
  ]);
  user = await prisma.user.create({ data: { firstName: "AI", lastName: "Guest", email: `ai-booking-${suffix}@example.com`, roles: { create: { roleId: customerRole.id } } } });
  room = await prisma.room.create({ data: { roomNumber: `AI-${suffix}`, roomTypeId: roomType.id } });
  const checkIn = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const checkOut = new Date(Date.now() + 32 * 86_400_000).toISOString().slice(0, 10);

  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address === "https://sendlib.samueltuoyo.com/api/send") return { ok: true, json: async () => ({ id: "ai-booking-email" }) };
    if (address.endsWith("/transaction/initialize")) {
      const request = JSON.parse(options.body);
      return { ok: true, json: async () => ({ status: true, data: { authorization_url: "https://checkout.paystack.com/ai-booking-smoke", access_code: "private-access-code", reference: request.reference } }) };
    }
    return nativeFetch(url, options);
  };

  const reservationAction = await createPendingAiAction({ userId: user.id, userRoles: ["CUSTOMER"], toolName: "create_reservation", arguments: { roomId: room.id, checkIn, checkOut, guests: 1 } });
  actionIds.push(reservationAction.id);
  assert.equal(reservationAction.status, "PENDING");
  assert.equal(await prisma.reservation.count({ where: { userId: user.id } }), 0);
  const booked = await confirmCustomerAiAction({ actionId: reservationAction.id, userId: user.id, userRoles: ["CUSTOMER"] });
  reservationId = booked.data.id;
  assert.equal(booked.type, "action_completed");
  assert.equal(booked.action.status, "EXECUTED");
  assert.equal(booked.data.status, "PENDING");
  await assert.rejects(() => confirmPendingAiAction({ actionId: reservationAction.id, userId: user.id, userRoles: ["CUSTOMER"] }), (error) => error.code === "AI_ACTION_UNAVAILABLE");

  const paymentAction = await createPendingAiAction({ userId: user.id, userRoles: ["CUSTOMER"], toolName: "initialize_payment", arguments: { reservationId } });
  actionIds.push(paymentAction.id);
  const payment = await confirmCustomerAiAction({ actionId: paymentAction.id, userId: user.id, userRoles: ["CUSTOMER"] });
  assert.equal(payment.type, "action_completed");
  assert.equal(payment.data.status, "PENDING");
  assert.equal(payment.data.authorizationUrl, "https://checkout.paystack.com/ai-booking-smoke");
  assert.equal(payment.data.accessCode, undefined);
  assert.equal((await prisma.reservation.findUnique({ where: { id: reservationId } })).status, "PAYMENT_PENDING");
  console.log("AI reservation and payment proposals, explicit confirmation, execution, replay protection, ownership, and safe response filtering passed.");
} finally {
  globalThis.fetch = nativeFetch;
  if (actionIds.length) await prisma.aiPendingAction.deleteMany({ where: { id: { in: actionIds } } });
  if (reservationId) await prisma.payment.deleteMany({ where: { reservationId } });
  if (reservationId) await prisma.reservation.delete({ where: { id: reservationId } });
  if (room) await prisma.room.delete({ where: { id: room.id } });
  if (user) await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}
