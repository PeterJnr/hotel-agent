import {
  uploadRoomTypeImages,
  getRoomTypeImages,
  setPrimaryRoomTypeImage,
  reorderRoomTypeImages,
  deleteRoomTypeImage,
} from "../services/roomTypeImage.service.js";

export async function postRoomTypeImages(req, res) {
  try {
    const { roomTypeId } = req.params;
    const { altText } = req.body;

    const images = await uploadRoomTypeImages({
      roomTypeId,
      files: req.files,
      altText,
    });

    return res.status(201).json({
      success: true,
      message: `${images.length} room type image(s) uploaded successfully.`,
      data: images,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export async function getImages(req, res) {
  try {
    const { roomTypeId } = req.params;

    const images = await getRoomTypeImages(roomTypeId);

    return res.status(200).json({
      success: true,
      data: images,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export async function makePrimary(req, res) {
  try {
    const { roomTypeId, imageId } = req.params;

    const image = await setPrimaryRoomTypeImage({
      roomTypeId,
      imageId,
    });

    return res.status(200).json({
      success: true,
      message: "Primary image updated successfully.",
      data: image,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export async function reorderImages(req, res) {
  try {
    const { roomTypeId } = req.params;
    const { imageIds } = req.body;

    if (!Array.isArray(imageIds)) {
      return res.status(400).json({
        success: false,
        message: "imageIds must be an array.",
      });
    }

    const images = await reorderRoomTypeImages({
      roomTypeId,
      imageIds,
    });

    return res.status(200).json({
      success: true,
      message: "Room type images reordered successfully.",
      data: images,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export async function removeImage(req, res) {
  try {
    const { roomTypeId, imageId } = req.params;

    const result = await deleteRoomTypeImage({
      roomTypeId,
      imageId,
    });

    return res.status(200).json({
      success: true,
      message: "Room type image deleted successfully.",
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}
