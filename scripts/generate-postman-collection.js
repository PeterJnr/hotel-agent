import { mkdir, writeFile } from "node:fs/promises";

const schema = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";
const jsonHeader = [{ key: "Content-Type", value: "application/json" }];
const bearer = (variable) => ({ type: "bearer", bearer: [{ key: "token", value: `{{${variable}}}`, type: "string" }] });
const test = (...lines) => ({ listen: "test", script: { type: "text/javascript", exec: lines } });
const success = (codes = [200]) => test(
  `pm.test("Status is ${codes.join(" or ")}", () => pm.expect(${JSON.stringify(codes)}).to.include(pm.response.code));`,
  "pm.test(\"Response is JSON\", () => pm.response.to.be.json);",
  "const body = pm.response.json();",
  "pm.test(\"Success envelope is present\", () => pm.expect(body).to.have.property(\"success\"));",
);
const capture = (code, assignments, codes = [200]) => test(
  `pm.test("Status is ${codes.join(" or ")}", () => pm.expect(${JSON.stringify(codes)}).to.include(pm.response.code));`,
  "const body = pm.response.json();",
  "pm.test(\"Request succeeded\", () => pm.expect(body.success).to.eql(true));",
  ...assignments.map(([name, expression]) => `if (${expression} !== undefined && ${expression} !== null) pm.environment.set("${name}", ${expression});`),
);
const errorTest = (code) => test(
  `pm.test("Status is ${code}", () => pm.response.to.have.status(${code}));`,
  "const body = pm.response.json();",
  "pm.test(\"Error envelope is safe\", () => { pm.expect(body.success).to.eql(false); pm.expect(body.message).to.be.a(\"string\"); });",
);

function request(name, method, path, { auth, body, formdata, events = [success(method === "POST" ? [200, 201, 202] : [200])], description } = {}) {
  const item = {
    name,
    request: {
      method,
      header: body ? jsonHeader : [],
      url: `{{baseUrl}}${path}`,
      ...(auth ? { auth: bearer(auth) } : {}),
      ...(body ? { body: { mode: "raw", raw: JSON.stringify(body, null, 2), options: { raw: { language: "json" } } } } : {}),
      ...(formdata ? { body: { mode: "formdata", formdata } } : {}),
      ...(description ? { description } : {}),
    },
    event: events,
  };
  return item;
}

const collection = {
  info: {
    _postman_id: "2a26b096-a236-4a83-a323-hotelai2026",
    name: "Hotel AI - Complete API Test Suite",
    description: "Import with the Hotel AI - Local environment. Run folders in numeric order when practical. Requests that require Google, Cloudinary, Paystack, Sendlib, or a checked-in reservation are explicitly labelled.",
    schema,
  },
  variable: [{ key: "baseUrl", value: "http://localhost:6000" }],
  item: [
    { name: "00 - Health", item: [
      request("API health", "GET", "/api/health", { events: [capture(200, [], [200])] }),
    ] },
    { name: "01 - Authentication", item: [
      request("Register customer (captures tokens)", "POST", "/api/auth/register", {
        body: { firstName: "Postman", lastName: "Customer", email: "postman.{{$timestamp}}@example.com", phone: null, password: "PostmanPass123!" },
        events: [capture(201, [["customerToken", "body.data.accessToken"], ["customerRefreshToken", "body.data.refreshToken"], ["customerId", "body.data.user.id"], ["customerEmail", "body.data.user.email"]], [201])],
      }),
      request("Login customer", "POST", "/api/auth/login", {
        body: { email: "{{customerEmail}}", password: "{{customerPassword}}" },
        events: [capture(200, [["customerToken", "body.data.accessToken"], ["customerRefreshToken", "body.data.refreshToken"], ["customerId", "body.data.user.id"]])],
      }),
      request("Login super admin", "POST", "/api/auth/login", {
        body: { email: "{{adminEmail}}", password: "{{adminPassword}}" },
        events: [capture(200, [["adminToken", "body.data.accessToken"], ["adminRefreshToken", "body.data.refreshToken"], ["adminId", "body.data.user.id"]])],
      }),
      request("Refresh customer session", "POST", "/api/auth/refresh", {
        body: { refreshToken: "{{customerRefreshToken}}" },
        events: [capture(200, [["customerToken", "body.data.accessToken"], ["customerRefreshToken", "body.data.refreshToken"]])],
      }),
      request("Google login [FRONTEND/GOOGLE TOKEN REQUIRED]", "POST", "/api/auth/google", {
        body: { credential: "{{googleCredential}}" }, description: "Deferred until frontend Google Identity integration supplies a fresh credential.",
      }),
      request("Link Google [FRONTEND/GOOGLE TOKEN REQUIRED]", "POST", "/api/auth/google/link", {
        auth: "customerToken", body: { credential: "{{googleCredential}}" }, description: "Deferred until frontend Google Identity integration supplies a fresh credential.",
      }),
      request("Invalid login returns 401", "POST", "/api/auth/login", {
        body: { email: "nobody@example.com", password: "wrong-password" }, events: [errorTest(401)],
      }),
      request("Logout customer [RUN LAST]", "POST", "/api/auth/logout", {
        body: { refreshToken: "{{customerRefreshToken}}" }, description: "Run after all customer tests; it revokes the current refresh token.",
      }),
    ] },
    { name: "02 - Room Types", item: [
      request("List room types (captures IDs)", "GET", "/api/room-types", { events: [test(
        "pm.response.to.have.status(200); const body = pm.response.json(); pm.expect(body.success).to.eql(true);",
        "for (const roomType of body.data) { pm.environment.set(roomType.name.toLowerCase() + \"RoomTypeId\", roomType.id); }",
        "if (body.data[0]) pm.environment.set(\"roomTypeId\", body.data[0].id);",
      )] }),
      request("Get room type", "GET", "/api/room-types/{{roomTypeId}}"),
      request("Update room type", "PATCH", "/api/room-types/{{roomTypeId}}", { auth: "adminToken", body: { description: "Updated through the Hotel AI Postman suite", capacity: 3, pricePerNight: "2500.00" } }),
      request("Customer cannot update room type", "PATCH", "/api/room-types/{{roomTypeId}}", { auth: "customerToken", body: { description: "Forbidden" }, events: [errorTest(403)] }),
    ] },
    { name: "03 - Rooms and Availability", item: [
      request("Public room availability", "GET", "/api/rooms/availability?roomType=STANDARD&checkIn={{checkIn}}&checkOut={{checkOut}}&guests={{guests}}", { events: [test(
        "pm.response.to.have.status(200); const body = pm.response.json(); pm.expect(body.success).to.eql(true);",
        "if (body.data.rooms[0]) pm.environment.set(\"availableRoomId\", body.data.rooms[0].id);",
      )] }),
      request("List rooms (captures room IDs)", "GET", "/api/rooms", { auth: "adminToken", events: [test(
        "pm.response.to.have.status(200); const body = pm.response.json(); pm.expect(body.success).to.eql(true);",
        "if (body.data[0]) pm.environment.set(\"roomId\", body.data[0].id);",
        "const room201 = body.data.find(room => room.roomNumber === \"201\"); if (room201) pm.environment.set(\"room201Id\", room201.id);",
      )] }),
      request("Get room", "GET", "/api/rooms/{{roomId}}", { auth: "adminToken" }),
      request("Create temporary room", "POST", "/api/rooms/create", { auth: "adminToken", body: { roomNumber: "QA-{{$timestamp}}", roomTypeId: "{{standardRoomTypeId}}", status: "AVAILABLE" }, events: [capture(201, [["createdRoomId", "body.data.id"]], [201])] }),
      request("Cannot manually create occupied room", "POST", "/api/rooms/create", { auth: "adminToken", body: { roomNumber: "QA-OCCUPIED-{{$timestamp}}", roomTypeId: "{{standardRoomTypeId}}", status: "OCCUPIED" }, events: [errorTest(400)] }),
      request("Update temporary room", "PATCH", "/api/rooms/{{createdRoomId}}", { auth: "adminToken", body: { status: "MAINTENANCE" } }),
      request("Delete temporary room [CLEANUP]", "DELETE", "/api/rooms/{{createdRoomId}}", { auth: "adminToken" }),
      request("Unauthenticated room list returns 401", "GET", "/api/rooms", { events: [errorTest(401)] }),
    ] },
    { name: "04 - Room Type Images [CLOUDINARY]", item: [
      request("Upload image (captures image ID)", "POST", "/api/room-types/{{roomTypeId}}/images", {
        auth: "adminToken",
        formdata: [{ key: "images", type: "file", src: "{{roomImagePath}}" }, { key: "altText", type: "text", value: "Hotel room test image" }],
        description: "Select a real JPEG/PNG/WebP/GIF/AVIF file under 5 MB if Postman does not resolve roomImagePath.",
        events: [capture(201, [["imageId", "body.data[0] && body.data[0].id"]], [201])],
      }),
      request("List images (captures reorder JSON)", "GET", "/api/room-types/{{roomTypeId}}/images", { events: [test(
        "pm.response.to.have.status(200); const body = pm.response.json(); pm.expect(body.success).to.eql(true);",
        "if (body.data[0]) pm.environment.set(\"imageId\", body.data[0].id);",
        "pm.environment.set(\"imageIdsJson\", JSON.stringify(body.data.map(image => image.id)));",
      )] }),
      request("Set primary image", "PATCH", "/api/room-types/{{roomTypeId}}/images/{{imageId}}/primary", { auth: "adminToken" }),
      request("Reorder all images", "PATCH", "/api/room-types/{{roomTypeId}}/images/reorder", { auth: "adminToken", body: { imageIds: "__POSTMAN_RAW_ARRAY__" }, description: "The generated file replaces the placeholder with the raw {{imageIdsJson}} array." }),
      request("Delete uploaded image [CLEANUP]", "DELETE", "/api/room-types/{{roomTypeId}}/images/{{imageId}}", { auth: "adminToken" }),
    ] },
    { name: "05 - Reservations", item: [
      request("Create reservation (captures ID)", "POST", "/api/reservations/create", { auth: "customerToken", body: { roomId: "{{availableRoomId}}", checkIn: "{{checkIn}}", checkOut: "{{checkOut}}", guests: 2 }, events: [capture(201, [["reservationId", "body.data.id"]], [201])] }),
      request("My reservations", "GET", "/api/reservations/me", { auth: "customerToken" }),
      request("Get own reservation", "GET", "/api/reservations/{{reservationId}}", { auth: "customerToken" }),
      request("Admin list reservations", "GET", "/api/reservations?status=PENDING", { auth: "adminToken", events: [test(
        "pm.response.to.have.status(200); const body = pm.response.json(); pm.expect(body.success).to.eql(true);",
        "if (body.data[0]) { pm.expect(body.data[0]).to.have.property(\"user\"); pm.expect(body.data[0].payments).to.be.an(\"array\"); pm.expect(body.data[0].user).not.to.have.property(\"passwordHash\"); }",
      )] }),
      request("Customer cannot list all reservations", "GET", "/api/reservations", { auth: "customerToken", events: [errorTest(403)] }),
      request("Check in [REQUIRES CONFIRMED + CURRENT DATES]", "PATCH", "/api/reservations/{{checkedInReservationId}}/status", { auth: "adminToken", body: { status: "CHECKED_IN" }, description: "Use a CONFIRMED reservation whose current date is within its stay." }),
      request("Check out [REQUIRES CHECKED_IN]", "PATCH", "/api/reservations/{{checkedInReservationId}}/status", { auth: "adminToken", body: { status: "CHECKED_OUT" } }),
      request("Cancel pending reservation [MUTATES STATUS]", "POST", "/api/reservations/cancel", { auth: "customerToken", body: { reservationId: "{{reservationId}}" } }),
    ] },
    { name: "06 - Payments and Refunds [PAYSTACK]", item: [
      request("Initialize payment", "POST", "/api/payments/reservations/{{reservationId}}/initialize", { auth: "customerToken", events: [capture(201, [["paymentId", "body.data.id"], ["paymentReference", "body.data.reference"], ["authorizationUrl", "body.data.authorizationUrl"]], [201])], description: "Requires Paystack configuration and a PENDING reservation. Run before cancellation." }),
      request("Verify payment", "POST", "/api/payments/{{paymentReference}}/verify", { auth: "customerToken", description: "Complete payment through authorizationUrl first for a successful result." }),
      request("Webhook signature rejection", "POST", "/api/payments/webhook", { body: { event: "charge.success", data: { reference: "{{paymentReference}}" } }, events: [errorTest(401)], description: "Negative test intentionally omits a valid x-paystack-signature." }),
      request("Admin list payments", "GET", "/api/management/payments?page=1&limit=20", { auth: "adminToken", events: [test(
        "pm.response.to.have.status(200); const body = pm.response.json(); pm.expect(body.success).to.eql(true);",
        "if (body.data.payments[0]) { const payment = body.data.payments[0]; pm.environment.set(\"paymentId\", payment.id); if (payment.refund) pm.environment.set(\"refundId\", payment.refund.id); pm.expect(payment).not.to.have.property(\"accessCode\"); pm.expect(payment.reservation.user).not.to.have.property(\"passwordHash\"); }",
      )] }),
      request("Invalid payment status rejected", "GET", "/api/management/payments?status=NOT_A_STATUS", { auth: "adminToken", events: [errorTest(400)] }),
      request("Admin get payment", "GET", "/api/management/payments/{{paymentId}}", { auth: "adminToken" }),
      request("Initiate full refund [MUTATES + PAYSTACK]", "POST", "/api/management/payments/{{paymentId}}/refund", { auth: "adminToken", body: { reason: "Postman refund verification" }, events: [capture(202, [["refundId", "body.data.id || (body.data.refund && body.data.refund.id)"]], [202])], description: "Requires SUCCESSFUL payment on a CONFIRMED reservation." }),
      request("Sync refund", "POST", "/api/management/payments/refunds/{{refundId}}/sync", { auth: "adminToken" }),
    ] },
    { name: "07 - Staff [SUPER ADMIN + SENDLIB]", item: [
      request("List assignable roles", "GET", "/api/management/staff/roles", { auth: "adminToken" }),
      request("Create staff (captures ID)", "POST", "/api/management/staff", { auth: "adminToken", body: { firstName: "Postman", lastName: "Manager", email: "staff.{{$timestamp}}@example.com", phone: null, password: "StaffPass123!", roles: ["SERVICE_MANAGER"] }, events: [capture(201, [["staffId", "body.data.id"], ["eligibleAssigneeId", "body.data.id"]], [201], "pm.expect(body.data.onboardingEmail.status).to.be.oneOf([\"SENT\", \"FAILED\"]); pm.expect(body.data).not.to.have.property(\"passwordHash\");")], description: "Requires a SUPER_ADMIN token. The response explicitly reports SENT or FAILED for the Sendlib onboarding email." }),
      request("List staff", "GET", "/api/management/staff?page=1&limit=20", { auth: "adminToken" }),
      request("Get staff", "GET", "/api/management/staff/{{staffId}}", { auth: "adminToken" }),
      request("Replace staff roles", "PUT", "/api/management/staff/{{staffId}}/roles", { auth: "adminToken", body: { roles: ["SERVICE_MANAGER", "FRONT_DESK"] } }),
      request("Suspend staff", "PATCH", "/api/management/staff/{{staffId}}/status", { auth: "adminToken", body: { status: "SUSPENDED" } }),
      request("Reactivate staff", "PATCH", "/api/management/staff/{{staffId}}/status", { auth: "adminToken", body: { status: "ACTIVE" } }),
      request("Customer cannot manage staff", "GET", "/api/management/staff", { auth: "customerToken", events: [errorTest(403)] }),
    ] },
    { name: "08 - Email Templates", item: [
      request("List placeholders", "GET", "/api/management/email-templates/placeholders", { auth: "adminToken" }),
      request("Preview customer welcome template contract", "POST", "/api/management/email-templates/{{emailTemplateId}}/preview", { auth: "adminToken", body: { variables: { firstName: "Ada", lastName: "Okafor", email: "ada@example.com", loginUrl: "http://localhost:5173/login", hotelName: "Maison Aurelia" } }, description: "Use an emailTemplateId whose event is CUSTOMER_WELCOME when validating the welcome design." }),
      request("Create template (captures ID)", "POST", "/api/management/email-templates", { auth: "adminToken", body: { event: "RESERVATION_CREATED", name: "Postman {{$timestamp}}", subject: "Reservation {{reservationId}} created", htmlBody: "<p>Hello {{firstName}}, room {{roomNumber}} is reserved.</p>", textBody: "Hello {{firstName}}" }, events: [capture(201, [["emailTemplateId", "body.data.id"]], [201])] }),
      request("List templates", "GET", "/api/management/email-templates?event=RESERVATION_CREATED", { auth: "adminToken" }),
      request("Get template", "GET", "/api/management/email-templates/{{emailTemplateId}}", { auth: "adminToken" }),
      request("Preview template", "POST", "/api/management/email-templates/{{emailTemplateId}}/preview", { auth: "adminToken", body: { variables: { firstName: "Ada", reservationId: "TEST-1", roomNumber: "101" } } }),
      request("Update template", "PATCH", "/api/management/email-templates/{{emailTemplateId}}", { auth: "adminToken", body: { subject: "Updated reservation {{reservationId}}" } }),
      request("Activate template", "POST", "/api/management/email-templates/{{emailTemplateId}}/activate", { auth: "adminToken" }),
      request("Deactivate template", "POST", "/api/management/email-templates/{{emailTemplateId}}/deactivate", { auth: "adminToken" }),
      request("Delete template [CLEANUP]", "DELETE", "/api/management/email-templates/{{emailTemplateId}}", { auth: "adminToken" }),
    ] },
    { name: "09 - Service Requests [CHECKED-IN STAY]", item: [
      request("Create service request (captures ID)", "POST", "/api/service-requests", { auth: "customerToken", body: { reservationId: "{{checkedInReservationId}}", category: "MAINTENANCE", title: "Air conditioner issue", description: "The room is not cooling properly." }, events: [capture(201, [["serviceRequestId", "body.data.id"]], [201])], description: "Requires checkedInReservationId owned by the logged-in customer." }),
      request("My service requests", "GET", "/api/service-requests/me", { auth: "customerToken" }),
      request("Get service request", "GET", "/api/service-requests/{{serviceRequestId}}", { auth: "customerToken" }),
      request("Add customer comment", "POST", "/api/service-requests/{{serviceRequestId}}/comments", { auth: "customerToken", body: { content: "Please send someone when available.", isInternal: false } }),
      request("Customer internal comment forbidden", "POST", "/api/service-requests/{{serviceRequestId}}/comments", { auth: "customerToken", body: { content: "Hidden note", isInternal: true }, events: [errorTest(403)] }),
      request("Staff list requests", "GET", "/api/service-requests?status=OPEN", { auth: "adminToken" }),
      request("List eligible service assignees", "GET", "/api/service-requests/assignees", { auth: "adminToken", events: [test(
        "pm.response.to.have.status(200); const body = pm.response.json(); pm.expect(body.success).to.eql(true);",
        "pm.expect(body.data).to.be.an(\"array\"); if (body.data[0]) { pm.environment.set(\"eligibleAssigneeId\", body.data[0].id); pm.expect(body.data[0]).not.to.have.property(\"email\"); }",
      )] }),
      request("Assign request", "PATCH", "/api/service-requests/{{serviceRequestId}}/assign", { auth: "adminToken", body: { assignedToId: "{{eligibleAssigneeId}}" } }),
      request("Set priority", "PATCH", "/api/service-requests/{{serviceRequestId}}/priority", { auth: "adminToken", body: { priority: "URGENT" } }),
      request("Start work", "PATCH", "/api/service-requests/{{serviceRequestId}}/status", { auth: "adminToken", body: { status: "IN_PROGRESS" } }),
      request("Resolve request", "PATCH", "/api/service-requests/{{serviceRequestId}}/status", { auth: "adminToken", body: { status: "RESOLVED" } }),
      request("Close request", "PATCH", "/api/service-requests/{{serviceRequestId}}/status", { auth: "adminToken", body: { status: "CLOSED" } }),
      request("Cancel own open request [ALTERNATIVE FLOW]", "PATCH", "/api/service-requests/{{serviceRequestId}}/cancel", { auth: "customerToken", description: "Run instead of assignment/status progression, not after closing." }),
    ] },
    { name: "10 - Management", item: [
      request("Management dashboard", "GET", "/api/management/dashboard?date={{dashboardDate}}&upcomingDays=7", { auth: "adminToken" }),
      request("Customer dashboard access forbidden", "GET", "/api/management/dashboard", { auth: "customerToken", events: [errorTest(403)] }),
    ] },
    { name: "11 - Hotel AI Customer", item: [
      request("Start AI conversation (captures conversation/action)", "POST", "/api/ai/chat", { auth: "customerToken", body: { message: "Find a STANDARD room for 2 guests from {{checkIn}} to {{checkOut}}.", clientMessageId: "{{$guid}}" }, events: [test(
        "pm.expect([200, 202, 429, 503]).to.include(pm.response.code); const body = pm.response.json();",
        "if (body.success && body.data.conversationId) pm.environment.set(\"aiConversationId\", body.data.conversationId);",
        "if (body.success && body.data.pendingAction) pm.environment.set(\"aiActionId\", body.data.pendingAction.id);",
      )] }),
      request("Continue AI booking conversation", "POST", "/api/ai/chat", { auth: "customerToken", body: { message: "Book room 201 for me using the dates and guest count already provided.", conversationId: "{{aiConversationId}}", clientMessageId: "{{$guid}}" }, events: [test(
        "pm.expect([200, 202, 429, 503]).to.include(pm.response.code); const body = pm.response.json();",
        "if (body.success && body.data.pendingAction) pm.environment.set(\"aiActionId\", body.data.pendingAction.id);",
      )] }),
      request("Confirm protected AI action [MUTATES]", "POST", "/api/ai/actions/{{aiActionId}}/confirm", { auth: "customerToken", description: "Only run after inspecting the proposed action and confirming its arguments are correct." }),
      request("Cancel protected AI action [ALTERNATIVE]", "DELETE", "/api/ai/actions/{{aiActionId}}", { auth: "customerToken", description: "Alternative to confirmation; do not run both against the same action." }),
      request("List my AI conversations", "GET", "/api/ai/conversations?status=ACTIVE&limit=20", { auth: "customerToken" }),
      request("Get AI conversation", "GET", "/api/ai/conversations/{{aiConversationId}}", { auth: "customerToken", events: [test(
        "pm.response.to.have.status(200); const body = pm.response.json(); pm.expect(body.success).to.eql(true);",
        "pm.test(\"Conversation restores pending actions for confirmation UI\", () => pm.expect(body.data.pendingActions).to.be.an(\"array\"));",
      )] }),
      request("Archive AI conversation [RUN LAST]", "PATCH", "/api/ai/conversations/{{aiConversationId}}/archive", { auth: "customerToken" }),
      request("AI message requires clientMessageId", "POST", "/api/ai/chat", { auth: "customerToken", body: { message: "Hello" }, events: [errorTest(400)] }),
    ] },
    { name: "12 - Hotel AI Admin Observability", item: [
      request("AI metrics", "GET", "/api/ai/admin/metrics?days=7", { auth: "adminToken", events: [test(
        "pm.response.to.have.status(200); const body = pm.response.json(); pm.expect(body.success).to.eql(true);",
        "pm.test(\"Metrics contain no raw prompts\", () => pm.expect(JSON.stringify(body.data)).not.to.include(\"Find a STANDARD room\"));",
        "pm.test(\"Totals are present\", () => pm.expect(body.data.totals).to.have.property(\"runs\"));",
      )] }),
      request("AI run list", "GET", "/api/ai/admin/runs?limit=20", { auth: "adminToken" }),
      request("Failed AI runs", "GET", "/api/ai/admin/runs?limit=20&status=FAILED", { auth: "adminToken" }),
      request("Invalid metrics period", "GET", "/api/ai/admin/metrics?days=0", { auth: "adminToken", events: [errorTest(400)] }),
      request("Customer cannot view AI metrics", "GET", "/api/ai/admin/metrics?days=7", { auth: "customerToken", events: [errorTest(403)] }),
    ] },
    { name: "13 - AI Rate Limit [RESTART SERVER, RUN FOLDER]", description: "Restart the API to clear the in-memory limiter, then run this folder. The first five invalid calls should be 400 and the sixth 429.", item: Array.from({ length: 6 }, (_, index) => request(
      `Rate-limit call ${index + 1} (${index === 5 ? "expect 429" : "expect 400"})`,
      "POST",
      "/api/ai/chat",
      { auth: "customerToken", body: { message: "", clientMessageId: `rate-limit-${index + 1}-{{$guid}}` }, events: [errorTest(index === 5 ? 429 : 400)] },
    )) },
  ],
};

// Postman raw JSON must inject the previously captured array rather than quote it.
for (const folder of collection.item) {
  for (const item of folder.item) {
    if (item.request.body?.raw) {
      item.request.body.raw = item.request.body.raw.replace('"__POSTMAN_RAW_ARRAY__"', "{{imageIdsJson}}");
    }
  }
}

const environment = {
  id: "59bec256-f990-47ab-9080-hotelailocal",
  name: "Hotel AI - Local",
  values: [
    ["baseUrl", "http://localhost:6000", true],
    ["customerEmail", "", true], ["customerPassword", "PostmanPass123!", true],
    ["customerToken", "", true], ["customerRefreshToken", "", true], ["customerId", "", true],
    ["adminEmail", "", true], ["adminPassword", "", true], ["adminToken", "", true], ["adminRefreshToken", "", true], ["adminId", "", true],
    ["checkIn", "2030-10-10", true], ["checkOut", "2030-10-12", true], ["guests", "2", true], ["dashboardDate", "2030-10-10", true],
    ["roomTypeId", "", true], ["standardRoomTypeId", "", true], ["executiveRoomTypeId", "", true], ["suiteRoomTypeId", "", true],
    ["roomId", "", true], ["room201Id", "", true], ["availableRoomId", "", true], ["createdRoomId", "", true],
    ["roomImagePath", "C:\\path\\to\\hotel-room.jpg", true], ["imageId", "", true], ["imageIdsJson", "[]", true],
    ["reservationId", "", true], ["checkedInReservationId", "", true],
    ["paymentId", "", true], ["paymentReference", "", true], ["authorizationUrl", "", true], ["refundId", "", true],
    ["staffId", "", true], ["eligibleAssigneeId", "", true], ["emailTemplateId", "", true], ["serviceRequestId", "", true],
    ["aiConversationId", "", true], ["aiActionId", "", true], ["googleCredential", "", true],
  ].map(([key, value, enabled]) => ({ key, value, enabled, type: key.toLowerCase().includes("password") || key.toLowerCase().includes("token") || key === "googleCredential" ? "secret" : "default" })),
  _postman_variable_scope: "environment",
  _postman_exported_at: new Date().toISOString(),
  _postman_exported_using: "Hotel AI generator",
};

await mkdir("postman", { recursive: true });
await writeFile("postman/Hotel-AI.postman_collection.json", `${JSON.stringify(collection, null, 2)}\n`);
await writeFile("postman/Hotel-AI-Local.postman_environment.json", `${JSON.stringify(environment, null, 2)}\n`);
console.log(`Generated ${collection.item.reduce((total, folder) => total + folder.item.length, 0)} Postman requests.`);
