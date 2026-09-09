import assert from "node:assert/strict";
import "dotenv/config";

import { handleCustomerAiMessage } from "../src/ai/hotelAiOrchestrator.js";
import { cancelPendingAiAction } from "../src/ai/pendingAiAction.service.js";
import { prisma } from "../src/lib/prisma.js";

const user = await prisma.user.findFirst({ select: { id: true } });
assert.ok(user, "Seed at least one user before running this smoke test.");

const readResult = await handleCustomerAiMessage({
  userId: user.id,
  message: "Check STANDARD room availability for 2 guests from 2026-10-10 to 2026-10-12.",
});
assert.equal(readResult.type, "message");
assert.ok(readResult.text.length > 0);
assert.equal(readResult.toolUsed.name, "search_room_availability");

const protectedResult = await handleCustomerAiMessage({
  userId: user.id,
  message: "Reserve room fake-room-that-must-not-run for 2 guests from 2026-10-10 to 2026-10-12.",
});
assert.equal(protectedResult.type, "confirmation_required");
assert.equal(protectedResult.proposedAction.name, "create_reservation");
assert.ok(protectedResult.pendingAction.id);
await cancelPendingAiAction({
  actionId: protectedResult.pendingAction.id,
  userId: user.id,
});

console.log("Read-only AI orchestration passed.");
console.log("Protected write stopped before hotel service execution.");
await prisma.$disconnect();
