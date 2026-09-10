import { BedDouble, Bot, CalendarDays, ChevronRight, ClipboardList, Home, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "../../features/auth/authContext.js";

const links = [
  { to: "/portal", label: "Overview", icon: Home, end: true },
  { to: "/portal/reservations", label: "Reservations", icon: CalendarDays },
  { to: "/portal/requests", label: "Guest requests", icon: ClipboardList },
  { to: "/portal/concierge", label: "Ask Solacii AI", icon: Bot },
];

export function PortalLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  return <div className="portal-shell"><aside className={open ? "portal-sidebar open" : "portal-sidebar"}><div className="portal-logo"><Link to="/"><span className="brand-mark">AS</span><span><strong>Apex Solacii</strong><small>Guest residence</small></span></Link><button onClick={() => setOpen(false)} aria-label="Close menu"><X /></button></div><nav>{links.map(({ to, label, icon: Icon, end }) => <NavLink end={end} to={to} key={to} onClick={() => setOpen(false)}><Icon /><span>{label}</span><ChevronRight /></NavLink>)}</nav><div className="portal-profile"><span>{user.firstName[0]}{user.lastName[0]}</span><div><strong>{user.firstName} {user.lastName}</strong><small>{user.email}</small></div><button onClick={logout} title="Sign out"><LogOut /></button></div></aside><div className="portal-workspace"><header className="portal-topbar"><button onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button><Link to="/rooms"><BedDouble /> Explore rooms</Link></header><Outlet /></div></div>;
}
