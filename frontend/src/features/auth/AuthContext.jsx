import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "../../lib/api.js";
import { sessionStore } from "../../lib/session.js";
import { AuthContext } from "./authContext.js";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => sessionStore.read());

  const saveSession = useCallback((next) => {
    sessionStore.write(next);
    setSession(next);
    return next;
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await api.post("/api/auth/login", credentials, { skipRefresh: true });
    return saveSession(response.data);
  }, [saveSession]);

  const register = useCallback(async (details) => {
    const response = await api.post("/api/auth/register", details, { skipRefresh: true });
    return saveSession(response.data);
  }, [saveSession]);

  const googleLogin = useCallback(async (credential) => {
    const response = await api.post("/api/auth/google", { credential }, { skipRefresh: true });
    return saveSession(response.data);
  }, [saveSession]);

  const logout = useCallback(async () => {
    const current = sessionStore.read();
    try {
      if (current?.refreshToken) await api.post("/api/auth/logout", { refreshToken: current.refreshToken }, { skipRefresh: true });
    } finally {
      sessionStore.clear();
      setSession(null);
    }
  }, []);

  useEffect(() => {
    const expire = () => setSession(null);
    window.addEventListener("hotel-ai:session-expired", expire);
    return () => window.removeEventListener("hotel-ai:session-expired", expire);
  }, []);

  const value = useMemo(() => ({ session, user: session?.user || null, login, register, googleLogin, logout }), [session, login, register, googleLogin, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
