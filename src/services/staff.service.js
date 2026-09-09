import bcrypt from "bcryptjs";

import { prisma } from "../lib/prisma.js";
import { notifyStaffOnboarded } from "./emailNotification.service.js";

const staffRoleNames = [
  "SUPER_ADMIN",
  "ADMIN",
  "FRONT_DESK",
  "RESERVATION_MANAGER",
  "ACCOUNTANT",
  "SERVICE_MANAGER",
];
const staffRoleSet = new Set(staffRoleNames);
const userStatuses = new Set(["ACTIVE", "INACTIVE", "SUSPENDED"]);

const staffSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  roles: {
    select: {
      assignedAt: true,
      role: {
        select: {
          name: true,
          description: true,
        },
      },
    },
    orderBy: { assignedAt: "asc" },
  },
};

function staffError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requireText(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw staffError(`${fieldName} is required.`);
  }

  return value.trim();
}

function normalizeEmail(email) {
  const normalized = requireText(email, "Email").toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw staffError("A valid email address is required.");
  }

  return normalized;
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw staffError("Password must contain at least 8 characters.");
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    throw staffError("Password must not exceed 72 UTF-8 bytes.");
  }
}

function normalizeRoles(roles) {
  if (!Array.isArray(roles) || roles.length === 0) {
    throw staffError("At least one staff role is required.");
  }

  const normalized = [
    ...new Set(
      roles.map((role) =>
        typeof role === "string" ? role.trim().toUpperCase() : role,
      ),
    ),
  ];

  if (normalized.some((role) => !staffRoleSet.has(role))) {
    throw staffError(
      `Roles must be one or more of: ${staffRoleNames.join(", ")}.`,
    );
  }

  return normalized;
}

function serializeStaff(user) {
  return {
    ...user,
    roles: user.roles.map(({ role, assignedAt }) => ({
      name: role.name,
      description: role.description,
      assignedAt,
    })),
  };
}

async function getConfiguredRoles(client, roleNames) {
  const roles = await client.role.findMany({
    where: { name: { in: roleNames } },
    select: { id: true, name: true },
  });

  if (roles.length !== roleNames.length) {
    throw staffError("One or more staff roles are not configured.", 500);
  }

  return roles;
}

export async function createStaff({
  firstName,
  lastName,
  email,
  phone,
  password,
  roles,
}) {
  const normalizedFirstName = requireText(firstName, "First name");
  const normalizedLastName = requireText(lastName, "Last name");
  const normalizedEmail = normalizeEmail(email);
  const normalizedRoles = normalizeRoles(roles);
  validatePassword(password);

  if (phone !== undefined && phone !== null && typeof phone !== "string") {
    throw staffError("Phone must be text or null.");
  }

  const normalizedPhone = phone?.trim() || null;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const staff = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      if (existingUser) {
        throw staffError("An account with this email already exists.", 409);
      }

      const configuredRoles = await getConfiguredRoles(tx, normalizedRoles);

      return tx.user.create({
        data: {
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          email: normalizedEmail,
          phone: normalizedPhone,
          passwordHash,
          accounts: {
            create: {
              provider: "EMAIL",
              providerAccountId: normalizedEmail,
            },
          },
          roles: {
            create: configuredRoles.map(({ id }) => ({ roleId: id })),
          },
        },
        select: staffSelect,
      });
    });

    const serializedStaff = serializeStaff(staff);
    const delivery = await notifyStaffOnboarded(serializedStaff);
    return {
      ...serializedStaff,
      onboardingEmail: { status: delivery ? "SENT" : "FAILED" },
    };
  } catch (error) {
    if (error.code === "P2002") {
      throw staffError("Email or phone is already in use.", 409);
    }

    throw error;
  }
}

export async function getStaffMembers({ page = 1, limit = 20, role, search }) {
  const pageNumber = Number(page);
  const limitNumber = Number(limit);

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw staffError("Page must be a positive whole number.");
  }

  if (!Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > 100) {
    throw staffError("Limit must be a whole number from 1 to 100.");
  }

  const normalizedRole = role?.trim().toUpperCase();

  if (normalizedRole && !staffRoleSet.has(normalizedRole)) {
    throw staffError("Invalid staff role filter.");
  }

  const normalizedSearch = search?.trim();
  const where = {
    roles: {
      some: {
        role: {
          name: normalizedRole || { in: staffRoleNames },
        },
      },
    },
    ...(normalizedSearch
      ? {
          OR: [
            { firstName: { contains: normalizedSearch, mode: "insensitive" } },
            { lastName: { contains: normalizedSearch, mode: "insensitive" } },
            { email: { contains: normalizedSearch, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [staff, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: staffSelect,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip: (pageNumber - 1) * limitNumber,
      take: limitNumber,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    staff: staff.map(serializeStaff),
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      pages: Math.ceil(total / limitNumber),
    },
  };
}

export async function getStaffById(userId) {
  const staff = await prisma.user.findFirst({
    where: {
      id: userId,
      roles: { some: { role: { name: { in: staffRoleNames } } } },
    },
    select: staffSelect,
  });

  if (!staff) {
    throw staffError("Staff account not found.", 404);
  }

  return serializeStaff(staff);
}

export async function replaceStaffRoles({ userId, roles, actorUserId }) {
  const normalizedRoles = normalizeRoles(roles);

  if (userId === actorUserId && !normalizedRoles.includes("SUPER_ADMIN")) {
    throw staffError("You cannot remove your own SUPER_ADMIN role.", 409);
  }

  const staff = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirst({
      where: {
        id: userId,
        roles: { some: { role: { name: { in: staffRoleNames } } } },
      },
      select: { id: true },
    });

    if (!target) {
      throw staffError("Staff account not found.", 404);
    }

    const allStaffRoles = await getConfiguredRoles(tx, staffRoleNames);
    const selectedRoles = allStaffRoles.filter(({ name }) =>
      normalizedRoles.includes(name),
    );

    await tx.userRole.deleteMany({
      where: {
        userId,
        roleId: { in: allStaffRoles.map(({ id }) => id) },
      },
    });
    await tx.userRole.createMany({
      data: selectedRoles.map(({ id }) => ({ userId, roleId: id })),
    });

    return tx.user.findUnique({
      where: { id: userId },
      select: staffSelect,
    });
  });

  return serializeStaff(staff);
}

export async function updateStaffStatus({ userId, status, actorUserId }) {
  const normalizedStatus =
    typeof status === "string" ? status.trim().toUpperCase() : status;

  if (!userStatuses.has(normalizedStatus)) {
    throw staffError("Status must be ACTIVE, INACTIVE, or SUSPENDED.");
  }

  if (userId === actorUserId && normalizedStatus !== "ACTIVE") {
    throw staffError("You cannot deactivate or suspend your own account.", 409);
  }

  const staff = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findFirst({
      where: {
        id: userId,
        roles: { some: { role: { name: { in: staffRoleNames } } } },
      },
      select: { id: true },
    });

    if (!target) {
      throw staffError("Staff account not found.", 404);
    }

    const updatedStaff = await tx.user.update({
      where: { id: userId },
      data: { status: normalizedStatus },
      select: staffSelect,
    });

    if (normalizedStatus !== "ACTIVE") {
      await tx.refreshToken.deleteMany({ where: { userId } });
    }

    return updatedStaff;
  });

  return serializeStaff(staff);
}

export async function getAssignableStaffRoles() {
  return prisma.role.findMany({
    where: { name: { in: staffRoleNames } },
    select: { name: true, description: true },
    orderBy: { name: "asc" },
  });
}
