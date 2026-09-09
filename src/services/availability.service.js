import { prisma } from "../lib/prisma.js";

export async function checkAvailability({
  roomType,
  checkIn,
  checkOut,
  guests,
}) {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  if (
    Number.isNaN(checkInDate.getTime()) ||
    Number.isNaN(checkOutDate.getTime())
  ) {
    throw new Error("Invalid check-in or check-out date.");
  }

  if (checkOutDate <= checkInDate) {
    throw new Error("Check-out must be after check-in.");
  }

  if (!Number.isInteger(guests) || guests < 1) {
    throw new Error("Guests must be a positive whole number.");
  }

  const type = await prisma.roomType.findUnique({
    where: { name: roomType },
  });

  if (!type) {
    throw new Error("Room type not found.");
  }

  if (guests > type.capacity) {
    throw new Error(
      `${type.name} rooms accommodate a maximum of ${type.capacity} guests.`,
    );
  }

  const rooms = await prisma.room.findMany({
    where: {
      roomTypeId: type.id,
      status: "AVAILABLE",
      reservations: {
        none: {
          status: {
            in: ["PENDING", "PAYMENT_PENDING", "CONFIRMED", "CHECKED_IN"],
          },
          checkIn: {
            lt: checkOutDate,
          },
          checkOut: {
            gt: checkInDate,
          },
        },
      },
    },
    include: {
      roomType: true,
    },
  });

  return rooms;
}
