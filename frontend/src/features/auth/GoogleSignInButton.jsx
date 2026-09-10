import { useEffect, useRef, useState } from "react";

const SCRIPT_URL = "https://accounts.google.com/gsi/client";
let scriptPromise;

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ||= new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    const script = existing || Object.assign(document.createElement("script"), { src: SCRIPT_URL, async: true, defer: true });
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", () => reject(new Error("Google sign-in could not be loaded. Check your connection and try again.")), { once: true });
    if (!existing) document.head.append(script);
  });
  return scriptPromise;
}

export function GoogleSignInButton({ mode, disabled, onCredential, onError }) {
  const container = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  const [loading, setLoading] = useState(Boolean(clientId));

  useEffect(() => {
    let active = true;
    if (!clientId) return undefined;
    loadGoogleIdentityServices().then(() => {
      if (!active || !container.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: ({ credential }) => credential ? onCredential(credential) : onError(new Error("Google did not return a sign-in credential.")), ux_mode: "popup" });
      container.current.replaceChildren();
      window.google.accounts.id.renderButton(container.current, { type: "standard", theme: "outline", size: "large", text: mode === "register" ? "signup_with" : "signin_with", shape: "rectangular", logo_alignment: "left", width: Math.min(container.current.clientWidth || 400, 400) });
      setLoading(false);
    }).catch((error) => { if (active) { setLoading(false); onError(error); } });
    return () => { active = false; };
  }, [clientId, mode, onCredential, onError]);

  if (!clientId) return <div className="google-config-note">Google sign-in will appear after the frontend client ID is configured.</div>;
  return <div className={disabled ? "google-signin disabled" : "google-signin"} aria-busy={loading}>{loading && <span>Loading Google sign-in…</span>}<div ref={container} /></div>;
}
