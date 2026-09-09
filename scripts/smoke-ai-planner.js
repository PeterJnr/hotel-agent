import assert from "node:assert/strict";
import "dotenv/config";

import { planCustomerMessage } from "../src/ai/hotelAiPlanner.js";

await assert.rejects(
  () => planCustomerMessage({ message: "", userId: "user-test" }),
  (error) => error.code === "AI_MESSAGE_REQUIRED",
);

const readPlan = await planCustomerMessage({
  userId: "user-test",
  message: "Check STANDARD room availability for 2 guests from 2026-10-10 to 2026-10-12.",
});
assert.equal(readPlan.type, "tool_call");
assert.equal(readPlan.toolCall.name, "search_room_availability");
assert.equal(readPlan.toolCall.confirmationRequired, false);
assert.equal(readPlan.toolCall.arguments.guests, 2);

const writePlan = await planCustomerMessage({
  userId: "user-test",
  message: "Reserve room room-test-123 for 2 guests from 2026-10-10 to 2026-10-12.",
});
assert.equal(writePlan.type, "tool_call");
assert.equal(writePlan.toolCall.name, "create_reservation");
assert.equal(writePlan.toolCall.confirmationRequired, true);

console.log("Hotel AI planner returned validated read/write plans.");
console.log("No hotel tool was executed.");
