import { matchPath, Outlet, useLocation } from "react-router";

import { SiteFooter } from "./SiteFooter.jsx";
import { SiteHeader } from "./SiteHeader.jsx";

export function AppShell() {
  const { pathname } = useLocation();
  const overlayHeaderRoutes = ["/", "/rooms", "/rooms/:roomTypeId", "/availability"];
  const usesOverlayHeader = overlayHeaderRoutes.some((path) => matchPath({ path, end: true }, pathname));
  const headerVariant = usesOverlayHeader ? "overlay" : "solid";

  return <div className={`app-shell has-${headerVariant}-header`}><SiteHeader variant={headerVariant} /><main><Outlet /></main><SiteFooter /></div>;
}
