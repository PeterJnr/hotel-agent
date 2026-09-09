import { Outlet } from "react-router";

import { SiteFooter } from "./SiteFooter.jsx";
import { SiteHeader } from "./SiteHeader.jsx";

export function AppShell() {
  return <div className="app-shell"><SiteHeader /><main><Outlet /></main><SiteFooter /></div>;
}
