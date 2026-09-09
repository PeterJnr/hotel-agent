import { prisma } from "../src/lib/prisma.js";
import { activateEmailTemplate, createEmailTemplate, deleteEmailTemplate, renderActiveEmailTemplate } from "../src/services/emailTemplate.service.js";
let first, second;
try {
  const user = await prisma.user.findFirstOrThrow();
  first = await createEmailTemplate({ userId: user.id, data: { event: "PAYMENT_CONFIRMED", name: "Smoke A", subject: "Hi {{firstName}}", htmlBody: "<p>{{paymentReference}}</p>" } });
  second = await createEmailTemplate({ userId: user.id, data: { event: "PAYMENT_CONFIRMED", name: "Smoke B", subject: "Confirmed {{reservationId}}", htmlBody: "<p>Hello {{firstName}}</p>" } });
  await activateEmailTemplate({ id: first.id, userId: user.id });
  await activateEmailTemplate({ id: second.id, userId: user.id });
  const rendered = await renderActiveEmailTemplate("PAYMENT_CONFIRMED", { reservationId: "R1", firstName: "<Ada>" });
  const active = await prisma.emailTemplate.count({ where: { event: "PAYMENT_CONFIRMED", isActive: true } });
  const result = { active, subject: rendered.subject, escaped: rendered.html.includes("&lt;Ada&gt;") };
  console.log(JSON.stringify(result, null, 2));
  if (active !== 1 || result.subject !== "Confirmed R1" || !result.escaped) process.exitCode = 1;
} finally {
  if (first || second) await prisma.emailTemplate.deleteMany({ where: { id: { in: [first?.id, second?.id].filter(Boolean) } } });
  await prisma.$disconnect();
}
