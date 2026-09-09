import assert from "node:assert/strict";
import "dotenv/config";
import express from "express";

import { createAiConversation, saveUserAiMessage } from "../src/ai/aiConversation.service.js";
import { completeAiRun, failAiRun, getAiMetrics, listAiRuns, startAiRun } from "../src/ai/aiRun.service.js";
import { createAccessToken } from "../src/lib/authTokens.js";
import { prisma } from "../src/lib/prisma.js";
import aiRoutes from "../src/routes/ai.routes.js";

const suffix = Date.now();
let admin;
let conversation;
const runIds = [];
const app = express();
app.use(express.json());
app.use("/api/ai", aiRoutes);
const server = app.listen(0);

try {
  const customer = await prisma.user.findFirstOrThrow({
    where: { status: "ACTIVE", roles: { some: { role: { name: "CUSTOMER" } } } },
    select: { id: true },
  });
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
  admin = await prisma.user.create({
    data: {
      firstName: "AI",
      lastName: "Observer",
      email: `ai-observer-${suffix}@example.com`,
      roles: { create: { roleId: adminRole.id } },
    },
  });
  conversation = await createAiConversation({ userId: customer.id, title: "Telemetry smoke" });

  const completedMessage = await saveUserAiMessage({
    conversationId: conversation.id,
    userId: customer.id,
    content: "private customer message must not enter telemetry",
    clientMessageId: `telemetry-success-${suffix}`,
  });
  const completedRun = await startAiRun({
    userId: customer.id,
    conversationId: conversation.id,
    sourceMessageId: completedMessage.message.id,
    model: "test-model",
  });
  runIds.push(completedRun.id);
  await completeAiRun({
    sourceMessageId: completedMessage.message.id,
    durationMs: 125,
    responseType: "confirmation_required",
    toolName: "create_reservation",
    confirmationRequired: true,
    usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
  });

  const failedMessage = await saveUserAiMessage({
    conversationId: conversation.id,
    userId: customer.id,
    content: "another private message",
    clientMessageId: `telemetry-failure-${suffix}`,
  });
  const failedRun = await startAiRun({
    userId: customer.id,
    conversationId: conversation.id,
    sourceMessageId: failedMessage.message.id,
    model: "test-model",
  });
  runIds.push(failedRun.id);
  await failAiRun({ sourceMessageId: failedMessage.message.id, durationMs: 50, errorCode: "AI_TEST_FAILURE" });

  const metrics = await getAiMetrics({ days: 1 });
  assert.ok(metrics.totals.runs >= 2);
  assert.ok(metrics.tools.some(({ name }) => name === "create_reservation"));
  const runs = await listAiRuns({ limit: 100 });
  const testRuns = runs.filter(({ id }) => runIds.includes(id));
  assert.equal(testRuns.length, 2);
  assert.equal(JSON.stringify(testRuns).includes("private customer message"), false);

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/api/ai/admin`;
  const adminToken = createAccessToken({ userId: admin.id, roles: ["ADMIN"] });
  const customerToken = createAccessToken({ userId: customer.id, roles: ["CUSTOMER"] });
  const allowed = await fetch(`${baseUrl}/metrics?days=1`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(allowed.status, 200);
  const forbidden = await fetch(`${baseUrl}/runs`, { headers: { authorization: `Bearer ${customerToken}` } });
  assert.equal(forbidden.status, 403);

  console.log("AI telemetry, privacy boundary, metrics, and admin authorization checks passed.");
} finally {
  if (runIds.length) await prisma.aiRun.deleteMany({ where: { id: { in: runIds } } });
  if (conversation) await prisma.aiConversation.delete({ where: { id: conversation.id } });
  if (admin) await prisma.user.delete({ where: { id: admin.id } });
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
}
