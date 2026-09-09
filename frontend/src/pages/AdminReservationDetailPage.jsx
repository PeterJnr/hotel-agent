import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, CreditCard, Mail, MapPin, Phone, UserRound, Users } from "lucide-react";
import { Link, useParams } from "react-router";
import { useAdminReservation } from "../features/admin/adminQueries.js";
import { useAuth } from "../features/auth/authContext.js";
import { formatStayDate } from "../features/customer/customerQueries.js";
import { formatNaira } from "../features/rooms/roomCatalog.js";
import { api } from "../lib/api.js";

const operationalRoles = ["SUPER_ADMIN", "ADMIN", "FRONT_DESK", "RESERVATION_MANAGER"];

export function AdminReservationDetailPage() {
  const { reservationId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: stay, isPending, error } = useAdminReservation(reservationId);
  const updateStatus = useMutation({ mutationFn: (status) => api.patch(`/api/reservations/${reservationId}/status`, { status }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-reservation", reservationId] }); queryClient.invalidateQueries({ queryKey: ["admin-reservations"] }); queryClient.invalidateQueries({ queryKey: ["management-dashboard"] }); } });
  if (isPending) return <div className="admin-screen admin-loading">Opening reservation…</div>;
  if (error || !stay) return <div className="admin-screen"><div className="form-error">{error?.message || "Reservation not found."}</div></div>;
  const canOperate = user.roles.some((role) => operationalRoles.includes(role));
  const nextAction = stay.status === "CONFIRMED" ? { label: "Check guest in", status: "CHECKED_IN" } : stay.status === "CHECKED_IN" ? { label: "Check guest out", status: "CHECKED_OUT" } : null;
  return <main className="admin-screen"><Link className="back-link" to="/admin/reservations"><ArrowLeft /> All reservations</Link><div className="admin-reservation-head"><div><span className={`status-pill ${stay.status.toLowerCase()}`}>{stay.status.replaceAll("_", " ")}</span><h1>{stay.user.firstName} {stay.user.lastName}</h1><p>Reservation {stay.id}</p></div><div><small>Total stay</small><strong>{formatNaira(stay.totalAmount)}</strong></div></div><div className="admin-reservation-grid"><section className="admin-detail-card"><span className="eyebrow">Stay details</span><div className="admin-detail-facts"><span><CalendarDays /><small>Arrival</small><strong>{formatStayDate(stay.checkIn, { weekday: "short" })}</strong></span><span><CalendarDays /><small>Departure</small><strong>{formatStayDate(stay.checkOut, { weekday: "short" })}</strong></span><span><MapPin /><small>Room</small><strong>{stay.room.roomNumber} · {stay.room.roomType.name}</strong></span><span><Users /><small>Guests</small><strong>{stay.guests}</strong></span></div>{canOperate && nextAction && <div className="admin-status-action"><div><strong>{nextAction.label}</strong><small>The server will verify dates, reservation state, and room state before proceeding.</small></div><button className="button dark" onClick={() => updateStatus.mutate(nextAction.status)} disabled={updateStatus.isPending}>{updateStatus.isPending ? "Updating…" : nextAction.label}</button></div>}{updateStatus.error && <div className="form-error">{updateStatus.error.message}</div>}</section><aside><section className="admin-detail-card guest-card"><span className="eyebrow">Guest profile</span><p><UserRound />{stay.user.firstName} {stay.user.lastName}</p><a href={`mailto:${stay.user.email}`}><Mail />{stay.user.email}</a><a href={`tel:${stay.user.phone || ""}`} className={!stay.user.phone ? "disabled" : ""}><Phone />{stay.user.phone || "No phone supplied"}</a></section><section className="admin-detail-card payment-card"><span className="eyebrow">Payment history</span>{stay.payments.map((payment) => <article key={payment.id}><div><CreditCard /><span><strong>{formatNaira(payment.amount)}</strong><small>{payment.reference}</small></span></div><span className={`status-pill ${payment.status.toLowerCase()}`}>{payment.status.replaceAll("_", " ")}</span>{payment.refund && <p>Refund: {payment.refund.status.replaceAll("_", " ")} · {formatNaira(payment.refund.amount)}</p>}</article>)}{!stay.payments.length && <p className="muted-copy">No payment attempts recorded.</p>}</section></aside></div></main>;
}
