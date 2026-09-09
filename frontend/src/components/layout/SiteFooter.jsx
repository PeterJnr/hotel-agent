import { Camera, MapPin } from "lucide-react";
import { Link } from "react-router";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div><div className="brand footer-brand"><span className="brand-mark">MA</span><span><strong>Maison Aurelia</strong><small>Lagos · Nigeria</small></span></div><p>A considered stay, elevated by warm service and thoughtful intelligence.</p></div>
      <div><span className="eyebrow">Discover</span><a href="/#rooms">Suites</a><a href="/#experience">Experience</a><Link to="/login">Guest portal</Link></div>
      <div><span className="eyebrow">Visit</span><a href="mailto:stay@maisonaurelia.com">stay@maisonaurelia.com</a><span><MapPin size={14} /> Victoria Island, Lagos</span><span><Camera size={14} /> @maisonaurelia</span></div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Maison Aurelia</span><span>Privacy · Terms</span></div>
    </footer>
  );
}
