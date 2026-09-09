import { GoogleGenAI } from "@google/genai";

const DEFAULT_GEMINI_MODEL = "gemini-3.7-flash";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;

function providerError(message, code) {
  return Object.assign(new Error(message), { code, statusCode: 503 });
}

export function getGeminiConfig(environment = process.env) {
  const apiKey = environment.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw providerError(
      "GEMINI_API_KEY is required before the Gemini provider can be used.",
      "GEMINI_NOT_CONFIGURED",
    );
  }

  return {
    apiKey,
    model: environment.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    timeoutMs: parseBoundedInteger(environment.GEMINI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 5_000, 60_000),
    maxRetries: parseBoundedInteger(environment.GEMINI_MAX_RETRIES, DEFAULT_MAX_RETRIES, 0, 3),
  };
}

function parseBoundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function errorStatus(error) {
  return Number(error?.statusCode || error?.status || error?.response?.status);
}

function retryAfterSeconds(error) {
  const header = error?.response?.headers?.get?.("retry-after") || error?.response?.headers?.["retry-after"];
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : undefined;
}

export function normalizeGeminiError(error, { timedOut = false } = {}) {
  if (timedOut || error?.name === "AbortError") {
    return Object.assign(new Error("The AI provider took too long to respond."), {
      code: "AI_PROVIDER_TIMEOUT",
      statusCode: 504,
    });
  }

  const status = errorStatus(error);
  if (status === 429) {
    return Object.assign(new Error("The AI provider usage limit has been reached."), {
      code: "AI_PROVIDER_RATE_LIMITED",
      statusCode: 429,
      retryAfter: retryAfterSeconds(error),
    });
  }
  if (status === 503 || status >= 500) {
    return Object.assign(new Error("The AI provider is temporarily unavailable."), {
      code: "AI_PROVIDER_UNAVAILABLE",
      statusCode: 503,
    });
  }
  return error;
}

export function extractGeminiUsage(response) {
  const usage = response?.usageMetadata;
  if (!usage) return {};
  return {
    inputTokens: Number.isInteger(usage.promptTokenCount) ? usage.promptTokenCount : null,
    outputTokens: Number.isInteger(usage.candidatesTokenCount) ? usage.candidatesTokenCount : null,
    totalTokens: Number.isInteger(usage.totalTokenCount) ? usage.totalTokenCount : null,
  };
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function generateGeminiContent(params, options = {}) {
  const provider = options.provider || createGeminiClient(options.environment);
  const timeoutMs = options.timeoutMs ?? provider.timeoutMs;
  const maxRetries = options.maxRetries ?? provider.maxRetries;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      return await provider.client.models.generateContent({
        ...params,
        model: params.model || provider.model,
        config: { ...params.config, abortSignal: controller.signal },
      });
    } catch (error) {
      const normalized = normalizeGeminiError(error, { timedOut });
      if (normalized.code !== "AI_PROVIDER_UNAVAILABLE" || attempt === maxRetries) throw normalized;
      await wait(300 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createGeminiClient(environment = process.env) {
  const config = getGeminiConfig(environment);
  return {
    client: new GoogleGenAI({ apiKey: config.apiKey }),
    model: config.model,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
  };
}
