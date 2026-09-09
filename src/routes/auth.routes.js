import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";

import {
  login,
  googleLink,
  googleLogin,
  logout,
  refresh,
  register,
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/google/link", authenticate, googleLink);
router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;
