import crypto from "node:crypto";

const paystackBaseUrl = "https://api.paystack.co";

function getPaystackSecretKey() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    const error = new Error("PAYSTACK_SECRET_KEY is not configured.");
    error.statusCode = 500;
    throw error;
  }

  return secretKey;
}

async function paystackRequest(path, options = {}) {
  let response;

  try {
    response = await fetch(`${paystackBaseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${getPaystackSecretKey()}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    const error = new Error("Unable to reach Paystack.");
    error.statusCode = 502;
    throw error;
  }

  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.status) {
    const error = new Error(body?.message || "Paystack request failed.");
    error.statusCode = 502;
    throw error;
  }

  return body.data;
}

export function initializePaystackTransaction({
  email,
  amountInKobo,
  reference,
  reservationId,
}) {
  const callbackUrl = process.env.PAYSTACK_CALLBACK_URL;

  return paystackRequest("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email,
      amount: String(amountInKobo),
      currency: "NGN",
      reference,
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      metadata: {
        reservationId,
      },
    }),
  });
}

export function verifyPaystackTransaction(reference) {
  return paystackRequest(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
}

export function createPaystackRefund({ reference, reason }) {
  return paystackRequest("/refund", {
    method: "POST",
    body: JSON.stringify({
      transaction: reference,
      customer_note: reason || "Hotel reservation cancellation",
      merchant_note: reason || "Full reservation refund",
    }),
  });
}

export function fetchPaystackRefund(refundId) {
  return paystackRequest(`/refund/${encodeURIComponent(refundId)}`);
}

export function verifyPaystackWebhookSignature(rawBody, signature) {
  if (!Buffer.isBuffer(rawBody) || typeof signature !== "string") {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha512", getPaystackSecretKey())
    .update(rawBody)
    .digest("hex");
  const provided = Buffer.from(signature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");

  return (
    provided.length === expected.length &&
    crypto.timingSafeEqual(provided, expected)
  );
}
