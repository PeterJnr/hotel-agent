import express from "express";

import {
  getStaff,
  listStaff,
  listStaffRoles,
  patchStaffStatus,
  postStaff,
  putStaffRoles,
} from "../controllers/staff.controller.js";
import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

const router = express.Router();
const superAdminOnly = authorizeRoles("SUPER_ADMIN");

router.use(authenticate, superAdminOnly);
router.get("/roles", listStaffRoles);
router.get("/", listStaff);
router.post("/", postStaff);
router.get("/:userId", getStaff);
router.put("/:userId/roles", putStaffRoles);
router.patch("/:userId/status", patchStaffStatus);

export default router;
