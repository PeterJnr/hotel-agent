import { ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";

import { useAuth } from "../features/auth/authContext.js";

export function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "" });

  const destinationFor = (account) => account.roles.includes("CUSTOMER") ? "/portal" : "/admin";
  if (user) return <Navigate to={destinationFor(user)} replace />;
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const session = isRegister
        ? await register({ ...form, phone: form.phone || null })
        : await login({ email: form.email, password: form.password });
      navigate(location.state?.from?.pathname || destinationFor(session.user), { replace: true });
    } catch (caught) {
      setError(caught.message);
    } finally { setBusy(false); }
  };

  return (
    <section className="auth-page">
      <div className="auth-visual"><div className="auth-quote"><span className="eyebrow light">Maison Aurelia</span><blockquote>“The luxury of having everything taken care of.”</blockquote><div className="auth-benefits"><span><Check />Direct booking benefits</span><span><Check />Personal AI concierge</span><span><Check />Secure stay management</span></div></div></div>
      <div className="auth-panel"><div className="auth-form-wrap"><span className="eyebrow">Guest portal</span><h1>{isRegister ? "Begin your stay." : "Welcome back."}</h1><p>{isRegister ? "Create your account and let us take care of the details." : "Your reservations and concierge are waiting."}</p>
        <form className="auth-form" onSubmit={submit}>
          {isRegister && <div className="field-row"><label>First name<input required name="firstName" autoComplete="given-name" value={form.firstName} onChange={update} /></label><label>Last name<input required name="lastName" autoComplete="family-name" value={form.lastName} onChange={update} /></label></div>}
          <label>Email address<input required type="email" name="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={update} /></label>
          {isRegister && <label>Phone <small>Optional</small><input name="phone" autoComplete="tel" placeholder="+234" value={form.phone} onChange={update} /></label>}
          <label>Password<div className="password-field"><input required minLength="8" type={showPassword ? "text" : "password"} name="password" autoComplete={isRegister ? "new-password" : "current-password"} value={form.password} onChange={update} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button dark full" disabled={busy}>{busy ? "One moment…" : isRegister ? "Create account" : "Sign in"}<ArrowRight /></button>
        </form>
        <div className="auth-divider"><span>or</span></div><button className="google-button" type="button" disabled title="Enabled when Google frontend credentials are configured"><span>G</span> Continue with Google</button>
        <p className="auth-switch">{isRegister ? "Already have an account?" : "New to Maison Aurelia?"} <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create account"}</Link></p>
      </div></div>
    </section>
  );
}
