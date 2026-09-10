import { Camera, MapPin } from "lucide-react";
import { Link } from "react-router";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div><div className="brand footer-brand"><span className="brand-mark">AS</span><span><strong>Apex Solacii</strong><small>Lagos · Nigeria</small></span></div><p>A considered stay, elevated by warm service and thoughtful intelligence.</p></div>
      <div><span className="eyebrow">Discover</span><a href="/#rooms">Suites</a><a href="/#experience">Experience</a><Link to="/login">Guest portal</Link></div>
      <div><span className="eyebrow">Visit</span><a href="mailto:stay@apexsolacii.com">stay@apexsolacii.com</a><span><MapPin size={14} /> Victoria Island, Lagos</span><span><Camera size={14} /> @apexsolacii</span></div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Apex Solacii</span><span>Privacy · Terms</span></div>
    </footer>
  );
}
