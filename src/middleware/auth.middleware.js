import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../lib/authTokens.js";

export async function authenticate(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication is required.",
    });
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication is required.",
    });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        status: true,
        roles: {
          select: {
            role: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication is invalid.",
      });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "This account is not active.",
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      roles: user.roles.map(({ role }) => role.name),
    };

    return next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Access token is invalid or expired.",
    });
  }
}

export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    const isAllowed = req.user?.roles.some((role) =>
      allowedRoles.includes(role),
    );

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to perform this action.",
      });
    }

    return next();
  };
}
