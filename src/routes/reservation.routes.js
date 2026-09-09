import express from "express";
import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";
import {
  postReservation,
  cancelReservation,
  customerReservations,
  getReservation,
  getReservations,
  patchReservationStatus,
} from "../controllers/reservation.controller.js";

const router = express.Router();
const reservationStaff = authorizeRoles(
  "SUPER_ADMIN",
  "ADMIN",
  "FRONT_DESK",
  "RESERVATION_MANAGER",
  "ACCOUNTANT",
);
const operationalStaff = authorizeRoles(
  "SUPER_ADMIN",
  "ADMIN",
  "FRONT_DESK",
  "RESERVATION_MANAGER",
);

router.get("/", authenticate, reservationStaff, getReservations);
router.post("/create", authenticate, postReservation);
router.post("/cancel", authenticate, cancelReservation);
router.get("/me", authenticate, customerReservations);
router.patch(
  "/:reservationId/status",
  authenticate,
  operationalStaff,
  patchReservationStatus,
);
router.get("/:reservationId", authenticate, getReservation);

export default router;
