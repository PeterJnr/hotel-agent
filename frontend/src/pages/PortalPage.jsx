import { ArrowRight, Bot, CalendarDays, Clock3, Plus } from "lucide-react";
import { Link } from "react-router";
import { useAuth } from "../features/auth/authContext.js";
import { formatStayDate, useMyReservations, useMyServiceRequests } from "../features/customer/customerQueries.js";

const activeStatuses = new Set(["PENDING", "PAYMENT_PENDING", "CONFIRMED", "CHECKED_IN"]);

export function PortalPage() {
  const { user } = useAuth();
  const { data: reservations = [], isPending } = useMyReservations();
  const { data: requests = [] } = useMyServiceRequests();
  const active = reservations.filter(({ status }) => activeStatuses.has(status));
  const nextStay = [...active].sort((a, b) => new Date(a.checkIn) - new Date(b.checkIn))[0];
  const openRequests = requests.filter(({ status }) => !["CLOSED", "CANCELLED"].includes(status));
  return (
    <div className="portal-screen"><div className="portal-welcome"><div><span className="eyebrow">Your residence</span><h1>Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {user.firstName}.</h1><p>Everything about your stay, quietly kept in one place.</p></div><Link className="button dark" to="/rooms"><Plus /> Plan a stay</Link></div><div className="portal-stat-grid"><article><span>Upcoming stays</span><strong>{isPending ? "—" : active.length}</strong><small>Across your account</small></article><article><span>Guest requests</span><strong>{openRequests.length}</strong><small>Currently open</small></article><article className="solacii-stat"><Bot /><span>Solacii AI is ready</span><small>Ask anything about your stay</small><Link to="/portal/concierge">Start a conversation <ArrowRight /></Link></article></div>{nextStay ? <section className="next-stay"><div className="next-stay-image"><img src="https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=85" alt="Your upcoming hotel room" /><span>{nextStay.status.replaceAll("_", " ")}</span></div><div className="next-stay-copy"><span className="eyebrow">Your next stay</span><h2>{nextStay.room.roomType.name.toLowerCase()} room</h2><div><span><CalendarDays />{formatStayDate(nextStay.checkIn)} — {formatStayDate(nextStay.checkOut)}</span><span><Clock3 />Room {nextStay.room.roomNumber}</span></div><Link className="text-link" to={`/portal/reservations/${nextStay.id}`}>View reservation <ArrowRight /></Link></div></section> : !isPending && <section className="portal-empty"><CalendarDays /><h2>Your next story starts here.</h2><p>You have no upcoming reservations. Find a room that feels like yours.</p><Link className="button dark" to="/rooms">Explore rooms</Link></section>}</div>
  );
}
