import assert from "node:assert/strict";
import "dotenv/config";

import { createGeminiClient } from "../src/ai/providers/gemini.provider.js";
import {
  getGeminiFunctionDeclarations,
  getGeminiTools,
} from "../src/ai/providers/geminiToolBridge.js";

const declarations = getGeminiFunctionDeclarations();
assert.equal(declarations.length, 9);
assert.equal(new Set(declarations.map(({ name }) => name)).size, 9);
assert.ok(declarations.every(({ parametersJsonSchema }) =>
  parametersJsonSchema?.type === "object" &&
  parametersJsonSchema.additionalProperties === false));

const { client, model } = createGeminiClient();

async function requestTool(prompt) {
  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: {
      tools: getGeminiTools(),
      maxOutputTokens: 256,
      thinkingConfig: { thinkingLevel: "low" },
    },
  });

  const call = response.functionCalls?.[0];
  if (!call) {
    const finishReason = response.candidates?.[0]?.finishReason || "UNKNOWN";
    throw new Error(`Gemini did not select a tool (finish reason: ${finishReason}).`);
  }
  return call;
}

const availabilityCall = await requestTool(
  "Check room availability for exactly 2 guests in a STANDARD room from 2026-10-10 to 2026-10-12. Use the appropriate tool.",
);
assert.equal(availabilityCall.name, "search_room_availability");
assert.deepEqual(availabilityCall.args, {
  roomType: "STANDARD",
  checkIn: "2026-10-10",
  checkOut: "2026-10-12",
  guests: 2,
});

const reservationCall = await requestTool(
  "I explicitly confirm that I want to reserve available room room-test-123 for 2 guests from 2026-10-10 to 2026-10-12. Select the reservation creation tool, but do not execute it.",
);
assert.equal(reservationCall.name, "create_reservation");
assert.deepEqual(reservationCall.args, {
  roomId: "room-test-123",
  checkIn: "2026-10-10",
  checkOut: "2026-10-12",
  guests: 2,
});

console.log(`Gemini selected and populated read/write tool declarations correctly using ${model}.`);
console.log("No hotel tool was executed.");
