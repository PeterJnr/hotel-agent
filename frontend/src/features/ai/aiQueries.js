import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";

export function useAiConversations() {
  return useQuery({
    queryKey: ["ai-conversations"],
    queryFn: () => api.get("/api/ai/conversations?status=ACTIVE&limit=20"),
    select: (response) => response.data,
  });
}

export function useAiConversation(conversationId) {
  return useQuery({
    queryKey: ["ai-conversation", conversationId],
    queryFn: () => api.get(`/api/ai/conversations/${conversationId}`),
    select: (response) => response.data,
    enabled: Boolean(conversationId),
  });
}

export function useAdminAiMetrics(days = 7) {
  return useQuery({
    queryKey: ["admin-ai-metrics", days],
    queryFn: () => api.get(`/api/ai/admin/metrics?days=${days}`),
    select: (response) => response.data,
  });
}

export function useAdminAiRuns({ limit = 50, status = "" } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (status) params.set("status", status);
  return useQuery({
    queryKey: ["admin-ai-runs", limit, status],
    queryFn: () => api.get(`/api/ai/admin/runs?${params}`),
    select: (response) => response.data,
  });
}
