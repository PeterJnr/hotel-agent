import { ArrowRight, CalendarDays, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

function dateAfter(days) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

export function AvailabilityBar() {
  const [checkIn, setCheckIn] = useState(dateAfter(1));
  const [checkOut, setCheckOut] = useState(dateAfter(2));
  const [guests, setGuests] = useState("2");
  const navigate = useNavigate();

  return (
    <form className="availability-bar" onSubmit={(event) => { event.preventDefault(); navigate(`/availability?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`); }}>
      <label><CalendarDays /><span><small>Check in</small><input type="date" value={checkIn} min={dateAfter(0)} onChange={(event) => setCheckIn(event.target.value)} /></span></label>
      <span className="bar-rule" />
      <label><CalendarDays /><span><small>Check out</small><input type="date" value={checkOut} min={checkIn} onChange={(event) => setCheckOut(event.target.value)} /></span></label>
      <span className="bar-rule" />
      <label><Users /><span><small>Guests</small><select value={guests} onChange={(event) => setGuests(event.target.value)}><option value="1">1 guest</option><option value="2">2 guests</option><option value="3">3 guests</option></select></span></label>
      <button type="submit">Check availability <ArrowRight /></button>
    </form>
  );
}
