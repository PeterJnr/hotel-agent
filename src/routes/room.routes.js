import express from "express";
import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";
import { getAvailability } from "../controllers/availability.controller.js";
import {
  postRoom,
  getRooms,
  getRoom,
  updateRoom,
  deleteRoom,
} from "../controllers/room.controller.js";

const router = express.Router();
const roomReaders = authorizeRoles(
  "SUPER_ADMIN",
  "ADMIN",
  "FRONT_DESK",
  "RESERVATION_MANAGER",
  "SERVICE_MANAGER",
);
const roomManagers = authorizeRoles("SUPER_ADMIN", "ADMIN");

router.get("/availability", getAvailability);
router.get("/", authenticate, roomReaders, getRooms);
router.get("/:roomId", authenticate, roomReaders, getRoom);
router.post("/create", authenticate, roomManagers, postRoom);
router.patch("/:roomId", authenticate, roomManagers, updateRoom);
router.delete("/:roomId", authenticate, roomManagers, deleteRoom);

export default router;
