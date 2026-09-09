import assert from "node:assert/strict";

import { aiToolDefinitions } from "../src/ai/toolRegistry.js";
import { prepareAiToolCall } from "../src/ai/toolExecutor.js";

assert.equal(aiToolDefinitions.length, 9);
assert.equal(new Set(aiToolDefinitions.map(({ name }) => name)).size, 9);
assert.ok(aiToolDefinitions.every(({ inputSchema }) => inputSchema.additionalProperties === false));

assert.throws(
  () => prepareAiToolCall({ name: "get_my_bookings", context: {} }),
  (error) => error.code === "AI_AUTH_REQUIRED" && error.statusCode === 401,
);
assert.throws(
  () => prepareAiToolCall({ name: "create_reservation", arguments: { roomId: "room-1", checkIn: "2026-10-10", checkOut: "2026-10-12", guests: 2 }, context: { userId: "user-1" } }),
  (error) => error.code === "AI_CONFIRMATION_REQUIRED" && error.statusCode === 409,
);
assert.throws(
  () => prepareAiToolCall({ name: "get_my_bookings", arguments: { userId: "spoofed" }, context: { userId: "user-1" } }),
  (error) => error.code === "INVALID_TOOL_ARGUMENTS",
);

const prepared = prepareAiToolCall({
  name: "create_reservation",
  arguments: { roomId: "room-1", checkIn: "2026-10-10", checkOut: "2026-10-12", guests: 2 },
  context: { userId: "user-1", roles: ["CUSTOMER"], confirmed: true },
});
assert.equal(prepared.userId, "user-1");
assert.equal(prepared.input.userId, undefined);

console.log("AI tool contract smoke checks passed.");
