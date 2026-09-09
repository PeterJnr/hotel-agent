import { prisma } from "../lib/prisma.js";

function telemetryError(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function boundedInteger(value, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

function usageData(usage = {}) {
  return {
    inputTokens: Number.isInteger(usage.inputTokens) ? usage.inputTokens : null,
    outputTokens: Number.isInteger(usage.outputTokens) ? usage.outputTokens : null,
    totalTokens: Number.isInteger(usage.totalTokens) ? usage.totalTokens : null,
  };
}

export async function startAiRun({ userId, conversationId, sourceMessageId, model }) {
  const data = {
    userId,
    conversationId,
    model,
    status: "PROCESSING",
    responseType: null,
    toolName: null,
    confirmationRequired: false,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    durationMs: null,
    errorCode: null,
    completedAt: null,
  };
  return prisma.aiRun.upsert({
    where: { sourceMessageId },
    create: { ...data, sourceMessageId },
    update: data,
  });
}

export async function completeAiRun({ sourceMessageId, durationMs, responseType, toolName, confirmationRequired = false, usage }) {
  return prisma.aiRun.update({
    where: { sourceMessageId },
    data: {
      status: "SUCCEEDED",
      responseType,
      toolName,
      confirmationRequired,
      durationMs,
      ...usageData(usage),
      errorCode: null,
      completedAt: new Date(),
    },
  });
}

export async function failAiRun({ sourceMessageId, durationMs, errorCode }) {
  return prisma.aiRun.update({
    where: { sourceMessageId },
    data: {
      status: "FAILED",
      durationMs,
      errorCode: String(errorCode).slice(0, 100),
      completedAt: new Date(),
    },
  });
}

export async function getAiMetrics({ days = 7 } = {}) {
  const normalizedDays = boundedInteger(days, 1, 365);
  if (!normalizedDays) throw telemetryError("days must be an integer between 1 and 365.");
  const since = new Date(Date.now() - normalizedDays * 86_400_000);
  const where = { createdAt: { gte: since } };

  const [totals, byStatus, byTool, recentErrors, pendingActions] = await Promise.all([
    prisma.aiRun.aggregate({
      where,
      _count: { _all: true },
      _avg: { durationMs: true },
      _sum: { inputTokens: true, outputTokens: true, totalTokens: true },
    }),
    prisma.aiRun.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.aiRun.groupBy({
      by: ["toolName"],
      where: { ...where, toolName: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { toolName: "desc" } },
    }),
    prisma.aiRun.findMany({
      where: { ...where, status: "FAILED" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, provider: true, model: true, errorCode: true, durationMs: true, createdAt: true },
    }),
    prisma.aiPendingAction.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const statusCounts = Object.fromEntries(byStatus.map((item) => [item.status, item._count._all]));
  const total = totals._count._all;
  const succeeded = statusCounts.SUCCEEDED || 0;
  return {
    period: { days: normalizedDays, since },
    totals: {
      runs: total,
      succeeded,
      failed: statusCounts.FAILED || 0,
      processing: statusCounts.PROCESSING || 0,
      successRate: total ? Number(((succeeded / total) * 100).toFixed(2)) : 0,
      averageDurationMs: totals._avg.durationMs ? Math.round(totals._avg.durationMs) : null,
      tokens: totals._sum,
    },
    tools: byTool.map((item) => ({ name: item.toolName, runs: item._count._all })),
    pendingActions: Object.fromEntries(pendingActions.map((item) => [item.status, item._count._all])),
    recentErrors,
  };
}

export async function listAiRuns({ limit = 50, status } = {}) {
  const normalizedLimit = boundedInteger(limit, 1, 100);
  if (!normalizedLimit) throw telemetryError("limit must be an integer between 1 and 100.");
  const allowedStatuses = ["PROCESSING", "SUCCEEDED", "FAILED"];
  if (status && !allowedStatuses.includes(status)) throw telemetryError("Invalid AI run status.");

  return prisma.aiRun.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: normalizedLimit,
    select: {
      id: true,
      provider: true,
      model: true,
      status: true,
      responseType: true,
      toolName: true,
      confirmationRequired: true,
      inputTokens: true,
      outputTokens: true,
      totalTokens: true,
      durationMs: true,
      errorCode: true,
      createdAt: true,
      completedAt: true,
    },
  });
}
