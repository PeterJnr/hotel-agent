import assert from "node:assert/strict";
import crypto from "node:crypto";
import "dotenv/config";
import express from "express";

process.env.PAYSTACK_SECRET_KEY = "guest-stay-smoke-secret";
process.env.SENDLIB_API_KEY = "guest-stay-email-secret";
process.env.SENDLIB_FROM_EMAIL = "Apex Solacii <bookings@example.com>";

const [{ prisma }, { createAccessToken }, { default: reservationRoutes }, { default: paymentRoutes }] = await Promise.all([
  import("../src/lib/prisma.js"),
  import("../src/lib/authTokens.js"),
  import("../src/routes/reservation.routes.js"),
  import("../src/routes/payment.routes.js"),
]);

const nativeFetch = globalThis.fetch;
const suffix = crypto.randomUUID().slice(0, 8);
let customer;
let staff;
let room;
let reservationId;
let expectedAmount;
let emailCount = 0;

const app = express();
app.use(express.json({ verify: (req, res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
app.use("/api/reservations", reservationRoutes);
app.use("/api/payments", paymentRoutes);
const server = app.listen(0, "127.0.0.1");

try {
  const [customerRole, staffRole, roomType] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: "CUSTOMER" } }),
    prisma.role.findUniqueOrThrow({ where: { name: "FRONT_DESK" } }),
    prisma.roomType.findFirstOrThrow(),
  ]);
  customer = await prisma.user.create({ data: { firstName: "Guest", lastName: "Journey", email: `guest-journey-${suffix}@example.com`, roles: { create: { roleId: customerRole.id } } } });
  staff = await prisma.user.create({ data: { firstName: "Front", lastName: "Desk", email: `front-desk-${suffix}@example.com`, roles: { create: { roleId: staffRole.id } } } });
  room = await prisma.room.create({ data: { roomNumber: `E2E-${suffix}`, roomTypeId: roomType.id } });

  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.startsWith("http://127.0.0.1:")) return nativeFetch(url, options);
    if (address === "https://sendlib.samueltuoyo.com/api/send") {
      emailCount += 1;
      return { ok: true, json: async () => ({ id: `email-${emailCount}` }) };
    }
    if (address.endsWith("/transaction/initialize")) {
      const request = JSON.parse(options.body);
      expectedAmount = Number(request.amount);
      return { ok: true, json: async () => ({ status: true, data: { authorization_url: "https://checkout.paystack.com/guest-stay-smoke", access_code: "guest-stay-access", reference: request.reference } }) };
    }
    if (address.includes("/transaction/verify/")) {
      const reference = decodeURIComponent(address.split("/").at(-1));
      return { ok: true, json: async () => ({ status: true, data: { id: 987654321, reference, status: "success", amount: expectedAmount, currency: "NGN", paid_at: new Date().toISOString() } }) };
    }
    throw new Error(`Unexpected external request: ${address}`);
  };

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const customerHeaders = { authorization: `Bearer ${createAccessToken({ userId: customer.id, roles: ["CUSTOMER"] })}`, "content-type": "application/json" };
  const staffHeaders = { authorization: `Bearer ${createAccessToken({ userId: staff.id, roles: ["FRONT_DESK"] })}`, "content-type": "application/json" };
  const request = async (path, options = {}) => {
    const response = await nativeFetch(`${baseUrl}${path}`, options);
    const body = await response.json();
    assert.equal(response.ok, true, `${response.status}: ${body.message}`);
    return body.data;
  };
  const checkIn = new Date(Date.now() - 60 * 60 * 1000);
  const checkOut = new Date(Date.now() + 23 * 60 * 60 * 1000);
  const reservation = await request("/api/reservations/create", { method: "POST", headers: customerHeaders, body: JSON.stringify({ roomId: room.id, checkIn, checkOut, guests: 1 }) });
  reservationId = reservation.id;
  assert.equal(reservation.status, "PENDING");

  const payment = await request(`/api/payments/reservations/${reservation.id}/initialize`, { method: "POST", headers: customerHeaders });
  assert.equal(payment.status, "PENDING");
  assert.match(payment.authorizationUrl, /^https:\/\/checkout\.paystack\.com\//);
  const verified = await request(`/api/payments/${encodeURIComponent(payment.reference)}/verify`, { method: "POST", headers: customerHeaders });
  assert.equal(verified.status, "SUCCESSFUL");
  assert.equal(verified.reservation.status, "CONFIRMED");

  const checkedIn = await request(`/api/reservations/${reservation.id}/status`, { method: "PATCH", headers: staffHeaders, body: JSON.stringify({ status: "CHECKED_IN" }) });
  assert.equal(checkedIn.status, "CHECKED_IN");
  assert.equal((await prisma.room.findUnique({ where: { id: room.id } })).status, "OCCUPIED");
  const checkedOut = await request(`/api/reservations/${reservation.id}/status`, { method: "PATCH", headers: staffHeaders, body: JSON.stringify({ status: "CHECKED_OUT" }) });
  assert.equal(checkedOut.status, "CHECKED_OUT");
  assert.equal((await prisma.room.findUnique({ where: { id: room.id } })).status, "AVAILABLE");

  const customerView = await request(`/api/reservations/${reservation.id}`, { headers: customerHeaders });
  assert.equal(customerView.status, "CHECKED_OUT");
  assert.equal(customerView.payments[0].status, "SUCCESSFUL");
  assert.equal(emailCount, 4);
  console.log("Guest booking, payment verification, confirmation, check-in, check-out, room state, ownership, and lifecycle emails passed.");
} finally {
  globalThis.fetch = nativeFetch;
  if (reservationId) await prisma.payment.deleteMany({ where: { reservationId } });
  if (reservationId) await prisma.reservation.delete({ where: { id: reservationId } });
  if (room) await prisma.room.delete({ where: { id: room.id } });
  if (customer || staff) await prisma.user.deleteMany({ where: { id: { in: [customer?.id, staff?.id].filter(Boolean) } } });
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
}
