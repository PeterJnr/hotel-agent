import assert from "node:assert/strict";
import "dotenv/config";

import {
  archiveAiConversation,
  createAiConversation,
  getAiConversation,
  getRecentAiMessages,
  saveAssistantAiMessage,
  saveUserAiMessage,
} from "../src/ai/aiConversation.service.js";
import { prisma } from "../src/lib/prisma.js";

const user = await prisma.user.findFirst({ select: { id: true } });
assert.ok(user, "Seed at least one user before running this smoke test.");
let conversation;

try {
  conversation = await createAiConversation({ userId: user.id, title: "Smoke test" });
  const first = await saveUserAiMessage({
    conversationId: conversation.id,
    userId: user.id,
    content: "Show me available standard rooms.",
    clientMessageId: "smoke-message-1",
  });
  assert.equal(first.duplicate, false);

  const retry = await saveUserAiMessage({
    conversationId: conversation.id,
    userId: user.id,
    content: "Show me available standard rooms.",
    clientMessageId: "smoke-message-1",
  });
  assert.equal(retry.duplicate, true);
  assert.equal(retry.message.id, first.message.id);

  await assert.rejects(
    () => saveUserAiMessage({
      conversationId: conversation.id,
      userId: user.id,
      content: "Different content.",
      clientMessageId: "smoke-message-1",
    }),
    (error) => error.code === "AI_CLIENT_MESSAGE_CONFLICT",
  );
  await assert.rejects(
    () => saveUserAiMessage({
      conversationId: conversation.id,
      userId: user.id,
      content: "My OTP is 123456",
      clientMessageId: "smoke-message-2",
    }),
    (error) => error.code === "AI_SENSITIVE_CONTENT_REJECTED",
  );

  await saveAssistantAiMessage({
    conversationId: conversation.id,
    userId: user.id,
    replyToMessageId: first.message.id,
    content: "I can help with that.",
    metadata: { responseType: "message" },
  });
  const history = await getRecentAiMessages({
    conversationId: conversation.id,
    userId: user.id,
  });
  assert.deepEqual(history.map(({ role }) => role), ["USER", "ASSISTANT"]);

  await assert.rejects(
    () => getAiConversation({ conversationId: conversation.id, userId: "different-user" }),
    (error) => error.code === "AI_CONVERSATION_NOT_FOUND",
  );

  const archived = await archiveAiConversation({ conversationId: conversation.id, userId: user.id });
  assert.equal(archived.status, "ARCHIVED");
  await assert.rejects(
    () => saveAssistantAiMessage({
      conversationId: conversation.id,
      userId: user.id,
      content: "This must not be saved.",
    }),
    (error) => error.code === "AI_CONVERSATION_ARCHIVED",
  );

  console.log("AI conversation ownership, history, idempotency, and archive checks passed.");
} finally {
  if (conversation) {
    await prisma.aiConversation.delete({ where: { id: conversation.id } });
  }
  await prisma.$disconnect();
}
