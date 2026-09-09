import assert from "node:assert/strict";

import { formatConfirmedAiAction } from "../src/ai/hotelAiOrchestrator.js";

const response = formatConfirmedAiAction({
  action: { id: "action-test", toolName: "initialize_payment", status: "EXECUTED" },
  result: {
    data: {
      id: "payment-test",
      reservationId: "reservation-test",
      status: "PENDING",
      amount: "45000.00",
      currency: "NGN",
      authorizationUrl: "https://pay.example.test/authorize",
      accessCode: "must-not-leak",
      failureReason: "must-not-leak",
    },
  },
});

assert.equal(response.type, "action_completed");
assert.equal(response.action.status, "EXECUTED");
assert.equal(response.data.authorizationUrl, "https://pay.example.test/authorize");
assert.equal(response.data.accessCode, undefined);
assert.equal(response.data.failureReason, undefined);

console.log("Confirmed action response formatting and payment-field filtering passed.");
