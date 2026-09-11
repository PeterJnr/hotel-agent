import assert from "node:assert/strict";

import { handleCustomerAiMessage } from "../src/ai/hotelAiOrchestrator.js";

const calls = [];
const result = await handleCustomerAiMessage({
  message: "Yes please do.",
  userId: "customer-1",
  userRoles: ["CUSTOMER"],
  history: [
    { role: "USER", content: "The AC in room 104 is not working." },
    { role: "ASSISTANT", content: "Would you like me to create a maintenance request?" },
  ],
  conversationId: "conversation-1",
  sourceMessageId: "message-1",
}, {
  planCustomerMessage: async () => ({
    type: "tool_call",
    model: "test-model",
    usage: {},
    providerContext: { modelContent: { role: "model", parts: [{ functionCall: { name: "get_my_bookings", args: {} } }] } },
    toolCall: { name: "get_my_bookings", arguments: {}, confirmationRequired: false },
  }),
  createGeminiClient: () => ({ model: "test-model", client: {} }),
  executeAiTool: async (call) => {
    calls.push(call.name);
    return { tool: call.name, success: true, data: [{ id: "reservation-1", status: "CHECKED_IN", room: { roomNumber: "104" } }] };
  },
  generateGeminiContent: async () => ({
    functionCalls: [{
      name: "create_service_request",
      args: { reservationId: "reservation-1", category: "MAINTENANCE", title: "Room 104 AC issue", description: "The air conditioner in room 104 is not working." },
    }],
    candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "create_service_request" } }] }, finishReason: "STOP" }],
  }),
  createPendingAiAction: async (action) => ({ id: "action-1", expiresAt: new Date("2030-01-01T00:00:00.000Z"), ...action }),
});

assert.deepEqual(calls, ["get_my_bookings"]);
assert.equal(result.type, "confirmation_required");
assert.equal(result.proposedAction.name, "create_service_request");
assert.equal(result.proposedAction.arguments.category, "MAINTENANCE");
assert.equal(result.proposedAction.arguments.reservationId, "reservation-1");
console.log("Multi-step guest-service lookup and confirmation handoff passed.");
