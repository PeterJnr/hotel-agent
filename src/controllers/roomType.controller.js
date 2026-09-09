import {
  getRoomTypes,
  getRoomTypeById,
  updateRoomType,
} from "../services/roomType.service.js";

export async function getAllRoomTypes(req, res) {
  try {
    const roomTypes = await getRoomTypes();

    return res.status(200).json({
      success: true,
      data: roomTypes,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export async function getRoomType(req, res) {
  try {
    const { roomTypeId } = req.params;

    const roomType = await getRoomTypeById(roomTypeId);

    return res.status(200).json({
      success: true,
      data: roomType,
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

export async function patchRoomType(req, res) {
  try {
    const { roomTypeId } = req.params;

    const { description, capacity, pricePerNight } = req.body;

    const roomType = await updateRoomType({
      roomTypeId,
      description,
      capacity: capacity !== undefined ? Number(capacity) : undefined,
      pricePerNight,
    });

    return res.status(200).json({
      success: true,
      message: "Room type updated successfully.",
      data: roomType,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}
