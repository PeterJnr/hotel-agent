import assert from "node:assert/strict";
import "dotenv/config";

process.env.SENDLIB_API_KEY ||= "smoke-key";
process.env.SENDLIB_FROM_EMAIL ||= "hotel@example.com";

let delivery;
globalThis.fetch = async (url, options) => {
  delivery = { url, ...JSON.parse(options.body) };
  return { ok: true, json: async () => ({ success: true }) };
};

const { registerWithEmail } = await import("../src/services/auth.service.js");
const { prisma } = await import("../src/lib/prisma.js");
const email = `welcome-smoke-${Date.now()}@example.com`;
let userId;

try {
  const result = await registerWithEmail({
    firstName: "Welcome",
    lastName: "Guest",
    email,
    phone: null,
    password: "SmokePass123!",
  });
  userId = result.user.id;
  assert.equal(delivery.to, email);
  assert.match(delivery.subject, /welcome/i);
  assert.match(delivery.html, /Welcome/);
  assert.equal(delivery.url, "https://sendlib.samueltuoyo.com/api/send");
  console.log(JSON.stringify({ accountCreated: true, welcomeEmailSent: true, credentialsExcluded: !delivery.html.includes("SmokePass123!") }));
} finally {
  if (userId) await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
}
