import { ArrowLeft, Construction } from "lucide-react";
import { Link, useLocation } from "react-router";

export function AdminModulePlaceholder() {
  const moduleName = useLocation().pathname.split("/")[2]?.replaceAll("-", " ") || "module";
  return <main className="admin-screen"><div className="admin-module-placeholder"><Construction /><span className="eyebrow">Next CMS slice</span><h1>{moduleName}</h1><p>The operations dashboard is live. This workspace is deliberately held for the next approved module.</p><Link className="text-link" to="/admin"><ArrowLeft /> Return to operations</Link></div></main>;
}
