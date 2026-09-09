import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";

export function useRoomTypes() {
  return useQuery({ queryKey: ["room-types"], queryFn: () => api.get("/api/room-types"), select: (response) => response.data });
}

export function useRoomType(roomTypeId) {
  return useQuery({ queryKey: ["room-type", roomTypeId], queryFn: () => api.get(`/api/room-types/${roomTypeId}`), select: (response) => response.data, enabled: Boolean(roomTypeId) });
}

export function useRoomTypeImages(roomTypeId) {
  return useQuery({ queryKey: ["room-type-images", roomTypeId], queryFn: () => api.get(`/api/room-types/${roomTypeId}/images`), select: (response) => response.data, enabled: Boolean(roomTypeId) });
}
