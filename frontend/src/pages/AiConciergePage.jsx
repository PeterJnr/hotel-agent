import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, Bot, Check, MessageSquarePlus, Send, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAiConversation, useAiConversations } from "../features/ai/aiQueries.js";
import { api } from "../lib/api.js";

const prompts = ["Find me a room for this weekend", "What rooms suit a family of three?", "Show me my upcoming reservation"];
const titleFor = (conversation) => conversation.title || "Aurelia conversation";
const readable = (value) => String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function MessageText({ children }) {
  const pieces = String(children).split(/(\*\*[^*]+\*\*)/g);
  return <p>{pieces.map((piece, index) => piece.startsWith("**") ? <strong key={index}>{piece.slice(2, -2)}</strong> : piece)}</p>;
}

function ConfirmationCard({ action, busy, onConfirm, onCancel }) {
  return <div className="ai-confirmation"><span><Sparkles /> Your confirmation is required</span><h3>{readable(action.name)}</h3><dl>{Object.entries(action.arguments || {}).map(([key, value]) => <div key={key}><dt>{readable(key)}</dt><dd>{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl><small>Nothing will be changed until you confirm.</small><div><button className="button dark" disabled={busy} onClick={onConfirm}><Check /> Confirm</button><button className="button outline" disabled={busy} onClick={onCancel}><X /> Cancel</button></div></div>;
}

export function AiConciergePage() {
  const queryClient = useQueryClient();
  const { data: conversations = [] } = useAiConversations();
  const [conversationId, setConversationId] = useState(null);
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState([]);
  const [actionNotice, setActionNotice] = useState(null);
  const bottomRef = useRef(null);
  const { data: conversation, isPending: loadingConversation } = useAiConversation(conversationId);
  const pendingAction = conversation?.pendingActions?.[0] || null;
  const messages = useMemo(() => {
    const saved = conversation?.messages || [];
    return [...saved, ...localMessages.filter((local) => !saved.some((message) => message.role === local.role && message.content === local.content))];
  }, [conversation?.messages, localMessages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, pendingAction]);
  const refresh = (id = conversationId) => {
    queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
    if (id) queryClient.invalidateQueries({ queryKey: ["ai-conversation", id] });
  };
  const chat = useMutation({
    mutationFn: (message) => api.post("/api/ai/chat", { message, clientMessageId: crypto.randomUUID(), ...(conversationId ? { conversationId } : {}) }),
    onMutate: (message) => { setActionNotice(null); setLocalMessages([{ id: `local-${Date.now()}`, role: "USER", content: message }]); },
    onSuccess: ({ data }) => {
      setConversationId(data.conversationId);
      setLocalMessages(data.text ? [{ id: `reply-${Date.now()}`, role: "ASSISTANT", content: data.text }] : []);
      refresh(data.conversationId);
    },
  });
  const confirm = useMutation({ mutationFn: () => api.post(`/api/ai/actions/${pendingAction.id}/confirm`), onSuccess: ({ data }) => { setActionNotice(data.message || "Your request has been completed."); refresh(); } });
  const cancel = useMutation({ mutationFn: () => api.delete(`/api/ai/actions/${pendingAction.id}`), onSuccess: ({ data }) => { setActionNotice(data.message || "That action was cancelled."); refresh(); } });
  const archive = useMutation({ mutationFn: () => api.patch(`/api/ai/conversations/${conversationId}/archive`), onSuccess: () => { setConversationId(null); setLocalMessages([]); setActionNotice(null); refresh(); } });
  const send = (message = draft) => { const clean = message.trim(); if (!clean || chat.isPending || pendingAction) return; setDraft(""); chat.mutate(clean); };
  const selectConversation = (id) => { setConversationId(id); setLocalMessages([]); setActionNotice(null); };

  return <div className="concierge-screen"><aside className="ai-history"><div><span className="eyebrow">Private concierge</span><h1>Ask Aurelia</h1></div><button className="new-chat" onClick={() => selectConversation(null)}><MessageSquarePlus /> New conversation</button><nav>{conversations.map((item) => <button className={item.id === conversationId ? "active" : ""} onClick={() => selectConversation(item.id)} key={item.id}><span>{titleFor(item)}</span><small>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(item.lastMessageAt))}</small></button>)}</nav></aside><main className="ai-chat"><header><div><Bot /><span><strong>Aurelia</strong><small>AI guest concierge · actions require approval</small></span></div>{conversationId && <button onClick={() => archive.mutate()} disabled={archive.isPending}><Archive /> Archive</button>}</header><div className="ai-thread">{!conversationId && !localMessages.length && <div className="ai-intro"><div><Sparkles /></div><span className="eyebrow">Always at your service</span><h2>What may I arrange for you?</h2><p>Explore rooms, check availability, review your stays, or prepare a reservation—all through conversation.</p><div>{prompts.map((prompt) => <button key={prompt} onClick={() => send(prompt)}>{prompt}</button>)}</div></div>}{loadingConversation && <div className="portal-loading">Reopening your conversation…</div>}{messages.map((message) => <article className={`ai-message ${message.role.toLowerCase()}`} key={message.id}><span>{message.role === "ASSISTANT" ? <Bot /> : "You"}</span><MessageText>{message.content}</MessageText></article>)}{chat.isPending && <article className="ai-message assistant typing"><span><Bot /></span><p>Aurelia is considering your request<span>···</span></p></article>}{pendingAction && <ConfirmationCard action={pendingAction} busy={confirm.isPending || cancel.isPending} onConfirm={() => confirm.mutate()} onCancel={() => cancel.mutate()} />}{actionNotice && <div className="ai-action-notice"><Check /> {actionNotice}</div>}{(chat.error || confirm.error || cancel.error || archive.error) && <div className="form-error">{(chat.error || confirm.error || cancel.error || archive.error).message}</div>}<div ref={bottomRef} /></div><form className="ai-composer" onSubmit={(event) => { event.preventDefault(); send(); }}><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder={pendingAction ? "Confirm or cancel the proposed action first" : "Ask Aurelia anything about your stay…"} disabled={Boolean(pendingAction)} maxLength="4000" /><button disabled={!draft.trim() || chat.isPending || Boolean(pendingAction)} aria-label="Send message"><Send /></button><small>Aurelia can make mistakes. Review dates, guests, prices, and room details before confirming.</small></form></main></div>;
}
