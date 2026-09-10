import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";

import { prisma } from "../lib/prisma.js";
import { verifyGoogleCredential } from "../lib/googleAuth.js";
import { deliverEmailOutboxJob, enqueueEmail } from "./emailOutbox.service.js";
import {
  createAccessToken,
  createRefreshToken,
  getRefreshTokenExpiry,
  hashRefreshToken,
} from "../lib/authTokens.js";

function authError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeEmail(email) {
  if (typeof email !== "string") {
    throw authError("A valid email address is required.");
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw authError("A valid email address is required.");
  }

  return normalizedEmail;
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw authError("Password must contain at least 8 characters.");
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    throw authError("Password must not exceed 72 UTF-8 bytes.");
  }
}

function hashPasswordResetToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function passwordResetUrl(token) {
  const configured = process.env.FRONTEND_RESET_PASSWORD_URL?.trim();
  const loginUrl = process.env.FRONTEND_LOGIN_URL?.trim();
  const baseUrl = configured || (loginUrl ? new URL("/reset-password", loginUrl).toString() : "http://localhost:5173/reset-password");
  const url = new URL(baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

function requireName(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw authError(`${fieldName} is required.`);
  }

  return value.trim();
}

function getRoleNames(user) {
  return user.roles.map(({ role }) => role.name);
}

function publicUser(user) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    status: user.status,
    roles: getRoleNames(user),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function createSession(client, user) {
  const roles = getRoleNames(user);
  const refreshToken = createRefreshToken();

  await client.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  return {
    accessToken: createAccessToken({ userId: user.id, roles }),
    refreshToken,
  };
}

const userWithRoles = {
  roles: {
    include: {
      role: true,
    },
  },
};

export async function registerWithEmail({
  firstName,
  lastName,
  email,
  phone,
  password,
}) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedFirstName = requireName(firstName, "First name");
  const normalizedLastName = requireName(lastName, "Last name");
  validatePassword(password);

  if (phone !== undefined && phone !== null && typeof phone !== "string") {
    throw authError("Phone must be text or null.");
  }

  const normalizedPhone = phone?.trim() || null;
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });

      if (existingUser) {
        throw authError("An account with this email already exists.", 409);
      }

      const customerRole = await tx.role.findUnique({
        where: { name: "CUSTOMER" },
      });

      if (!customerRole) {
        throw new Error("CUSTOMER role is not configured.");
      }

      const user = await tx.user.create({
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
            create: {
              roleId: customerRole.id,
            },
          },
        },
        include: userWithRoles,
      });

      const tokens = await createSession(tx, user);
      const publicAccount = publicUser(user);
      const outbox = await enqueueEmail(tx, { event: "CUSTOMER_WELCOME", dedupeKey: `customer-welcome:${user.id}`, payload: { customer: publicAccount } });
      return { user: publicAccount, ...tokens, outboxJobId: outbox.id };
    });
    const { outboxJobId, ...session } = result;
    await deliverEmailOutboxJob(outboxJobId);
    return session;
  } catch (error) {
    if (error.code === "P2002") {
      throw authError("Email or phone is already in use.", 409);
    }

    throw error;
  }
}

export async function loginWithEmail({ email, password }) {
  const normalizedEmail = normalizeEmail(email);

  if (typeof password !== "string" || !password) {
    throw authError("Password is required.");
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: userWithRoles,
  });

  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    throw authError("Invalid email or password.", 401);
  }

  if (user.status !== "ACTIVE") {
    throw authError("This account is not active.", 403);
  }

  const tokens = await createSession(prisma, user);
  return { user: publicUser(user), ...tokens };
}

export async function requestPasswordReset({ email }) {
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, firstName: true, email: true, passwordHash: true, status: true },
  });

  if (!user?.passwordHash || user.status !== "ACTIVE") return;

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashPasswordResetToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const resetUrl = passwordResetUrl(token);
  const outbox = await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
    return enqueueEmail(tx, {
      event: "PASSWORD_RESET",
      dedupeKey: `password-reset:${tokenHash}`,
      payload: { user: { id: user.id, firstName: user.firstName, email: user.email }, resetUrl, expiresIn: "1 hour" },
    });
  });

  await deliverEmailOutboxJob(outbox.id);
}

export async function resetPassword({ token, password }) {
  if (typeof token !== "string" || !token.trim()) throw authError("Reset token is required.");
  validatePassword(password);
  const tokenHash = hashPasswordResetToken(token.trim());
  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const resetToken = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) {
      throw authError("This password reset link is invalid or has expired.", 400);
    }

    await tx.user.update({ where: { id: resetToken.userId }, data: { passwordHash } });
    await tx.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: now } });
    await tx.passwordResetToken.deleteMany({ where: { userId: resetToken.userId, id: { not: resetToken.id } } });
    await tx.refreshToken.deleteMany({ where: { userId: resetToken.userId } });
  });
}

export async function refreshSession(token) {
  if (typeof token !== "string" || !token) {
    throw authError("Refresh token is required.");
  }

  const tokenHash = hashRefreshToken(token);
  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: userWithRoles,
      },
    },
  });

  if (!storedToken || storedToken.expiresAt <= new Date()) {
    throw authError("Refresh token is invalid or expired.", 401);
  }

  if (storedToken.user.status !== "ACTIVE") {
    throw authError("This account is not active.", 403);
  }

  const tokens = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.delete({ where: { id: storedToken.id } });
    return createSession(tx, storedToken.user);
  });

  return { user: publicUser(storedToken.user), ...tokens };
}

export async function logoutSession(token) {
  if (typeof token !== "string" || !token) {
    throw authError("Refresh token is required.");
  }

  await prisma.refreshToken.deleteMany({
    where: {
      tokenHash: hashRefreshToken(token),
    },
  });
}

export async function loginWithGoogle(credential) {
  const googleProfile = await verifyGoogleCredential(credential);
  const normalizedEmail = googleProfile.email.trim().toLowerCase();

  const googleAccount = await prisma.authAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "GOOGLE",
        providerAccountId: googleProfile.sub,
      },
    },
    include: {
      user: {
        include: userWithRoles,
      },
    },
  });

  if (googleAccount) {
    if (googleAccount.user.status !== "ACTIVE") {
      throw authError("This account is not active.", 403);
    }

    const tokens = await createSession(prisma, googleAccount.user);
    return { user: publicUser(googleAccount.user), ...tokens };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingUser) {
    throw authError(
      "An account with this email already exists. Sign in first and link Google.",
      409,
    );
  }

  const firstName =
    googleProfile.given_name?.trim() ||
    googleProfile.name?.trim().split(/\s+/)[0] ||
    "Google";
  const lastName =
    googleProfile.family_name?.trim() ||
    googleProfile.name?.trim().split(/\s+/).slice(1).join(" ") ||
    "User";

  try {
    const result = await prisma.$transaction(async (tx) => {
      const customerRole = await tx.role.findUnique({
        where: { name: "CUSTOMER" },
      });

      if (!customerRole) {
        throw new Error("CUSTOMER role is not configured.");
      }

      const user = await tx.user.create({
        data: {
          firstName,
          lastName,
          email: normalizedEmail,
          accounts: {
            create: {
              provider: "GOOGLE",
              providerAccountId: googleProfile.sub,
            },
          },
          roles: {
            create: {
              roleId: customerRole.id,
            },
          },
        },
        include: userWithRoles,
      });

      const tokens = await createSession(tx, user);
      const publicAccount = publicUser(user);
      const outbox = await enqueueEmail(tx, { event: "CUSTOMER_WELCOME", dedupeKey: `customer-welcome:${user.id}`, payload: { customer: publicAccount } });
      return { user: publicAccount, ...tokens, outboxJobId: outbox.id };
    });
    const { outboxJobId, ...session } = result;
    await deliverEmailOutboxJob(outboxJobId);
    return session;
  } catch (error) {
    if (error.code === "P2002") {
      throw authError(
        "This Google account or email is already associated with an account.",
        409,
      );
    }

    throw error;
  }
}

export async function linkGoogleAccount({ userId, credential }) {
  const googleProfile = await verifyGoogleCredential(credential);
  const existingAccount = await prisma.authAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "GOOGLE",
        providerAccountId: googleProfile.sub,
      },
    },
  });

  if (existingAccount) {
    if (existingAccount.userId === userId) {
      return existingAccount;
    }

    throw authError(
      "This Google account is already linked to another user.",
      409,
    );
  }

  try {
    return await prisma.authAccount.create({
      data: {
        userId,
        provider: "GOOGLE",
        providerAccountId: googleProfile.sub,
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw authError("This Google account is already linked.", 409);
    }

    throw error;
  }
}
