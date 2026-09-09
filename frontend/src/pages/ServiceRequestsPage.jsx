import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BellRing, Plus, Wrench } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { formatStayDate, useMyReservations, useMyServiceRequests } from "../features/customer/customerQueries.js";
import { api } from "../lib/api.js";

const categories = ["HOUSEKEEPING", "MAINTENANCE", "ROOM_SERVICE", "COMPLAINT", "OTHER"];

export function ServiceRequestsPage() {
  const queryClient = useQueryClient();
  const { data: requests = [], isPending, error } = useMyServiceRequests();
  const { data: reservations = [] } = useMyReservations();
  const checkedIn = reservations.filter((stay) => stay.status === "CHECKED_IN");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ reservationId: "", category: "HOUSEKEEPING", title: "", description: "" });
  const create = useMutation({
    mutationFn: () => api.post("/api/service-requests", { ...form, reservationId: form.reservationId || checkedIn[0]?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-service-requests"] });
      setForm({ reservationId: "", category: "HOUSEKEEPING", title: "", description: "" });
      setShowForm(false);
    },
  });
  const set = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  return <div className="portal-screen"><div className="portal-welcome request-heading"><div><span className="eyebrow">At your service</span><h1>Guest requests</h1><p>Ask our team for anything that makes your stay more comfortable.</p></div>{checkedIn.length > 0 && <button className="button dark" onClick={() => setShowForm((value) => !value)}><Plus /> New request</button>}</div>
    {showForm && <form className="request-form" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}><div><span className="eyebrow">A note to the team</span><h2>How may we assist?</h2></div>{checkedIn.length > 1 && <label><span>Stay</span><select name="reservationId" value={form.reservationId} onChange={set} required><option value="">Choose your room</option>{checkedIn.map((stay) => <option key={stay.id} value={stay.id}>Room {stay.room.roomNumber}</option>)}</select></label>}<label><span>Service</span><select name="category" value={form.category} onChange={set}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label><span>Request title</span><input name="title" value={form.title} onChange={set} maxLength="120" placeholder="Fresh towels, please" required /></label><label className="wide"><span>Details</span><textarea name="description" value={form.description} onChange={set} maxLength="2000" placeholder="Tell us exactly what you need and when…" required /></label><button className="button dark" disabled={create.isPending}>{create.isPending ? "Sending…" : "Send request"}</button>{create.error && <div className="form-error wide">{create.error.message}</div>}</form>}
    {isPending && <div className="portal-loading">Calling the guest team…</div>}{error && <div className="form-error">{error.message}</div>}<div className="request-list">{requests.map((item) => <Link to={`/portal/requests/${item.id}`} className="request-card" key={item.id}><div className="request-icon"><Wrench /></div><div><span className={`status-pill ${item.status.toLowerCase()}`}>{item.status.replaceAll("_", " ")}</span><h2>{item.title}</h2><p>{item.category.replaceAll("_", " ")} · Room {item.room.roomNumber} · {formatStayDate(item.createdAt)}</p></div><ArrowRight /></Link>)}</div>
    {!isPending && !requests.length && <div className="portal-empty"><BellRing /><h2>{checkedIn.length ? "Your requests will appear here." : "Guest service begins at check-in."}</h2><p>{checkedIn.length ? "Our team is ready whenever you are." : "Once you are checked in, you can request housekeeping, room service, or assistance here."}</p></div>}
  </div>;
}
