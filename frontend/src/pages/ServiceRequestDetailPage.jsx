import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageSquare, Send } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { formatStayDate, useServiceRequest } from "../features/customer/customerQueries.js";
import { api } from "../lib/api.js";

export function ServiceRequestDetailPage() {
  const { requestId } = useParams();
  const queryClient = useQueryClient();
  const { data: item, isPending, error } = useServiceRequest(requestId);
  const [content, setContent] = useState("");
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["service-request", requestId] }); queryClient.invalidateQueries({ queryKey: ["my-service-requests"] }); };
  const comment = useMutation({ mutationFn: () => api.post(`/api/service-requests/${requestId}/comments`, { content, isInternal: false }), onSuccess: () => { setContent(""); refresh(); } });
  const cancel = useMutation({ mutationFn: () => api.patch(`/api/service-requests/${requestId}/cancel`), onSuccess: refresh });
  if (isPending) return <div className="portal-screen portal-loading">Opening your request…</div>;
  if (error || !item) return <div className="portal-screen"><div className="form-error">{error?.message || "Request not found."}</div></div>;
  const closed = ["CLOSED", "CANCELLED"].includes(item.status);
  return <div className="portal-screen"><Link className="back-link" to="/portal/requests"><ArrowLeft /> All requests</Link><div className="request-detail-head"><div><span className={`status-pill ${item.status.toLowerCase()}`}>{item.status.replaceAll("_", " ")}</span><h1>{item.title}</h1><p>{item.category.replaceAll("_", " ")} · Room {item.room.roomNumber}</p></div>{["OPEN", "ASSIGNED"].includes(item.status) && <button className="quiet-danger" onClick={() => cancel.mutate()} disabled={cancel.isPending}>Cancel request</button>}</div><div className="request-detail-grid"><section><span className="eyebrow">Your request</span><p className="request-description">{item.description}</p><small>Submitted {formatStayDate(item.createdAt, { hour: "numeric", minute: "2-digit" })}</small></section><section><h2><MessageSquare /> Conversation</h2><div className="comment-thread">{item.comments.map((entry) => <article key={entry.id}><strong>{entry.author.firstName} {entry.author.lastName}</strong><time>{formatStayDate(entry.createdAt, { hour: "numeric", minute: "2-digit" })}</time><p>{entry.content}</p></article>)}{!item.comments.length && <p className="muted-copy">No updates yet. Our team will respond here.</p>}</div>{!closed && <form className="comment-form" onSubmit={(event) => { event.preventDefault(); comment.mutate(); }}><textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Add a message…" maxLength="2000" required /><button aria-label="Send message" disabled={comment.isPending}><Send /></button></form>}{(comment.error || cancel.error) && <div className="form-error">{(comment.error || cancel.error).message}</div>}</section></div></div>;
}
