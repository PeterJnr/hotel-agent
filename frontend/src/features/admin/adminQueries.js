import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api.js";

export function useManagementDashboard() {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return useQuery({
    queryKey: ["management-dashboard", date],
    queryFn: () => api.get(`/api/management/dashboard?date=${date}&upcomingDays=7`),
    select: (response) => response.data,
  });
}

export function useAdminReservations(filters = {}) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  return useQuery({
    queryKey: ["admin-reservations", filters],
    queryFn: () => api.get(`/api/reservations${params.size ? `?${params}` : ""}`),
    select: (response) => response.data,
  });
}

export function useAdminReservation(reservationId) {
  return useQuery({
    queryKey: ["admin-reservation", reservationId],
    queryFn: () => api.get(`/api/reservations/${reservationId}`),
    select: (response) => response.data,
    enabled: Boolean(reservationId),
  });
}

export function useAdminRooms() {
  return useQuery({ queryKey: ["admin-rooms"], queryFn: () => api.get("/api/rooms"), select: (response) => response.data });
}

export function useAdminServiceRequests(filters = {}) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  return useQuery({ queryKey: ["admin-service-requests", filters], queryFn: () => api.get(`/api/service-requests${params.size ? `?${params}` : ""}`), select: (response) => response.data });
}

export function useAdminServiceRequest(requestId) {
  return useQuery({ queryKey: ["admin-service-request", requestId], queryFn: () => api.get(`/api/service-requests/${requestId}`), select: (response) => response.data, enabled: Boolean(requestId) });
}

export function useServiceRequestAssignees() {
  return useQuery({ queryKey: ["service-request-assignees"], queryFn: () => api.get("/api/service-requests/assignees"), select: (response) => response.data });
}

export function useAdminPayments(filters = {}) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== "" && value !== undefined));
  return useQuery({ queryKey: ["admin-payments", filters], queryFn: () => api.get(`/api/management/payments?${params}`), select: (response) => response.data });
}

export function useAdminPayment(paymentId) {
  return useQuery({ queryKey: ["admin-payment", paymentId], queryFn: () => api.get(`/api/management/payments/${paymentId}`), select: (response) => response.data, enabled: Boolean(paymentId) });
}

export function useAdminStaff(filters = {}) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== "" && value !== undefined));
  return useQuery({ queryKey: ["admin-staff", filters], queryFn: () => api.get(`/api/management/staff?${params}`), select: (response) => response.data });
}

export function useAdminStaffMember(userId) {
  return useQuery({ queryKey: ["admin-staff-member", userId], queryFn: () => api.get(`/api/management/staff/${userId}`), select: (response) => response.data, enabled: Boolean(userId) });
}

export function useStaffRoles() {
  return useQuery({ queryKey: ["staff-roles"], queryFn: () => api.get("/api/management/staff/roles"), select: (response) => response.data });
}
