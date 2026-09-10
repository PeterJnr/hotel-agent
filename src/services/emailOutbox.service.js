import { prisma } from "../lib/prisma.js";
import { notifyCustomerWelcome, notifyPasswordReset, notifyStaffOnboarded } from "./emailNotification.service.js";

const handlers = {
  CUSTOMER_WELCOME: (payload) => notifyCustomerWelcome(payload.customer),
  PASSWORD_RESET: (payload) => notifyPasswordReset(payload),
  STAFF_ONBOARDED: (payload) => notifyStaffOnboarded(payload.staff),
};

export function enqueueEmail(client, { event, payload, dedupeKey }) {
  if (!handlers[event]) throw new Error(`Email outbox event ${event} is not configured.`);
  return client.emailOutbox.create({ data: { event, payload, dedupeKey } });
}

function retryDelay(attempts) {
  return Math.min(60, 2 ** Math.max(0, attempts - 1)) * 60_000;
}

export async function deliverEmailOutboxJob(id) {
  const now = new Date();
  const claimed = await prisma.emailOutbox.updateMany({
    where: { id, status: "PENDING", nextAttemptAt: { lte: now } },
    data: { status: "PROCESSING", lockedAt: now, attempts: { increment: 1 } },
  });
  if (claimed.count !== 1) return prisma.emailOutbox.findUnique({ where: { id } });
  const job = await prisma.emailOutbox.findUniqueOrThrow({ where: { id } });
  try {
    const delivery = await handlers[job.event](job.payload);
    if (!delivery) throw new Error("Email provider did not confirm delivery.");
    return prisma.emailOutbox.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), lockedAt: null, lastError: null } });
  } catch (error) {
    const exhausted = job.attempts >= job.maxAttempts;
    return prisma.emailOutbox.update({ where: { id }, data: { status: exhausted ? "FAILED" : "PENDING", lockedAt: null, lastError: String(error.message || error).slice(0, 1000), nextAttemptAt: new Date(Date.now() + retryDelay(job.attempts)) } });
  }
}

export async function processEmailOutbox({ limit = 10 } = {}) {
  const staleLock = new Date(Date.now() - 5 * 60_000);
  await prisma.emailOutbox.updateMany({
    where: { status: "PROCESSING", lockedAt: { lt: staleLock } },
    data: { status: "PENDING", lockedAt: null, nextAttemptAt: new Date() },
  });
  const jobs = await prisma.emailOutbox.findMany({ where: { status: "PENDING", nextAttemptAt: { lte: new Date() } }, orderBy: { createdAt: "asc" }, take: limit, select: { id: true } });
  const results = [];
  for (const job of jobs) results.push(await deliverEmailOutboxJob(job.id));
  return results;
}

export function startEmailOutboxWorker({ intervalMs = 30_000 } = {}) {
  const timer = setInterval(() => processEmailOutbox().catch((error) => console.error("Email outbox processing failed:", error.message)), intervalMs);
  timer.unref();
  return timer;
}
