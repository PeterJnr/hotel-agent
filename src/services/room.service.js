import { prisma } from "../lib/prisma.js";

const roomStatuses = new Set([
  "AVAILABLE",
  "OCCUPIED",
  "MAINTENANCE",
  "OUT_OF_SERVICE",
]);

function validateRoomStatus(status) {
  if (!roomStatuses.has(status)) {
    throw new Error(
      "Status must be AVAILABLE, OCCUPIED, MAINTENANCE, or OUT_OF_SERVICE.",
    );
  }
}

export async function createRoom({ roomNumber, roomTypeId, status }) {
  if (typeof roomNumber !== "string" || !roomNumber.trim()) {
    throw new Error("Room number is required.");
  }

  if (!roomTypeId) {
    throw new Error("Room type is required.");
  }

  const normalizedRoomNumber = roomNumber.trim();

  if (status !== undefined) {
    validateRoomStatus(status);
    if (status === "OCCUPIED") {
      throw new Error("New rooms cannot be created as occupied. Use reservation check-in.");
    }
  }

  const roomType = await prisma.roomType.findUnique({
    where: {
      id: roomTypeId,
    },
  });

  if (!roomType) {
    throw new Error("Room type not found.");
  }

  const existingRoom = await prisma.room.findUnique({
    where: {
      roomNumber: normalizedRoomNumber,
    },
  });

  if (existingRoom) {
    throw new Error("Room number already exists.");
  }

  return prisma.room.create({
    data: {
      roomNumber: normalizedRoomNumber,
      roomTypeId,
      ...(status && { status }),
    },
    include: {
      roomType: true,
    },
  });
}

export async function getAllRooms() {
  return prisma.room.findMany({
    include: {
      roomType: true,
    },
    orderBy: {
      roomNumber: "asc",
    },
  });
}

export async function getRoomById(roomId) {
  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
    include: {
      roomType: true,
    },
  });

  if (!room) {
    throw new Error("Room not found.");
  }

  return room;
}

export async function updateRoomById(
  roomId,
  { roomNumber, roomTypeId, status },
) {
  if (
    roomNumber === undefined &&
    roomTypeId === undefined &&
    status === undefined
  ) {
    throw new Error("At least one room field must be provided.");
  }

  let normalizedRoomNumber;

  if (roomNumber !== undefined) {
    if (typeof roomNumber !== "string" || !roomNumber.trim()) {
      throw new Error("Room number must be a non-empty string.");
    }

    normalizedRoomNumber = roomNumber.trim();
  }

  if (status !== undefined) {
    validateRoomStatus(status);
  }

  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
  });

  if (!room) {
    throw new Error("Room not found.");
  }

  if (room.status === "OCCUPIED") {
    throw new Error("Occupied rooms must be checked out before they can be edited.");
  }

  if (status === "OCCUPIED") {
    throw new Error("Rooms become occupied through reservation check-in only.");
  }

  if (
    normalizedRoomNumber !== undefined &&
    normalizedRoomNumber !== room.roomNumber
  ) {
    const existingRoom = await prisma.room.findUnique({
      where: {
        roomNumber: normalizedRoomNumber,
      },
    });

    if (existingRoom) {
      throw new Error("Room number already exists.");
    }
  }

  if (roomTypeId) {
    const roomType = await prisma.roomType.findUnique({
      where: {
        id: roomTypeId,
      },
    });

    if (!roomType) {
      throw new Error("Room type not found.");
    }
  }

  return prisma.room.update({
    where: {
      id: roomId,
    },
    data: {
      ...(normalizedRoomNumber !== undefined && {
        roomNumber: normalizedRoomNumber,
      }),
      ...(roomTypeId !== undefined && { roomTypeId }),
      ...(status !== undefined && { status }),
    },
    include: {
      roomType: true,
    },
  });
}

export async function deleteRoomById(roomId) {
  const room = await prisma.room.findUnique({
    where: {
      id: roomId,
    },
  });

  if (!room) {
    throw new Error("Room not found.");
  }

  const reservationCount = await prisma.reservation.count({
    where: {
      roomId,
    },
  });

  if (reservationCount > 0) {
    const error = new Error(
      "Room cannot be deleted because it has reservation history.",
    );
    error.statusCode = 409;
    throw error;
  }

  return prisma.room.delete({
    where: {
      id: roomId,
    },
  });
}
