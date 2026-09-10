import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Eye, FileText, Mail, Plus, Power, Save, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useEmailTemplatePlaceholders, useEmailTemplates } from "../features/admin/adminQueries.js";
import { formatStayDate } from "../features/customer/customerQueries.js";
import { api } from "../lib/api.js";

const labelEvent = (event) => event.toLowerCase().replaceAll("_", " ");
const emptyTemplate = { event: "", name: "", subject: "", htmlBody: "", textBody: "" };

function TemplateEditor({ template, events, placeholders, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(template ? { event: template.event, name: template.name, subject: template.subject, htmlBody: template.htmlBody, textBody: template.textBody || "" } : emptyTemplate);
  const [field, setField] = useState("htmlBody");
  const [preview, setPreview] = useState(null);
  const isEditing = Boolean(template);
  const save = useMutation({
    mutationFn: () => isEditing ? api.patch(`/api/management/email-templates/${template.id}`, form) : api.post("/api/management/email-templates", form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-email-templates"] }); onClose(); },
  });
  const loadPreview = useMutation({
    mutationFn: () => api.post(`/api/management/email-templates/${template.id}/preview`, { variables: Object.fromEntries((placeholders[form.event] || []).map((name) => [name, `[${name}]`])) }),
    onSuccess: ({ data }) => setPreview(data),
  });
  const changeStatus = useMutation({
    mutationFn: () => api.post(`/api/management/email-templates/${template.id}/${template.isActive ? "deactivate" : "activate"}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-email-templates"] }); onClose(); },
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/api/management/email-templates/${template.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-email-templates"] }); onClose(); },
  });
  const update = (input) => setForm((current) => ({ ...current, [input.target.name]: input.target.value }));
  const insert = (name) => setForm((current) => ({ ...current, [field]: `${current[field]}{{${name}}}` }));

  return <div className="admin-drawer-shade"><div className="admin-drawer template-editor"><header><div><span className="eyebrow">{isEditing ? "Template editor" : "New communication"}</span><h2>{isEditing ? template.name : "Create template"}</h2></div><button onClick={() => onClose()} aria-label="Close editor"><X /></button></header>
    <form onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <div className="drawer-two"><label><span>Email event</span><select name="event" value={form.event} onChange={update} disabled={template?.isActive} required><option value="">Choose an event</option>{events.map((name) => <option key={name} value={name}>{labelEvent(name)}</option>)}</select></label><label><span>Template name</span><input name="name" value={form.name} onChange={update} required /></label></div>
      <label><span>Subject line</span><input name="subject" value={form.subject} onFocus={() => setField("subject")} onChange={update} required /></label>
      <label><span>HTML body</span><textarea name="htmlBody" value={form.htmlBody} onFocus={() => setField("htmlBody")} onChange={update} required /></label>
      <label><span>Plain-text fallback</span><textarea name="textBody" value={form.textBody} onFocus={() => setField("textBody")} onChange={update} /></label>
      <section className="placeholder-picker"><header><strong>Approved placeholders</strong><small>Click to insert into the last selected field.</small></header><div>{(placeholders[form.event] || []).map((name) => <button type="button" key={name} onClick={() => insert(name)}>{`{{${name}}}`}</button>)}</div></section>
      {save.error && <div className="form-error">{save.error.message}</div>}
      <div className="template-editor-actions">{isEditing && <button type="button" className="button light" onClick={() => loadPreview.mutate()} disabled={loadPreview.isPending}><Eye /> {loadPreview.isPending ? "Rendering…" : "Preview saved version"}</button>}<button className="button dark" disabled={save.isPending}><Save /> {save.isPending ? "Saving…" : "Save template"}</button></div>
    </form>
    {(loadPreview.error || changeStatus.error || remove.error) && <div className="form-error">{loadPreview.error?.message || changeStatus.error?.message || remove.error?.message}</div>}
    {preview && <section className="template-preview"><header><div><small>Rendered subject</small><strong>{preview.subject}</strong></div><button onClick={() => setPreview(null)}><X /></button></header><iframe title="Rendered email preview" sandbox="" srcDoc={preview.html || `<pre>${preview.text || ""}</pre>`} /><details><summary>Plain-text version</summary><pre>{preview.text || "No plain-text fallback supplied."}</pre></details></section>}
    {isEditing && <section className="template-lifecycle"><div><strong>Delivery status</strong><p>{template.isActive ? "This template is currently used for outgoing emails." : "This draft is not used for outgoing emails."}</p></div><button className={template.isActive ? "button light" : "button dark"} disabled={changeStatus.isPending} onClick={() => { if (template.isActive || window.confirm("Activate this template? It will replace the currently active template for this event.")) changeStatus.mutate(); }}><Power />{changeStatus.isPending ? "Updating…" : template.isActive ? "Deactivate" : "Activate template"}</button>{!template.isActive && <button className="quiet-danger" disabled={remove.isPending} onClick={() => { if (window.confirm(`Permanently delete “${template.name}”? This cannot be undone.`)) remove.mutate(); }}><Trash2 />{remove.isPending ? "Deleting…" : "Delete draft"}</button>}</section>}
  </div></div>;
}

export function AdminEmailTemplatesPage() {
  const [event, setEvent] = useState("");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState(null);
  const { data: templates = [], isPending, error } = useEmailTemplates(event);
  const { data: placeholders = {} } = useEmailTemplatePlaceholders();
  const events = Object.keys(placeholders);
  const visible = useMemo(() => { const query = search.trim().toLowerCase(); return query ? templates.filter((template) => `${template.name} ${template.subject} ${template.event}`.toLowerCase().includes(query)) : templates; }, [search, templates]);
  const activeCount = visible.filter((template) => template.isActive).length;

  return <main className="admin-screen email-template-screen">
    <div className="admin-heading"><div><span className="eyebrow">Guest communications</span><h1>Email templates</h1><p>Shape every automated message while keeping approved variables and delivery events intact.</p></div><button className="button dark" onClick={() => setEditor({ mode: "create" })}><Plus /> New template</button></div>
    <section className="email-template-summary"><article><Mail /><span><small>Templates in view</small><strong>{visible.length}</strong></span></article><article><CheckCircle2 /><span><small>Active templates</small><strong>{activeCount}</strong></span></article><article><FileText /><span><small>Supported events</small><strong>{events.length}</strong></span></article></section>
    <section className="admin-filters email-template-filters"><label className="admin-search"><Search /><input value={search} onChange={(input) => setSearch(input.target.value)} placeholder="Search template name, subject, or event" /></label><label><span>Email event</span><select value={event} onChange={(input) => setEvent(input.target.value)}><option value="">All communication events</option>{events.map((name) => <option key={name} value={name}>{labelEvent(name)}</option>)}</select></label></section>
    {isPending && <div className="admin-loading">Loading email templates…</div>}{error && <div className="form-error">{error.message}</div>}
    <section className="email-template-list">{visible.map((template) => <article key={template.id} className={template.isActive ? "active" : ""}><div className="template-state"><span>{template.isActive ? "Active" : "Draft"}</span>{template.isActive && <CheckCircle2 />}</div><div><small>{labelEvent(template.event)}</small><h2>{template.name}</h2><p>{template.subject}</p><footer>Updated {formatStayDate(template.updatedAt)} by {template.updatedBy.firstName} {template.updatedBy.lastName}</footer></div><button onClick={() => setEditor({ mode: "edit", template })} aria-label={`Open ${template.name}`}><ArrowRight /></button></article>)}</section>
    {!isPending && !visible.length && <div className="admin-table-empty"><Mail /><p>No email templates match this view.</p></div>}
    {editor && <TemplateEditor template={editor.template} events={events} placeholders={placeholders} onClose={() => setEditor(null)} />}
  </main>;
}
