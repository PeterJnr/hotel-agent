import { Navigate, Outlet, useLocation } from "react-router";

import { useAuth } from "./authContext.js";

export function ProtectedRoute({ allowedRoles }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (allowedRoles?.length && !user.roles.some((role) => allowedRoles.includes(role))) {
    return <Navigate to={user.roles.includes("CUSTOMER") ? "/portal" : "/admin"} replace />;
  }
  return <Outlet />;
}
