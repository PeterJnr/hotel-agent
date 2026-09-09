import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client();

function getGoogleClientId() {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    const error = new Error("GOOGLE_CLIENT_ID is not configured.");
    error.statusCode = 500;
    throw error;
  }

  return clientId;
}

export async function verifyGoogleCredential(credential) {
  if (typeof credential !== "string" || !credential.trim()) {
    const error = new Error("Google credential is required.");
    error.statusCode = 400;
    throw error;
  }

  const clientId = getGoogleClientId();

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      const error = new Error(
        "Google account must provide a verified email address.",
      );
      error.statusCode = 401;
      throw error;
    }

    return payload;
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }

    const invalidCredentialError = new Error(
      "Google credential is invalid or expired.",
    );
    invalidCredentialError.statusCode = 401;
    throw invalidCredentialError;
  }
}
