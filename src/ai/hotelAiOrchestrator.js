import { executeAiTool, validateAiToolRequest } from "./toolExecutor.js";
import {
  createAiConversation,
  getAiConversation,
  getAssistantReplyForUserMessage,
  getRecentAiMessages,
  markUserAiMessageFailed,
  retryFailedUserAiMessage,
  saveAssistantAiMessage,
  saveUserAiMessage,
  validateUserAiMessageInput,
} from "./aiConversation.service.js";
import { HOTEL_AI_SYSTEM_INSTRUCTION } from "./hotelAiPrompt.js";
import { planCustomerMessage } from "./hotelAiPlanner.js";
import {
  cancelPendingAiAction,
  confirmPendingAiAction,
  createPendingAiAction,
} from "./pendingAiAction.service.js";
import {
  createGeminiClient,
  extractGeminiUsage,
  generateGeminiContent,
} from "./providers/gemini.provider.js";
import { getGeminiTools } from "./providers/geminiToolBridge.js";
import { completeAiRun, failAiRun, startAiRun } from "./aiRun.service.js";

function toJsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function orchestratorError(message, code, statusCode = 502) {
  return Object.assign(new Error(message), { code, statusCode });
}

function combineUsage(...items) {
  const sum = (field) => {
    const values = items.map((item) => item?.[field]).filter(Number.isInteger);
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };
  return { inputTokens: sum("inputTokens"), outputTokens: sum("outputTokens"), totalTokens: sum("totalTokens") };
}

const MAX_AUTOMATIC_TOOL_STEPS = 4;

function prepareProviderToolCall(call, { userId, userRoles }) {
  const prepared = validateAiToolRequest({
    name: call.name,
    arguments: call.args || {},
    context: { userId, roles: userRoles },
  });
  return {
    id: call.id,
    name: prepared.definition.name,
    arguments: prepared.input,
    confirmationRequired: prepared.definition.confirmationRequired,
  };
}

export function buildToolResultContents({ history = [], message, modelContent, functionResponse }) {
  const conversationContents = history.map(({ role, content }) => ({
    role: role === "ASSISTANT" ? "model" : "user",
    parts: [{ text: content }],
  }));

  return [
    ...conversationContents,
    { role: "user", parts: [{ text: message.trim() }] },
    modelContent,
    { role: "user", parts: [{ functionResponse }] },
  ];
}

export function formatConfirmedAiAction({ action, result }) {
  const data = result.data;
  const common = {
    type: "action_completed",
    action: { id: action.id, name: action.toolName, status: action.status },
  };

  switch (action.toolName) {
    case "create_reservation":
      return {
        ...common,
        message: "Your reservation was created successfully and is awaiting payment.",
        data: {
          id: data.id,
          status: data.status,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          guests: data.guests,
          totalAmount: data.totalAmount,
          room: data.room,
        },
      };
    case "cancel_pending_reservation":
      return {
        ...common,
        message: "Your pending reservation was cancelled successfully.",
        data: { id: data.id, status: data.status },
      };
    case "initialize_payment":
      return {
        ...common,
        message: "Your secure payment link is ready.",
        data: {
          id: data.id,
          reservationId: data.reservationId,
          status: data.status,
          amount: data.amount,
          currency: data.currency,
          authorizationUrl: data.authorizationUrl,
        },
      };
    case "create_service_request":
      return {
        ...common,
        message: "Your service request was submitted successfully.",
        data: {
          id: data.id,
          reservationId: data.reservationId,
          category: data.category,
          priority: data.priority,
          status: data.status,
          title: data.title,
          description: data.description,
        },
      };
    case "add_service_request_comment":
      return {
        ...common,
        message: "Your comment was added successfully.",
        data: {
          id: data.id,
          serviceRequestId: data.serviceRequestId,
          content: data.content,
          createdAt: data.createdAt,
        },
      };
    default:
      throw orchestratorError("Unsupported confirmed AI action.", "AI_ACTION_RESPONSE_UNSUPPORTED");
  }
}

export async function confirmCustomerAiAction({ actionId, userId, userRoles = [] }) {
  const completed = await confirmPendingAiAction({ actionId, userId, userRoles });
  return formatConfirmedAiAction(completed);
}

export async function cancelCustomerAiAction({ actionId, userId }) {
  const action = await cancelPendingAiAction({ actionId, userId });
  return {
    type: "action_cancelled",
    message: "The proposed action was cancelled.",
    action: { id: action.id, name: action.toolName, status: action.status },
  };
}

export async function handleCustomerAiMessage({
  message,
  userId,
  userRoles = [],
  history = [],
  conversationId,
  sourceMessageId,
}, dependencies = {}) {
  const planMessage = dependencies.planCustomerMessage || planCustomerMessage;
  const executeTool = dependencies.executeAiTool || executeAiTool;
  const createAction = dependencies.createPendingAiAction || createPendingAiAction;
  const createProvider = dependencies.createGeminiClient || createGeminiClient;
  const generateContent = dependencies.generateGeminiContent || generateGeminiContent;
  const plan = await planMessage({ message, userId, userRoles, history });

  if (plan.type === "message") {
    return { ...plan, _telemetry: { usage: plan.usage } };
  }

  const provider = createProvider();
  const { model } = provider;
  const contents = history.map(({ role, content }) => ({
    role: role === "ASSISTANT" ? "model" : "user",
    parts: [{ text: content }],
  }));
  contents.push({ role: "user", parts: [{ text: message.trim() }] });

  let toolCall = plan.toolCall;
  let modelContent = plan.providerContext.modelContent;
  let usage = plan.usage;
  const toolsUsed = [];

  for (let step = 0; step < MAX_AUTOMATIC_TOOL_STEPS; step += 1) {
    if (toolCall.confirmationRequired) {
      const pendingAction = await createAction({
        userId,
        userRoles,
        conversationId,
        sourceMessageId,
        toolName: toolCall.name,
        arguments: toolCall.arguments,
      });
      return {
        type: "confirmation_required",
        model,
        message: "Please explicitly confirm before I perform this action.",
        pendingAction: { id: pendingAction.id, expiresAt: pendingAction.expiresAt },
        proposedAction: {
          id: pendingAction.id,
          name: toolCall.name,
          arguments: toolCall.arguments,
          expiresAt: pendingAction.expiresAt,
        },
        _telemetry: {
          usage,
          toolName: toolCall.name,
          confirmationRequired: true,
        },
      };
    }

    const toolResult = await executeTool({
      name: toolCall.name,
      arguments: toolCall.arguments,
      context: { userId, roles: userRoles },
    });
    toolsUsed.push(toolCall.name);
    contents.push(modelContent);
    contents.push({
      role: "user",
      parts: [{
        functionResponse: {
          name: toolCall.name,
          response: toJsonSafe(toolResult),
          ...(toolCall.id ? { id: toolCall.id } : {}),
        },
      }],
    });

    const response = await generateContent({
      model,
      contents,
      config: {
        systemInstruction: HOTEL_AI_SYSTEM_INSTRUCTION,
        tools: getGeminiTools(),
        maxOutputTokens: 512,
        thinkingConfig: { thinkingLevel: "low" },
      },
    }, { provider });
    usage = combineUsage(usage, extractGeminiUsage(response));

    const calls = response.functionCalls || [];
    if (calls.length > 1) {
      throw orchestratorError(
        "The AI proposed multiple operations. Please handle one operation at a time.",
        "AI_MULTIPLE_TOOL_CALLS",
        409,
      );
    }
    if (calls.length === 1) {
      toolCall = prepareProviderToolCall(calls[0], { userId, userRoles });
      modelContent = response.candidates?.[0]?.content;
      continue;
    }

    const text = response.text?.trim();
    if (!text) {
      const finishReason = response.candidates?.[0]?.finishReason || "UNKNOWN";
      throw orchestratorError(
        `Gemini returned neither a follow-up action nor a summary (finish reason: ${finishReason}).`,
        "AI_EMPTY_TOOL_SUMMARY",
      );
    }

    return {
      type: "message",
      model,
      text,
      toolUsed: { name: toolsUsed.at(-1), names: toolsUsed },
      _telemetry: { usage, toolName: toolsUsed.at(-1) },
    };
  }

  throw orchestratorError(
    "Solacii could not complete this request safely in one turn. Please try a more specific request.",
    "AI_TOOL_STEP_LIMIT",
    409,
  );
}

export async function handlePersistedCustomerAiMessage({
  message,
  userId,
  userRoles = [],
  conversationId,
  clientMessageId,
}) {
  validateUserAiMessageInput({ content: message, clientMessageId });
  const conversation = conversationId
    ? await getAiConversation({ conversationId, userId })
    : await createAiConversation({ userId, title: message?.trim().slice(0, 100) });

  const saved = await saveUserAiMessage({
    conversationId: conversation.id,
    userId,
    content: message,
    clientMessageId,
  });

  if (saved.duplicate) {
    if (saved.message.status === "COMPLETED") {
      const reply = await getAssistantReplyForUserMessage({
        userMessageId: saved.message.id,
        conversationId: conversation.id,
        userId,
      });
      if (!reply?.metadata?.response) {
        throw orchestratorError("Stored AI response is unavailable.", "AI_STORED_RESPONSE_MISSING", 500);
      }
      return { ...reply.metadata.response, duplicate: true };
    }
    if (saved.message.status === "PROCESSING") {
      throw orchestratorError("This message is already being processed.", "AI_MESSAGE_PROCESSING", 409);
    }
    const claimed = await retryFailedUserAiMessage({
      messageId: saved.message.id,
      conversationId: conversation.id,
      userId,
    });
    if (!claimed) {
      throw orchestratorError("This message could not be retried.", "AI_MESSAGE_RETRY_CONFLICT", 409);
    }
  }

  const runStartedAt = Date.now();
  await startAiRun({
    userId,
    conversationId: conversation.id,
    sourceMessageId: saved.message.id,
    model: process.env.GEMINI_MODEL?.trim() || "gemini-3.7-flash",
  });

  try {
    const history = (await getRecentAiMessages({
      conversationId: conversation.id,
      userId,
    })).filter(({ id }) => id !== saved.message.id);
    const result = await handleCustomerAiMessage({
      message,
      userId,
      userRoles,
      history,
      conversationId: conversation.id,
      sourceMessageId: saved.message.id,
    });
    const { _telemetry, usage: _plannerUsage, ...publicResult } = result;
    const response = {
      ...publicResult,
      conversationId: conversation.id,
      clientMessageId,
      duplicate: false,
    };
    await saveAssistantAiMessage({
      conversationId: conversation.id,
      userId,
      replyToMessageId: saved.message.id,
      content: result.text || result.message,
      metadata: { response: toJsonSafe(response) },
    });
    try {
      await completeAiRun({
        sourceMessageId: saved.message.id,
        durationMs: Date.now() - runStartedAt,
        responseType: result.type,
        ..._telemetry,
      });
    } catch {
      console.error("AI telemetry completion update failed.");
    }
    return response;
  } catch (error) {
    await markUserAiMessageFailed({
      messageId: saved.message.id,
      conversationId: conversation.id,
      userId,
      error,
    });
    try {
      await failAiRun({
        sourceMessageId: saved.message.id,
        durationMs: Date.now() - runStartedAt,
        errorCode: error.code || "AI_UNEXPECTED_ERROR",
      });
    } catch {
      console.error("AI telemetry failure update failed.");
    }
    throw error;
  }
}
