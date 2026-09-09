import { prisma } from "../lib/prisma.js";

const reservationStatuses = [
  "PENDING",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "PAYMENT_FAILED",
  "CANCELLATION_PENDING",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
];

const roomStatuses = [
  "AVAILABLE",
  "OCCUPIED",
  "MAINTENANCE",
  "OUT_OF_SERVICE",
];

function managementError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function getLagosDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getDateWindow(date, upcomingDays) {
  const dateString = date || getLagosDateString();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw managementError("Date must use YYYY-MM-DD format.");
  }

  const start = new Date(`${dateString}T00:00:00+01:00`);

  if (Number.isNaN(start.getTime())) {
    throw managementError("Invalid dashboard date.");
  }

  const normalizedDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(start);

  if (normalizedDate !== dateString) {
    throw managementError("Invalid dashboard date.");
  }

  const days = upcomingDays === undefined ? 7 : Number(upcomingDays);

  if (!Number.isInteger(days) || days < 1 || days > 30) {
    throw managementError("upcomingDays must be a whole number from 1 to 30.");
  }

  const dayEnd = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const upcomingEnd = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);

  return { dateString, days, start, dayEnd, upcomingEnd };
}

function countsByStatus(groups, statuses) {
  const counts = Object.fromEntries(statuses.map((status) => [status, 0]));

  for (const group of groups) {
    counts[group.status] = group._count._all;
  }

  return counts;
}

const bookingInclude = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  },
  room: {
    include: {
      roomType: true,
    },
  },
};

export async function getManagementDashboard({ date, upcomingDays }) {
  const { dateString, days, start, dayEnd, upcomingEnd } = getDateWindow(
    date,
    upcomingDays,
  );

  const [
    roomGroups,
    reservationGroups,
    successfulPayments,
    successfulPaymentsToday,
    arrivalsToday,
    departuresToday,
    upcomingArrivals,
    upcomingDepartures,
    refundRequired,
    failedReservations,
    serviceRequestGroups,
    urgentServiceRequests,
  ] = await prisma.$transaction([
    prisma.room.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.reservation.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: { status: "SUCCESSFUL" },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        status: "SUCCESSFUL",
        paidAt: { gte: start, lt: dayEnd },
      },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.reservation.findMany({
      where: {
        status: "CONFIRMED",
        checkIn: { gte: start, lt: dayEnd },
      },
      include: bookingInclude,
      orderBy: { checkIn: "asc" },
    }),
    prisma.reservation.findMany({
      where: {
        status: "CHECKED_IN",
        checkOut: { gte: start, lt: dayEnd },
      },
      include: bookingInclude,
      orderBy: { checkOut: "asc" },
    }),
    prisma.reservation.findMany({
      where: {
        status: "CONFIRMED",
        checkIn: { gte: dayEnd, lt: upcomingEnd },
      },
      include: bookingInclude,
      orderBy: { checkIn: "asc" },
      take: 20,
    }),
    prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        checkOut: { gte: dayEnd, lt: upcomingEnd },
      },
      include: bookingInclude,
      orderBy: { checkOut: "asc" },
      take: 20,
    }),
    prisma.payment.findMany({
      where: { status: "REFUND_REQUIRED" },
      include: { reservation: { include: bookingInclude } },
      orderBy: { updatedAt: "asc" },
      take: 20,
    }),
    prisma.reservation.findMany({
      where: { status: "PAYMENT_FAILED" },
      include: bookingInclude,
      orderBy: { updatedAt: "asc" },
      take: 20,
    }),
    prisma.serviceRequest.groupBy({ by:["status"], _count:{_all:true} }),
    prisma.serviceRequest.findMany({
      where:{priority:"URGENT",status:{in:["OPEN","ASSIGNED","IN_PROGRESS"]}},
      include:{user:{select:{id:true,firstName:true,lastName:true,email:true,phone:true}},room:true,assignedTo:{select:{id:true,firstName:true,lastName:true}}},
      orderBy:{createdAt:"asc"},take:20,
    }),
  ]);

  const rooms = countsByStatus(roomGroups, roomStatuses);
  const bookings = countsByStatus(reservationGroups, reservationStatuses);
  const operationalRooms = rooms.AVAILABLE + rooms.OCCUPIED;
  const serviceRequests = countsByStatus(serviceRequestGroups, ["OPEN","ASSIGNED","IN_PROGRESS","RESOLVED","CLOSED","CANCELLED"]);

  return {
    asOf: dateString,
    upcomingDays: days,
    rooms: {
      total: Object.values(rooms).reduce((total, count) => total + count, 0),
      byStatus: rooms,
      operational: operationalRooms,
      occupancyRate:
        operationalRooms === 0
          ? 0
          : Number(((rooms.OCCUPIED / operationalRooms) * 100).toFixed(2)),
    },
    bookings: {
      total: Object.values(bookings).reduce(
        (total, count) => total + count,
        0,
      ),
      byStatus: bookings,
    },
    revenue: {
      currency: "NGN",
      allTime: {
        successfulPayments: successfulPayments._count._all,
        amount: successfulPayments._sum.amount || 0,
      },
      today: {
        successfulPayments: successfulPaymentsToday._count._all,
        amount: successfulPaymentsToday._sum.amount || 0,
      },
    },
    today: {
      arrivals: arrivalsToday,
      departures: departuresToday,
    },
    upcoming: {
      arrivals: upcomingArrivals,
      departures: upcomingDepartures,
    },
    attention: {
      refundRequired,
      failedReservations,
      unavailableRooms: rooms.MAINTENANCE + rooms.OUT_OF_SERVICE,
      urgentServiceRequests,
    },
    serviceRequests: {
      total:Object.values(serviceRequests).reduce((total,count)=>total+count,0),
      byStatus:serviceRequests,
      active:serviceRequests.OPEN+serviceRequests.ASSIGNED+serviceRequests.IN_PROGRESS,
    },
  };
}
