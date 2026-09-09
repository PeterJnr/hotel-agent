import { ArrowUpRight, Users } from "lucide-react";
import { Link } from "react-router";
import { formatNaira, presentRoomType } from "../../features/rooms/roomCatalog.js";

export function RoomCard({ roomType }) {
  const room = presentRoomType(roomType);
  return <article className="catalog-card"><Link className="catalog-image" to={`/rooms/${room.id}`}><img src={room.image} alt={room.label} /><span><Users /> Up to {room.capacity} guests</span></Link><div className="catalog-copy"><span className="eyebrow">{room.eyebrow}</span><h2>{room.label}</h2><p>{room.description}</p><div><span><small>From</small><strong>{formatNaira(room.pricePerNight)}</strong><small>per night</small></span><Link to={`/rooms/${room.id}`} aria-label={`View ${room.label}`}>Explore <ArrowUpRight /></Link></div></div></article>;
}
