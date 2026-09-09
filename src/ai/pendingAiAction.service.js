import { prisma } from "../lib/prisma.js";
import { executeAiTool, validateAiToolRequest } from "./toolExecutor.js";

const DEFAULT_EXPIRY_MS = 10 * 60 * 1000;

function actionError(message, code, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}

function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

export async function createPendingAiAction({
  userId,
  userRoles = [],
  conversationId,
  sourceMessageId,
  toolName,
  arguments: input,
  expiresInMs = DEFAULT_EXPIRY_MS,
}) {
  const prepared = validateAiToolRequest({
    name: toolName,
    arguments: input,
    context: { userId, roles: userRoles },
  });

  if (!prepared.definition.confirmationRequired) {
    throw actionError(
      "Read-only tools do not require a pending confirmation action.",
      "AI_CONFIRMATION_NOT_REQUIRED",
    );
  }
  if (!Number.isInteger(expiresInMs) || expiresInMs < 60_000 || expiresInMs > 30 * 60_000) {
    throw actionError(
      "Pending action expiry must be between 1 and 30 minutes.",
      "AI_INVALID_EXPIRY",
    );
  }
  if (conversationId) {
    const conversation = await prisma.aiConversation.findFirst({
      where: { id: conversationId, userId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!conversation) {
      throw actionError("Active conversation not found.", "AI_CONVERSATION_NOT_FOUND", 404);
    }
  }
  if (sourceMessageId) {
    const sourceMessage = await prisma.aiMessage.findFirst({
      where: {
        id: sourceMessageId,
        conversationId,
        role: "USER",
        conversation: { userId },
      },
      select: { id: true },
    });
    if (!sourceMessage) {
      throw actionError("Conversation message not found.", "AI_SOURCE_MESSAGE_NOT_FOUND", 404);
    }
  }

  try {
    return await prisma.aiPendingAction.create({
      data: {
        userId,
        conversationId,
        sourceMessageId,
        toolName: prepared.definition.name,
        arguments: jsonSafe(prepared.input),
        expiresAt: new Date(Date.now() + expiresInMs),
      },
    });
  } catch (error) {
    if (error.code !== "P2002" || !sourceMessageId) throw error;
    const existing = await prisma.aiPendingAction.findFirst({
      where: { sourceMessageId, userId },
    });
    if (!existing || existing.toolName !== prepared.definition.name ||
        JSON.stringify(existing.arguments) !== JSON.stringify(jsonSafe(prepared.input))) {
      throw actionError("The source message already has a different pending action.", "AI_SOURCE_ACTION_CONFLICT", 409);
    }
    return existing;
  }
}

export async function cancelPendingAiAction({ actionId, userId }) {
  const cancelledAt = new Date();
  const updated = await prisma.aiPendingAction.updateMany({
    where: { id: actionId, userId, status: "PENDING" },
    data: { status: "CANCELLED", cancelledAt },
  });

  if (updated.count !== 1) {
    throw actionError(
      "Pending action was not found or can no longer be cancelled.",
      "AI_ACTION_NOT_CANCELLABLE",
      409,
    );
  }

  return prisma.aiPendingAction.findUnique({ where: { id: actionId } });
}

async function claimPendingAction({ actionId, userId }) {
  const now = new Date();
  const claim = await prisma.$transaction(async (tx) => {
    const updated = await tx.aiPendingAction.updateMany({
      where: {
        id: actionId,
        userId,
        status: "PENDING",
        expiresAt: { gt: now },
      },
      data: { status: "EXECUTING", confirmedAt: now },
    });

    if (updated.count === 1) {
      return { action: await tx.aiPendingAction.findUnique({ where: { id: actionId } }) };
    }

    const existing = await tx.aiPendingAction.findFirst({
      where: { id: actionId, userId },
    });
    if (existing?.status === "PENDING" && existing.expiresAt <= now) {
      await tx.aiPendingAction.update({
        where: { id: actionId },
        data: { status: "EXPIRED" },
      });
      return { error: "expired" };
    }
    return { error: existing ? "unavailable" : "missing" };
  });

  if (claim.error === "expired") {
    throw actionError("This pending action has expired.", "AI_ACTION_EXPIRED", 410);
  }
  if (claim.error) {
    throw actionError(
      "Pending action was not found or has already been handled.",
      "AI_ACTION_UNAVAILABLE",
      409,
    );
  }
  return claim.action;
}

export async function confirmPendingAiAction({ actionId, userId, userRoles = [] }) {
  const action = await claimPendingAction({ actionId, userId });

  try {
    const result = await executeAiTool({
      name: action.toolName,
      arguments: action.arguments,
      context: { userId, roles: userRoles, confirmed: true },
    });
    const completed = await prisma.aiPendingAction.update({
      where: { id: action.id },
      data: {
        status: "EXECUTED",
        result: jsonSafe(result),
        executedAt: new Date(),
      },
    });
    return { action: completed, result };
  } catch (error) {
    await prisma.aiPendingAction.update({
      where: { id: action.id },
      data: {
        status: "FAILED",
        failureReason: String(error.message || "Execution failed.").slice(0, 500),
      },
    });
    throw error;
  }
}
