import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const accessTokenLifetime = "15m";
const refreshTokenLifetimeDays = 30;

function getAccessTokenSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_ACCESS_SECRET must be configured with at least 32 characters.",
    );
  }

  return secret;
}

export function createAccessToken({ userId, roles }) {
  return jwt.sign({ roles }, getAccessTokenSecret(), {
    algorithm: "HS256",
    subject: userId,
    issuer: "hotel-ai",
    audience: "hotel-ai-api",
    expiresIn: accessTokenLifetime,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, getAccessTokenSecret(), {
    algorithms: ["HS256"],
    issuer: "hotel-ai",
    audience: "hotel-ai-api",
  });
}

export function createRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getRefreshTokenExpiry() {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + refreshTokenLifetimeDays);
  return expiresAt;
}
