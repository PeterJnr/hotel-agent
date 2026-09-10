import {
  loginWithEmail,
  loginWithGoogle,
  linkGoogleAccount,
  logoutSession,
  refreshSession,
  registerWithEmail,
  requestPasswordReset,
  resetPassword,
} from "../services/auth.service.js";

function sendError(res, error) {
  return res.status(error.statusCode || 400).json({
    success: false,
    message: error.message,
  });
}

export async function register(req, res) {
  try {
    const result = await registerWithEmail(req.body);

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function login(req, res) {
  try {
    const result = await loginWithEmail(req.body);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function forgotPassword(req, res) {
  try {
    await requestPasswordReset(req.body);
    return res.status(200).json({
      success: true,
      message: "If an eligible account exists, a password reset link has been sent.",
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function completePasswordReset(req, res) {
  try {
    await resetPassword(req.body);
    return res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now sign in.",
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function refresh(req, res) {
  try {
    const result = await refreshSession(req.body.refreshToken);

    return res.status(200).json({
      success: true,
      message: "Session refreshed successfully.",
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function logout(req, res) {
  try {
    await logoutSession(req.body.refreshToken);

    return res.status(200).json({
      success: true,
      message: "Logout successful.",
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function googleLogin(req, res) {
  try {
    const result = await loginWithGoogle(req.body.credential);

    return res.status(200).json({
      success: true,
      message: "Google login successful.",
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function googleLink(req, res) {
  try {
    const account = await linkGoogleAccount({
      userId: req.user.id,
      credential: req.body.credential,
    });

    return res.status(200).json({
      success: true,
      message: "Google account linked successfully.",
      data: {
        provider: account.provider,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}
