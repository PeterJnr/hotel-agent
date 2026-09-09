import express from "express";
import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

import { uploadRoomTypeImages } from "../middleware/upload.middleware.js";

import {
  postRoomTypeImages,
  getImages,
  makePrimary,
  reorderImages,
  removeImage,
} from "../controllers/roomTypeImage.controller.js";

const router = express.Router();
const imageManagers = authorizeRoles("SUPER_ADMIN", "ADMIN");

router.post(
  "/:roomTypeId/images",
  authenticate,
  imageManagers,
  uploadRoomTypeImages,
  postRoomTypeImages,
);

router.get("/:roomTypeId/images", getImages);

router.patch(
  "/:roomTypeId/images/:imageId/primary",
  authenticate,
  imageManagers,
  makePrimary,
);

router.patch(
  "/:roomTypeId/images/reorder",
  authenticate,
  imageManagers,
  reorderImages,
);

router.delete(
  "/:roomTypeId/images/:imageId",
  authenticate,
  imageManagers,
  removeImage,
);

export default router;
