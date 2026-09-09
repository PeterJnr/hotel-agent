import { ArrowLeft, ArrowRight, Check, Users } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { useMemo, useState } from "react";

import { formatNaira, presentRoomType } from "../features/rooms/roomCatalog.js";
import { useRoomType, useRoomTypeImages } from "../features/rooms/roomQueries.js";

function futureDate(days) { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); }

export function RoomDetailPage() {
  const { roomTypeId } = useParams();
  const navigate = useNavigate();
  const { data: rawRoom, isPending, error } = useRoomType(roomTypeId);
  const { data: images = [] } = useRoomTypeImages(roomTypeId);
  const room = useMemo(() => rawRoom ? presentRoomType(rawRoom, images) : null, [rawRoom, images]);
  const [checkIn, setCheckIn] = useState(futureDate(1));
  const [checkOut, setCheckOut] = useState(futureDate(2));
  const [guests, setGuests] = useState("2");
  if (isPending) return <section className="detail-state">Preparing your room…</section>;
  if (error || !room) return <section className="detail-state"><h1>Room unavailable</h1><p>{error?.message}</p><Link to="/rooms">Return to rooms</Link></section>;

  const search = (event) => { event.preventDefault(); navigate(`/availability?roomType=${room.name}&roomTypeId=${room.id}&checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`); };
  return <><section className="detail-gallery"><div className="detail-main-image"><img src={room.gallery[0]} alt={room.label} /><Link to="/rooms"><ArrowLeft /> All rooms</Link></div><div>{room.gallery.slice(1, 3).map((image, index) => <img src={image} alt={`${room.label} detail ${index + 1}`} key={image} />)}</div></section><section className="detail-content section"><div className="detail-description"><span className="eyebrow">{room.eyebrow}</span><h1>{room.label}</h1><div className="room-facts"><span><Users /> Up to {room.capacity} guests</span><span>From {formatNaira(room.pricePerNight)} per night</span></div><p>{room.description}</p><h2>Everything considered.</h2><div className="amenity-grid">{room.amenities.map((amenity) => <span key={amenity}><Check />{amenity}</span>)}</div></div><aside className="booking-card"><span className="eyebrow">Reserve this room</span><div className="booking-price"><strong>{formatNaira(room.pricePerNight)}</strong><small>per night</small></div><form onSubmit={search}><label>Check in<input type="date" required min={futureDate(0)} value={checkIn} onChange={(event) => setCheckIn(event.target.value)} /></label><label>Check out<input type="date" required min={checkIn} value={checkOut} onChange={(event) => setCheckOut(event.target.value)} /></label><label>Guests<select value={guests} onChange={(event) => setGuests(event.target.value)}>{Array.from({ length: room.capacity }, (_, index) => <option value={index + 1} key={index + 1}>{index + 1} {index ? "guests" : "guest"}</option>)}</select></label><button className="button dark full">Check availability <ArrowRight /></button></form><small>No payment is taken at this stage.</small></aside></section></>;
}
