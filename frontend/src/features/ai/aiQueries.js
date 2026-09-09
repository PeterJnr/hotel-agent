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
