import { validateAiToolRequest } from "./toolExecutor.js";
import { HOTEL_AI_SYSTEM_INSTRUCTION } from "./hotelAiPrompt.js";
import {
  createGeminiClient,
  extractGeminiUsage,
  generateGeminiContent,
} from "./providers/gemini.provider.js";
import { getGeminiTools } from "./providers/geminiToolBridge.js";

function plannerError(message, code, statusCode = 400) {
  return Object.assign(new Error(message), { code, statusCode });
}

export async function planCustomerMessage({ message, userId, userRoles = [], history = [] }) {
  if (typeof message !== "string" || !message.trim()) {
    throw plannerError("Customer message is required.", "AI_MESSAGE_REQUIRED");
  }
  if (typeof userId !== "string" || !userId.trim()) {
    throw plannerError("An authenticated user is required.", "AI_AUTH_REQUIRED", 401);
  }

  const provider = createGeminiClient();
  const { model } = provider;
  const conversationContents = history.map(({ role, content }) => ({
    role: role === "ASSISTANT" ? "model" : "user",
    parts: [{ text: content }],
  }));
  conversationContents.push({ role: "user", parts: [{ text: message.trim() }] });
  const response = await generateGeminiContent({
    model,
    contents: conversationContents,
    config: {
      systemInstruction: HOTEL_AI_SYSTEM_INSTRUCTION,
      tools: getGeminiTools(),
      maxOutputTokens: 512,
      thinkingConfig: { thinkingLevel: "low" },
    },
  }, { provider });

  const calls = response.functionCalls || [];
  const usage = extractGeminiUsage(response);
  if (calls.length > 1) {
    throw plannerError(
      "The AI proposed multiple operations. Please handle one operation at a time.",
      "AI_MULTIPLE_TOOL_CALLS",
      409,
    );
  }

  if (calls.length === 1) {
    const call = calls[0];
    const prepared = validateAiToolRequest({
      name: call.name,
      arguments: call.args || {},
      context: { userId, roles: userRoles },
    });

    return {
      type: "tool_call",
      model,
      usage,
      providerContext: {
        modelContent: response.candidates?.[0]?.content,
      },
      toolCall: {
        id: call.id,
        name: prepared.definition.name,
        arguments: prepared.input,
        confirmationRequired: prepared.definition.confirmationRequired,
      },
    };
  }

  const text = response.text?.trim();
  if (!text) {
    const finishReason = response.candidates?.[0]?.finishReason || "UNKNOWN";
    throw plannerError(
      `Gemini returned neither text nor a tool call (finish reason: ${finishReason}).`,
      "AI_EMPTY_RESPONSE",
      502,
    );
  }

  return { type: "message", model, text, usage };
}
