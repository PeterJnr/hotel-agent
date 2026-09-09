import express from "express";
import { payment, payments, refund, refreshRefund } from "../controllers/refund.controller.js";
import { authenticate, authorizeRoles } from "../middleware/auth.middleware.js";

const router = express.Router();
router.use(authenticate, authorizeRoles("SUPER_ADMIN", "ADMIN", "ACCOUNTANT"));
router.get("/", payments);
router.get("/:paymentId", payment);
router.post("/:paymentId/refund", refund);
router.post("/refunds/:refundId/sync", refreshRefund);
export default router;
