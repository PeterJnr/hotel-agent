import { ArrowRight, CalendarDays } from "lucide-react";
import { Link } from "react-router";
import { formatNaira } from "../features/rooms/roomCatalog.js";
import { formatStayDate, useMyReservations } from "../features/customer/customerQueries.js";

export function ReservationsPage() {
  const { data = [], isPending, error } = useMyReservations();
  return <div className="portal-screen"><div className="portal-heading"><span className="eyebrow">Your journeys</span><h1>Reservations</h1><p>Upcoming stays and moments already enjoyed.</p></div>{isPending && <div className="portal-loading">Loading your stays…</div>}{error && <div className="form-error">{error.message}</div>}<div className="reservation-list">{data.map((stay) => <Link to={`/portal/reservations/${stay.id}`} className="reservation-row" key={stay.id}><div className="reservation-date"><strong>{new Date(stay.checkIn).getDate()}</strong><span>{new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(stay.checkIn))}</span></div><div><span className={`status-pill ${stay.status.toLowerCase()}`}>{stay.status.replaceAll("_", " ")}</span><h2>{stay.room.roomType.name.toLowerCase()} room · {stay.room.roomNumber}</h2><p><CalendarDays />{formatStayDate(stay.checkIn)} — {formatStayDate(stay.checkOut)}</p></div><div className="reservation-total"><strong>{formatNaira(stay.totalAmount)}</strong><small>{stay.guests} {stay.guests === 1 ? "guest" : "guests"}</small></div><ArrowRight /></Link>)}</div>{!isPending && !data.length && <div className="portal-empty"><CalendarDays /><h2>No reservations yet.</h2><Link className="button dark" to="/rooms">Find your room</Link></div>}</div>;
}
