import { Menu, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router";

import { useAuth } from "../../features/auth/authContext.js";
import { ThemeToggle } from "../ThemeToggle.jsx";

export function SiteHeader({ variant = "solid" }) {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const close = () => setOpen(false);

  return (
    <header className={`site-header ${variant}`}>
      <Link className="brand" to="/" onClick={close} aria-label="Apex Solacii home">
        <span className="brand-mark">AS</span>
        <span><strong>Apex Solacii</strong><small>Intelligent hospitality</small></span>
      </Link>
      <button className="menu-toggle" type="button" onClick={() => setOpen((value) => !value)} aria-label="Toggle navigation" aria-expanded={open}>
        {open ? <X /> : <Menu />}
      </button>
      <nav className={open ? "site-nav is-open" : "site-nav"} aria-label="Main navigation">
        <NavLink to="/rooms" onClick={close}>Suites</NavLink>
        <a href="/#experience" onClick={close}>Experience</a>
        <a href="/#story" onClick={close}>Our story</a>
        {user ? (
          <>
            <NavLink to="/portal" onClick={close}>My stay</NavLink>
            <button className="nav-quiet" type="button" onClick={() => { close(); logout(); }}>Sign out</button>
          </>
        ) : <NavLink to="/login" onClick={close}>Sign in</NavLink>}
        <ThemeToggle />
        <Link className="nav-cta" to={user ? "/portal" : "/register"} onClick={close}><Sparkles size={15} /> {user ? "Ask Solacii AI" : "Reserve"}</Link>
      </nav>
    </header>
  );
}
