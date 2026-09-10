import { prisma } from "../lib/prisma.js";
import { sendTransactionalEmail } from "../lib/sendlib.js";
import { renderActiveEmailTemplate } from "./emailTemplate.service.js";

const hotelName = process.env.HOTEL_NAME || "Apex Solacii";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "long",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

function formatAmount(value) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(Number(value));
}

function emailLayout({ firstName, title, message, details }) {
  const detailRows = details
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#666">${escapeHtml(label)}</td><td style="padding:6px 0;font-weight:600">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html><body style="margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#222">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px">
    <div style="background:#fff;border-radius:10px;padding:28px">
      <h1 style="margin:0 0 20px;font-size:24px">${escapeHtml(title)}</h1>
      <p>Hello ${escapeHtml(firstName)},</p>
      <p style="line-height:1.6">${escapeHtml(message)}</p>
      <table style="border-collapse:collapse;margin:22px 0">${detailRows}</table>
      <p style="margin-top:28px">Regards,<br>${escapeHtml(hotelName)}</p>
    </div>
  </div>
</body></html>`;
}

async function getReservationDetails(reservationId) {
  return prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      user: { select: { firstName: true, email: true } },
      room: { include: { roomType: true } },
    },
  });
}

function reservationDetails(reservation) {
  return [
    ["Reservation", reservation.id],
    ["Room type", reservation.room.roomType.name],
    ["Room", reservation.room.roomNumber],
    ["Check-in", formatDate(reservation.checkIn)],
    ["Check-out", formatDate(reservation.checkOut)],
    ["Guests", reservation.guests],
    ["Total", formatAmount(reservation.totalAmount)],
  ];
}

async function deliverReservationEmail({
  reservationId,
  event,
  subject,
  title,
  message,
  extraDetails = [],
  templateValues = {},
}) {
  try {
    const reservation = await getReservationDetails(reservationId);

    if (!reservation) {
      throw new Error("Reservation not found for email notification.");
    }

    const details = [...reservationDetails(reservation), ...extraDetails];
    const textDetails = details
      .map(([label, value]) => `${label}: ${value}`)
      .join("\n");
    const values = {
      hotelName,
      firstName: reservation.user.firstName,
      reservationId: reservation.id,
      roomType: reservation.room.roomType.name,
      roomNumber: reservation.room.roomNumber,
      checkIn: formatDate(reservation.checkIn),
      checkOut: formatDate(reservation.checkOut),
      guests: reservation.guests,
      total: formatAmount(reservation.totalAmount),
      ...templateValues,
    };
    const custom = await renderActiveEmailTemplate(event, values);

    return await sendTransactionalEmail({
      to: reservation.user.email,
      subject: custom?.subject || subject,
      html: custom?.html || emailLayout({
        firstName: reservation.user.firstName,
        title,
        message,
        details,
      }),
      text: custom?.text || `Hello ${reservation.user.firstName},\n\n${message}\n\n${textDetails}\n\nRegards,\n${hotelName}`,
    });
  } catch (error) {
    console.error(
      `Email notification failed (${event}, reservation ${reservationId}):`,
      error.message,
    );
    return null;
  }
}

export function notifyReservationCreated(reservationId) {
  return deliverReservationEmail({
    reservationId,
    event: "RESERVATION_CREATED",
    subject: `${hotelName}: reservation received`,
    title: "Reservation received",
    message:
      "We have received your reservation. Complete payment to confirm your booking.",
  });
}

export function notifyReservationCancelled(reservationId) {
  return deliverReservationEmail({
    reservationId,
    event: "RESERVATION_CANCELLED",
    subject: `${hotelName}: reservation cancelled`,
    title: "Reservation cancelled",
    message: "Your reservation has been cancelled successfully.",
  });
}

export function notifyPaymentConfirmed(reservationId, reference) {
  return deliverReservationEmail({
    reservationId,
    event: "PAYMENT_CONFIRMED",
    subject: `${hotelName}: payment and booking confirmed`,
    title: "Booking confirmed",
    message:
      "Your payment was verified and your reservation is now confirmed.",
    extraDetails: [["Payment reference", reference]],
    templateValues: { paymentReference: reference },
  });
}

export function notifyPaymentFailed(reservationId, reference) {
  return deliverReservationEmail({
    reservationId,
    event: "PAYMENT_FAILED",
    subject: `${hotelName}: payment unsuccessful`,
    title: "Payment unsuccessful",
    message:
      "Your payment was not completed. Your reservation has not been confirmed, and you may try again.",
    extraDetails: [["Payment reference", reference]],
    templateValues: { paymentReference: reference },
  });
}

export function notifyCheckedIn(reservationId) {
  return deliverReservationEmail({
    reservationId,
    event: "CHECKED_IN",
    subject: `${hotelName}: welcome and enjoy your stay`,
    title: "Welcome to the hotel",
    message: "You have been checked in successfully. We hope you enjoy your stay.",
  });
}

export function notifyCheckedOut(reservationId) {
  return deliverReservationEmail({
    reservationId,
    event: "CHECKED_OUT",
    subject: `${hotelName}: thank you for staying with us`,
    title: "Check-out completed",
    message:
      "Your check-out is complete. Thank you for staying with us, and we hope to welcome you again.",
  });
}

export async function notifyStaffOnboarded(staff) {
  const event = "STAFF_ONBOARDED";

  try {
    const roleNames = staff.roles.map(({ name }) => name).join(", ");
    const loginUrl = process.env.FRONTEND_LOGIN_URL?.trim();
    const details = [
      ["Email", staff.email],
      ["Assigned roles", roleNames],
      ...(loginUrl ? [["Login", loginUrl]] : []),
    ];
    const message = loginUrl
      ? "Your staff account has been created. Use the login address below and the temporary password provided separately by your administrator."
      : "Your staff account has been created. Use your email and the temporary password provided separately by your administrator to sign in when the staff portal is available.";
    const custom = await renderActiveEmailTemplate(event, {
      hotelName,
      firstName: staff.firstName,
      email: staff.email,
      roles: roleNames,
      loginUrl: loginUrl || "",
    });
    const textDetails = details
      .map(([label, value]) => `${label}: ${value}`)
      .join("\n");

    return await sendTransactionalEmail({
      to: staff.email,
      subject: custom?.subject || `${hotelName}: your staff account is ready`,
      html: custom?.html || emailLayout({
        firstName: staff.firstName,
        title: "Welcome to the team",
        message,
        details,
      }),
      text: custom?.text || `Hello ${staff.firstName},\n\n${message}\n\n${textDetails}\n\nFor security, your password is not included in this email.\n\nRegards,\n${hotelName}`,
    });
  } catch (error) {
    console.error(
      `Email notification failed (${event}, staff ${staff.id}):`,
      error.message,
    );
    return null;
  }
}

export async function notifyCustomerWelcome(customer) {
  const event = "CUSTOMER_WELCOME";
  try {
    const loginUrl = process.env.FRONTEND_LOGIN_URL?.trim() || "";
    const message = "Your guest account is ready. You can now manage reservations and ask Solacii AI for help throughout your stay.";
    const details = [["Email", customer.email], ...(loginUrl ? [["Guest portal", loginUrl]] : [])];
    const custom = await renderActiveEmailTemplate(event, {
      hotelName,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      loginUrl,
    });
    return await sendTransactionalEmail({
      to: customer.email,
      subject: custom?.subject || `${hotelName}: welcome to your guest residence`,
      html: custom?.html || emailLayout({ firstName: customer.firstName, title: `Welcome to ${hotelName}`, message, details }),
      text: custom?.text || `Hello ${customer.firstName},\n\n${message}${loginUrl ? `\n\nGuest portal: ${loginUrl}` : ""}\n\nRegards,\n${hotelName}`,
    });
  } catch (error) {
    console.error(`Email notification failed (${event}, customer ${customer.id}):`, error.message);
    return null;
  }
}

export async function notifyPasswordReset({ user, resetUrl, expiresIn = "1 hour" }) {
  const event = "PASSWORD_RESET";

  try {
    const message = "We received a request to reset your password. Use the secure link below before it expires. If you did not request this, you can safely ignore this email.";
    const custom = await renderActiveEmailTemplate(event, {
      hotelName,
      firstName: user.firstName,
      resetUrl,
      expiresIn,
    });

    return await sendTransactionalEmail({
      to: user.email,
      subject: custom?.subject || `${hotelName}: reset your password`,
      html: custom?.html || emailLayout({
        firstName: user.firstName,
        title: "Reset your password",
        message,
        details: [["Secure reset link", resetUrl], ["Expires in", expiresIn]],
      }),
      text: custom?.text || `Hello ${user.firstName},\n\n${message}\n\nReset password: ${resetUrl}\nExpires in: ${expiresIn}\n\nRegards,\n${hotelName}`,
    });
  } catch (error) {
    console.error(`Email notification failed (${event}, user ${user.id}):`, error.message);
    return null;
  }
}

export function notifyRefundStatus(reservationId, status) {
  const messages = {
    PENDING: "Your full refund has been submitted and is awaiting processing.",
    PROCESSING: "Your full refund is currently being processed.",
    NEEDS_ATTENTION: "Your refund needs additional information. Our team will contact you.",
    SUCCESSFUL: "Your refund has been processed successfully. Your bank may take additional time to reflect it.",
    FAILED: "Your refund could not be processed. Our team will review it.",
  };
  return deliverReservationEmail({
    reservationId,
    event: "REFUND_STATUS",
    subject: `${hotelName}: refund update`,
    title: "Refund update",
    message: messages[status] || "The status of your refund has changed.",
    extraDetails: [["Refund status", status]],
    templateValues: { refundStatus: status },
  });
}

async function deliverServiceRequestEmail({ event, recipient, request, message }) {
  try {
    const values = {
      hotelName,
      firstName: recipient.firstName,
      requestId: request.id,
      guestName: `${request.user.firstName} ${request.user.lastName}`,
      title: request.title,
      description: request.description,
      category: request.category,
      priority: request.priority,
      status: request.status,
      roomNumber: request.room.roomNumber,
    };
    const custom = await renderActiveEmailTemplate(event, values);
    const details = [["Request",request.id],["Room",request.room.roomNumber],["Category",request.category],["Priority",request.priority],["Status",request.status]];
    return await sendTransactionalEmail({
      to: recipient.email,
      subject: custom?.subject || `${hotelName}: service request update`,
      html: custom?.html || emailLayout({ firstName: recipient.firstName, title: request.title, message, details }),
      text: custom?.text || `Hello ${recipient.firstName},\n\n${message}\n\nRequest: ${request.id}\nRoom: ${request.room.roomNumber}\nStatus: ${request.status}\n\nRegards,\n${hotelName}`,
    });
  } catch (error) {
    console.error(`Email notification failed (${event}, request ${request.id}):`, error.message);
    return null;
  }
}

export async function notifyServiceRequestCreated(request) {
  await deliverServiceRequestEmail({ event:"SERVICE_REQUEST_CREATED_CUSTOMER", recipient:request.user, request, message:"We received your service request and the hotel team has been notified." });
  const managers = await prisma.user.findMany({ where:{status:"ACTIVE",roles:{some:{role:{name:{in:["SUPER_ADMIN","ADMIN","SERVICE_MANAGER"]}}}}}, select:{firstName:true,email:true} });
  await Promise.all(managers.map((recipient)=>deliverServiceRequestEmail({ event:"SERVICE_REQUEST_CREATED_STAFF", recipient, request, message:`A new ${request.priority.toLowerCase()} priority request was submitted by ${request.user.firstName} ${request.user.lastName}.` })));
}

export async function notifyServiceRequestAssigned(request) {
  if (!request.assignedTo) return;
  await deliverServiceRequestEmail({ event:"SERVICE_REQUEST_ASSIGNED", recipient:request.assignedTo, request, message:`You have been assigned a service request from ${request.user.firstName} ${request.user.lastName}.` });
}

export function notifyServiceRequestStatusChanged(request) {
  return deliverServiceRequestEmail({ event:"SERVICE_REQUEST_STATUS_CHANGED", recipient:request.user, request, message:`Your service request is now ${request.status.toLowerCase().replaceAll("_"," ")}.` });
}
