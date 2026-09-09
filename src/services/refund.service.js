import { prisma } from "../lib/prisma.js";
import { createPaystackRefund, fetchPaystackRefund } from "../lib/paystack.js";
import { notifyRefundStatus } from "./emailNotification.service.js";

const statusMap = {
  pending: "PENDING",
  processing: "PROCESSING",
  "needs-attention": "NEEDS_ATTENTION",
  processed: "SUCCESSFUL",
  failed: "FAILED",
};

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const paymentSelect = {
  id: true,
  reservationId: true,
  provider: true,
  reference: true,
  amount: true,
  currency: true,
  status: true,
  providerTransactionId: true,
  failureReason: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
  reservation: { select: {
    id: true, status: true, checkIn: true, checkOut: true, guests: true, totalAmount: true,
    user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
    room: { select: { id: true, roomNumber: true, roomType: true } },
  } },
  refund: true,
};
const paymentStatuses = new Set(["INITIALIZING", "PENDING", "SUCCESSFUL", "FAILED", "REFUND_REQUIRED", "REFUNDED"]);

export async function listPayments({ status, reference, page = 1, limit = 20 }) {
  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) throw fail("Invalid page.");
  if (!Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > 100) throw fail("Limit must be from 1 to 100.");
  const normalizedStatus = status?.toUpperCase();
  if (normalizedStatus && !paymentStatuses.has(normalizedStatus)) throw fail("Invalid payment status.");
  const where = {
    ...(normalizedStatus ? { status: normalizedStatus } : {}),
    ...(reference ? { reference: { contains: reference, mode: "insensitive" } } : {}),
  };
  const [payments, total] = await prisma.$transaction([
    prisma.payment.findMany({ where, select: paymentSelect, orderBy: { createdAt: "desc" }, skip: (pageNumber - 1) * limitNumber, take: limitNumber }),
    prisma.payment.count({ where }),
  ]);
  return { payments, pagination: { page: pageNumber, limit: limitNumber, total, pages: Math.ceil(total / limitNumber) } };
}

export async function getPayment(paymentId) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: paymentSelect });
  if (!payment) throw fail("Payment not found.", 404);
  return payment;
}

export async function initiateFullRefund({ paymentId, initiatedById, reason }) {
  if (reason !== undefined && reason !== null && typeof reason !== "string") throw fail("Refund reason must be text.");
  if (typeof reason === "string" && reason.trim().length > 500) throw fail("Refund reason must not exceed 500 characters.");
  const prepared = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { reservation: true, refund: true } });
    if (!payment) throw fail("Payment not found.", 404);
    if (payment.refund) throw fail("A refund already exists for this payment.", 409);
    if (!["SUCCESSFUL", "REFUND_REQUIRED"].includes(payment.status)) throw fail(`Payment cannot be refunded from ${payment.status} status.`, 409);
    if (payment.reservation.status === "CONFIRMED") {
      await tx.reservation.update({ where: { id: payment.reservationId }, data: { status: "CANCELLATION_PENDING" } });
    } else if (payment.status !== "REFUND_REQUIRED") {
      throw fail("Only confirmed bookings can enter cancellation refund processing.", 409);
    }
    const refund = await tx.refund.create({ data: { paymentId, initiatedById, amount: payment.amount, currency: payment.currency, reason: typeof reason === "string" ? reason.trim() || null : null } });
    return { payment, refund };
  });

  try {
    const remote = await createPaystackRefund({ reference: prepared.payment.reference, reason: prepared.refund.reason });
    return applyRefundUpdate(prepared.refund.id, remote, true);
  } catch (error) {
    await prisma.$transaction([
      prisma.refund.update({ where: { id: prepared.refund.id }, data: { status: "FAILED", failureReason: error.message } }),
      prisma.reservation.updateMany({ where: { id: prepared.payment.reservationId, status: "CANCELLATION_PENDING" }, data: { status: "CONFIRMED" } }),
    ]);
    throw error;
  }
}

async function applyRefundUpdate(refundId, remote, forceNotify = false) {
  const mapped = statusMap[remote.status];
  if (!mapped) throw fail(`Unsupported Paystack refund status: ${remote.status}.`, 502);
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.refund.findUnique({ where: { id: refundId }, include: { payment: { include: { reservation: true } } } });
    if (!current) throw fail("Refund not found.", 404);
    const refund = await tx.refund.update({ where: { id: refundId }, data: {
      status: mapped,
      providerRefundId: remote.id ? String(remote.id) : undefined,
      expectedAt: remote.expected_at ? new Date(remote.expected_at) : undefined,
      refundedAt: remote.refunded_at ? new Date(remote.refunded_at) : mapped === "SUCCESSFUL" ? new Date() : undefined,
      failureReason: mapped === "FAILED" ? remote.reason || "Paystack refund failed." : null,
    }});
    if (mapped === "SUCCESSFUL") {
      await tx.payment.update({ where: { id: current.paymentId }, data: { status: "REFUNDED" } });
      await tx.reservation.updateMany({ where: { id: current.payment.reservationId, status: "CANCELLATION_PENDING" }, data: { status: "CANCELLED" } });
    } else if (mapped === "FAILED") {
      await tx.reservation.updateMany({ where: { id: current.payment.reservationId, status: "CANCELLATION_PENDING" }, data: { status: "CONFIRMED" } });
    }
    return { refund, reservationId: current.payment.reservationId, changed: current.status !== mapped };
  });
  if (result.changed || forceNotify) {
    await notifyRefundStatus(result.reservationId, result.refund.status);
  }
  return getPaymentByRefund(result.refund.id);
}

async function getPaymentByRefund(refundId) {
  return prisma.refund.findUnique({ where: { id: refundId }, include: { payment: { select: paymentSelect } } });
}

export async function syncRefund(refundId) {
  const refund = await prisma.refund.findUnique({ where: { id: refundId } });
  if (!refund) throw fail("Refund not found.", 404);
  if (!refund.providerRefundId) throw fail("Refund has no Paystack identifier yet.", 409);
  return applyRefundUpdate(refund.id, await fetchPaystackRefund(refund.providerRefundId));
}

export async function processRefundWebhook(event, data) {
  const reference = data.transaction_reference || data.transaction?.reference;
  if (!reference || !event.startsWith("refund.")) return null;
  const refund = await prisma.refund.findFirst({ where: { payment: { reference } } });
  if (!refund) return null;
  return applyRefundUpdate(refund.id, { ...data, status: event.slice("refund.".length) });
}
