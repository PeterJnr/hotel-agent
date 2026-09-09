import assert from "node:assert/strict";
import "dotenv/config";

import {
  cancelPendingAiAction,
  confirmPendingAiAction,
  createPendingAiAction,
} from "../src/ai/pendingAiAction.service.js";
import { prisma } from "../src/lib/prisma.js";

const user = await prisma.user.findFirst({ select: { id: true } });
assert.ok(user, "Seed at least one user before running this smoke test.");
const createdIds = [];

try {
  await assert.rejects(
    () => createPendingAiAction({
      userId: user.id,
      toolName: "get_my_bookings",
      arguments: {},
    }),
    (error) => error.code === "AI_CONFIRMATION_NOT_REQUIRED",
  );

  const cancellable = await createPendingAiAction({
    userId: user.id,
    toolName: "create_reservation",
    arguments: {
      roomId: "fake-room-cancelled",
      checkIn: "2026-10-10",
      checkOut: "2026-10-12",
      guests: 2,
    },
  });
  createdIds.push(cancellable.id);
  const cancelled = await cancelPendingAiAction({ actionId: cancellable.id, userId: user.id });
  assert.equal(cancelled.status, "CANCELLED");
  await assert.rejects(
    () => confirmPendingAiAction({ actionId: cancellable.id, userId: user.id }),
    (error) => error.code === "AI_ACTION_UNAVAILABLE",
  );

  const executable = await createPendingAiAction({
    userId: user.id,
    toolName: "create_reservation",
    arguments: {
      roomId: "fake-room-confirmed",
      checkIn: "2026-10-10",
      checkOut: "2026-10-12",
      guests: 2,
    },
  });
  createdIds.push(executable.id);
  await assert.rejects(
    () => confirmPendingAiAction({ actionId: executable.id, userId: user.id }),
    /Room not found/,
  );
  const failed = await prisma.aiPendingAction.findUnique({ where: { id: executable.id } });
  assert.equal(failed.status, "FAILED");
  await assert.rejects(
    () => confirmPendingAiAction({ actionId: executable.id, userId: user.id }),
    (error) => error.code === "AI_ACTION_UNAVAILABLE",
  );

  console.log("Pending AI action lifecycle and replay protection passed.");
} finally {
  await prisma.aiPendingAction.deleteMany({ where: { id: { in: createdIds } } });
  await prisma.$disconnect();
}
