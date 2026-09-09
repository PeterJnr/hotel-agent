import { getPayment, initiateFullRefund, listPayments, syncRefund } from "../services/refund.service.js";

const sendError = (res, error) => res.status(error.statusCode || 400).json({ success: false, message: error.message });

export async function payments(req, res) {
  try { return res.json({ success: true, data: await listPayments(req.query) }); }
  catch (error) { return sendError(res, error); }
}
export async function payment(req, res) {
  try { return res.json({ success: true, data: await getPayment(req.params.paymentId) }); }
  catch (error) { return sendError(res, error); }
}
export async function refund(req, res) {
  try {
    const data = await initiateFullRefund({ paymentId: req.params.paymentId, initiatedById: req.user.id, reason: req.body.reason });
    return res.status(202).json({ success: true, message: "Full refund submitted to Paystack.", data });
  } catch (error) { return sendError(res, error); }
}
export async function refreshRefund(req, res) {
  try { return res.json({ success: true, data: await syncRefund(req.params.refundId) }); }
  catch (error) { return sendError(res, error); }
}
