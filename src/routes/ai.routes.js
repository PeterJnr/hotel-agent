import express from "express";

import {
  cancelHotelAiAction,
  chatWithHotelAi,
  confirmHotelAiAction,
  archiveHotelAiConversation,
  getHotelAiConversation,
  getHotelAiMetrics,
  listHotelAiConversations,
  listHotelAiRuns,
} from "../controllers/ai.controller.js";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware.js";
import { aiChatRateLimit } from "../middleware/aiRateLimit.middleware.js";
import { aiRequestLogger } from "../middleware/aiRequestLog.middleware.js";

const router = express.Router();
const aiAdmins = authorizeRoles("SUPER_ADMIN", "ADMIN");

router.get("/admin/metrics", authenticate, aiAdmins, getHotelAiMetrics);
router.get("/admin/runs", authenticate, aiAdmins, listHotelAiRuns);

router.use(authenticate, authorizeRoles("CUSTOMER"));
router.use(aiRequestLogger);
router.post("/chat", aiChatRateLimit, chatWithHotelAi);
router.get("/conversations", listHotelAiConversations);
router.get("/conversations/:conversationId", getHotelAiConversation);
router.patch("/conversations/:conversationId/archive", archiveHotelAiConversation);
router.post("/actions/:actionId/confirm", confirmHotelAiAction);
router.delete("/actions/:actionId", cancelHotelAiAction);

export default router;
