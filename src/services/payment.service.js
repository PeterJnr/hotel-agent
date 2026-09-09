import crypto from "node:crypto";

import { prisma } from "../lib/prisma.js";
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
} from "../lib/paystack.js";
import {
  notifyPaymentConfirmed,
  notifyPaymentFailed,
} from "./emailNotification.service.js";

function paymentError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function amountToKobo(amount) {
  const [whole, fraction = ""] = String(amount).split(".");
  const kobo = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));

  if (kobo > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Payment amount is too large.");
  }

  return Number(kobo);
}

function createReference() {
  return `hotel-${crypto.randomUUID().replaceAll("-", "")}`;
}

export async function initializeReservationPayment({ reservationId, userId }) {
  const prepared = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: {
        user: {
          select: { email: true },
        },
      },
    });

    if (!reservation) {
      throw paymentError("Reservation not found.", 404);
    }

    if (reservation.userId !== userId) {
      throw paymentError(
        "You are not allowed to pay for this reservation.",
        403,
      );
    }

    const activePayment = await tx.payment.findFirst({
      where: {
        reservationId,
        status: { in: ["INITIALIZING", "PENDING"] },
      },
    });

    if (activePayment?.status === "PENDING") {
      return { reservation, payment: activePayment, existing: true };
    }

    if (activePayment) {
      throw paymentError("Payment initialization is already in progress.", 409);
    }

    if (!["PENDING", "PAYMENT_FAILED"].includes(reservation.status)) {
      throw paymentError(
        `Payment cannot be initialized from ${reservation.status} status.`,
        409,
      );
    }

    const payment = await tx.payment.create({
      data: {
        reservationId,
        reference: createReference(),
        amount: reservation.totalAmount,
        currency: "NGN",
      },
    });

    await tx.reservation.update({
      where: { id: reservationId },
      data: { status: "PAYMENT_PENDING" },
    });

    return { reservation, payment, existing: false };
  });

  if (prepared.existing) {
    return prepared.payment;
  }

  try {
    const paystack = await initializePaystackTransaction({
      email: prepared.reservation.user.email,
      amountInKobo: amountToKobo(prepared.payment.amount),
      reference: prepared.payment.reference,
      reservationId,
    });

    return prisma.payment.update({
      where: { id: prepared.payment.id },
      data: {
        status: "PENDING",
        authorizationUrl: paystack.authorization_url,
        accessCode: paystack.access_code,
      },
    });
  } catch (error) {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: prepared.payment.id },
        data: {
          status: "FAILED",
          failureReason: error.message,
        },
      }),
      prisma.reservation.updateMany({
        where: { id: reservationId, status: "PAYMENT_PENDING" },
        data: { status: "PENDING" },
      }),
    ]);
    throw error;
  }
}

async function applyPaystackVerification(payment, paystackTransaction) {
  const expectedAmount = amountToKobo(payment.amount);
  const detailsMatch =
    paystackTransaction.reference === payment.reference &&
    paystackTransaction.currency === "NGN" &&
    Number(paystackTransaction.amount) === expectedAmount;

  if (!detailsMatch) {
    throw paymentError(
      "Verified payment details do not match the reservation.",
      409,
    );
  }

  if (paystackTransaction.status === "success") {
    const result = await prisma.$transaction(async (tx) => {
      const currentPayment = await tx.payment.findUnique({
        where: { id: payment.id },
        include: { reservation: true },
      });

      if (currentPayment.status === "SUCCESSFUL") {
        return { payment: currentPayment, shouldNotify: false };
      }

      const canConfirm = currentPayment.reservation.status === "PAYMENT_PENDING";
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: canConfirm ? "SUCCESSFUL" : "REFUND_REQUIRED",
          providerTransactionId: String(paystackTransaction.id),
          paidAt: paystackTransaction.paid_at || paystackTransaction.paidAt
            ? new Date(
                paystackTransaction.paid_at || paystackTransaction.paidAt,
              )
            : new Date(),
          failureReason: canConfirm
            ? null
            : `Payment succeeded while reservation was ${currentPayment.reservation.status}.`,
        },
        include: { reservation: true },
      });

      if (canConfirm) {
        await tx.reservation.update({
          where: { id: currentPayment.reservationId },
          data: { status: "CONFIRMED" },
        });
        updatedPayment.reservation.status = "CONFIRMED";
      }

      return { payment: updatedPayment, shouldNotify: canConfirm };
    });

    if (result.shouldNotify) {
      await notifyPaymentConfirmed(
        result.payment.reservationId,
        result.payment.reference,
      );
    }

    return result.payment;
  }

  if (["failed", "abandoned", "reversed"].includes(paystackTransaction.status)) {
    const shouldNotify = payment.status !== "FAILED";
    const [updatedPayment] = await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "FAILED",
          providerTransactionId: paystackTransaction.id
            ? String(paystackTransaction.id)
            : undefined,
          failureReason: paystackTransaction.gateway_response || paystackTransaction.status,
        },
        include: { reservation: true },
      }),
      prisma.reservation.updateMany({
        where: { id: payment.reservationId, status: "PAYMENT_PENDING" },
        data: { status: "PAYMENT_FAILED" },
      }),
    ]);

    updatedPayment.reservation.status = "PAYMENT_FAILED";

    if (shouldNotify) {
      await notifyPaymentFailed(
        updatedPayment.reservationId,
        updatedPayment.reference,
      );
    }

    return updatedPayment;
  }

  return payment;
}

export async function verifyReservationPayment({ reference, userId }) {
  const payment = await prisma.payment.findUnique({
    where: { reference },
    include: { reservation: true },
  });

  if (!payment) {
    throw paymentError("Payment not found.", 404);
  }

  if (userId && payment.reservation.userId !== userId) {
    throw paymentError("You are not allowed to verify this payment.", 403);
  }

  const paystackTransaction = await verifyPaystackTransaction(reference);
  return applyPaystackVerification(payment, paystackTransaction);
}
