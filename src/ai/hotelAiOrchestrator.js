import { executeAiTool } from "./toolExecutor.js";
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
}) {
  const plan = await planCustomerMessage({ message, userId, userRoles, history });

  if (plan.type === "message") {
    return { ...plan, _telemetry: { usage: plan.usage } };
  }

  if (plan.toolCall.confirmationRequired) {
    const pendingAction = await createPendingAiAction({
      userId,
      userRoles,
      conversationId,
      sourceMessageId,
      toolName: plan.toolCall.name,
      arguments: plan.toolCall.arguments,
    });
    return {
      type: "confirmation_required",
      model: plan.model,
      message: "Please explicitly confirm before I perform this action.",
      pendingAction: {
        id: pendingAction.id,
        expiresAt: pendingAction.expiresAt,
      },
      proposedAction: {
        id: pendingAction.id,
        name: plan.toolCall.name,
        arguments: plan.toolCall.arguments,
        expiresAt: pendingAction.expiresAt,
      },
      _telemetry: {
        usage: plan.usage,
        toolName: plan.toolCall.name,
        confirmationRequired: true,
      },
    };
  }

  const toolResult = await executeAiTool({
    name: plan.toolCall.name,
    arguments: plan.toolCall.arguments,
    context: { userId, roles: userRoles },
  });

  const provider = createGeminiClient();
  const { model } = provider;
  const functionResponse = {
    name: plan.toolCall.name,
    response: toJsonSafe(toolResult),
    ...(plan.toolCall.id ? { id: plan.toolCall.id } : {}),
  };

  const response = await generateGeminiContent({
    model,
    contents: buildToolResultContents({
      history,
      message,
      modelContent: plan.providerContext.modelContent,
      functionResponse,
    }),
    config: {
      systemInstruction: HOTEL_AI_SYSTEM_INSTRUCTION,
      tools: getGeminiTools(),
      maxOutputTokens: 512,
      thinkingConfig: { thinkingLevel: "low" },
    },
  }, { provider });

  const text = response.text?.trim();
  if (!text) {
    const finishReason = response.candidates?.[0]?.finishReason || "UNKNOWN";
    throw orchestratorError(
      `Gemini could not summarize the tool result (finish reason: ${finishReason}).`,
      "AI_EMPTY_TOOL_SUMMARY",
    );
  }

  return {
    type: "message",
    model,
    text,
    toolUsed: { name: plan.toolCall.name },
    _telemetry: {
      usage: combineUsage(plan.usage, extractGeminiUsage(response)),
      toolName: plan.toolCall.name,
    },
  };
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
