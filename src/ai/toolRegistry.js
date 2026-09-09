const string = (description, options = {}) => ({
  type: "string",
  description,
  ...options,
});

const date = (description) => string(description, { format: "date" });

const definitions = [
  {
    name: "search_room_availability",
    description: "Find available rooms of a specified room type for exact dates and guest count.",
    confirmationRequired: false,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["roomType", "checkIn", "checkOut", "guests"],
      properties: {
        roomType: string("Exact room type name."),
        checkIn: date("Check-in date in YYYY-MM-DD format."),
        checkOut: date("Check-out date in YYYY-MM-DD format."),
        guests: { type: "integer", minimum: 1, description: "Number of guests." },
      },
    },
  },
  {
    name: "recommend_room_types",
    description: "Recommend room types by capacity and optional nightly budget, optionally checking exact dates.",
    confirmationRequired: false,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["guests"],
      properties: {
        guests: { type: "integer", minimum: 1, description: "Number of guests." },
        maxPricePerNight: { type: "number", exclusiveMinimum: 0, description: "Optional maximum nightly price in NGN." },
        checkIn: date("Optional check-in date; must be supplied with checkOut."),
        checkOut: date("Optional check-out date; must be supplied with checkIn."),
      },
    },
  },
  {
    name: "create_reservation",
    description: "Create a pending reservation for the authenticated customer after explicit confirmation.",
    confirmationRequired: true,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["roomId", "checkIn", "checkOut", "guests"],
      properties: {
        roomId: string("ID of an available room."),
        checkIn: date("Check-in date in YYYY-MM-DD format."),
        checkOut: date("Check-out date in YYYY-MM-DD format."),
        guests: { type: "integer", minimum: 1, description: "Number of guests." },
      },
    },
  },
  {
    name: "get_my_bookings",
    description: "List reservations belonging to the authenticated customer.",
    confirmationRequired: false,
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "cancel_pending_reservation",
    description: "Cancel the authenticated customer's pending reservation after explicit confirmation.",
    confirmationRequired: true,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["reservationId"],
      properties: { reservationId: string("Reservation ID to cancel.") },
    },
  },
  {
    name: "initialize_payment",
    description: "Initialize Paystack payment for the authenticated customer's reservation after explicit confirmation.",
    confirmationRequired: true,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["reservationId"],
      properties: { reservationId: string("Reservation ID to pay for.") },
    },
  },
  {
    name: "get_service_requests",
    description: "List service requests belonging to the authenticated customer.",
    confirmationRequired: false,
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "create_service_request",
    description: "Create a request or complaint for the authenticated customer's checked-in reservation after explicit confirmation.",
    confirmationRequired: true,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["reservationId", "category", "title", "description"],
      properties: {
        reservationId: string("Checked-in reservation ID."),
        category: string("Request category.", { enum: ["HOUSEKEEPING", "MAINTENANCE", "ROOM_SERVICE", "COMPLAINT", "OTHER"] }),
        title: string("Short request title.", { maxLength: 120 }),
        description: string("Detailed request description.", { maxLength: 2000 }),
      },
    },
  },
  {
    name: "add_service_request_comment",
    description: "Add a public customer comment to an owned service request after explicit confirmation.",
    confirmationRequired: true,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["serviceRequestId", "content"],
      properties: {
        serviceRequestId: string("Service request ID."),
        content: string("Comment content.", { maxLength: 2000 }),
      },
    },
  },
];

export const aiToolDefinitions = Object.freeze(definitions.map((definition) => Object.freeze(definition)));

export function getAiToolDefinition(name) {
  return aiToolDefinitions.find((definition) => definition.name === name);
}
