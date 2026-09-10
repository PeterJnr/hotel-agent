import { ArrowLeft, ArrowRight, MailCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { api } from "../lib/api.js";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError(""); setBusy(true);
    try { await api.post("/api/auth/forgot-password", { email }); setSent(true); }
    catch (caught) { setError(caught.message); }
    finally { setBusy(false); }
  };
  return <section className="recovery-page section"><div className="recovery-card"><span className="eyebrow">Account recovery</span>{sent ? <><MailCheck className="recovery-icon" /><h1>Check your inbox.</h1><p>If an eligible Apex Solacii account exists for <strong>{email}</strong>, we’ve sent a secure reset link. It expires in one hour.</p><Link className="button dark full" to="/login">Return to sign in <ArrowRight /></Link></> : <><h1>Forgot your password?</h1><p>Enter your account email and we’ll send you a secure link to choose a new password.</p><form className="auth-form" onSubmit={submit}><label>Email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button dark full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}<ArrowRight /></button></form><Link className="recovery-back" to="/login"><ArrowLeft /> Back to sign in</Link></>}</div></section>;
}
