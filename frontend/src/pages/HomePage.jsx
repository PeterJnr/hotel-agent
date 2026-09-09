import { ArrowRight, Bot, Coffee, ConciergeBell, MapPin, Star } from "lucide-react";
import { Link } from "react-router";

import { AvailabilityBar } from "../components/ui/AvailabilityBar.jsx";
import { formatNaira, presentRoomType, roomPresentation } from "../features/rooms/roomCatalog.js";
import { useRoomTypes } from "../features/rooms/roomQueries.js";

export function HomePage() {
  const { data = [] } = useRoomTypes();
  const fallbackRooms = [
    { id: "standard", name: "STANDARD", description: "Quiet luxury, generous light, and everything you need to reset.", capacity: 3, pricePerNight: "2500" },
    { id: "executive", name: "EXECUTIVE", description: "A refined city retreat designed for unhurried mornings and focused evenings.", capacity: 2, pricePerNight: "5000" },
    { id: "suite", name: "SUITE", description: "Our most expansive stay, with considered details in every corner.", capacity: 2, pricePerNight: "10000" },
  ];
  const rooms = (data.length ? data : fallbackRooms).slice(0, 3).map((room) => presentRoomType(room));

  return (
    <>
      <section className="hero">
        <div className="hero-shade" />
        <div className="hero-content reveal"><span className="eyebrow light"><MapPin size={14} /> Victoria Island, Lagos</span><h1>Stay somewhere<br /><em>worth remembering.</em></h1><p>Intimate rooms, intuitive service, and a personal AI concierge—designed around the way you want to stay.</p><Link className="text-link light-link" to="/register">Begin your stay <ArrowRight /></Link></div>
        <div className="hero-aside"><span>4.9</span><div><Star size={14} fill="currentColor" /><Star size={14} fill="currentColor" /><Star size={14} fill="currentColor" /><Star size={14} fill="currentColor" /><Star size={14} fill="currentColor" /><small>Guest rating</small></div></div>
        <AvailabilityBar />
      </section>

      <section className="intro section" id="story"><span className="eyebrow">A different pace</span><div><h2>Where considered design meets genuine warmth.</h2><p>Maison Aurelia is a quiet counterpoint to the energy of Lagos. Every detail has been chosen to make your stay feel effortless—from the first welcome to your final morning.</p></div></section>

      <section className="rooms-section section" id="rooms"><div className="section-heading"><div><span className="eyebrow">Rooms & suites</span><h2>Your private retreat.</h2></div><Link className="text-link" to="/rooms">Explore every room <ArrowRight /></Link></div><div className="room-grid">{rooms.map((room) => <Link className="room-card" to={`/rooms/${room.id}`} key={room.id}><div className="room-image"><img src={room.image || roomPresentation[room.name].image} alt={`${room.name.toLowerCase()} room`} /><span>Up to {room.capacity || 2} guests</span></div><div className="room-copy"><div><h3>{room.label}</h3><p>{room.description}</p></div><div className="room-price"><small>From</small><strong>{formatNaira(room.pricePerNight)}</strong><span>/ night</span></div></div></Link>)}</div></section>

      <section className="experience section" id="experience"><div className="experience-image"><div className="ai-note"><Bot /><div><strong>Meet Aurelia</strong><span>Your personal concierge, available anytime.</span></div></div></div><div className="experience-copy"><span className="eyebrow">Thoughtfully intelligent</span><h2>Hospitality that already knows what you need.</h2><p>Ask for a room, arrange your stay, request fresh towels, or check a payment—all through one calm conversation.</p><div className="service-list"><span><ConciergeBell />24-hour personal assistance</span><span><Coffee />Requests handled in moments</span><span><Bot />Secure, confirmation-first actions</span></div><Link className="button dark" to="/register">Meet your concierge <ArrowRight /></Link></div></section>

      <section className="closing"><span className="eyebrow light">Your stay awaits</span><h2>Make yourself at home.</h2><p>Reserve directly for our most considered experience.</p><Link className="button cream" to="/register">Plan your stay <ArrowRight /></Link></section>
    </>
  );
}
