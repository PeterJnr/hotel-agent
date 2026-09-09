import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarDays, CreditCard, MapPin, Users } from "lucide-react";
import { Link, useParams } from "react-router";
import { formatStayDate, useReservation } from "../features/customer/customerQueries.js";
import { formatNaira } from "../features/rooms/roomCatalog.js";
import { api } from "../lib/api.js";

export function ReservationDetailPage() {
  const { reservationId } = useParams();
  const queryClient = useQueryClient();
  const { data: stay, isPending, error } = useReservation(reservationId);
  const cancel = useMutation({ mutationFn: () => api.post("/api/reservations/cancel", { reservationId }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["reservation", reservationId] }); queryClient.invalidateQueries({ queryKey: ["my-reservations"] }); } });
  const payment = useMutation({ mutationFn: () => api.post(`/api/payments/reservations/${reservationId}/initialize`), onSuccess: ({ data }) => data.authorizationUrl && window.location.assign(data.authorizationUrl) });
  if (isPending) return <div className="portal-screen portal-loading">Preparing reservation…</div>;
  if (error || !stay) return <div className="portal-screen"><div className="form-error">{error?.message || "Reservation not found."}</div></div>;
  const actionError = cancel.error || payment.error;
  return <div className="portal-screen"><Link className="back-link" to="/portal/reservations"><ArrowLeft /> All reservations</Link><div className="reservation-detail-head"><div><span className={`status-pill ${stay.status.toLowerCase()}`}>{stay.status.replaceAll("_", " ")}</span><h1>{stay.room.roomType.name.toLowerCase()} room</h1><p>Reservation {stay.id}</p></div><strong>{formatNaira(stay.totalAmount)}</strong></div><div className="reservation-detail-grid"><section><h2>Your stay</h2><div className="detail-facts"><span><CalendarDays /><small>Arrival</small><strong>{formatStayDate(stay.checkIn, { weekday: "short" })}</strong></span><span><CalendarDays /><small>Departure</small><strong>{formatStayDate(stay.checkOut, { weekday: "short" })}</strong></span><span><Users /><small>Guests</small><strong>{stay.guests}</strong></span><span><MapPin /><small>Room</small><strong>{stay.room.roomNumber}</strong></span></div></section><aside><span className="eyebrow">Reservation actions</span>{["PENDING", "PAYMENT_PENDING", "PAYMENT_FAILED"].includes(stay.status) && <button className="button dark full" onClick={() => payment.mutate()} disabled={payment.isPending}><CreditCard />{payment.isPending ? "Preparing…" : "Continue payment"}</button>}{stay.status === "PENDING" && <button className="quiet-danger" onClick={() => cancel.mutate()} disabled={cancel.isPending}>Cancel reservation</button>}{stay.status === "CHECKED_IN" && <Link className="button dark full" to="/portal/requests">Request guest service <ArrowRight /></Link>}<small>Need help? Ask Aurelia from your concierge.</small></aside></div>{actionError && <div className="form-error">{actionError.message}</div>}</div>;
}
