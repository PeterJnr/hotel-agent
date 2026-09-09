import bcrypt from "bcryptjs";

import { prisma } from "../lib/prisma.js";
import { verifyGoogleCredential } from "../lib/googleAuth.js";
import { notifyCustomerWelcome } from "./emailNotification.service.js";
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

      return { user: publicUser(user), ...tokens };
    });
    await notifyCustomerWelcome(result.user);
    return result;
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
      return { user: publicUser(user), ...tokens };
    });
    await notifyCustomerWelcome(result.user);
    return result;
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
