import { sessionStore } from "./session.js";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:6000").replace(/\/$/, "");
let refreshPromise;

async function parseResponse(response) {
  const body = await response.json().catch(() => ({ success: false, message: "The server returned an invalid response." }));
  if (!response.ok) {
    const error = new Error(body.message || "The request could not be completed.");
    error.status = response.status;
    error.code = body.code;
    error.body = body;
    throw error;
  }
  return body;
}

async function refreshSession() {
  const session = sessionStore.read();
  if (!session?.refreshToken) throw new Error("Your session has expired.");

  const response = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });
  const body = await parseResponse(response);
  const refreshed = { ...session, ...body.data };
  sessionStore.write(refreshed);
  return refreshed;
}

export async function apiRequest(path, options = {}) {
  const session = sessionStore.read();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && options.body !== undefined) headers.set("Content-Type", "application/json");
  if (session?.accessToken) headers.set("Authorization", `Bearer ${session.accessToken}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body instanceof FormData || options.body === undefined ? options.body : JSON.stringify(options.body),
  });

  if (response.status === 401 && !options.skipRefresh && session?.refreshToken) {
    try {
      refreshPromise ||= refreshSession().finally(() => { refreshPromise = null; });
      const refreshed = await refreshPromise;
      return apiRequest(path, { ...options, skipRefresh: true, headers: { ...Object.fromEntries(headers), Authorization: `Bearer ${refreshed.accessToken}` } });
    } catch (error) {
      sessionStore.clear();
      window.dispatchEvent(new Event("hotel-ai:session-expired"));
      throw error;
    }
  }

  return parseResponse(response);
}

export const api = {
  get: (path, options) => apiRequest(path, { ...options, method: "GET" }),
  post: (path, body, options) => apiRequest(path, { ...options, method: "POST", body }),
  patch: (path, body, options) => apiRequest(path, { ...options, method: "PATCH", body }),
  put: (path, body, options) => apiRequest(path, { ...options, method: "PUT", body }),
  delete: (path, options) => apiRequest(path, { ...options, method: "DELETE" }),
};
