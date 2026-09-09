import { prisma } from "../lib/prisma.js";

export async function getRoomTypes() {
  return prisma.roomType.findMany({
    orderBy: {
      name: "asc",
    },
  });
}

export async function getRoomTypeById(roomTypeId) {
  const roomType = await prisma.roomType.findUnique({
    where: {
      id: roomTypeId,
    },
  });

  if (!roomType) {
    throw new Error("Room type not found.");
  }

  return roomType;
}

export async function updateRoomType({
  roomTypeId,
  description,
  capacity,
  pricePerNight,
}) {
  const existingRoomType = await prisma.roomType.findUnique({
    where: {
      id: roomTypeId,
    },
  });

  if (!existingRoomType) {
    throw new Error("Room type not found.");
  }

  const data = {};

  if (description !== undefined) {
    if (typeof description !== "string") {
      throw new Error("Description must be a string.");
    }

    data.description = description;
  }

  if (capacity !== undefined) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("Capacity must be a positive whole number.");
    }

    data.capacity = capacity;
  }

  if (pricePerNight !== undefined) {
    const price = String(pricePerNight).trim();

    if (!/^\d{1,10}(\.\d{1,2})?$/.test(price) || Number(price) <= 0) {
      throw new Error(
        "Price per night must be positive and have no more than two decimal places.",
      );
    }

    data.pricePerNight = price;
  }

  if (Object.keys(data).length === 0) {
    throw new Error("No valid fields were provided for update.");
  }

  return prisma.roomType.update({
    where: {
      id: roomTypeId,
    },
    data,
  });
}
