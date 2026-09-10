import assert from "node:assert/strict";
import crypto from "node:crypto";
import "dotenv/config";

process.env.SENDLIB_API_KEY = "outbox-smoke-secret";
process.env.SENDLIB_FROM_EMAIL = "Apex Solacii <bookings@example.com>";

const [{ prisma }, { deliverEmailOutboxJob, enqueueEmail, processEmailOutbox }] = await Promise.all([
  import("../src/lib/prisma.js"),
  import("../src/services/emailOutbox.service.js"),
]);
const nativeFetch = globalThis.fetch;
const suffix = crypto.randomUUID();
const retryKey = `outbox-retry:${suffix}`;
const rollbackKey = `outbox-rollback:${suffix}`;
let job;

try {
  await assert.rejects(() => prisma.$transaction(async (tx) => {
    await enqueueEmail(tx, { event: "CUSTOMER_WELCOME", dedupeKey: rollbackKey, payload: { customer: { id: "rollback", firstName: "Rollback", lastName: "Guest", email: "rollback@example.com" } } });
    throw new Error("force rollback");
  }), /force rollback/);
  assert.equal(await prisma.emailOutbox.count({ where: { dedupeKey: rollbackKey } }), 0);

  job = await enqueueEmail(prisma, { event: "CUSTOMER_WELCOME", dedupeKey: retryKey, payload: { customer: { id: "retry", firstName: "Retry", lastName: "Guest", email: "retry@example.com" } } });
  globalThis.fetch = async () => ({ ok: false, json: async () => ({ message: "temporary provider failure" }) });
  const pending = await deliverEmailOutboxJob(job.id);
  assert.equal(pending.status, "PENDING");
  assert.equal(pending.attempts, 1);
  assert.match(pending.lastError, /provider did not confirm delivery/i);

  await prisma.emailOutbox.update({ where: { id: job.id }, data: { nextAttemptAt: new Date(0) } });
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ id: "retried-email" }) });
  const [sent] = await processEmailOutbox();
  assert.equal(sent.id, job.id);
  assert.equal(sent.status, "SENT");
  assert.equal(sent.attempts, 2);
  assert.ok(sent.sentAt);
  console.log("Email outbox transaction rollback, durable failure, scheduled retry, and successful delivery passed.");
} finally {
  globalThis.fetch = nativeFetch;
  await prisma.emailOutbox.deleteMany({ where: { dedupeKey: { in: [retryKey, rollbackKey] } } });
  await prisma.$disconnect();
}
