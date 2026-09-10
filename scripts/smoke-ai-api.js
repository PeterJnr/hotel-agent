import assert from "node:assert/strict";
import "dotenv/config";
import express from "express";

import {
  createAiConversation,
  saveAssistantAiMessage,
  saveUserAiMessage,
} from "../src/ai/aiConversation.service.js";
import { createAccessToken } from "../src/lib/authTokens.js";
import { prisma } from "../src/lib/prisma.js";
import aiRoutes from "../src/routes/ai.routes.js";

const app = express();
app.use(express.json());
app.use("/api/ai", aiRoutes);

const server = app.listen(0);
let conversation;

try {
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/api/ai`;
  const unauthenticated = await fetch(`${baseUrl}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "hello" }),
  });
  assert.equal(unauthenticated.status, 401);

  const customer = await prisma.user.findFirst({
    where: {
      status: "ACTIVE",
      roles: { some: { role: { name: "CUSTOMER" } } },
    },
    select: { id: true },
  });
  assert.ok(customer, "Seed an active CUSTOMER before running this smoke test.");
  const token = createAccessToken({ userId: customer.id, roles: ["CUSTOMER"] });
  conversation = await createAiConversation({ userId: customer.id, title: "API smoke" });
  const userMessage = await saveUserAiMessage({
    conversationId: conversation.id,
    userId: customer.id,
    content: "Hello Apex Solacii",
    clientMessageId: "api-smoke-message",
  });
  await saveAssistantAiMessage({
    conversationId: conversation.id,
    userId: customer.id,
    replyToMessageId: userMessage.message.id,
    content: "Hello. How can I help?",
    metadata: { internal: "must-not-be-exposed" },
  });
  const authHeaders = { authorization: `Bearer ${token}` };

  const listResponse = await fetch(`${baseUrl}/conversations`, { headers: authHeaders });
  assert.equal(listResponse.status, 200);
  const listBody = await listResponse.json();
  assert.ok(listBody.data.some(({ id }) => id === conversation.id));

  const detailResponse = await fetch(`${baseUrl}/conversations/${conversation.id}`, { headers: authHeaders });
  assert.equal(detailResponse.status, 200);
  const detailBody = await detailResponse.json();
  assert.deepEqual(detailBody.data.messages.map(({ role }) => role), ["USER", "ASSISTANT"]);
  assert.ok(detailBody.data.messages.every((message) => message.metadata === undefined));
  assert.ok(Array.isArray(detailBody.data.pendingActions));

  const archiveResponse = await fetch(`${baseUrl}/conversations/${conversation.id}/archive`, {
    method: "PATCH",
    headers: authHeaders,
  });
  assert.equal(archiveResponse.status, 200);

  const archivedChat = await fetch(`${baseUrl}/chat`, {
    method: "POST",
    headers: { ...authHeaders, "content-type": "application/json" },
    body: JSON.stringify({
      message: "Continue this archived chat",
      conversationId: conversation.id,
      clientMessageId: "api-smoke-archived-message",
    }),
  });
  assert.equal(archivedChat.status, 409);
  const invalidMessage = await fetch(`${baseUrl}/chat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ message: "", userId: "spoofed-user-id" }),
  });
  assert.equal(invalidMessage.status, 400);

  console.log("AI API authentication and request-boundary checks passed.");
} finally {
  if (conversation) {
    await prisma.aiConversation.delete({ where: { id: conversation.id } });
  }
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
}
