import { createHash, randomUUID } from "node:crypto";

function anonymize(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

export function createAiRequestLogger({ write = console.info, clock = Date.now } = {}) {
  return function aiRequestLogger(req, res, next) {
    const startedAt = clock();
    const requestId = req.get?.("x-request-id")?.trim() || randomUUID();
    req.aiRequestId = requestId;
    res.set("X-Request-Id", requestId);

    res.once("finish", () => {
      write(JSON.stringify({
        event: "ai_api_request",
        requestId,
        customer: anonymize(req.user?.id || "unknown"),
        method: req.method,
        path: req.baseUrl + req.route?.path,
        status: res.statusCode,
        durationMs: Math.max(0, clock() - startedAt),
      }));
    });
    next();
  };
}

export const aiRequestLogger = createAiRequestLogger();
