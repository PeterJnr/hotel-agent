import { ArrowRight, CalendarDays, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useAdminReservations } from "../features/admin/adminQueries.js";
import { formatStayDate } from "../features/customer/customerQueries.js";
import { formatNaira } from "../features/rooms/roomCatalog.js";

const statuses = ["", "PENDING", "PAYMENT_PENDING", "CONFIRMED", "PAYMENT_FAILED", "CANCELLATION_PENDING", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"];

export function AdminReservationsPage() {
  const [filters, setFilters] = useState({ status: "", checkIn: "", checkOut: "" });
  const [search, setSearch] = useState("");
  const { data = [], isPending, error } = useAdminReservations(filters);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter((stay) => `${stay.user.firstName} ${stay.user.lastName} ${stay.user.email} ${stay.room.roomNumber} ${stay.id}`.toLowerCase().includes(term));
  }, [data, search]);
  const update = (event) => setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  return <main className="admin-screen"><div className="admin-heading"><div><span className="eyebrow">Front office</span><h1>Reservations</h1><p>Find every stay and move guests through valid operational stages.</p></div><strong className="record-count">{visible.length} records</strong></div><section className="admin-filters"><label className="admin-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Guest, email, room, or reservation ID" /></label><label><span>Status</span><select name="status" value={filters.status} onChange={update}>{statuses.map((status) => <option value={status} key={status}>{status ? status.replaceAll("_", " ") : "All statuses"}</option>)}</select></label><label><span>Arriving from</span><input name="checkIn" type="date" value={filters.checkIn} onChange={update} /></label><label><span>Departing by</span><input name="checkOut" type="date" value={filters.checkOut} onChange={update} /></label></section>{isPending && <div className="admin-loading">Loading reservations…</div>}{error && <div className="form-error">{error.message}</div>}<section className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Guest</th><th>Stay</th><th>Room</th><th>Status</th><th>Total</th><th /></tr></thead><tbody>{visible.map((stay) => <tr key={stay.id}><td><strong>{stay.user.firstName} {stay.user.lastName}</strong><small>{stay.user.email}</small></td><td><strong>{formatStayDate(stay.checkIn)} — {formatStayDate(stay.checkOut)}</strong><small>{stay.guests} {stay.guests === 1 ? "guest" : "guests"}</small></td><td><strong>{stay.room.roomNumber}</strong><small>{stay.room.roomType.name.toLowerCase()}</small></td><td><span className={`status-pill ${stay.status.toLowerCase()}`}>{stay.status.replaceAll("_", " ")}</span></td><td><strong>{formatNaira(stay.totalAmount)}</strong></td><td><Link to={`/admin/reservations/${stay.id}`} aria-label="Open reservation"><ArrowRight /></Link></td></tr>)}</tbody></table>{!isPending && !visible.length && <div className="admin-table-empty"><CalendarDays /><p>No reservations match these filters.</p></div>}</section></main>;
}
