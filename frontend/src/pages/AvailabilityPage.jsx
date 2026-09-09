import { useQueries } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BedDouble, CalendarDays, Users } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { formatNaira, presentRoomType } from "../features/rooms/roomCatalog.js";
import { useRoomTypes } from "../features/rooms/roomQueries.js";
import { api } from "../lib/api.js";

export function AvailabilityPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const checkIn = params.get("checkIn") || "";
  const checkOut = params.get("checkOut") || "";
  const guests = Number(params.get("guests") || 2);
  const requestedType = params.get("roomType");
  const { data: roomTypes = [], isPending: typesPending } = useRoomTypes();
  const candidates = requestedType ? roomTypes.filter(({ name }) => name === requestedType) : roomTypes;
  const availability = useQueries({ queries: candidates.map((type) => ({
    queryKey: ["availability", type.name, checkIn, checkOut, guests],
    queryFn: () => api.get(`/api/rooms/availability?roomType=${type.name}&checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}&guests=${guests}`),
    enabled: Boolean(checkIn && checkOut),
  })) });
  const pending = typesPending || availability.some(({ isPending }) => isPending);
  const results = candidates.map((type, index) => ({ type: presentRoomType(type), rooms: availability[index]?.data?.data?.rooms || [], error: availability[index]?.error })).filter(({ rooms }) => rooms.length);
  const reserve = (room, type) => {
    const booking = new URLSearchParams({ roomId: room.id, roomNumber: room.roomNumber, roomType: type.name, roomTypeLabel: type.label, price: type.pricePerNight, checkIn, checkOut, guests: String(guests) });
    navigate(`/book?${booking}`);
  };

  return <><section className="search-header"><Link to="/rooms"><ArrowLeft /> Rooms</Link><span className="eyebrow light">Available stays</span><h1>Your dates,<br /><em>beautifully considered.</em></h1><div className="search-summary"><span><CalendarDays />{checkIn} — {checkOut}</span><span><Users />{guests} {guests === 1 ? "guest" : "guests"}</span></div></section><section className="results-section section">{pending && <div className="state-card">Checking every room for you…</div>}{!pending && !results.length && <div className="empty-state"><BedDouble /><span className="eyebrow">No exact match</span><h2>Those dates are spoken for.</h2><p>Try another date or explore a different room category.</p><Link className="button dark" to="/rooms">Explore rooms</Link></div>}{results.map(({ type, rooms }) => <article className="availability-result" key={type.id}><img src={type.image} alt={type.label} /><div><span className="eyebrow">{rooms.length} {rooms.length === 1 ? "room" : "rooms"} available</span><h2>{type.label}</h2><p>{type.description}</p><div className="available-numbers">{rooms.map((room) => <button key={room.id} onClick={() => reserve(room, type)}>Room {room.roomNumber}<ArrowRight /></button>)}</div></div><div className="result-price"><small>Per night</small><strong>{formatNaira(type.pricePerNight)}</strong><span>Taxes included</span></div></article>)}</section></>;
}
