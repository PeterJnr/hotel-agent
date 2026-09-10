import { ArrowLeft, ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import { api } from "../lib/api.js";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError("");
    if (password !== confirmation) return setError("Passwords do not match.");
    setBusy(true);
    try { await api.post("/api/auth/reset-password", { token, password }); setComplete(true); }
    catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  };
  return <section className="recovery-page section"><div className="recovery-card"><span className="eyebrow">Secure password reset</span>{complete ? <><Check className="recovery-icon" /><h1>Password updated.</h1><p>Your existing sessions have been signed out. You can now access your Apex Solacii account with the new password.</p><Link className="button dark full" to="/login">Sign in <ArrowRight /></Link></> : !token ? <><h1>Reset link missing.</h1><p>This page needs the secure token from your recovery email. Request a new link to continue.</p><Link className="button dark full" to="/forgot-password">Request another link <ArrowRight /></Link></> : <><h1>Choose a new password.</h1><p>Use at least eight characters. After the reset, you’ll need to sign in again on your devices.</p><form className="auth-form" onSubmit={submit}><label>New password<div className="password-field"><input required minLength="8" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label><label>Confirm new password<input required minLength="8" type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button dark full" disabled={busy}>{busy ? "Updating…" : "Update password"}<ArrowRight /></button></form><Link className="recovery-back" to="/login"><ArrowLeft /> Back to sign in</Link></>}</div></section>;
}
