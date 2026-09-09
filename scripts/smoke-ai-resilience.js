import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { generateGeminiContent } from "../src/ai/providers/gemini.provider.js";
import {
  clearAiRateLimitBuckets,
  createAiRateLimiter,
} from "../src/middleware/aiRateLimit.middleware.js";
import { createAiRequestLogger } from "../src/middleware/aiRequestLog.middleware.js";

function responseDouble() {
  const res = new EventEmitter();
  res.headers = {};
  res.statusCode = 200;
  res.body = undefined;
  res.set = (name, value) => { res.headers[name] = value; return res; };
  res.status = (status) => { res.statusCode = status; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

clearAiRateLimitBuckets();
let time = 1_000;
const limiter = createAiRateLimiter({ windowMs: 60_000, max: 2, now: () => time });
const callLimiter = (userId) => {
  const res = responseDouble();
  let passed = false;
  limiter({ user: { id: userId } }, res, () => { passed = true; });
  return { res, passed };
};

assert.equal(callLimiter("customer-a").passed, true);
assert.equal(callLimiter("customer-a").passed, true);
const limited = callLimiter("customer-a");
assert.equal(limited.passed, false);
assert.equal(limited.res.statusCode, 429);
assert.equal(limited.res.body.code, "AI_REQUEST_RATE_LIMITED");
assert.equal(callLimiter("customer-b").passed, true);
time += 60_001;
assert.equal(callLimiter("customer-a").passed, true);

let providerCalls = 0;
const recoveringProvider = {
  model: "test-model",
  timeoutMs: 1_000,
  maxRetries: 2,
  client: { models: { generateContent: async ({ config }) => {
    assert.ok(config.abortSignal);
    providerCalls += 1;
    if (providerCalls < 3) throw Object.assign(new Error("busy"), { status: 503 });
    return { text: "ready" };
  } } },
};
const recovered = await generateGeminiContent({ contents: "hello" }, { provider: recoveringProvider });
assert.equal(recovered.text, "ready");
assert.equal(providerCalls, 3);

let quotaCalls = 0;
const quotaProvider = {
  ...recoveringProvider,
  client: { models: { generateContent: async () => {
    quotaCalls += 1;
    throw Object.assign(new Error("quota details must not escape"), { status: 429 });
  } } },
};
await assert.rejects(
  generateGeminiContent({ contents: "hello" }, { provider: quotaProvider }),
  (error) => error.code === "AI_PROVIDER_RATE_LIMITED" && error.statusCode === 429,
);
assert.equal(quotaCalls, 1);

const logs = [];
let clock = 10;
const logger = createAiRequestLogger({ write: (line) => logs.push(line), clock: () => clock });
const logResponse = responseDouble();
const secretMessage = "my secret card and prompt";
logger({
  user: { id: "customer-secret-id" },
  body: { message: secretMessage },
  method: "POST",
  baseUrl: "/api/ai",
  route: { path: "/chat" },
  get: () => undefined,
}, logResponse, () => {});
clock = 25;
logResponse.statusCode = 200;
logResponse.emit("finish");
assert.equal(logs.length, 1);
assert.equal(logs[0].includes(secretMessage), false);
assert.equal(logs[0].includes("customer-secret-id"), false);
assert.equal(JSON.parse(logs[0]).durationMs, 15);

console.log("AI resilience smoke test passed.");
