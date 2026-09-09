import { prisma } from "../lib/prisma.js";

export const templatePlaceholders = {
  CUSTOMER_WELCOME: ["hotelName", "firstName", "lastName", "email", "loginUrl"],
  RESERVATION_CREATED: ["hotelName", "firstName", "reservationId", "roomType", "roomNumber", "checkIn", "checkOut", "guests", "total"],
  RESERVATION_CANCELLED: ["hotelName", "firstName", "reservationId", "roomType", "roomNumber", "checkIn", "checkOut", "guests", "total"],
  PAYMENT_CONFIRMED: ["hotelName", "firstName", "reservationId", "roomType", "roomNumber", "checkIn", "checkOut", "guests", "total", "paymentReference"],
  PAYMENT_FAILED: ["hotelName", "firstName", "reservationId", "roomType", "roomNumber", "checkIn", "checkOut", "guests", "total", "paymentReference"],
  CHECKED_IN: ["hotelName", "firstName", "reservationId", "roomType", "roomNumber", "checkIn", "checkOut", "guests", "total"],
  CHECKED_OUT: ["hotelName", "firstName", "reservationId", "roomType", "roomNumber", "checkIn", "checkOut", "guests", "total"],
  STAFF_ONBOARDED: ["hotelName", "firstName", "email", "roles", "loginUrl"],
  REFUND_STATUS: ["hotelName", "firstName", "reservationId", "roomType", "roomNumber", "checkIn", "checkOut", "guests", "total", "refundStatus"],
  SERVICE_REQUEST_CREATED_CUSTOMER: ["hotelName", "firstName", "requestId", "title", "description", "category", "priority", "status", "roomNumber"],
  SERVICE_REQUEST_CREATED_STAFF: ["hotelName", "firstName", "requestId", "guestName", "title", "description", "category", "priority", "status", "roomNumber"],
  SERVICE_REQUEST_ASSIGNED: ["hotelName", "firstName", "requestId", "guestName", "title", "description", "category", "priority", "status", "roomNumber"],
  SERVICE_REQUEST_STATUS_CHANGED: ["hotelName", "firstName", "requestId", "title", "category", "priority", "status", "roomNumber"],
};

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const text = (value, name) => {
  if (typeof value !== "string" || !value.trim()) throw fail(`${name} is required.`);
  return value.trim();
};
const eventName = (value) => {
  const event = typeof value === "string" ? value.trim().toUpperCase() : value;
  if (!templatePlaceholders[event]) throw fail("Invalid email template event.");
  return event;
};
function validatePlaceholders(event, ...bodies) {
  const allowed = new Set(templatePlaceholders[event]);
  for (const body of bodies.filter(Boolean)) {
    for (const match of body.matchAll(/{{\s*([A-Za-z][A-Za-z0-9]*)\s*}}/g)) {
      if (!allowed.has(match[1])) throw fail(`Placeholder {{${match[1]}}} is not allowed for ${event}.`);
    }
  }
}
const authorSelect = { select: { id: true, firstName: true, lastName: true, email: true } };
const includeAuthors = { createdBy: authorSelect, updatedBy: authorSelect };

export async function createEmailTemplate({ data, userId }) {
  const event = eventName(data.event), name = text(data.name, "Name"), subject = text(data.subject, "Subject"), htmlBody = text(data.htmlBody, "HTML body");
  const textBody = typeof data.textBody === "string" ? data.textBody.trim() || null : null;
  validatePlaceholders(event, subject, htmlBody, textBody);
  try {
    return await prisma.emailTemplate.create({ data: { event, name, subject, htmlBody, textBody, createdById: userId, updatedById: userId }, include: includeAuthors });
  } catch (error) { if (error.code === "P2002") throw fail("A template with this name already exists for the event.", 409); throw error; }
}
export function listEmailTemplates({ event } = {}) {
  return prisma.emailTemplate.findMany({ where: event ? { event: eventName(event) } : {}, include: includeAuthors, orderBy: [{ event: "asc" }, { name: "asc" }] });
}
export async function getEmailTemplate(id) {
  const item = await prisma.emailTemplate.findUnique({ where: { id }, include: includeAuthors });
  if (!item) throw fail("Email template not found.", 404);
  return item;
}
export async function updateEmailTemplate({ id, data, userId }) {
  const current = await getEmailTemplate(id);
  const event = data.event === undefined ? current.event : eventName(data.event);
  if (current.isActive && event !== current.event) throw fail("Deactivate the template before changing its event.", 409);
  const next = {
    event,
    name: data.name === undefined ? current.name : text(data.name, "Name"),
    subject: data.subject === undefined ? current.subject : text(data.subject, "Subject"),
    htmlBody: data.htmlBody === undefined ? current.htmlBody : text(data.htmlBody, "HTML body"),
    textBody: data.textBody === undefined ? current.textBody : typeof data.textBody === "string" ? data.textBody.trim() || null : null,
    updatedById: userId,
  };
  validatePlaceholders(event, next.subject, next.htmlBody, next.textBody);
  try { return await prisma.emailTemplate.update({ where: { id }, data: next, include: includeAuthors }); }
  catch (error) { if (error.code === "P2002") throw fail("A template with this name already exists for the event.", 409); throw error; }
}
export async function activateEmailTemplate({ id, userId }) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.emailTemplate.findUnique({ where: { id } });
    if (!item) throw fail("Email template not found.", 404);
    await tx.emailTemplate.updateMany({ where: { event: item.event, isActive: true }, data: { isActive: false, updatedById: userId } });
    return tx.emailTemplate.update({ where: { id }, data: { isActive: true, updatedById: userId }, include: includeAuthors });
  });
}
export async function deleteEmailTemplate(id) {
  const item = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!item) throw fail("Email template not found.", 404);
  if (item.isActive) throw fail("Deactivate or replace the active template before deleting it.", 409);
  await prisma.emailTemplate.delete({ where: { id } });
}
export async function deactivateEmailTemplate({ id, userId }) {
  await getEmailTemplate(id);
  return prisma.emailTemplate.update({ where: { id }, data: { isActive: false, updatedById: userId }, include: includeAuthors });
}
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const render = (body, values, html = false) => body?.replace(/{{\s*([A-Za-z][A-Za-z0-9]*)\s*}}/g, (_, key) => html ? escapeHtml(values[key]) : String(values[key] ?? "")) || null;
export async function renderActiveEmailTemplate(event, values) {
  const template = await prisma.emailTemplate.findFirst({ where: { event, isActive: true } });
  if (!template) return null;
  return { subject: render(template.subject, values), html: render(template.htmlBody, values, true), text: render(template.textBody, values) };
}
export async function previewEmailTemplate(id, values = {}) {
  const template = await getEmailTemplate(id);
  return { subject: render(template.subject, values), html: render(template.htmlBody, values, true), text: render(template.textBody, values) };
}
