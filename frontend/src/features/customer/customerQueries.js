import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";

export function useMyReservations() {
  return useQuery({ queryKey: ["my-reservations"], queryFn: () => api.get("/api/reservations/me"), select: (response) => response.data });
}

export function useReservation(reservationId) {
  return useQuery({ queryKey: ["reservation", reservationId], queryFn: () => api.get(`/api/reservations/${reservationId}`), select: (response) => response.data, enabled: Boolean(reservationId) });
}

export function useMyServiceRequests() {
  return useQuery({ queryKey: ["my-service-requests"], queryFn: () => api.get("/api/service-requests/me"), select: (response) => response.data });
}

export function useServiceRequest(requestId) {
  return useQuery({ queryKey: ["service-request", requestId], queryFn: () => api.get(`/api/service-requests/${requestId}`), select: (response) => response.data, enabled: Boolean(requestId) });
}

export function formatStayDate(value, options = {}) {
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", ...options }).format(new Date(value));
}
