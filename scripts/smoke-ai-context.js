import assert from "node:assert/strict";

import { buildToolResultContents } from "../src/ai/hotelAiOrchestrator.js";

const contents = buildToolResultContents({
  history: [
    { role: "USER", content: "I need a room from 2026-09-08 to 2026-09-09 for 2 guests." },
    { role: "ASSISTANT", content: "Room 201 is available for those dates." },
  ],
  message: "Book room 201 for me.",
  modelContent: {
    role: "model",
    parts: [{ functionCall: { name: "search_room_availability", args: { roomId: "201" } } }],
  },
  functionResponse: {
    name: "search_room_availability",
    response: { success: true, available: true },
  },
});

assert.equal(contents.length, 5);
assert.equal(contents[0].role, "user");
assert.match(contents[0].parts[0].text, /2026-09-08/);
assert.match(contents[0].parts[0].text, /2 guests/);
assert.equal(contents[1].role, "model");
assert.equal(contents[2].parts[0].text, "Book room 201 for me.");
assert.equal(contents[3].parts[0].functionCall.name, "search_room_availability");
assert.equal(contents[4].parts[0].functionResponse.name, "search_room_availability");

console.log("AI tool-result conversation context check passed.");
