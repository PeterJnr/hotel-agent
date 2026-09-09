const buckets = new Map();

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createAiRateLimiter({
  windowMs = positiveInteger(process.env.AI_CHAT_RATE_LIMIT_WINDOW_MS, 60_000),
  max = positiveInteger(process.env.AI_CHAT_RATE_LIMIT_MAX, 5),
  now = Date.now,
} = {}) {
  return function aiRateLimit(req, res, next) {
    const key = req.user?.id;
    if (!key) return res.status(401).json({ success: false, message: "Authentication is required." });

    const currentTime = now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= currentTime) {
      bucket = { count: 0, resetAt: currentTime + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000));
    res.set("RateLimit-Limit", String(max));
    res.set("RateLimit-Remaining", String(remaining));
    res.set("RateLimit-Reset", String(resetSeconds));

    if (bucket.count > max) {
      res.set("Retry-After", String(resetSeconds));
      return res.status(429).json({
        success: false,
        code: "AI_REQUEST_RATE_LIMITED",
        message: "Too many AI requests. Please wait before trying again.",
        retryAfter: resetSeconds,
      });
    }
    return next();
  };
}

export const aiChatRateLimit = createAiRateLimiter();

export function clearAiRateLimitBuckets() {
  buckets.clear();
}
