import express from "express";

import { managementDashboard } from "../controllers/management.controller.js";
import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

const router = express.Router();
const dashboardReaders = authorizeRoles(
  "SUPER_ADMIN",
  "ADMIN",
  "FRONT_DESK",
  "RESERVATION_MANAGER",
  "ACCOUNTANT",
  "SERVICE_MANAGER",
);

router.get("/dashboard", authenticate, dashboardReaders, managementDashboard);

export default router;
