import crypto from "node:crypto";

process.env.PAYSTACK_SECRET_KEY = "payment-smoke-test-secret";
process.env.SENDLIB_API_KEY = "email-smoke-test-key";
process.env.SENDLIB_FROM_EMAIL = "Hotel AI <bookings@example.com>";

const { prisma } = await import("../src/lib/prisma.js");
const {
  initializeReservationPayment,
  verifyReservationPayment,
} = await import("../src/services/payment.service.js");
const { verifyPaystackWebhookSignature } = await import(
  "../src/lib/paystack.js"
);

const suffix = crypto.randomUUID().slice(0, 8);
let user;
let roomType;
let roomTypeCreated = false;
let room;
let reservation;
let emailSent = false;

try {
  user = await prisma.user.create({
    data: {
      firstName: "Payment",
      lastName: "Smoke",
      email: `payment-smoke-${suffix}@example.com`,
    },
  });
  roomType = await prisma.roomType.findUnique({ where: { name: "STANDARD" } });
  if (!roomType) {
    roomType = await prisma.roomType.create({
      data: {
        name: "STANDARD",
        description: "Temporary payment smoke-test room type",
        capacity: 2,
        pricePerNight: "6000.00",
      },
    });
    roomTypeCreated = true;
  }
  room = await prisma.room.create({
    data: {
      roomNumber: `SMOKE-${suffix}`,
      roomTypeId: roomType.id,
    },
  });
  reservation = await prisma.reservation.create({
    data: {
      userId: user.id,
      roomId: room.id,
      checkIn: new Date("2030-01-01T12:00:00.000Z"),
      checkOut: new Date("2030-01-02T12:00:00.000Z"),
      guests: 1,
      totalAmount: "6000.00",
    },
  });

  globalThis.fetch = async (url, options) => {
    if (url === "https://sendlib.samueltuoyo.com/api/send") {
      emailSent = true;
      return {
        ok: true,
        json: async () => ({ id: "smoke-email-id" }),
      };
    }

    if (url.endsWith("/transaction/initialize")) {
      const request = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          status: true,
          data: {
            authorization_url: "https://checkout.paystack.com/smoke-test",
            access_code: "smoke-access-code",
            reference: request.reference,
          },
        }),
      };
    }

    const reference = decodeURIComponent(url.split("/").at(-1));
    return {
      ok: true,
      json: async () => ({
        status: true,
        data: {
          id: 123456789,
          reference,
          status: "success",
          amount: 600000,
          currency: "NGN",
          paid_at: "2030-01-01T10:00:00.000Z",
        },
      }),
    };
  };

  const initialized = await initializeReservationPayment({
    reservationId: reservation.id,
    userId: user.id,
  });
  const paymentPendingReservation = await prisma.reservation.findUnique({
    where: { id: reservation.id },
  });
  const verified = await verifyReservationPayment({
    reference: initialized.reference,
    userId: user.id,
  });

  const body = Buffer.from('{"event":"charge.success"}');
  const signature = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(body)
    .digest("hex");

  const result = {
    initializedStatus: initialized.status,
    reservationAfterInitialize: paymentPendingReservation.status,
    verifiedStatus: verified.status,
    reservationAfterVerify: verified.reservation.status,
    webhookSignatureValid: verifyPaystackWebhookSignature(body, signature),
    confirmationEmailSent: emailSent,
  };

  console.log(JSON.stringify(result, null, 2));

  if (
    result.initializedStatus !== "PENDING" ||
    result.reservationAfterInitialize !== "PAYMENT_PENDING" ||
    result.verifiedStatus !== "SUCCESSFUL" ||
    result.reservationAfterVerify !== "CONFIRMED" ||
    !result.webhookSignatureValid ||
    !result.confirmationEmailSent
  ) {
    process.exitCode = 1;
  }
} finally {
  if (reservation) {
    await prisma.payment.deleteMany({
      where: { reservationId: reservation.id },
    });
    await prisma.reservation.delete({ where: { id: reservation.id } });
  }
  if (room) {
    await prisma.room.delete({ where: { id: room.id } });
  }
  if (roomTypeCreated) {
    await prisma.roomType.delete({ where: { id: roomType.id } });
  }
  if (user) {
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.$disconnect();
}
