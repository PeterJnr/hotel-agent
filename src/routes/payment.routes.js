import express from "express";

import {
  initializePayment,
  paystackWebhook,
  verifyPayment,
} from "../controllers/payment.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/webhook", paystackWebhook);
router.post(
  "/reservations/:reservationId/initialize",
  authenticate,
  initializePayment,
);
router.post("/:reference/verify", authenticate, verifyPayment);

export default router;
