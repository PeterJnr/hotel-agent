import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";

import {
  login,
  googleLink,
  googleLogin,
  logout,
  refresh,
  register,
  forgotPassword,
  completePasswordReset,
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", completePasswordReset);
router.post("/google", googleLogin);
router.post("/google/link", authenticate, googleLink);
router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;
