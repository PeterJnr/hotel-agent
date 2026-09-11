import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

const roles = [
  { name: "CUSTOMER", description: "Regular hotel customer" },
  { name: "SUPER_ADMIN", description: "Full system access" },
  { name: "ADMIN", description: "General hotel administration access" },
  {
    name: "FRONT_DESK",
    description: "Manages front desk and guest operations",
  },
  {
    name: "RESERVATION_MANAGER",
    description: "Manages reservations and bookings",
  },
  { name: "ACCOUNTANT", description: "Manages payments and financial records" },
  {
    name: "SERVICE_MANAGER",
    description: "Manages guest service requests and complaints",
  },
];

const roomTypes = [
  {
    name: "STANDARD",
    description: "Standard hotel room",
    capacity: 2,
    pricePerNight: 2000,
  },
  {
    name: "EXECUTIVE",
    description: "Executive hotel room",
    capacity: 2,
    pricePerNight: 5000,
  },
  {
    name: "SUITE",
    description: "Suite hotel room",
    capacity: 2,
    pricePerNight: 10000,
  },
];

const rooms = [
  { roomNumber: "101", roomType: "STANDARD" },
  { roomNumber: "102", roomType: "STANDARD" },
  { roomNumber: "103", roomType: "STANDARD" },
  { roomNumber: "104", roomType: "STANDARD" },
  { roomNumber: "105", roomType: "STANDARD" },

  { roomNumber: "201", roomType: "EXECUTIVE" },
  { roomNumber: "202", roomType: "EXECUTIVE" },
  { roomNumber: "203", roomType: "EXECUTIVE" },
  { roomNumber: "204", roomType: "EXECUTIVE" },
  { roomNumber: "205", roomType: "EXECUTIVE" },

  { roomNumber: "301", roomType: "SUITE" },
  { roomNumber: "302", roomType: "SUITE" },
  { roomNumber: "303", roomType: "SUITE" },
  { roomNumber: "304", roomType: "SUITE" },
  { roomNumber: "305", roomType: "SUITE" },
];

const testUser = {
  firstName: "Test",
  lastName: "Customer",
  email: "test@example.com",
  phone: "08000000000",
};

async function main() {
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }

  console.log("Roles seeded successfully.");

  for (const roomType of roomTypes) {
    await prisma.roomType.upsert({
      where: { name: roomType.name },
      update: {
        description: roomType.description,
        capacity: roomType.capacity,
        pricePerNight: roomType.pricePerNight,
      },
      create: roomType,
    });
  }

  console.log("Room types seeded successfully.");

  for (const room of rooms) {
    const roomType = await prisma.roomType.findUnique({
      where: { name: room.roomType },
    });

    if (!roomType) {
      throw new Error(`Room type not found: ${room.roomType}`);
    }

    await prisma.room.upsert({
      where: { roomNumber: room.roomNumber },
      update: {
        roomTypeId: roomType.id,
      },
      create: {
        roomNumber: room.roomNumber,
        roomTypeId: roomType.id,
      },
    });
  }

  console.log("Rooms seeded successfully.");

  if (process.env.NODE_ENV !== "production") {
    const customerRole = await prisma.role.findUnique({
      where: { name: "CUSTOMER" },
    });

    if (!customerRole) {
      throw new Error("CUSTOMER role not found.");
    }

    const user = await prisma.user.upsert({
      where: {
        email: testUser.email,
      },
      update: {},
      create: testUser,
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: customerRole.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: customerRole.id,
      },
    });

    console.log("Test customer seeded successfully.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
