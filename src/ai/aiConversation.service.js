import { prisma } from "../lib/prisma.js";

function conversationError(message, code, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}

function requiredText(value, name, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw conversationError(`${name} is required.`, "AI_INVALID_MESSAGE");
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw conversationError(`${name} must not exceed ${maxLength} characters.`, "AI_INVALID_MESSAGE");
  }
  return normalized;
}

function optionalTitle(value) {
  if (value === undefined || value === null || value === "") return null;
  return requiredText(value, "Conversation title", 100);
}

function validClientMessageId(value) {
  const id = requiredText(value, "clientMessageId", 120);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw conversationError(
      "clientMessageId may contain only letters, numbers, underscores, and hyphens.",
      "AI_INVALID_CLIENT_MESSAGE_ID",
    );
  }
  return id;
}

function rejectSensitiveContent(content) {
  const compactCardPattern = /\b(?:\d[ -]?){13,19}\b/;
  const labelledSecretPattern = /\b(?:password|passcode|pin|otp|one[- ]time password)\s*(?:is|:|=)\s*\S+/i;
  if (compactCardPattern.test(content) || labelledSecretPattern.test(content)) {
    throw conversationError(
      "Do not send passwords, card numbers, PINs, or one-time passwords to Solacii AI.",
      "AI_SENSITIVE_CONTENT_REJECTED",
    );
  }
}

export function validateUserAiMessageInput({ content, clientMessageId }) {
  const normalizedContent = requiredText(content, "Message", 4000);
  rejectSensitiveContent(normalizedContent);
  return {
    content: normalizedContent,
    clientMessageId: validClientMessageId(clientMessageId),
  };
}

async function requireActiveConversation(client, { conversationId, userId }) {
  const conversation = await client.aiConversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true, status: true },
  });
  if (!conversation) {
    throw conversationError("Conversation not found.", "AI_CONVERSATION_NOT_FOUND", 404);
  }
  if (conversation.status !== "ACTIVE") {
    throw conversationError("This conversation is archived.", "AI_CONVERSATION_ARCHIVED", 409);
  }
  return conversation;
}

export function createAiConversation({ userId, title }) {
  if (typeof userId !== "string" || !userId.trim()) {
    throw conversationError("An authenticated user is required.", "AI_AUTH_REQUIRED", 401);
  }
  return prisma.aiConversation.create({
    data: { userId, title: optionalTitle(title) },
  });
}

export function listAiConversations({ userId, status, limit = 20 }) {
  const normalizedStatus = status?.toUpperCase();
  if (normalizedStatus && !["ACTIVE", "ARCHIVED"].includes(normalizedStatus)) {
    throw conversationError("Conversation status must be ACTIVE or ARCHIVED.", "AI_INVALID_CONVERSATION_STATUS");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw conversationError("Conversation limit must be between 1 and 50.", "AI_INVALID_CONVERSATION_LIMIT");
  }
  return prisma.aiConversation.findMany({
    where: { userId, ...(normalizedStatus ? { status: normalizedStatus } : {}) },
    orderBy: { lastMessageAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      status: true,
      lastMessageAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getAiConversationDetail({ conversationId, userId, messageLimit = 20 }) {
  const [conversation, messages, pendingActions] = await Promise.all([
    getAiConversation({ conversationId, userId }),
    getRecentAiMessages({
      conversationId,
      userId,
      limit: messageLimit,
    }),
    prisma.aiPendingAction.findMany({
      where: {
        conversationId,
        userId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        toolName: true,
        arguments: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
  ]);
  return {
    ...conversation,
    messages: messages.map(({ id, role, content, createdAt }) => ({
      id,
      role,
      content,
      createdAt,
    })),
    pendingActions: pendingActions.map(({ id, toolName, arguments: args, expiresAt, createdAt }) => ({
      id,
      name: toolName,
      arguments: args,
      expiresAt,
      createdAt,
    })),
  };
}

export async function getAiConversation({ conversationId, userId }) {
  const conversation = await prisma.aiConversation.findFirst({
    where: { id: conversationId, userId },
    select: {
      id: true,
      title: true,
      status: true,
      lastMessageAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!conversation) {
    throw conversationError("Conversation not found.", "AI_CONVERSATION_NOT_FOUND", 404);
  }
  return conversation;
}

export async function saveUserAiMessage({
  conversationId,
  userId,
  content,
  clientMessageId,
}) {
  const validated = validateUserAiMessageInput({ content, clientMessageId });
  const normalizedContent = validated.content;
  const normalizedClientId = validated.clientMessageId;

  try {
    const message = await prisma.$transaction(async (tx) => {
      await requireActiveConversation(tx, { conversationId, userId });
      const created = await tx.aiMessage.create({
        data: {
          conversationId,
          role: "USER",
          status: "PROCESSING",
          content: normalizedContent,
          clientMessageId: normalizedClientId,
        },
      });
      await tx.aiConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: created.createdAt },
      });
      return created;
    });
    return { message, duplicate: false };
  } catch (error) {
    if (error.code !== "P2002") throw error;
    const existing = await prisma.aiMessage.findFirst({
      where: { conversationId, clientMessageId: normalizedClientId, conversation: { userId } },
    });
    if (!existing) throw error;
    if (existing.content !== normalizedContent) {
      throw conversationError(
        "clientMessageId was already used for different content.",
        "AI_CLIENT_MESSAGE_CONFLICT",
        409,
      );
    }
    return { message: existing, duplicate: true };
  }
}

export async function saveAssistantAiMessage({
  conversationId,
  userId,
  content,
  replyToMessageId,
  metadata,
}) {
  const normalizedContent = requiredText(content, "Assistant message", 8000);
  return prisma.$transaction(async (tx) => {
    await requireActiveConversation(tx, { conversationId, userId });
    const userMessage = await tx.aiMessage.findFirst({
      where: {
        id: replyToMessageId,
        conversationId,
        role: "USER",
        status: "PROCESSING",
      },
      select: { id: true },
    });
    if (!userMessage) {
      throw conversationError("The customer message cannot accept a reply.", "AI_MESSAGE_NOT_PROCESSING", 409);
    }
    const message = await tx.aiMessage.create({
      data: {
        conversationId,
        role: "ASSISTANT",
        status: "COMPLETED",
        content: normalizedContent,
        replyToMessageId,
        ...(metadata === undefined ? {} : { metadata: JSON.parse(JSON.stringify(metadata)) }),
      },
    });
    await tx.aiMessage.update({
      where: { id: replyToMessageId },
      data: { status: "COMPLETED", failureReason: null },
    });
    await tx.aiConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: message.createdAt },
    });
    return message;
  });
}

export async function getRecentAiMessages({ conversationId, userId, limit = 12 }) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw conversationError("History limit must be between 1 and 20.", "AI_INVALID_HISTORY_LIMIT");
  }
  await getAiConversation({ conversationId, userId });
  const messages = await prisma.aiMessage.findMany({
    where: { conversationId, status: "COMPLETED" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: { id: true, role: true, content: true, metadata: true, createdAt: true },
  });
  return messages.reverse();
}

export function getAssistantReplyForUserMessage({ userMessageId, conversationId, userId }) {
  return prisma.aiMessage.findFirst({
    where: {
      replyToMessageId: userMessageId,
      conversationId,
      role: "ASSISTANT",
      conversation: { userId },
    },
  });
}

export async function retryFailedUserAiMessage({ messageId, conversationId, userId }) {
  await requireActiveConversation(prisma, { conversationId, userId });
  const updated = await prisma.aiMessage.updateMany({
    where: { id: messageId, conversationId, role: "USER", status: "FAILED" },
    data: { status: "PROCESSING", failureReason: null },
  });
  return updated.count === 1;
}

export async function markUserAiMessageFailed({ messageId, conversationId, userId, error }) {
  await requireActiveConversation(prisma, { conversationId, userId });
  await prisma.aiMessage.updateMany({
    where: { id: messageId, conversationId, role: "USER", status: "PROCESSING" },
    data: {
      status: "FAILED",
      failureReason: String(error?.message || "AI request failed.").slice(0, 500),
    },
  });
}

export async function archiveAiConversation({ conversationId, userId }) {
  const result = await prisma.aiConversation.updateMany({
    where: { id: conversationId, userId, status: "ACTIVE" },
    data: { status: "ARCHIVED" },
  });
  if (result.count !== 1) {
    throw conversationError(
      "Conversation was not found or is already archived.",
      "AI_CONVERSATION_NOT_ARCHIVABLE",
      409,
    );
  }
  return getAiConversation({ conversationId, userId });
}
