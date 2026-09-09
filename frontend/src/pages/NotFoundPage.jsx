import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
export function NotFoundPage() { return <section className="not-found"><span>404</span><h1>This room doesn’t exist.</h1><p>Let us guide you back to somewhere more comfortable.</p><Link className="button dark" to="/"><ArrowLeft /> Return home</Link></section>; }
