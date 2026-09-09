import { BarChart3, BedDouble, Bot, CalendarDays, ChevronRight, ClipboardList, CreditCard, FileText, LayoutDashboard, LogOut, Menu, Users, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "../../features/auth/authContext.js";

const links = [
  { to: "/admin", label: "Operations", icon: LayoutDashboard, end: true },
  { to: "/admin/reservations", label: "Reservations", icon: CalendarDays, roles: ["SUPER_ADMIN", "ADMIN", "FRONT_DESK", "RESERVATION_MANAGER", "ACCOUNTANT"] },
  { to: "/admin/rooms", label: "Rooms", icon: BedDouble, roles: ["SUPER_ADMIN", "ADMIN", "FRONT_DESK", "RESERVATION_MANAGER", "SERVICE_MANAGER"] },
  { to: "/admin/requests", label: "Guest requests", icon: ClipboardList, roles: ["SUPER_ADMIN", "ADMIN", "FRONT_DESK", "SERVICE_MANAGER"] },
  { to: "/admin/payments", label: "Payments", icon: CreditCard, roles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] },
  { to: "/admin/staff", label: "Staff & roles", icon: Users, roles: ["SUPER_ADMIN"] },
  { to: "/admin/content", label: "Content", icon: FileText, roles: ["SUPER_ADMIN", "ADMIN"] },
  { to: "/admin/ai", label: "AI insights", icon: Bot, roles: ["SUPER_ADMIN", "ADMIN"] },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const visibleLinks = links.filter((link) => !link.roles || user.roles.some((role) => link.roles.includes(role)));
  return <div className="admin-shell"><aside className={open ? "admin-sidebar open" : "admin-sidebar"}><div className="admin-logo"><Link to="/"><span className="brand-mark">MA</span><span><strong>Maison Aurelia</strong><small>Hotel administration</small></span></Link><button onClick={() => setOpen(false)} aria-label="Close menu"><X /></button></div><nav>{visibleLinks.map(({ to, label, icon: Icon, end }) => <NavLink end={end} to={to} key={to} onClick={() => setOpen(false)}><Icon /><span>{label}</span><ChevronRight /></NavLink>)}</nav><div className="admin-profile"><span>{user.firstName[0]}{user.lastName[0]}</span><div><strong>{user.firstName} {user.lastName}</strong><small>{user.roles.map((role) => role.replaceAll("_", " ")).join(" · ")}</small></div><button onClick={logout} title="Sign out"><LogOut /></button></div></aside><div className="admin-workspace"><header className="admin-topbar"><button onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button><div><BarChart3 /><span>Live operations</span><i /></div></header><Outlet /></div></div>;
}
