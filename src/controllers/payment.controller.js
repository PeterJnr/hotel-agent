import { verifyPaystackWebhookSignature } from "../lib/paystack.js";
import {
  initializeReservationPayment,
  verifyReservationPayment,
} from "../services/payment.service.js";
import { processRefundWebhook } from "../services/refund.service.js";

function sendError(res, error) {
  return res.status(error.statusCode || 400).json({
    success: false,
    message: error.message,
  });
}

export async function initializePayment(req, res) {
  try {
    const payment = await initializeReservationPayment({
      reservationId: req.params.reservationId,
      userId: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Payment initialized successfully.",
      data: payment,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function verifyPayment(req, res) {
  try {
    const payment = await verifyReservationPayment({
      reference: req.params.reference,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: "Payment verification completed.",
      data: payment,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function paystackWebhook(req, res) {
  try {
    const signature = req.headers["x-paystack-signature"];

    if (!verifyPaystackWebhookSignature(req.rawBody, signature)) {
      return res.status(401).json({
        success: false,
        message: "Invalid Paystack webhook signature.",
      });
    }

    if (req.body.event === "charge.success" && req.body.data?.reference) {
      await verifyReservationPayment({
        reference: req.body.data.reference,
      });
    }
    if (req.body.event?.startsWith("refund.") && req.body.data) {
      await processRefundWebhook(req.body.event, req.body.data);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
}
