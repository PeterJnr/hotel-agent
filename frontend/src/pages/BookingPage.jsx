import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CreditCard, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import { formatNaira, roomPresentation } from "../features/rooms/roomCatalog.js";
import { api } from "../lib/api.js";

function nightsBetween(checkIn, checkOut) { return Math.max(1, Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86_400_000)); }

export function BookingPage() {
  const [params] = useSearchParams();
  const [reservation, setReservation] = useState(null);
  const details = Object.fromEntries(["roomId", "roomNumber", "roomType", "roomTypeLabel", "price", "checkIn", "checkOut", "guests"].map((key) => [key, params.get(key)]));
  const presentation = roomPresentation[details.roomType] || roomPresentation.STANDARD;
  const nights = nightsBetween(details.checkIn, details.checkOut);
  const total = Number(details.price) * nights;
  const createBooking = useMutation({ mutationFn: () => api.post("/api/reservations/create", { roomId: details.roomId, checkIn: details.checkIn, checkOut: details.checkOut, guests: Number(details.guests) }), onSuccess: ({ data }) => setReservation(data) });
  const initializePayment = useMutation({ mutationFn: () => api.post(`/api/payments/reservations/${reservation.id}/initialize`), onSuccess: ({ data }) => { if (data.authorizationUrl) window.location.assign(data.authorizationUrl); } });
  const error = createBooking.error || initializePayment.error;

  return <section className="checkout-page section"><Link className="back-link" to={`/availability?checkIn=${details.checkIn}&checkOut=${details.checkOut}&guests=${details.guests}`}><ArrowLeft /> Back to availability</Link><div className="checkout-layout"><div className="checkout-main"><span className="eyebrow">Complete your reservation</span><h1>{reservation ? "Your room is held." : "One final look."}</h1>{reservation ? <div className="booking-success"><Check /><h2>Reservation created</h2><p>Room {details.roomNumber} is being held pending payment. Continue securely with Paystack to confirm your stay.</p><button className="button dark" onClick={() => initializePayment.mutate()} disabled={initializePayment.isPending}>{initializePayment.isPending ? "Preparing payment…" : "Continue to secure payment"}<ArrowRight /></button></div> : <><div className="stay-details"><div><CalendarDays /><span><small>Check in</small><strong>{details.checkIn}</strong></span></div><div><CalendarDays /><span><small>Check out</small><strong>{details.checkOut}</strong></span></div><div><Users /><span><small>Guests</small><strong>{details.guests}</strong></span></div></div><div className="assurance"><ShieldCheck /><div><h2>Confirm before payment</h2><p>We create a temporary reservation first. Your booking becomes confirmed only after secure payment verification.</p></div></div><button className="button dark" onClick={() => createBooking.mutate()} disabled={createBooking.isPending}>{createBooking.isPending ? "Holding your room…" : "Reserve room"}<ArrowRight /></button></>}{error && <div className="form-error checkout-error">{error.message}</div>}</div><aside className="stay-summary"><img src={presentation.image} alt={details.roomTypeLabel} /><div><span className="eyebrow">Your selection</span><h2>{details.roomTypeLabel}</h2><p>Room {details.roomNumber}</p><dl><div><dt>{nights} {nights === 1 ? "night" : "nights"}</dt><dd>{formatNaira(total)}</dd></div><div><dt>Taxes</dt><dd>Included</dd></div><div className="summary-total"><dt>Total</dt><dd>{formatNaira(total)}</dd></div></dl><span className="secure-note"><CreditCard /> Secure payment by Paystack</span></div></aside></div></section>;
}
