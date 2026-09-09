import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, Save, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useAdminStaffMember, useStaffRoles } from "../features/admin/adminQueries.js";
import { useAuth } from "../features/auth/authContext.js";
import { formatStayDate } from "../features/customer/customerQueries.js";
import { api } from "../lib/api.js";

export function AdminStaffDetailPage() {
  const { userId } = useParams(); const { user } = useAuth(); const queryClient = useQueryClient();
  const { data: person, isPending, error } = useAdminStaffMember(userId); const { data: roles = [] } = useStaffRoles(); const [selectedRoles, setSelectedRoles] = useState(null);
  const effectiveRoles = selectedRoles ?? person?.roles.map((role) => role.name) ?? [];
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["admin-staff-member", userId] }); queryClient.invalidateQueries({ queryKey: ["admin-staff"] }); };
  const saveRoles = useMutation({ mutationFn: () => api.put(`/api/management/staff/${userId}/roles`, { roles: effectiveRoles }), onSuccess: refresh });
  const status = useMutation({ mutationFn: (value) => api.patch(`/api/management/staff/${userId}/status`, { status: value }), onSuccess: refresh });
  if (isPending) return <div className="admin-screen admin-loading">Opening staff profile…</div>;
  if (error || !person) return <div className="admin-screen"><div className="form-error">{error?.message || "Staff account not found."}</div></div>;
  const isSelf = person.id === user.id; const actionError = saveRoles.error || status.error;
  const toggle = (name) => setSelectedRoles((current) => { const values = current ?? person.roles.map((role) => role.name); return values.includes(name) ? values.filter((role) => role !== name) : [...values, name]; });
  return <main className="admin-screen"><Link className="back-link" to="/admin/staff"><ArrowLeft /> Staff directory</Link><div className="staff-detail-head"><div className="staff-avatar large">{person.firstName[0]}{person.lastName[0]}</div><div><span className={`staff-status ${person.status.toLowerCase()}`}>{person.status}</span><h1>{person.firstName} {person.lastName}</h1><p>{isSelf ? "Your Super Admin account" : `Staff member since ${formatStayDate(person.createdAt)}`}</p></div></div><div className="staff-detail-grid"><section className="admin-detail-card"><span className="eyebrow">Identity</span><p><UserRound />{person.firstName} {person.lastName}</p><a href={`mailto:${person.email}`}><Mail />{person.email}</a><span><Phone />{person.phone || "No phone supplied"}</span></section><section className="admin-detail-card role-editor"><span className="eyebrow">Permissions</span><h2>Assigned roles</h2>{roles.map((role) => <label key={role.name}><input type="checkbox" checked={effectiveRoles.includes(role.name)} onChange={() => toggle(role.name)} /><span><strong>{role.name.replaceAll("_", " ")}</strong><small>{role.description || "Hotel administration permission"}</small></span></label>)}<button className="button dark" onClick={() => saveRoles.mutate()} disabled={saveRoles.isPending || !effectiveRoles.length}><Save />{saveRoles.isPending ? "Saving…" : "Save roles"}</button></section><aside className="admin-detail-card account-state"><ShieldCheck /><span className="eyebrow">Account state</span><h2>{person.status.toLowerCase()}</h2><p>Suspending or deactivating an account revokes its existing refresh sessions.</p><div>{["ACTIVE", "INACTIVE", "SUSPENDED"].filter((value) => value !== person.status).map((value) => <button key={value} className={value === "ACTIVE" ? "restore" : ""} disabled={isSelf || status.isPending} onClick={() => window.confirm(`Change ${person.firstName}'s account status to ${value}?`) && status.mutate(value)}>Set {value.toLowerCase()}</button>)}</div>{isSelf && <small>Your own account cannot be deactivated, suspended, or stripped of Super Admin access.</small>}</aside></div>{actionError && <div className="form-error floating-error">{actionError.message}</div>}</main>;
}
