import { useMutation } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";

import { api } from "../lib/api.js";

export function PaymentCallbackPage() {
  const [params] = useSearchParams();
  const reference = params.get("reference") || params.get("trxref");
  const verification = useMutation({ mutationFn: () => api.post(`/api/payments/${encodeURIComponent(reference)}/verify`) });
  useEffect(() => { if (reference && verification.isIdle) verification.mutate(); }, [reference, verification]);

  if (!reference) return <PaymentState icon={<XCircle />} tone="error" title="Payment reference missing" copy="We could not identify this transaction. Your reservation has not been marked as paid." />;
  if (verification.isPending || verification.isIdle) return <PaymentState icon={<Clock3 />} title="Confirming your payment" copy="Please keep this page open while we securely verify your transaction with Paystack." />;
  if (verification.isError) return <PaymentState icon={<XCircle />} tone="error" title="Payment not confirmed" copy={verification.error.message} retry={() => verification.mutate()} />;
  const payment = verification.data?.data;
  if (payment?.status !== "SUCCESSFUL") return <PaymentState icon={<Clock3 />} title="Payment still processing" copy="Your transaction has not been confirmed yet. You can retry verification in a moment." retry={() => verification.mutate()} />;
  return <PaymentState icon={<CheckCircle2 />} tone="success" title="Your stay is confirmed" copy="Payment verified. Your reservation is ready, and a confirmation email is on its way." />;
}

function PaymentState({ icon, tone = "pending", title, copy, retry }) {
  return <section className={`payment-state ${tone}`}><div className="payment-icon">{icon}</div><span className="eyebrow">Secure payment</span><h1>{title}</h1><p>{copy}</p><div>{retry && <button className="button dark" onClick={retry}>Try verification again</button>}<Link className="text-link" to="/portal">Go to my stay <ArrowRight /></Link></div></section>;
}
