import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import "dotenv/config";

process.env.SENDLIB_API_KEY = "password-reset-smoke-secret";
process.env.SENDLIB_FROM_EMAIL = "Apex Solacii <bookings@example.com>";
process.env.FRONTEND_RESET_PASSWORD_URL = "http://localhost:5173/reset-password";

let delivery;
globalThis.fetch = async (_url, options) => {
  delivery = JSON.parse(options.body);
  return { ok: true, json: async () => ({ id: "password-reset-email" }) };
};

const [{ prisma }, auth] = await Promise.all([
  import("../src/lib/prisma.js"),
  import("../src/services/auth.service.js"),
]);
const email = `password-reset-${randomUUID()}@example.com`;
let userId;

try {
  const registration = await auth.registerWithEmail({ firstName: "Reset", lastName: "Guest", email, phone: null, password: "OriginalPass123!" });
  userId = registration.user.id;
  delivery = null;
  await auth.requestPasswordReset({ email });
  assert.match(delivery.subject, /reset your password/i);
  const token = new URL(delivery.text.match(/Reset password: (\S+)/)[1]).searchParams.get("token");
  assert.ok(token);
  const stored = await prisma.passwordResetToken.findUnique({ where: { tokenHash: createHash("sha256").update(token).digest("hex") } });
  assert.ok(stored);
  await auth.resetPassword({ token, password: "UpdatedPass123!" });
  await assert.rejects(() => auth.loginWithEmail({ email, password: "OriginalPass123!" }), /Invalid email or password/);
  await auth.loginWithEmail({ email, password: "UpdatedPass123!" });
  await assert.rejects(() => auth.resetPassword({ token, password: "AnotherPass123!" }), /invalid or has expired/i);
  console.log("Password reset email, hashed token, password update, session revocation, and one-time use passed.");
} finally {
  if (userId) await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
}
