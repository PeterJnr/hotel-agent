import { pathToFileURL } from "node:url";

import { prisma } from "../src/lib/prisma.js";

export async function promoteSuperAdmin(email) {
  if (typeof email !== "string" || !email.trim()) {
    throw new Error(
      "Usage: npm run promote:super-admin -- registered@example.com",
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      status: true,
    },
  });

  if (!user) {
    throw new Error("No registered user was found with that email.");
  }

  if (user.status !== "ACTIVE") {
    throw new Error("Only an active user can be promoted to super admin.");
  }

  const superAdminRole = await prisma.role.findUnique({
    where: { name: "SUPER_ADMIN" },
    select: { id: true },
  });

  if (!superAdminRole) {
    throw new Error("SUPER_ADMIN role is not configured.");
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: superAdminRole.id,
    },
  });

  return user;
}

async function main() {
  const user = await promoteSuperAdmin(process.argv[2]);
  console.log(`Super-admin role assigned to ${user.email}.`);
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
