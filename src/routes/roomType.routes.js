import express from "express";
import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

import {
  getAllRoomTypes,
  getRoomType,
  patchRoomType,
} from "../controllers/roomType.controller.js";

const router = express.Router();
const roomTypeManagers = authorizeRoles("SUPER_ADMIN", "ADMIN");

router.get("/", getAllRoomTypes);
router.get("/:roomTypeId", getRoomType);
router.patch(
  "/:roomTypeId",
  authenticate,
  roomTypeManagers,
  patchRoomType,
);

export default router;
