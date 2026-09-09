import { checkAvailability } from "../services/availability.service.js";
import { initializeReservationPayment } from "../services/payment.service.js";
import {
  cancelReservations,
  createReservation,
  getCustomerReservations,
} from "../services/reservation.service.js";
import { getRoomTypes } from "../services/roomType.service.js";
import {
  addServiceRequestComment,
  createServiceRequest,
  getMyServiceRequests,
} from "../services/serviceRequest.service.js";
import { getAiToolDefinition } from "./toolRegistry.js";

const fail = (message, code, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode });

function validateValue(name, value, rule) {
  if (rule.type === "string") {
    if (typeof value !== "string" || !value.trim()) throw fail(`${name} must be a non-empty string.`, "INVALID_TOOL_ARGUMENTS");
    if (rule.maxLength && value.trim().length > rule.maxLength) throw fail(`${name} must not exceed ${rule.maxLength} characters.`, "INVALID_TOOL_ARGUMENTS");
    if (rule.enum && !rule.enum.includes(value)) throw fail(`${name} must be one of: ${rule.enum.join(", ")}.`, "INVALID_TOOL_ARGUMENTS");
    if (rule.format === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw fail(`${name} must use YYYY-MM-DD format.`, "INVALID_TOOL_ARGUMENTS");
  }
  if (rule.type === "integer" && (!Number.isInteger(value) || value < (rule.minimum ?? -Infinity))) throw fail(`${name} must be a valid integer.`, "INVALID_TOOL_ARGUMENTS");
  if (rule.type === "number" && (typeof value !== "number" || !Number.isFinite(value) || value <= (rule.exclusiveMinimum ?? -Infinity))) throw fail(`${name} must be a valid number.`, "INVALID_TOOL_ARGUMENTS");
}

export function validateAiToolRequest({ name, arguments: input = {}, context = {} }) {
  const definition = getAiToolDefinition(name);
  if (!definition) throw fail(`Unknown AI tool: ${name}.`, "UNKNOWN_AI_TOOL", 404);
  if (!context.userId || typeof context.userId !== "string") throw fail("An authenticated user is required.", "AI_AUTH_REQUIRED", 401);
  if (!input || typeof input !== "object" || Array.isArray(input)) throw fail("Tool arguments must be an object.", "INVALID_TOOL_ARGUMENTS");

  const { properties, required = [] } = definition.inputSchema;
  for (const field of required) if (input[field] === undefined) throw fail(`${field} is required.`, "INVALID_TOOL_ARGUMENTS");
  for (const [field, value] of Object.entries(input)) {
    if (!properties[field]) throw fail(`Unexpected tool argument: ${field}.`, "INVALID_TOOL_ARGUMENTS");
    validateValue(field, value, properties[field]);
  }
  if ((input.checkIn && !input.checkOut) || (input.checkOut && !input.checkIn)) throw fail("checkIn and checkOut must be supplied together.", "INVALID_TOOL_ARGUMENTS");
  return { definition, input, userId: context.userId, userRoles: Array.isArray(context.roles) ? context.roles : [] };
}

export function prepareAiToolCall(call) {
  const prepared = validateAiToolRequest(call);
  if (prepared.definition.confirmationRequired && call.context?.confirmed !== true) throw fail("Explicit user confirmation is required before this action can run.", "AI_CONFIRMATION_REQUIRED", 409);
  return prepared;
}

const handlers = {
  search_room_availability: ({ input }) => checkAvailability(input),
  async recommend_room_types({ input }) {
    const types = (await getRoomTypes()).filter((type) =>
      type.capacity >= input.guests &&
      (input.maxPricePerNight === undefined || Number(type.pricePerNight) <= input.maxPricePerNight));
    if (!input.checkIn) return types.map((roomType) => ({ roomType, availableRoomCount: null }));
    const results = await Promise.all(types.map(async (roomType) => {
      const rooms = await checkAvailability({ roomType: roomType.name, checkIn: input.checkIn, checkOut: input.checkOut, guests: input.guests });
      return { roomType, availableRoomCount: rooms.length, rooms };
    }));
    return results.filter((result) => result.availableRoomCount > 0);
  },
  create_reservation: ({ input, userId }) => createReservation({ ...input, userId }),
  get_my_bookings: ({ userId }) => getCustomerReservations(userId),
  cancel_pending_reservation: ({ input, userId }) => cancelReservations({ reservationId: input.reservationId, userId }),
  initialize_payment: ({ input, userId }) => initializeReservationPayment({ reservationId: input.reservationId, userId }),
  get_service_requests: ({ userId }) => getMyServiceRequests(userId),
  create_service_request: ({ input, userId }) => createServiceRequest({ ...input, userId }),
  add_service_request_comment: ({ input, userId, userRoles }) => addServiceRequestComment({ id: input.serviceRequestId, authorId: userId, userRoles, content: input.content, isInternal: false }),
};

export async function executeAiTool(call) {
  const prepared = prepareAiToolCall(call);
  const data = await handlers[prepared.definition.name](prepared);
  return { tool: prepared.definition.name, success: true, data };
}
