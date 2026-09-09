import { AlertTriangle, ArrowRight, ClipboardList, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useAdminServiceRequests } from "../features/admin/adminQueries.js";
import { formatStayDate } from "../features/customer/customerQueries.js";

const statuses = ["", "OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"];
const priorities = ["", "LOW", "MEDIUM", "HIGH", "URGENT"];
const categories = ["", "HOUSEKEEPING", "MAINTENANCE", "ROOM_SERVICE", "COMPLAINT", "OTHER"];

export function AdminServiceRequestsPage() {
  const [filters, setFilters] = useState({ status: "", priority: "", category: "" });
  const [search, setSearch] = useState("");
  const { data = [], isPending, error } = useAdminServiceRequests(filters);
  const visible = useMemo(() => { const term = search.trim().toLowerCase(); return term ? data.filter((item) => `${item.title} ${item.user.firstName} ${item.user.lastName} ${item.room.roomNumber} ${item.id}`.toLowerCase().includes(term)) : data; }, [data, search]);
  const update = (event) => setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  return <main className="admin-screen"><div className="admin-heading"><div><span className="eyebrow">Guest care desk</span><h1>Service requests</h1><p>Prioritize, assign, and resolve every guest need with a visible service trail.</p></div><strong className="record-count">{visible.filter((item) => !["CLOSED", "CANCELLED"].includes(item.status)).length} active</strong></div><section className="admin-filters request-admin-filters"><label className="admin-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Request, guest, room, or ID" /></label><label><span>Status</span><select name="status" value={filters.status} onChange={update}>{statuses.map((value) => <option value={value} key={value}>{value ? value.replaceAll("_", " ") : "All statuses"}</option>)}</select></label><label><span>Priority</span><select name="priority" value={filters.priority} onChange={update}>{priorities.map((value) => <option value={value} key={value}>{value || "All priorities"}</option>)}</select></label><label><span>Category</span><select name="category" value={filters.category} onChange={update}>{categories.map((value) => <option value={value} key={value}>{value ? value.replaceAll("_", " ") : "All categories"}</option>)}</select></label></section>{isPending && <div className="admin-loading">Opening the service desk…</div>}{error && <div className="form-error">{error.message}</div>}<section className="service-queue">{visible.map((item) => <Link to={`/admin/requests/${item.id}`} className={`service-queue-card ${item.priority.toLowerCase()}`} key={item.id}><div className="queue-priority">{item.priority === "URGENT" ? <AlertTriangle /> : <ClipboardList />}<span>{item.priority}</span></div><div><span className={`status-pill ${item.status.toLowerCase()}`}>{item.status.replaceAll("_", " ")}</span><h2>{item.title}</h2><p>{item.user.firstName} {item.user.lastName} · Room {item.room.roomNumber} · {item.category.replaceAll("_", " ")}</p><small>Opened {formatStayDate(item.createdAt, { hour: "numeric", minute: "2-digit" })}{item.assignedTo ? ` · Assigned to ${item.assignedTo.firstName} ${item.assignedTo.lastName}` : " · Unassigned"}</small></div><ArrowRight /></Link>)}</section>{!isPending && !visible.length && <div className="admin-table-empty"><ClipboardList /><p>No service requests match this view.</p></div>}</main>;
}
