import { prisma } from "../lib/prisma.js";
import {
  notifyCheckedIn,
  notifyCheckedOut,
  notifyReservationCancelled,
  notifyReservationCreated,
} from "./emailNotification.service.js";

const reservationStatuses = new Set([
  "PENDING",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "PAYMENT_FAILED",
  "CANCELLATION_PENDING",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
]);

const operationalReservationInclude = {
  user: {
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  },
  room: { include: { roomType: true } },
  payments: {
    select: {
      id: true,
      reference: true,
      amount: true,
      currency: true,
      status: true,
      failureReason: true,
      paidAt: true,
      createdAt: true,
      refund: {
        select: { id: true, amount: true, currency: true, status: true, reason: true, expectedAt: true, refundedAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  },
};

export async function createReservation({
  userId,
  roomId,
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

  const maxTransactionAttempts = 3;

  for (let attempt = 1; attempt <= maxTransactionAttempts; attempt += 1) {
    try {
      const reservation = await prisma.$transaction(
        async (tx) => {
          const room = await tx.room.findUnique({
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

          if (room.status !== "AVAILABLE") {
            throw new Error("Room is not available.");
          }

          if (guests > room.roomType.capacity) {
            throw new Error(
              `${room.roomType.name} rooms accommodate a maximum of ${room.roomType.capacity} guests.`,
            );
          }

          const conflictingReservation = await tx.reservation.findFirst({
            where: {
              roomId,
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
          });

          if (conflictingReservation) {
            throw new Error("Room is already reserved for the selected dates.");
          }

          const millisecondsPerDay = 1000 * 60 * 60 * 24;
          const nights = Math.ceil(
            (checkOutDate - checkInDate) / millisecondsPerDay,
          );
          const totalAmount = Number(room.roomType.pricePerNight) * nights;

          return tx.reservation.create({
            data: {
              userId,
              roomId,
              checkIn: checkInDate,
              checkOut: checkOutDate,
              guests,
              status: "PENDING",
              totalAmount,
            },
            include: {
              room: {
                include: {
                  roomType: true,
                },
              },
            },
          });
        },
        {
          isolationLevel: "Serializable",
        },
      );

      await notifyReservationCreated(reservation.id);
      return reservation;
    } catch (error) {
      const shouldRetry =
        error.code === "P2034" && attempt < maxTransactionAttempts;

      if (!shouldRetry) {
        throw error;
      }
    }
  }
}

export async function cancelReservations({ reservationId, userId }) {
  const reservation = await prisma.reservation.findUnique({
    where: {
      id: reservationId,
    },
  });

  if (!reservation) {
    throw new Error("Reservation not found.");
  }

  if (reservation.userId !== userId) {
    throw new Error("You are not allowed to cancel this reservation.");
  }

  if (reservation.status !== "PENDING") {
    throw new Error(
      `Reservation cannot be cancelled from ${reservation.status} status. Payment or refund handling is required.`,
    );
  }

  const cancelledReservation = await prisma.reservation.update({
    where: {
      id: reservationId,
    },
    data: {
      status: "CANCELLED",
    },
  });

  await notifyReservationCancelled(cancelledReservation.id);
  return cancelledReservation;
}

export async function getCustomerReservations(userId) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new Error("Customer not found.");
  }

  const reservations = await prisma.reservation.findMany({
    where: { userId },
    include: { room: { include: { roomType: true } } },
    orderBy: { checkIn: "desc" },
  });
  return reservations;
}

export async function getReservationById({
  reservationId,
  userId,
  userRoles = [],
}) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: operationalReservationInclude,
  });
  if (!reservation) {
    throw new Error("Reservation not found.");
  }

  const staffRoles = new Set([
    "SUPER_ADMIN",
    "ADMIN",
    "FRONT_DESK",
    "RESERVATION_MANAGER",
    "ACCOUNTANT",
  ]);
  const isStaff = userRoles.some((role) => staffRoles.has(role));

  if (reservation.userId !== userId && !isStaff) {
    const error = new Error("You are not allowed to view this reservation.");
    error.statusCode = 403;
    throw error;
  }

  return reservation;
}

export async function updateReservationStatus({ reservationId, status }) {
  if (status !== "CHECKED_IN" && status !== "CHECKED_OUT") {
    throw new Error(
      "Operational status must be CHECKED_IN or CHECKED_OUT.",
    );
  }

  const reservation = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: { room: true },
    });

    if (!reservation) {
      throw new Error("Reservation not found.");
    }

    if (status === "CHECKED_IN") {
      if (reservation.status !== "CONFIRMED") {
        throw new Error("Only confirmed reservations can be checked in.");
      }

      const now = new Date();

      if (now < reservation.checkIn) {
        throw new Error("Reservation cannot be checked in before check-in date.");
      }

      if (now >= reservation.checkOut) {
        throw new Error("Reservation cannot be checked in after check-out date.");
      }

      if (reservation.room.status !== "AVAILABLE") {
        throw new Error("Room is not available for check-in.");
      }

      const reservationUpdate = await tx.reservation.updateMany({
        where: { id: reservationId, status: "CONFIRMED" },
        data: { status: "CHECKED_IN" },
      });
      const roomUpdate = await tx.room.updateMany({
        where: { id: reservation.roomId, status: "AVAILABLE" },
        data: { status: "OCCUPIED" },
      });

      if (reservationUpdate.count !== 1 || roomUpdate.count !== 1) {
        throw new Error("Reservation or room status changed during check-in.");
      }
    } else {
      if (reservation.status !== "CHECKED_IN") {
        throw new Error("Only checked-in reservations can be checked out.");
      }

      const reservationUpdate = await tx.reservation.updateMany({
        where: { id: reservationId, status: "CHECKED_IN" },
        data: { status: "CHECKED_OUT" },
      });
      const roomUpdate = await tx.room.updateMany({
        where: { id: reservation.roomId, status: "OCCUPIED" },
        data: { status: "AVAILABLE" },
      });

      if (reservationUpdate.count !== 1 || roomUpdate.count !== 1) {
        throw new Error("Reservation or room status changed during check-out.");
      }
    }

    return tx.reservation.findUnique({
      where: { id: reservationId },
      include: operationalReservationInclude,
    });
  });

  if (status === "CHECKED_IN") {
    await notifyCheckedIn(reservation.id);
  } else {
    await notifyCheckedOut(reservation.id);
  }

  return reservation;
}

export async function getAllReservations({
  status,
  roomId,
  roomTypeId,
  checkIn,
  checkOut,
}) {
  const where = {};
  let checkInDate;
  let checkOutDate;

  if (status) {
    if (!reservationStatuses.has(status)) {
      throw new Error("Invalid reservation status.");
    }

    where.status = status;
  }
  if (roomId) {
    where.roomId = roomId;
  }
  if (roomTypeId) {
    where.room = { roomTypeId };
  }
  if (checkIn) {
    checkInDate = new Date(checkIn);

    if (Number.isNaN(checkInDate.getTime())) {
      throw new Error("Invalid check-in filter date.");
    }

    where.checkIn = { gte: checkInDate };
  }
  if (checkOut) {
    checkOutDate = new Date(checkOut);

    if (Number.isNaN(checkOutDate.getTime())) {
      throw new Error("Invalid check-out filter date.");
    }

    where.checkOut = { lte: checkOutDate };
  }

  if (checkInDate && checkOutDate && checkOutDate <= checkInDate) {
    throw new Error("Check-out filter must be after check-in filter.");
  }

  return prisma.reservation.findMany({
    where,
    include: operationalReservationInclude,
    orderBy: { checkIn: "desc" },
  });
}
