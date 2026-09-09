import "dotenv/config";

import { createGeminiClient } from "../src/ai/providers/gemini.provider.js";

try {
  const { client, model } = createGeminiClient();
  const response = await client.models.generateContent({
    model,
    contents: "Reply with exactly: HOTEL_AI_GEMINI_OK",
    config: {
      temperature: 0,
      maxOutputTokens: 128,
      thinkingConfig: {
        thinkingLevel: "low",
      },
    },
  });

  if (!response.text?.includes("HOTEL_AI_GEMINI_OK")) {
    const finishReason = response.candidates?.[0]?.finishReason || "UNKNOWN";
    throw new Error(
      `Gemini responded, but the connection check returned an unexpected result (finish reason: ${finishReason}).`,
    );
  }

  console.log(`Gemini connection passed using ${model}.`);
} catch (error) {
  console.error(`Gemini connection failed: ${error.message}`);
  process.exitCode = 1;
}
