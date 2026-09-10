import crypto from "node:crypto";

import { prisma } from "../src/lib/prisma.js";
import {
  createStaff,
  getStaffById,
  getStaffMembers,
  replaceStaffRoles,
  updateStaffStatus,
} from "../src/services/staff.service.js";

const suffix = crypto.randomUUID().slice(0, 8);
let staff;
let onboardingEmailSent = false;

process.env.SENDLIB_API_KEY = "staff-email-smoke-test-key";
process.env.SENDLIB_FROM_EMAIL = "Apex Solacii <bookings@example.com>";
process.env.FRONTEND_LOGIN_URL = "http://localhost:5173/login";
globalThis.fetch = async (url, options) => {
  if (url !== "https://sendlib.samueltuoyo.com/api/send") {
    throw new Error(`Unexpected smoke-test URL: ${url}`);
  }

  const body = JSON.parse(options.body);
  onboardingEmailSent =
    body.to?.includes("staff-smoke-") &&
    body.html?.includes("ADMIN") &&
    !body.html?.includes("SmokePass123!");

  return {
    ok: true,
    json: async () => ({ messageId: "staff-onboarding-smoke-email" }),
  };
};

try {
  staff = await createStaff({
    firstName: "Staff",
    lastName: "Smoke",
    email: `staff-smoke-${suffix}@example.com`,
    password: "SmokePass123!",
    roles: ["ADMIN", "FRONT_DESK"],
  });

  const listing = await getStaffMembers({ search: suffix, limit: 10 });
  const updated = await replaceStaffRoles({
    userId: staff.id,
    actorUserId: "different-super-admin",
    roles: ["ACCOUNTANT"],
  });
  const detail = await getStaffById(staff.id);
  const suspended = await updateStaffStatus({
    userId: staff.id,
    status: "SUSPENDED",
    actorUserId: "different-super-admin",
  });
  const reactivated = await updateStaffStatus({
    userId: staff.id,
    status: "ACTIVE",
    actorUserId: "different-super-admin",
  });

  let selfLockoutMessage;
  try {
    await replaceStaffRoles({
      userId: staff.id,
      actorUserId: staff.id,
      roles: ["ADMIN"],
    });
  } catch (error) {
    selfLockoutMessage = error.message;
  }

  let selfStatusLockoutMessage;
  try {
    await updateStaffStatus({
      userId: staff.id,
      status: "INACTIVE",
      actorUserId: staff.id,
    });
  } catch (error) {
    selfStatusLockoutMessage = error.message;
  }

  const result = {
    createdRoles: staff.roles.map(({ name }) => name).sort(),
    listed: listing.pagination.total === 1,
    updatedRoles: updated.roles.map(({ name }) => name),
    passwordHidden: !("passwordHash" in detail),
    onboardingEmailSent,
    onboardingReported: staff.onboardingEmail?.status === "SENT",
    statusLifecycle:
      suspended.status === "SUSPENDED" && reactivated.status === "ACTIVE",
    selfLockoutProtected:
      selfLockoutMessage === "You cannot remove your own SUPER_ADMIN role.",
    selfStatusLockoutProtected:
      selfStatusLockoutMessage ===
      "You cannot deactivate or suspend your own account.",
  };

  console.log(JSON.stringify(result, null, 2));

  if (
    result.createdRoles.join(",") !== "ADMIN,FRONT_DESK" ||
    !result.listed ||
    result.updatedRoles.join(",") !== "ACCOUNTANT" ||
    !result.passwordHidden ||
    !result.onboardingEmailSent ||
    !result.onboardingReported ||
    !result.statusLifecycle ||
    !result.selfLockoutProtected ||
    !result.selfStatusLockoutProtected
  ) {
    process.exitCode = 1;
  }
} finally {
  if (staff) {
    await prisma.user.delete({ where: { id: staff.id } });
  }
  await prisma.$disconnect();
}
