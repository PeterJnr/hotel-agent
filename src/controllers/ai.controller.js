import {
  cancelCustomerAiAction,
  confirmCustomerAiAction,
  handlePersistedCustomerAiMessage,
} from "../ai/hotelAiOrchestrator.js";
import {
  archiveAiConversation,
  getAiConversationDetail,
  listAiConversations,
} from "../ai/aiConversation.service.js";
import { getAiMetrics, listAiRuns } from "../ai/aiRun.service.js";

function sendError(res, error) {
  const status = Number(error.statusCode || error.status);
  if (status === 429) {
    if (error.retryAfter) res.set("Retry-After", String(error.retryAfter));
    return res.status(429).json({
      success: false,
      code: error.code || "AI_PROVIDER_RATE_LIMITED",
      message: "The AI service usage limit has been reached. Please try again later.",
      ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
    });
  }
  if (status === 503) {
    return res.status(503).json({ success: false, code: error.code, message: "The AI service is temporarily unavailable. Please try again shortly." });
  }
  if (status === 504) {
    return res.status(504).json({ success: false, code: error.code, message: "The AI service took too long to respond. Please try again." });
  }
  return res.status(status >= 400 && status < 600 ? status : 500).json({
    success: false,
    message: error.message || "The AI request could not be completed.",
  });
}

export async function chatWithHotelAi(req, res) {
  try {
    const data = await handlePersistedCustomerAiMessage({
      message: req.body?.message,
      conversationId: req.body?.conversationId,
      clientMessageId: req.body?.clientMessageId,
      userId: req.user.id,
      userRoles: req.user.roles,
    });
    return res.status(data.type === "confirmation_required" ? 202 : 200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function confirmHotelAiAction(req, res) {
  try {
    const data = await confirmCustomerAiAction({
      actionId: req.params.actionId,
      userId: req.user.id,
      userRoles: req.user.roles,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function cancelHotelAiAction(req, res) {
  try {
    const data = await cancelCustomerAiAction({
      actionId: req.params.actionId,
      userId: req.user.id,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function listHotelAiConversations(req, res) {
  try {
    const parsedLimit = req.query.limit === undefined ? 20 : Number(req.query.limit);
    const data = await listAiConversations({
      userId: req.user.id,
      status: req.query.status,
      limit: parsedLimit,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getHotelAiConversation(req, res) {
  try {
    const data = await getAiConversationDetail({
      conversationId: req.params.conversationId,
      userId: req.user.id,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function archiveHotelAiConversation(req, res) {
  try {
    const data = await archiveAiConversation({
      conversationId: req.params.conversationId,
      userId: req.user.id,
    });
    return res.status(200).json({
      success: true,
      message: "Conversation archived successfully.",
      data,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getHotelAiMetrics(req, res) {
  try {
    const data = await getAiMetrics({ days: req.query.days === undefined ? 7 : req.query.days });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function listHotelAiRuns(req, res) {
  try {
    const data = await listAiRuns({
      limit: req.query.limit === undefined ? 50 : req.query.limit,
      status: req.query.status,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}
